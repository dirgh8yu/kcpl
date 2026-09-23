import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import type { OwnerCandidateEvidence } from "./owner-recommender";
import type { ReceivableExposure } from "./work-queue-impact";

/**
 * Per-customer unpaid receivable exposure for the work-queue impact ranking.
 * Mirrors the finance module's read conventions: draft/void never counts,
 * opening-balance records do, and the stored balance_due is trusted as the
 * truth of what is still owed. Branch access is enforced per invoice so a
 * branch-scoped operator only ever sees exposure they are entitled to.
 */
export async function getReceivableExposureByCustomer(staff: KcplStaffContext): Promise<Map<string, ReceivableExposure>> {
  if (!firebaseRuntimeConfigured()) return new Map();
  const db = firebaseAdminDb();
  const invoices = await db.collection("invoices").limit(6000).get();
  const map = new Map<string, ReceivableExposure>();
  for (const doc of invoices.docs) {
    const data = doc.data();
    const status = text(data.status);
    if (status === "draft" || status === "void") continue;
    const customerId = text(data.customer_id).trim().toUpperCase();
    if (!customerId) continue;
    if (!staffCanAccessBranch(staff, text(data.branch))) continue;
    const balance = numberValue(data.balance_due);
    if (balance <= 0) continue;
    const currency = text(data.currency).trim().toUpperCase() || "unspecified";
    const bucket = map.get(customerId) ?? { balances: {} };
    bucket.balances[currency] = (bucket.balances[currency] ?? 0) + balance;
    map.set(customerId, bucket);
  }
  return map;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Completed-lane experience per staff member, for the owner recommender.
 * Attribution follows the register's own ownership rule: job_assigned_to_* at
 * completion time. Branch-scoped operators only learn from shipments they
 * could have opened. Reads stay bounded like every other register query.
 */
export async function getLaneCompletionsByStaff(staff: KcplStaffContext): Promise<Map<string, Map<string, OwnerCandidateEvidence>>> {
  if (!firebaseRuntimeConfigured()) return new Map();
  const db = firebaseAdminDb();
  const [delivered, quotes] = await Promise.all([
    db.collection("shipments").where("status", "==", "delivered").orderBy("updated_at", "desc").limit(400).get(),
    db.collection("quotes").limit(4000).get(),
  ]);
  const quoteById = new Map(quotes.docs.map((doc) => [doc.id, doc]));
  const laneByStaff = new Map<string, Map<string, OwnerCandidateEvidence>>();
  for (const doc of delivered.docs) {
    const uid = text(doc.get("job_assigned_to_uid")).trim();
    const email = text(doc.get("job_assigned_to_email")).trim().toLowerCase();
    if (!uid && !email) continue;
    const primary = text(doc.get("primary_branch"));
    const handling = Array.isArray(doc.get("handling_branches")) ? doc.get("handling_branches").map((value: unknown) => text(value)) : [];
    const branches = [...new Set([primary, ...handling].filter(Boolean))];
    if (!branches.length) continue;
    if (!staff.can_access_all_branches && !branches.some((branch) => staffCanAccessBranch(staff, branch))) continue;
    const quote = quoteById.get(text(doc.get("quote_reference")));
    const origin = text(quote?.get("origin"));
    const destination = text(quote?.get("destination"));
    if (!origin || !destination) continue;
    const lane = `${origin.toLowerCase()}→${destination.toLowerCase()}`;
    const completedAt = text(doc.get("updated_at"));
    const keys = uid ? [uid, ...(email ? [email] : [])] : [email];
    for (const key of keys) {
      let lanes = laneByStaff.get(key);
      if (!lanes) {
        lanes = new Map();
        laneByStaff.set(key, lanes);
      }
      const existing = lanes.get(lane) ?? { lane_completions: 0, last_lane_completion_at: null };
      existing.lane_completions += 1;
      if (completedAt && (!existing.last_lane_completion_at || completedAt > existing.last_lane_completion_at)) existing.last_lane_completion_at = completedAt;
      lanes.set(lane, existing);
    }
  }
  return laneByStaff;
}
