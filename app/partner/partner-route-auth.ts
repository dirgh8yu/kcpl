import { getPartnerAccess } from "./partner-auth";
import { isTrustedSameOriginRequest } from "../request-security";

export function partnerJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** A signed-in partner making a same-origin change, or the response that refuses them. */
export async function partnerWriteRequest(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return { ok: false as const, response: partnerJson({ ok: false, error: "Cross-origin changes are not accepted." }, 403) };
  const access = await getPartnerAccess();
  if (access.kind !== "authorized") return { ok: false as const, response: partnerJson({ ok: false, error: "Sign in again." }, 401) };
  return { ok: true as const, session: access.session };
}
