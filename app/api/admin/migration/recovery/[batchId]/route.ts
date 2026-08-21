import { getAdminAccess } from "../../../../../admin/admin-auth";
import { getMigrationBatch } from "../../../../../admin/migration/migration-batches.server";
import { executeMigrationRecovery, prepareMigrationRecovery } from "../../../../../admin/migration/recovery/recovery.server";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../../../firebase-admin.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";

const supportedRecoveryTypes = new Set(["customer_csv", "shipment_csv", "receivables_csv", "payables_csv"]);
const recoveryLockMs = 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorizeRecovery() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management" || !staff.permissions.canManageFinance) {
    return { response: json({ ok: false, error: "Migration recovery is restricted to KCPL Management with finance authority." }, 403) };
  }
  return { user: access.user };
}

async function claimRecoveryLock(batchId: string, planId: string, actorEmail: string) {
  const db = firebaseAdminDb();
  const ref = db.collection("migration_recovery_locks").doc(batchId);
  const now = Date.now();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const expiresAt = snapshot.exists ? Date.parse(String(snapshot.get("expires_at") ?? "")) : 0;
    if (snapshot.exists && Number.isFinite(expiresAt) && expiresAt > now) return false;
    transaction.set(ref, {
      batch_id: batchId,
      plan_id: planId,
      actor_email: actorEmail,
      acquired_at: new Date(now).toISOString(),
      expires_at: new Date(now + recoveryLockMs).toISOString(),
    });
    return true;
  });
}

async function releaseRecoveryLock(batchId: string, planId: string, actorEmail: string) {
  const db = firebaseAdminDb();
  const ref = db.collection("migration_recovery_locks").doc(batchId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    if (String(snapshot.get("plan_id") ?? "") !== planId || String(snapshot.get("actor_email") ?? "").toLowerCase() !== actorEmail.toLowerCase()) return;
    transaction.delete(ref);
  });
}

export async function POST(request: Request, context: { params: Promise<{ batchId: string }> }) {
  const auth = await authorizeRecovery();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin recovery requests are not accepted." }, 403);
  const params = await context.params;
  const batchId = params.batchId.trim().toUpperCase();

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "Recovery request could not be read." }, 400); }
  const action = typeof body.action === "string" ? body.action : "plan";

  try {
    if (!firebaseRuntimeConfigured()) return json({ ok: false, error: "Migration storage is unavailable." }, 503);
    const batch = await getMigrationBatch(batchId);
    if (!batch) return json({ ok: false, error: "Migration batch not found." }, 404);
    if (!supportedRecoveryTypes.has(batch.type)) return json({ ok: false, error: "Stage 4C does not support automatic rollback for this migration type." }, 409);

    if (action === "plan") {
      const prepared = await prepareMigrationRecovery(batchId, { name: auth.user.displayName, email: auth.user.email });
      if (!("plan" in prepared)) {
        return prepared.kind === "missing"
          ? json({ ok: false, error: "Migration batch not found." }, 404)
          : json({ ok: false, error: "Migration storage is unavailable." }, 503);
      }
      await firebaseAdminDb().collection("migration_recovery_plans").doc(prepared.plan.plan_id).set({
        batch_type: prepared.plan.batch_type,
        batch_status: prepared.plan.batch_status,
        rollback_status: prepared.plan.rollback_status,
        records: prepared.plan.records,
        warnings: prepared.plan.warnings,
        eligible_count: prepared.plan.eligible_count,
        blocked_count: prepared.plan.blocked_count,
        already_reversed_count: prepared.plan.already_reversed_count,
        missing_count: prepared.plan.missing_count,
        archive_relinks: prepared.plan.archive_relinks,
        confirmation_text: prepared.plan.confirmation_text,
      }, { merge: true });
      return json({ ok: true, plan: prepared.plan });
    }

    if (action !== "execute") return json({ ok: false, error: "Choose a valid recovery action." }, 400);
    const planId = typeof body.plan_id === "string" ? body.plan_id.trim() : "";
    if (!planId) return json({ ok: false, error: "Run a recovery dry run before executing rollback." }, 409);
    const claimed = await claimRecoveryLock(batchId, planId, auth.user.email);
    if (!claimed) return json({ ok: false, error: "Another recovery is already running for this migration batch. Wait for it to finish before trying again." }, 409);

    try {
      const result = await executeMigrationRecovery({
        batchId,
        planId,
        planHash: typeof body.plan_hash === "string" ? body.plan_hash : "",
        confirmation: typeof body.confirmation === "string" ? body.confirmation : "",
      }, { name: auth.user.displayName, email: auth.user.email });
      if (!("result" in result)) {
        if (result.kind === "unavailable") return json({ ok: false, error: result.error || "Migration storage is unavailable." }, 503);
        if (result.kind === "missing") return json({ ok: false, error: result.error || "Recovery plan or batch not found." }, 404);
        if (result.kind === "stale") return json({ ok: false, error: result.error || "Recovery plan is stale." }, 409);
        return json({ ok: false, error: result.error || "Recovery request is not valid." }, 409);
      }
      return json({ ok: true, result: result.result });
    } finally {
      await releaseRecoveryLock(batchId, planId, auth.user.email).catch((error) => console.error("Failed to release KCPL migration recovery lock", error));
    }
  } catch (error) {
    console.error("KCPL Stage 4C migration recovery failed", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Migration recovery failed." }, 500);
  }
}
