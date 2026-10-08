import { firebaseAccessToken, firebaseAdminDb, firebaseProjectId, firebaseRuntimeConfigured } from "./firebase-admin.server";
import { sendTransactionalEmail, transactionalEmailConfigured } from "./integrations/sendgrid-email.server";
import { BACKUP_STALE_HOURS, backupDestination, backupExportPrefix, opsAlertDue, opsAlertKey, opsAlertRecipients, requestErrorReportable } from "./ops-monitoring";
import type { ProductionReadinessCheck } from "./production-readiness";

const ALERTS = "system_alerts";
const BACKUPS = "system_backups";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

/** Local runs and the QA preview never email anyone. */
function alertsLive() {
  return process.env.NODE_ENV === "production" && process.env.KCPL_QA_MOCK_DATA !== "true";
}

export type OpsAlertResult = { sent: boolean; reason?: "not_live" | "no_recipient" | "email_unconfigured" | "quiet" | "send_failed" };

/**
 * Email the people named in KCPL_ALERT_EMAIL that something needs a person.
 * The same alert stays quiet for a few hours after it is sent, so one fault
 * is one email. If Firestore can't be read to check that, the alert is sent
 * anyway: an unreadable database is itself worth hearing about.
 */
export async function sendOpsAlert(key: string, subject: string, lines: string[]): Promise<OpsAlertResult> {
  console.error(`KCPL alert ${key}: ${subject}\n${lines.join("\n")}`);
  if (!alertsLive()) return { sent: false, reason: "not_live" };
  const recipients = opsAlertRecipients(process.env.KCPL_ALERT_EMAIL);
  if (!recipients.length) return { sent: false, reason: "no_recipient" };
  if (!transactionalEmailConfigured()) return { sent: false, reason: "email_unconfigured" };

  const now = new Date();
  const id = opsAlertKey(key);
  if (firebaseRuntimeConfigured()) {
    try {
      const reference = firebaseAdminDb().collection(ALERTS).doc(id);
      const due = await firebaseAdminDb().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!opsAlertDue(snapshot.get("last_sent_at") as string | undefined, now)) return false;
        transaction.set(reference, { key, subject, last_sent_at: now.toISOString(), count: (Number(snapshot.get("count")) || 0) + 1 }, { merge: true });
        return true;
      });
      if (!due) return { sent: false, reason: "quiet" };
    } catch (error) {
      console.error("KCPL alert throttle unavailable; sending anyway", error);
    }
  }

  const text = [...lines, "", `Sent ${now.toISOString()}. The same alert stays quiet for the next few hours.`].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">${lines.map((line) => `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`).join("")}<p style="margin:16px 0 0;color:#6b6b6b">Sent ${escapeHtml(now.toISOString())}. The same alert stays quiet for the next few hours.</p></div>`;
  let sent = false;
  for (const to of recipients) {
    try {
      await sendTransactionalEmail({ to, subject: `[KCPL] ${subject}`, text, html, category: "kcpl-ops-alert" });
      sent = true;
    } catch (error) {
      console.error(`KCPL alert email to ${to} failed`, error);
    }
  }
  return sent ? { sent } : { sent, reason: "send_failed" };
}

/**
 * A server error from any page or route. Only where it happened and what it
 * said: never headers or the query string, which can carry sign-in cookies
 * and tracking tokens.
 */
export async function reportRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
) {
  if (!requestErrorReportable(error)) return;
  const message = error instanceof Error ? error.message : String(error);
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : "";
  const path = request.path.split("?")[0];
  await sendOpsAlert(`request-error:${context.routePath}`, `Server error on ${context.routePath}`, [
    `${request.method} ${path} failed on the server (${context.routeType}).`,
    `Error: ${message.slice(0, 500)}`,
    ...(digest ? [`Digest: ${digest} (search the App Hosting logs for it)`] : []),
  ]);
}

type ExportOperation = { name?: string; done?: boolean; error?: { message?: string } };

async function firestoreApi(path: string, init: RequestInit = {}) {
  const token = await firebaseAccessToken();
  const response = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({})) as ExportOperation & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || `Firestore returned HTTP ${response.status}.`);
  return body;
}

export type FirestoreBackupResult =
  | { kind: "unconfigured"; reason: string }
  | { kind: "started"; operation: string; outputUriPrefix: string; previous: "completed" | "failed" | "running" | "none" }
  | { kind: "failed"; error: string };

