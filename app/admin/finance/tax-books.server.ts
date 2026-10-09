import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { nepalOperationalDate } from "../../invoice-effective-status";
import { adToBs, bsMonthRange, nepalFiscalYear } from "../../nepali-calendar";
import { canAccessBranchValue } from "../branch-access-policy";
import { readAllDocuments } from "../firestore-scan";
import { loadDocumentsById } from "../operational-shipments.server";
import { qaMockDataEnabled } from "../qa-fixtures";
import type { KcplStaffContext } from "../staff-directory.server";
import { CUSTOMER_CREDITS, CUSTOMER_REFUNDS } from "./customer-credit-ledger.server";
import { invoiceLedgerKind } from "./refund-policy";
import { moneyLedger, tallyLedgers, type TallyLedgerSettings, type TallyVoucher } from "./tally-export";
import {
  purchaseBookRow,
  salesBookCreditRow,
  salesBookInvoiceRow,
  sortBookRows,
  vatSummary,
  type PurchaseBookRow,
  type SalesBookRow,
  type VatSummary,
} from "./tax-books";
import { WITHHELD_TAX } from "./withheld-tax-ledger.server";
import { STAFF_ADVANCES } from "./staff-cash.server";
import { tdsDepositDue, withheldTaxStatusLabels, type WithheldTaxDirection, type WithheldTaxStatus } from "./withheld-tax-policy";

