import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import {
  assertBookableCommercialVersionInTransaction,
  commercialBookedSnapshotFields,
  commercialEventPayload,
  loadCommercialVersionInTransaction,
  newCommercialVersion,
  persistCommercialVersionInTransaction,
} from "../commercial-lineage/commercial-lineage.server";
import {
  deriveConsolidationAllocationSnapshot,
  normalizeCommercialCurrency,
  normalizeCommercialId,
  sameCommercialMoney,
  type CommercialVersion,
} from "../commercial-lineage/commercial-lineage";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { ensureBookingArtifacts, TMS_BOOKING_ARTIFACT_SEED_VERSION } from "../tenders/tms-booking-artifacts.server";
import { resolveTenderAuthority } from "../tenders/tms-tendering";
import { allocateProcurementCost, consolidatedBookingRetryDecision, MAX_LOAD_ORDERS } from "./tms-consolidation";

type Actor = { name: string; email: string };

type ConsolidatedBookingInput = {
  loadId: string;
  masterOrderId: string;
  tenderId: string;
  tenderReference: string;
  partnerId: string;
  partnerName: string;
  rateCardId: string;
  bookingReference: string;
  pickupConfirmation?: string;
  amount: number;
  currency: CrmCurrency;
  expectedTenderUpdatedAt: string;
};

type LoadMember = {
  order_id: string;
  customer_id: string | null;
  customer_name: string | null;
  origin: string;
  destination: string;
  mode: string;
  weight_kg: number;
  volume_cbm: number;
  pieces: number;
  container_count: number;
  equipment: string | null;
  temperature_requirement: string | null;
  prior_selected_cost: number | null;
  prior_selected_currency: CrmCurrency | null;
  allocated_cost: number | null;
  allocated_currency: CrmCurrency | null;
  shipment_reference: string | null;
};

type ReleasedCommercialSource = { orderId: string; versionId: string; fingerprint: string };

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberValue(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function currencyValue(value: unknown): CrmCurrency | null { return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : null; }
function bridgeQuoteReference(orderId: string) { return `TMSQ-${orderId.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`.slice(0, 120); }
function masterBridgeQuoteReference(id: string) { return `TMSQ-MASTER-${id.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`.slice(0, 120); }
function shipmentReference(prefix = "S") { return `KCPL-${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${cryptoRandom(6)}`; }
function cryptoRandom(bytes: number) { return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (value) => value.toString(16).padStart(2, "0")).join("").toUpperCase(); }
function sameIdSet(left: unknown, right: string[]) {
  if (!Array.isArray(left)) return false;
  const a = left.filter((value): value is string => typeof value === "string").map(normalizeCommercialId).sort();
  const b = [...right].map(normalizeCommercialId).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function memberFromData(value: unknown): LoadMember | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const orderId = normalizeCommercialId(data.order_id);
  const currency = currencyValue(data.prior_selected_currency);
  if (!orderId) return null;
  return {
    order_id: orderId,
    customer_id: nullable(data.customer_id), customer_name: nullable(data.customer_name), origin: text(data.origin), destination: text(data.destination), mode: text(data.mode),
    weight_kg: Math.max(0, numberValue(data.weight_kg)), volume_cbm: Math.max(0, numberValue(data.volume_cbm)), pieces: Math.max(0, Math.trunc(numberValue(data.pieces))),
    container_count: Math.max(0, Math.trunc(numberValue(data.container_count))), equipment: nullable(data.equipment), temperature_requirement: nullable(data.temperature_requirement),
    prior_selected_cost: nullableNumber(data.prior_selected_cost), prior_selected_currency: currency, allocated_cost: nullableNumber(data.allocated_cost),
    allocated_currency: currencyValue(data.allocated_currency), shipment_reference: nullable(data.shipment_reference),
  };
}

function loadMembers(load: FirebaseFirestore.DocumentSnapshot) {
  const raw = load.get("members");
  return Array.isArray(raw) ? raw.map(memberFromData).filter((member): member is LoadMember => Boolean(member)) : [];
}

