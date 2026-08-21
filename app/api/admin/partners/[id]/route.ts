import { updatePartner } from "../../../../admin/partners/partners.server";
import { canAssignPartnerOwner } from "../../../../admin/partners/partner-policy";
import { authorizePartnerRequest, json, parsePartnerInput, rejectCrossOrigin } from "../partner-api";

function duplicateLabel(reason: "name" | "tax_id" | "registration_number") {
  if (reason === "tax_id") return "tax / VAT ID";
  if (reason === "registration_number") return "registration number";
  return "name";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizePartnerRequest(true);
  if ("response" in auth) return auth.response;
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;

  const { id } = await context.params;
  const partnerId = decodeURIComponent(id).trim().toUpperCase();
  if (!/^KCPL-P-[A-Z0-9-]+$/.test(partnerId)) return json({ ok: false, error: "Partner reference is invalid." }, 400);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The partner record could not be read." }, 400);
  }

  const parsed = parsePartnerInput(body);
  if (!parsed.input) return json({ ok: false, error: parsed.error || "Partner data is invalid." }, 400);
  if (!canAssignPartnerOwner(auth.staff, auth.staff.permissions, parsed.input.ownerBranch)) {
    return json({ ok: false, error: "You cannot move this partner to Global or a KCPL branch outside your access." }, 403);
  }

  try {
    const result = await updatePartner(partnerId, parsed.input, { name: auth.user.displayName, email: auth.user.email }, auth.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Partner storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Partner record was not found." }, 404);
    if (result.kind === "forbidden") return json({ ok: false, error: "This partner is outside your KCPL branch access." }, 403);
    if (result.kind === "forbidden_owner") return json({ ok: false, error: "You cannot move this partner to Global or a KCPL branch outside your access." }, 403);
    if (result.kind === "duplicate") return json({ ok: false, code: "duplicate", error: `${result.partner.display_name} already uses this ${duplicateLabel(result.reason)} in the partner network.`, partner: result.partner, reason: result.reason }, 409);
    return json({ ok: true, partner: result.partner });
  } catch (error) {
    console.error("Failed to update KCPL partner", error);
    return json({ ok: false, error: "The partner record could not be updated." }, 500);
  }
}
