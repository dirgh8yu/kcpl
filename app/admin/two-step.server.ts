import QRCode from "qrcode";
import { firebaseAdminDb } from "../firebase-admin.server";
import {
  TWO_STEP_TRUST_MS,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  newRecoveryCodes,
  newTwoStepSecret,
  newTwoStepToken,
  otpauthUri,
  twoStepLockedUntil,
  twoStepTokenKey,
  verifyTotp,
} from "./two-step-policy";

/*
 * Two-step sign-in records. Server-only collections (the rules refuse every
 * client): the person's secret and recovery-code hashes, the browser sessions
 * that have passed the second step, and the devices trusted for 30 days.
 * Sessions and devices are stored under the hash of their token, never the
 * token, and carry the enrolment they were made under, so a reset ends them.
 */

const ENROLMENTS = "staff_two_step";
const SESSIONS = "staff_two_step_sessions";
const DEVICES = "staff_two_step_devices";
/** The QR code stays the same if the page is reloaded within this time. */
const PENDING_MS = 15 * 60 * 1000;

export type TwoStepStatus = "verified" | "enrol" | "verify";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function num(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function stillValid(expiresAt: unknown, now: number) { const at = Date.parse(text(expiresAt)); return Number.isFinite(at) && at > now; }

/** Where this person is with the second step, for this browser session or device. */
export async function twoStepStatus(uid: string, sessionToken: string | null, deviceToken: string | null): Promise<TwoStepStatus> {
  const db = firebaseAdminDb();
  const refs = [db.collection(ENROLMENTS).doc(uid)];
  if (sessionToken) refs.push(db.collection(SESSIONS).doc(twoStepTokenKey(sessionToken)));
  if (deviceToken) refs.push(db.collection(DEVICES).doc(twoStepTokenKey(deviceToken)));
  const [enrolment, ...passes] = await db.getAll(...refs);
  if (!enrolment.exists || enrolment.get("enabled") !== true) return "enrol";
  const enrolledAt = text(enrolment.get("enrolled_at"));
  const now = Date.now();
  const passed = passes.some((pass) => pass.exists && pass.get("uid") === uid && pass.get("enrolled_at") === enrolledAt && stillValid(pass.get("expires_at"), now));
  return passed ? "verified" : "verify";
}

/** The secret to scan, made once and kept while the person is setting up. */
export async function startTwoStepEnrolment(uid: string, account: string) {
  const db = firebaseAdminDb();
  const ref = db.collection(ENROLMENTS).doc(uid);
  const secret = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (doc.get("enabled") === true) return null;
    const pending = text(doc.get("pending_secret"));
    const createdAt = Date.parse(text(doc.get("pending_created_at")));
    if (pending && Number.isFinite(createdAt) && Date.now() - createdAt < PENDING_MS) return pending;
    const fresh = newTwoStepSecret();
    transaction.set(ref, { uid, account, enabled: false, pending_secret: fresh, pending_created_at: new Date().toISOString(), failed_attempts: 0, last_failure_at: null }, { merge: true });
    return fresh;
  });
  if (!secret) return { kind: "already_enrolled" as const };
  const uri = otpauthUri(secret, account);
  const qrSvg = await QRCode.toString(uri, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  return { kind: "started" as const, secret, uri, qrSvg };
}

type Pass = { sessionToken: string | null; trustDevice: boolean; sessionTtlMs: number; deviceLabel: string };

function writePasses(transaction: FirebaseFirestore.Transaction, uid: string, enrolledAt: string, pass: Pass, now: number) {
  const db = firebaseAdminDb();
  const created = new Date(now).toISOString();
  if (pass.sessionToken) {
    transaction.set(db.collection(SESSIONS).doc(twoStepTokenKey(pass.sessionToken)), { uid, enrolled_at: enrolledAt, created_at: created, expires_at: new Date(now + pass.sessionTtlMs).toISOString() });
  }
  if (!pass.trustDevice) return null;
  const deviceToken = newTwoStepToken();
  transaction.set(db.collection(DEVICES).doc(twoStepTokenKey(deviceToken)), { uid, enrolled_at: enrolledAt, label: pass.deviceLabel.slice(0, 120), created_at: created, expires_at: new Date(now + TWO_STEP_TRUST_MS).toISOString() });
  return deviceToken;
}

function failure(transaction: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference, failures: number, now: number) {
  transaction.update(ref, { failed_attempts: failures + 1, last_failure_at: new Date(now).toISOString() });
}

function lockedUntil(doc: FirebaseFirestore.DocumentSnapshot, now: number) {
  const last = Date.parse(text(doc.get("last_failure_at")));
  const until = twoStepLockedUntil(num(doc.get("failed_attempts")), Number.isFinite(last) ? last : null);
  return until !== null && until > now ? until : null;
}

