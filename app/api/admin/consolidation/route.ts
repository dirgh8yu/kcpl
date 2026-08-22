import { getAdminAccess } from "../../../admin/admin-auth";
import {
  approveConsolidationCommercialAllocationVersion,
  listCurrentConsolidationAllocationViews,
  prepareConsolidationCommercialAllocation,
} from "../../../admin/consolidation/tms-consolidation-allocation.server";
import { releaseConsolidationToProcurementWithLineage } from "../../../admin/consolidation/tms-consolidation-release-lineage.server";
import {
  addOrderToConsolidationLoad,
  cancelDraftConsolidationLoad,
  createConsolidationLoad,
  listConsolidationLoads,
  removeOrderFromConsolidationLoad,
  reorderConsolidationStops,
  updateConsolidationStop,
} from "../../../admin/consolidation/tms-consolidation.server";
import { tmsModes, type TmsMode } from "../../../admin/rating/tms-rating";
import { listTmsOrders } from "../../../admin/rating/tms-rating.server";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
function clean(value: unknown, max = 4000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function optionalNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : null; }
function stringList(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 50) : []; }

async function auth() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return { response: json({ ok: false, error: "Commercial access is required." }, 403) };
  return { user: access.user, staff };
}

function concurrencyConflict(kind: string) {
  return kind === "membership_conflict" || kind === "state_conflict";
}

