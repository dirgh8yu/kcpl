import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { customerSellEconomicsMatch } from "../commercial-authority/commercial-authority";
import {
  assertCustomerSellAuthorityInTransaction,
  prepareCustomerSellAuthorityCarryForwardInTransaction,
  persistPreparedCustomerSellAuthorityCarryForwardInTransaction,
  type CustomerSellAuthority,
} from "../commercial-authority/customer-sell-authority.server";
import {
  assertBookableCommercialVersionInTransaction,
  commercialEventPayload,
  commercialVersionFromDocument,
  createCommercialApprovalInTransaction,
  loadCommercialApprovalInTransaction,
  loadCommercialVersionInTransaction,
  persistCommercialVersionInTransaction,
} from "../commercial-lineage/commercial-lineage.server";
import {
  commercialFingerprint,
  deriveConsolidationAllocationSnapshot,
  normalizeCommercialCurrency,
  normalizeCommercialId,
  sameCommercialMoney,
  type CommercialVersion,
} from "../commercial-lineage/commercial-lineage";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { resolveTenderAuthority } from "../tenders/tms-tendering";
import {
  allocateConsolidationProcurement,
  consolidationAllocationApprovalStatus,
  consolidationAllocationStatuses,
  type ConsolidationAllocationApprovalView,
  type ConsolidationAllocationView,
} from "./tms-consolidation-allocation";
import { MAX_LOAD_ORDERS } from "./tms-consolidation";

type Actor = { name: string; email: string };
type LoadMember = {
  order_id: string;
  customer_id: string | null;
  weight_kg: number;
  volume_cbm: number;
  pieces: number;
};
type ReleasedSource = { orderId: string; versionId: string; fingerprint: string };
type PackageMember = {
  order_id: string;
  source_commercial_version_id: string;
  source_commercial_fingerprint: string;
  derived_commercial_version_id: string;
  derived_commercial_fingerprint: string;
  allocated_procurement: number;
  currency: CrmCurrency;
  basis_value: number;
  approval_required: boolean;
  approval_reasons: string[];
  gross_margin_percent: number | null;
};

type AllocationPackageData = {
  schema_version: number;
  package_id: string;
  package_fingerprint: string;
  load_id: string;
  branch: KcplBranch;
  status: "pending_approval" | "ready" | "booked" | "stale";
  released_manifest_fingerprint: string;
  released_manifest_locked_at: string;
  master_order_id: string;
  master_commercial_version_id: string;
  master_commercial_fingerprint: string;
  master_tender_id: string;
  master_tender_updated_at: string;
  procurement_partner_id: string;
  procurement_partner_name: string;
  master_rate_card_id: string;
  allocation_method: "automatic_physical_basis_v1";
  allocation_basis: "weight_kg" | "volume_cbm" | "pieces" | "equal";
  allocation_basis_total: number;
  allocation_currency: CrmCurrency;
  allocation_total: number;
  currency_decimals: number;
  rounding_strategy: "largest_remainder_then_order_id_desc";
  residual_units: number;
  residual_recipients: string[];
  members: PackageMember[];
  required_approvals: number;
  approved_approvals: number;
  pending_approvals: number;
  prepared_at: string;
  prepared_by_name: string;
  prepared_by_email: string;
  booked_at?: string | null;
  booked_by_name?: string | null;
  booked_by_email?: string | null;
  booking_reference?: string | null;
};

export type PreparedAllocationForBooking = {
  packageRef: FirebaseFirestore.DocumentReference;
  package: AllocationPackageData;
  sourceVersions: CommercialVersion[];
  derivedVersions: CommercialVersion[];
  customerAuthorities: CustomerSellAuthority[];
  allocations: Map<string, number>;
};

const PACKAGE_SCHEMA = 1;
const ALLOCATION_METHOD = "automatic_physical_basis_v1" as const;

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const output = text(value); return output || null; }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function currencyValue(value: unknown): CrmCurrency | null { return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : null; }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex").toUpperCase(); }
function packageId(fingerprint: string) { return `CAP-${fingerprint.slice(0, 40)}`; }
function derivedVersionId(fingerprint: string, orderId: string, sourceVersionId: string) {
  return `CV-ALLOC-${hash([fingerprint, normalizeCommercialId(orderId), normalizeCommercialId(sourceVersionId)]).slice(0, 40)}`;
}
function packageRef(id: string) { return firebaseAdminDb().collection("consolidation_allocation_packages").doc(normalizeCommercialId(id)); }

function loadMembers(load: FirebaseFirestore.DocumentSnapshot): LoadMember[] {
  const raw = load.get("members");
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (!item || typeof item !== "object") return null;
    const data = item as Record<string, unknown>;
    const orderId = normalizeCommercialId(data.order_id);
    const weight = numberValue(data.weight_kg);
    const volume = numberValue(data.volume_cbm);
    const pieces = numberValue(data.pieces);
    if (!orderId || weight === null || volume === null || pieces === null || weight < 0 || volume < 0 || pieces < 0) return null;
    return {
      order_id: orderId,
      customer_id: nullable(data.customer_id)?.toUpperCase() ?? null,
      weight_kg: weight,
      volume_cbm: volume,
      pieces,
    };
  }).filter((item): item is LoadMember => Boolean(item));
}

function releasedSources(load: FirebaseFirestore.DocumentSnapshot): ReleasedSource[] {
  const raw = load.get("released_commercial_sources");
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (!item || typeof item !== "object") return null;
    const data = item as Record<string, unknown>;
    const source = {
      orderId: normalizeCommercialId(data.order_id),
      versionId: normalizeCommercialId(data.commercial_version_id),
      fingerprint: text(data.commercial_fingerprint),
    };
    return source.orderId && source.versionId && source.fingerprint ? source : null;
  }).filter((item): item is ReleasedSource => Boolean(item));
}

