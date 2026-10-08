/*
 * Backups and alerts, the parts with no Firebase or network in them, so the
 * rules can be tested and the readiness check can share them.
 */

const BUCKET_NAME = /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/;

/**
 * Where Firestore exports go, from KCPL_BACKUP_BUCKET: "gs://bucket" or
 * "gs://bucket/folder", or the bare bucket name. Null when unset or not a
 * bucket a Google export can write to.
 */
export function backupDestination(value: string | undefined | null) {
  const raw = (value ?? "").trim().replace(/^gs:\/\//, "").replace(/\/+$/, "");
  if (!raw) return null;
  const [bucket, ...rest] = raw.split("/");
  if (!BUCKET_NAME.test(bucket) || bucket.includes("..")) return null;
  const folder = rest.filter(Boolean).join("/");
  return { bucket, folder, uri: `gs://${bucket}${folder ? `/${folder}` : ""}` };
}

/** One folder per export, named by when it started, so runs never overwrite each other. */
export function backupExportPrefix(destination: { uri: string }, now: Date) {
  const stamp = now.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
  return `${destination.uri}/firestore/${stamp}`;
}

/** KCPL_ALERT_EMAIL: one address or several separated by commas. Invalid entries are dropped. */
export function opsAlertRecipients(value: string | undefined | null) {
  return (value ?? "").split(",").map((item) => item.trim()).filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}

/** How long the same alert stays quiet after it is sent, so one fault is one email, not one per request. */
export const OPS_ALERT_QUIET_HOURS = 6;

export function opsAlertDue(lastSentAt: string | null | undefined, now: Date, quietHours = OPS_ALERT_QUIET_HOURS) {
  if (!lastSentAt) return true;
  const last = Date.parse(lastSentAt);
  return !Number.isFinite(last) || now.getTime() - last >= quietHours * 3_600_000;
}

/** Firestore document ids can't hold "/", and alert keys are often route paths. */
export function opsAlertKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120) || "alert";
}

/**
 * Whether a server error is a fault worth telling someone about. Next.js
 * signals redirects and not-found pages by throwing; those are working as
 * meant.
 */
export function requestErrorReportable(error: unknown) {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : "";
  return !/^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/.test(digest);
}

/** A Nepal PAN is nine digits. */
export function companyPanValid(value: string | undefined | null) {
  return /^\d{9}$/.test((value ?? "").trim());
}

/** A backup older than this reads as missed: the schedule is daily, with a few hours' grace. */
export const BACKUP_STALE_HOURS = 36;
