import { getPortalAccess } from "../../../../../../portal/portal-auth";
import { portalOwnsInvoice } from "../../../../../../portal/portal-data.server";
import { invoiceRemittanceFile } from "../../../../../../portal/portal-remittance.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** A customer re-downloading their own receipt. Ownership of the invoice is
 * checked first, and the stored remittance must itself belong to that customer,
 * so a shared invoice reference cannot expose another account's attachment. */
export async function GET(_request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);

  const { reference, id } = await context.params;
  const normalized = reference.trim().toUpperCase();
  if (!await portalOwnsInvoice(access.session, normalized)) return json({ ok: false, error: "Remittance not found." }, 404);

  try {
    const result = await invoiceRemittanceFile(normalized, id);
    if (result.kind === "unavailable") return json({ ok: false, error: "Remittance storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Remittance not found." }, 404);
    if (result.customerId && result.customerId !== access.session.customerId) {
      return json({ ok: false, error: "Remittance not found." }, 404);
    }

    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "content-type": result.remittance.content_type || "application/octet-stream",
        "content-length": String(result.remittance.size_bytes),
        "content-disposition": contentDisposition(result.remittance.filename),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("KCPL portal remittance download failed", error);
    return json({ ok: false, error: "The remittance could not be downloaded." }, 500);
  }
}
