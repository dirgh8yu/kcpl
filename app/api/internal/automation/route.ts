import { timingSafeEqual } from "node:crypto";
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

export function automationIntegrationAuthorized(request: Request) {
  const configured = process.env.KCPL_AUTOMATION_SECRET?.trim() ?? "";
  if (!configured) return { ok: false as const, status: 503, error: "Automation scheduler authentication is not configured." };
  const supplied = bearer(request);
  if (!supplied) return { ok: false as const, status: 401, error: "Automation authentication failed." };
  const configuredBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  if (configuredBuffer.length !== suppliedBuffer.length || !timingSafeEqual(configuredBuffer, suppliedBuffer)) {
    return { ok: false as const, status: 401, error: "Automation authentication failed." };
  }
  return { ok: true as const };
}

export async function POST(request: Request) {
  const auth = automationIntegrationAuthorized(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
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
        notification_emails_sent: (alertEmails.sent ?? 0) + assignmentEmails.sent,
      },
    });
  } catch (error) {
    console.error("KCPL scheduled automation failed", error);
    return json({ ok: false, error: "Automation checks could not be completed." }, 500);
  }
}
