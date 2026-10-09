import { createHash, randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { nepalOperationalDate } from "../../invoice-effective-status";
import { nepalFiscalYear } from "../../nepali-calendar";
import { canAccessBranchValue, strictBranchValue } from "../branch-access-policy";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { readAllDocuments } from "../firestore-scan";
import { jobCostCategories, type JobCostCategory } from "../job-file";
import { qaMockDataEnabled } from "../qa-fixtures";
import { resolveShipmentBranchAccess } from "../shipment-access-policy";
import type { KcplStaffContext } from "../staff-directory.server";
import { nextTaxDocumentNumber } from "./customer-credit-ledger.server";
import { refundMethods } from "./refund-policy";
import { staffCashSettlement, staffCashSpent, validStaffExpense, type StaffCashSettlement } from "./staff-cash-policy";

/*
 * Staff cash advances: cash handed to staff for fees paid on the spot, the
 * receipts they bring back, and the settlement. Expenses tied to a shipment
 * become its Job File costs when the advance is settled, under the advance's
 * number, so a fee paid in cash is never missing from a job's margin.
 */

export const STAFF_ADVANCES = "staff_advances";
type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function num(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function childId(prefix: string, key?: string) {
  // A key from the form makes a retried or double-clicked request land on the same document.
  const cleaned = key?.trim().slice(0, 120);
  return cleaned ? `${prefix}-${createHash("sha256").update(cleaned).digest("hex").slice(0, 32)}` : `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

export type StaffExpense = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: JobCostCategory;
  shipment_reference: string | null;
  receipt_number: string | null;
  recorded_by_name: string;
};

export type StaffAdvance = {
  id: string;
  number: string;
  staff_name: string;
  staff_email: string;
  branch: string;
  currency: string;
  amount: number;
  given_on: string;
  method: string;
  purpose: string;
  status: "open" | "settled";
  spent: number;
  settlement: StaffCashSettlement;
  settled_on: string | null;
  settled_by_name: string | null;
  given_by_name: string;
  expenses: StaffExpense[];
};

function expenseFromDoc(doc: FirebaseFirestore.DocumentSnapshot): StaffExpense {
  const data = (doc.data() ?? {}) as Record<string, unknown>;
  return {
    id: doc.id,
    date: text(data.date),
    description: text(data.description),
    amount: num(data.amount),
    category: jobCostCategories.includes(data.category as JobCostCategory) ? data.category as JobCostCategory : "other",
    shipment_reference: nullable(data.shipment_reference),
    receipt_number: nullable(data.receipt_number),
    recorded_by_name: text(data.recorded_by_name, "KCPL Accounts"),
  };
}

function advanceFromDoc(doc: FirebaseFirestore.DocumentSnapshot, expenses: StaffExpense[]): StaffAdvance {
  const data = (doc.data() ?? {}) as Record<string, unknown>;
  const amount = num(data.amount);
  const spent = staffCashSpent(expenses);
  return {
    id: doc.id,
    number: text(data.number),
    staff_name: text(data.staff_name, "Staff"),
    staff_email: text(data.staff_email),
    branch: text(data.branch),
    currency: text(data.currency, "NPR"),
    amount,
    given_on: text(data.given_on),
    method: text(data.method, "cash"),
    purpose: text(data.purpose),
    status: data.status === "settled" ? "settled" : "open",
    spent,
    settlement: staffCashSettlement(amount, spent),
    settled_on: nullable(data.settled_on),
    settled_by_name: nullable(data.settled_by_name),
    given_by_name: text(data.given_by_name, "KCPL Accounts"),
    expenses: expenses.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function listStaffAdvances(context: KcplStaffContext): Promise<{ kind: "ready"; open: StaffAdvance[]; settled: StaffAdvance[] } | { kind: "forbidden" } | { kind: "unavailable" }> {
  if (!context.permissions.canManageFinance) return { kind: "forbidden" };
  if (qaMockDataEnabled()) return { kind: "ready", open: [], settled: [] };
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const db = firebaseAdminDb();
    const [open, settled] = await Promise.all([
      readAllDocuments(db.collection(STAFF_ADVANCES).where("status", "==", "open")),
      db.collection(STAFF_ADVANCES).orderBy("settled_on", "desc").limit(30).get(),
    ]);
    const docs = [...open.docs, ...settled.docs.filter((doc) => doc.get("status") === "settled")].filter((doc) => canAccessBranchValue(context, doc.get("branch")));
    const expenses = await Promise.all(docs.map((doc) => doc.ref.collection("expenses").get()));
    const advances = docs.map((doc, index) => advanceFromDoc(doc, expenses[index].docs.map(expenseFromDoc)));
    return {
      kind: "ready",
      open: advances.filter((item) => item.status === "open").sort((a, b) => a.given_on.localeCompare(b.given_on)),
      settled: advances.filter((item) => item.status === "settled"),
    };
  } catch (error) {
    console.error("KCPL staff cash failed", error);
    return { kind: "unavailable" };
  }
}

export async function getStaffAdvance(id: string, context: KcplStaffContext): Promise<{ kind: "ready"; advance: StaffAdvance } | { kind: "forbidden" } | { kind: "missing" } | { kind: "unavailable" }> {
  if (!context.permissions.canManageFinance) return { kind: "forbidden" };
  if (qaMockDataEnabled() || !firebaseRuntimeConfigured()) return { kind: "unavailable" };
  const doc = await firebaseAdminDb().collection(STAFF_ADVANCES).doc(id).get();
  if (!doc.exists) return { kind: "missing" };
  if (!canAccessBranchValue(context, doc.get("branch"))) return { kind: "forbidden" };
  const expenses = await doc.ref.collection("expenses").get();
  return { kind: "ready", advance: advanceFromDoc(doc, expenses.docs.map(expenseFromDoc)) };
}

/** Hand cash to a member of staff, under a numbered voucher. */
export async function giveStaffCash(input: { staffEmail: string; staffName: string; branch: string; currency: string; amount: number; givenOn: string; method: string; purpose: string; idempotencyKey?: string }, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const staffEmail = input.staffEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail)) return { kind: "staff_required" as const };
  const branch = strictBranchValue(input.branch);
  if (!branch || !canAccessBranchValue(context, branch)) return { kind: "forbidden" as const };
  const currency = input.currency.trim().toUpperCase();
  if (!crmCurrencies.includes(currency as CrmCurrency)) return { kind: "invalid_currency" as const };
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return { kind: "invalid_amount" as const };
  if (!(refundMethods as readonly string[]).includes(input.method)) return { kind: "invalid_method" as const };
  const today = nepalOperationalDate();
  const givenOn = input.givenOn.trim() || today;
  if (!validDate(givenOn) || givenOn > today) return { kind: "invalid_date" as const };
  const fiscalYear = nepalFiscalYear(givenOn);
  if (!fiscalYear) return { kind: "invalid_date" as const };
  const purpose = input.purpose.trim().slice(0, 300);
  if (purpose.length < 3) return { kind: "purpose_required" as const };
  const db = firebaseAdminDb();
  const ref = db.collection(STAFF_ADVANCES).doc(childId("advance", input.idempotencyKey));
  const result = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) return { number: text(existing.get("number")), repeated: true };
    const series = await nextTaxDocumentNumber(transaction, "staff_advance", fiscalYear);
    const now = new Date().toISOString();
    series.commit();
    transaction.create(ref, {
      number: series.number, staff_email: staffEmail, staff_name: input.staffName.trim().slice(0, 120) || staffEmail, branch, currency, amount,
      given_on: givenOn, method: input.method, purpose, status: "open", settled_on: null,
      given_by_name: actor.name, given_by_email: actor.email, created_at: now, updated_at: now,
    });
    return { number: series.number, repeated: false };
  });
  return { kind: "created" as const, id: ref.id, number: result.number, repeated: result.repeated };
}

/** A receipt the staff member brought back. */
export async function addStaffExpense(id: string, input: { date: string; description: string; amount: number; category: string; shipmentReference: string; receiptNumber: string; idempotencyKey?: string }, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const today = nepalOperationalDate();
  const valid = validStaffExpense({ amount: input.amount, date: input.date.trim() || today, description: input.description }, today);
  if (!valid.ok) return { kind: valid.reason };
  const category = jobCostCategories.includes(input.category as JobCostCategory) ? input.category as JobCostCategory : "other";
  const shipmentReference = input.shipmentReference.trim().toUpperCase();
  const db = firebaseAdminDb();
  const ref = db.collection(STAFF_ADVANCES).doc(id);
  return db.runTransaction(async (transaction) => {
    const [advance, shipment] = await Promise.all([
      transaction.get(ref),
      shipmentReference ? transaction.get(db.collection("shipments").doc(shipmentReference)) : Promise.resolve(null),
    ]);
    if (!advance.exists) return { kind: "missing" as const };
    if (!canAccessBranchValue(context, advance.get("branch"))) return { kind: "forbidden" as const };
    if (advance.get("status") !== "open") return { kind: "already_settled" as const };
    if (shipment && !shipment.exists) return { kind: "shipment_missing" as const };
    if (shipment && resolveShipmentBranchAccess(context, shipment.get("primary_branch"), shipment.get("handling_branches")).kind !== "allowed") return { kind: "forbidden" as const };
    const expenseRef = ref.collection("expenses").doc(childId("expense", input.idempotencyKey ? `${id}|${input.idempotencyKey}` : undefined));
    if ((await transaction.get(expenseRef)).exists) return { kind: "added" as const };
    const now = new Date().toISOString();
    transaction.create(expenseRef, {
      date: input.date.trim() || today, description: input.description.trim().slice(0, 300), amount: valid.amount, category,
      shipment_reference: shipmentReference || null, receipt_number: input.receiptNumber.trim().slice(0, 80) || null,
      recorded_by_name: actor.name, recorded_by_email: actor.email, created_at: now,
    });
    transaction.update(ref, { updated_at: now });
    return { kind: "added" as const };
  });
}

/** Remove an expense entered by mistake, while the advance is still open. */
export async function removeStaffExpense(id: string, expenseId: string, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const ref = db.collection(STAFF_ADVANCES).doc(id);
  return db.runTransaction(async (transaction) => {
    const advance = await transaction.get(ref);
    if (!advance.exists) return { kind: "missing" as const };
    if (!canAccessBranchValue(context, advance.get("branch"))) return { kind: "forbidden" as const };
    if (advance.get("status") !== "open") return { kind: "already_settled" as const };
    transaction.delete(ref.collection("expenses").doc(expenseId));
    return { kind: "removed" as const };
  });
}

/**
 * Settle an advance: the staff member returns what is left, or is paid what
 * they spent beyond it. Each expense tied to a shipment becomes a Job File
 * cost under the advance's number, in the same transaction.
 */
export async function settleStaffAdvance(id: string, input: { settledOn: string; method: string; note: string }, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const today = nepalOperationalDate();
  const settledOn = input.settledOn.trim() || today;
  if (!validDate(settledOn) || settledOn > today) return { kind: "invalid_date" as const };
  if (!(refundMethods as readonly string[]).includes(input.method)) return { kind: "invalid_method" as const };
  const db = firebaseAdminDb();
  const ref = db.collection(STAFF_ADVANCES).doc(id);
  return db.runTransaction(async (transaction) => {
    const advance = await transaction.get(ref);
    if (!advance.exists) return { kind: "missing" as const };
    if (!canAccessBranchValue(context, advance.get("branch"))) return { kind: "forbidden" as const };
    if (advance.get("status") !== "open") return { kind: "already_settled" as const };
    const expenseDocs = (await transaction.get(ref.collection("expenses"))).docs;
    const expenses = expenseDocs.map(expenseFromDoc);
    const shipments = [...new Set(expenses.map((item) => item.shipment_reference).filter((value): value is string => Boolean(value)))];
    const shipmentDocs = await Promise.all(shipments.map((reference) => transaction.get(db.collection("shipments").doc(reference))));
    if (shipmentDocs.some((doc) => !doc.exists)) return { kind: "shipment_missing" as const };
    const amount = num(advance.get("amount"));
    const spent = staffCashSpent(expenses);
    const settlement = staffCashSettlement(amount, spent);
    const now = new Date().toISOString();
    const number = text(advance.get("number"));
    const staffName = text(advance.get("staff_name"), "staff");
    for (const expense of expenses) {
      if (!expense.shipment_reference) continue;
      transaction.create(db.collection("shipments").doc(expense.shipment_reference).collection("job_costs").doc(`staff-cash-${expense.id}`), {
        category: expense.category, label: expense.description, vendor: `Paid in cash by ${staffName}`, amount: expense.amount,
        currency: text(advance.get("currency"), "NPR"), notes: expense.receipt_number ? `Receipt ${expense.receipt_number}` : null,
        source_type: "manual", source_reference: number, locked: true, created_at: now, created_by: actor.email,
      });
    }
    transaction.update(ref, {
      status: "settled", spent, settlement_kind: settlement.kind, settlement_amount: settlement.amount, settlement_method: input.method,
      settled_on: settledOn, settled_by_name: actor.name, settled_by_email: actor.email, settlement_note: input.note.trim().slice(0, 300) || null, updated_at: now,
    });
    return { kind: "settled" as const, settlement, costs: expenses.filter((item) => item.shipment_reference).length };
  });
}
