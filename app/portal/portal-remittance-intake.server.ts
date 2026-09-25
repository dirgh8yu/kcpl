import { createDirectNotification } from "../admin/notifications/notification-centre.server";
import { firebaseAdminDb } from "../firebase-admin.server";
import { validateShipmentDocumentBytes } from "../shipment-document-policy";
import type { PortalSession } from "./portal-auth";
import { portalOwnsInvoice } from "./portal-data.server";
import { portalIntakeExtension, portalIntakeExtensions, portalWriteRefused, type PortalWriteResult } from "./portal-intake";
import { listInvoiceRemittances, REMITTANCE_MAX_BYTES, saveInvoiceRemittance } from "./portal-remittance.server";

/*
 * "I have paid this" -- with the receipt attached, from the web portal or the
 * KCPL app.
 *
 * The upload is a claim awaiting KCPL's accounts team, never a ledger entry:
 * nothing here touches what the invoice says has been paid or is owed, or its
 * status. Money is applied through the staff path, against a bank statement,
 * and a customer's own figure is a number on a form until somebody checks it.
 */

async function owned(session: PortalSession, reference: string): Promise<PortalWriteResult | { normalized: string }> {
  const normalized = reference.trim().toUpperCase();
  // Finance access is part of ownership: a login without it owns no invoice.
  if (!await portalOwnsInvoice(session, normalized)) return portalWriteRefused(404, "missing", "Invoice not found.");
  return { normalized };
}

export async function listPortalRemittances(session: PortalSession, reference: string): Promise<PortalWriteResult> {
  const invoice = await owned(session, reference);
  if ("status" in invoice) return invoice;
  const result = await listInvoiceRemittances(invoice.normalized);
  if (result.kind === "unavailable") return portalWriteRefused(503, "unavailable", "Remittance storage is unavailable.");
  return { status: 200, body: { ok: true, remittances: result.remittances } };
}

export async function receivePortalRemittance(session: PortalSession, reference: string, request: Request): Promise<PortalWriteResult> {
  const invoice = await owned(session, reference);
  if ("status" in invoice) return invoice;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return portalWriteRefused(400, "invalid", "The upload could not be read.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return portalWriteRefused(400, "invalid", "Attach the bank receipt or advice.");
  const ext = portalIntakeExtension(file.name);
  const contentType = portalIntakeExtensions[ext];
  if (!contentType) return portalWriteRefused(415, "unsupported", "Send a PDF, JPEG, PNG or WEBP file.");
  if (file.size <= 0) return portalWriteRefused(400, "invalid", "The selected file is empty.");
  if (file.size > REMITTANCE_MAX_BYTES) {
    return portalWriteRefused(413, "too_large", `Files must be ${Math.floor(REMITTANCE_MAX_BYTES / (1024 * 1024))} MB or smaller.`);
  }

  const data = await file.arrayBuffer();
  const signatureError = validateShipmentDocumentBytes(ext, new Uint8Array(data));
  if (signatureError) return portalWriteRefused(415, "unsupported", signatureError);

  const amountValue = String(form.get("amount") ?? "").trim();
  const amount = amountValue ? Number(amountValue) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    return portalWriteRefused(400, "invalid", "Enter the amount paid as a number.");
  }
  const paidOn = String(form.get("paidOn") ?? "").trim();
  if (paidOn && !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
    return portalWriteRefused(400, "invalid", "Enter the payment date as YYYY-MM-DD.");
  }

  try {
    const result = await saveInvoiceRemittance({
      invoiceReference: invoice.normalized,
      filename: file.name,
      contentType,
      sizeBytes: file.size,
      data,
      amount,
      currency: String(form.get("currency") ?? "").trim().slice(0, 3).toUpperCase() || null,
      paidOn: paidOn || null,
      note: String(form.get("note") ?? "").trim().slice(0, 1000) || null,
      uploadedByEmail: session.email,
      customerId: session.customerId,
    });

    if (result.kind === "unavailable") return portalWriteRefused(503, "unavailable", "Remittance storage is unavailable.");
    if (result.kind === "duplicate") {
      return { status: 200, body: { ok: true, duplicate: true, message: "KCPL already has this receipt for this invoice." } };
    }

    await notifyAccounts(invoice.normalized, session.customerName, amount);
    return {
      status: 201,
      body: { ok: true, message: "Sent to KCPL accounts. The invoice will update once the payment has been matched." },
    };
  } catch (error) {
    console.error("KCPL portal remittance upload failed", error);
    return portalWriteRefused(500, "failed", "The remittance could not be sent.");
  }
}

async function notifyAccounts(reference: string, customerName: string, amount: number | null) {
  try {
    const invoice = await firebaseAdminDb().collection("invoices").doc(reference).get();
    const targetEmail = typeof invoice.get("created_by_email") === "string" ? invoice.get("created_by_email") as string : "";
    if (!targetEmail.trim()) return;
    await createDirectNotification({
      targetEmail,
      category: "finance",
      severity: "info",
      title: `${customerName} sent a remittance`,
      detail: amount === null
        ? `A payment receipt arrived from the customer for ${reference}. It is a claim until accounts match it.`
        : `A payment receipt for ${amount} arrived from the customer for ${reference}. It is a claim until accounts match it.`,
      actionPath: `/admin/finance/invoices/${encodeURIComponent(reference)}`,
      parentReference: reference,
      sourceType: "operational",
      sourceId: reference,
    });
  } catch (error) {
    // A stored remittance must not fail because the nudge did not send.
    console.error("KCPL remittance notification failed", error);
  }
}
