import { automationMachineAuthorized } from "../../../machine-auth-policy";
import { startFirestoreBackup } from "../../../ops-monitoring.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Starts a full Firestore export to KCPL_BACKUP_BUCKET. Called once a day by
 * Cloud Scheduler with the same bearer secret as the automation run; see
 * docs/backups-and-alerts.md.
 */
export async function POST(request: Request) {
  const auth = automationMachineAuthorized(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);
  const result = await startFirestoreBackup();
  if (result.kind === "unconfigured") return json({ ok: false, error: result.reason }, 503);
  if (result.kind === "failed") return json({ ok: false, error: "The backup could not be started." }, 502);
  return json({ ok: true, operation: result.operation, outputUriPrefix: result.outputUriPrefix, previous: result.previous });
}