type Actor = { name: string; email: string };
type Doc = FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot;

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function num(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const TALLY_SETTINGS = "finance_settings";

export type WithheldTaxRow = {
  id: string;
  direction: WithheldTaxDirection;
  status: WithheldTaxStatus;
  status_label: string;
  document_kind: "invoice" | "payable";
  document_reference: string;
  document_number: string;
  counterparty_name: string;
  counterparty_pan: string | null;
  currency: string;
  amount: number;
  settled_amount: number;
  rate: number | null;
  withheld_on: string;
  deposit_due: string | null;
  certificate_number: string | null;
  deposit_reference: string | null;
  deposited_on: string | null;
  branch: string;
};

function withheldFromDoc(doc: Doc): WithheldTaxRow {
  const data = (doc.data() ?? {}) as Record<string, unknown>;
  const status = text(data.status) as WithheldTaxStatus;
  return {
    id: doc.id,
    direction: data.direction === "by_kcpl" ? "by_kcpl" : "by_customer",
    status,
    status_label: withheldTaxStatusLabels[status] ?? status,
    document_kind: data.document_kind === "payable" ? "payable" : "invoice",
    document_reference: text(data.document_reference),
    document_number: text(data.document_number) || text(data.document_reference),
    counterparty_name: text(data.counterparty_name, "—"),
    counterparty_pan: nullable(data.counterparty_pan),
    currency: text(data.currency, "NPR"),
    amount: num(data.amount),
    settled_amount: num(data.settled_amount),
    rate: data.rate === null || data.rate === undefined ? null : num(data.rate),
    withheld_on: text(data.withheld_on),
    deposit_due: nullable(data.deposit_due),
    certificate_number: nullable(data.certificate_number),
    deposit_reference: nullable(data.deposit_reference),
    deposited_on: nullable(data.deposited_on),
    branch: text(data.branch),
  };
}

export type TaxMonth = {
  year: number;
  month: number;
  label: string;
  start: string;
  end: string;
  fiscal_year: string | null;
  sales: SalesBookRow[];
  purchases: PurchaseBookRow[];
  summary: VatSummary;
  tds_by_kcpl: WithheldTaxRow[];
  tds_deposit_due: string | null;
  certificates_pending: WithheldTaxRow[];
  tds_by_customers_this_year: Array<{ currency: string; amount: number; count: number }>;
  tally: TallyLedgerSettings;
  /** The viewer sees only some branches, so the books are partial. */
  partial: boolean;
};

/** The current Nepali month, as the page opens on. */
export function currentBsMonth() {
  const bs = adToBs(nepalOperationalDate());
  return bs ? { year: bs.year, month: bs.month } : { year: 2083, month: 1 };
}

export async function loadTallySettings() {
  if (!firebaseRuntimeConfigured() || qaMockDataEnabled()) return tallyLedgers(null);
  const doc = await firebaseAdminDb().collection(TALLY_SETTINGS).doc("tally").get();
  return tallyLedgers(doc.exists ? doc.data() as Record<string, unknown> : null);
}

type MonthDocs = {
  invoices: FirebaseFirestore.QueryDocumentSnapshot[];
  creditNotes: FirebaseFirestore.QueryDocumentSnapshot[];
  creditNoteInvoices: Map<string, Record<string, unknown>>;
  bills: FirebaseFirestore.QueryDocumentSnapshot[];
  supplierPans: Map<string, string | null>;
};

async function monthDocuments(start: string, end: string): Promise<MonthDocs> {
  const db = firebaseAdminDb();
  const [invoices, creditNotes, bills] = await Promise.all([
    readAllDocuments(db.collection("invoices").where("issue_date", ">=", start).where("issue_date", "<=", end)),
    db.collectionGroup("credit_notes").where("credit_date", ">=", start).where("credit_date", "<=", end).get(),
    readAllDocuments(db.collection("payables").where("bill_date", ">=", start).where("bill_date", "<=", end)),
  ]);
  const parentIds = [...new Set(creditNotes.docs.map((doc) => doc.ref.parent.parent?.id).filter((id): id is string => Boolean(id)))];
  const parents = await loadDocumentsById(db, "invoices", parentIds);
  const supplierIds = [...new Set(bills.docs.map((doc) => text(doc.get("supplier_id"))).filter(Boolean))];
  const suppliers = await loadDocumentsById(db, "partners", supplierIds);
  return {
    invoices: invoices.docs,
    creditNotes: creditNotes.docs,
    creditNoteInvoices: new Map(parents.map((doc) => [doc.id, doc.data() as Record<string, unknown>])),
    bills: bills.docs,
    supplierPans: new Map(suppliers.map((doc) => [doc.id, nullable(doc.get("tax_id"))])),
  };
}

export async function loadTaxMonth(context: KcplStaffContext, year: number, month: number): Promise<{ kind: "ready"; month: TaxMonth } | { kind: "forbidden" } | { kind: "invalid" } | { kind: "unavailable" }> {
  if (!context.permissions.canManageFinance) return { kind: "forbidden" };
  const range = bsMonthRange(year, month);
  if (!range) return { kind: "invalid" };
  const tally = await loadTallySettings().catch(() => tallyLedgers(null));
  const empty: TaxMonth = {
    year, month, label: range.label, start: range.start, end: range.end, fiscal_year: nepalFiscalYear(range.start),
    sales: [], purchases: [], summary: vatSummary([], []), tds_by_kcpl: [], tds_deposit_due: tdsDepositDue(range.start),
    certificates_pending: [], tds_by_customers_this_year: [], tally, partial: !context.can_access_all_branches,
  };
  if (qaMockDataEnabled()) return { kind: "ready", month: empty };
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const db = firebaseAdminDb();
    const seen = (branch: unknown) => canAccessBranchValue(context, branch);
    const [docs, byKcpl, pending, yearRows] = await Promise.all([
      monthDocuments(range.start, range.end),
      db.collection(WITHHELD_TAX).where("direction", "==", "by_kcpl").where("bs_year", "==", year).where("bs_month", "==", month).get(),
      db.collection(WITHHELD_TAX).where("direction", "==", "by_customer").where("status", "==", "certificate_pending").get(),
      empty.fiscal_year ? db.collection(WITHHELD_TAX).where("direction", "==", "by_customer").where("fiscal_year", "==", empty.fiscal_year).get() : Promise.resolve(null),
    ]);
    const sales: SalesBookRow[] = [];
    for (const doc of docs.invoices) {
      if (!seen(doc.get("branch"))) continue;
      const row = salesBookInvoiceRow(doc.id, doc.data() as Record<string, unknown>);
      if (row) sales.push(row);
    }
    for (const note of docs.creditNotes) {
      const invoiceId = note.ref.parent.parent?.id;
      const invoice = invoiceId ? docs.creditNoteInvoices.get(invoiceId) : undefined;
      if (!invoiceId || !invoice || !seen(invoice.branch)) continue;
      const row = salesBookCreditRow(invoiceId, invoice, note.data() as Record<string, unknown>);
      if (row) sales.push(row);
    }
    const purchases: PurchaseBookRow[] = [];
    for (const doc of docs.bills) {
      if (!seen(doc.get("branch"))) continue;
      const row = purchaseBookRow(doc.id, doc.data() as Record<string, unknown>, docs.supplierPans.get(text(doc.get("supplier_id"))) ?? null);
      if (row) purchases.push(row);
    }
    const yearTotals = new Map<string, { amount: number; count: number }>();
    for (const doc of yearRows?.docs ?? []) {
      if (!seen(doc.get("branch"))) continue;
      const currency = text(doc.get("currency"), "NPR");
      const entry = yearTotals.get(currency) ?? { amount: 0, count: 0 };
      entry.amount = round(entry.amount + num(doc.get("amount")));
      entry.count += 1;
      yearTotals.set(currency, entry);
    }
    const sortedSales = sortBookRows(sales);
    const sortedPurchases = sortBookRows(purchases);
    return {
      kind: "ready",
      month: {
        ...empty,
        sales: sortedSales,
        purchases: sortedPurchases,
        summary: vatSummary(sortedSales, sortedPurchases),
        tds_by_kcpl: byKcpl.docs.filter((doc) => seen(doc.get("branch"))).map(withheldFromDoc).sort((a, b) => a.withheld_on.localeCompare(b.withheld_on)),
        certificates_pending: pending.docs.filter((doc) => seen(doc.get("branch"))).map(withheldFromDoc).sort((a, b) => a.withheld_on.localeCompare(b.withheld_on)),
        tds_by_customers_this_year: [...yearTotals.entries()].map(([currency, entry]) => ({ currency, ...entry })),
      },
    };
  } catch (error) {
    console.error("KCPL tax books failed", error);
    return { kind: "unavailable" };
  }
}

