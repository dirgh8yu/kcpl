import { invitePartnerLogin, setPartnerLoginActive } from "../../../../../partner/partner-accounts.server";
import { authorizePartnerRequest, json, rejectCrossOrigin } from "../../partner-api";

type Context = { params: Promise<{ id: string }> };

async function partnerFrom(context: Context) {
  const partnerId = decodeURIComponent((await context.params).id).trim().toUpperCase();
  return /^KCPL-P-[A-Z0-9-]+$/.test(partnerId) ? partnerId : null;
}

/** Give someone at this partner a partner portal login and email them the link to set a password. */
export async function POST(request: Request, context: Context) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const auth = await authorizePartnerRequest(true);
  if ("response" in auth) return auth.response;
  const partnerId = await partnerFrom(context);
  if (!partnerId) return json({ ok: false, error: "Partner not found." }, 404);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  try {
    const result = await invitePartnerLogin(partnerId, { email: typeof body.email === "string" ? body.email : "", name: typeof body.name === "string" ? body.name : "" }, { name: auth.user.displayName, email: auth.user.email });
    if (result.kind === "sent") return json({ ok: true, sent: true });
    // No email service set up: the link goes to staff to pass on themselves.
    if (result.kind === "link") return json({ ok: true, sent: false, link: result.link });
    const errors: Record<string, [string, number]> = {
      invalid_email: ["Enter a valid email address.", 400],
      missing: ["Partner not found.", 404],
      partner_inactive: ["This partner is inactive. Reactivate them first.", 409],
      other_partner: ["That address already has a login for another partner.", 409],
      address_in_use: ["That address is a KCPL staff or customer login. Use a different address for partner access.", 409],
    };
    const [error, status] = errors[result.kind];
    return json({ ok: false, error }, status);
  } catch (error) {
    console.error("KCPL partner invite failed", error);
    return json({ ok: false, error: "The invitation couldn’t be sent. Try again." }, 503);
  }
}

/** Switch a partner login off or back on. */
export async function PATCH(request: Request, context: Context) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const auth = await authorizePartnerRequest(true);
  if ("response" in auth) return auth.response;
  const partnerId = await partnerFrom(context);
  if (!partnerId) return json({ ok: false, error: "Partner not found." }, 404);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const result = await setPartnerLoginActive(partnerId, typeof body.email === "string" ? body.email : "", body.active === true, { name: auth.user.displayName, email: auth.user.email });
  return result.kind === "updated" ? json({ ok: true }) : json({ ok: false, error: "That login isn’t on this partner." }, 404);
}
