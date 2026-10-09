import { postPartnerMilestone } from "../../../../../partner/partner-data.server";
import { partnerJson, partnerWriteRequest } from "../../../../../partner/partner-route-auth";

/** A partner posts where the shipment is. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await partnerWriteRequest(request);
  if (!auth.ok) return auth.response;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return partnerJson({ ok: false, error: "The milestone could not be read." }, 400); }
  const field = (key: string) => typeof body[key] === "string" ? body[key] as string : "";
  const { reference } = await context.params;
  const result = await postPartnerMilestone(auth.session, decodeURIComponent(reference), { title: field("title"), location: field("location"), details: field("details"), eventTime: field("eventTime") });
  if (result.kind === "created") return partnerJson({ ok: true });
  if (result.kind === "missing") return partnerJson({ ok: false, error: "That shipment isn’t shared with you." }, 404);
  if (result.kind === "title_required") return partnerJson({ ok: false, error: "Say what happened." }, 400);
  if (result.kind === "invalid_time") return partnerJson({ ok: false, error: "Enter when it happened, not a future time." }, 400);
  return partnerJson({ ok: false, error: "The milestone couldn’t be saved. Try again." }, 503);
}