/**
 * The month's vouchers for Tally: sales and credit notes, money received and
 * paid back, advances, TDS both ways, supplier bills and payments. Rupee
 * documents only; the rest are counted so the page can say what to enter by
 * hand.
 */
export async function tallyMonth(context: KcplStaffContext, year: number, month: number) {
  const range = bsMonthRange(year, month);
  if (!range || !context.permissions.canManageFinance) return null;
  const settings = await loadTallySettings();
  if (!firebaseRuntimeConfigured() || qaMockDataEnabled()) return { settings, vouchers: [] as TallyVoucher[], parties: [] as Array<{ name: string; group: "debtors" | "creditors" }>, foreign: 0 };
  const db = firebaseAdminDb();
  const seen = (branch: unknown) => canAccessBranchValue(context, branch);
  const [docs, payments, advances, refunds, staffGiven, staffSettled] = await Promise.all([
    monthDocuments(range.start, range.end),
    db.collectionGroup("payments").where("payment_date", ">=", range.start).where("payment_date", "<=", range.end).get(),
    db.collection(CUSTOMER_CREDITS).where("received_on", ">=", range.start).where("received_on", "<=", range.end).get(),
    db.collection(CUSTOMER_REFUNDS).where("paid_on", ">=", range.start).where("paid_on", "<=", range.end).get(),
    db.collection(STAFF_ADVANCES).where("given_on", ">=", range.start).where("given_on", "<=", range.end).get(),
    db.collection(STAFF_ADVANCES).where("settled_on", ">=", range.start).where("settled_on", "<=", range.end).get(),
  ]);
  const vouchers: TallyVoucher[] = [];
  const parties: Array<{ name: string; group: "debtors" | "creditors" }> = [];
  let foreign = 0;
  const npr = (value: unknown) => text(value, "NPR").toUpperCase() === "NPR";
  const customer = (name: string) => { parties.push({ name, group: "debtors" }); return name; };
  const supplier = (name: string) => { parties.push({ name, group: "creditors" }); return name; };

  for (const doc of docs.invoices) {
    const data = doc.data() as Record<string, unknown>;
    if (!seen(data.branch) || !text(data.tax_invoice_number) || text(data.status) === "void") continue;
    if (!npr(data.currency)) { foreign += 1; continue; }
    const gross = round(num(data.subtotal) + num(data.tax_total));
    const party = customer(text(data.customer_name, "Customer"));
    vouchers.push({ type: "Sales", date: text(data.issue_date), number: text(data.tax_invoice_number), narration: `${text(data.tax_invoice_number)}${text(data.shipment_reference) ? ` · ${text(data.shipment_reference)}` : ""}`, party, entries: [
      { ledger: party, amount: gross },
      { ledger: settings.sales, amount: -round(num(data.subtotal) - num(data.disbursement_total)) },
      { ledger: settings.vat_output, amount: -round(num(data.tax_total)) },
      { ledger: settings.disbursements, amount: -round(num(data.disbursement_total)) },
    ] });
  }
  for (const note of docs.creditNotes) {
    const invoiceId = note.ref.parent.parent?.id;
    const invoice = invoiceId ? docs.creditNoteInvoices.get(invoiceId) : undefined;
    if (!invoice || !seen(invoice.branch)) continue;
    if (!npr(invoice.currency)) { foreign += 1; continue; }
    const data = note.data() as Record<string, unknown>;
    const party = customer(text(invoice.customer_name, "Customer"));
    const amount = num(data.amount), tax = num(data.tax_amount), atCost = num(data.disbursement_amount);
    vouchers.push({ type: "Credit Note", date: text(data.credit_date), number: text(data.number), narration: `Against ${text(invoice.tax_invoice_number) || invoiceId} · ${text(data.reason)}`, party, entries: [
      { ledger: settings.sales, amount: round(amount - tax - atCost) },
      { ledger: settings.vat_output, amount: round(tax) },
      { ledger: settings.disbursements, amount: round(atCost) },
      { ledger: party, amount: -round(amount) },
    ] });
  }

  // Money in and out on invoices and bills. Moving money into or out of a
  // customer's credit is inside KCPL's books already and isn't a voucher.
  const invoiceIds = new Set<string>();
  const billIds = new Set<string>();
  for (const row of payments.docs) {
    const parent = row.ref.parent.parent;
    if (!parent) continue;
    if (parent.parent.id === "invoices") invoiceIds.add(parent.id);
    if (parent.parent.id === "payables") billIds.add(parent.id);
  }
  const [invoiceParents, billParents] = await Promise.all([loadDocumentsById(db, "invoices", [...invoiceIds]), loadDocumentsById(db, "payables", [...billIds])]);
  const invoiceById = new Map(invoiceParents.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const billById = new Map(billParents.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  for (const row of payments.docs) {
    const parent = row.ref.parent.parent;
    if (!parent) continue;
    const data = row.data() as Record<string, unknown>;
    const kind = invoiceLedgerKind(data.kind);
    const amount = round(num(data.amount));
    if (amount <= 0) continue;
    if (parent.parent.id === "invoices") {
      const invoice = invoiceById.get(parent.id);
      if (!invoice || !seen(invoice.branch)) continue;
      if (kind !== "payment" && kind !== "tds_withheld") continue;
      if (!npr(invoice.currency)) { foreign += 1; continue; }
      const party = customer(text(invoice.customer_name, "Customer"));
      const number = text(invoice.tax_invoice_number) || parent.id;
      vouchers.push(kind === "payment"
        ? { type: "Receipt", date: text(data.payment_date), number: `RCPT ${row.id.slice(0, 12)}`, narration: `${number}${text(data.reference) ? ` · ${text(data.reference)}` : ""}`, party, entries: [{ ledger: moneyLedger(text(data.method), settings), amount }, { ledger: party, amount: -amount }] }
        : { type: "Journal", date: text(data.payment_date), number: `TDS ${row.id.slice(0, 12)}`, narration: `TDS withheld by the customer on ${number}${text(data.tds_certificate_number) ? ` · certificate ${text(data.tds_certificate_number)}` : ""}`, party, entries: [{ ledger: settings.tds_receivable, amount }, { ledger: party, amount: -amount }] });
    } else if (parent.parent.id === "payables") {
      const bill = billById.get(parent.id);
      if (!bill || !seen(bill.branch)) continue;
      if (!npr(bill.currency)) { foreign += 1; continue; }
      const party = supplier(text(bill.supplier_name, "Supplier"));
      const number = text(bill.supplier_bill_reference) || parent.id;
      vouchers.push(data.kind === "tds_withheld"
        ? { type: "Journal", date: text(data.payment_date), number: `TDS ${row.id.slice(0, 12)}`, narration: `TDS withheld from ${number}`, party, entries: [{ ledger: party, amount }, { ledger: settings.tds_payable, amount: -amount }] }
        : { type: "Payment", date: text(data.payment_date), number: `PAY ${row.id.slice(0, 12)}`, narration: `${number}${text(data.reference) ? ` · ${text(data.reference)}` : ""}`, party, entries: [{ ledger: party, amount }, { ledger: moneyLedger(text(data.method), settings), amount: -amount }] });
    }
  }
  for (const doc of advances.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (text(data.source) !== "advance" || !seen(data.branch)) continue;
    if (!npr(data.currency)) { foreign += 1; continue; }
    const party = customer(text(data.customer_name, "Customer"));
    const amount = round(num(data.amount));
    vouchers.push({ type: "Receipt", date: text(data.received_on), number: text(data.receipt_number), narration: `Advance${text(data.linked_invoice_reference) ? ` for ${text(data.linked_invoice_reference)}` : ""}${text(data.payment_reference) ? ` · ${text(data.payment_reference)}` : ""}`, party, entries: [{ ledger: moneyLedger(text(data.method), settings), amount }, { ledger: party, amount: -amount }] });
  }
  for (const doc of refunds.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (text(data.status) !== "paid" || !seen(data.branch)) continue;
    if (!npr(data.currency)) { foreign += 1; continue; }
    const party = customer(text(data.customer_name, "Customer"));
    const amount = round(num(data.amount));
    vouchers.push({ type: "Payment", date: text(data.paid_on), number: text(data.number), narration: `Refund · ${text(data.reason)}${text(data.payment_reference) ? ` · ${text(data.payment_reference)}` : ""}`, party, entries: [{ ledger: party, amount }, { ledger: moneyLedger(text(data.method), settings), amount: -amount }] });
  }
  // Staff cash: the advance leaves the till, the receipts become costs, and
  // what's left comes back (or KCPL makes up the difference). The staff
  // advances ledger nets to nothing once an advance is settled.
  for (const doc of staffGiven.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (!seen(data.branch)) continue;
    if (!npr(data.currency)) { foreign += 1; continue; }
    const amount = round(num(data.amount));
    vouchers.push({ type: "Payment", date: text(data.given_on), number: text(data.number), narration: `Cash to ${text(data.staff_name, "staff")} · ${text(data.purpose)}`, party: null, entries: [{ ledger: settings.staff_advances, amount }, { ledger: moneyLedger(text(data.method), settings), amount: -amount }] });
  }
  for (const doc of staffSettled.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (text(data.status) !== "settled" || !seen(data.branch)) continue;
    if (!npr(data.currency)) { foreign += 1; continue; }
    const number = text(data.number), staff = text(data.staff_name, "staff"), date = text(data.settled_on);
    const spent = round(num(data.spent)), back = round(num(data.settlement_amount));
    if (spent > 0) vouchers.push({ type: "Journal", date, number: `${number}-EXP`, narration: `Receipts from ${staff} against ${number}`, party: null, entries: [{ ledger: settings.purchases, amount: spent }, { ledger: settings.staff_advances, amount: -spent }] });
    if (back > 0 && text(data.settlement_kind) === "return") vouchers.push({ type: "Receipt", date, number: `${number}-RET`, narration: `Cash returned by ${staff} on settling ${number}`, party: null, entries: [{ ledger: moneyLedger(text(data.settlement_method), settings), amount: back }, { ledger: settings.staff_advances, amount: -back }] });
    if (back > 0 && text(data.settlement_kind) === "reimburse") vouchers.push({ type: "Payment", date, number: `${number}-PAY`, narration: `Paid to ${staff} for spending beyond ${number}`, party: null, entries: [{ ledger: settings.staff_advances, amount: back }, { ledger: moneyLedger(text(data.settlement_method), settings), amount: -back }] });
  }
  for (const doc of docs.bills) {
    const data = doc.data() as Record<string, unknown>;
    if (!seen(data.branch) || !purchaseBookRow(doc.id, data, null)) continue;
    if (!npr(data.currency)) { foreign += 1; continue; }
    const party = supplier(text(data.supplier_name, "Supplier"));
    vouchers.push({ type: "Purchase", date: text(data.bill_date), number: text(data.supplier_bill_reference) || doc.id, narration: `${text(data.description)}${text(data.shipment_reference) ? ` · ${text(data.shipment_reference)}` : ""}`, party, entries: [
      { ledger: settings.purchases, amount: round(num(data.subtotal)) },
      { ledger: settings.vat_input, amount: round(num(data.tax_total)) },
      { ledger: party, amount: -round(num(data.total)) },
    ] });
  }
  return { settings, vouchers: vouchers.sort((a, b) => a.date.localeCompare(b.date)), parties, foreign };
}

/** The certificate a customer sent for TDS they withheld. */
export async function setTdsCertificate(id: string, certificateNumber: string, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const certificate = certificateNumber.trim().slice(0, 120);
  if (!certificate) return { kind: "certificate_required" as const };
  const db = firebaseAdminDb();
  const ref = db.collection(WITHHELD_TAX).doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("direction") !== "by_customer") return { kind: "missing" as const };
    if (!canAccessBranchValue(context, snapshot.get("branch"))) return { kind: "forbidden" as const };
    const now = new Date().toISOString();
    transaction.update(ref, { certificate_number: certificate, status: "certificate_received", certificate_recorded_by_name: actor.name, updated_at: now });
    // The invoice's own row shows the certificate too.
    const rowRef = db.collection("invoices").doc(text(snapshot.get("document_reference"))).collection("payments").doc(text(snapshot.get("ledger_row_id")));
    transaction.update(rowRef, { tds_certificate_number: certificate, reference: certificate, updated_at: now });
    return { kind: "updated" as const };
  });
}

