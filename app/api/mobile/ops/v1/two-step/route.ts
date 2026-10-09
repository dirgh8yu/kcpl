import { getAdminAccessFromBearer } from "../../../../../admin/admin-auth";
import { opsJson } from "../../../../../admin/ops-mobile-api.server";
import { TWO_STEP_TRUST_MS } from "../../../../../admin/two-step-policy";
import { verifyTwoStep } from "../../../../../admin/two-step.server";

/**
 * The Ops app's second step: a code from the authenticator app (or a
 * recovery code) for a device token the app sends with every request as
 * x-kcpl-two-step. Setting the authenticator up is done once on the web.
 */
export async function POST(request: Request) {
  const access = await getAdminAccessFromBearer(request);
  if (access.kind === "authorized") return opsJson({ ok: true, required: false });
  if (access.kind === "unconfigured") return opsJson({ ok: false, code: "unconfigured", error: "KCPL Operations is not configured." }, 503);
  if (access.kind !== "two-step") return opsJson({ ok: false, code: "signed_out", error: "Sign in is required." }, 401);
  if (access.step === "enrol") return opsJson({ ok: false, code: "two_step_enrol_on_web", error: "Set up two-step sign-in on the KCPL Operations website first, then sign in here." }, 409);
  let code: unknown;
  try { code = ((await request.json()) as Record<string, unknown>).code; }
  catch { return opsJson({ ok: false, code: "bad_request", error: "The request could not be read." }, 400); }
  try {
    const result = await verifyTwoStep(access.pending.uid, code, { sessionToken: null, trustDevice: true, sessionTtlMs: 0, deviceLabel: request.headers.get("user-agent") ?? "KCPL Ops app" });
    if (result.kind === "verified" && result.deviceToken) return opsJson({ ok: true, deviceToken: result.deviceToken, expiresInDays: Math.round(TWO_STEP_TRUST_MS / 86_400_000), recoveryLeft: result.recoveryLeft });
    if (result.kind === "locked") return opsJson({ ok: false, code: "locked", error: "Too many wrong codes. Wait 15 minutes, then try again." }, 429);
    // A wrong code is a 400, not a 401: the app reads 401 as an expired sign-in and refreshes it.
    if (result.kind === "reused") return opsJson({ ok: false, code: "reused", error: "That code has just been used. Wait for the next one." }, 400);
    if (result.kind === "format") return opsJson({ ok: false, code: "format", error: "Enter the 6 digits from the app, or a recovery code." }, 400);
    return opsJson({ ok: false, code: "wrong", error: "That code isn’t right. Use the newest code in the app." }, 400);
  } catch (error) {
    console.error("KCPL ops two-step failed", error);
    return opsJson({ ok: false, code: "unavailable", error: "Two-step sign-in isn’t available right now." }, 503);
  }
}