function sameIdSet(left: string[], right: string[]) {
  const a = [...left].map(normalizeCommercialId).sort();
  const b = [...right].map(normalizeCommercialId).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function actualTenderCommercials(tender: FirebaseFirestore.DocumentSnapshot) {
  const status = text(tender.get("status"));
  if (status === "accepted") {
    const amount = numberValue(tender.get("offered_cost"));
    const currency = currencyValue(tender.get("currency"));
    return amount !== null && amount >= 0 && currency ? { amount, currency } : null;
  }
  if (status === "countered") {
    const amount = numberValue(tender.get("counter_cost"));
    const currency = currencyValue(tender.get("counter_currency"));
    return amount !== null && amount >= 0 && currency ? { amount, currency } : null;
  }
  return null;
}

function commercialPointerMatches(doc: FirebaseFirestore.DocumentSnapshot, version: CommercialVersion, prefix = "commercial") {
  return normalizeCommercialId(doc.get(`${prefix}_version_id`)) === version.id
    && text(doc.get(`${prefix}_fingerprint`)) === version.fingerprint;
}

function canonicalManifest(load: FirebaseFirestore.DocumentSnapshot, members: LoadMember[], sources: ReleasedSource[]) {
  return {
    load_id: load.id,
    locked_at: text(load.get("commercial_sources_locked_at")),
    members: [...members].sort((a, b) => a.order_id.localeCompare(b.order_id)).map((member) => ({
      order_id: member.order_id,
      customer_id: member.customer_id,
      weight_kg: member.weight_kg,
      volume_cbm: member.volume_cbm,
      pieces: member.pieces,
    })),
    sources: [...sources].sort((a, b) => a.orderId.localeCompare(b.orderId)).map((source) => ({
      order_id: source.orderId,
      commercial_version_id: source.versionId,
      commercial_fingerprint: source.fingerprint,
    })),
  };
}

function packageFingerprintPayload(input: {
  load: FirebaseFirestore.DocumentSnapshot;
  branch: KcplBranch;
  members: LoadMember[];
  sources: ReleasedSource[];
  masterOrderId: string;
  masterVersion: CommercialVersion;
  tender: FirebaseFirestore.DocumentSnapshot;
  partnerId: string;
  rateCardId: string;
  amount: number;
  currency: CrmCurrency;
  allocation: Extract<ReturnType<typeof allocateConsolidationProcurement>, { ok: true }>;
}) {
  const manifest = canonicalManifest(input.load, input.members, input.sources);
  return {
    schema_version: PACKAGE_SCHEMA,
    load_id: input.load.id,
    branch: input.branch,
    released_manifest_fingerprint: hash(manifest),
    released_manifest_locked_at: manifest.locked_at,
    master_order_id: input.masterOrderId,
    master_commercial_version_id: input.masterVersion.id,
    master_commercial_fingerprint: input.masterVersion.fingerprint,
    master_tender_id: input.tender.id,
    master_tender_updated_at: text(input.tender.get("updated_at")),
    procurement_partner_id: input.partnerId,
    master_rate_card_id: input.rateCardId,
    allocation_method: ALLOCATION_METHOD,
    allocation_basis: input.allocation.basis,
    allocation_basis_total: input.allocation.basis_total,
    allocation_currency: input.currency,
    allocation_total: input.allocation.total,
    currency_decimals: input.allocation.currency_decimals,
    rounding_strategy: input.allocation.rounding_strategy,
    residual_units: input.allocation.residual_units,
    residual_recipients: input.allocation.residual_recipients,
    allocations: input.allocation.allocations.map((item) => ({ order_id: item.order_id, amount: item.amount, basis_value: item.basis_value })),
    sources: [...input.sources].sort((a, b) => a.orderId.localeCompare(b.orderId)).map((source) => ({
      order_id: source.orderId,
      commercial_version_id: source.versionId,
      commercial_fingerprint: source.fingerprint,
    })),
  };
}

function deterministicDerivedVersion(input: {
  source: CommercialVersion;
  packageId: string;
  packageFingerprint: string;
  loadId: string;
  masterVersion: CommercialVersion;
  tender: FirebaseFirestore.DocumentSnapshot;
  amount: number;
  currency: CrmCurrency;
  partnerId: string;
  partnerName: string;
  rateCardId: string;
  rateCardBranch: string;
  masterOrder: FirebaseFirestore.DocumentSnapshot;
  actor: Actor;
  now: string;
}) {
  const snapshot = deriveConsolidationAllocationSnapshot(input.source.snapshot, {
    amount: input.amount,
    currency: input.currency,
    partnerId: input.partnerId,
    partnerName: input.partnerName,
    masterRateCardId: input.rateCardId,
    masterRateCardBranch: input.rateCardBranch,
    masterRateCardOrigin: input.masterVersion.snapshot.procurement.rate_card_origin ?? null,
    masterRateCardDestination: input.masterVersion.snapshot.procurement.rate_card_destination ?? null,
    mode: text(input.masterOrder.get("mode")),
  });
  return {
    id: derivedVersionId(input.packageFingerprint, input.source.snapshot.order_id, input.source.id),
    fingerprint: commercialFingerprint(snapshot),
    snapshot,
    previous_version_id: input.source.id,
    reason: "consolidation_allocation" as const,
    created_at: input.now,
    created_by_name: input.actor.name,
    created_by_email: input.actor.email,
    source_references: {
      consolidation_load_id: input.loadId,
      consolidation_allocation_package_id: input.packageId,
      consolidation_allocation_package_fingerprint: input.packageFingerprint,
      master_commercial_version_id: input.masterVersion.id,
      master_tender_id: input.tender.id,
      source_house_commercial_version_id: input.source.id,
    },
  } satisfies CommercialVersion;
}

function sameSourceReferences(left: Record<string, string | null>, right: Record<string, string | null>) {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  return keys.every((key) => (left[key] ?? null) === (right[key] ?? null));
}

function existingDerivedMatches(snapshot: FirebaseFirestore.DocumentSnapshot, expected: CommercialVersion) {
  if (!snapshot.exists) return false;
  const existing = commercialVersionFromDocument(snapshot.id, snapshot.data() as Record<string, unknown>);
  return Boolean(existing
    && existing.id === expected.id
    && existing.fingerprint === expected.fingerprint
    && existing.previous_version_id === expected.previous_version_id
    && existing.reason === expected.reason
    && sameSourceReferences(existing.source_references, expected.source_references));
}

function packageFromDocument(snapshot: FirebaseFirestore.DocumentSnapshot): AllocationPackageData | null {
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Record<string, unknown>;
  const branch = branchValue(data.branch);
  const currency = currencyValue(data.allocation_currency);
  const status = text(data.status);
  if (Number(data.schema_version) !== PACKAGE_SCHEMA || !branch || !currency || !consolidationAllocationStatuses.includes(status as AllocationPackageData["status"])) return null;
  const membersRaw = Array.isArray(data.members) ? data.members : [];
  const members: PackageMember[] = [];
  for (const item of membersRaw) {
    if (!item || typeof item !== "object") return null;
    const value = item as Record<string, unknown>;
    const memberCurrency = currencyValue(value.currency);
    const amount = numberValue(value.allocated_procurement);
    const basisValue = numberValue(value.basis_value);
    const margin = value.gross_margin_percent === null ? null : numberValue(value.gross_margin_percent);
    const member: PackageMember = {
      order_id: normalizeCommercialId(value.order_id),
      source_commercial_version_id: normalizeCommercialId(value.source_commercial_version_id),
      source_commercial_fingerprint: text(value.source_commercial_fingerprint),
      derived_commercial_version_id: normalizeCommercialId(value.derived_commercial_version_id),
      derived_commercial_fingerprint: text(value.derived_commercial_fingerprint),
      allocated_procurement: amount ?? Number.NaN,
      currency: memberCurrency ?? currency,
      basis_value: basisValue ?? Number.NaN,
      approval_required: value.approval_required === true,
      approval_reasons: Array.isArray(value.approval_reasons) ? value.approval_reasons.filter((reason): reason is string => typeof reason === "string") : [],
      gross_margin_percent: margin,
    };
    if (!member.order_id || !member.source_commercial_version_id || !member.source_commercial_fingerprint || !member.derived_commercial_version_id || !member.derived_commercial_fingerprint
      || !Number.isFinite(member.allocated_procurement) || member.allocated_procurement < 0 || !Number.isFinite(member.basis_value) || member.basis_value < 0) return null;
    members.push(member);
  }
  const allocationTotal = numberValue(data.allocation_total);
  const basisTotal = numberValue(data.allocation_basis_total);
  const decimals = numberValue(data.currency_decimals);
  const residual = numberValue(data.residual_units);
  const packageData: AllocationPackageData = {
    schema_version: PACKAGE_SCHEMA,
    package_id: normalizeCommercialId(data.package_id),
    package_fingerprint: text(data.package_fingerprint),
    load_id: normalizeCommercialId(data.load_id),
    branch,
    status: status as AllocationPackageData["status"],
    released_manifest_fingerprint: text(data.released_manifest_fingerprint),
    released_manifest_locked_at: text(data.released_manifest_locked_at),
    master_order_id: normalizeCommercialId(data.master_order_id),
    master_commercial_version_id: normalizeCommercialId(data.master_commercial_version_id),
    master_commercial_fingerprint: text(data.master_commercial_fingerprint),
    master_tender_id: normalizeCommercialId(data.master_tender_id),
    master_tender_updated_at: text(data.master_tender_updated_at),
    procurement_partner_id: normalizeCommercialId(data.procurement_partner_id),
    procurement_partner_name: text(data.procurement_partner_name),
    master_rate_card_id: normalizeCommercialId(data.master_rate_card_id),
    allocation_method: text(data.allocation_method) as AllocationPackageData["allocation_method"],
    allocation_basis: text(data.allocation_basis) as AllocationPackageData["allocation_basis"],
    allocation_basis_total: basisTotal ?? Number.NaN,
    allocation_currency: currency,
    allocation_total: allocationTotal ?? Number.NaN,
    currency_decimals: decimals ?? Number.NaN,
    rounding_strategy: text(data.rounding_strategy) as AllocationPackageData["rounding_strategy"],
    residual_units: residual ?? Number.NaN,
    residual_recipients: Array.isArray(data.residual_recipients) ? data.residual_recipients.filter((id): id is string => typeof id === "string").map(normalizeCommercialId) : [],
    members,
    required_approvals: Math.max(0, Math.trunc(numberValue(data.required_approvals) ?? 0)),
    approved_approvals: Math.max(0, Math.trunc(numberValue(data.approved_approvals) ?? 0)),
    pending_approvals: Math.max(0, Math.trunc(numberValue(data.pending_approvals) ?? 0)),
    prepared_at: text(data.prepared_at),
    prepared_by_name: text(data.prepared_by_name),
    prepared_by_email: text(data.prepared_by_email),
    booked_at: nullable(data.booked_at),
    booked_by_name: nullable(data.booked_by_name),
    booked_by_email: nullable(data.booked_by_email),
    booking_reference: nullable(data.booking_reference),
  };
  return packageData.package_id === snapshot.id
    && packageData.package_fingerprint
    && packageData.load_id
    && packageData.master_order_id
    && packageData.master_commercial_version_id
    && packageData.master_commercial_fingerprint
    && packageData.master_tender_id
    && packageData.procurement_partner_id
    && packageData.master_rate_card_id
    && packageData.allocation_method === ALLOCATION_METHOD
    && ["weight_kg", "volume_cbm", "pieces", "equal"].includes(packageData.allocation_basis)
    && Number.isFinite(packageData.allocation_basis_total)
    && Number.isFinite(packageData.allocation_total)
    && Number.isFinite(packageData.currency_decimals)
    && packageData.rounding_strategy === "largest_remainder_then_order_id_desc"
    ? packageData : null;
}

function packageImmutableMatches(existing: AllocationPackageData, expected: Omit<AllocationPackageData, "prepared_at" | "prepared_by_name" | "prepared_by_email" | "status" | "required_approvals" | "approved_approvals" | "pending_approvals">) {
  return existing.package_id === expected.package_id
    && existing.package_fingerprint === expected.package_fingerprint
    && existing.load_id === expected.load_id
    && existing.branch === expected.branch
    && existing.released_manifest_fingerprint === expected.released_manifest_fingerprint
    && existing.released_manifest_locked_at === expected.released_manifest_locked_at
    && existing.master_order_id === expected.master_order_id
    && existing.master_commercial_version_id === expected.master_commercial_version_id
    && existing.master_commercial_fingerprint === expected.master_commercial_fingerprint
    && existing.master_tender_id === expected.master_tender_id
    && existing.master_tender_updated_at === expected.master_tender_updated_at
    && existing.procurement_partner_id === expected.procurement_partner_id
    && existing.master_rate_card_id === expected.master_rate_card_id
    && existing.allocation_method === expected.allocation_method
    && existing.allocation_basis === expected.allocation_basis
    && existing.allocation_basis_total === expected.allocation_basis_total
    && existing.allocation_currency === expected.allocation_currency
    && sameCommercialMoney(existing.allocation_total, expected.allocation_total, expected.allocation_currency)
    && existing.currency_decimals === expected.currency_decimals
    && existing.rounding_strategy === expected.rounding_strategy
    && existing.residual_units === expected.residual_units
    && JSON.stringify(existing.residual_recipients) === JSON.stringify(expected.residual_recipients)
    && existing.members.length === expected.members.length
    && existing.members.every((member, index) => {
      const candidate = expected.members[index];
      return Boolean(candidate
        && member.order_id === candidate.order_id
        && member.source_commercial_version_id === candidate.source_commercial_version_id
        && member.source_commercial_fingerprint === candidate.source_commercial_fingerprint
        && member.derived_commercial_version_id === candidate.derived_commercial_version_id
        && member.derived_commercial_fingerprint === candidate.derived_commercial_fingerprint
        && sameCommercialMoney(member.allocated_procurement, candidate.allocated_procurement, candidate.currency)
        && member.currency === candidate.currency
        && member.basis_value === candidate.basis_value
        && member.approval_required === candidate.approval_required);
    });
}

function safeApprovalView(member: PackageMember, approved: boolean): ConsolidationAllocationApprovalView {
  return {
    order_id: member.order_id,
    commercial_version_id: member.derived_commercial_version_id,
    approval_required: member.approval_required,
    approval_status: member.approval_required ? approved ? "approved" : "pending" : "not_required",
    approval_reasons: member.approval_reasons,
    gross_margin_percent: member.gross_margin_percent,
  };
}

async function authoritativeMasterTender(transaction: FirebaseFirestore.Transaction, masterOrder: FirebaseFirestore.DocumentSnapshot, now: string) {
  const tenders = await transaction.get(firebaseAdminDb().collection("transport_tenders").where("order_id", "==", masterOrder.id));
  const live = tenders.docs.filter((doc) => {
    const status = text(doc.get("status"));
    if (!["sent", "accepted", "countered"].includes(status)) return false;
    return !(status === "sent" && text(doc.get("response_due_at")) && text(doc.get("response_due_at")) <= now);
  });
  const liveIds = live.map((doc) => doc.id);
  const candidates = live.filter((doc) => ["accepted", "countered"].includes(text(doc.get("status"))));
  const authoritative = candidates.filter((doc) => {
    const decision = resolveTenderAuthority(nullable(masterOrder.get("active_tender_id")), liveIds, doc.id);
    return decision === "authoritative" || decision === "legacy_unique";
  });
  return authoritative.length === 1 ? authoritative[0] : null;
}

export async function prepareConsolidationCommercialAllocation(loadIdValue: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const loadRef = db.collection("consolidation_loads").doc(normalizeCommercialId(loadIdValue));
  const now = new Date().toISOString();

  try {
    return await db.runTransaction(async (transaction) => {
      // READ PHASE: no transaction writes occur until every authority read below completes.
      const load = await transaction.get(loadRef);
      if (!load.exists) return { kind: "missing_load" as const };
      const branch = branchValue(load.get("branch"));
      if (!branch || !staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
      if (!["ready_for_procurement", "tendering"].includes(text(load.get("status")))) return { kind: "invalid_transition" as const };

      const members = loadMembers(load);
      const sources = releasedSources(load);
      if (members.length < 2 || members.length > MAX_LOAD_ORDERS || sources.length !== members.length || !sameIdSet(members.map((member) => member.order_id), sources.map((source) => source.orderId))) return { kind: "commercial_allocation_stale" as const };
      const manifest = canonicalManifest(load, members, sources);
      if (!manifest.locked_at) return { kind: "commercial_allocation_stale" as const };

      const masterOrderId = normalizeCommercialId(load.get("master_order_id"));
      if (!masterOrderId) return { kind: "invalid_master" as const };
      const masterOrderRef = db.collection("transport_orders").doc(masterOrderId);
      const masterOrder = await transaction.get(masterOrderRef);
      if (!masterOrder.exists || masterOrder.get("is_consolidation_master") !== true || normalizeCommercialId(masterOrder.get("consolidation_load_id")) !== load.id || branchValue(masterOrder.get("branch")) !== branch) return { kind: "invalid_master" as const };

      const tender = await authoritativeMasterTender(transaction, masterOrder, now);
      if (!tender) return { kind: "tender_required" as const };
      if (branchValue(tender.get("branch")) !== branch) return { kind: "commercial_allocation_stale" as const };
      const commercials = actualTenderCommercials(tender);
      if (!commercials) return { kind: "tender_required" as const };

      const masterVersionResult = await loadCommercialVersionInTransaction(transaction, tender.get("commercial_version_id"), tender.get("commercial_fingerprint"), masterOrder.id);
      if (masterVersionResult.kind !== "ready") return { kind: "commercial_review_required" as const };
      const masterVersion = masterVersionResult.version;
      if (!commercialPointerMatches(masterOrder, masterVersion)) return { kind: "commercial_allocation_stale" as const };
      const finalVersionId = normalizeCommercialId(tender.get("final_commercial_version_id"));
      const finalFingerprint = text(tender.get("final_commercial_fingerprint"));
      if ((finalVersionId && finalVersionId !== masterVersion.id) || (finalFingerprint && finalFingerprint !== masterVersion.fingerprint)) return { kind: "commercial_allocation_stale" as const };
      if (masterVersion.snapshot.pricing) {
        const masterBookable = await assertBookableCommercialVersionInTransaction(transaction, masterVersion);
        if (!masterBookable.decision.ok) return { kind: masterBookable.decision.reason };
      }
      if (normalizeCommercialCurrency(masterVersion.snapshot.procurement.currency) !== commercials.currency || !sameCommercialMoney(masterVersion.snapshot.procurement.total, commercials.amount, commercials.currency)) return { kind: "commercial_allocation_stale" as const };

      const partnerId = normalizeCommercialId(tender.get("partner_id"));
      const partnerName = text(tender.get("partner_name"), partnerId || "Partner");
      const rateCardId = normalizeCommercialId(tender.get("rate_card_id"));
      const masterRateBranch = masterVersion.snapshot.procurement.rate_card_branch?.trim() ?? "";
      if (!partnerId || !rateCardId || partnerId !== normalizeCommercialId(masterVersion.snapshot.procurement.partner_id) || !masterRateBranch || (masterRateBranch !== "Global" && masterRateBranch !== branch)) return { kind: "commercial_review_required" as const };

      const houseRefs = members.map((member) => db.collection("transport_orders").doc(member.order_id));
      const houseOrders = await Promise.all(houseRefs.map((ref) => transaction.get(ref)));
      if (houseOrders.some((order) => !order.exists)) return { kind: "missing_order" as const };
      const sourceMap = new Map(sources.map((source) => [source.orderId, source]));
      for (const order of houseOrders) {
        const source = sourceMap.get(order.id);
        if (!source || branchValue(order.get("branch")) !== branch || !normalizeCommercialId(order.get("customer_id"))) return { kind: "commercial_allocation_stale" as const };
        if (normalizeCommercialId(order.get("consolidation_load_id")) !== load.id || normalizeCommercialId(order.get("consolidation_master_order_id")) !== masterOrder.id || order.get("procurement_locked_by_load") !== true
          || normalizeCommercialId(order.get("consolidation_source_commercial_version_id")) !== source.versionId || text(order.get("consolidation_source_commercial_fingerprint")) !== source.fingerprint
          || normalizeCommercialId(order.get("commercial_version_id")) !== source.versionId || text(order.get("commercial_fingerprint")) !== source.fingerprint
          || text(order.get("status")) === "booked" || nullable(order.get("shipment_reference"))) return { kind: "commercial_allocation_stale" as const };
      }

      const sourceVersions: CommercialVersion[] = [];
      for (const order of houseOrders) {
        const released = sourceMap.get(order.id)!;
        const source = await loadCommercialVersionInTransaction(transaction, released.versionId, released.fingerprint, order.id);
        if (source.kind !== "ready") return { kind: "commercial_review_required" as const };
        const bookable = await assertBookableCommercialVersionInTransaction(transaction, source.version);
        if (!bookable.decision.ok) return { kind: bookable.decision.reason };
        sourceVersions.push(source.version);
      }

      const allocation = allocateConsolidationProcurement(commercials.amount, commercials.currency, members);
      if (!allocation.ok) return { kind: "commercial_review_required" as const };
      const fingerprintPayload = packageFingerprintPayload({ load, branch, members, sources, masterOrderId, masterVersion, tender, partnerId, rateCardId, amount: commercials.amount, currency: commercials.currency, allocation });
      const packageFingerprint = hash(fingerprintPayload);
      const id = packageId(packageFingerprint);
      const allocationMap = new Map(allocation.allocations.map((item) => [item.order_id, item]));
      const derivedVersions: CommercialVersion[] = [];
      const packageMembers: PackageMember[] = [];
      for (const source of sourceVersions) {
        const allocated = allocationMap.get(normalizeCommercialId(source.snapshot.order_id));
        if (!allocated) return { kind: "commercial_allocation_stale" as const };
        const derived = deterministicDerivedVersion({
          source, packageId: id, packageFingerprint, loadId: load.id, masterVersion, tender,
          amount: allocated.amount, currency: commercials.currency, partnerId, partnerName, rateCardId,
          rateCardBranch: masterRateBranch, masterOrder, actor, now,
        });
        const pricing = derived.snapshot.pricing;
        if (!pricing || pricing.converted_buy_cost === null) return { kind: "commercial_review_required" as const };
        if (!customerSellEconomicsMatch(source.snapshot, derived.snapshot)) return { kind: "customer_quote_stale" as const };
        derivedVersions.push(derived);
        packageMembers.push({
          order_id: normalizeCommercialId(source.snapshot.order_id),
          source_commercial_version_id: source.id,
          source_commercial_fingerprint: source.fingerprint,
          derived_commercial_version_id: derived.id,
          derived_commercial_fingerprint: derived.fingerprint,
          allocated_procurement: allocated.amount,
          currency: commercials.currency,
          basis_value: allocated.basis_value,
          approval_required: pricing.approval_required,
          approval_reasons: pricing.approval_reasons,
          gross_margin_percent: pricing.gross_margin_percent,
        });
      }
      packageMembers.sort((a, b) => a.order_id.localeCompare(b.order_id));

      const carryForwards = [] as Awaited<ReturnType<typeof prepareCustomerSellAuthorityCarryForwardInTransaction>>[];
      for (let index = 0; index < sourceVersions.length; index += 1) {
        const prepared = await prepareCustomerSellAuthorityCarryForwardInTransaction(transaction, sourceVersions[index], derivedVersions[index], actor, now);
        if (prepared.kind === "not_carried") return { kind: "customer_acceptance_required" as const };
        if (prepared.kind === "conflict") return { kind: "customer_quote_stale" as const };
        carryForwards.push(prepared);
      }

      const targetPackageRef = packageRef(id);
      const targetPackageSnapshot = await transaction.get(targetPackageRef);
      const derivedRefs = derivedVersions.map((version) => db.collection("commercial_versions").doc(version.id));
      const existingDerived = await Promise.all(derivedRefs.map((ref) => transaction.get(ref)));
      const approvals = new Map<string, boolean>();
      for (const version of derivedVersions) {
        const approval = await loadCommercialApprovalInTransaction(transaction, version);
        approvals.set(version.id, Boolean(approval));
      }

      const currentPackageId = normalizeCommercialId(load.get("current_allocation_package_id"));
      let oldPackage: FirebaseFirestore.DocumentSnapshot | null = null;
      if (currentPackageId && currentPackageId !== id) oldPackage = await transaction.get(packageRef(currentPackageId));

      const approvalState = consolidationAllocationApprovalStatus(packageMembers.map((member) => ({ approval_required: member.approval_required, approved: approvals.get(member.derived_commercial_version_id) === true })));
      const immutablePackage = {
        schema_version: PACKAGE_SCHEMA,
        package_id: id,
        package_fingerprint: packageFingerprint,
        load_id: load.id,
        branch,
        released_manifest_fingerprint: hash(manifest),
        released_manifest_locked_at: manifest.locked_at,
        master_order_id: masterOrder.id,
        master_commercial_version_id: masterVersion.id,
        master_commercial_fingerprint: masterVersion.fingerprint,
        master_tender_id: tender.id,
        master_tender_updated_at: text(tender.get("updated_at")),
        procurement_partner_id: partnerId,
        procurement_partner_name: partnerName,
        master_rate_card_id: rateCardId,
        allocation_method: ALLOCATION_METHOD,
        allocation_basis: allocation.basis,
        allocation_basis_total: allocation.basis_total,
        allocation_currency: commercials.currency,
        allocation_total: allocation.total,
        currency_decimals: allocation.currency_decimals,
        rounding_strategy: allocation.rounding_strategy,
        residual_units: allocation.residual_units,
        residual_recipients: allocation.residual_recipients,
        members: packageMembers,
      } satisfies Omit<AllocationPackageData, "prepared_at" | "prepared_by_name" | "prepared_by_email" | "status" | "required_approvals" | "approved_approvals" | "pending_approvals">;

      if (targetPackageSnapshot.exists) {
        const existingPackage = packageFromDocument(targetPackageSnapshot);
        if (!existingPackage || !packageImmutableMatches(existingPackage, immutablePackage)) return { kind: "commercial_allocation_stale" as const };
      }
      for (let index = 0; index < existingDerived.length; index += 1) {
        if (existingDerived[index].exists && !existingDerivedMatches(existingDerived[index], derivedVersions[index])) return { kind: "commercial_allocation_stale" as const };
      }

      // WRITE PHASE: every transaction.get/query/authority read has completed above.
      for (let index = 0; index < derivedVersions.length; index += 1) {
        if (!existingDerived[index].exists) persistCommercialVersionInTransaction(transaction, derivedVersions[index]);
        persistPreparedCustomerSellAuthorityCarryForwardInTransaction(transaction, carryForwards[index]);
      }
      if (!targetPackageSnapshot.exists) {
        transaction.create(targetPackageRef, {
          ...immutablePackage,
          status: approvalState.status,
          required_approvals: approvalState.required,
          approved_approvals: approvalState.approved,
          pending_approvals: approvalState.pending,
          prepared_at: now,
          prepared_by_name: actor.name,
          prepared_by_email: actor.email,
          booked_at: null,
          booked_by_name: null,
          booked_by_email: null,
          booking_reference: null,
        });
      } else {
        transaction.update(targetPackageRef, {
          status: approvalState.status,
          required_approvals: approvalState.required,
          approved_approvals: approvalState.approved,
          pending_approvals: approvalState.pending,
        });
      }
      if (oldPackage?.exists && text(oldPackage.get("status")) !== "booked") transaction.update(oldPackage.ref, { status: "stale", superseded_by_package_id: id, superseded_at: now });
      transaction.update(loadRef, {
        current_allocation_package_id: id,
        current_allocation_package_fingerprint: packageFingerprint,
        commercial_allocation_status: approvalState.status,
        commercial_allocation_prepared_at: targetPackageSnapshot.exists ? text(targetPackageSnapshot.get("prepared_at"), now) : now,
        updated_at: now,
      });
      if (!targetPackageSnapshot.exists) {
        transaction.create(loadRef.collection("events").doc(`allocation-${id}`), {
          type: "consolidation_commercial_allocation_prepared",
          title: "Consolidation commercial allocation prepared",
          detail: `${packageMembers.length} house versions · ${approvalState.required} Management approval${approvalState.required === 1 ? "" : "s"} required`,
          allocation_package_id: id,
          allocation_package_fingerprint: packageFingerprint,
          actor_name: actor.name,
          actor_email: actor.email,
          created_at: now,
        });
      }

      return {
        kind: approvalState.status === "ready" ? "ready" as const : "approval_required" as const,
        packageId: id,
        packageFingerprint,
        idempotent: targetPackageSnapshot.exists,
        requiredApprovals: packageMembers.filter((member) => member.approval_required).map((member) => safeApprovalView(member, approvals.get(member.derived_commercial_version_id) === true)),
      };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function approveConsolidationCommercialAllocationVersion(input: {
  loadId: string;
  packageId: string;
  commercialVersionId: string;
  note: string;
}, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (staff.permissions.role !== "management") return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const loadRef = db.collection("consolidation_loads").doc(normalizeCommercialId(input.loadId));
  const targetPackageRef = packageRef(input.packageId);
  const versionId = normalizeCommercialId(input.commercialVersionId);
  const now = new Date().toISOString();
  try {
    return await db.runTransaction(async (transaction) => {
      // READ PHASE.
      const [load, packageSnapshot] = await Promise.all([transaction.get(loadRef), transaction.get(targetPackageRef)]);
      if (!load.exists || !packageSnapshot.exists) return { kind: "missing" as const };
      const branch = branchValue(load.get("branch"));
      if (!branch || !staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
      const packageData = packageFromDocument(packageSnapshot);
      if (!packageData || packageData.load_id !== load.id || packageData.branch !== branch) return { kind: "commercial_allocation_stale" as const };
      if (normalizeCommercialId(load.get("current_allocation_package_id")) !== packageData.package_id || text(load.get("current_allocation_package_fingerprint")) !== packageData.package_fingerprint || packageData.status === "stale" || packageData.status === "booked") return { kind: "commercial_allocation_stale" as const };
      if (!["ready_for_procurement", "tendering"].includes(text(load.get("status")))) return { kind: "invalid_transition" as const };
      const targetMember = packageData.members.find((member) => member.derived_commercial_version_id === versionId);
      if (!targetMember || !targetMember.approval_required) return { kind: "not_required" as const };

      const versions = new Map<string, CommercialVersion>();
      const approvals = new Map<string, boolean>();
      for (const member of packageData.members.filter((candidate) => candidate.approval_required)) {
        const resolved = await loadCommercialVersionInTransaction(transaction, member.derived_commercial_version_id, member.derived_commercial_fingerprint, member.order_id);
        if (resolved.kind !== "ready") return { kind: "commercial_allocation_stale" as const };
        versions.set(member.derived_commercial_version_id, resolved.version);
        const existing = await loadCommercialApprovalInTransaction(transaction, resolved.version);
        approvals.set(member.derived_commercial_version_id, Boolean(existing));
      }
      const targetVersion = versions.get(versionId);
      if (!targetVersion || targetVersion.fingerprint !== targetMember.derived_commercial_fingerprint || !targetVersion.snapshot.pricing?.approval_required) return { kind: "commercial_allocation_stale" as const };
      const alreadyApproved = approvals.get(versionId) === true;
      const after = packageData.members.map((member) => ({
        approval_required: member.approval_required,
        approved: member.derived_commercial_version_id === versionId ? true : approvals.get(member.derived_commercial_version_id) === true,
      }));
      const approvalState = consolidationAllocationApprovalStatus(after);

      // WRITE PHASE.
      if (!alreadyApproved) createCommercialApprovalInTransaction(transaction, targetVersion, actor, input.note, now);
      transaction.update(targetPackageRef, {
        status: approvalState.status,
        required_approvals: approvalState.required,
        approved_approvals: approvalState.approved,
        pending_approvals: approvalState.pending,
      });
      transaction.update(loadRef, { commercial_allocation_status: approvalState.status, updated_at: now });
      if (!alreadyApproved) {
        transaction.create(loadRef.collection("events").doc(`allocation-approval-${versionId}`), {
          ...commercialEventPayload(targetVersion, "consolidation_allocation_commercial_approved", actor, input.note.trim() || targetVersion.snapshot.pricing.approval_reasons.join(" ")),
          allocation_package_id: packageData.package_id,
          approved_at: now,
        });
      }
      return { kind: "approved" as const, packageId: packageData.package_id, commercialVersionId: versionId, packageStatus: approvalState.status, idempotent: alreadyApproved };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

function approvalMatchesPackage(approval: FirebaseFirestore.DocumentSnapshot | undefined, member: PackageMember) {
  return Boolean(approval?.exists
    && text(approval.get("status")) === "approved"
    && normalizeCommercialId(approval.get("commercial_version_id")) === member.derived_commercial_version_id
    && text(approval.get("commercial_fingerprint")) === member.derived_commercial_fingerprint
    && normalizeCommercialId(approval.get("order_id")) === member.order_id);
}

export async function listCurrentConsolidationAllocationViews(loadIds: string[], staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured() || !loadIds.length) return new Map<string, ConsolidationAllocationView>();
  const db = firebaseAdminDb();
  const uniqueLoadIds = [...new Set(loadIds.map(normalizeCommercialId).filter(Boolean))];
  const loadSnapshots = await db.getAll(...uniqueLoadIds.map((id) => db.collection("consolidation_loads").doc(id)));
  const packageIds = loadSnapshots.map((load) => normalizeCommercialId(load.get("current_allocation_package_id"))).filter(Boolean);
  const packageSnapshots = packageIds.length ? await db.getAll(...packageIds.map((id) => packageRef(id))) : [];
  const packageMap = new Map(packageSnapshots.map((snapshot) => [snapshot.id, snapshot]));
  const requiredMembers = packageSnapshots.flatMap((snapshot) => {
    const data = packageFromDocument(snapshot);
    return data ? data.members.filter((member) => member.approval_required) : [];
  });
  const approvalSnapshots = requiredMembers.length
    ? await db.getAll(...requiredMembers.map((member) => db.collection("commercial_approvals").doc(member.derived_commercial_version_id)))
    : [];
  const approvalMap = new Map(approvalSnapshots.map((snapshot) => [snapshot.id, snapshot]));
  const result = new Map<string, ConsolidationAllocationView>();
  for (const load of loadSnapshots) {
    if (!load.exists) continue;
    const branch = branchValue(load.get("branch"));
    if (!branch || !staffCanAccessBranch(staff, branch)) continue;
    const id = normalizeCommercialId(load.get("current_allocation_package_id"));
    const snapshot = packageMap.get(id);
    if (!snapshot) continue;
    const packageData = packageFromDocument(snapshot);
    if (!packageData || packageData.load_id !== load.id || packageData.branch !== branch) continue;
    const approvals = packageData.members.map((member) => safeApprovalView(member, approvalMatchesPackage(approvalMap.get(member.derived_commercial_version_id), member)));
    const state = consolidationAllocationApprovalStatus(approvals.map((approval) => ({ approval_required: approval.approval_required, approved: approval.approval_status === "approved" })));
    const status = packageData.status === "booked" || packageData.status === "stale" ? packageData.status : state.status;
    result.set(load.id, {
      package_id: packageData.package_id,
      status,
      prepared_at: packageData.prepared_at,
      prepared_by_name: packageData.prepared_by_name,
      allocation_method: packageData.allocation_method,
      allocation_basis: packageData.allocation_basis,
      currency: packageData.allocation_currency,
      total: packageData.allocation_total,
      required_approvals: state.required,
      approved_approvals: state.approved,
      pending_approvals: state.pending,
      approvals,
    });
  }
  return result;
}

export async function loadPreparedConsolidationAllocationForBookingInTransaction(transaction: FirebaseFirestore.Transaction, input: {
  load: FirebaseFirestore.DocumentSnapshot;
  branch: KcplBranch;
  masterOrder: FirebaseFirestore.DocumentSnapshot;
  tender: FirebaseFirestore.DocumentSnapshot;
  masterVersion: CommercialVersion;
  houseOrders: FirebaseFirestore.DocumentSnapshot[];
}): Promise<
  | { kind: "ready"; prepared: PreparedAllocationForBooking }
  | { kind: "allocation_not_prepared" | "commercial_allocation_stale" | "approval_required" | "customer_acceptance_required" | "customer_quote_stale" | "commercial_review_required" }
> {
  const packageIdValue = normalizeCommercialId(input.load.get("current_allocation_package_id"));
  const packageFingerprintValue = text(input.load.get("current_allocation_package_fingerprint"));
  if (!packageIdValue || !packageFingerprintValue) return { kind: "allocation_not_prepared" };
  const targetPackageRef = packageRef(packageIdValue);
  const snapshot = await transaction.get(targetPackageRef);
  const packageData = packageFromDocument(snapshot);
  if (!packageData || packageData.status === "stale" || packageData.status === "booked" || packageData.package_fingerprint !== packageFingerprintValue
    || packageData.load_id !== input.load.id || packageData.branch !== input.branch || packageData.master_order_id !== input.masterOrder.id
    || packageData.master_tender_id !== input.tender.id || packageData.master_tender_updated_at !== text(input.tender.get("updated_at"))
    || packageData.master_commercial_version_id !== input.masterVersion.id || packageData.master_commercial_fingerprint !== input.masterVersion.fingerprint) return { kind: "commercial_allocation_stale" };

  const members = loadMembers(input.load);
  const sources = releasedSources(input.load);
  const manifest = canonicalManifest(input.load, members, sources);
  if (!manifest.locked_at || hash(manifest) !== packageData.released_manifest_fingerprint || text(input.load.get("commercial_sources_locked_at")) !== packageData.released_manifest_locked_at
    || !sameIdSet(members.map((member) => member.order_id), packageData.members.map((member) => member.order_id))
    || input.houseOrders.length !== packageData.members.length) return { kind: "commercial_allocation_stale" };

  const commercials = actualTenderCommercials(input.tender);
  if (!commercials || commercials.currency !== packageData.allocation_currency || !sameCommercialMoney(commercials.amount, packageData.allocation_total, commercials.currency)) return { kind: "commercial_allocation_stale" };
  if (normalizeCommercialId(input.tender.get("partner_id")) !== packageData.procurement_partner_id || normalizeCommercialId(input.tender.get("rate_card_id")) !== packageData.master_rate_card_id) return { kind: "commercial_allocation_stale" };

  const packageMemberMap = new Map(packageData.members.map((member) => [member.order_id, member]));
  const releasedMap = new Map(sources.map((source) => [source.orderId, source]));
  const sourceVersions: CommercialVersion[] = [];
  const derivedVersions: CommercialVersion[] = [];
  const customerAuthorities: CustomerSellAuthority[] = [];
  const allocations = new Map<string, number>();

  for (const order of input.houseOrders) {
    const member = packageMemberMap.get(order.id);
    const released = releasedMap.get(order.id);
    if (!member || !released || branchValue(order.get("branch")) !== input.branch || normalizeCommercialId(order.get("customer_id")) !== normalizeCommercialId(members.find((candidate) => candidate.order_id === order.id)?.customer_id)
      || normalizeCommercialId(order.get("consolidation_load_id")) !== input.load.id || normalizeCommercialId(order.get("consolidation_master_order_id")) !== input.masterOrder.id || order.get("procurement_locked_by_load") !== true
      || normalizeCommercialId(order.get("consolidation_source_commercial_version_id")) !== released.versionId || text(order.get("consolidation_source_commercial_fingerprint")) !== released.fingerprint
      || normalizeCommercialId(order.get("commercial_version_id")) !== released.versionId || text(order.get("commercial_fingerprint")) !== released.fingerprint
      || member.source_commercial_version_id !== released.versionId || member.source_commercial_fingerprint !== released.fingerprint) return { kind: "commercial_allocation_stale" };

    const sourceResult = await loadCommercialVersionInTransaction(transaction, member.source_commercial_version_id, member.source_commercial_fingerprint, order.id);
    if (sourceResult.kind !== "ready") return { kind: "commercial_review_required" };
    const derivedResult = await loadCommercialVersionInTransaction(transaction, member.derived_commercial_version_id, member.derived_commercial_fingerprint, order.id);
    if (derivedResult.kind !== "ready") return { kind: "commercial_allocation_stale" };
    const source = sourceResult.version;
    const derived = derivedResult.version;
    if (derived.previous_version_id !== source.id || derived.reason !== "consolidation_allocation"
      || normalizeCommercialId(derived.source_references.consolidation_load_id) !== input.load.id
      || normalizeCommercialId(derived.source_references.consolidation_allocation_package_id) !== packageData.package_id
      || text(derived.source_references.consolidation_allocation_package_fingerprint) !== packageData.package_fingerprint
      || normalizeCommercialId(derived.source_references.source_house_commercial_version_id) !== source.id
      || normalizeCommercialCurrency(derived.snapshot.procurement.currency) !== member.currency
      || !sameCommercialMoney(derived.snapshot.procurement.total, member.allocated_procurement, member.currency)) return { kind: "commercial_allocation_stale" };

    const bookable = await assertBookableCommercialVersionInTransaction(transaction, derived);
    if (!bookable.decision.ok) {
      if (bookable.decision.reason === "approval_required") return { kind: "approval_required" };
      return { kind: "commercial_review_required" };
    }
    const customerAuthority = await assertCustomerSellAuthorityInTransaction(transaction, derived);
    if (!customerAuthority.ok) return { kind: customerAuthority.reason };
    sourceVersions.push(source);
    derivedVersions.push(derived);
    customerAuthorities.push({ quoteReference: customerAuthority.quoteReference, acceptance: customerAuthority.acceptance });
    allocations.set(order.id, member.allocated_procurement);
  }

  const scale = 10 ** packageData.currency_decimals;
  const allocatedUnits = [...allocations.values()].reduce((sum, amount) => sum + Math.round(amount * scale), 0);
  const totalUnits = Math.round(packageData.allocation_total * scale);
  if (allocatedUnits !== totalUnits) return { kind: "commercial_allocation_stale" };

  return { kind: "ready", prepared: { packageRef: targetPackageRef, package: packageData, sourceVersions, derivedVersions, customerAuthorities, allocations } };
}

export async function validateBookedConsolidationAllocationForRetryInTransaction(transaction: FirebaseFirestore.Transaction, load: FirebaseFirestore.DocumentSnapshot, houseOrders: FirebaseFirestore.DocumentSnapshot[]) {
  const id = normalizeCommercialId(load.get("booked_allocation_package_id"));
  const current = normalizeCommercialId(load.get("current_allocation_package_id"));
  if (!id || id !== current) return false;
  const snapshot = await transaction.get(packageRef(id));
  const packageData = packageFromDocument(snapshot);
  if (!packageData || packageData.status !== "booked" || packageData.load_id !== load.id || packageData.members.length !== houseOrders.length) return false;
  const members = new Map(packageData.members.map((member) => [member.order_id, member]));
  for (const order of houseOrders) {
    const member = members.get(order.id);
    if (!member || normalizeCommercialId(order.get("booked_commercial_version_id")) !== member.derived_commercial_version_id || text(order.get("booked_commercial_fingerprint")) !== member.derived_commercial_fingerprint) return false;
    const version = await loadCommercialVersionInTransaction(transaction, member.derived_commercial_version_id, member.derived_commercial_fingerprint, order.id);
    if (version.kind !== "ready") return false;
  }
  return true;
}
