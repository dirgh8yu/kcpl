import { createDirectNotification } from "../../../../../admin/notifications/notification-centre.server";
import { firebaseAdminDb } from "../../../../../firebase-admin.server";
import { getPortalAccess, type PortalSession } from "../../../../../portal/portal-auth";
import { portalOwnsInvoice } from "../../../../../portal/portal-data.server";
import {
  listInvoiceRemittances,
  REMITTANCE_MAX_BYTES,
  saveInvoiceRemittance,
} from "../../../../../portal/portal-remittance.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";
import { validateShipmentDocumentBytes } from "../../../../../shipment-document-policy";

/*
 * "I have paid this" -- with the receipt attached.
 *
 * The upload is a claim awaiting KCPL's accounts team, never a ledger entry:
 * nothing here writes `amount_paid`, `balance_due` or the invoice status. Money
 * is applied through the staff payments path, against a bank statement, and a
 * customer's own figure is a number on a form until somebody checks it.
 */

const allowedExtensions: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function extension(filename: string) {
  return filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

async function authorize(reference: string): Promise<{ session: PortalSession; normalized: string } | { response: Response }> {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return { response: json({ ok: false, error: "The customer portal is not configured." }, 503) };
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const normalized = reference.trim().toUpperCase();
  if (!await portalOwnsInvoice(access.session, normalized)) {
    return { response: json({ ok: false, error: "Invoice not found." }, 404) };
  }
  return { session: access.session, normalized };
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const auth = await authorize(reference);
  if ("response" in auth) return auth.response;

  const result = await listInvoiceRemittances(auth.normalized);
  if (result.kind === "unavailable") return json({ ok: false, error: "Remittance storage is unavailable." }, 503);
  return json({ ok: true, remittances: result.remittances });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const auth = await authorize(reference);
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin uploads are not accepted." }, 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "The upload could not be read." }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ ok: false, error: "Attach the bank receipt or advice." }, 400);
  const ext = extension(file.name);
  const contentType = allowedExtensions[ext];
  if (!contentType) return json({ ok: false, error: "Send a PDF, JPEG, PNG or WEBP file." }, 415);
  if (file.size <= 0) return json({ ok: false, error: "The selected file is empty." }, 400);
  if (file.size > REMITTANCE_MAX_BYTES) {
    return json({ ok: false, error: `Files must be ${Math.floor(REMITTANCE_MAX_BYTES / (1024 * 1024))} MB or smaller.` }, 413);
  }

  const data = await file.arrayBuffer();
  const signatureError = validateShipmentDocumentBytes(ext, new Uint8Array(data));
  if (signatureError) return json({ ok: false, error: signatureError }, 415);

  const amountValue = String(form.get("amount") ?? "").trim();
  const amount = amountValue ? Number(amountValue) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    return json({ ok: false, error: "Enter the amount paid as a number." }, 400);
  }
  const paidOn = String(form.get("paidOn") ?? "").trim();
  if (paidOn && !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
    return json({ ok: false, error: "Enter the payment date as YYYY-MM-DD." }, 400);
  }

  try {
    const result = await saveInvoiceRemittance({
      invoiceReference: auth.normalized,
      filename: file.name,
      contentType,
      sizeBytes: file.size,
      data,
      amount,
      currency: String(form.get("currency") ?? "").trim().slice(0, 3).toUpperCase() || null,
      paidOn: paidOn || null,
      note: String(form.get("note") ?? "").trim().slice(0, 1000) || null,
      uploadedByEmail: auth.session.email,
      customerId: auth.session.customerId,
    });

    if (result.kind === "unavailable") return json({ ok: false, error: "Remittance storage is unavailable." }, 503);
    if (result.kind === "duplicate") {
      return json({ ok: true, duplicate: true, message: "KCPL already has this receipt for this invoice." });
    }

    await notifyAccounts(auth.normalized, auth.session.customerName, amount);
    return json({
      ok: true,
      message: "Sent to KCPL accounts. The invoice will update once the payment has been matched.",
    }, 201);
  } catch (error) {
    console.error("KCPL portal remittance upload failed", error);
    return json({ ok: false, error: "The remittance could not be sent." }, 500);
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
        ? `A payment receipt arrived through the customer portal for ${reference}. It is a claim until accounts match it.`
        : `A payment receipt for ${amount} arrived through the customer portal for ${reference}. It is a claim until accounts match it.`,
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