function releasedCommercialSources(load: FirebaseFirestore.DocumentSnapshot) {
  const raw = load.get("released_commercial_sources");
  if (!Array.isArray(raw)) return [] as ReleasedCommercialSource[];
  return raw.map((value) => {
    if (!value || typeof value !== "object") return null;
    const data = value as Record<string, unknown>;
    const source = { orderId: normalizeCommercialId(data.order_id), versionId: normalizeCommercialId(data.commercial_version_id), fingerprint: text(data.commercial_fingerprint) };
    return source.orderId && source.versionId && source.fingerprint ? source : null;
  }).filter((value): value is ReleasedCommercialSource => Boolean(value));
}

function actualTenderCommercials(tender: FirebaseFirestore.DocumentSnapshot) {
  const status = text(tender.get("status"));
  if (status === "accepted") {
    const amount = nullableNumber(tender.get("offered_cost"));
    const currency = currencyValue(tender.get("currency"));
    return amount !== null && currency ? { amount, currency } : null;
  }
  if (status === "countered") {
    const amount = nullableNumber(tender.get("counter_cost"));
    const currency = currencyValue(tender.get("counter_currency"));
    return amount !== null && currency ? { amount, currency } : null;
  }
  return null;
}

async function masterTenderAuthority(transaction: FirebaseFirestore.Transaction, masterOrder: FirebaseFirestore.DocumentSnapshot, tenderId: string, now: string) {
  const snapshot = await transaction.get(firebaseAdminDb().collection("transport_tenders").where("order_id", "==", masterOrder.id));
  const liveIds = snapshot.docs.filter((doc) => {
    const status = text(doc.get("status"));
    if (!["sent", "accepted", "countered"].includes(status)) return false;
    return !(status === "sent" && text(doc.get("response_due_at")) && text(doc.get("response_due_at")) <= now);
  }).map((doc) => doc.id);
  const decision = resolveTenderAuthority(nullable(masterOrder.get("active_tender_id")), liveIds, tenderId);
  return decision === "authoritative" || decision === "legacy_unique";
}

function commercialPointerMatches(doc: FirebaseFirestore.DocumentSnapshot, version: CommercialVersion, prefix = "commercial") {
  return normalizeCommercialId(doc.get(`${prefix}_version_id`)) === version.id && text(doc.get(`${prefix}_fingerprint`)) === version.fingerprint;
}

function bookedPointerMatches(doc: FirebaseFirestore.DocumentSnapshot, version: CommercialVersion) {
  return normalizeCommercialId(doc.get("booked_commercial_version_id")) === version.id && text(doc.get("booked_commercial_fingerprint")) === version.fingerprint;
}

