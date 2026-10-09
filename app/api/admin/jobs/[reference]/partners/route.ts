import { addShipmentPartner, removeShipmentPartner } from "../../../../../admin/shipment-partners.server";
import { json, jobWriteRequest } from "../../job-route-auth";

const errors: Record<string, [string, number]> = {
  missing: ["Shipment not found.", 404],
  partner_missing: ["Choose a partner from the list.", 400],
  partner_inactive: ["That partner is marked inactive. Reactivate them on their page first.", 409],
  already_added: ["That partner is already on this shipment.", 409],
  not_added: ["That partner isn’t on this shipment.", 404],
};

/** Let a partner see this shipment in the partner portal, in a role. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  const result = await addShipmentPartner(auth.reference, { partnerId: typeof auth.body.partnerId === "string" ? auth.body.partnerId : "", role: typeof auth.body.role === "string" ? auth.body.role : "" }, auth.actor);
  if (result.kind === "added") return json({ ok: true });
  const [error, status] = errors[result.kind];
  return json({ ok: false, error }, status);
}

/** Take a partner off this shipment; it leaves their portal straight away. */
export async function PATCH(request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const auth = await jobWriteRequest(request, reference);
  if (!auth.ok) return auth.response;
  const result = await removeShipmentPartner(auth.reference, typeof auth.body.partnerId === "string" ? auth.body.partnerId : "", auth.actor);
  if (result.kind === "removed") return json({ ok: true });
  const [error, status] = errors[result.kind];
  return json({ ok: false, error }, status);
}
