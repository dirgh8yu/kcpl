import { mockFinanceDashboard, qaMockDataEnabled } from "../qa-fixtures";
import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { effectiveInvoiceStatus, invoiceDatesOnIssue, nepalOperationalDate } from "../../invoice-effective-status";
import { nepalFiscalYear } from "../../nepali-calendar";
import { readAllDocuments } from "../firestore-scan";
import { loadDocumentsById } from "../operational-shipments.server";
import { loadNprRateTable } from "./fx-rates.server";
import { invoiceNetRevenue, jobCostCounts, sumInCurrency } from "./money-basis";
import { canAccessBranchValue, compatibleRecordBranches, strictBranchValue } from "../branch-access-policy";
import { customerCommercialProfitabilitySummary } from "../commercial-lineage/commercial-profitability.server";
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
  type FinanceToInvoiceRow,
  type FinanceCreditNote,
  creditNoteSplit,
  invoiceTotals,
  shipmentBillingCounts,
} from "./finance-data";
import { CUSTOMER_CREDITS, nextTaxDocumentNumber, writeCreditEvent, writeMovedToCredit, writeNewCustomerCredit } from "./customer-credit-ledger.server";
import { applyCreditToInvoice, creditNoteAllocation, customerCreditBalanceFromData, customerCreditOpen, invoiceLedgerKind } from "./refund-policy";

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

const operationalDate = nepalOperationalDate;

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + Math.max(0, days));
  return parsed.toISOString().slice(0, 10);
}

function safeDate(value: string, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

// Shared with the customer portal so both read the same invoice as overdue.
function effectiveStatus(status: FinanceInvoiceStatus, dueDate: string, balanceDue: number): FinanceInvoiceStatus {
  return effectiveInvoiceStatus(status, dueDate, balanceDue, operationalDate());
}

function lineFromData(value: unknown, index: number): FinanceInvoiceLine {
  const data = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    id: text(data.id, `line-${index + 1}`),
    kind: data.kind === "disbursement" ? "disbursement" : "service",
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
    kind: invoiceLedgerKind(data.kind),
    customer_credit_id: nullable(data.customer_credit_id),
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
  const [paymentsSnapshot, creditNotesSnapshot] = includePayments
    ? await Promise.all([
      snapshot.ref.collection("payments").orderBy("payment_date", "desc").limit(500).get(),
      snapshot.ref.collection("credit_notes").orderBy("created_at", "asc").limit(200).get(),
    ])
    : [null, null];
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
    disbursement_total: numberValue(data.disbursement_total),
    credit_total: numberValue(data.credit_total),
    total: numberValue(data.total),
    amount_paid: numberValue(data.amount_paid),
    balance_due: balanceDue,
    moved_to_credit_total: numberValue(data.moved_to_credit_total),
    notes: nullable(data.notes),
    tax_invoice_number: nullable(data.tax_invoice_number),
    fiscal_year: nullable(data.fiscal_year),
    seller_pan: nullable(data.seller_pan),
    customer_tax_id: nullable(data.customer_tax_id),
    created_by_name: text(data.created_by_name, "KCPL Accounts"),
    created_by_email: text(data.created_by_email),
    created_at: text(data.created_at),
    updated_at: text(data.updated_at),
    // Newest first; on the same day, by when recorded, a payment above the
    // money it moved to credit.
    payments: (paymentsSnapshot?.docs.map((doc) => paymentFromDoc(snapshot.id, doc.id, doc.data() as Record<string, unknown>)) ?? [])
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.created_at.localeCompare(a.created_at) || Number(a.kind === "moved_to_credit") - Number(b.kind === "moved_to_credit")),
    credit_notes: creditNotesSnapshot?.docs.map((doc) => creditNoteFromDoc(snapshot.id, doc.id, doc.data() as Record<string, unknown>)) ?? [],
  };
}

function creditNoteFromDoc(invoiceReference: string, id: string, data: Record<string, unknown>): FinanceCreditNote {
  return {
    id,
    number: text(data.number, id),
    invoice_reference: invoiceReference,
    credit_date: text(data.credit_date),
    amount: numberValue(data.amount),
    tax_amount: numberValue(data.tax_amount),
    disbursement_amount: numberValue(data.disbursement_amount),
    reason: text(data.reason),
    created_by_name: text(data.created_by_name, "KCPL Accounts"),
    created_at: text(data.created_at),
  };
}

