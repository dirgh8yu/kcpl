import { after } from "next/server";
import { firebaseAdminDb } from "../firebase-admin.server";
import { nepalOperationalDate } from "../invoice-effective-status";
import { kcplBranches, type CrmCurrency, type KcplBranch } from "../admin/crm/crm-data";
import { documentReadingConfigured, readShipmentDocument } from "../admin/document-reading.server";
import { createPayableWithSettlementIntegrity } from "../admin/financial-settlement/payables-settlement.server";
import { staffCapabilitiesForRole } from "../admin/staff-permissions";
import type { KcplStaffContext } from "../admin/staff-directory.server";
import { uploadShipmentDocument } from "../shipment-documents.server";
import type { PartnerSession } from "./partner-auth";
import { partnerCanSeeShipment, partnerShipmentAccessFromRecord } from "./partner-access-policy";
import { partnerFileMatchesType, partnerWriteAllowed } from "./partner-data.server";
import { partnerBillCategory, partnerBillFromInput, partnerBillReadingCheck, partnerBillStatusLabel, partnerBillTotal } from "./partner-bills";

/*
 * A partner's invoice for a shipment, sent through the partner portal. The
 * file goes onto the shipment as KCPL's own paper (never released to the
 * customer) and the figures become a draft supplier bill through the same
 * path Accounts use, so duplicates, the Job File cost match and the bill
 * check all apply. Nothing is approved or paid without Accounts.
 */

function text(value: unknown) { return typeof value === "string" ? value : ""; }

const PARTNER_BILL_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const PARTNER_BILL_MAX_BYTES = 15 * 1024 * 1024;

/** The authority a partner's submission carries: enough to draft a bill in any branch, as the payment gateway records a payment. Approval stays with Accounts. */
function partnerBillContext(session: PartnerSession): KcplStaffContext {
  const now = new Date().toISOString();
  return {
    profile: {
      uid: `partner-${session.partnerId}`, email: session.email, display_name: `${session.displayName} at ${session.partnerName}`, job_title: null, phone: null,
      role: "accounts", branch_scope: "all", branches: [...kcplBranches], active: true, created_at: now, updated_at: now, updated_by: null,
    },
    permissions: staffCapabilitiesForRole("accounts"),
    can_access_all_branches: true,
    branches: [...kcplBranches],
  };
}

