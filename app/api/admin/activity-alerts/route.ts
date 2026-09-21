import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { checkShipmentBranchAccess } from "../../../admin/shipment-access.server";
import { activityToneFor, recordActivityAlertReceipt } from "../../../admin/shipment-activity.server";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!firebaseRuntimeConfigured()) return json({ ok: true, items: [] });

  try {
    // Recent danger/warning job_activity entries across shipments. A
    // collectionGroup read is required because activity lives under each
    // shipment; the window keeps the scan bounded.
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const snapshot = await firebaseAdminDb()
      .collectionGroup("job_activity")
      .where("created_at", ">=", cutoff)
      .limit(200)
      .get();
    const seenSnapshot = await firebaseAdminDb()
      .collection("staff_activity_alert_receipts").doc(staff.profile.uid)
      .collection("items").limit(500)
      .get();
    const seen = new Set(seenSnapshot.docs.map((doc) => text(doc.get("activity_id"))));

    const items: Array<{ id: string; reference: string; title: string; detail: string | null; tone: "danger" | "warning"; occurred_at: string }> = [];
    for (const doc of snapshot.docs) {
      const reference = doc.ref.parent?.parent?.id;
      if (!reference) continue;
      if (seen.has(doc.id)) continue;
      // job_activity docs store type/title, not a tone field — derive the
      // same tone the activity timeline computes for the UI.
      const title = text(doc.get("title"), "Operational activity");
      const tone = activityToneFor(text(doc.get("type"), "job_activity"), title);
      if (tone !== "danger" && tone !== "warning") continue;
      const shipmentAccess = await checkShipmentBranchAccess(reference, staff);
      if (shipmentAccess.kind !== "allowed") continue;
      items.push({
        id: doc.id,
        reference,
        title,
        detail: text(doc.get("detail")) || null,
        tone,
        occurred_at: text(doc.get("created_at")),
      });
    }
    items.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    return json({ ok: true, items });
  } catch (error) {
    console.error("KCPL activity alert feed failed", error);
    return json({ ok: false, error: "Activity alert storage is temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The activity alert could not be read." }, 400); }
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  const activityId = typeof body.activityId === "string" ? body.activityId.trim() : "";
  if (!reference || !activityId) return json({ ok: false, error: "A shipment reference and activity id are required." }, 400);
  const result = await recordActivityAlertReceipt(staff.profile.uid, reference, activityId);
  if (result.kind === "unavailable") return json({ ok: false, error: "Activity alert storage is temporarily unavailable." }, 503);
  return json({ ok: true });
}
