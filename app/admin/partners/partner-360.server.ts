import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import {
  canAccessBranchSet,
  canAccessBranchValue,
  strictBranchArray,
  strictBranchValue,
} from "../branch-access-policy";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { payableStatuses, type PayableStatus } from "../payables/payables-data";
import type { KcplStaffContext } from "../staff-directory.server";
import { shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import { isPartnerReference } from "./partner-policy";
import { getPartnerRecord } from "./partners.server";
import type {
  Partner360Snapshot,
  PartnerActivityItem,
  PartnerBillSummary,
  PartnerFinanceSummary,
  PartnerJobSummary,
} from "./partner-360";

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

function currencyValue(value: unknown): CrmCurrency | null {
  const currency = text(value).trim().toUpperCase();
  return crmCurrencies.includes(currency as CrmCurrency) ? currency as CrmCurrency : null;
}

function payableStatus(value: unknown): PayableStatus {
  return payableStatuses.includes(value as PayableStatus) ? value as PayableStatus : "draft";
}

function shipmentStatus(value: unknown): ShipmentStatus {
  return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : "booking_confirmed";
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function effectivePayableStatus(status: PayableStatus, dueDate: string, balance: number): PayableStatus {
  if (status === "draft" || status === "void" || status === "paid") return status;
  if (balance <= 0.00001) return "paid";
  if (dueDate && dueDate < operationalDate()) return "overdue";
  return status === "overdue" ? "approved" : status;
}

function billFromDoc(doc: FirebaseFirestore.QueryDocumentSnapshot, legacyNameLink: boolean): PartnerBillSummary {
  const balance = Math.max(0, numberValue(doc.get("balance_due")));
  const dueDate = text(doc.get("due_date"));
  return {
    reference: doc.id,
    supplier_bill_reference: nullable(doc.get("supplier_bill_reference")),
    shipment_reference: nullable(doc.get("shipment_reference")),
    branch: strictBranchValue(doc.get("branch")),
    status: effectivePayableStatus(payableStatus(doc.get("status")), dueDate, balance),
    bill_date: text(doc.get("bill_date")),
    due_date: dueDate,
    currency: currencyValue(doc.get("currency")),
    total: Math.max(0, numberValue(doc.get("total"))),
    amount_paid: Math.max(0, numberValue(doc.get("amount_paid"))),
    balance_due: balance,
    description: text(doc.get("description"), "Supplier cost"),
    updated_at: text(doc.get("updated_at"), text(doc.get("created_at"))),
    legacy_name_link: legacyNameLink,
  };
}

function addSummary(map: Map<CrmCurrency, PartnerFinanceSummary>, bill: PartnerBillSummary) {
  if (!bill.currency || bill.status === "draft" || bill.status === "void") return;
  let summary = map.get(bill.currency);
  if (!summary) {
    summary = {
      currency: bill.currency,
      billed: 0,
      paid: 0,
      outstanding: 0,
      overdue: 0,
      bill_count: 0,
      open_bill_count: 0,
      overdue_bill_count: 0,
    };
    map.set(bill.currency, summary);
  }
  summary.billed += bill.total;
  summary.paid += bill.amount_paid;
  summary.outstanding += bill.balance_due;
  summary.bill_count += 1;
  if (bill.balance_due > 0.00001) summary.open_bill_count += 1;
  if (bill.status === "overdue" && bill.balance_due > 0.00001) {
    summary.overdue += bill.balance_due;
    summary.overdue_bill_count += 1;
  }
}

async function getAllInChunks(refs: FirebaseFirestore.DocumentReference[], size = 100) {
  const db = firebaseAdminDb();
  const snapshots: FirebaseFirestore.DocumentSnapshot[] = [];
  for (let index = 0; index < refs.length; index += size) {
    snapshots.push(...await db.getAll(...refs.slice(index, index + size)));
  }
  return snapshots;
}

export async function getPartner360Snapshot(partnerId: string, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const loaded = await getPartnerRecord(partnerId, context);
  if (loaded.kind !== "ready") return loaded;

  const db = firebaseAdminDb();
  const partner = loaded.partner;
  const financeVisible = context.permissions.canManageFinance;
  const [directBillsSnapshot, legacyBillsSnapshot, activitySnapshot] = await Promise.all([
    db.collection("payables").where("supplier_id", "==", partner.id).limit(1500).get(),
    financeVisible
      ? db.collection("payables").where("supplier_name", "==", partner.display_name).limit(500).get()
      : Promise.resolve(null),
    db.collection("partners").doc(partner.id).collection("activity").orderBy("created_at", "desc").limit(100).get(),
  ]);

  const accessibleDirectDocs = directBillsSnapshot.docs.filter((doc) => canAccessBranchValue(context, doc.get("branch")));
  const shipmentReferences = new Set(
    accessibleDirectDocs.map((doc) => nullable(doc.get("shipment_reference"))).filter((value): value is string => Boolean(value)),
  );

  let legacyNameLinkedBillCount = 0;
  let financeIntegrityWarningCount = 0;
  const bills: PartnerBillSummary[] = [];
  const financeMap = new Map<CrmCurrency, PartnerFinanceSummary>();

  if (financeVisible) {
    const seen = new Set<string>();
    const financeDocs: Array<{ doc: FirebaseFirestore.QueryDocumentSnapshot; legacy: boolean }> = [];
    for (const doc of accessibleDirectDocs) {
      seen.add(doc.id);
      financeDocs.push({ doc, legacy: false });
    }
    for (const doc of legacyBillsSnapshot?.docs ?? []) {
      if (seen.has(doc.id) || !canAccessBranchValue(context, doc.get("branch"))) continue;
      const supplierId = nullable(doc.get("supplier_id"));
      if (supplierId && isPartnerReference(supplierId)) continue;
      if (payableStatus(doc.get("status")) !== "void") legacyNameLinkedBillCount += 1;
      financeDocs.push({ doc, legacy: true });
    }

    for (const item of financeDocs) {
      const bill = billFromDoc(item.doc, item.legacy);
      if (!bill.branch) financeIntegrityWarningCount += 1;
      if (!bill.currency) financeIntegrityWarningCount += 1;
      bills.push(bill);
      addSummary(financeMap, bill);
    }
    bills.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  const shipmentRefs = [...shipmentReferences].slice(0, 1000).map((reference) => db.collection("shipments").doc(reference));
  const shipmentSnapshots = shipmentRefs.length ? await getAllInChunks(shipmentRefs) : [];
  const accessibleShipments = shipmentSnapshots.filter((snapshot) => snapshot.exists && canAccessBranchSet(
    context,
    snapshot.get("primary_branch"),
    snapshot.get("handling_branches"),
  ));

  const quoteReferences = [...new Set(accessibleShipments
    .map((snapshot) => nullable(snapshot.get("quote_reference")))
    .filter((value): value is string => Boolean(value)))]
    .map((reference) => db.collection("quotes").doc(reference));
  const quoteSnapshots = quoteReferences.length ? await getAllInChunks(quoteReferences) : [];
  const quoteById = new Map(quoteSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.id, snapshot]));

  const jobs: PartnerJobSummary[] = accessibleShipments.map((snapshot) => {
    const quoteReference = nullable(snapshot.get("quote_reference"));
    const quote = quoteReference ? quoteById.get(quoteReference) : undefined;
    return {
      reference: snapshot.id,
      quote_reference: quoteReference,
      status: shipmentStatus(snapshot.get("status")),
      primary_branch: strictBranchValue(snapshot.get("primary_branch")),
      handling_branches: strictBranchArray(snapshot.get("handling_branches")),
      customer_id: nullable(snapshot.get("customer_id")),
      origin: quote ? nullable(quote.get("origin")) : null,
      destination: quote ? nullable(quote.get("destination")) : null,
      mode: quote ? nullable(quote.get("mode")) : null,
      current_location: nullable(snapshot.get("current_location")),
      eta: nullable(snapshot.get("eta")),
      updated_at: text(snapshot.get("updated_at"), text(snapshot.get("created_at"))),
    };
  }).sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const activity: PartnerActivityItem[] = activitySnapshot.docs
    .filter((doc) => financeVisible || text(doc.get("type")) !== "payables_activity")
    .map((doc) => ({
      id: doc.id,
      type: text(doc.get("type"), "partner_activity"),
      title: text(doc.get("title"), "Partner activity"),
      detail: nullable(doc.get("detail")),
      actor_name: nullable(doc.get("actor_name")),
      actor_email: nullable(doc.get("actor_email")),
      created_at: text(doc.get("created_at")),
    }));

  const snapshot: Partner360Snapshot = {
    generated_at: new Date().toISOString(),
    partner,
    finance_summaries: [...financeMap.values()].sort((a, b) => b.outstanding - a.outstanding || a.currency.localeCompare(b.currency)),
    bills,
    jobs,
    activity,
    legacy_name_linked_bill_count: legacyNameLinkedBillCount,
    finance_integrity_warning_count: financeIntegrityWarningCount,
  };
  return { kind: "ready" as const, snapshot };
}
