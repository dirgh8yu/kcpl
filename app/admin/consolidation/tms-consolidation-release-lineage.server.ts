import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import {
  assertBookableCommercialVersionInTransaction,
  persistCommercialVersionInTransaction,
  resolveCurrentCommercialVersionInTransaction,
} from "../commercial-lineage/commercial-lineage.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { MAX_LOAD_ORDERS, capacityViolations, validateStopPrecedence, type TmsLoadStop } from "./tms-consolidation";

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const valueText = text(value).trim(); return valueText || null; }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function normalizedId(value: unknown) { return text(value).trim().toUpperCase(); }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function masterOrderId(loadId: string) { return `ORD-${loadId}`.slice(0, 120); }

function stopFromData(value: unknown): TmsLoadStop | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const kind = ["pickup", "hub", "customs", "delivery"].includes(text(data.kind)) ? text(data.kind) as TmsLoadStop["kind"] : null;
  const id = text(data.id).trim();
  if (!kind || !id) return null;
  return {
    id,
    sequence: Math.max(1, Math.trunc(numberValue(data.sequence) || 1)),
    kind,
    location: text(data.location),
    order_ids: Array.isArray(data.order_ids) ? data.order_ids.filter((item): item is string => typeof item === "string").map((item) => item.trim().toUpperCase()).filter(Boolean) : [],
    planned_at: nullable(data.planned_at),
    instructions: nullable(data.instructions),
  };
}

function memberOrderIds(load: FirebaseFirestore.DocumentSnapshot) {
  const raw = load.get("members");
  if (!Array.isArray(raw)) return [] as string[];
  return raw.map((member) => member && typeof member === "object" ? normalizedId((member as Record<string, unknown>).order_id) : "").filter(Boolean);
}

