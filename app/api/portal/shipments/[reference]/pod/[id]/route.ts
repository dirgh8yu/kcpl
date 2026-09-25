import { getPortalAccess } from "../../../../../../portal/portal-auth";
import { portalProofOfDeliveryFile } from "../../../../../../portal/portal-proof-of-delivery.server";

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** A signature or photo from a verified delivery, for the portal's shipment
 * page: the customer's own shipment and only what KCPL shared. */
export async function GET(_request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  const { reference, id } = await context.params;
  const file = await portalProofOfDeliveryFile(access.session, reference, id);
  if (file.kind === "unavailable") return json({ ok: false, error: "Proof of delivery is not available just now." }, 503);
  if (file.kind === "missing") return json({ ok: false, error: "Not found." }, 404);
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.bytes.length),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": file.contentType === "application/octet-stream" ? "attachment" : "inline",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
