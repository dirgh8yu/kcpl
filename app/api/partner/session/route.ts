import { authorizePartnerIdentity, clearPartnerSessionCookie, partnerRuntimeConfigured, partnerSessionCookie, PARTNER_SESSION_TTL_MS } from "../../../partner/partner-auth";
import { firebaseAdminAuth } from "../../../firebase-admin.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

/** A fresh Firebase sign-in, exchanged for the partner portal's session cookie when the address has a partner login. */
export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin sign-in is not accepted." }, 403);
  if (!partnerRuntimeConfigured()) return json({ ok: false, error: "The KCPL partner portal is not configured." }, 503);
  let idToken = "";
  try { const body = await request.json() as { idToken?: unknown }; idToken = typeof body.idToken === "string" ? body.idToken : ""; }
  catch { return json({ ok: false, error: "The sign-in token could not be read." }, 400); }
  if (!idToken) return json({ ok: false, error: "Sign in again and retry." }, 400);
  try {
    const auth = firebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    const authTime = Number(decoded.auth_time ?? 0) * 1000;
    if (!authTime || Date.now() - authTime > 5 * 60 * 1000) return json({ ok: false, error: "Recent sign-in is required. Please sign in again." }, 401);
    const result = await authorizePartnerIdentity({ uid: decoded.uid, email: decoded.email ?? "", emailVerified: decoded.email_verified === true, name: decoded.name }, true);
    if (result.kind !== "authorized") {
      console.warn("KCPL partner sign-in refused", { reason: result.reason });
      // Deliberately vague: the reason stays in the log.
      return json({ ok: false, error: result.reason === "unverified" ? "Open the invitation email and set your password first; that confirms your address." : "This login doesn’t have KCPL partner access. Ask your KCPL contact." }, 403);
    }
    const cookie = await auth.createSessionCookie(idToken, { expiresIn: PARTNER_SESSION_TTL_MS });
    return json({ ok: true }, 200, { "set-cookie": partnerSessionCookie(cookie) });
  } catch (error) {
    console.error("KCPL partner sign-in failed", error);
    return json({ ok: false, error: "Your sign-in couldn’t be confirmed. Sign in again." }, 401);
  }
}

export async function GET(request: Request) {
  return new Response(null, { status: 303, headers: { location: new URL("/partner", request.url).toString(), "set-cookie": clearPartnerSessionCookie() } });
}
