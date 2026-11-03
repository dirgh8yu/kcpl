import { partnerTenderResponseError, respondToPartnerTender } from "../../../../../partner/partner-tenders.server";
import { partnerTenderAction } from "../../../../../partner/partner-tenders";
import { partnerJson, partnerWriteRequest } from "../../../../../partner/partner-route-auth";

/** A carrier accepts, declines or counters a tender KCPL sent to it. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await partnerWriteRequest(request);
  if (!auth.ok) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return partnerJson({ ok: false, error: "The response could not be read." }, 400);
  }
  const action = partnerTenderAction(body.action);
  if (!action) return partnerJson({ ok: false, error: "Choose accept, decline or counter." }, 400);
  const { id } = await context.params;
  const result = await respondToPartnerTender(auth.session, decodeURIComponent(id), action, body);
  if (result.kind === "updated") {
    return partnerJson({ ok: true, tender: result.tender, idempotent: result.idempotent === true });
  }
  const status = result.kind === "missing" ? 404
    : result.kind === "forbidden" ? 403
    : result.kind === "invalid_counter" ? 400
    : result.kind === "rate_limited" ? 429
    : result.kind === "expired" ? 409
    : result.kind === "unavailable" ? 503
    : 409;
  return partnerJson({ ok: false, code: result.kind, error: partnerTenderResponseError(result.kind) }, status);
}
