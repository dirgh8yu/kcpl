import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canAccessBranchValue, compatibleRecordBranches, strictBranchValue } from "../branch-access-policy";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { type KcplStaffContext } from "../staff-directory.server";
import {
  financeInvoiceStatuses,
  financePaymentMethods,
  type CreateFinanceInvoiceInput,
  type FinanceCurrencySummary,
  type FinanceDashboard,
  type FinanceInvoice,
  type FinanceInvoiceLine,
  type FinanceInvoiceStatus,
  type FinancePayment,
  type FinancePaymentMethod,
  type FinanceReceivableRecordType,
} from "./finance-data";

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
  if (!kcplBranches.includes(value as KcplBranch)) throw new Error("Finance record requires a canonical KCPL branch");
  return value as KcplBranch;
}

function invoiceStatus(value: unknown): FinanceInvoiceStatus {
  return financeInvoiceStatuses.includes(value as FinanceInvoiceStatus) ? value as FinanceInvoiceStatus : "draft";
}

function receivableRecordType(value: unknown): FinanceReceivableRecordType {
  return value === "opening_balance" ? "opening_balance" : "invoice";
}

function paymentMethod(value: unknown): FinancePaymentMethod {
  return financePaymentMethods.includes(value as FinancePaymentMethod) ? value as FinancePaymentMethod : "other";
}

function invoiceReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `KCPL-I-${date}-${randomBytes(5).toString("hex").toUpperCase()}`;
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

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + Math.max(0, days));
  return parsed.toISOString().slice(0, 10);
}

function safeDate(value: string, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function effectiveStatus(status: FinanceInvoiceStatus, dueDate: string, balanceDue: number): FinanceInvoiceStatus {
  if (status === "draft" || status === "void" || status === "paid") return status;
  if (balanceDue <= 0.00001) return "paid";
  if (dueDate < operationalDate()) return "overdue";
  return status === "overdue" ? "issued" : status;
}

function lineFromData(value: unknown, index: number): FinanceInvoiceLine {
  const data = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    id: text(data.id, `line-${index + 1}`),
    description: text(data.description, "Freight services"),
    quantity: numberValue(data.quantity) || 1,
    unit_price: numberValue(data.unit_price),
    tax_rate: numberValue(data.tax_rate),
    subtotal: numberValue(data.subtotal),
    tax_amount: numberValue(data.tax_amount),
    total: numberValue(data.total),
  };
}

