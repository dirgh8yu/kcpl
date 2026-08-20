import { createPartner, listPartnerDashboard } from "../../../admin/partners/partners.server";
import { authorizePartnerRequest, json, parsePartnerInput, rejectCrossOrigin } from "./partner-api";

export async function GET() {
  const auth = await authorizePartnerRequest(false);
  if ("response" in auth) return auth.response;
  try {
    const dashboard = await listPartnerDashboard();
    if (!dashboard) return json({ ok: false, error: "Partner storage is unavailable." }, 503);
    return json({ ok: true, dashboard });
  } catch (error) {
    console.error("Failed to list KCPL partners", error);
    return json({ ok: false, error: "Partner records could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await authorizePartnerRequest(true);
  if ("response" in auth) return auth.response;
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The partner record could not be read." }, 400);
  }

  const parsed = parsePartnerInput(body);
  if (!parsed.input) return json({ ok: false, error: parsed.error || "Partner data is invalid." }, 400);

  try {
    const result = await createPartner(parsed.input, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "unavailable") return json({ ok: false, error: "Partner storage is unavailable." }, 503);
    if (result.kind === "duplicate") return json({ ok: false, code: "duplicate", error: `${result.partner.display_name} already exists in the partner network.`, partner: result.partner }, 409);
    return json({ ok: true, partner: result.partner }, 201);
  } catch (error) {
    console.error("Failed to create KCPL partner", error);
    return json({ ok: false, error: "The partner record could not be created." }, 500);
  }
}
