import {
  adminSessionCookie,
  clearAdminSessionCookie,
  createAdminSessionToken,
  verifyAdminPassword,
} from "../../../admin/admin-auth";

function redirectTo(request: Request, path: string, cookie?: string) {
  const headers = new Headers({ location: new URL(path, request.url).toString() });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ ok: false, error: "Cross-origin sign-in is not accepted." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let password = "";

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json() as { password?: unknown };
      password = typeof body.password === "string" ? body.password : "";
    } else {
      const form = await request.formData();
      const value = form.get("password");
      password = typeof value === "string" ? value : "";
    }
  } catch {
    return redirectTo(request, "/admin?auth=failed");
  }

  const result = await verifyAdminPassword(password);
  if (result.kind === "unconfigured") {
    return Response.json({ ok: false, error: "Admin login is not configured." }, { status: 503 });
  }
  if (result.kind === "invalid") {
    return redirectTo(request, "/admin?auth=failed");
  }

  const token = await createAdminSessionToken(result.sessionSecret);
  return redirectTo(request, "/admin", adminSessionCookie(token));
}

export async function GET(request: Request) {
  return redirectTo(request, "/", clearAdminSessionCookie());
}