/** TDS KCPL withheld, recorded as deposited with the tax office. */
export async function markTdsDeposited(ids: string[], input: { reference: string; depositedOn: string }, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const reference = input.reference.trim().slice(0, 120);
  if (!reference) return { kind: "deposit_reference_required" as const };
  const depositedOn = input.depositedOn.trim() || nepalOperationalDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(depositedOn) || depositedOn > nepalOperationalDate()) return { kind: "invalid_date" as const };
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 400);
  if (!unique.length) return { kind: "missing" as const };
  const db = firebaseAdminDb();
  return db.runTransaction(async (transaction) => {
    const snapshots = await Promise.all(unique.map((id) => transaction.get(db.collection(WITHHELD_TAX).doc(id))));
    for (const snapshot of snapshots) {
      if (!snapshot.exists || snapshot.get("direction") !== "by_kcpl") return { kind: "missing" as const };
      if (!canAccessBranchValue(context, snapshot.get("branch"))) return { kind: "forbidden" as const };
      if (snapshot.get("status") === "deposited") return { kind: "already_deposited" as const };
    }
    const now = new Date().toISOString();
    for (const snapshot of snapshots) {
      transaction.update(snapshot.ref, { status: "deposited", deposit_reference: reference, deposited_on: depositedOn, deposited_by_name: actor.name, updated_at: now });
    }
    return { kind: "updated" as const, count: snapshots.length };
  });
}

/** The ledger names the Tally export uses. */
export async function saveTallySettings(values: Record<string, unknown>, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const settings = tallyLedgers(values);
  await firebaseAdminDb().collection(TALLY_SETTINGS).doc("tally").set({ ...settings, updated_by_name: actor.name, updated_at: new Date().toISOString() });
  return { kind: "updated" as const, settings };
}