export async function GET() {
  const access = await auth();
  if ("response" in access) return access.response;
  const [loads, orders] = await Promise.all([listConsolidationLoads(access.staff), listTmsOrders(access.staff)]);
  if (loads.kind !== "ready" || orders.kind !== "ready") return json({ ok: false, error: "Consolidation storage is unavailable." }, 503);
  try {
    const allocationViews = await listCurrentConsolidationAllocationViews(loads.loads.map((load) => load.id), access.staff);
    return json({
      ok: true,
      loads: loads.loads,
      orders: orders.orders,
      allocations: Object.fromEntries(allocationViews),
      canManage: access.staff.permissions.canEditCommercial,
      canApproveAllocation: access.staff.permissions.role === "management",
    });
  } catch {
    return json({ ok: false, error: "Consolidation allocation state is unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  const access = await auth();
  if ("response" in access) return access.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin consolidation updates are not accepted." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const action = clean(body.action, 40);
  const actor = { name: access.user.displayName, email: access.user.email };

  if (action === "create") {
    const mode = clean(body.mode, 30) as TmsMode;
    if (!tmsModes.includes(mode)) return json({ ok: false, error: "Choose a valid load mode." }, 400);
    const result = await createConsolidationLoad({
      name: clean(body.name, 180), mode, orderIds: stringList(body.orderIds), equipment: clean(body.equipment, 160),
      capacityWeightKg: optionalNumber(body.capacityWeightKg), capacityVolumeCbm: optionalNumber(body.capacityVolumeCbm),
      capacityPieces: optionalNumber(body.capacityPieces), capacityContainers: optionalNumber(body.capacityContainers),
    }, actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Consolidation storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "One or more orders are outside your branch or commercial access." }, 403);
    if (result.kind === "missing_order") return json({ ok: false, error: "One or more transport orders could not be found." }, 404);
    if (result.kind === "membership_conflict") return json({ ok: false, error: "One or more orders changed concurrently or already belong to another consolidation load." }, 409);
    if (result.kind === "incompatible") return json({ ok: false, error: result.compatibility.blockers.join(" "), compatibility: result.compatibility }, 409);
    if (result.kind !== "created") return json({ ok: false, error: "The consolidation load could not be created." }, 400);
    return json({ ok: true, load: result.load, compatibility: result.compatibility }, 201);
  }

  if (action === "add_order") {
    const result = await addOrderToConsolidationLoad(clean(body.loadId, 120), clean(body.orderId, 120), actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Consolidation storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This load or order is outside your access." }, 403);
    if (result.kind === "missing") return json({ ok: false, error: "Consolidation load not found." }, 404);
    if (result.kind === "missing_order") return json({ ok: false, error: "Transport order not found." }, 404);
    if (result.kind === "locked") return json({ ok: false, error: "Load membership is locked after release to procurement." }, 409);
    if (concurrencyConflict(result.kind)) return json({ ok: false, error: "The order changed concurrently or already belongs to another consolidation load." }, 409);
    if (result.kind === "incompatible") return json({ ok: false, error: result.compatibility.blockers.join(" "), compatibility: result.compatibility }, 409);
    return json({ ok: true, load: result.load, compatibility: "compatibility" in result ? result.compatibility : undefined });
  }

  if (action === "remove_order") {
    const result = await removeOrderFromConsolidationLoad(clean(body.loadId, 120), clean(body.orderId, 120), actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Consolidation storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This load is outside your access." }, 403);
    if (result.kind === "missing") return json({ ok: false, error: "Consolidation load not found." }, 404);
    if (result.kind === "missing_order") return json({ ok: false, error: "Transport order is not part of this load." }, 404);
    if (result.kind === "minimum_members") return json({ ok: false, error: "A consolidation load must retain at least two orders. Cancel the load instead." }, 409);
    if (result.kind === "locked") return json({ ok: false, error: "Load membership is locked after release to procurement." }, 409);
    if (result.kind === "state_conflict") return json({ ok: false, error: "Load membership changed concurrently. Refresh before retrying." }, 409);
    return json({ ok: true, load: result.load });
  }

  if (action === "reorder") {
    const result = await reorderConsolidationStops(clean(body.loadId, 120), stringList(body.stopIds), actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Consolidation storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This load is outside your access." }, 403);
    if (result.kind === "missing") return json({ ok: false, error: "Consolidation load not found." }, 404);
    if (result.kind === "locked") return json({ ok: false, error: "Stop sequence is locked after release to procurement." }, 409);
    if (result.kind === "invalid_sequence") return json({ ok: false, error: "The stop sequence is incomplete or invalid." }, 400);
    if (result.kind === "precedence") return json({ ok: false, error: `Pickup must occur before delivery for: ${result.orderIds.join(", ")}.` }, 409);
    return json({ ok: true, load: result.load });
  }

  if (action === "update_stop") {
    const result = await updateConsolidationStop(clean(body.loadId, 120), clean(body.stopId, 120), { plannedAt: clean(body.plannedAt, 80), instructions: clean(body.instructions, 2000) }, actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Consolidation storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This load is outside your access." }, 403);
    if (result.kind === "missing" || result.kind === "missing_stop") return json({ ok: false, error: "Load or stop not found." }, 404);
    if (result.kind === "locked") return json({ ok: false, error: "Stops are locked after release to procurement." }, 409);
    return json({ ok: true, load: result.load });
  }

  if (action === "release") {
    const result = await releaseConsolidationToProcurementWithLineage(clean(body.loadId, 120), actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Consolidation storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This load is outside your access." }, 403);
    if (result.kind === "missing") return json({ ok: false, error: "Consolidation load not found." }, 404);
    if (result.kind === "missing_order") return json({ ok: false, error: "One or more house orders could not be found." }, 404);
    if (result.kind === "minimum_members") return json({ ok: false, error: "At least two orders are required." }, 409);
    if (result.kind === "customer_required") return json({ ok: false, error: "Link every member order to a KCPL customer before releasing the load." }, 409);
    if (result.kind === "pricing_required") return json({ ok: false, error: "Every house must have a priced immutable commercial version before release to procurement." }, 409);
    if (result.kind === "approval_required") return json({ ok: false, error: "A house commercial version still requires Management approval before consolidation release." }, 409);
    if (result.kind === "commercial_review_required") return json({ ok: false, error: "One or more house commercial versions cannot be proven safely. Commercial review is required before release." }, 409);
    if (result.kind === "precedence" || result.kind === "invalid_sequence") return json({ ok: false, error: "Review the stop sequence. Every pickup must occur before its delivery." }, 409);
    if (result.kind === "capacity") return json({ ok: false, error: result.blockers.join(" ") }, 409);
    if (result.kind === "state_conflict") return json({ ok: false, error: "The consolidation changed concurrently or has inconsistent membership. Refresh before release." }, 409);
    if (result.kind === "locked") return json({ ok: false, error: "This load is already locked for procurement." }, 409);
    if (result.kind === "ready") return json({ ok: true, masterOrderId: result.masterOrderId });
    return json({ ok: true, masterOrderId: result.masterOrderId, releasedCommercialSources: result.releasedCommercialSources }, 201);
  }

  if (action === "prepare_allocation") {
    const result = await prepareConsolidationCommercialAllocation(clean(body.loadId, 120), actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Commercial allocation storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This load is outside your commercial or branch access." }, 403);
    if (result.kind === "missing_load" || result.kind === "missing_order") return json({ ok: false, error: "Consolidation load or house order not found." }, 404);
    if (result.kind === "invalid_master") return json({ ok: false, error: "The consolidation master order is missing or inconsistent." }, 409);
    if (result.kind === "tender_required") return json({ ok: false, error: "The master tender must be accepted or countered before commercial allocation can be prepared." }, 409);
    if (result.kind === "invalid_transition") return json({ ok: false, error: "Only a released, unbooked consolidation load can prepare commercial allocation." }, 409);
    if (result.kind === "commercial_allocation_stale") return json({ ok: false, error: "Released consolidation authority changed. Refresh and prepare a fresh allocation package." }, 409);
    if (result.kind === "commercial_review_required" || result.kind === "pricing_required") return json({ ok: false, error: "The staged economics cannot be proven safely and require commercial review." }, 409);
    if (result.kind === "customer_acceptance_required") return json({ ok: false, error: "Exact customer sell acceptance is missing for one or more house commercial versions." }, 409);
    if (result.kind === "customer_quote_stale") return json({ ok: false, error: "Customer sell authority does not match the exact staged commercial economics." }, 409);
    if (result.kind === "approval_required" && !("packageId" in result)) return json({ ok: false, error: "An existing source or master commercial version still requires Management approval." }, 409);
    if (result.kind !== "ready" && result.kind !== "approval_required") return json({ ok: false, error: "Commercial allocation could not be prepared." }, 409);
    return json({
      ok: true,
      status: result.kind === "approval_required" ? "approval_required" : "ready",
      packageId: result.packageId,
      requiredApprovals: result.requiredApprovals,
      idempotent: result.idempotent,
    });
  }

  if (action === "approve_allocation") {
    const result = await approveConsolidationCommercialAllocationVersion({
      loadId: clean(body.loadId, 120),
      packageId: clean(body.packageId, 120),
      commercialVersionId: clean(body.commercialVersionId, 120),
      note: clean(body.note, 2000),
    }, actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Commercial approval storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "Management authority is required to approve staged consolidation economics." }, 403);
    if (result.kind === "missing") return json({ ok: false, error: "Allocation package or load not found." }, 404);
    if (result.kind === "commercial_allocation_stale") return json({ ok: false, error: "This allocation version is no longer the current exact approval target." }, 409);
    if (result.kind === "invalid_transition") return json({ ok: false, error: "This load can no longer accept a commercial allocation approval." }, 409);
    if (result.kind === "not_required") return json({ ok: false, error: "This exact commercial version does not require Management approval." }, 409);
    if (result.kind !== "approved") return json({ ok: false, error: "The exact allocation commercial version could not be approved." }, 409);
    return json({ ok: true, packageId: result.packageId, commercialVersionId: result.commercialVersionId, packageStatus: result.packageStatus, idempotent: result.idempotent });
  }

  if (action === "cancel") {
    const result = await cancelDraftConsolidationLoad(clean(body.loadId, 120), clean(body.note, 2000), actor, access.staff);
    if (result.kind === "unavailable") return json({ ok: false, error: "Consolidation storage is unavailable." }, 503);
    if (result.kind === "forbidden") return json({ ok: false, error: "This load is outside your access." }, 403);
    if (result.kind === "missing") return json({ ok: false, error: "Consolidation load not found." }, 404);
    if (result.kind === "state_conflict") return json({ ok: false, error: "Load membership changed concurrently. Refresh before cancelling." }, 409);
    if (result.kind === "locked") return json({ ok: false, error: "A load cannot be cancelled here after release to procurement." }, 409);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Unknown consolidation action." }, 400);
}
