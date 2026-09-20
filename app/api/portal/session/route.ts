import {
  authorizePortalIdentity,
  clearPortalCustomerCookie,
  clearPortalSessionCookie,
  portalDenialMessage,
  portalRuntimeConfigured,
  portalSessionCookie,
  PORTAL_SESSION_TTL_MS,
} from "../../../portal/portal-auth";
import { recordPortalSignIn } from "../../../portal/portal-accounts.server";
import { firebaseAdminAuth } from "../../../firebase-admin.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return json({ ok: false, error: "Cross-origin sign-in is not accepted." }, 403);
  }
  if (!portalRuntimeConfigured()) {
    return json({ ok: false, error: "The KCPL customer portal is not configured." }, 503);
  }

  let idToken = "";
  try {
    const body = await request.json() as { idToken?: unknown };
    idToken = typeof body.idToken === "string" ? body.idToken : "";
  } catch {
    return json({ ok: false, error: "The sign-in token could not be read." }, 400);
  }
  if (!idToken) return json({ ok: false, error: "Sign in again and retry." }, 400);

  try {
    const auth = firebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);

    // A session cookie must be minted from a fresh sign-in, not from a token
    // that has been sitting in a client for hours.
    const authTime = Number(decoded.auth_time ?? 0) * 1000;
    if (!authTime || Date.now() - authTime > 5 * 60 * 1000) {
      return json({ ok: false, error: "Recent sign-in is required. Please sign in again." }, 401);
    }

    const result = await authorizePortalIdentity({
      uid: decoded.uid,
      email: decoded.email ?? "",
      emailVerified: decoded.email_verified === true,
    });
    if (result.kind === "unavailable") {
      return json({ ok: false, error: "Customer portal storage is unavailable. Please try again shortly." }, 503);
    }
    if (result.kind === "denied") {
      // The reason stays server-side; the caller gets the generic message.
      console.warn("KCPL portal sign-in refused", { reason: result.reason });
      return json({ ok: false, error: portalDenialMessage(result.reason) }, 403);
    }

    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: PORTAL_SESSION_TTL_MS });
    await recordPortalSignIn(result.session.email);
    return json({ ok: true }, 200, { "set-cookie": portalSessionCookie(sessionCookie) });
  } catch (error) {
    console.error("KCPL portal sign-in failed", error);
    return json({ ok: false, error: "Sign-in could not be verified." }, 401);
  }
}

export async function GET(request: Request) {
  // Both cookies, so the next person at a shared browser inherits neither the
  // session nor the customer an agent happened to be looking at.
  const headers = new Headers({ location: new URL("/portal", request.url).toString() });
  headers.append("set-cookie", clearPortalSessionCookie());
  headers.append("set-cookie", clearPortalCustomerCookie());
  return new Response(null, { status: 303, headers });
}
