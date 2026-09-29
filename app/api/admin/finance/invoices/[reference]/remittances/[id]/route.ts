import { getAdminAccess } from "../../../../../../../admin/admin-auth";
import { getFinanceInvoice } from "../../../../../../../admin/finance/finance.server";
import { getStaffContext } from "../../../../../../../admin/staff-directory.server";
import { acknowledgeInvoiceRemittance, invoiceRemittanceFile } from "../../../../../../../portal/portal-remittance.server";
import { isTrustedSameOriginRequest } from "../../../../../../../request-security";

/*
 * A customer's payment receipt, from the accounts side: open the file, or
 * mark it seen. The customer's portal and app read the same record, so an
 * acknowledgement here is what they see as "Acknowledged".
 */

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Finance access and the invoice's branch, exactly as the invoice page checks them. */
async function authorize(reference: string) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return { response: json({ ok: false, error: "Finance access is restricted to Management and Accounts." }, 403) };
  const invoice = await getFinanceInvoice(reference, staff);
  if (invoice.kind === "missing") return { response: json({ ok: false, error: "Invoice not found." }, 404) };
  if (invoice.kind === "forbidden") return { response: json({ ok: false, error: "This invoice is outside your finance or branch access." }, 403) };
  if (invoice.kind === "relationship_mismatch") return { response: json({ ok: false, error: "This invoice has an incompatible customer or shipment relationship." }, 409) };
  if (invoice.kind === "unavailable") return { response: json({ ok: false, error: "Finance storage is unavailable." }, 503) };
  return { user: access.user, invoice: invoice.invoice };
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const { reference, id } = await context.params;
  const normalized = reference.trim().toUpperCase();
  const auth = await authorize(normalized);
  if ("response" in auth) return auth.response;
  try {
    const result = await invoiceRemittanceFile(normalized, id);
    if (result.kind === "unavailable") return json({ ok: false, error: "Remittance storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Remittance not found." }, 404);
    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "content-type": result.remittance.content_type || "application/octet-stream",
        "content-length": String(result.bytes.length),
        "content-disposition": contentDisposition(result.remittance.filename),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'",
      },
    });
  } catch (error) {
    console.error("KCPL admin remittance download failed", error);
    return json({ ok: false, error: "The remittance could not be downloaded." }, 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin finance updates are not accepted." }, 403);
  const { reference, id } = await context.params;
  const normalized = reference.trim().toUpperCase();
  const auth = await authorize(normalized);
  if ("response" in auth) return auth.response;
  try {
    const result = await acknowledgeInvoiceRemittance(normalized, id, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return json({ ok: false, error: "Remittance storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Remittance not found." }, 404);
    return json({ ok: true, idempotent: result.kind === "idempotent" });
  } catch (error) {
    console.error("KCPL remittance acknowledgement failed", error);
    return json({ ok: false, error: "The receipt could not be acknowledged." }, 500);
  }
}
