import { evaluateAutomationRules } from "../../../admin/alerts/alert-engine.server";
import { evaluateFreightAutomation } from "../../../admin/alerts/freight-automation.server";
import { dispatchAllAssignmentEmails } from "../../../admin/notifications/assignment-email.server";
import { dispatchPendingAlertEmails } from "../../../admin/notifications/notification-email.server";
import { evaluatePayablesAlerts } from "../../../admin/payables/payables-alerts.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function bearer(request: Request) {
  const value = request.headers.get("authorization")?.trim() ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

export async function POST(request: Request) {
  const configured = process.env.KCPL_AUTOMATION_SECRET?.trim() ?? "";
  if (!configured) return json({ ok: false, error: "Automation scheduler authentication is not configured." }, 503);
  if (bearer(request) !== configured) return json({ ok: false, error: "Automation authentication failed." }, 401);
  try {
    const [result, payables, freight] = await Promise.all([
      evaluateAutomationRules(),
      evaluatePayablesAlerts(),
      evaluateFreightAutomation(),
    ]);
    if (result.kind !== "completed" || payables.kind !== "completed" || freight.kind !== "completed") return json({ ok: false, error: "Automation storage is unavailable." }, 503);
    const [alertEmails, assignmentEmails] = await Promise.all([
      dispatchPendingAlertEmails(),
      dispatchAllAssignmentEmails(),
    ]);
    return json({
      ok: true,
      result: {
        ...result,
        payable_alerts: payables.active,
        freight_alerts: freight.active,
        automatic_tasks_created: freight.tasks_created,
        automatic_tasks_reopened: freight.tasks_reopened,
        automatic_tasks_completed: freight.tasks_auto_completed,
        notification_emails_sent: alertEmails.sent + assignmentEmails.sent,
      },
    });
  } catch (error) {
    console.error("KCPL scheduled automation failed", error);
    return json({ ok: false, error: "Automation checks could not be completed." }, 500);
  }
}