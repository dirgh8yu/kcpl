import { mobileJson, mobileMissing, withMobileSession } from "../../../../../../../portal/portal-mobile-api.server";
import { portalProofOfDeliveryFile } from "../../../../../../../portal/portal-proof-of-delivery.server";

/** A signature or photo from a verified delivery, for the KCPL app: the
 * portal's gates (portal-proof-of-delivery.server.ts). */
export async function GET(request: Request, context: { params: Promise<{ reference: string; id: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference, id } = await context.params;
    const file = await portalProofOfDeliveryFile(session, reference, id);
    if (file.kind === "unavailable") return mobileJson({ ok: false, code: "unavailable", error: "Proof of delivery is not available just now." }, 503);
    if (file.kind === "missing") return mobileMissing("Proof of delivery");
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "content-type": file.contentType,
        "content-length": String(file.bytes.length),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });
}