export async function submitPartnerBill(session: PartnerSession, reference: string, input: Record<string, unknown>, file: File | null) {
  const normalized = reference.trim().toUpperCase();
  const db = firebaseAdminDb();
  const shipment = await db.collection("shipments").doc(normalized).get();
  if (!shipment.exists || !partnerCanSeeShipment(shipment.data() as Record<string, unknown>, session.partnerId)) return { kind: "missing" as const };
  const checked = partnerBillFromInput(input, nepalOperationalDate());
  if (!checked.ok) return { kind: "invalid" as const, error: checked.error };
  if (!file) return { kind: "file_required" as const };
  if (!PARTNER_BILL_TYPES.includes(file.type)) return { kind: "unsupported_type" as const };
  if (file.size <= 0 || file.size > PARTNER_BILL_MAX_BYTES) return { kind: "too_large" as const };
  const data = await file.arrayBuffer();
  if (!partnerFileMatchesType(file.type, data)) return { kind: "unsupported_type" as const };
  if (!await partnerWriteAllowed(session)) return { kind: "rate_limited" as const };
  const bill = checked.value;
  const role = partnerShipmentAccessFromRecord(shipment.get("partner_access")).find((item) => item.partner_id === session.partnerId)?.role ?? null;
  const actor = { name: `${session.displayName} at ${session.partnerName} (partner portal)`, email: session.email };

  // The bill first: a duplicate invoice number is refused before any file is stored.
  const created = await createPayableWithSettlementIntegrity({
    supplierId: session.partnerId, supplierName: session.partnerName, supplierBillReference: bill.invoiceNumber, shipmentReference: normalized,
    branch: (shipment.get("primary_branch") ?? kcplBranches[0]) as KcplBranch, billDate: bill.invoiceDate, dueDate: "", currency: bill.currency as CrmCurrency,
    category: partnerBillCategory(role), description: bill.description || `${session.partnerName} invoice ${bill.invoiceNumber}`,
    amount: bill.amount, taxRate: bill.vatRate, notes: `Sent through the partner portal by ${session.displayName} (${session.email}).`,
  }, actor, partnerBillContext(session));
  if (created.kind === "duplicate_bill") return { kind: "duplicate" as const };
  // The partner is set up under another KCPL branch than this shipment's: staff can't file it here either.
  if (created.kind === "supplier_forbidden" || created.kind === "supplier_scope_mismatch") return { kind: "other_branch" as const };
  if (created.kind !== "created") {
    console.error("KCPL partner bill refused", created.kind);
    return { kind: "unavailable" as const };
  }

  const upload = await uploadShipmentDocument(normalized, {
    filename: file.name.slice(0, 200) || `invoice-${bill.invoiceNumber}.pdf`, contentType: file.type, sizeBytes: file.size, documentType: "other",
    uploadedBy: session.partnerName, uploadedByEmail: session.email, data, source: "partner", uploadedByPartnerId: session.partnerId, kcplOnly: true,
  });
  // The same file sent earlier as an ordinary document: link that one, and keep it from the customer now it's known to be a bill to KCPL.
  const documentId = upload.kind === "created" || upload.kind === "duplicate" ? upload.document.id : null;
  if (upload.kind === "duplicate") {
    await shipment.ref.collection("documents").doc(String(upload.document.id)).update({ kcpl_only: true, customer_safe: false }).catch(() => undefined);
  }
  const totals = partnerBillTotal(bill);
  const now = new Date().toISOString();
  await db.collection("payables").doc(created.reference).update({
    source: "partner_portal", submitted_by_partner_email: session.email, submitted_by_partner_name: session.displayName,
    partner_document_id: documentId, partner_document_filename: file.name.slice(0, 200), partner_reading_check: null, updated_at: now,
  });
  await shipment.ref.collection("job_activity").doc(`partner-bill-${created.reference}`).create({
    type: "partner_bill", title: `Invoice ${bill.invoiceNumber} from ${session.partnerName}`, detail: `${bill.currency} ${totals.total.toFixed(2)} · a draft supplier bill for Accounts`,
    actor_name: actor.name, actor_email: actor.email, created_at: now,
  }).catch(() => undefined);

  // Reading the invoice takes a while; the partner doesn't wait for it.
  if (documentId !== null && documentReadingConfigured()) {
    after(async () => {
      const read = await readShipmentDocument(normalized, documentId, { name: "Partner bill check", email: "reader@kcpl.system" }).catch(() => null);
      if (!read || read.kind !== "read") return;
      const check = partnerBillReadingCheck({ invoiceNumber: bill.invoiceNumber, currency: bill.currency, total: totals.total, amount: bill.amount }, read.reading);
      await db.collection("payables").doc(created.reference).update({ partner_reading_check: { ...check, read_total: read.reading.invoice_total, read_currency: read.reading.currency, read_number: read.reading.document_number, read_at: new Date().toISOString() } }).catch(() => undefined);
    });
  }
  return { kind: "created" as const, reference: created.reference };
}

export type PartnerBillRow = { reference: string; invoice_number: string; invoice_date: string; currency: string; total: number; amount_paid: number; status: string; status_label: string };

/** The invoices this partner sent for the shipment, and where each stands. */
export async function listPartnerBills(session: PartnerSession, reference: string): Promise<PartnerBillRow[]> {
  const normalized = reference.trim().toUpperCase();
  const snapshot = await firebaseAdminDb().collection("payables").where("supplier_id", "==", session.partnerId).where("shipment_reference", "==", normalized).limit(200).get();
  return snapshot.docs
    .filter((doc) => doc.get("source") === "partner_portal")
    .map((doc) => ({
      reference: doc.id, invoice_number: text(doc.get("supplier_bill_reference")), invoice_date: text(doc.get("bill_date")), currency: text(doc.get("currency")),
      total: Number(doc.get("total")) || 0, amount_paid: Number(doc.get("amount_paid")) || 0, status: text(doc.get("status")), status_label: partnerBillStatusLabel(text(doc.get("status"))),
    }))
    .sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));
}
