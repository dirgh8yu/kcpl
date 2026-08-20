import { evaluateAutomationRules } from "../../../admin/alerts/alert-engine.server";

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
  const result = await evaluateAutomationRules();
  if (result.kind !== "completed") return json({ ok: false, error: "Automation storage is unavailable." }, 503);
  return json({ ok: true, result });
}
