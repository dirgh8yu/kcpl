import { createHash, randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { recordOrderedTrackingEvent } from "../visibility/tracking-ingest.server";
import { build204, parse214, parse990, parseX12, type EdiTransactionSet, type EdiTransactionStatus } from "./edi-x12";

type Actor = { name: string; email: string };
type FirestoreDoc = { id: string; data(): Record<string, unknown>; get(field: string): unknown; ref: FirebaseFirestore.DocumentReference };

export type EdiLedgerRow = {
  id: string;
  direction: "inbound" | "outbound";
  transaction_set: EdiTransactionSet;
  status: EdiTransactionStatus;
  branch: KcplBranch | null;
  partner: string | null;
  reference: string | null;
  tender_reference: string | null;
  shipment_reference: string | null;
  transaction_control: string | null;
  interchange_control: string | null;
  message: string | null;
  created_at: string;
  processed_at: string | null;
};

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const output = text(value); return output || null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function hashPayload(raw: string) { return createHash("sha256").update(raw.replace(/\r\n/g, "\n").trim()).digest("hex"); }
function transactionId(direction: string, set: string, fingerprint: string) { return `${direction}-${set}-${fingerprint.slice(0, 40)}`; }
function eventId(prefix = "edi") { return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`; }

function ledgerFromDoc(doc: FirestoreDoc): EdiLedgerRow | null {
  const direction = text(doc.get("direction"));
  const set = text(doc.get("transaction_set"));
  const status = text(doc.get("status"));
  if (!["inbound", "outbound"].includes(direction) || !["204", "990", "214"].includes(set) || !["queued", "dispatched", "processed", "duplicate", "quarantined", "failed"].includes(status)) return null;
  return {
    id: doc.id,
    direction: direction as EdiLedgerRow["direction"],
    transaction_set: set as EdiTransactionSet,
    status: status as EdiTransactionStatus,
    branch: branchValue(doc.get("branch")),
    partner: nullable(doc.get("partner")),
    reference: nullable(doc.get("reference")),
    tender_reference: nullable(doc.get("tender_reference")),
    shipment_reference: nullable(doc.get("shipment_reference")),
    transaction_control: nullable(doc.get("transaction_control")),
    interchange_control: nullable(doc.get("interchange_control")),
    message: nullable(doc.get("message")),
    created_at: text(doc.get("created_at")),
    processed_at: nullable(doc.get("processed_at")),
  };
}

export function ediGatewayConfigured() {
  return Boolean(process.env.KCPL_EDI_SECRET?.trim());
}

export async function queueEdi204(input: {
  branch: KcplBranch;
  tenderId: string;
  tenderReference: string;
  orderReference: string;
  partnerId: string;
  partnerName: string;
  ediReceiverId?: string | null;
  origin: string;
  destination: string;
  pickupDate?: string | null;
  deliveryDate?: string | null;
  equipment?: string | null;
  mode: string;
  weightKg?: number;
  pieces?: number;
  offeredCost: number;
  currency: string;
}, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const payload = build204({
    tenderReference: input.tenderReference,
    orderReference: input.orderReference,
    senderId: "KCPL",
    receiverId: input.ediReceiverId || input.partnerId,
    partnerName: input.partnerName,
    origin: input.origin,
    destination: input.destination,
    pickupDate: input.pickupDate,
    deliveryDate: input.deliveryDate,
    equipment: input.equipment,
    mode: input.mode,
    weightKg: input.weightKg,
    pieces: input.pieces,
    offeredCost: input.offeredCost,
    currency: input.currency,
  });
  const envelope = parseX12(payload);
  const fingerprint = hashPayload(payload);
  const id = transactionId("outbound", "204", fingerprint);
  const ref = firebaseAdminDb().collection("edi_transactions").doc(id);
  const existing = await ref.get();
  if (existing.exists) return { kind: "duplicate" as const, transactionId: id, payload };
  const now = new Date().toISOString();
  await ref.create({
    direction: "outbound",
    transaction_set: "204",
    status: "queued",
    branch: input.branch,
    partner_id: input.partnerId,
    partner: input.partnerName,
    reference: input.orderReference,
    order_reference: input.orderReference,
    tender_id: input.tenderId,
    tender_reference: input.tenderReference,
    shipment_reference: null,
    transaction_control: envelope.transactionControl,
    interchange_control: envelope.interchangeControl,
    fingerprint,
    raw_payload: payload,
    message: "EDI 204 load tender queued for integration pickup.",
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: now,
    updated_at: now,
    processed_at: null,
  });
  return { kind: "queued" as const, transactionId: id, payload };
}

async function findTenderFor990(parsed: ReturnType<typeof parse990>) {
  const db = firebaseAdminDb();
  if (parsed.tenderReference) {
    const result = await db.collection("transport_tenders").where("tender_reference", "==", parsed.tenderReference).limit(3).get();
    if (result.size === 1) return result.docs[0];
    if (result.size > 1) return null;
  }
  if (parsed.orderReference) {
    const result = await db.collection("transport_tenders").where("order_id", "==", parsed.orderReference.toUpperCase()).limit(10).get();
    const active = result.docs.filter((doc) => text(doc.get("status")) === "sent");
    if (active.length === 1) return active[0];
  }
  return null;
}

async function process990(raw: string, transactionRef: FirebaseFirestore.DocumentReference, partner: string, actor: Actor) {
  const parsed = parse990(raw);
  if (!parsed.response) return { kind: "quarantined" as const, message: `EDI 990 response code ${parsed.responseCode || "missing"} is not supported.` };
  const tender = await findTenderFor990(parsed);
  if (!tender) return { kind: "quarantined" as const, message: "EDI 990 could not be matched uniquely to an active tender." };
  const status = text(tender.get("status"));
  if (status !== "sent") return { kind: "quarantined" as const, message: `Matched tender is ${status || "unknown"}; only sent tenders accept EDI 990 responses.` };
  const branch = branchValue(tender.get("branch"));
  const orderId = text(tender.get("order_id")).toUpperCase();
  if (!branch || !orderId) return { kind: "quarantined" as const, message: "Matched tender is missing branch or order linkage." };
  const orderRef = firebaseAdminDb().collection("transport_orders").doc(orderId);
  const order = await orderRef.get();
  if (!order.exists) return { kind: "quarantined" as const, message: "Matched EDI 990 tender has no transport order." };
  const now = new Date().toISOString();
  const batch = firebaseAdminDb().batch();
  batch.update(tender.ref, {
    status: parsed.response,
    responded_at: now,
    response_note: parsed.note || `EDI 990 ${parsed.responseCode || "response"} from ${partner}`,
    edi_990_transaction_id: transactionRef.id,
    edi_990_response_code: parsed.responseCode,
    updated_at: now,
  });
  if (parsed.response === "rejected") batch.update(orderRef, { status: "selected", active_tender_id: null, updated_at: now });
  batch.create(orderRef.collection("events").doc(eventId()), {
    type: `tender_${parsed.response}_edi_990`,
    title: `${text(tender.get("partner_name"), partner)}: tender ${parsed.response} by EDI 990`,
    detail: parsed.note || `Response code ${parsed.responseCode || "unknown"}`,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  batch.set(transactionRef, {
    status: "processed",
    branch,
    partner,
    reference: orderId,
    order_reference: orderId,
    tender_reference: text(tender.get("tender_reference")),
    tender_id: tender.id,
    message: `Tender ${parsed.response} by EDI 990.`,
    processed_at: now,
    updated_at: now,
  }, { merge: true });
  await batch.commit();
  return { kind: "processed" as const, transactionSet: "990" as const, tenderId: tender.id, tenderReference: text(tender.get("tender_reference")), branch, response: parsed.response };
}

async function matchShipmentFor214(parsed: ReturnType<typeof parse214>) {
  const db = firebaseAdminDb();
  const candidates = new Map<string, FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot>();
  const direct = parsed.shipmentReference?.trim().toUpperCase();
  if (direct?.startsWith("KCPL-S-")) {
    const snapshot = await db.collection("shipments").doc(direct).get();
    if (snapshot.exists) candidates.set(snapshot.id, snapshot);
  }
  for (const reference of [parsed.carrierReference, parsed.bookingReference].filter((value): value is string => Boolean(value))) {
    const result = await db.collection("shipments").where("carrier_reference", "==", reference).limit(3).get();
    for (const doc of result.docs) candidates.set(doc.id, doc);
  }
  if (parsed.tenderReference) {
    const tenders = await db.collection("transport_tenders").where("tender_reference", "==", parsed.tenderReference).limit(3).get();
    for (const tender of tenders.docs) {
      const reference = nullable(tender.get("shipment_reference"));
      if (!reference) continue;
      const shipment = await db.collection("shipments").doc(reference).get();
      if (shipment.exists) candidates.set(shipment.id, shipment);
    }
  }
  return [...candidates.values()];
}

async function process214(raw: string, transactionRef: FirebaseFirestore.DocumentReference, partner: string, actor: Actor) {
  const parsed = parse214(raw);
  if (!parsed.events.length) return { kind: "quarantined" as const, message: "EDI 214 contains no supported AT7 shipment status events." };
  const matches = await matchShipmentFor214(parsed);
  if (matches.length !== 1) return { kind: "quarantined" as const, message: matches.length ? "EDI 214 matched multiple shipments and was quarantined." : "EDI 214 could not be matched to a KCPL shipment." };
  const shipment = matches[0];
  const reference = shipment.id;
  const branch = branchValue(shipment.get("primary_branch"));
  if (!branch) return { kind: "quarantined" as const, message: "Matched EDI 214 shipment has no valid primary branch." };
  let created = 0;
  let duplicates = 0;
  let historical = 0;
  for (const event of parsed.events) {
    const result = await recordOrderedTrackingEvent(reference, {
      rawStatus: event.rawStatus,
      milestone: event.milestone,
      title: event.rawStatus,
      location: event.location || "",
      latitude: null,
      longitude: null,
      eventTime: event.eventTime || "",
      source: "edi_214",
      provider: partner || parsed.scac || "EDI 214 carrier",
      providerEventId: event.providerEventId,
      details: [event.reasonCode ? `Reason ${event.reasonCode}` : null, parsed.scac ? `SCAC ${parsed.scac}` : null].filter(Boolean).join(" · "),
      eta: "",
      confidence: 0.95,
    }, actor);
    if (result.kind === "created") {
      created += 1;
      if ("historical" in result && result.historical) historical += 1;
    } else if (result.kind === "duplicate") duplicates += 1;
  }
  const now = new Date().toISOString();
  await transactionRef.set({
    status: "processed",
    branch,
    partner,
    reference,
    shipment_reference: reference,
    tender_reference: parsed.tenderReference,
    message: `EDI 214 processed: ${created} new, ${duplicates} duplicate, ${historical} historical events.`,
    processed_at: now,
    updated_at: now,
  }, { merge: true });
  return { kind: "processed" as const, transactionSet: "214" as const, shipmentReference: reference, branch, created, duplicates, historical };
}

export async function ingestEdiPayload(rawValue: string, partnerValue: string, providerEventId?: string | null) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const raw = rawValue.replace(/^\uFEFF/, "").trim();
  if (!raw || raw.length > 1_000_000) return { kind: "invalid" as const, message: "EDI payload must be between 1 byte and 1 MB." };
  const envelope = parseX12(raw);
  if (envelope.transactionSet !== "990" && envelope.transactionSet !== "214") return { kind: "invalid" as const, message: "Only inbound EDI 990 and 214 transaction sets are accepted." };
  const partner = partnerValue.trim().slice(0, 180) || envelope.senderId || "EDI trading partner";
  const fingerprint = providerEventId?.trim() ? createHash("sha256").update(`${partner}\n${providerEventId}`).digest("hex") : hashPayload(raw);
  const id = transactionId("inbound", envelope.transactionSet, fingerprint);
  const ref = firebaseAdminDb().collection("edi_transactions").doc(id);
  const existing = await ref.get();
  if (existing.exists) return { kind: "duplicate" as const, transactionId: id, status: text(existing.get("status"), "duplicate") };
  const now = new Date().toISOString();
  await ref.create({
    direction: "inbound",
    transaction_set: envelope.transactionSet,
    status: "queued",
    branch: null,
    partner,
    reference: null,
    tender_reference: null,
    shipment_reference: null,
    transaction_control: envelope.transactionControl,
    interchange_control: envelope.interchangeControl,
    sender_id: envelope.senderId,
    receiver_id: envelope.receiverId,
    provider_event_id: providerEventId?.trim() || null,
    fingerprint,
    raw_payload: raw,
    message: "EDI message received and queued for processing.",
    created_at: now,
    updated_at: now,
    processed_at: null,
  });
  const actor = { name: partner, email: "edi@kcpl.internal" };
  try {
    const result = envelope.transactionSet === "990" ? await process990(raw, ref, partner, actor) : await process214(raw, ref, partner, actor);
    if (result.kind === "quarantined") {
      await ref.set({ status: "quarantined", message: result.message, processed_at: now, updated_at: now }, { merge: true });
      return { ...result, transactionId: id, transactionSet: envelope.transactionSet };
    }
    return { ...result, transactionId: id };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "EDI processing failed.";
    await ref.set({ status: "failed", message, processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { merge: true });
    return { kind: "failed" as const, transactionId: id, transactionSet: envelope.transactionSet, message };
  }
}

export async function listOutboundEdiQueue(limit = 20) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const snapshot = await firebaseAdminDb().collection("edi_transactions").where("direction", "==", "outbound").limit(200).get();
  const rows = snapshot.docs
    .filter((doc) => text(doc.get("transaction_set")) === "204" && text(doc.get("status")) === "queued")
    .sort((a, b) => text(a.get("created_at")).localeCompare(text(b.get("created_at"))))
    .slice(0, Math.max(1, Math.min(50, limit)))
    .map((doc) => ({
      transactionId: doc.id,
      transactionSet: "204" as const,
      partner: nullable(doc.get("partner")),
      partnerId: nullable(doc.get("partner_id")),
      tenderReference: nullable(doc.get("tender_reference")),
      orderReference: nullable(doc.get("order_reference")),
      payload: text(doc.get("raw_payload")),
      createdAt: text(doc.get("created_at")),
    }));
  return { kind: "ready" as const, rows };
}

export async function acknowledgeOutboundEdi(transactionIdValue: string, externalReference?: string | null) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const id = transactionIdValue.trim();
  const ref = firebaseAdminDb().collection("edi_transactions").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists || text(snapshot.get("direction")) !== "outbound") return { kind: "missing" as const };
  if (text(snapshot.get("status")) === "dispatched") return { kind: "dispatched" as const };
  if (text(snapshot.get("status")) !== "queued") return { kind: "invalid_state" as const };
  const now = new Date().toISOString();
  await ref.update({ status: "dispatched", external_reference: externalReference?.trim() || null, message: "EDI 204 acknowledged as dispatched by integration transport.", processed_at: now, updated_at: now });
  return { kind: "dispatched" as const };
}

export async function listEdiGatewayDashboard(staff: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const snapshot = await firebaseAdminDb().collection("edi_transactions").orderBy("created_at", "desc").limit(750).get();
  const rows = snapshot.docs
    .map((doc) => ledgerFromDoc(doc as unknown as FirestoreDoc))
    .filter((row): row is EdiLedgerRow => Boolean(row))
    .filter((row) => !row.branch || staffCanAccessBranch(staff, row.branch));
  const summary = {
    outbound204Queued: rows.filter((row) => row.transaction_set === "204" && row.status === "queued").length,
    outbound204Dispatched: rows.filter((row) => row.transaction_set === "204" && row.status === "dispatched").length,
    inbound990Processed: rows.filter((row) => row.transaction_set === "990" && row.status === "processed").length,
    inbound214Processed: rows.filter((row) => row.transaction_set === "214" && row.status === "processed").length,
    quarantined: rows.filter((row) => row.status === "quarantined" || row.status === "failed").length,
  };
  return { kind: "ready" as const, rows, summary, configured: ediGatewayConfigured() };
}