/** The first code from the app turns two-step on, and gives the recovery codes, shown once. */
export async function confirmTwoStepEnrolment(uid: string, code: unknown, pass: Pass) {
  const db = firebaseAdminDb();
  const ref = db.collection(ENROLMENTS).doc(uid);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    const now = Date.now();
    if (doc.get("enabled") === true) return { kind: "already_enrolled" as const };
    const pending = text(doc.get("pending_secret"));
    if (!pending) return { kind: "not_started" as const };
    const until = lockedUntil(doc, now);
    if (until) return { kind: "locked" as const, until: new Date(until).toISOString() };
    // Locks lapse on their own; the count starts again after one.
    const failures = twoStepLockedUntil(num(doc.get("failed_attempts")), Date.parse(text(doc.get("last_failure_at")))) ? 0 : num(doc.get("failed_attempts"));
    const checked = verifyTotp(pending, code, now, null);
    if (!checked.ok) {
      if (checked.reason !== "format") failure(transaction, ref, failures, now);
      return { kind: checked.reason === "format" ? "format" as const : "wrong" as const };
    }
    const recoveryCodes = newRecoveryCodes();
    const enrolledAt = new Date(now).toISOString();
    transaction.set(ref, {
      uid, account: text(doc.get("account")), enabled: true, secret: pending, enrolled_at: enrolledAt, last_counter: checked.counter,
      recovery_hashes: recoveryCodes.map((item) => hashRecoveryCode(uid, item)), failed_attempts: 0, last_failure_at: null,
      pending_secret: null, pending_created_at: null, last_verified_at: enrolledAt,
    });
    const deviceToken = writePasses(transaction, uid, enrolledAt, pass, now);
    return { kind: "enrolled" as const, recoveryCodes, deviceToken };
  });
}

/** A code from the app, or one of the recovery codes, at sign-in. */
export async function verifyTwoStep(uid: string, code: unknown, pass: Pass) {
  const db = firebaseAdminDb();
  const ref = db.collection(ENROLMENTS).doc(uid);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    const now = Date.now();
    if (doc.get("enabled") !== true) return { kind: "not_enrolled" as const };
    const until = lockedUntil(doc, now);
    if (until) return { kind: "locked" as const, until: new Date(until).toISOString() };
    const failures = twoStepLockedUntil(num(doc.get("failed_attempts")), Date.parse(text(doc.get("last_failure_at")))) ? 0 : num(doc.get("failed_attempts"));
    const enrolledAt = text(doc.get("enrolled_at"));
    const hashes = Array.isArray(doc.get("recovery_hashes")) ? (doc.get("recovery_hashes") as unknown[]).filter((item): item is string => typeof item === "string") : [];
    let usedRecovery = false;
    if (looksLikeRecoveryCode(code)) {
      const hash = hashRecoveryCode(uid, code);
      if (!hashes.includes(hash)) { failure(transaction, ref, failures, now); return { kind: "wrong" as const }; }
      transaction.update(ref, { recovery_hashes: hashes.filter((item) => item !== hash), failed_attempts: 0, last_failure_at: null, last_verified_at: new Date(now).toISOString() });
      usedRecovery = true;
    } else {
      const lastCounter = doc.get("last_counter");
      const checked = verifyTotp(text(doc.get("secret")), code, now, typeof lastCounter === "number" ? lastCounter : null);
      if (!checked.ok) {
        // A code typed twice by mistake isn't a guess; only wrong codes count towards the lock.
        if (checked.reason === "wrong") failure(transaction, ref, failures, now);
        return { kind: checked.reason === "format" ? "format" as const : checked.reason === "reused" ? "reused" as const : "wrong" as const };
      }
      transaction.update(ref, { last_counter: checked.counter, failed_attempts: 0, last_failure_at: null, last_verified_at: new Date(now).toISOString() });
    }
    const deviceToken = writePasses(transaction, uid, enrolledAt, pass, now);
    return { kind: "verified" as const, deviceToken, usedRecovery, recoveryLeft: usedRecovery ? hashes.length - 1 : hashes.length };
  });
}

/** Signing out ends this browser's pass; trusted devices stay until they lapse or are reset. */
export async function endTwoStepSession(sessionToken: string) {
  await firebaseAdminDb().collection(SESSIONS).doc(twoStepTokenKey(sessionToken)).delete().catch(() => undefined);
}

/** A lost phone: Management turns two-step off for someone, who sets it up again at their next sign-in. */
export async function resetTwoStep(uid: string, actor: { name: string; email: string }) {
  const db = firebaseAdminDb();
  const [sessions, devices] = await Promise.all([
    db.collection(SESSIONS).where("uid", "==", uid).get(),
    db.collection(DEVICES).where("uid", "==", uid).get(),
  ]);
  const batch = db.batch();
  batch.set(db.collection(ENROLMENTS).doc(uid), {
    uid, enabled: false, secret: null, recovery_hashes: [], pending_secret: null, pending_created_at: null, enrolled_at: null,
    failed_attempts: 0, last_failure_at: null, reset_by_name: actor.name, reset_by_email: actor.email, reset_at: new Date().toISOString(),
  }, { merge: true });
  for (const doc of [...sessions.docs, ...devices.docs]) batch.delete(doc.ref);
  await batch.commit();
}

/** Who has two-step on, for the people list. */
export async function twoStepOverview(uids: string[]) {
  const db = firebaseAdminDb();
  const out = new Map<string, { enabled: boolean; enrolled_at: string | null; recovery_left: number }>();
  for (let index = 0; index < uids.length; index += 300) {
    const refs = uids.slice(index, index + 300).map((uid) => db.collection(ENROLMENTS).doc(uid));
    if (!refs.length) continue;
    for (const doc of await db.getAll(...refs)) {
      const hashes = doc.get("recovery_hashes");
      out.set(doc.id, { enabled: doc.get("enabled") === true, enrolled_at: text(doc.get("enrolled_at")) || null, recovery_left: Array.isArray(hashes) ? hashes.length : 0 });
    }
  }
  return out;
}
