import { getAdminAccess } from "../../../admin/admin-auth";
import { listEdiGatewayDashboard } from "../../../admin/edi/edi-gateway.server";
import { queueTenderAsEdi204 } from "../../../admin/edi/edi-tender.server";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { listTmsTenders } from "../../../admin/tenders/tms-tendering.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
function clean(value: unknown, max = 4000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

async function auth() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobFile) return { response: json({ ok: false, error: "Shipment execution access is required." }, 403) };
  return { user: access.user, staff };
}

export async function GET() {
  const access = await auth();
  if ("response" in access) return access.response;
  const [dashboard, tenders] = await Promise.all([listEdiGatewayDashboard(access.staff), listTmsTenders(access.staff)]);
  if (dashboard.kind !== "ready" || tenders.kind !== "ready") return json({ ok: false, error: "EDI Gateway storage is unavailable." }, 503);
  const eligibleTenders = tenders.tenders
    .filter((tender) => tender.status === "sent" && (tender.channel === "manual" || tender.channel === "edi_204"))
    .slice(0, 100);
  return json({ ok: true, ...dashboard, eligibleTenders, canQueue204: access.staff.permissions.canEditCommercial });
}

export async function POST(request: Request) {
  const access = await auth();
  if ("response" in access) return access.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin EDI staff updates are not accepted." }, 403);
  if (!access.staff.permissions.canEditCommercial) return json({ ok: false, error: "Commercial edit access is required to dispatch EDI 204 tenders." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The EDI request could not be read." }, 400); }
  const action = clean(body.action, 40);
  if (action !== "queue_204") return json({ ok: false, error: "Unknown EDI staff action." }, 400);
  const result = await queueTenderAsEdi204(
    clean(body.tenderId, 140),
    { name: access.user.displayName, email: access.user.email },
    access.staff,
  );
  if (result.kind === "unavailable") return json({ ok: false, error: "EDI storage is unavailable." }, 503);
  if (result.kind === "missing" || result.kind === "missing_order") return json({ ok: false, error: "Tender or transport order not found." }, 404);
  if (result.kind === "forbidden") return json({ ok: false, error: "You cannot dispatch a tender for this branch." }, 403);
  if (result.kind === "invalid_branch" || result.kind === "branch_mismatch" || result.kind === "partner_branch_mismatch") {
    return json({ ok: false, error: "Tender, order and partner scope is inconsistent and cannot be dispatched." }, 409);
  }
  if (result.kind === "invalid_state") return json({ ok: false, error: "Only a sent tender can be queued as EDI 204." }, 409);
  if (result.kind === "already_dispatched") return json({ ok: false, error: "This tender was already dispatched by email and cannot also be converted to EDI 204." }, 409);
  if (result.kind === "wrong_channel") return json({ ok: false, error: "This tender channel cannot be converted to EDI 204." }, 409);
  if (result.kind !== "queued" && result.kind !== "duplicate") return json({ ok: false, error: "EDI 204 could not be queued." }, 500);
  return json({ ok: true, queued: true, duplicate: result.kind === "duplicate", transactionId: result.transactionId });
}