export async function confirmConsolidatedLoadBookingWithLineage(input: ConsolidatedBookingInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const bookingReference = input.bookingReference.trim();
  if (!bookingReference) return { kind: "booking_reference_required" as const };
  if (!Number.isFinite(input.amount) || input.amount < 0 || !crmCurrencies.includes(input.currency)) return { kind: "commercials_required" as const };

  const db = firebaseAdminDb();
  const loadRef = db.collection("consolidation_loads").doc(normalizeCommercialId(input.loadId));
  const masterOrderRef = db.collection("transport_orders").doc(normalizeCommercialId(input.masterOrderId));
  const tenderRef = db.collection("transport_tenders").doc(normalizeCommercialId(input.tenderId));
  const now = new Date().toISOString();
  try {
    const result = await db.runTransaction(async (transaction) => {
      const [load, masterOrder, tender] = await Promise.all([transaction.get(loadRef), transaction.get(masterOrderRef), transaction.get(tenderRef)]);
      if (!load.exists) return { kind: "missing_load" as const };
      const branch = branchValue(load.get("branch"));
      if (!branch || !staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
      const members = loadMembers(load);
      if (members.length < 2 || members.length > MAX_LOAD_ORDERS) return { kind: "state_conflict" as const };
      const releasedSources = releasedCommercialSources(load);
      const releasedSourceMap = new Map(releasedSources.map((source) => [source.orderId, source]));
      if (releasedSources.length !== members.length || releasedSourceMap.size !== members.length || members.some((member) => !releasedSourceMap.has(member.order_id))) return { kind: "commercial_review_required" as const };
      if (!masterOrder.exists || normalizeCommercialId(load.get("master_order_id")) !== masterOrder.id) return { kind: "invalid_master" as const };
      if (!tender.exists || normalizeCommercialId(tender.get("order_id")) !== masterOrder.id || branchValue(tender.get("branch")) !== branch) return { kind: "state_conflict" as const };

      const masterVersionResult = await loadCommercialVersionInTransaction(transaction, tender.get("commercial_version_id"), tender.get("commercial_fingerprint"), masterOrder.id);
      if (masterVersionResult.kind !== "ready") return { kind: "commercial_review_required" as const };
      const masterVersion = masterVersionResult.version;
      if (!commercialPointerMatches(masterOrder, masterVersion) || normalizeCommercialId(tender.get("final_commercial_version_id")) && normalizeCommercialId(tender.get("final_commercial_version_id")) !== masterVersion.id) return { kind: "stale_commercial_state" as const };
      if (masterVersion.snapshot.pricing) {
        const masterBookable = await assertBookableCommercialVersionInTransaction(transaction, masterVersion);
        if (masterBookable.decision.ok === false) return { kind: masterBookable.decision.reason as "pricing_required" | "approval_required" | "commercial_review_required" };
      }

      if (text(load.get("status")) === "booked") {
        const masterShipmentReference = nullable(load.get("master_shipment_reference"));
        const houseShipmentReferences = members.map((member) => member.shipment_reference);
        const retry = consolidatedBookingRetryDecision({
          requestedBookingReference: bookingReference,
          loadBookingReference: nullable(load.get("master_booking_reference")),
          masterShipmentReference,
          memberShipmentReferences: houseShipmentReferences,
          expectedMemberCount: members.length,
          tenderStatus: text(tender.get("status")), tenderBookingReference: nullable(tender.get("booking_reference")), tenderShipmentReference: nullable(tender.get("shipment_reference")),
          masterOrderStatus: text(masterOrder.get("status")), masterOrderBookingReference: nullable(masterOrder.get("booking_reference")), masterOrderShipmentReference: nullable(masterOrder.get("shipment_reference")),
        });
        if (retry !== "idempotent") return { kind: retry as "booking_conflict" | "state_conflict" };
        if (!masterShipmentReference || !bookedPointerMatches(masterOrder, masterVersion) || !bookedPointerMatches(tender, masterVersion)) return { kind: "state_conflict" as const };
        const houseIds = members.map((member) => member.order_id);
        const houseOrderRefs = houseIds.map((id) => db.collection("transport_orders").doc(id));
        const houseOrders = await Promise.all(houseOrderRefs.map((ref) => transaction.get(ref)));
        if (houseOrders.some((doc) => !doc.exists)) return { kind: "state_conflict" as const };
        const refs = houseShipmentReferences.filter((value): value is string => Boolean(value));
        if (refs.length !== members.length) return { kind: "state_conflict" as const };
        const masterShipmentRef = db.collection("shipments").doc(masterShipmentReference);
        const [masterShipment, masterQuote, ...children] = await Promise.all([
          transaction.get(masterShipmentRef), transaction.get(db.collection("quotes").doc(masterBridgeQuoteReference(load.id))),
          ...refs.map((reference) => transaction.get(db.collection("shipments").doc(reference))),
          ...houseIds.map((id) => transaction.get(db.collection("quotes").doc(bridgeQuoteReference(id)))),
        ]);
        if (!masterShipment.exists || !bookedPointerMatches(masterShipment, masterVersion) || !masterQuote.exists || !commercialPointerMatches(masterQuote, masterVersion)) return { kind: "state_conflict" as const };
        const shipments = children.slice(0, refs.length);
        const quotes = children.slice(refs.length);
        for (let index = 0; index < houseOrders.length; index += 1) {
          const order = houseOrders[index];
          const shipment = shipments[index];
          const quote = quotes[index];
          const released = releasedSourceMap.get(order.id);
          const bookedVersionId = normalizeCommercialId(order.get("booked_commercial_version_id"));
          const bookedFp = text(order.get("booked_commercial_fingerprint"));
          if (!released || normalizeCommercialId(order.get("consolidation_source_commercial_version_id")) !== released.versionId || text(order.get("consolidation_source_commercial_fingerprint")) !== released.fingerprint
            || !bookedVersionId || !bookedFp || !shipment?.exists || normalizeCommercialId(shipment.get("source_commercial_version_id")) !== released.versionId || text(shipment.get("source_commercial_fingerprint")) !== released.fingerprint
            || normalizeCommercialId(shipment.get("booked_commercial_version_id")) !== bookedVersionId || text(shipment.get("booked_commercial_fingerprint")) !== bookedFp
            || !quote?.exists || normalizeCommercialId(quote.get("source_commercial_version_id")) !== released.versionId || text(quote.get("source_commercial_fingerprint")) !== released.fingerprint
            || normalizeCommercialId(quote.get("commercial_version_id")) !== bookedVersionId || text(quote.get("commercial_fingerprint")) !== bookedFp) return { kind: "state_conflict" as const };
        }
        return { kind: "booked" as const, masterShipmentReference, shipmentReferences: refs, idempotent: true };
      }

      if (!["ready_for_procurement", "tendering"].includes(text(load.get("status")))) return { kind: "invalid_transition" as const };
      if (text(tender.get("updated_at")) !== input.expectedTenderUpdatedAt) return { kind: "state_conflict" as const };
      if (!await masterTenderAuthority(transaction, masterOrder, tender.id, now)) return { kind: "stale_tender" as const };
      const commercials = actualTenderCommercials(tender);
      if (!commercials || !sameCommercialMoney(commercials.amount, input.amount, commercials.currency) || commercials.currency !== input.currency) return { kind: "state_conflict" as const };
      if (normalizeCommercialCurrency(masterVersion.snapshot.procurement.currency) !== commercials.currency || !sameCommercialMoney(masterVersion.snapshot.procurement.total, commercials.amount, commercials.currency)) return { kind: "stale_commercial_state" as const };

      const partnerId = normalizeCommercialId(tender.get("partner_id"));
      const partnerName = text(tender.get("partner_name"), partnerId || "Partner");
      const rateCardId = normalizeCommercialId(tender.get("rate_card_id"));
      const tenderReference = text(tender.get("tender_reference"), tender.id);
      if (!partnerId || !rateCardId || partnerId !== normalizeCommercialId(masterVersion.snapshot.procurement.partner_id)) return { kind: "state_conflict" as const };

      const houseRefs = members.map((member) => db.collection("transport_orders").doc(member.order_id));
      const houseOrders = await Promise.all(houseRefs.map((ref) => transaction.get(ref)));
      if (houseOrders.some((order) => !order.exists)) return { kind: "missing_order" as const };
      for (const order of houseOrders) {
        const released = releasedSourceMap.get(order.id);
        if (!normalizeCommercialId(order.get("customer_id"))) return { kind: "customer_required" as const };
        if (!released || normalizeCommercialId(order.get("consolidation_load_id")) !== load.id || normalizeCommercialId(order.get("consolidation_master_order_id")) !== masterOrder.id || order.get("procurement_locked_by_load") !== true
          || normalizeCommercialId(order.get("consolidation_source_commercial_version_id")) !== released.versionId || text(order.get("consolidation_source_commercial_fingerprint")) !== released.fingerprint
          || normalizeCommercialId(order.get("commercial_version_id")) !== released.versionId || text(order.get("commercial_fingerprint")) !== released.fingerprint) return { kind: "state_conflict" as const };
        if (text(order.get("status")) === "booked" || nullable(order.get("shipment_reference"))) return { kind: "state_conflict" as const };
      }

      const sourceVersions: CommercialVersion[] = [];
      for (const order of houseOrders) {
        const released = releasedSourceMap.get(order.id)!;
        const source = await loadCommercialVersionInTransaction(transaction, released.versionId, released.fingerprint, order.id);
        if (source.kind !== "ready") return { kind: "commercial_review_required" as const };
        const bookable = await assertBookableCommercialVersionInTransaction(transaction, source.version);
        if (bookable.decision.ok === false) return { kind: bookable.decision.reason as "pricing_required" | "approval_required" | "commercial_review_required" };
        sourceVersions.push(source.version);
      }

      const allocations = allocateProcurementCost(commercials.amount, members);
      if (allocations.length !== members.length) return { kind: "commercials_required" as const };
      const allocationMap = new Map(allocations.map((item) => [item.order_id, item.amount]));
      const bookedHouseVersions: CommercialVersion[] = [];
      for (let index = 0; index < houseOrders.length; index += 1) {
        const order = houseOrders[index];
        const source = sourceVersions[index];
        const allocation = allocationMap.get(order.id);
        if (allocation === undefined) return { kind: "state_conflict" as const };
        const snapshot = deriveConsolidationAllocationSnapshot(source.snapshot, {
          amount: allocation, currency: commercials.currency, partnerId, partnerName, masterRateCardId: rateCardId, mode: text(masterOrder.get("mode")),
        });
        const derived = newCommercialVersion({
          snapshot, previousVersionId: source.id, reason: "consolidation_allocation", actor,
          sourceReferences: { consolidation_load_id: load.id, master_commercial_version_id: masterVersion.id, master_tender_id: tender.id, source_house_commercial_version_id: source.id },
        });
        const integrity = derived.snapshot.pricing;
        if (!integrity || integrity.converted_buy_cost === null) return { kind: "commercial_review_required" as const };
        if (integrity.approval_required) return { kind: "approval_required" as const };
        bookedHouseVersions.push(derived);
      }

      const customerIds = [...new Set(houseOrders.map((order) => normalizeCommercialId(order.get("customer_id"))))];
      const customers = await Promise.all(customerIds.map((id) => transaction.get(db.collection("customers").doc(id))));
      if (customers.some((customer) => !customer.exists || customer.get("archived") === true)) return { kind: "customer_missing" as const };
      const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
      const masterQuoteRef = db.collection("quotes").doc(masterBridgeQuoteReference(load.id));
      const houseQuoteRefs = new Map(houseOrders.map((order) => [order.id, db.collection("quotes").doc(bridgeQuoteReference(order.id))]));
      const [masterQuote, ...houseQuotes] = await Promise.all([transaction.get(masterQuoteRef), ...houseOrders.map((order) => transaction.get(houseQuoteRefs.get(order.id)!))]);
      if (masterQuote.exists && (normalizeCommercialId(masterQuote.get("consolidation_load_id")) && normalizeCommercialId(masterQuote.get("consolidation_load_id")) !== load.id || nullable(masterQuote.get("shipment_reference")))) return { kind: "state_conflict" as const };
      for (let index = 0; index < houseQuotes.length; index += 1) {
        const quote = houseQuotes[index];
        if (!quote.exists) continue;
        if ((normalizeCommercialId(quote.get("transport_order_id")) && normalizeCommercialId(quote.get("transport_order_id")) !== houseOrders[index].id)
          || (normalizeCommercialId(quote.get("consolidation_load_id")) && normalizeCommercialId(quote.get("consolidation_load_id")) !== load.id)
          || nullable(quote.get("shipment_reference"))) return { kind: "state_conflict" as const };
      }

      const masterShipmentReference = shipmentReference("M");
      const houseReferenceMap = new Map(houseOrders.map((order) => [order.id, shipmentReference("S")]));
      const operationId = `consolidation:${load.id}:tender:${tender.id}`;
      const stops = Array.isArray(load.get("stops")) ? load.get("stops") as Array<Record<string, unknown>> : [];
      const sortedStops = [...stops].sort((a, b) => numberValue(a.sequence) - numberValue(b.sequence));
      const origin = text(sortedStops[0]?.location, members[0]?.origin ?? "");
      const destination = text(sortedStops.at(-1)?.location, members.at(-1)?.destination ?? "");

      transaction.set(masterQuoteRef, {
        reference: masterBridgeQuoteReference(load.id), status: "won", migration_hidden: true, source: "tms_consolidation_master_bridge",
        consolidation_load_id: load.id, customer_id: null, company_name: `Consolidation ${text(load.get("reference"), load.id)}`,
        contact_name: "", contact_email: "", phone: "", origin, destination, mode: text(load.get("mode")), cargo_type: "Consolidated freight",
        quote_currency: commercials.currency, quoted_amount: null, internal_cost: commercials.amount, shipment_reference: masterShipmentReference,
        commercial_version_id: masterVersion.id, commercial_fingerprint: masterVersion.fingerprint, commercial_snapshot: masterVersion.snapshot, commercial_locked: true,
        created_at: masterQuote.exists ? text(masterQuote.get("created_at"), now) : now, updated_at: now,
      }, { merge: true });
      transaction.create(db.collection("shipments").doc(masterShipmentReference), {
        reference: masterShipmentReference, quote_reference: masterBridgeQuoteReference(load.id), consolidation_load_id: load.id,
        transport_order_id: masterOrder.id, tender_id: tender.id, tender_reference: tenderReference, customer_id: null,
        primary_branch: branch, handling_branches: [branch], origin, destination, mode: text(load.get("mode")), is_consolidation_master: true,
        house_order_ids: members.map((member) => member.order_id), job_priority: "standard", job_assigned_to_uid: null, job_assigned_to_name: null,
        job_assigned_to_email: null, job_assigned_to_phone: null, internal_job_reference: text(load.get("reference"), load.id),
        internal_job_notes: `${members.length} house orders · ${stops.length} planned stops`, workflow_version: 1, job_closed_at: null,
        status: "booking_confirmed", eta: null, current_location: origin, carrier: partnerName, carrier_reference: bookingReference,
        partner_id: partnerId, procurement_rate_card_id: rateCardId, procurement_cost: commercials.amount, procurement_currency: commercials.currency,
        commercial_version_id: masterVersion.id, commercial_fingerprint: masterVersion.fingerprint, ...commercialBookedSnapshotFields(masterVersion),
        customer_note: null, booking_operation_id: operationId, booking_artifact_seed_version: TMS_BOOKING_ARTIFACT_SEED_VERSION,
        booking_artifact_kind: "consolidation_master", booking_artifacts_seeded_at: null, booking_actor_name: actor.name, booking_actor_email: actor.email,
        created_at: now, updated_at: now,
      });

      const updatedMembers: LoadMember[] = [];
      const customerIncrements = new Map<string, number>();
      const commercialAllocations: Array<Record<string, unknown>> = [];
      for (let index = 0; index < houseOrders.length; index += 1) {
        const order = houseOrders[index];
        const source = sourceVersions[index];
        const version = bookedHouseVersions[index];
        const customerId = normalizeCommercialId(order.get("customer_id"));
        const customer = customerMap.get(customerId)!;
        const allocation = allocationMap.get(order.id) ?? 0;
        const reference = houseReferenceMap.get(order.id)!;
        persistCommercialVersionInTransaction(transaction, version);
        const quoteRef = houseQuoteRefs.get(order.id)!;
        transaction.set(quoteRef, {
          reference: bridgeQuoteReference(order.id), status: "won", migration_hidden: true, source: "tms_consolidation_house_bridge",
          transport_order_id: order.id, consolidation_load_id: load.id, customer_id: customerId, company_name: text(customer.get("display_name"), customerId),
          contact_name: "", contact_email: text(customer.get("primary_email")), phone: text(customer.get("primary_phone")),
          origin: text(order.get("origin")), destination: text(order.get("destination")), mode: text(order.get("mode")), cargo_type: "",
          quote_currency: version.snapshot.pricing!.sell_currency, quoted_amount: version.snapshot.pricing!.sell_amount,
          internal_cost: version.snapshot.pricing!.converted_buy_cost, shipment_reference: reference,
          commercial_version_id: version.id, commercial_fingerprint: version.fingerprint, commercial_snapshot: version.snapshot, commercial_locked: true,
          source_commercial_version_id: source.id, source_commercial_fingerprint: source.fingerprint,
          created_at: houseQuotes[index].exists ? text(houseQuotes[index].get("created_at"), now) : now, updated_at: now,
        }, { merge: true });
        transaction.create(db.collection("shipments").doc(reference), {
          reference, quote_reference: bridgeQuoteReference(order.id), transport_order_id: order.id, consolidation_load_id: load.id,
          master_shipment_reference: masterShipmentReference, master_booking_reference: bookingReference, tender_id: tender.id, tender_reference: tenderReference,
          customer_id: customerId, primary_branch: branchValue(order.get("branch")) ?? branch, handling_branches: [branchValue(order.get("branch")) ?? branch],
          origin: text(order.get("origin")), destination: text(order.get("destination")), mode: text(order.get("mode")), job_priority: "standard",
          job_assigned_to_uid: null, job_assigned_to_name: null, job_assigned_to_email: null, job_assigned_to_phone: null,
          internal_job_reference: order.id, internal_job_notes: nullable(order.get("notes")), workflow_version: 1, job_closed_at: null,
          status: "booking_confirmed", eta: null, current_location: text(order.get("origin")), carrier: partnerName, carrier_reference: bookingReference,
          partner_id: partnerId, procurement_rate_card_id: rateCardId, procurement_cost: allocation, procurement_currency: commercials.currency,
          source_commercial_version_id: source.id, source_commercial_fingerprint: source.fingerprint,
          commercial_version_id: version.id, commercial_fingerprint: version.fingerprint, ...commercialBookedSnapshotFields(version),
          customer_note: null, booking_operation_id: operationId, booking_artifact_seed_version: TMS_BOOKING_ARTIFACT_SEED_VERSION,
          booking_artifact_kind: "consolidation_house", booking_artifacts_seeded_at: null, booking_actor_name: actor.name, booking_actor_email: actor.email,
          created_at: now, updated_at: now,
        });
        transaction.update(order.ref, {
          status: "booked", active_tender_id: null, booking_reference: bookingReference, shipment_reference: reference,
          consolidation_source_commercial_version_id: source.id, consolidation_source_commercial_fingerprint: source.fingerprint,
          commercial_version_id: version.id, commercial_fingerprint: version.fingerprint,
          booked_commercial_version_id: version.id, booked_commercial_fingerprint: version.fingerprint, commercial_lineage_status: "booked_locked",
          selected_cost: allocation, selected_currency: commercials.currency, consolidation_allocated_cost: allocation, consolidation_allocated_currency: commercials.currency,
          procurement_locked_by_load: true, booking_operation_id: operationId, updated_at: now,
        });
        transaction.create(order.ref.collection("events").doc(`booking-${reference}`), commercialEventPayload(version, "booked_commercial_version_locked", actor, `${reference} · master ${masterShipmentReference} · ${commercials.currency} ${allocation.toFixed(commercials.currency === "JPY" ? 0 : 2)}`));
        customerIncrements.set(customerId, (customerIncrements.get(customerId) ?? 0) + 1);
        const member = members.find((candidate) => candidate.order_id === order.id)!;
        updatedMembers.push({ ...member, allocated_cost: allocation, allocated_currency: commercials.currency, shipment_reference: reference });
        commercialAllocations.push({ order_id: order.id, source_commercial_version_id: source.id, source_commercial_fingerprint: source.fingerprint, booked_commercial_version_id: version.id, booked_commercial_fingerprint: version.fingerprint, allocated_cost: allocation, currency: commercials.currency });
      }

      for (const [customerId, increment] of customerIncrements) {
        const customer = customerMap.get(customerId)!;
        const currentActive = Math.max(0, numberValue(customer.get("active_shipment_count")));
        const currentStatus = text(customer.get("account_status"));
        transaction.update(customer.ref, { active_shipment_count: currentActive + increment, lead_stage: "won", ...(currentStatus === "prospect" || currentStatus === "dormant" ? { account_status: "active" } : {}), updated_at: now });
      }

      const houseShipmentReferences = houseOrders.map((order) => houseReferenceMap.get(order.id)!);
      transaction.update(tenderRef, {
        status: "booked", final_cost: commercials.amount, final_currency: commercials.currency,
        final_commercial_version_id: masterVersion.id, final_commercial_fingerprint: masterVersion.fingerprint,
        booked_commercial_version_id: masterVersion.id, booked_commercial_fingerprint: masterVersion.fingerprint,
        booking_reference: bookingReference, pickup_confirmation: input.pickupConfirmation?.trim() || null, booked_at: now,
        shipment_reference: masterShipmentReference, consolidation_load_id: load.id, shipment_references: houseShipmentReferences,
        booking_operation_id: operationId, updated_at: now,
      });
      transaction.update(masterOrderRef, {
        status: "booked", active_tender_id: null, booked_tender_id: tender.id, booking_reference: bookingReference, shipment_reference: masterShipmentReference,
        selected_cost: commercials.amount, selected_currency: commercials.currency,
        booked_commercial_version_id: masterVersion.id, booked_commercial_fingerprint: masterVersion.fingerprint, commercial_lineage_status: "booked_locked",
        booking_operation_id: operationId, updated_at: now,
      });
      transaction.create(masterOrderRef.collection("events").doc(`booking-${masterShipmentReference}`), commercialEventPayload(masterVersion, "booked_commercial_version_locked", actor, `${masterShipmentReference} · ${commercials.currency} ${commercials.amount.toFixed(commercials.currency === "JPY" ? 0 : 2)} · ${bookingReference}`));
      transaction.update(loadRef, {
        status: "booked", members: updatedMembers, master_tender_id: tender.id, master_booking_reference: bookingReference,
        master_shipment_reference: masterShipmentReference, procurement_partner_id: partnerId, procurement_partner_name: partnerName,
        procurement_cost: commercials.amount, procurement_currency: commercials.currency,
        master_commercial_version_id: masterVersion.id, master_commercial_fingerprint: masterVersion.fingerprint,
        commercial_allocations: commercialAllocations, booking_operation_id: operationId, updated_at: now,
      });
      transaction.create(loadRef.collection("events").doc(`booking-${masterShipmentReference}`), {
        ...commercialEventPayload(masterVersion, "load_booked_with_commercial_lineage", actor, `${masterShipmentReference} · ${houseShipmentReferences.length} house shipments · ${commercials.currency} ${commercials.amount.toFixed(commercials.currency === "JPY" ? 0 : 2)}`),
        house_commercial_versions: commercialAllocations,
      });
      return { kind: "booked" as const, masterShipmentReference, shipmentReferences: houseShipmentReferences, idempotent: false };
    });

    if (result.kind === "booked") {
      for (const reference of [result.masterShipmentReference, ...result.shipmentReferences]) await ensureBookingArtifacts(reference, actor);
    }
    return result;
  } catch {
    return { kind: "unavailable" as const };
  }
}
