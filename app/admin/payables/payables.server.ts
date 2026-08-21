import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canAccessBranchValue } from "../branch-access-policy";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { financePaymentMethods, type FinancePaymentMethod } from "../finance/finance-data";
import { recomputeCustomerFinance } from "../finance/finance.server";
import { jobCostCategories, type JobCostCategory } from "../job-file";
import { type KcplStaffContext } from "../staff-directory.server";
import {
  payableStatuses,
  type CreatePayableInput,
  type PayableBill,
  type PayableCurrencySummary,
  type PayablePayment,
  type PayableStatus,
  type PayablesDashboard,
} from "./payables-data";

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currencyValue(value: unknown): CrmCurrency {
  return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : "NPR";
}

function branchValue(value: unknown): KcplBranch {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : "Kathmandu";
}

function categoryValue(value: unknown): JobCostCategory {
  return jobCostCategories.includes(value as JobCostCategory) ? value as JobCostCategory : "other";
}

function statusValue(value: unknown): PayableStatus {
  return payableStatuses.includes(value as PayableStatus) ? value as PayableStatus : "draft";
}

function paymentMethod(value: unknown): FinancePaymentMethod {
  return financePaymentMethods.includes(value as FinancePaymentMethod) ? value as FinancePaymentMethod : "other";
}

function payableReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `KCPL-B-${date}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function childId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function safeDate(value: string, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + Math.max(0, days));
  return parsed.toISOString().slice(0, 10);
}

function effectiveStatus(status: PayableStatus, dueDate: string, balanceDue: number): PayableStatus {
  if (status === "draft" || status === "void" || status === "paid") return status;
  if (balanceDue <= 0.00001) return "paid";
  if (dueDate < operationalDate()) return "overdue";
  return status === "overdue" ? "approved" : status;
}

function paymentFromDoc(payableReferenceValue: string, id: string, data: Record<string, unknown>): PayablePayment {
  return {
    id,
    payable_reference: payableReferenceValue,
    amount: numberValue(data.amount),
    currency: currencyValue(data.currency),
    payment_date: text(data.payment_date),
    method: paymentMethod(data.method),
    reference: nullable(data.reference),
    notes: nullable(data.notes),
    recorded_by_name: text(data.recorded_by_name, "KCPL Accounts"),
    recorded_by_email: text(data.recorded_by_email),
    created_at: text(data.created_at),
  };
}

async function payableFromSnapshot(snapshot: FirebaseFirestore.DocumentSnapshot, includePayments = true): Promise<PayableBill> {
  const data = snapshot.data() as Record<string, unknown>;
  const paymentsSnapshot = includePayments
    ? await snapshot.ref.collection("payments").orderBy("payment_date", "desc").limit(500).get()
    : null;
  const dueDate = text(data.due_date);
  const balanceDue = numberValue(data.balance_due);
  return {
    reference: snapshot.id,
    supplier_id: nullable(data.supplier_id),
    supplier_name: text(data.supplier_name, "Supplier"),
    supplier_bill_reference: nullable(data.supplier_bill_reference),
    shipment_reference: nullable(data.shipment_reference),
    customer_id: nullable(data.customer_id),
    customer_name: nullable(data.customer_name),
    branch: branchValue(data.branch),
    category: categoryValue(data.category),
    status: effectiveStatus(statusValue(data.status), dueDate, balanceDue),
    bill_date: text(data.bill_date),
    due_date: dueDate,
    currency: currencyValue(data.currency),
    description: text(data.description, "Supplier cost"),
    subtotal: numberValue(data.subtotal),
    tax_rate: numberValue(data.tax_rate),
    tax_total: numberValue(data.tax_total),
    total: numberValue(data.total),
    amount_paid: numberValue(data.amount_paid),
    balance_due: balanceDue,
    notes: nullable(data.notes),
    created_by_name: text(data.created_by_name, "KCPL Accounts"),
    created_by_email: text(data.created_by_email),
    created_at: text(data.created_at),
    updated_at: text(data.updated_at),
    payments: paymentsSnapshot?.docs.map((doc) => paymentFromDoc(snapshot.id, doc.id, doc.data() as Record<string, unknown>)) ?? [],
  };
}

function canAccessPayables(context: KcplStaffContext) {
  return context.permissions.canManageFinance;
}

function canAccessBill(context: KcplStaffContext, branch: unknown) {
  return canAccessPayables(context) && canAccessBranchValue(context, branch);
}

async function writeJobActivity(shipmentReference: string | null, title: string, detail: string, actor: Actor) {
  if (!shipmentReference) return;
  await firebaseAdminDb().collection("shipments").doc(shipmentReference).collection("job_activity").doc(childId("activity")).create({
    type: "payables_activity",
    title,
    detail,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: new Date().toISOString(),
  });
}

async function syncApprovedBillToJobCost(bill: PayableBill) {
  if (!bill.shipment_reference) return;
  const shipmentRef = firebaseAdminDb().collection("shipments").doc(bill.shipment_reference);
  const costRef = shipmentRef.collection("job_costs").doc(`payable_${bill.reference}`);
  await costRef.set({
    category: bill.category,
    label: bill.description,
    vendor: bill.supplier_name,
    amount: bill.total,
    currency: bill.currency,
    notes: bill.supplier_bill_reference ? `Supplier bill ${bill.supplier_bill_reference}` : "Accounts Payable bill",
    source_type: "payable",
    source_reference: bill.reference,
    locked: true,
    created_at: bill.created_at,
    created_by: bill.created_by_email,
    updated_at: new Date().toISOString(),
  }, { merge: true });
}

async function removeBillJobCost(bill: PayableBill) {
  if (!bill.shipment_reference) return;
  await firebaseAdminDb().collection("shipments").doc(bill.shipment_reference)
    .collection("job_costs").doc(`payable_${bill.reference}`).delete().catch(() => undefined);
}

async function recomputeLinkedCustomer(bill: PayableBill) {
  if (bill.customer_id) await recomputeCustomerFinance(bill.customer_id);
}

export async function getPayable(reference: string, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!canAccessPayables(context)) return { kind: "forbidden" as const };
  const snapshot = await firebaseAdminDb().collection("payables").doc(reference.trim().toUpperCase()).get();
  if (!snapshot.exists) return { kind: "missing" as const };
  if (!canAccessBill(context, snapshot.get("branch"))) return { kind: "forbidden" as const };
  const bill = await payableFromSnapshot(snapshot);
  return { kind: "ready" as const, bill };
}

export async function listPayablesDashboard(context: KcplStaffContext): Promise<PayablesDashboard | null> {
  if (!firebaseRuntimeConfigured() || !canAccessPayables(context)) return null;
  const db = firebaseAdminDb();
  const snapshot = await db.collection("payables").orderBy("updated_at", "desc").limit(3000).get();
  const bills: PayableBill[] = [];
  const statusBatch = db.batch();
  let changedStatuses = 0;

  for (const doc of snapshot.docs) {
    if (!canAccessBill(context, doc.get("branch"))) continue;
    const bill = await payableFromSnapshot(doc, false);
    bills.push(bill);
    const stored = statusValue(doc.get("status"));
    if (stored !== bill.status) {
      statusBatch.update(doc.ref, { status: bill.status, updated_at: new Date().toISOString() });
      changedStatuses += 1;
    }
  }
  if (changedStatuses) await statusBatch.commit();

  const summaries = new Map<CrmCurrency, PayableCurrencySummary>();
  for (const bill of bills) {
    let summary = summaries.get(bill.currency);
    if (!summary) {
      summary = { currency: bill.currency, billed: 0, paid: 0, outstanding: 0, overdue: 0, aging_0_30: 0, aging_31_60: 0, aging_61_90: 0, aging_90_plus: 0, bill_count: 0 };
      summaries.set(bill.currency, summary);
    }
    if (bill.status === "draft" || bill.status === "void") continue;
    summary.bill_count += 1;
    summary.billed += bill.total;
    summary.paid += bill.amount_paid;
    summary.outstanding += bill.balance_due;
    if (bill.status === "overdue" && bill.balance_due > 0) {
      summary.overdue += bill.balance_due;
      const dueMs = new Date(`${bill.due_date}T00:00:00Z`).getTime();
      const ageDays = Math.max(0, Math.floor((Date.now() - dueMs) / 86_400_000));
      if (ageDays <= 30) summary.aging_0_30 += bill.balance_due;
      else if (ageDays <= 60) summary.aging_31_60 += bill.balance_due;
      else if (ageDays <= 90) summary.aging_61_90 += bill.balance_due;
      else summary.aging_90_plus += bill.balance_due;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    bills,
    currency_summaries: [...summaries.values()].sort((a, b) => b.outstanding - a.outstanding || a.currency.localeCompare(b.currency)),
    overdue_count: bills.filter((bill) => bill.status === "overdue").length,
    unpaid_count: bills.filter((bill) => ["approved", "partially_paid", "overdue"].includes(bill.status)).length,
    paid_count: bills.filter((bill) => bill.status === "paid").length,
    draft_count: bills.filter((bill) => bill.status === "draft").length,
  };
}

export async function createPayable(input: CreatePayableInput, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!canAccessPayables(context)) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const shipmentId = input.shipmentReference.trim().toUpperCase();
  const shipment = shipmentId ? await db.collection("shipments").doc(shipmentId).get() : null;
  if (shipmentId && !shipment?.exists) return { kind: "shipment_missing" as const };
  const shipmentData = shipment?.exists ? shipment.data() as Record<string, unknown> : {};
  const rawBranch = shipment?.exists ? shipment.get("primary_branch") : "Kathmandu";
  if (!canAccessBill(context, rawBranch)) return { kind: "forbidden" as const };
  const branch = branchValue(rawBranch);

  const supplierId = input.supplierId.trim().toUpperCase();
  const supplier = supplierId ? await db.collection("customers").doc(supplierId).get() : null;
  if (supplierId && !supplier?.exists) return { kind: "supplier_missing" as const };
  const supplierName = supplier?.exists ? text(supplier.get("display_name"), supplierId) : input.supplierName.trim();
  if (!supplierName) return { kind: "supplier_required" as const };

  const customerId = nullable(shipmentData.customer_id);
  const customer = customerId ? await db.collection("customers").doc(customerId).get() : null;
  const amount = Number(input.amount);
  const taxRate = Number(input.taxRate);
  if (!Number.isFinite(amount) || amount <= 0) return { kind: "invalid_amount" as const };
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return { kind: "invalid_tax" as const };

  const subtotal = Math.round(amount * 100) / 100;
  const taxTotal = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxTotal) * 100) / 100;
  const billDate = safeDate(input.billDate, operationalDate());
  const dueDate = safeDate(input.dueDate, addDays(billDate, 30));
  const reference = payableReference();
  const now = new Date().toISOString();
  const document = {
    reference,
    supplier_id: supplier?.exists ? supplierId : null,
    supplier_name: supplierName,
    supplier_bill_reference: input.supplierBillReference.trim() || null,
    shipment_reference: shipment?.exists ? shipmentId : null,
    customer_id: customerId,
    customer_name: customer?.exists ? text(customer.get("display_name"), customerId ?? "") : null,
    branch,
    category: input.category,
    status: "draft",
    bill_date: billDate,
    due_date: dueDate,
    currency: input.currency,
    description: input.description.trim() || "Supplier / carrier cost",
    subtotal,
    tax_rate: taxRate,
    tax_total: taxTotal,
    total,
    amount_paid: 0,
    balance_due: total,
    notes: input.notes.trim() || null,
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: now,
    updated_at: now,
  };
  await db.collection("payables").doc(reference).create(document);
  await writeJobActivity(shipment?.exists ? shipmentId : null, `Supplier bill draft created: ${reference}`, `${input.currency} ${total.toFixed(2)} · ${supplierName}`, actor);
  return { kind: "created" as const, reference };
}

export async function approvePayable(reference: string, actor: Actor, context: KcplStaffContext) {
  const loaded = await getPayable(reference, context);
  if (loaded.kind !== "ready") return loaded;
  if (loaded.bill.status !== "draft") return { kind: "invalid_status" as const };
  const nextStatus: PayableStatus = loaded.bill.due_date < operationalDate() ? "overdue" : "approved";
  const now = new Date().toISOString();
  await firebaseAdminDb().collection("payables").doc(loaded.bill.reference).update({
    status: nextStatus,
    approved_at: now,
    approved_by_name: actor.name,
    approved_by_email: actor.email,
    updated_at: now,
  });
  const approvedBill = { ...loaded.bill, status: nextStatus };
  await syncApprovedBillToJobCost(approvedBill);
  await recomputeLinkedCustomer(approvedBill);
  await writeJobActivity(approvedBill.shipment_reference, `Supplier bill approved: ${approvedBill.reference}`, `${approvedBill.currency} ${approvedBill.total.toFixed(2)} · ${approvedBill.supplier_name}`, actor);
  return { kind: "updated" as const };
}

export async function recordPayablePayment(reference: string, input: { amount: number; paymentDate: string; method: FinancePaymentMethod; reference: string; notes: string }, actor: Actor, context: KcplStaffContext) {
  const loaded = await getPayable(reference, context);
  if (loaded.kind !== "ready") return loaded;
  if (!["approved", "partially_paid", "overdue"].includes(loaded.bill.status)) return { kind: "invalid_status" as const };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > loaded.bill.balance_due + 0.00001) return { kind: "invalid_amount" as const };
  const db = firebaseAdminDb();
  const billRef = db.collection("payables").doc(loaded.bill.reference);
  const paymentId = childId("payment");
  const now = new Date().toISOString();
  const nextPaid = Math.round((loaded.bill.amount_paid + amount) * 100) / 100;
  const nextBalance = Math.max(0, Math.round((loaded.bill.total - nextPaid) * 100) / 100);
  const nextStatus: PayableStatus = nextBalance <= 0.00001
    ? "paid"
    : loaded.bill.due_date < operationalDate() ? "overdue" : "partially_paid";
  const paymentDate = safeDate(input.paymentDate, operationalDate());
  const batch = db.batch();
  batch.create(billRef.collection("payments").doc(paymentId), {
    payable_reference: loaded.bill.reference,
    amount,
    currency: loaded.bill.currency,
    payment_date: paymentDate,
    method: input.method,
    reference: input.reference.trim() || null,
    notes: input.notes.trim() || null,
    recorded_by_name: actor.name,
    recorded_by_email: actor.email,
    created_at: now,
  });
  batch.update(billRef, { amount_paid: nextPaid, balance_due: nextBalance, status: nextStatus, updated_at: now });
  await batch.commit();
  await writeJobActivity(loaded.bill.shipment_reference, `Supplier payment recorded: ${loaded.bill.reference}`, `${loaded.bill.currency} ${amount.toFixed(2)} paid · ${loaded.bill.currency} ${nextBalance.toFixed(2)} remaining`, actor);
  return { kind: "updated" as const };
}

export async function voidPayable(reference: string, actor: Actor, context: KcplStaffContext) {
  const loaded = await getPayable(reference, context);
  if (loaded.kind !== "ready") return loaded;
  if (loaded.bill.status === "void") return { kind: "updated" as const };
  if (loaded.bill.amount_paid > 0) return { kind: "has_payments" as const };
  const now = new Date().toISOString();
  await firebaseAdminDb().collection("payables").doc(loaded.bill.reference).update({
    status: "void",
    balance_due: 0,
    voided_at: now,
    voided_by_name: actor.name,
    voided_by_email: actor.email,
    updated_at: now,
  });
  await removeBillJobCost(loaded.bill);
  await recomputeLinkedCustomer(loaded.bill);
  await writeJobActivity(loaded.bill.shipment_reference, `Supplier bill voided: ${loaded.bill.reference}`, `${loaded.bill.currency} ${loaded.bill.total.toFixed(2)} · ${loaded.bill.supplier_name}`, actor);
  return { kind: "updated" as const };
}
