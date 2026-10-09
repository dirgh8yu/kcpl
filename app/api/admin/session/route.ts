import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  adminSessionCookie,
  clearAdminSessionCookie,
  firebaseAdminConfigured,
  isAuthorizedAdminUser,
} from "../../../admin/admin-auth";
import { endTwoStepSession } from "../../../admin/two-step.server";
import { firebaseAdminAuth } from "../../../firebase-admin.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function redirectTo(request: Request, path: string, cookie?: string) {
  const headers = new Headers({ location: new URL(path, request.url).toString() });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return Response.json({ ok: false, error: "Cross-origin sign-in is not accepted." }, { status: 403 });
  }
  if (!firebaseAdminConfigured()) {
    return Response.json({ ok: false, error: "The server isn’t set up to sign staff in yet. Ask Management." }, { status: 503 });
  }

  let idToken = "";
  try {
    const body = await request.json() as { idToken?: unknown };
    idToken = typeof body.idToken === "string" ? body.idToken : "";
  } catch {
    return Response.json({ ok: false, error: "The sign-in token could not be read." }, { status: 400 });
  }
  if (!idToken) return Response.json({ ok: false, error: "Sign in again and retry." }, { status: 400 });

  try {
    const auth = firebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    if (!await isAuthorizedAdminUser(decoded.uid, decoded.email)) {
      return Response.json({ ok: false, error: "This account isn’t a KCPL staff account." }, { status: 403 });
    }

    const authTime = Number(decoded.auth_time ?? 0) * 1000;
    if (!authTime || Date.now() - authTime > 5 * 60 * 1000) {
      return Response.json({ ok: false, error: "Recent sign-in is required. Please sign in again." }, { status: 401 });
    }

    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: ADMIN_SESSION_TTL_MS });
    return Response.json(
      { ok: true },
      { headers: { "cache-control": "no-store", "set-cookie": adminSessionCookie(sessionCookie) } },
    );
  } catch (error) {
    console.error("Firebase KCPL admin sign-in failed", error);
    return Response.json({ ok: false, error: "Your sign-in couldn’t be confirmed. Sign in again." }, { status: 401 });
  }
}

export async function GET(request: Request) {
  // The second-step pass belongs to this session and ends with it.
  const session = request.headers.get("cookie")?.split(/;\s*/).find((item) => item.startsWith(`${ADMIN_SESSION_COOKIE}=`))?.slice(ADMIN_SESSION_COOKIE.length + 1);
  if (session && firebaseAdminConfigured()) await endTwoStepSession(session);
  return redirectTo(request, "/", clearAdminSessionCookie());
}