/** KCPL's PAN/VAT number for its tax invoices, from configuration. */
export function companyPan() {
  return process.env.KCPL_COMPANY_PAN?.trim() || null;
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
  const [invoicesSnapshot, shipmentsSnapshot, commercialProfitability] = await Promise.all([
    readAllDocuments(db.collection("invoices").where("customer_id", "==", customerId)),
    db.collection("shipments").where("customer_id", "==", customerId).limit(1000).get(),
    customerCommercialProfitabilitySummary(customerId, currency),
  ]);

  // Every currency counts. Revenue is before VAT; what is owed is the whole
  // balance, because the credit limit is about exposure, so an NPR customer
  // owing in USD is still over the limit.
  const revenueByCurrency: Partial<Record<string, number>> = {};
  const outstandingByCurrency: Partial<Record<string, number>> = {};
  for (const invoice of invoicesSnapshot.docs) {
    const invoiceCurrency = currencyValue(invoice.get("currency"));
    const status = invoiceStatus(invoice.get("status"));
    if (status === "draft" || status === "void") continue;
    if (receivableRecordType(invoice.get("record_type") ?? invoice.get("migration_record_type")) !== "opening_balance") {
      revenueByCurrency[invoiceCurrency] = (revenueByCurrency[invoiceCurrency] ?? 0) + invoiceNetRevenue(invoice.data() as Record<string, unknown>);
    }
    outstandingByCurrency[invoiceCurrency] = (outstandingByCurrency[invoiceCurrency] ?? 0) + Math.max(0, numberValue(invoice.get("balance_due")));
  }

  const costByCurrency: Partial<Record<string, number>> = {};
  for (const shipment of shipmentsSnapshot.docs) {
    const costs = await shipment.ref.collection("job_costs").limit(1000).get();
    for (const item of costs.docs) {
      if (!jobCostCounts(item.data() as Record<string, unknown>)) continue;
      const costCurrency = currencyValue(item.get("currency"));
      costByCurrency[costCurrency] = (costByCurrency[costCurrency] ?? 0) + numberValue(item.get("amount"));
    }
  }

  const foreign = [...Object.keys(revenueByCurrency), ...Object.keys(outstandingByCurrency), ...Object.keys(costByCurrency)].some((key) => key !== currency);
  const table = foreign ? await loadNprRateTable() : null;
  const revenue = sumInCurrency(revenueByCurrency, currency, table?.rates ?? null);
  const cost = sumInCurrency(costByCurrency, currency, table?.rates ?? null);
  const outstanding = sumInCurrency(outstandingByCurrency, currency, table?.rates ?? null);
  const unconverted = [...new Set([...revenue.missing, ...cost.missing, ...outstanding.missing])].sort();

  // Money KCPL holds for the customer, shown beside what they owe; never
  // netted against it, so the credit limit stays about exposure.
  const accountCreditByCurrency: Partial<Record<string, number>> = {};
  const credits = await db.collection(CUSTOMER_CREDITS).where("customer_id", "==", customerId).where("status", "==", "open").get();
  for (const credit of credits.docs) {
    const creditCurrency = currencyValue(credit.get("currency"));
    accountCreditByCurrency[creditCurrency] = Math.round(((accountCreditByCurrency[creditCurrency] ?? 0) + numberValue(credit.get("available")) + numberValue(credit.get("reserved"))) * 100) / 100;
  }

  await customerRef.update({
    account_credit_by_currency: accountCreditByCurrency,
    revenue_total: revenue.amount,
    cost_total: cost.amount,
    profit_total: Math.round((revenue.amount - cost.amount) * 100) / 100,
    outstanding_balance: outstanding.amount,
    outstanding_by_currency: outstandingByCurrency,
    finance_unconverted_currencies: unconverted,
    finance_rates_date: table && foreign ? table.date : null,
    finance_currency: currency,
    ...commercialProfitability,
    finance_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

/**
 * How many issued and draft invoices a shipment has, kept on the shipment so
 * Finance can list delivered work not yet billed without reading every
 * invoice ever raised. Rewritten whenever an invoice is drafted, issued or
 * voided; a failure only leaves the list to recount it.
 */
export async function syncShipmentBilling(shipmentReference: string | null) {
  const reference = shipmentReference?.trim().toUpperCase();
  if (!reference || !firebaseRuntimeConfigured()) return;
  try {
    const db = firebaseAdminDb();
    const invoices = await db.collection("invoices").where("shipment_reference", "==", reference).limit(500).get();
    const counts = shipmentBillingCounts(invoices.docs.map((doc) => text(doc.get("status"))));
    await db.collection("shipments").doc(reference).update({ issued_invoice_count: counts.issued, draft_invoice_count: counts.draft, billing_synced_at: new Date().toISOString() });
  } catch (error) {
    console.error("Failed to record a shipment's invoice counts", error);
  }
}

/**
 * Delivered shipments with no issued invoice, longest-waiting first. A job
 * could be delivered, closed and never billed with nothing anywhere saying
 * so. Shipments from before the counts were kept are counted once here and
 * the count written back.
 */
async function listShipmentsToInvoice(context: KcplStaffContext): Promise<FinanceToInvoiceRow[]> {
  const db = firebaseAdminDb();
  const delivered = await readAllDocuments(db.collection("shipments").where("status", "==", "delivered"));
  const visible = delivered.docs.filter((doc) => canAccessBranchValue(context, doc.get("primary_branch")));
  const counts = new Map<string, { issued: number; draft: number }>();
  const uncounted: string[] = [];
  for (const doc of visible) {
    const issued = doc.get("issued_invoice_count");
    if (typeof issued === "number") counts.set(doc.id, { issued, draft: numberValue(doc.get("draft_invoice_count")) });
    else uncounted.push(doc.id);
  }
  for (let index = 0; index < uncounted.length; index += 30) {
    const chunk = uncounted.slice(index, index + 30);
    const invoices = await db.collection("invoices").where("shipment_reference", "in", chunk).get();
    const statuses = new Map<string, string[]>(chunk.map((id) => [id, []]));
    for (const invoice of invoices.docs) statuses.get(text(invoice.get("shipment_reference")).toUpperCase())?.push(text(invoice.get("status")));
    const batch = db.batch();
    const now = new Date().toISOString();
    for (const [id, list] of statuses) {
      const count = shipmentBillingCounts(list);
      counts.set(id, count);
      batch.update(db.collection("shipments").doc(id), { issued_invoice_count: count.issued, draft_invoice_count: count.draft, billing_synced_at: now });
    }
    await batch.commit().catch((error) => console.error("Failed to store shipment invoice counts", error));
  }
  const waiting = visible.filter((doc) => (counts.get(doc.id)?.issued ?? 0) === 0);
  const customers = await loadDocumentsById(db, "customers", waiting.map((doc) => text(doc.get("customer_id")).toUpperCase()));
  const customerNames = new Map(customers.map((doc) => [doc.id, text(doc.get("display_name"))]));
  return waiting
    .map((doc) => {
      const customerId = nullable(doc.get("customer_id"))?.toUpperCase() ?? null;
      return {
        reference: doc.id,
        customer_id: customerId,
        customer_name: customerId ? customerNames.get(customerId) || null : null,
        branch: text(doc.get("primary_branch")),
        delivered_on: nullable(doc.get("delivered_at"))?.slice(0, 10) ?? nullable(doc.get("updated_at"))?.slice(0, 10) ?? null,
        draft_invoice_count: counts.get(doc.id)?.draft ?? 0,
      };
    })
    .sort((a, b) => (a.delivered_on ?? "").localeCompare(b.delivered_on ?? ""));
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
  if (qaMockDataEnabled()) return canAccessFinance(context) ? mockFinanceDashboard(context) : null;
  if (!firebaseRuntimeConfigured() || !canAccessFinance(context)) return null;
  const db = firebaseAdminDb();
  // Every open invoice, however old, so outstanding and overdue are whole;
  // settled history is the most recent window. The recent read alone let an
  // old unpaid invoice fall out of AR once 3,000 newer ones were touched.
  const [openScan, recent] = await Promise.all([
    readAllDocuments(db.collection("invoices").where("status", "in", ["draft", "issued", "partially_paid", "overdue"])),
    db.collection("invoices").orderBy("updated_at", "desc").limit(3000).get(),
  ]);
  const docs = [...new Map([...openScan.docs, ...recent.docs].map((doc) => [doc.id, doc])).values()];
  const invoices: FinanceInvoice[] = [];
  const statusUpdates: Array<{ ref: FirebaseFirestore.DocumentReference; status: FinanceInvoice["status"] }> = [];

  for (const doc of docs) {
    if (!canAccessInvoice(context, doc.get("branch"))) continue;
    const invoice = await invoiceFromSnapshot(doc, false);
    invoices.push(invoice);
    const stored = invoiceStatus(doc.get("status"));
    if (stored !== invoice.status) statusUpdates.push({ ref: doc.ref, status: invoice.status });
  }
  // Written back in modest commits: a day on which hundreds of invoices fall due is one page load.
  for (let index = 0; index < statusUpdates.length; index += 400) {
    const batch = db.batch();
    const updatedAt = new Date().toISOString();
    for (const update of statusUpdates.slice(index, index + 400)) batch.update(update.ref, { status: update.status, updated_at: updatedAt });
    await batch.commit();
  }

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

  const toInvoice = await listShipmentsToInvoice(context).catch((error) => {
    console.error("Failed to list delivered shipments not yet invoiced", error);
    return [] as FinanceToInvoiceRow[];
  });

  return {
    generated_at: new Date().toISOString(),
    invoices,
    to_invoice: toInvoice,
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
  // Lines are priced here, never trusted from the browser's arithmetic.
  const priced = invoiceTotals(input.lines);
  if (!priced.ok) return { kind: priced.reason === "invalid_tax" ? "invalid_tax" as const : priced.reason === "invalid_amount" ? "invalid_amount" as const : "invalid_lines" as const };
  const defaultDescription = quote?.exists
    ? `Freight services: ${text(quoteData.origin, "Origin")} to ${text(quoteData.destination, "Destination")}`
    : "Freight and logistics services";
  const lines: FinanceInvoiceLine[] = priced.lines.map((line, index) => ({
    ...line,
    id: childId("line"),
    description: input.lines[index]?.description.trim() ? line.description : line.kind === "service" ? defaultDescription : line.description,
  }));
  const { subtotal, tax_total: tax, disbursement_total: disbursementTotal, total } = priced;
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
    line_items: lines,
    subtotal,
    tax_total: tax,
    disbursement_total: disbursementTotal,
    credit_total: 0,
    moved_to_credit_total: 0,
    credit_tax_total: 0,
    credit_disbursement_total: 0,
    adjustment_total: 0,
    total,
    amount_paid: 0,
    balance_due: total,
    notes: input.notes.trim() || null,
    tax_invoice_number: null,
    fiscal_year: null,
    customer_tax_id: nullable(customer.get("tax_id")),
    seller_pan: null,
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: now,
    updated_at: now,
  };
  await db.collection("invoices").doc(reference).create(document);
  await syncShipmentBilling(document.shipment_reference);
  await writeCustomerActivity(customerId, `Invoice draft created: ${reference}`, `${input.currency} ${total.toFixed(2)} · due ${dueDate}`, actor);
  await writeJobActivity(shipment?.exists ? shipmentId : null, `Invoice draft created: ${reference}`, `${input.currency} ${total.toFixed(2)}`, actor);
  return { kind: "created" as const, reference };
}

export async function issueFinanceInvoice(reference: string, actor: Actor, context: KcplStaffContext) {
  const loaded = await getFinanceInvoice(reference, context);
  if (loaded.kind !== "ready") return loaded;
  if (loaded.invoice.status !== "draft") return { kind: "invalid_status" as const };
  const today = operationalDate();
  const dates = invoiceDatesOnIssue(loaded.invoice.issue_date, loaded.invoice.due_date, today);
  const nextStatus = dates.dueDate < today ? "overdue" : "issued";
  const fiscalYear = nepalFiscalYear(dates.issueDate);
  if (!fiscalYear) return { kind: "invalid_status" as const };
  const db = firebaseAdminDb();
  const invoiceRef = db.collection("invoices").doc(loaded.invoice.reference);
  const customerRef = db.collection("customers").doc(loaded.invoice.customer_id);
  // The number is the next in this fiscal year's series and is given only
  // here, at issue: drafts are working copies, and an issued invoice keeps
  // its number for good, even if it is later voided.
  const issued = await db.runTransaction(async (transaction) => {
    const [current, customer, advances] = await Promise.all([
      transaction.get(invoiceRef),
      transaction.get(customerRef),
      // Advances paid against this invoice as a proforma.
      transaction.get(db.collection(CUSTOMER_CREDITS).where("linked_invoice_reference", "==", loaded.invoice.reference).where("status", "==", "open")),
    ]);
    if (!current.exists || current.get("status") !== "draft") return null;
    const series = await nextTaxDocumentNumber(transaction, "invoice", fiscalYear);
    const now = new Date().toISOString();
    series.commit();

    // Each advance in the invoice's currency is used on it, oldest first, up
    // to what it owes; what is left stays the customer's credit.
    const total = numberValue(current.get("total"));
    let paid = numberValue(current.get("amount_paid"));
    let applied = 0;
    const currency = text(current.get("currency"));
    for (const advance of [...advances.docs].sort((a, b) => text(a.get("created_at")).localeCompare(text(b.get("created_at"))))) {
      if (text(advance.get("currency")) !== currency || text(advance.get("customer_id")) !== text(current.get("customer_id"))) continue;
      const balance = customerCreditBalanceFromData(advance.data() as Record<string, unknown>);
      const owed = Math.round((total - paid) * 100) / 100;
      const take = Math.min(balance.available, owed);
      if (take <= 0.005) continue;
      const moved = applyCreditToInvoice(balance, Math.round(take * 100) / 100, owed);
      if (!moved.ok) continue;
      paid = Math.round((paid + moved.amount) * 100) / 100;
      applied = Math.round((applied + moved.amount) * 100) / 100;
      const rowId = `advance-${advance.id}`;
      transaction.create(invoiceRef.collection("payments").doc(rowId), {
        kind: "credit_applied", invoice_reference: loaded.invoice.reference, amount: moved.amount, currency, payment_date: dates.issueDate,
        method: "adjustment", reference: `Advance ${text(advance.get("receipt_number"))}`.trim(), notes: null, customer_credit_id: advance.id,
        balance_before: owed, balance_after: Math.round((total - paid) * 100) / 100,
        recorded_by_name: actor.name, recorded_by_email: actor.email, created_at: now,
      });
      transaction.update(advance.ref, { ...moved.next, status: customerCreditOpen(moved.next) ? "open" : "used", updated_at: now });
      writeCreditEvent(transaction, advance.id, `${rowId}-applied`, {
        kind: "applied", amount: moved.amount, detail: `${currency} ${moved.amount.toFixed(2)} used on ${series.number} when it was issued`, refund_id: null, invoice_reference: loaded.invoice.reference,
      }, actor, now);
    }
    const balanceDue = Math.round((total - paid) * 100) / 100;
    transaction.update(invoiceRef, {
      amount_paid: paid,
      balance_due: balanceDue,
      ...(applied > 0 ? { payment_status: balanceDue <= 0.00001 ? "paid" : "partially_paid", last_payment_at: now } : {}),
      status: applied > 0 && balanceDue <= 0.00001 ? "paid" : applied > 0 && nextStatus === "issued" ? "partially_paid" : nextStatus,
      issue_date: dates.issueDate,
      due_date: dates.dueDate,
      ...(dates.moved ? { drafted_issue_date: loaded.invoice.issue_date, drafted_due_date: loaded.invoice.due_date } : {}),
      tax_invoice_number: series.number,
      tax_invoice_sequence: series.sequence,
      fiscal_year: fiscalYear,
      seller_pan: companyPan(),
      customer_tax_id: nullable(customer.get("tax_id")) ?? nullable(current.get("customer_tax_id")),
      issued_at: now, issued_by_name: actor.name, issued_by_email: actor.email, updated_at: now,
    });
    return series.number;
  });
  if (!issued) return { kind: "invalid_status" as const };
  await recomputeCustomerFinance(loaded.invoice.customer_id);
  await syncShipmentBilling(loaded.invoice.shipment_reference);
  await writeCustomerActivity(loaded.invoice.customer_id, `Invoice issued: ${issued}`, `${loaded.invoice.currency} ${loaded.invoice.total.toFixed(2)} · due ${dates.dueDate}${dates.moved ? ` · dated ${dates.issueDate}, the day it was issued` : ""}`, actor);
  await writeJobActivity(loaded.invoice.shipment_reference, `Invoice issued: ${issued}`, `${loaded.invoice.currency} ${loaded.invoice.total.toFixed(2)}`, actor);
  return { kind: "updated" as const, taxInvoiceNumber: issued };
}

/**
 * Withdraw part or all of what is still owed on an issued invoice, with a
 * numbered credit note. Before this an issued invoice could only be voided,
 * and not at all once anything was paid. A refund of money already received
 * is not this: credits stop at the outstanding balance.
 */
export async function createCreditNote(reference: string, input: { amount: number; reason: string }, actor: Actor, context: KcplStaffContext) {
  const loaded = await getFinanceInvoice(reference, context);
  if (loaded.kind !== "ready") return loaded;
  const reason = input.reason.trim().slice(0, 500);
  if (reason.length < 4) return { kind: "reason_required" as const };
  // A paid invoice can be credited too: what was paid becomes the customer's credit.
  const creditable = ["issued", "partially_paid", "overdue", "paid"];
  if (!creditable.includes(loaded.invoice.status) || loaded.invoice.record_type !== "invoice") return { kind: "invalid_status" as const };
  const today = operationalDate();
  const fiscalYear = nepalFiscalYear(today);
  if (!fiscalYear) return { kind: "invalid_status" as const };
  const db = firebaseAdminDb();
  const invoiceRef = db.collection("invoices").doc(loaded.invoice.reference);
  const result = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(invoiceRef);
    if (!current.exists) return { kind: "missing" as const };
    const status = text(current.get("status"));
    if (!creditable.includes(status)) return { kind: "invalid_status" as const };
    const data = current.data() as Record<string, unknown>;
    const total = numberValue(data.total);
    const balanceDue = numberValue(data.balance_due);
    const amountPaid = numberValue(data.amount_paid);
    const split = creditNoteSplit({
      total, tax_total: numberValue(data.tax_total), disbursement_total: numberValue(data.disbursement_total),
      credit_tax_total: numberValue(data.credit_tax_total), credit_disbursement_total: numberValue(data.credit_disbursement_total),
    }, input.amount);
    if (!split.ok) return { kind: split.reason };
    const allocation = creditNoteAllocation({ total, balance_due: balanceDue }, split.amount);
    if (!allocation.ok) return { kind: allocation.reason };
    // What was paid can't be more than what is credited back out of it.
    if (allocation.toCustomerCredit - amountPaid > 0.005) return { kind: "invalid_status" as const };
    const series = await nextTaxDocumentNumber(transaction, "credit_note", fiscalYear);
    const now = new Date().toISOString();
    const round = (value: number) => Math.round(value * 100) / 100;
    const nextTotal = round(total - split.amount);
    const nextBalance = round(balanceDue - allocation.fromBalance);
    const nextPaid = round(amountPaid - allocation.toCustomerCredit);
    const id = childId("credit");
    const invoiceNumber = text(data.tax_invoice_number) || loaded.invoice.reference;
    series.commit();
    transaction.create(invoiceRef.collection("credit_notes").doc(id), {
      number: series.number, sequence: series.sequence, fiscal_year: fiscalYear, invoice_reference: loaded.invoice.reference,
      tax_invoice_number: nullable(data.tax_invoice_number), credit_date: today, amount: split.amount, tax_amount: split.tax_amount,
      disbursement_amount: split.disbursement_amount, currency: text(data.currency), reason,
      from_balance: allocation.fromBalance, to_customer_credit: allocation.toCustomerCredit,
      created_by_name: actor.name, created_by_email: actor.email, created_at: now,
    });
    let customerCreditId: string | null = null;
    if (allocation.toCustomerCredit > 0.005) {
      customerCreditId = `credit-note-${id.replace(/^credit-/, "")}`;
      writeNewCustomerCredit(transaction, {
        id: customerCreditId, customerId: text(data.customer_id), customerName: text(data.customer_name, "Customer"),
        branch: text(data.branch), currency: text(data.currency), amount: allocation.toCustomerCredit, source: "credit_note",
        sourceInvoiceReference: loaded.invoice.reference, sourceInvoiceNumber: invoiceNumber, sourceDocument: series.number,
        note: reason, actor, now,
      });
      writeMovedToCredit(transaction, invoiceRef, {
        id: `${id}-to-credit`, invoiceReference: loaded.invoice.reference, amount: allocation.toCustomerCredit,
        currency: text(data.currency), creditId: customerCreditId, date: today,
        note: `Credit note ${series.number}: already paid, now the customer's credit`, actor, now,
      });
    }
    transaction.update(invoiceRef, {
      total: nextTotal,
      balance_due: nextBalance,
      amount_paid: nextPaid,
      moved_to_credit_total: round(numberValue(data.moved_to_credit_total) + allocation.toCustomerCredit),
      credit_total: round(numberValue(data.credit_total) + split.amount),
      credit_tax_total: round(numberValue(data.credit_tax_total) + split.tax_amount),
      credit_disbursement_total: round(numberValue(data.credit_disbursement_total) + split.disbursement_amount),
      ...(nextBalance <= 0.00001 ? { status: "paid", payment_status: "paid" } : {}),
      updated_at: now,
    });
    return { kind: "created" as const, number: series.number, amount: split.amount, customerCreditId, toCustomerCredit: allocation.toCustomerCredit };
  });
  if (result.kind !== "created") return result;
  await recomputeCustomerFinance(loaded.invoice.customer_id);
  const creditDetail = result.toCustomerCredit > 0.005 ? ` · ${loaded.invoice.currency} ${result.toCustomerCredit.toFixed(2)} already paid, now the customer's credit` : "";
  await writeCustomerActivity(loaded.invoice.customer_id, `Credit note ${result.number}`, `${loaded.invoice.currency} ${result.amount.toFixed(2)} off ${loaded.invoice.tax_invoice_number ?? loaded.invoice.reference} · ${reason}${creditDetail}`, actor);
  await writeJobActivity(loaded.invoice.shipment_reference, `Credit note ${result.number}`, `${loaded.invoice.currency} ${result.amount.toFixed(2)} · ${reason}`, actor);
  return result;
}

export async function voidFinanceInvoice(reference: string, actor: Actor, context: KcplStaffContext) {
  const loaded = await getFinanceInvoice(reference, context);
  if (loaded.kind !== "ready") return loaded;
  if (loaded.invoice.status === "void") return { kind: "updated" as const };
  if (loaded.invoice.amount_paid > 0) return { kind: "has_payments" as const };
  // Credit notes point at this invoice; it is corrected through them now.
  if (loaded.invoice.credit_total > 0) return { kind: "has_credit_notes" as const };
  const now = new Date().toISOString();
  await firebaseAdminDb().collection("invoices").doc(loaded.invoice.reference).update({ status: "void", balance_due: 0, voided_at: now, voided_by_name: actor.name, voided_by_email: actor.email, updated_at: now });
  await recomputeCustomerFinance(loaded.invoice.customer_id);
  await syncShipmentBilling(loaded.invoice.shipment_reference);
  await writeCustomerActivity(loaded.invoice.customer_id, `Invoice voided: ${loaded.invoice.reference}`, `${loaded.invoice.currency} ${loaded.invoice.total.toFixed(2)}`, actor);
  await writeJobActivity(loaded.invoice.shipment_reference, `Invoice voided: ${loaded.invoice.reference}`, `${loaded.invoice.currency} ${loaded.invoice.total.toFixed(2)}`, actor);
  return { kind: "updated" as const };
}
