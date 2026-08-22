import { acknowledgeOutboundEdi, listOutboundEdiQueue } from "../../../admin/edi/edi-gateway.server";
import { ingestEdiPayloadWithTrustBoundary } from "../../../admin/edi/edi-trust-boundary.server";
import { ediMachineAuthorized } from "../../../machine-auth-policy";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: unknown, max = 4000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export const ediIntegrationAuthorized = ediMachineAuthorized;

export async function GET(request: Request) {
  const auth = ediIntegrationAuthorized(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 20)));
  const result = await listOutboundEdiQueue(limit);
  if (result.kind !== "ready") return json({ ok: false, error: "EDI queue storage is unavailable." }, 503);
  return json({ ok: true, transactionSet: "204", count: result.rows.length, messages: result.rows });
}

export async function POST(request: Request) {
  const auth = ediIntegrationAuthorized(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; }
    catch { return json({ ok: false, error: "EDI request JSON could not be read." }, 400); }
    const action = clean(body.action, 40);
    if (action === "ack_outbound") {
      const result = await acknowledgeOutboundEdi(clean(body.transactionId, 180), clean(body.externalReference, 240));
      if (result.kind === "unavailable") return json({ ok: false, error: "EDI queue storage is unavailable." }, 503);
      if (result.kind === "missing") return json({ ok: false, error: "Outbound EDI transaction not found." }, 404);
      if (result.kind === "invalid_state") return json({ ok: false, error: "Outbound EDI transaction cannot be acknowledged from its current state." }, 409);
      return json({ ok: true, status: "dispatched" });
    }
    const payload = clean(body.payload, 1_000_000);
    const partner = clean(body.partner, 180);
    const providerEventId = clean(body.providerEventId ?? body.provider_event_id, 240);
    const claimedBranch = clean(body.branch, 80);
    if (!payload) return json({ ok: false, error: "payload is required for inbound EDI." }, 400);
    return inbound(payload, partner, providerEventId, claimedBranch);
  }
  const payload = (await request.text()).trim();
  const partner = request.headers.get("x-edi-partner")?.trim() ?? "";
  const providerEventId = request.headers.get("x-edi-event-id")?.trim() ?? "";
  const claimedBranch = request.headers.get("x-edi-branch")?.trim() ?? "";
  return inbound(payload, partner, providerEventId, claimedBranch);
}

async function inbound(payload: string, partner: string, providerEventId: string, claimedBranch: string) {
  const result = await ingestEdiPayloadWithTrustBoundary(payload, partner, providerEventId || null, claimedBranch || null);
  if (result.kind === "unavailable") return json({ ok: false, error: "EDI storage is unavailable." }, 503);
  if (result.kind === "invalid") return json({ ok: false, error: result.message }, 400);
  if (result.kind === "duplicate") return json({ ok: true, duplicate: true, transactionId: result.transactionId, status: result.status });
  if (result.kind === "quarantined") return json({ ok: false, quarantined: true, transactionId: result.transactionId, transactionSet: result.transactionSet, error: result.message }, 202);
  if (result.kind === "failed") return json({ ok: false, transactionId: result.transactionId, transactionSet: result.transactionSet, error: "EDI processing failed and has been retained for review." }, 502);
  return json({ ok: true, transactionId: result.transactionId, transactionSet: result.transactionSet, result }, 201);
}
