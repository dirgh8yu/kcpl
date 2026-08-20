import {
  ADMIN_SESSION_TTL_MS,
  adminSessionCookie,
  clearAdminSessionCookie,
  firebaseAdminConfigured,
  isAllowedAdminEmail,
} from "../../../admin/admin-auth";
import { firebaseAdminAuth } from "../../../firebase-admin.server";

function redirectTo(request: Request, path: string, cookie?: string) {
  const headers = new Headers({ location: new URL(path, request.url).toString() });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function sameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const candidates = [
      firstForwardedValue(request.headers.get("x-forwarded-host")),
      request.headers.get("host") ?? "",
      new URL(request.url).host,
    ]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    return candidates.includes(originHost);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ ok: false, error: "Cross-origin sign-in is not accepted." }, { status: 403 });
  }
  if (!firebaseAdminConfigured()) {
    return Response.json({ ok: false, error: "Firebase admin access is not configured." }, { status: 503 });
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
    if (!isAllowedAdminEmail(decoded.email)) {
      return Response.json({ ok: false, error: "This Firebase account is not authorised for KCPL Operations." }, { status: 403 });
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
    return Response.json({ ok: false, error: "Firebase sign-in could not be verified." }, { status: 401 });
  }
}

export async function GET(request: Request) {
  return redirectTo(request, "/", clearAdminSessionCookie());
}
