import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { gptActionJson, requireGptAction } from "../../../gpt-action-auth.server";

const activeStatuses = new Set([
  "booking_confirmed",
  "preparing",
  "in_transit",
  "customs_clearance",
  "out_for_delivery",
  "exception",
]);

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function dateValue(value: unknown) {
  const valueText = text(value);
  if (!valueText) return null;
  const date = new Date(valueText);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  const authError = requireGptAction(request);
  if (authError) return authError;
  if (!firebaseRuntimeConfigured()) return gptActionJson({ ok: false, error: "Firebase is unavailable." }, 503);

  try {
    const snapshot = await firebaseAdminDb().collection("shipments").orderBy("updated_at", "desc").limit(750).get();
    const now = new Date();
    const counts: Record<string, number> = {};
    const branchCounts: Record<string, number> = {};
    const attention: Array<Record<string, unknown>> = [];

    for (const doc of snapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      const status = text(data.status, "booking_confirmed");
      counts[status] = (counts[status] ?? 0) + 1;

      const primaryBranch = text(data.primary_branch, "Unassigned");
      if (activeStatuses.has(status)) branchCounts[primaryBranch] = (branchCounts[primaryBranch] ?? 0) + 1;

      const eta = dateValue(data.eta);
      const overdueEta = Boolean(eta && eta.getTime() < now.getTime() && status !== "delivered");
      if (status === "exception" || overdueEta) {
        attention.push({
          reference: doc.id,
          status,
          priority: nullable(data.job_priority),
          currentLocation: nullable(data.current_location),
          eta: nullable(data.eta),
          overdueEta,
          carrier: nullable(data.carrier),
          carrierReference: nullable(data.carrier_reference),
          primaryBranch: nullable(data.primary_branch),
          assignedTo: nullable(data.job_assigned_to_name),
          updatedAt: nullable(data.updated_at),
        });
      }
    }

    const activeCount = Object.entries(counts)
      .filter(([status]) => activeStatuses.has(status))
      .reduce((sum, [, count]) => sum + count, 0);

    return gptActionJson({
      ok: true,
      generatedAt: new Date().toISOString(),
      sampledShipmentCount: snapshot.size,
      activeShipmentCount: activeCount,
      statusCounts: counts,
      activeShipmentsByPrimaryBranch: branchCounts,
      attentionCount: attention.length,
      attention: attention.slice(0, 30),
      note: snapshot.size === 750 ? "Counts are based on the 750 most recently updated shipments." : null,
    });
  } catch (error) {
    console.error("KCPL Custom GPT briefing failed", error);
    return gptActionJson({ ok: false, error: "The KCPL operations briefing is temporarily unavailable." }, 503);
  }
}
