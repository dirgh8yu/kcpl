import { getAdminAccess } from "../../../admin/admin-auth";
import { evaluateAutomationRules, listAutomationAlerts, updateAutomationAlert } from "../../../admin/alerts/alert-engine.server";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  return { user: access.user, staff };
}

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const alerts = await listAutomationAlerts(auth.staff, auth.user.email);
  if (!alerts) return json({ ok: false, error: "Alert storage is unavailable." }, 503);
  return json({ ok: true, alerts });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin alert actions are not accepted." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The alert action could not be read." }, 400); }
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "evaluate") {
    const result = await evaluateAutomationRules();
    if (result.kind !== "completed") return json({ ok: false, error: "Automation storage is unavailable." }, 503);
    return json({ ok: true, result });
  }

  if (action === "acknowledge" || action === "resolve") {
    const alertId = typeof body.alertId === "string" ? body.alertId.trim() : "";
    if (!alertId) return json({ ok: false, error: "Alert not found." }, 404);
    const result = await updateAutomationAlert(
      alertId,
      action === "acknowledge" ? "acknowledged" : "resolved",
      { name: auth.user.displayName, email: auth.user.email },
      auth.staff,
    );
    if (result.kind === "missing") return json({ ok: false, error: "Alert not found." }, 404);
    if (result.kind === "forbidden") return json({ ok: false, error: "This alert is outside your access." }, 403);
    if (result.kind !== "updated") return json({ ok: false, error: "Alert storage is unavailable." }, 503);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Choose a valid alert action." }, 400);
}
