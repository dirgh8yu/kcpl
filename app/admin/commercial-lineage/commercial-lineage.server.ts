import { randomBytes } from "node:crypto";
import { firebaseAdminDb } from "../../firebase-admin.server";
import {
  COMMERCIAL_VERSION_SCHEMA,
  commercialApprovalSatisfied,
  commercialFingerprint,
  commercialSnapshotIntegrity,
  commercialVersionBookable,
  normalizeCommercialCurrency,
  normalizeCommercialId,
  sameCommercialMoney,
  type CommercialApprovalAttestation,
  type CommercialSnapshot,
  type CommercialVersion,
  type CommercialVersionReason,
} from "./commercial-lineage";

type Actor = { name: string; email: string };

type ResolvedVersion = { kind: "ready"; version: CommercialVersion; legacy_reconstructed: boolean };

export type CommercialVersionResolution =
  | ResolvedVersion
  | { kind: "missing_commercial_version" }
  | { kind: "commercial_review_required"; reason: string };

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberOrNull(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function versionId() { return `CV-${Date.now()}-${randomBytes(6).toString("hex").toUpperCase()}`; }

export function newCommercialVersion(input: {
  snapshot: CommercialSnapshot;
  previousVersionId?: string | null;
  reason: CommercialVersionReason;
  actor: Actor;
  sourceReferences?: Record<string, string | null>;
  now?: string;
}): CommercialVersion {
  const now = input.now ?? new Date().toISOString();
  const id = versionId();
  return {
    id,
    fingerprint: commercialFingerprint(input.snapshot),
    snapshot: input.snapshot,
    previous_version_id: input.previousVersionId ? normalizeCommercialId(input.previousVersionId) : null,
    reason: input.reason,
    created_at: now,
    created_by_name: input.actor.name,
    created_by_email: input.actor.email,
    source_references: input.sourceReferences ?? {},
  };
}

export function commercialVersionDocument(version: CommercialVersion) {
  return {
    schema_version: COMMERCIAL_VERSION_SCHEMA,
    commercial_version_id: version.id,
    commercial_fingerprint: version.fingerprint,
    order_id: normalizeCommercialId(version.snapshot.order_id),
    branch: version.snapshot.branch,
    customer_id: version.snapshot.customer_id ? normalizeCommercialId(version.snapshot.customer_id) : null,
    previous_version_id: version.previous_version_id,
    reason: version.reason,
    snapshot: version.snapshot,
    source_references: version.source_references,
    created_at: version.created_at,
    created_by_name: version.created_by_name,
    created_by_email: version.created_by_email,
    immutable: true,
  };
}

export function commercialVersionFromDocument(id: string, data: Record<string, unknown>): CommercialVersion | null {
  const snapshot = data.snapshot as CommercialSnapshot | undefined;
  if (!snapshot || typeof snapshot !== "object") return null;
  const fingerprint = text(data.commercial_fingerprint);
  if (!fingerprint || commercialFingerprint(snapshot) !== fingerprint) return null;
  const integrity = commercialSnapshotIntegrity(snapshot);
  if (!integrity.ok) return null;
  const storedId = normalizeCommercialId(text(data.commercial_version_id, id));
  if (!storedId || storedId !== normalizeCommercialId(id)) return null;
  if (normalizeCommercialId(data.order_id) !== normalizeCommercialId(snapshot.order_id)) return null;
  return {
    id: storedId,
    fingerprint,
    snapshot,
    previous_version_id: nullable(data.previous_version_id),
    reason: text(data.reason, "repriced") as CommercialVersionReason,
    created_at: text(data.created_at),
    created_by_name: text(data.created_by_name),
    created_by_email: text(data.created_by_email),
    source_references: data.source_references && typeof data.source_references === "object" ? data.source_references as Record<string, string | null> : {},
  };
}

export function persistCommercialVersionInTransaction(transaction: FirebaseFirestore.Transaction, version: CommercialVersion) {
  transaction.create(firebaseAdminDb().collection("commercial_versions").doc(version.id), commercialVersionDocument(version));
}

export function commercialOrderPointer(
  version: CommercialVersion,
  approvalStatus: "not_required" | "pending" | "approved" | "review_required" = version.snapshot.pricing?.approval_required ? "pending" : "not_required",
) {
  return {
    commercial_version_id: version.id,
    commercial_fingerprint: version.fingerprint,
    commercial_lineage_status: approvalStatus === "review_required" ? "commercial_review_required" : "active",
    pricing_approval_status: approvalStatus,
    pricing_approval_version_id: approvalStatus === "approved" ? version.id : null,
    pricing_approval_fingerprint: approvalStatus === "approved" ? version.fingerprint : null,
  };
}

export async function loadCommercialVersionInTransaction(
  transaction: FirebaseFirestore.Transaction,
  versionIdValue: unknown,
  fingerprintValue: unknown,
  expectedOrderId?: string | null,
): Promise<CommercialVersionResolution> {
  const id = normalizeCommercialId(versionIdValue);
  const expectedFingerprint = text(fingerprintValue);
  if (!id || !expectedFingerprint) return { kind: "missing_commercial_version" };
  const snapshot = await transaction.get(firebaseAdminDb().collection("commercial_versions").doc(id));
  if (!snapshot.exists) return { kind: "commercial_review_required", reason: "commercial_version_missing" };
  const version = commercialVersionFromDocument(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (!version || version.fingerprint !== expectedFingerprint) return { kind: "commercial_review_required", reason: "commercial_version_integrity" };
  if (expectedOrderId && normalizeCommercialId(version.snapshot.order_id) !== normalizeCommercialId(expectedOrderId)) return { kind: "commercial_review_required", reason: "commercial_version_order_mismatch" };
  return { kind: "ready", version, legacy_reconstructed: false };
}

export async function loadCommercialVersion(versionIdValue: unknown, fingerprintValue: unknown, expectedOrderId?: string | null): Promise<CommercialVersionResolution> {
  const id = normalizeCommercialId(versionIdValue);
  const expectedFingerprint = text(fingerprintValue);
  if (!id || !expectedFingerprint) return { kind: "missing_commercial_version" };
  const snapshot = await firebaseAdminDb().collection("commercial_versions").doc(id).get();
  if (!snapshot.exists) return { kind: "commercial_review_required", reason: "commercial_version_missing" };
  const version = commercialVersionFromDocument(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (!version || version.fingerprint !== expectedFingerprint) return { kind: "commercial_review_required", reason: "commercial_version_integrity" };
  if (expectedOrderId && normalizeCommercialId(version.snapshot.order_id) !== normalizeCommercialId(expectedOrderId)) return { kind: "commercial_review_required", reason: "commercial_version_order_mismatch" };
  return { kind: "ready", version, legacy_reconstructed: false };
}

function ratingQuantity(order: Record<string, unknown>, unit: string) {
  if (unit === "per_kg") return Math.max(0, numberOrNull(order.weight_kg) ?? 0);
  if (unit === "per_cbm") return Math.max(0, numberOrNull(order.volume_cbm) ?? 0);
  if (unit === "per_tonne") return Math.max(0, numberOrNull(order.weight_kg) ?? 0) / 1000;
  if (unit === "per_container") return Math.max(0, numberOrNull(order.container_count) ?? 0);
  if (unit === "per_piece") return Math.max(0, numberOrNull(order.pieces) ?? 0);
  return 1;
}

async function reconstructLegacySelectedVersion(
  transaction: FirebaseFirestore.Transaction,
  order: FirebaseFirestore.DocumentSnapshot,
  actor: Actor,
): Promise<CommercialVersionResolution> {
  const data = order.data() as Record<string, unknown>;
  if (text(data.status) === "booked" || nullable(data.shipment_reference)) return { kind: "commercial_review_required", reason: "legacy_booked_history_unproven" };
  const rateCardId = normalizeCommercialId(data.selected_rate_card_id);
  const selectedPartner = normalizeCommercialId(data.selected_partner_id);
  const selectedCurrency = normalizeCommercialCurrency(data.selected_currency);
  const selectedCost = numberOrNull(data.selected_cost);
  if (!rateCardId || !selectedPartner || !selectedCurrency || selectedCost === null || selectedCost < 0) return { kind: "missing_commercial_version" };
  const rateCard = await transaction.get(firebaseAdminDb().collection("partner_rate_cards").doc(rateCardId));
  if (!rateCard.exists) return { kind: "commercial_review_required", reason: "legacy_rate_card_missing" };
  const card = rateCard.data() as Record<string, unknown>;
  const cardPartner = normalizeCommercialId(card.partner_id);
  const cardCurrency = normalizeCommercialCurrency(card.currency);
  const unit = text(card.unit, "flat");
  const quantity = ratingQuantity(data, unit);
  const baseRate = Math.max(0, numberOrNull(card.rate) ?? 0);
  const rawLinehaul = baseRate * quantity;
  const minimum = Math.max(0, numberOrNull(card.minimum_charge) ?? 0);
  const linehaul = Math.max(rawLinehaul, minimum);
  const fuelPercent = Math.max(0, numberOrNull(card.fuel_surcharge_percent) ?? 0);
  const fuel = linehaul * fuelPercent / 100;
  const accessorials = Math.max(0, numberOrNull(card.accessorial_flat) ?? 0);
  const total = linehaul + fuel + accessorials;
  if (cardPartner !== selectedPartner || cardCurrency !== selectedCurrency || !sameCommercialMoney(total, selectedCost, selectedCurrency)) return { kind: "commercial_review_required", reason: "legacy_selected_economics_not_provable" };
  const branch = text(data.branch);
  const mode = text(data.mode);
  if (!branch || !mode) return { kind: "commercial_review_required", reason: "legacy_order_identity_missing" };
  const snapshot: CommercialSnapshot = {
    schema_version: COMMERCIAL_VERSION_SCHEMA,
    order_id: order.id,
    branch,
    customer_id: nullable(data.customer_id)?.toUpperCase() ?? null,
    mode,
    procurement: {
      rate_card_id: rateCardId,
      rate_card_updated_at: nullable(card.updated_at),
      rate_card_valid_from: nullable(card.valid_from),
      rate_card_valid_until: nullable(card.valid_until),
      partner_id: cardPartner,
      partner_name: nullable(card.partner_name),
      mode: text(card.mode, mode),
      service: nullable(card.service),
      equipment: nullable(card.equipment),
      rating_unit: unit,
      rating_quantity: quantity,
      base_rate: baseRate,
      base_charge: linehaul,
      minimum_charge: numberOrNull(card.minimum_charge),
      minimum_applied: linehaul > rawLinehaul + 0.000001,
      fuel_surcharge_percent: fuelPercent,
      fuel_surcharge: fuel,
      accessorials,
      total: selectedCost,
      currency: selectedCurrency,
    },
    pricing: null,
    fx: null,
    negotiation: null,
  };
  const version = newCommercialVersion({ snapshot, reason: "legacy_selected_reconstructed", actor, sourceReferences: { rate_card_id: rateCardId } });
  return { kind: "ready", version, legacy_reconstructed: true };
}

/** Legacy policy: only an unbooked selected record that can be exactly proved from its stored projection may be reconstructed. Booked history is never fabricated from today's rate card or FX. */
export async function resolveCurrentCommercialVersionInTransaction(transaction: FirebaseFirestore.Transaction, order: FirebaseFirestore.DocumentSnapshot, actor: Actor): Promise<CommercialVersionResolution> {
  const id = normalizeCommercialId(order.get("commercial_version_id"));
  const fingerprint = text(order.get("commercial_fingerprint"));
  if (id || fingerprint) {
    if (!id || !fingerprint) return { kind: "commercial_review_required", reason: "partial_commercial_pointer" };
    return loadCommercialVersionInTransaction(transaction, id, fingerprint, order.id);
  }
  return reconstructLegacySelectedVersion(transaction, order, actor);
}

export async function loadCommercialApprovalInTransaction(transaction: FirebaseFirestore.Transaction, version: CommercialVersion): Promise<CommercialApprovalAttestation | null> {
  if (!version.snapshot.pricing?.approval_required) return null;
  const approval = await transaction.get(firebaseAdminDb().collection("commercial_approvals").doc(version.id));
  if (!approval.exists) return null;
  const data = approval.data() as Record<string, unknown>;
  if (text(data.status) !== "approved") return null;
  const candidate: CommercialApprovalAttestation = {
    commercial_version_id: text(data.commercial_version_id),
    commercial_fingerprint: text(data.commercial_fingerprint),
    order_id: text(data.order_id),
    status: "approved",
    approved_at: text(data.approved_at),
    approved_by_name: text(data.approved_by_name),
    approved_by_email: text(data.approved_by_email),
    note: nullable(data.note),
  };
  return commercialApprovalSatisfied(version, candidate) ? candidate : null;
}

export function createCommercialApprovalInTransaction(transaction: FirebaseFirestore.Transaction, version: CommercialVersion, actor: Actor, note: string, now = new Date().toISOString()) {
  const ref = firebaseAdminDb().collection("commercial_approvals").doc(version.id);
  const approval: CommercialApprovalAttestation = {
    commercial_version_id: version.id, commercial_fingerprint: version.fingerprint, order_id: normalizeCommercialId(version.snapshot.order_id), status: "approved",
    approved_at: now, approved_by_name: actor.name, approved_by_email: actor.email, note: note.trim() || null,
  };
  transaction.create(ref, approval);
  return approval;
}

export async function assertBookableCommercialVersionInTransaction(transaction: FirebaseFirestore.Transaction, version: CommercialVersion) {
  const approval = await loadCommercialApprovalInTransaction(transaction, version);
  return { approval, decision: commercialVersionBookable(version, approval) };
}

export function commercialBookedSnapshotFields(version: CommercialVersion) {
  return {
    booked_commercial_version_id: version.id,
    booked_commercial_fingerprint: version.fingerprint,
    booked_commercial_snapshot: version.snapshot,
    expected_customer_revenue: version.snapshot.pricing?.sell_amount ?? null,
    expected_customer_revenue_currency: version.snapshot.pricing?.sell_currency ?? null,
    expected_procurement_cost: version.snapshot.procurement.total,
    expected_procurement_currency: version.snapshot.procurement.currency,
  };
}

export function commercialVersionMatchesPointer(version: CommercialVersion, id: unknown, fingerprint: unknown) {
  return normalizeCommercialId(id) === normalizeCommercialId(version.id) && text(fingerprint) === version.fingerprint;
}

export function legacyBookedCommercialSnapshot(shipment: Record<string, unknown>): CommercialSnapshot | null {
  const embedded = shipment.booked_commercial_snapshot;
  const id = normalizeCommercialId(shipment.booked_commercial_version_id);
  const fingerprint = text(shipment.booked_commercial_fingerprint);
  if (embedded && typeof embedded === "object" && id && fingerprint) {
    const snapshot = embedded as CommercialSnapshot;
    if (commercialFingerprint(snapshot) === fingerprint && commercialSnapshotIntegrity(snapshot).ok) return snapshot;
  }
  return null;
}

export function legacyBookedLineageStatus(shipment: Record<string, unknown>) {
  if (legacyBookedCommercialSnapshot(shipment)) return "versioned" as const;
  const cost = numberOrNull(shipment.procurement_cost);
  const currency = normalizeCommercialCurrency(shipment.procurement_currency);
  const partner = normalizeCommercialId(shipment.partner_id);
  const order = normalizeCommercialId(shipment.transport_order_id);
  const tender = normalizeCommercialId(shipment.tender_id);
  if (cost !== null && cost >= 0 && currency && partner && order && tender) return "legacy_snapshot_only" as const;
  return "commercial_review_required" as const;
}

export function commercialEventPayload(version: CommercialVersion, type: string, actor: Actor, detail?: string | null) {
  return {
    type, title: type.replaceAll("_", " "), detail: detail ?? `${version.id} · ${version.fingerprint.slice(0, 12)}`,
    commercial_version_id: version.id, commercial_fingerprint: version.fingerprint, previous_version_id: version.previous_version_id, reason: version.reason,
    actor_name: actor.name, actor_email: actor.email, created_at: new Date().toISOString(),
  };
}