function paymentFromDoc(invoiceReference: string, id: string, data: Record<string, unknown>): FinancePayment {
  return {
    id,
    invoice_reference: invoiceReference,
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

async function invoiceFromSnapshot(snapshot: FirebaseFirestore.DocumentSnapshot, includePayments = true): Promise<FinanceInvoice> {
  const data = snapshot.data() as Record<string, unknown>;
  const paymentsSnapshot = includePayments
    ? await snapshot.ref.collection("payments").orderBy("payment_date", "desc").limit(500).get()
    : null;
  const storedStatus = invoiceStatus(data.status);
  const balanceDue = numberValue(data.balance_due);
  const dueDate = text(data.due_date);
  return {
    reference: snapshot.id,
    record_type: receivableRecordType(data.record_type ?? data.migration_record_type),
    external_invoice_number: nullable(data.external_invoice_number ?? data.migration_source_invoice_number),
    migration_batch_id: nullable(data.migration_batch_id),
    migration_as_of_date: nullable(data.migration_as_of_date),
    customer_id: text(data.customer_id),
    customer_name: text(data.customer_name, "Customer"),
    shipment_reference: nullable(data.shipment_reference),
    quote_reference: nullable(data.quote_reference),
    branch: branchValue(data.branch),
    status: effectiveStatus(storedStatus, dueDate, balanceDue),
    issue_date: text(data.issue_date),
    due_date: dueDate,
    currency: currencyValue(data.currency),
    line_items: Array.isArray(data.line_items) ? data.line_items.map(lineFromData) : [],
    subtotal: numberValue(data.subtotal),
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

function canAccessFinance(context: KcplStaffContext) {
  return context.permissions.canManageFinance;
}

function canAccessInvoice(context: KcplStaffContext, branch: unknown) {
  return canAccessFinance(context) && canAccessBranchValue(context, branch);
}

async function writeCustomerActivity(customerId: string, title: string, detail: string, actor: Actor) {
  const ref = firebaseAdminDb().collection("customers").doc(customerId).collection("activity").doc(childId("activity"));
  await ref.create({
    type: "finance_activity",
    title,
    detail,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: new Date().toISOString(),
  });
}

async function writeJobActivity(shipmentReference: string | null, title: string, detail: string, actor: Actor) {
  if (!shipmentReference) return;
  const ref = firebaseAdminDb().collection("shipments").doc(shipmentReference).collection("job_activity").doc(childId("activity"));
  await ref.create({
    type: "finance_activity",
    title,
    detail,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: new Date().toISOString(),
  });
}

export async function recomputeCustomerFinance(customerId: string) {
  if (!firebaseRuntimeConfigured()) return;
  const db = firebaseAdminDb();
  const customerRef = db.collection("customers").doc(customerId);
  const customer = await customerRef.get();
  if (!customer.exists) return;
  const currency = currencyValue(customer.get("preferred_currency"));
  const [invoicesSnapshot, shipmentsSnapshot] = await Promise.all([
    db.collection("invoices").where("customer_id", "==", customerId).limit(2500).get(),
    db.collection("shipments").where("customer_id", "==", customerId).limit(1000).get(),
  ]);

  let revenue = 0;
  let outstanding = 0;
  for (const invoice of invoicesSnapshot.docs) {
    if (currencyValue(invoice.get("currency")) !== currency) continue;
    const status = invoiceStatus(invoice.get("status"));
    if (status === "draft" || status === "void") continue;
    if (receivableRecordType(invoice.get("record_type") ?? invoice.get("migration_record_type")) !== "opening_balance") {
      revenue += numberValue(invoice.get("total"));
    }
    outstanding += Math.max(0, numberValue(invoice.get("balance_due")));
  }

  let cost = 0;
  for (const shipment of shipmentsSnapshot.docs) {
    const costs = await shipment.ref.collection("job_costs").limit(1000).get();
    for (const item of costs.docs) {
      if (currencyValue(item.get("currency")) === currency) cost += numberValue(item.get("amount"));
    }
  }

  await customerRef.update({
    revenue_total: revenue,
    cost_total: cost,
    profit_total: revenue - cost,
    outstanding_balance: outstanding,
    finance_currency: currency,
    finance_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function getFinanceInvoice(reference: string, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!canAccessFinance(context)) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const snapshot = await db.collection("invoices").doc(reference.trim().toUpperCase()).get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const branch = strictBranchValue(snapshot.get("branch"));
  if (!branch || !canAccessInvoice(context, branch)) return { kind: "forbidden" as const };
  const customerId = text(snapshot.get("customer_id")).trim().toUpperCase();
  if (!customerId) return { kind: "relationship_mismatch" as const };
  const shipmentReference = nullable(snapshot.get("shipment_reference"))?.toUpperCase() ?? null;
  const [customer, shipment] = await Promise.all([
    db.collection("customers").doc(customerId).get(),
    shipmentReference ? db.collection("shipments").doc(shipmentReference).get() : Promise.resolve(null),
  ]);
  if (!customer.exists || !compatibleRecordBranches(branch, customer.get("primary_branch"))) return { kind: "relationship_mismatch" as const };
  if (shipmentReference && (!shipment?.exists || !compatibleRecordBranches(branch, shipment.get("primary_branch")))) return { kind: "relationship_mismatch" as const };
  if (shipment?.exists) {
    const shipmentCustomerId = text(shipment.get("customer_id")).trim().toUpperCase();
    if (shipmentCustomerId && shipmentCustomerId !== customerId) return { kind: "relationship_mismatch" as const };
  }
  const invoice = await invoiceFromSnapshot(snapshot);
  return { kind: "ready" as const, invoice };
}

export async function listFinanceDashboard(context: KcplStaffContext): Promise<FinanceDashboard | null> {
  if (!firebaseRuntimeConfigured() || !canAccessFinance(context)) return null;
  const db = firebaseAdminDb();
  const snapshot = await db.collection("invoices").orderBy("updated_at", "desc").limit(3000).get();
  const invoices: FinanceInvoice[] = [];
  const statusBatch = db.batch();
  let changedStatuses = 0;

  for (const doc of snapshot.docs) {
    if (!canAccessInvoice(context, doc.get("branch"))) continue;
    const invoice = await invoiceFromSnapshot(doc, false);
    invoices.push(invoice);
    const stored = invoiceStatus(doc.get("status"));
    if (stored !== invoice.status) {
      statusBatch.update(doc.ref, { status: invoice.status, updated_at: new Date().toISOString() });
      changedStatuses += 1;
    }
  }
  if (changedStatuses) await statusBatch.commit();

  const summaries = new Map<CrmCurrency, FinanceCurrencySummary>();
  for (const invoice of invoices) {
    let summary = summaries.get(invoice.currency);
    if (!summary) {
      summary = { currency: invoice.currency, invoiced: 0, opening_balance: 0, collected: 0, outstanding: 0, overdue: 0, aging_0_30: 0, aging_31_60: 0, aging_61_90: 0, aging_90_plus: 0, invoice_count: 0, opening_balance_count: 0 };
      summaries.set(invoice.currency, summary);
    }
    if (invoice.status === "draft" || invoice.status === "void") continue;
    if (invoice.record_type === "opening_balance") {
      summary.opening_balance_count += 1;
      summary.opening_balance += invoice.total;
    } else {
      summary.invoice_count += 1;
      summary.invoiced += invoice.total;
    }
    summary.collected += invoice.amount_paid;
    summary.outstanding += invoice.balance_due;
    if (invoice.status === "overdue" && invoice.balance_due > 0) {
      summary.overdue += invoice.balance_due;
      const dueMs = new Date(`${invoice.due_date}T00:00:00Z`).getTime();
      const ageDays = Math.max(0, Math.floor((Date.now() - dueMs) / 86_400_000));
      if (ageDays <= 30) summary.aging_0_30 += invoice.balance_due;
      else if (ageDays <= 60) summary.aging_31_60 += invoice.balance_due;
      else if (ageDays <= 90) summary.aging_61_90 += invoice.balance_due;
      else summary.aging_90_plus += invoice.balance_due;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    invoices,
    currency_summaries: [...summaries.values()].sort((a, b) => b.outstanding - a.outstanding || a.currency.localeCompare(b.currency)),
    overdue_count: invoices.filter((invoice) => invoice.status === "overdue").length,
    unpaid_count: invoices.filter((invoice) => ["issued", "partially_paid", "overdue"].includes(invoice.status)).length,
    paid_count: invoices.filter((invoice) => invoice.status === "paid").length,
    draft_count: invoices.filter((invoice) => invoice.status === "draft").length,
    opening_balance_count: invoices.filter((invoice) => invoice.record_type === "opening_balance" && invoice.status !== "void").length,
  };
}

export async function createFinanceInvoice(input: CreateFinanceInvoiceInput, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!canAccessFinance(context)) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const shipmentId = input.shipmentReference.trim().toUpperCase();
  const explicitCustomerId = input.customerId.trim().toUpperCase();
  const shipment = shipmentId ? await db.collection("shipments").doc(shipmentId).get() : null;
  if (shipmentId && !shipment?.exists) return { kind: "shipment_missing" as const };

  const shipmentData = shipment?.exists ? shipment.data() as Record<string, unknown> : {};
  const customerId = text(shipmentData.customer_id, explicitCustomerId).trim().toUpperCase();
  if (!customerId) return { kind: "customer_required" as const };
  const customer = await db.collection("customers").doc(customerId).get();
  if (!customer.exists) return { kind: "customer_missing" as const };
  const rawBranch = shipment?.exists ? shipment.get("primary_branch") : customer.get("primary_branch");
  const branch = strictBranchValue(rawBranch);
  if (!branch || !canAccessInvoice(context, branch)) return { kind: "forbidden" as const };
  if (!compatibleRecordBranches(branch, customer.get("primary_branch"))) return { kind: "relationship_mismatch" as const };

  const quoteReference = shipment?.exists ? nullable(shipment.get("quote_reference")) : null;
  const quote = quoteReference ? await db.collection("quotes").doc(quoteReference).get() : null;
  if (quoteReference && !quote?.exists) return { kind: "relationship_mismatch" as const };
  if (quote?.exists) {
    const quoteShipmentId = text(quote.get("shipment_reference")).trim().toUpperCase();
    const quoteCustomerId = text(quote.get("customer_id")).trim().toUpperCase();
    if (quoteShipmentId && quoteShipmentId !== shipmentId) return { kind: "relationship_mismatch" as const };
    if (quoteCustomerId && quoteCustomerId !== customerId) return { kind: "relationship_mismatch" as const };
  }
  const quoteData = quote?.exists ? quote.data() as Record<string, unknown> : {};
  const issueDate = safeDate(input.issueDate, operationalDate());
  const paymentTerms = Math.max(0, Math.floor(numberValue(customer.get("payment_terms_days"))));
  const dueDate = safeDate(input.dueDate, addDays(issueDate, paymentTerms));
  const amount = Number(input.amount);
  const taxRate = Number(input.taxRate);
  if (!Number.isFinite(amount) || amount <= 0) return { kind: "invalid_amount" as const };
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return { kind: "invalid_tax" as const };

  const subtotal = Math.round(amount * 100) / 100;
  const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const description = input.description.trim() || (quote?.exists
    ? `Freight services: ${text(quoteData.origin, "Origin")} to ${text(quoteData.destination, "Destination")}`
    : "Freight and logistics services");
  const line: FinanceInvoiceLine = {
    id: childId("line"),
    description,
    quantity: 1,
    unit_price: subtotal,
    tax_rate: taxRate,
    subtotal,
    tax_amount: tax,
    total,
  };
  const reference = invoiceReference();
  const now = new Date().toISOString();
  const document = {
    reference,
    record_type: "invoice",
    external_invoice_number: null,
    migration_batch_id: null,
    migration_as_of_date: null,
    customer_id: customerId,
    customer_name: text(customer.get("display_name"), customerId),
    shipment_reference: shipment?.exists ? shipmentId : null,
    quote_reference: quoteReference,
    branch,
    status: "draft",
    issue_date: issueDate,
    due_date: dueDate,
    currency: input.currency,
    line_items: [line],
    subtotal,
    tax_total: tax,
    total,
    amount_paid: 0,
    balance_due: total,
    notes: input.notes.trim() || null,
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: now,
    updated_at: now,
  };
  await db.collection("invoices").doc(reference).create(document);
  await writeCustomerActivity(customerId, `Invoice draft created: ${reference}`, `${input.currency} ${total.toFixed(2)} · due ${dueDate}`, actor);
  await writeJobActivity(shipment?.exists ? shipmentId : null, `Invoice draft created: ${reference}`, `${input.currency} ${total.toFixed(2)}`, actor);
  return { kind: "created" as const, reference };
}

export async function issueFinanceInvoice(reference: string, actor: Actor, context: KcplStaffContext) {
  const loaded = await getFinanceInvoice(reference, context);
  if (loaded.kind !== "ready") return loaded;
  if (loaded.invoice.status !== "draft") return { kind: "invalid_status" as const };
  const nextStatus = loaded.invoice.due_date < operationalDate() ? "overdue" : "issued";
  const now = new Date().toISOString();
  await firebaseAdminDb().collection("invoices").doc(loaded.invoice.reference).update({ status: nextStatus, issued_at: now, issued_by_name: actor.name, issued_by_email: actor.email, updated_at: now });
  await recomputeCustomerFinance(loaded.invoice.customer_id);
  await writeCustomerActivity(loaded.invoice.customer_id, `Invoice issued: ${loaded.invoice.reference}`, `${loaded.invoice.currency} ${loaded.invoice.total.toFixed(2)} · due ${loaded.invoice.due_date}`, actor);
  await writeJobActivity(loaded.invoice.shipment_reference, `Invoice issued: ${loaded.invoice.reference}`, `${loaded.invoice.currency} ${loaded.invoice.total.toFixed(2)}`, actor);
  return { kind: "updated" as const };
}

export async function recordFinancePayment(reference: string, input: { amount: number; paymentDate: string; method: FinancePaymentMethod; reference: string; notes: string }, actor: Actor, context: KcplStaffContext) {
  const loaded = await getFinanceInvoice(reference, context);
  if (loaded.kind !== "ready") return loaded;
  if (!["issued", "partially_paid", "overdue"].includes(loaded.invoice.status)) return { kind: "invalid_status" as const };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > loaded.invoice.balance_due + 0.00001) return { kind: "invalid_amount" as const };
  const db = firebaseAdminDb();
  const invoiceRef = db.collection("invoices").doc(loaded.invoice.reference);
  const paymentId = childId("payment");
  const now = new Date().toISOString();
  const nextPaid = Math.round((loaded.invoice.amount_paid + amount) * 100) / 100;
  const nextBalance = Math.max(0, Math.round((loaded.invoice.total - nextPaid) * 100) / 100);
  const nextStatus: FinanceInvoiceStatus = nextBalance <= 0.00001
    ? "paid"
    : loaded.invoice.due_date < operationalDate() ? "overdue" : "partially_paid";
  const paymentDate = safeDate(input.paymentDate, operationalDate());
  const batch = db.batch();
  batch.create(invoiceRef.collection("payments").doc(paymentId), {
    invoice_reference: loaded.invoice.reference,
    amount,
    currency: loaded.invoice.currency,
    payment_date: paymentDate,
    method: input.method,
    reference: input.reference.trim() || null,
    notes: input.notes.trim() || null,
    recorded_by_name: actor.name,
    recorded_by_email: actor.email,
    created_at: now,
  });
  batch.update(invoiceRef, { amount_paid: nextPaid, balance_due: nextBalance, status: nextStatus, updated_at: now });
  await batch.commit();
  await recomputeCustomerFinance(loaded.invoice.customer_id);
  await writeCustomerActivity(loaded.invoice.customer_id, `Payment recorded: ${loaded.invoice.reference}`, `${loaded.invoice.currency} ${amount.toFixed(2)} received · ${loaded.invoice.currency} ${nextBalance.toFixed(2)} remaining`, actor);
  await writeJobActivity(loaded.invoice.shipment_reference, `Payment recorded: ${loaded.invoice.reference}`, `${loaded.invoice.currency} ${amount.toFixed(2)} received`, actor);
  return { kind: "updated" as const };
}

export async function voidFinanceInvoice(reference: string, actor: Actor, context: KcplStaffContext) {
  const loaded = await getFinanceInvoice(reference, context);
  if (loaded.kind !== "ready") return loaded;
  if (loaded.invoice.status === "void") return { kind: "updated" as const };
  if (loaded.invoice.amount_paid > 0) return { kind: "has_payments" as const };
  const now = new Date().toISOString();
  await firebaseAdminDb().collection("invoices").doc(loaded.invoice.reference).update({ status: "void", balance_due: 0, voided_at: now, voided_by_name: actor.name, voided_by_email: actor.email, updated_at: now });
  await recomputeCustomerFinance(loaded.invoice.customer_id);
  await writeCustomerActivity(loaded.invoice.customer_id, `Invoice voided: ${loaded.invoice.reference}`, `${loaded.invoice.currency} ${loaded.invoice.total.toFixed(2)}`, actor);
  await writeJobActivity(loaded.invoice.shipment_reference, `Invoice voided: ${loaded.invoice.reference}`, `${loaded.invoice.currency} ${loaded.invoice.total.toFixed(2)}`, actor);
  return { kind: "updated" as const };
}