import { updatePartner } from "../../../../admin/partners/partners.server";
import { authorizePartnerRequest, json, parsePartnerInput, rejectCrossOrigin } from "../partner-api";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizePartnerRequest(true);
  if ("response" in auth) return auth.response;
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;

  const { id } = await context.params;
  const partnerId = decodeURIComponent(id).trim();
  if (!/^KCPL-P-[A-Z0-9-]+$/i.test(partnerId)) return json({ ok: false, error: "Partner reference is invalid." }, 400);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The partner record could not be read." }, 400);
  }

  const parsed = parsePartnerInput(body);
  if (!parsed.input) return json({ ok: false, error: parsed.error || "Partner data is invalid." }, 400);

  try {
    const result = await updatePartner(partnerId, parsed.input, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return json({ ok: false, error: "Partner storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Partner record was not found." }, 404);
    if (result.kind === "duplicate") return json({ ok: false, code: "duplicate", error: `${result.partner.display_name} already exists in the partner network.`, partner: result.partner }, 409);
    return json({ ok: true, partner: result.partner });
  } catch (error) {
    console.error("Failed to update KCPL partner", error);
    return json({ ok: false, error: "The partner record could not be updated." }, 500);
  }
}