export async function releaseConsolidationToProcurementWithLineage(loadIdValue: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const loadRef = db.collection("consolidation_loads").doc(normalizedId(loadIdValue));
  const now = new Date().toISOString();

  try {
    return await db.runTransaction(async (transaction) => {
      const load = await transaction.get(loadRef);
      if (!load.exists) return { kind: "missing" as const };
      const branch = branchValue(load.get("branch"));
      if (!branch || !staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
      const currentStatus = text(load.get("status"));
      const existingMasterId = normalizedId(load.get("master_order_id"));
      if (currentStatus !== "draft") return existingMasterId ? { kind: "ready" as const, masterOrderId: existingMasterId } : { kind: "locked" as const };

      const orderIds = memberOrderIds(load);
      if (orderIds.length < 2) return { kind: "minimum_members" as const };
      if (orderIds.length > MAX_LOAD_ORDERS || new Set(orderIds).size !== orderIds.length) return { kind: "state_conflict" as const };
      const rawStops = load.get("stops");
      const stops = Array.isArray(rawStops) ? rawStops.map(stopFromData).filter((item): item is TmsLoadStop => Boolean(item)).sort((a, b) => a.sequence - b.sequence) : [];
      if (!stops.length || stops.length !== (Array.isArray(rawStops) ? rawStops.length : 0)) return { kind: "invalid_sequence" as const };
      if (validateStopPrecedence(stops).length) return { kind: "precedence" as const };

      const orderRefs = orderIds.map((id) => db.collection("transport_orders").doc(id));
      const orders = await Promise.all(orderRefs.map((ref) => transaction.get(ref)));
      if (orders.some((order) => !order.exists)) return { kind: "missing_order" as const };

      const sourceVersions = [] as Array<{ order: FirebaseFirestore.DocumentSnapshot; versionId: string; fingerprint: string; legacyReconstructed: boolean }>;
      for (const order of orders) {
        if (branchValue(order.get("branch")) !== branch || !staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
        if (normalizedId(order.get("consolidation_load_id")) !== load.id || order.get("procurement_locked_by_load") === true || normalizedId(order.get("consolidation_master_order_id"))) return { kind: "state_conflict" as const };
        if (!["draft", "rated", "selected"].includes(text(order.get("status")))) return { kind: "state_conflict" as const };
        if (!normalizedId(order.get("customer_id"))) return { kind: "customer_required" as const };
        const resolved = await resolveCurrentCommercialVersionInTransaction(transaction, order, actor);
        if (resolved.kind !== "ready") return { kind: resolved.kind === "commercial_review_required" ? "commercial_review_required" as const : "pricing_required" as const };
        const bookable = await assertBookableCommercialVersionInTransaction(transaction, resolved.version);
        if (!bookable.decision.ok) return { kind: bookable.decision.reason };
        if (resolved.legacy_reconstructed) persistCommercialVersionInTransaction(transaction, resolved.version);
        sourceVersions.push({ order, versionId: resolved.version.id, fingerprint: resolved.version.fingerprint, legacyReconstructed: resolved.legacy_reconstructed });
      }

      const totals = orders.reduce((sum, order) => ({
        weight_kg: sum.weight_kg + Math.max(0, numberValue(order.get("weight_kg"))),
        volume_cbm: sum.volume_cbm + Math.max(0, numberValue(order.get("volume_cbm"))),
        pieces: sum.pieces + Math.max(0, Math.trunc(numberValue(order.get("pieces")))),
        containers: sum.containers + Math.max(0, Math.trunc(numberValue(order.get("container_count")))),
      }), { weight_kg: 0, volume_cbm: 0, pieces: 0, containers: 0 });
      const blockers = capacityViolations(totals, {
        weight_kg: nullableNumber(load.get("capacity_weight_kg")),
        volume_cbm: nullableNumber(load.get("capacity_volume_cbm")),
        pieces: nullableNumber(load.get("capacity_pieces")),
        containers: nullableNumber(load.get("capacity_containers")),
      });
      if (blockers.length) return { kind: "capacity" as const, blockers };

      const first = stops[0];
      const last = stops.at(-1);
      if (!first || !last) return { kind: "invalid_sequence" as const };
      const masterId = masterOrderId(load.id);
      const masterRef = db.collection("transport_orders").doc(masterId);
      if ((await transaction.get(masterRef)).exists) return { kind: "state_conflict" as const };
      const pickupDates = orders.map((order) => nullable(order.get("pickup_date"))).filter((value): value is string => Boolean(value)).sort();
      const deliveryDates = orders.map((order) => nullable(order.get("delivery_date"))).filter((value): value is string => Boolean(value)).sort();
      const reference = text(load.get("reference"), load.id);
      const mode = text(load.get("mode"));
      transaction.create(masterRef, {
        branch,
        customer_id: null,
        customer_name: `Consolidation ${reference}`,
        origin: first.location,
        destination: last.location,
        mode,
        pickup_date: pickupDates[0] ?? null,
        delivery_date: deliveryDates.at(-1) ?? null,
        weight_kg: totals.weight_kg,
        volume_cbm: totals.volume_cbm,
        pieces: totals.pieces,
        container_count: totals.containers,
        equipment: nullable(load.get("equipment")),
        temperature_requirement: orders.map((order) => nullable(order.get("temperature_requirement"))).find(Boolean) ?? null,
        carrier_requirement: `Consolidated load ${reference} · ${stops.length} stops`,
        notes: `Master procurement order for ${reference}. Stops: ${stops.map((stop) => `${stop.sequence}:${stop.location}`).join(" | ")}`,
        status: "draft",
        selected_rate_card_id: null,
        selected_partner_id: null,
        selected_cost: null,
        selected_currency: null,
        consolidation_load_id: load.id,
        consolidation_reference: reference,
        is_consolidation_master: true,
        created_at: now,
        created_by_name: actor.name,
        created_by_email: actor.email,
        updated_at: now,
      });

      const existingMembers = Array.isArray(load.get("members")) ? load.get("members") as Array<Record<string, unknown>> : [];
      const releasedSources = sourceVersions.map((source) => ({ order_id: source.order.id, commercial_version_id: source.versionId, commercial_fingerprint: source.fingerprint }));
      const releasedMembers = existingMembers.map((member) => {
        const source = releasedSources.find((item) => item.order_id === normalizedId(member.order_id));
        return source ? { ...member, source_commercial_version_id: source.commercial_version_id, source_commercial_fingerprint: source.commercial_fingerprint } : member;
      });
      transaction.update(loadRef, {
        status: "ready_for_procurement",
        master_order_id: masterId,
        members: releasedMembers,
        released_commercial_sources: releasedSources,
        commercial_sources_locked_at: now,
        updated_at: now,
      });
      transaction.create(loadRef.collection("events").doc(`released-${masterId}`), {
        type: "released_to_procurement",
        title: `Master procurement order ${masterId} created`,
        detail: `${orderIds.length} house orders · ${stops.length} stops · source commercials frozen`,
        released_commercial_sources: releasedSources,
        actor_name: actor.name,
        actor_email: actor.email,
        created_at: now,
      });
      for (const source of sourceVersions) {
        transaction.update(source.order.ref, {
          procurement_locked_by_load: true,
          consolidation_master_order_id: masterId,
          consolidation_source_commercial_version_id: source.versionId,
          consolidation_source_commercial_fingerprint: source.fingerprint,
          updated_at: now,
        });
        transaction.create(source.order.ref.collection("events").doc(`procurement-lock-${load.id}`), {
          type: "consolidation_procurement_locked",
          title: `Procurement moved to master load ${reference}`,
          detail: masterId,
          commercial_version_id: source.versionId,
          commercial_fingerprint: source.fingerprint,
          actor_name: actor.name,
          actor_email: actor.email,
          created_at: now,
        });
      }
      return { kind: "released" as const, masterOrderId: masterId, releasedCommercialSources: releasedSources };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}
