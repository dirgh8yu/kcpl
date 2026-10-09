import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_MS, getAdminAccess, trustedDeviceCookie } from "../../../admin/admin-auth";
import { TWO_STEP_TRUST_MS } from "../../../admin/two-step-policy";
import { confirmTwoStepEnrolment, startTwoStepEnrolment, verifyTwoStep } from "../../../admin/two-step.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200, cookie?: string) {
  const headers = new Headers({ "cache-control": "no-store" });
  if (cookie) headers.set("set-cookie", cookie);
  return Response.json(body, { status, headers });
}

function lockedMessage(until: string) {
  const time = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kathmandu" }).format(new Date(until));
  return `Too many wrong codes. Try again after ${time}.`;
}

const codeErrors: Record<string, [string, number]> = {
  format: ["Enter the 6 digits from the app, or one of your recovery codes.", 400],
  wrong: ["That code isn’t right. Use the newest code in the app, and check your phone sets its time automatically.", 401],
  reused: ["That code has just been used. Wait for the next one.", 401],
  not_started: ["Start again: reload this page to get the code to scan.", 409],
  already_enrolled: ["Two-step sign-in is already on for this account. Reload the page.", 409],
  not_enrolled: ["Two-step sign-in isn’t set up yet. Reload the page to set it up.", 409],
};

/**
 * The second step at sign-in, for a browser that has passed the password
 * step: start setting up the authenticator, confirm it, or check a code. The
 * pass is tied to this browser's session; ticking "trust this browser" also
 * sets a 30-day cookie.
 */
export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin sign-in is not accepted." }, 403);
  const access = await getAdminAccess();
  if (access.kind === "authorized") return json({ ok: true, done: true });
  if (access.kind !== "two-step") return json({ ok: false, error: "Sign in again." }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const action = typeof body.action === "string" ? body.action : "";
  const session = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value ?? "";
  const pass = {
    sessionToken: session || null,
    trustDevice: body.trust === true,
    sessionTtlMs: ADMIN_SESSION_TTL_MS,
    deviceLabel: request.headers.get("user-agent") ?? "",
  };
  const user = access.pending;

  try {
    if (action === "start") {
      if (access.step !== "enrol") return json({ ok: false, error: codeErrors.already_enrolled[0] }, 409);
      const started = await startTwoStepEnrolment(user.uid, user.email);
      if (started.kind !== "started") return json({ ok: false, error: codeErrors.already_enrolled[0] }, 409);
      return json({ ok: true, secret: started.secret, uri: started.uri, qrSvg: started.qrSvg });
    }
    const result = action === "confirm" && access.step === "enrol"
      ? await confirmTwoStepEnrolment(user.uid, body.code, pass)
      : action === "verify" && access.step === "verify"
        ? await verifyTwoStep(user.uid, body.code, pass)
        : null;
    if (!result) return json({ ok: false, error: "Reload the page and try again." }, 409);
    const cookie = "deviceToken" in result && result.deviceToken ? trustedDeviceCookie(result.deviceToken, TWO_STEP_TRUST_MS) : undefined;
    if (result.kind === "enrolled") return json({ ok: true, recoveryCodes: result.recoveryCodes }, 200, cookie);
    if (result.kind === "verified") return json({ ok: true, usedRecovery: result.usedRecovery, recoveryLeft: result.recoveryLeft }, 200, cookie);
    if (result.kind === "locked") return json({ ok: false, error: lockedMessage(result.until) }, 429);
    const [error, status] = codeErrors[result.kind] ?? ["That didn’t work. Try again.", 400];
    return json({ ok: false, error }, status);
  } catch (error) {
    console.error("KCPL two-step failed", error);
    return json({ ok: false, error: "Two-step sign-in isn’t available right now. Try again in a minute." }, 503);
  }
}