/**
 * Settle the last export before starting the next: an export runs on
 * Google's side after this request ends, so whether it worked is only known
 * on the following run.
 */
async function settlePreviousExport(): Promise<"completed" | "failed" | "running" | "none"> {
  const latest = await firebaseAdminDb().collection(BACKUPS).orderBy("started_at", "desc").limit(1).get();
  const document = latest.docs[0];
  if (!document || document.get("status") !== "started") return "none";
  const operation = await firestoreApi(String(document.get("operation")));
  if (!operation.done) return "running";
  if (operation.error) {
    await document.ref.update({ status: "failed", error: operation.error.message ?? "Export failed.", settled_at: new Date().toISOString() });
    await sendOpsAlert("backup-failed", "The last database backup failed", [
      `The Firestore export started ${document.get("started_at")} did not finish.`,
      `Error: ${operation.error.message ?? "not given"}`,
      `Destination: ${document.get("output_uri_prefix")}`,
    ]);
    return "failed";
  }
  await document.ref.update({ status: "completed", settled_at: new Date().toISOString() });
  return "completed";
}

/** Start a full Firestore export to KCPL_BACKUP_BUCKET. */
export async function startFirestoreBackup(now = new Date()): Promise<FirestoreBackupResult> {
  const destination = backupDestination(process.env.KCPL_BACKUP_BUCKET);
  if (!destination) return { kind: "unconfigured", reason: "KCPL_BACKUP_BUCKET is not set to a Cloud Storage bucket." };
  const projectId = firebaseProjectId();
  if (!firebaseRuntimeConfigured() || !projectId) return { kind: "unconfigured", reason: "Firebase is not configured on this server." };

  const outputUriPrefix = backupExportPrefix(destination, now);
  try {
    const previous = await settlePreviousExport();
    const operation = await firestoreApi(`projects/${encodeURIComponent(projectId)}/databases/(default):exportDocuments`, {
      method: "POST",
      body: JSON.stringify({ outputUriPrefix }),
    });
    if (!operation.name) throw new Error("Firestore did not return an export operation.");
    await firebaseAdminDb().collection(BACKUPS).doc(outputUriPrefix.split("/").pop() ?? now.toISOString()).set({
      started_at: now.toISOString(),
      operation: operation.name,
      output_uri_prefix: outputUriPrefix,
      status: "started",
    });
    return { kind: "started", operation: operation.name, outputUriPrefix, previous };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The export could not be started.";
    await sendOpsAlert("backup-not-started", "The database backup could not start", [
      `A Firestore export to ${destination.uri} was refused: ${message}`,
      "Check that the App Hosting service account can export Firestore and write to the bucket (docs/backups-and-alerts.md).",
    ]);
    return { kind: "failed", error: message };
  }
}

/** When the last export finished, as a readiness line Management sees. */
export async function backupFreshnessCheck(now = new Date()): Promise<ProductionReadinessCheck> {
  const label = "Database backups";
  if (!backupDestination(process.env.KCPL_BACKUP_BUCKET)) {
    return { id: "backup-freshness", label, status: "warning", detail: "KCPL_BACKUP_BUCKET isn't set, so KCPL's own exports aren't running. See docs/backups-and-alerts.md." };
  }
  if (!firebaseRuntimeConfigured()) return { id: "backup-freshness", label, status: "warning", detail: "Firebase isn't configured, so the last backup can't be read." };
  try {
    // Ordered on one field only, so no composite index is needed; failed runs are skipped here.
    const recent = await firebaseAdminDb().collection(BACKUPS).orderBy("started_at", "desc").limit(10).get();
    const startedAt = recent.docs.find((document) => document.get("status") !== "failed")?.get("started_at") as string | undefined;
    if (!startedAt) return { id: "backup-freshness", label, status: "warning", detail: "No backup has run yet. The scheduler calls /api/internal/backup once a day." };
    const hours = (now.getTime() - Date.parse(startedAt)) / 3_600_000;
    return hours > BACKUP_STALE_HOURS
      ? { id: "backup-freshness", label, status: "warning", detail: `The last backup started ${Math.round(hours)} hours ago. The daily run looks to have stopped.` }
      : { id: "backup-freshness", label, status: "ready", detail: `The last backup started ${Math.max(0, Math.round(hours))} hours ago.` };
  } catch (error) {
    console.error("KCPL backup status unavailable", error);
    return { id: "backup-freshness", label, status: "warning", detail: "The backup record couldn't be read." };
  }
}
