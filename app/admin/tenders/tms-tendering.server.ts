import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import {
  assertBookableCommercialVersionInTransaction,
  commercialBookedSnapshotFields,
  commercialEventPayload,
  commercialOrderPointer,
  loadCommercialVersionInTransaction,
  newCommercialVersion,
  persistCommercialVersionInTransaction,
  resolveCurrentCommercialVersionInTransaction,
} from "../commercial-lineage/commercial-lineage.server";
import {
  deriveCounterofferSnapshot,
  normalizeCommercialCurrency,
  normalizeCommercialId,
  sameCommercialMoney,
  type CommercialVersion,
} from "../commercial-lineage/commercial-lineage";
import { confirmConsolidatedLoadBooking } from "../consolidation/tms-consolidation.server";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { tmsModes, type TmsMode } from "../rating/tms-rating";
import { ensureBookingArtifacts, TMS_BOOKING_ARTIFACT_SEED_VERSION } from "./tms-booking-artifacts.server";
import {
  bookingRetryDecision,
  repeatedRejectedTenderDecision,
  resolveTenderAuthority,
  tenderCanBook,
  tenderCanCancel,
  tenderFinalCommercials,
  tenderIsActive,
  tenderIsExpired,
  tenderResponseAllowed,
  tmsTenderChannels,
  tmsTenderStatuses,
  type TmsTender,
  type TmsTenderChannel,
  type TmsTenderStatus,
} from "./tms-tendering";

type Actor = { name: string; email: string };

type TenderCreateInput = {
  orderId: string;
  channel: TmsTenderChannel;
  recipientName?: string;
  recipientEmail?: string;
  responseDueAt: string;
};

type TenderResponseInput = {
  status: "accepted" | "rejected" | "countered";
  note?: string;
  counterCost?: number | null;
  counterCurrency?: CrmCurrency | null;
};

type TenderBookingInput = { bookingReference: string; pickupConfirmation?: string };

type Edi990TransitionInput = {
  status: "accepted" | "rejected";
  note?: string;
  responseCode?: string | null;
  transactionRef: FirebaseFirestore.DocumentReference;
  partner: string;
  expectedUpdatedAt?: string | null;
  expectedStatus?: TmsTenderStatus | null;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function numberValue(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function currencyValue(value: unknown): CrmCurrency | null { return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : null; }
function modeValue(value: unknown): TmsMode | null { return tmsModes.includes(value as TmsMode) ? value as TmsMode : null; }
function tenderId() { return `TND-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`; }
function tenderReference() { return `KCPL-T-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`; }
function shipmentReference() { return `KCPL-S-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(6).toString("hex").toUpperCase()}`; }
function bridgeQuoteReference(orderId: string) { return `TMSQ-${orderId.replace(/[^A-Z0-9-]/gi, "").toUpperCase()}`.slice(0, 120); }
function eventId(prefix = "evt") { return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`; }
function emailLooksValid(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
function futureIso(value: string) { const parsed = Date.parse(value); return Number.isFinite(parsed) && parsed > Date.now() ? new Date(parsed).toISOString() : null; }

function tenderFromData(id: string, data: Record<string, unknown>): TmsTender | null {
  const status = tmsTenderStatuses.includes(data.status as TmsTenderStatus) ? data.status as TmsTenderStatus : null;
  const channel = tmsTenderChannels.includes(data.channel as TmsTenderChannel) ? data.channel as TmsTenderChannel : null;
  const currency = currencyValue(data.currency);
  const mode = modeValue(data.mode);
  if (!status || !channel || !currency || !mode) return null;
  return {
    id,
    order_id: text(data.order_id).toUpperCase(), tender_reference: text(data.tender_reference, id), status, channel,
    partner_id: text(data.partner_id).toUpperCase(), partner_name: text(data.partner_name, "Partner"),
    recipient_name: nullable(data.recipient_name), recipient_email: nullable(data.recipient_email), rate_card_id: text(data.rate_card_id),
    mode, service: nullable(data.service), equipment: nullable(data.equipment), currency,
    offered_cost: Math.max(0, numberValue(data.offered_cost)), counter_cost: nullableNumber(data.counter_cost),
    counter_currency: currencyValue(data.counter_currency), final_cost: nullableNumber(data.final_cost), final_currency: currencyValue(data.final_currency),
    origin: text(data.origin), destination: text(data.destination), pickup_date: nullable(data.pickup_date), response_due_at: text(data.response_due_at),
    sent_at: text(data.sent_at), responded_at: nullable(data.responded_at), response_note: nullable(data.response_note),
    booking_reference: nullable(data.booking_reference), pickup_confirmation: nullable(data.pickup_confirmation), booked_at: nullable(data.booked_at),
    shipment_reference: nullable(data.shipment_reference), created_by_name: text(data.created_by_name, "KCPL Staff"),
    created_by_email: text(data.created_by_email), updated_at: text(data.updated_at),
  };
}

async function orderSnapshot(orderId: string) {
  const id = orderId.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("transport_orders").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Record<string, unknown>;
  const branch = branchValue(data.branch);
  const mode = modeValue(data.mode);
  if (!branch || !mode) return null;
  return { id, ref, snapshot, data, branch, mode };
}

async function tenderSnapshot(idValue: string) {
  const id = idValue.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("transport_tenders").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const tender = tenderFromData(snapshot.id, snapshot.data() as Record<string, unknown>);
  const branch = branchValue(snapshot.get("branch"));
  return tender && branch ? { ref, snapshot, tender, branch } : null;
}

async function activeTenderDocsInTransaction(transaction: FirebaseFirestore.Transaction, orderId: string, now: string) {
  const query = firebaseAdminDb().collection("transport_tenders").where("order_id", "==", orderId);
  const snapshot = await transaction.get(query);
  const live: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  const expired: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  for (const doc of snapshot.docs) {
    const tender = tenderFromData(doc.id, doc.data() as Record<string, unknown>);
    if (!tender || !tenderIsActive(tender.status)) continue;
    if (tenderIsExpired(tender, now)) expired.push(doc); else live.push(doc);
  }
  return { live, expired, all: snapshot.docs };
}

async function authoritativeTenderInTransaction(transaction: FirebaseFirestore.Transaction, order: FirebaseFirestore.DocumentSnapshot, tender: TmsTender, now: string) {
  const state = await activeTenderDocsInTransaction(transaction, tender.order_id, now);
  return resolveTenderAuthority(text(order.get("active_tender_id")) || null, state.live.map((doc) => doc.id), tender.id);
}

function responseMatches(tender: TmsTender, input: TenderResponseInput) {
  if (tender.status !== input.status) return false;
  if (nullable(tender.response_note) !== (input.note?.trim() || null)) return false;
  if (input.status !== "countered") return true;
  return tender.counter_cost === input.counterCost && tender.counter_currency === input.counterCurrency;
}

function ediProcessedFields(input: Edi990TransitionInput, tender: TmsTender, orderId: string, branch: KcplBranch, now: string) {
  return {
    status: "processed", branch, partner: input.partner, reference: orderId, order_reference: orderId,
    tender_reference: tender.tender_reference, tender_id: tender.id, message: `Tender ${input.status} by EDI 990.`,
    processed_at: now, updated_at: now,
  };
}

function versionPointer(snapshot: FirebaseFirestore.DocumentSnapshot) {
  return { id: normalizeCommercialId(snapshot.get("commercial_version_id")), fingerprint: text(snapshot.get("commercial_fingerprint")) };
}

async function tenderCommercialVersionInTransaction(transaction: FirebaseFirestore.Transaction, tender: FirebaseFirestore.DocumentSnapshot, orderId: string) {
  const currentId = normalizeCommercialId(tender.get("commercial_version_id"));
  const currentFingerprint = text(tender.get("commercial_fingerprint"));
  return loadCommercialVersionInTransaction(transaction, currentId, currentFingerprint, orderId);
}

function counterPricingProjection(raw: unknown, version: CommercialVersion) {
  if (!raw || typeof raw !== "object" || !version.snapshot.pricing || version.snapshot.pricing.converted_buy_cost === null) return null;
  const source = raw as Record<string, unknown>;
  const input = source.input && typeof source.input === "object" ? source.input as Record<string, unknown> : {};
  const result = source.result && typeof source.result === "object" ? source.result as Record<string, unknown> : {};
  const pricing = version.snapshot.pricing;
  return {
    ...source,
    commercial_version_id: version.id,
    commercial_fingerprint: version.fingerprint,
    input: {
      ...input,
      buy_cost: version.snapshot.procurement.total,
      buy_currency: version.snapshot.procurement.currency,
      sell_currency: pricing.sell_currency,
      fx_rate: version.snapshot.fx?.rate ?? 1,
    },
    result: {
      ...result,
      converted_buy_cost: pricing.converted_buy_cost,
      accessorial_sell: pricing.accessorial_sell,
      pre_discount_sell: pricing.pre_discount_sell,
      sell_price: pricing.sell_amount,
      gross_profit: pricing.gross_profit,
      gross_margin_percent: pricing.gross_margin_percent,
      effective_markup_percent: pricing.effective_markup_percent,
      minimum_sell_price: pricing.minimum_sell_price,
      approval_required: pricing.approval_required,
      approval_reasons: pricing.approval_reasons,
    },
    approval_status: pricing.approval_required ? "pending" : "not_required",
    approved_at: null,
    approved_by_name: null,
    approved_by_email: null,
  };
}

export async function listTmsTenders(staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const snapshot = await firebaseAdminDb().collection("transport_tenders").orderBy("updated_at", "desc").limit(1000).get();
  const now = new Date().toISOString();
  const tenders: TmsTender[] = [];
  for (const doc of snapshot.docs) {
    const tender = tenderFromData(doc.id, doc.data() as Record<string, unknown>);
    const branch = branchValue(doc.get("branch"));
    if (!tender || !branch || !staffCanAccessBranch(staff, branch)) continue;
    if (tenderIsExpired(tender, now)) tender.status = "expired";
    tenders.push(tender);
  }
  return { kind: "ready" as const, tenders };
}

export async function createTmsTender(input: TenderCreateInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  if (!tmsTenderChannels.includes(input.channel)) return { kind: "invalid" as const };
  const dueAt = futureIso(input.responseDueAt);
  if (!dueAt) return { kind: "invalid_deadline" as const };
  const recipientEmail = input.recipientEmail?.trim().toLowerCase() || "";
  if (input.channel === "email" && !emailLooksValid(recipientEmail)) return { kind: "recipient_required" as const };

  const db = firebaseAdminDb();
  const orderId = input.orderId.trim().toUpperCase();
  const orderRef = db.collection("transport_orders").doc(orderId);
  const id = tenderId();
  const ref = db.collection("transport_tenders").doc(id);
  const reference = tenderReference();
  const now = new Date().toISOString();
  const orderEventRef = orderRef.collection("events").doc(eventId());
  try {
    return await db.runTransaction(async (transaction) => {
      const order = await transaction.get(orderRef);
      if (!order.exists) return { kind: "missing_order" as const };
      const orderData = order.data() as Record<string, unknown>;
      const branch = branchValue(orderData.branch);
      const mode = modeValue(orderData.mode);
      if (!branch || !mode) return { kind: "missing_order" as const };
      if (!staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
      if ((nullable(orderData.consolidation_load_id) || orderData.procurement_locked_by_load === true || nullable(orderData.consolidation_master_order_id)) && orderData.is_consolidation_master !== true) return { kind: "consolidated_order" as const };

      const activeState = await activeTenderDocsInTransaction(transaction, orderId, now);
      const pointer = text(order.get("active_tender_id")).trim().toUpperCase();
      if (activeState.live.length > 1) return { kind: "state_conflict" as const };
      if (activeState.live.length === 1) {
        const live = activeState.live[0];
        if (branchValue(live.get("branch")) !== branch) return { kind: "state_conflict" as const };
        if (pointer && pointer !== live.id) {
          const pointerDoc = activeState.all.find((doc) => doc.id === pointer);
          const pointerTender = pointerDoc ? tenderFromData(pointerDoc.id, pointerDoc.data() as Record<string, unknown>) : null;
          if (!pointerDoc || (pointerTender && tenderIsActive(pointerTender.status) && !tenderIsExpired(pointerTender, now))) return { kind: "state_conflict" as const };
        }
        if (pointer !== live.id || text(order.get("status")) !== "tendering") transaction.update(orderRef, { status: "tendering", active_tender_id: live.id, updated_at: now });
        return { kind: "active_tender" as const };
      }
      if (pointer) {
        const pointerDoc = activeState.all.find((doc) => doc.id === pointer);
        if (!pointerDoc || branchValue(pointerDoc.get("branch")) !== branch) return { kind: "state_conflict" as const };
        const pointerTender = tenderFromData(pointerDoc.id, pointerDoc.data() as Record<string, unknown>);
        if (pointerTender && tenderIsActive(pointerTender.status) && !tenderIsExpired(pointerTender, now)) return { kind: "active_tender" as const };
      }
      if (text(orderData.status) !== "selected") return { kind: "rate_required" as const };

      const resolved = await resolveCurrentCommercialVersionInTransaction(transaction, order, actor);
      if (resolved.kind !== "ready") return { kind: "commercial_review_required" as const, reason: resolved.kind === "commercial_review_required" ? resolved.reason : "commercial_version_required" };
      const version = resolved.version;
      const isMaster = orderData.is_consolidation_master === true;
      if (!isMaster) {
        const bookable = await assertBookableCommercialVersionInTransaction(transaction, version);
        if (bookable.decision.ok === false) return { kind: bookable.decision.reason as "pricing_required" | "approval_required" | "commercial_review_required" };
      }
      if (resolved.legacy_reconstructed) {
        if (!isMaster || version.snapshot.pricing) return { kind: "pricing_required" as const };
        persistCommercialVersionInTransaction(transaction, version);
      }
      const procurement = version.snapshot.procurement;
      const offeredCurrency = currencyValue(procurement.currency);
      const offeredCost = procurement.total;
      const partnerId = normalizeCommercialId(procurement.partner_id);
      const rateCardId = normalizeCommercialId(procurement.rate_card_id);
      if (!offeredCurrency || offeredCost < 0 || !partnerId || !rateCardId) return { kind: "rate_required" as const };
      if (!sameCommercialMoney(orderData.selected_cost, offeredCost, offeredCurrency) || normalizeCommercialCurrency(orderData.selected_currency) !== offeredCurrency) return { kind: "commercial_review_required" as const, reason: "order_projection_drift" };

      const data = {
        order_id: orderId, tender_reference: reference, branch, status: "sent", channel: input.channel,
        partner_id: partnerId, partner_name: procurement.partner_name || partnerId,
        recipient_name: input.recipientName?.trim() || null, recipient_email: recipientEmail || null,
        rate_card_id: rateCardId, mode, service: procurement.service, equipment: procurement.equipment,
        currency: offeredCurrency, offered_cost: offeredCost, counter_cost: null, counter_currency: null, final_cost: null, final_currency: null,
        offered_commercial_version_id: version.id, offered_commercial_fingerprint: version.fingerprint,
        commercial_version_id: version.id, commercial_fingerprint: version.fingerprint,
        final_commercial_version_id: null, final_commercial_fingerprint: null,
        origin: text(orderData.origin), destination: text(orderData.destination), pickup_date: nullable(orderData.pickup_date),
        response_due_at: dueAt, sent_at: now, responded_at: null, response_note: null,
        booking_reference: null, pickup_confirmation: null, booked_at: null, shipment_reference: null,
        consolidation_load_id: nullable(orderData.consolidation_load_id), is_consolidation_master: isMaster,
        created_by_name: actor.name, created_by_email: actor.email, updated_at: now,
      };
      for (const expired of activeState.expired) transaction.update(expired.ref, { status: "expired", updated_at: now });
      transaction.create(ref, data);
      transaction.update(orderRef, { status: "tendering", active_tender_id: id, tender_commercial_version_id: version.id, tender_commercial_fingerprint: version.fingerprint, updated_at: now });
      transaction.create(orderEventRef, {
        ...commercialEventPayload(version, "tender_bound_to_commercial_version", actor, `${reference} · ${offeredCurrency} ${offeredCost.toFixed(offeredCurrency === "JPY" ? 0 : 2)} · response due ${dueAt}`),
        tender_id: id, tender_reference: reference,
      });
      return { kind: "created" as const, tender: tenderFromData(id, data)! };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

async function applyTenderResponse(
  tenderIdValue: string,
  input: TenderResponseInput,
  actor: Actor,
  staff: KcplStaffContext | null,
  expectedUpdatedAt: string | null,
  expectedStatus: TmsTenderStatus | null,
  edi?: Edi990TransitionInput,
) {
  const db = firebaseAdminDb();
  const tenderRef = db.collection("transport_tenders").doc(tenderIdValue.trim().toUpperCase());
  const now = new Date().toISOString();
  const orderEventId = eventId();
  try {
    return await db.runTransaction(async (transaction) => {
      const tenderSnapshotValue = await transaction.get(tenderRef);
      if (!tenderSnapshotValue.exists) return { kind: "missing" as const };
      const tender = tenderFromData(tenderSnapshotValue.id, tenderSnapshotValue.data() as Record<string, unknown>);
      const branch = branchValue(tenderSnapshotValue.get("branch"));
      if (!tender || !branch) return { kind: "missing" as const };
      if (staff && !staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
      const orderRef = db.collection("transport_orders").doc(tender.order_id);
      const order = await transaction.get(orderRef);
      if (!order.exists) return { kind: "missing_order" as const };
      if (branchValue(order.get("branch")) !== branch) return { kind: "state_conflict" as const };

      const authoritative = tenderIsActive(tender.status) ? await authoritativeTenderInTransaction(transaction, order, tender, now) : null;
      if (tenderIsExpired(tender, now)) {
        const orderStatus = text(order.get("status"));
        transaction.update(tenderRef, { status: "expired", updated_at: now });
        if (authoritative === "authoritative" || authoritative === "legacy_unique") {
          transaction.update(orderRef, orderStatus === "selected" || orderStatus === "tendering"
            ? { status: "selected", active_tender_id: null, updated_at: now }
            : { active_tender_id: null, updated_at: now });
          transaction.create(orderRef.collection("events").doc(orderEventId), {
            type: "tender_expired", title: `Tender expired: ${tender.tender_reference}`,
            detail: `No response was recorded by ${tender.response_due_at}. The order is available for re-tendering.`,
            actor_name: actor.name, actor_email: actor.email, created_at: now,
          });
        }
        return { kind: "expired" as const };
      }

      if (responseMatches(tender, input)) {
        const orderStatus = text(order.get("status"));
        if (tender.status === "accepted" || tender.status === "countered") {
          if (authoritative !== "authoritative" && authoritative !== "legacy_unique") return { kind: "stale_tender" as const };
          if (orderStatus !== "selected" && orderStatus !== "tendering") return { kind: "state_conflict" as const };
          if (authoritative === "legacy_unique" || orderStatus !== "tendering") transaction.update(orderRef, { status: "tendering", active_tender_id: tender.id, updated_at: now });
        } else if (tender.status === "rejected") {
          const activeState = await activeTenderDocsInTransaction(transaction, tender.order_id, now);
          const decision = repeatedRejectedTenderDecision({ orderStatus, activeTenderId: text(order.get("active_tender_id")) || null, rejectedTenderId: tender.id, liveTenderIds: activeState.live.map((doc) => doc.id) });
          if (decision === "stale") return { kind: "stale_tender" as const };
          if (decision === "state_conflict") return { kind: "state_conflict" as const };
          if (decision === "repair_clear") transaction.update(orderRef, { status: "selected", active_tender_id: null, updated_at: now });
        }
        if (edi) transaction.set(edi.transactionRef, ediProcessedFields(edi, tender, tender.order_id, branch, now), { merge: true });
        return { kind: "updated" as const, tender, idempotent: true };
      }

      if (expectedStatus && tender.status !== expectedStatus) return { kind: "state_conflict" as const };
      if (expectedUpdatedAt && tender.updated_at !== expectedUpdatedAt) return { kind: "state_conflict" as const };
      if (tender.status !== "sent") return { kind: "invalid_transition" as const };
      if (authoritative !== "authoritative" && authoritative !== "legacy_unique") return { kind: "stale_tender" as const };
      if (!tenderResponseAllowed(tender.status, input.status)) return { kind: "invalid_transition" as const };

      if (input.status === "rejected") {
        const update = { status: "rejected", responded_at: now, response_note: input.note?.trim() || null, counter_cost: null, counter_currency: null, ...(edi ? { edi_990_transaction_id: edi.transactionRef.id, edi_990_response_code: edi.responseCode ?? null } : {}), updated_at: now };
        transaction.update(tenderRef, update);
        transaction.update(orderRef, { status: "selected", active_tender_id: null, updated_at: now });
        transaction.create(orderRef.collection("events").doc(orderEventId), {
          type: edi ? "tender_rejected_edi_990" : "tender_rejected", title: edi ? `${tender.partner_name}: tender rejected by EDI 990` : `${tender.partner_name}: tender rejected`,
          detail: input.note?.trim() || null, actor_name: actor.name, actor_email: actor.email, created_at: now,
        });
        if (edi) transaction.set(edi.transactionRef, ediProcessedFields(edi, tender, tender.order_id, branch, now), { merge: true });
        return { kind: "updated" as const, tender: tenderFromData(tender.id, { ...tenderSnapshotValue.data(), ...update })!, idempotent: false };
      }

      const versionResult = await tenderCommercialVersionInTransaction(transaction, tenderSnapshotValue, tender.order_id);
      if (versionResult.kind !== "ready") return { kind: "commercial_review_required" as const };
      const baseVersion = versionResult.version;
      const orderPointer = versionPointer(order);
      if (orderPointer.id !== baseVersion.id || orderPointer.fingerprint !== baseVersion.fingerprint) return { kind: "stale_commercial_state" as const };

      if (input.status === "accepted") {
        const update = {
          status: "accepted", responded_at: now, response_note: input.note?.trim() || null, counter_cost: null, counter_currency: null,
          final_commercial_version_id: baseVersion.id, final_commercial_fingerprint: baseVersion.fingerprint,
          ...(edi ? { edi_990_transaction_id: edi.transactionRef.id, edi_990_response_code: edi.responseCode ?? null } : {}), updated_at: now,
        };
        transaction.update(tenderRef, update);
        transaction.update(orderRef, { status: "tendering", active_tender_id: tender.id, updated_at: now });
        transaction.create(orderRef.collection("events").doc(orderEventId), commercialEventPayload(baseVersion, edi ? "tender_accepted_edi_990" : "tender_accepted", actor, input.note?.trim() || `Accepted at ${tender.currency} ${tender.offered_cost.toFixed(tender.currency === "JPY" ? 0 : 2)}`));
        if (edi) transaction.set(edi.transactionRef, ediProcessedFields(edi, tender, tender.order_id, branch, now), { merge: true });
        return { kind: "updated" as const, tender: tenderFromData(tender.id, { ...tenderSnapshotValue.data(), ...update })!, idempotent: false };
      }

      const counterCost = input.counterCost ?? -1;
      const counterCurrency = input.counterCurrency;
      if (!counterCurrency || counterCost < 0 || !Number.isFinite(counterCost)) return { kind: "invalid_counter" as const };
      const sameEconomics = normalizeCommercialCurrency(counterCurrency) === normalizeCommercialCurrency(tender.currency)
        && sameCommercialMoney(counterCost, tender.offered_cost, tender.currency);
      if (sameEconomics) {
        const update = {
          status: "countered", responded_at: now, response_note: input.note?.trim() || null,
          counter_cost: counterCost, counter_currency: counterCurrency,
          final_commercial_version_id: baseVersion.id, final_commercial_fingerprint: baseVersion.fingerprint, updated_at: now,
        };
        transaction.update(tenderRef, update);
        transaction.update(orderRef, { status: "tendering", active_tender_id: tender.id, updated_at: now });
        transaction.create(orderRef.collection("events").doc(orderEventId), commercialEventPayload(baseVersion, "tender_countered_no_economic_change", actor, `${counterCurrency} ${counterCost.toFixed(counterCurrency === "JPY" ? 0 : 2)}`));
        return { kind: "updated" as const, tender: tenderFromData(tender.id, { ...tenderSnapshotValue.data(), ...update })!, idempotent: false };
      }

      const nextSnapshot = deriveCounterofferSnapshot(baseVersion.snapshot, counterCost, counterCurrency);
      const nextVersion = newCommercialVersion({
        snapshot: nextSnapshot, previousVersionId: baseVersion.id, reason: "counteroffer", actor,
        sourceReferences: { tender_id: tender.id, offered_commercial_version_id: baseVersion.id, rate_card_id: baseVersion.snapshot.procurement.rate_card_id },
      });
      persistCommercialVersionInTransaction(transaction, nextVersion);
      const pricing = nextVersion.snapshot.pricing;
      const needsFxReview = Boolean(pricing && pricing.converted_buy_cost === null);
      const projection = counterPricingProjection(order.get("pricing_snapshot"), nextVersion);
      const pointerFields = commercialOrderPointer(nextVersion, needsFxReview ? "review_required" : pricing?.approval_required ? "pending" : "not_required");
      const update = {
        status: "countered", responded_at: now, response_note: input.note?.trim() || null,
        counter_cost: counterCost, counter_currency: counterCurrency,
        commercial_version_id: nextVersion.id, commercial_fingerprint: nextVersion.fingerprint,
        final_commercial_version_id: nextVersion.id, final_commercial_fingerprint: nextVersion.fingerprint, updated_at: now,
      };
      transaction.update(tenderRef, update);
      transaction.update(orderRef, {
        status: "tendering", active_tender_id: tender.id,
        selected_cost: nextVersion.snapshot.procurement.total, selected_currency: nextVersion.snapshot.procurement.currency,
        pricing_status: needsFxReview || pricing?.approval_required ? "approval_required" : pricing ? "priced" : "unpriced",
        pricing_snapshot: projection,
        quoted_reference: null,
        tender_commercial_version_id: nextVersion.id, tender_commercial_fingerprint: nextVersion.fingerprint,
        ...pointerFields,
        updated_at: now,
      });
      transaction.create(orderRef.collection("events").doc(orderEventId), commercialEventPayload(nextVersion, "counteroffer_commercial_version_created", actor, `${counterCurrency} ${counterCost.toFixed(counterCurrency === "JPY" ? 0 : 2)}${needsFxReview ? " · FX review required" : pricing?.approval_required ? " · re-approval required" : " · policy-valid"}`));
      return { kind: "updated" as const, tender: tenderFromData(tender.id, { ...tenderSnapshotValue.data(), ...update })!, idempotent: false };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function respondToTmsTender(tenderIdValue: string, input: TenderResponseInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  if (input.status === "countered" && (input.counterCost === null || input.counterCost === undefined || !Number.isFinite(input.counterCost) || input.counterCost < 0 || !input.counterCurrency || !crmCurrencies.includes(input.counterCurrency))) return { kind: "invalid_counter" as const };
  const preflight = await tenderSnapshot(tenderIdValue);
  if (!preflight) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, preflight.branch)) return { kind: "forbidden" as const };
  return applyTenderResponse(preflight.tender.id, input, actor, staff, preflight.tender.updated_at, preflight.tender.status, undefined);
}

export async function respondToTmsTenderFromEdi990(tenderIdValue: string, input: Edi990TransitionInput, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  return applyTenderResponse(tenderIdValue, { status: input.status, note: input.note, counterCost: null, counterCurrency: null }, actor, null, input.expectedUpdatedAt ?? null, input.expectedStatus ?? null, input);
}

export async function cancelTmsTender(tenderIdValue: string, note: string, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const preflight = await tenderSnapshot(tenderIdValue);
  if (!preflight) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, preflight.branch)) return { kind: "forbidden" as const };
  const expectedUpdatedAt = preflight.tender.updated_at;
  const expectedStatus = preflight.tender.status;
  const db = firebaseAdminDb();
  const now = new Date().toISOString();
  const orderEventId = eventId();
  try {
    return await db.runTransaction(async (transaction) => {
      const current = await transaction.get(preflight.ref);
      if (!current.exists) return { kind: "missing" as const };
      const tender = tenderFromData(current.id, current.data() as Record<string, unknown>);
      const branch = branchValue(current.get("branch"));
      if (!tender || !branch) return { kind: "missing" as const };
      if (!staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
      const orderRef = db.collection("transport_orders").doc(tender.order_id);
      const order = await transaction.get(orderRef);
      if (!order.exists) return { kind: "missing_order" as const };
      if (branchValue(order.get("branch")) !== branch) return { kind: "state_conflict" as const };
      if (tender.status !== expectedStatus || tender.updated_at !== expectedUpdatedAt) return { kind: "state_conflict" as const };
      if (!tenderCanCancel(tender.status)) return { kind: "invalid_transition" as const };
      const authoritative = await authoritativeTenderInTransaction(transaction, order, tender, now);
      if (authoritative !== "authoritative" && authoritative !== "legacy_unique") return { kind: "stale_tender" as const };
      transaction.update(preflight.ref, { status: "cancelled", response_note: note.trim() || null, updated_at: now });
      transaction.update(orderRef, { status: "selected", active_tender_id: null, updated_at: now });
      transaction.create(orderRef.collection("events").doc(orderEventId), { type: "tender_cancelled", title: `Tender cancelled: ${tender.tender_reference}`, detail: note.trim() || null, actor_name: actor.name, actor_email: actor.email, created_at: now });
      return { kind: "cancelled" as const };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}

async function createBookedShipment(tenderIdValue: string, expectedUpdatedAt: string, expectedStatus: TmsTenderStatus, input: TenderBookingInput, actor: Actor, staff: KcplStaffContext) {
  const bookingReference = input.bookingReference.trim();
  if (!bookingReference) return { kind: "booking_reference_required" as const };
  const db = firebaseAdminDb();
  const tenderRef = db.collection("transport_tenders").doc(tenderIdValue);
  const newShipmentReference = shipmentReference();
  const shipmentRef = db.collection("shipments").doc(newShipmentReference);
  const now = new Date().toISOString();
  try {
    const result = await db.runTransaction(async (transaction) => {
      const tenderSnapshotValue = await transaction.get(tenderRef);
      if (!tenderSnapshotValue.exists) return { kind: "missing" as const };
      const tender = tenderFromData(tenderSnapshotValue.id, tenderSnapshotValue.data() as Record<string, unknown>);
      const branch = branchValue(tenderSnapshotValue.get("branch"));
      if (!tender || !branch) return { kind: "missing" as const };
      if (!staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
      const orderRef = db.collection("transport_orders").doc(tender.order_id);
      const order = await transaction.get(orderRef);
      if (!order.exists) return { kind: "missing_order" as const };
      if (branchValue(order.get("branch")) !== branch) return { kind: "state_conflict" as const };
      const orderData = order.data() as Record<string, unknown>;

      if (tender.status === "booked") {
        const existingReference = tender.shipment_reference;
        const existingBookingReference = tender.booking_reference;
        if (!existingReference || !existingBookingReference || normalizeCommercialId(order.get("shipment_reference")) !== normalizeCommercialId(existingReference)) return { kind: "state_conflict" as const };
        const bookedVersionId = normalizeCommercialId(tenderSnapshotValue.get("booked_commercial_version_id") ?? tenderSnapshotValue.get("final_commercial_version_id"));
        const bookedFingerprint = text(tenderSnapshotValue.get("booked_commercial_fingerprint") ?? tenderSnapshotValue.get("final_commercial_fingerprint"));
        const versionResult = await loadCommercialVersionInTransaction(transaction, bookedVersionId, bookedFingerprint, tender.order_id);
        if (versionResult.kind !== "ready") return { kind: "commercial_review_required" as const };
        const version = versionResult.version;
        const existingShipmentRef = db.collection("shipments").doc(existingReference.toUpperCase());
        const bridgeRef = db.collection("quotes").doc(bridgeQuoteReference(tender.order_id));
        const [existingShipment, bridge] = await Promise.all([transaction.get(existingShipmentRef), transaction.get(bridgeRef)]);
        const expectedCustomerId = normalizeCommercialId(orderData.customer_id);
        const decision = bookingRetryDecision({
          requestedBookingReference: bookingReference, tenderBookingReference: existingBookingReference, orderBookingReference: text(order.get("booking_reference")),
          tenderShipmentReference: existingReference, orderShipmentReference: text(order.get("shipment_reference")), shipmentExists: existingShipment.exists,
          shipmentOrderId: existingShipment.exists ? text(existingShipment.get("transport_order_id")) : null, expectedOrderId: tender.order_id,
          shipmentTenderId: existingShipment.exists ? text(existingShipment.get("tender_id")) : null, expectedTenderId: tender.id,
          shipmentBookingReference: existingShipment.exists ? text(existingShipment.get("carrier_reference")) : null,
          shipmentBranch: existingShipment.exists ? text(existingShipment.get("primary_branch")) : null, expectedBranch: branch,
          shipmentCustomerId: existingShipment.exists ? text(existingShipment.get("customer_id")) : null, expectedCustomerId,
          shipmentConsolidationLoadId: existingShipment.exists ? nullable(existingShipment.get("consolidation_load_id")) : null,
        });
        if (decision !== "idempotent") return { kind: decision as "booking_conflict" | "state_conflict" };
        if (!expectedCustomerId || !bridge.exists || normalizeCommercialId(bridge.get("transport_order_id")) !== tender.order_id || normalizeCommercialId(bridge.get("shipment_reference")) !== normalizeCommercialId(existingReference)) return { kind: "state_conflict" as const };
        if (normalizeCommercialId(order.get("booked_commercial_version_id")) !== version.id || text(order.get("booked_commercial_fingerprint")) !== version.fingerprint
          || !existingShipment.exists || normalizeCommercialId(existingShipment.get("booked_commercial_version_id")) !== version.id || text(existingShipment.get("booked_commercial_fingerprint")) !== version.fingerprint
          || normalizeCommercialId(bridge.get("commercial_version_id")) !== version.id || text(bridge.get("commercial_fingerprint")) !== version.fingerprint) return { kind: "state_conflict" as const };
        return { kind: "booked" as const, shipmentReference: existingReference, idempotent: true };
      }

      if (tender.status !== expectedStatus || tender.updated_at !== expectedUpdatedAt) return { kind: "state_conflict" as const };
      if (text(order.get("status")) === "booked") return { kind: "state_conflict" as const };
      if (!tenderCanBook(tender.status)) return { kind: "invalid_transition" as const };
      const authoritative = await authoritativeTenderInTransaction(transaction, order, tender, now);
      if (authoritative !== "authoritative" && authoritative !== "legacy_unique") return { kind: "stale_tender" as const };
      if ((nullable(orderData.consolidation_load_id) || orderData.procurement_locked_by_load === true || nullable(orderData.consolidation_master_order_id)) && orderData.is_consolidation_master !== true) return { kind: "consolidated_order" as const };

      const versionResult = await tenderCommercialVersionInTransaction(transaction, tenderSnapshotValue, tender.order_id);
      if (versionResult.kind !== "ready") return { kind: "commercial_review_required" as const };
      const version = versionResult.version;
      const orderPointer = versionPointer(order);
      if (orderPointer.id !== version.id || orderPointer.fingerprint !== version.fingerprint) return { kind: "stale_commercial_state" as const };
      const finalId = normalizeCommercialId(tenderSnapshotValue.get("final_commercial_version_id"));
      const finalFp = text(tenderSnapshotValue.get("final_commercial_fingerprint"));
      if ((finalId && finalId !== version.id) || (finalFp && finalFp !== version.fingerprint)) return { kind: "stale_commercial_state" as const };
      const bookable = await assertBookableCommercialVersionInTransaction(transaction, version);
      if (bookable.decision.ok === false) return { kind: bookable.decision.reason as "pricing_required" | "approval_required" | "commercial_review_required" };
      const commercials = tenderFinalCommercials(tender);
      if (!commercials) return { kind: "commercials_required" as const };
      if (normalizeCommercialCurrency(commercials.currency) !== normalizeCommercialCurrency(version.snapshot.procurement.currency)
        || !sameCommercialMoney(commercials.amount, version.snapshot.procurement.total, commercials.currency)) return { kind: "stale_commercial_state" as const };
      if (tender.status === "accepted" && (normalizeCommercialId(tenderSnapshotValue.get("offered_commercial_version_id")) !== version.id || text(tenderSnapshotValue.get("offered_commercial_fingerprint")) !== version.fingerprint)) return { kind: "stale_commercial_state" as const };

      const mode = modeValue(orderData.mode);
      if (!mode) return { kind: "state_conflict" as const };
      const customerId = normalizeCommercialId(orderData.customer_id);
      if (!customerId) return { kind: "customer_required" as const };
      const customerRef = db.collection("customers").doc(customerId);
      const customer = await transaction.get(customerRef);
      if (!customer.exists || customer.get("archived") === true) return { kind: "customer_missing" as const };

      const explicitQuoteReference = nullable(orderData.quoted_reference);
      if (explicitQuoteReference) {
        const explicitQuote = await transaction.get(db.collection("quotes").doc(explicitQuoteReference));
        if (!explicitQuote.exists || normalizeCommercialId(explicitQuote.get("commercial_version_id")) !== version.id || text(explicitQuote.get("commercial_fingerprint")) !== version.fingerprint) return { kind: "stale_commercial_state" as const };
      }

      const quoteReference = bridgeQuoteReference(tender.order_id);
      const quoteRef = db.collection("quotes").doc(quoteReference);
      const quote = await transaction.get(quoteRef);
      if (quote.exists) {
        const quoteOrderId = normalizeCommercialId(quote.get("transport_order_id"));
        const quoteShipment = nullable(quote.get("shipment_reference"));
        const quoteVersion = normalizeCommercialId(quote.get("commercial_version_id"));
        if ((quoteOrderId && quoteOrderId !== tender.order_id) || quoteShipment || (quoteVersion && quoteVersion !== version.id)) return { kind: "state_conflict" as const };
      }
      transaction.set(quoteRef, {
        reference: quoteReference, status: "won", migration_hidden: true, source: "tms_order_booking_bridge",
        transport_order_id: tender.order_id, customer_id: customerId, company_name: text(customer.get("display_name"), customerId),
        contact_name: "", contact_email: text(customer.get("primary_email")), phone: text(customer.get("primary_phone")),
        origin: text(orderData.origin), destination: text(orderData.destination), mode, cargo_type: "",
        quote_currency: version.snapshot.pricing?.sell_currency ?? text(customer.get("preferred_currency"), "NPR"),
        quoted_amount: version.snapshot.pricing?.sell_amount ?? null, internal_cost: version.snapshot.pricing?.converted_buy_cost ?? null,
        assigned_to: actor.name, assigned_to_name: actor.name, assigned_to_email: actor.email,
        shipment_reference: newShipmentReference, commercial_version_id: version.id, commercial_fingerprint: version.fingerprint,
        commercial_snapshot: version.snapshot, commercial_locked: true, created_at: quote.exists ? text(quote.get("created_at"), now) : now, updated_at: now,
      }, { merge: true });
      transaction.create(shipmentRef, {
        reference: newShipmentReference, quote_reference: quoteReference, customer_quote_reference: explicitQuoteReference,
        transport_order_id: tender.order_id, tender_id: tender.id, tender_reference: tender.tender_reference,
        customer_id: customerId, primary_branch: branch, handling_branches: [branch], origin: text(orderData.origin), destination: text(orderData.destination), mode,
        job_priority: "standard", job_assigned_to_uid: null, job_assigned_to_name: null, job_assigned_to_email: null, job_assigned_to_phone: null,
        internal_job_reference: tender.order_id, internal_job_notes: nullable(orderData.notes), workflow_version: 1,
        job_closed_at: null, job_closed_by_name: null, job_closed_by_email: null, job_close_note: null, job_close_overridden: false,
        status: "booking_confirmed", eta: null, current_location: text(orderData.origin), carrier: tender.partner_name, carrier_reference: bookingReference,
        partner_id: version.snapshot.procurement.partner_id, procurement_rate_card_id: version.snapshot.procurement.rate_card_id,
        procurement_cost: version.snapshot.procurement.total, procurement_currency: version.snapshot.procurement.currency,
        commercial_version_id: version.id, commercial_fingerprint: version.fingerprint,
        ...commercialBookedSnapshotFields(version),
        customer_note: null, booking_operation_id: `tender:${tender.id}`,
        booking_artifact_seed_version: TMS_BOOKING_ARTIFACT_SEED_VERSION, booking_artifact_kind: "standard", booking_artifacts_seeded_at: null,
        booking_actor_name: actor.name, booking_actor_email: actor.email, created_at: now, updated_at: now,
      });
      const currentActive = Math.max(0, numberValue(customer.get("active_shipment_count")));
      const currentStatus = text(customer.get("account_status"));
      transaction.update(customerRef, { active_shipment_count: currentActive + 1, lead_stage: "won", ...(currentStatus === "prospect" || currentStatus === "dormant" ? { account_status: "active" } : {}), updated_at: now });
      transaction.update(tenderRef, {
        status: "booked", final_cost: version.snapshot.procurement.total, final_currency: version.snapshot.procurement.currency,
        final_commercial_version_id: version.id, final_commercial_fingerprint: version.fingerprint,
        booked_commercial_version_id: version.id, booked_commercial_fingerprint: version.fingerprint,
        booking_reference: bookingReference, pickup_confirmation: input.pickupConfirmation?.trim() || null,
        booked_at: now, shipment_reference: newShipmentReference, booking_operation_id: `tender:${tender.id}`, updated_at: now,
      });
      transaction.update(orderRef, {
        status: "booked", active_tender_id: null, booked_tender_id: tender.id, booking_reference: bookingReference, shipment_reference: newShipmentReference,
        selected_cost: version.snapshot.procurement.total, selected_currency: version.snapshot.procurement.currency,
        booked_commercial_version_id: version.id, booked_commercial_fingerprint: version.fingerprint,
        commercial_lineage_status: "booked_locked", booking_operation_id: `tender:${tender.id}`, updated_at: now,
      });
      transaction.create(orderRef.collection("events").doc(`booking-${newShipmentReference}`), commercialEventPayload(version, "booked_commercial_version_locked", actor, `${newShipmentReference} · ${version.snapshot.procurement.currency} ${version.snapshot.procurement.total.toFixed(version.snapshot.procurement.currency === "JPY" ? 0 : 2)} · ${bookingReference}`));
      return { kind: "booked" as const, shipmentReference: newShipmentReference, idempotent: false };
    });
    if (result.kind === "booked") await ensureBookingArtifacts(result.shipmentReference, actor);
    return result;
  } catch {
    return { kind: "unavailable" as const };
  }
}

export async function confirmTmsTenderBooking(tenderIdValue: string, input: TenderBookingInput, actor: Actor, staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  if (!input.bookingReference.trim()) return { kind: "booking_reference_required" as const };
  const record = await tenderSnapshot(tenderIdValue);
  if (!record) return { kind: "missing" as const };
  if (!staffCanAccessBranch(staff, record.branch)) return { kind: "forbidden" as const };
  const order = await orderSnapshot(record.tender.order_id);
  if (!order) return { kind: "missing_order" as const };
  if (order.branch !== record.branch) return { kind: "state_conflict" as const };

  const loadId = nullable(order.data.consolidation_load_id);
  if (order.data.is_consolidation_master === true && loadId) {
    const commercials = tenderFinalCommercials(record.tender);
    if (record.tender.status !== "booked" && !commercials) return { kind: "commercials_required" as const };
    const consolidated = await confirmConsolidatedLoadBooking({
      loadId, masterOrderId: order.id, tenderId: record.tender.id, tenderReference: record.tender.tender_reference,
      partnerId: record.tender.partner_id, partnerName: record.tender.partner_name, rateCardId: record.tender.rate_card_id,
      bookingReference: input.bookingReference, pickupConfirmation: input.pickupConfirmation,
      amount: commercials?.amount ?? record.tender.final_cost ?? 0, currency: commercials?.currency ?? record.tender.final_currency ?? record.tender.currency,
      expectedTenderUpdatedAt: record.tender.updated_at,
    }, actor, staff);
    if (consolidated.kind === "booked") return { kind: "booked" as const, shipmentReference: consolidated.masterShipmentReference, shipmentReferences: consolidated.shipmentReferences, consolidationLoadId: loadId };
    return consolidated;
  }
  return createBookedShipment(record.tender.id, record.tender.updated_at, record.tender.status, input, actor, staff);
}
