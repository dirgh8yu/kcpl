import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { compatibleRecordBranches, strictBranchValue, type AccessBranch } from "../branch-access-policy";
import { ingestEdiPayload } from "./edi-gateway.server";
import { parse214, parse990, parseX12 } from "./edi-x12";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function payloadHash(raw: string) { return createHash("sha256").update(raw.replace(/\r\n/g, "\n").trim()).digest("hex"); }
function transactionId(set: string, fingerprint: string) { return `inbound-${set}-${fingerprint.slice(0, 40)}`; }

async function quarantine(raw: string, set: "990" | "214", partnerValue: string, providerEventId: string | null, message: string, branch: AccessBranch | null) {
  const partner = partnerValue.trim().slice(0, 180) || "EDI trading partner";
  const fingerprint = providerEventId?.trim()
    ? createHash("sha256").update(`${partner}\n${providerEventId.trim()}`).digest("hex")
    : payloadHash(raw);
  const id = transactionId(set, fingerprint);
  const ref = firebaseAdminDb().collection("edi_transactions").doc(id);
  const existing = await ref.get();
  if (existing.exists) return { kind: "duplicate" as const, transactionId: id, status: text(existing.get("status")) || "quarantined" };
  const envelope = parseX12(raw);
  const now = new Date().toISOString();
  await ref.create({
    direction: "inbound",
    transaction_set: set,
    status: "quarantined",
    branch,
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
    message,
    created_at: now,
    updated_at: now,
    processed_at: now,
  });
  return { kind: "quarantined" as const, transactionId: id, transactionSet: set, message };
}

async function preflight990(raw: string) {
  const parsed = parse990(raw);
  const db = firebaseAdminDb();
  let tender: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  if (parsed.tenderReference) {
    const matches = await db.collection("transport_tenders").where("tender_reference", "==", parsed.tenderReference).limit(3).get();
    if (matches.size !== 1) return { kind: "reject" as const, message: "EDI 990 tender reference is not unique.", branch: null };
    tender = matches.docs[0];
    if (parsed.orderReference && text(tender.get("order_id")).toUpperCase() !== parsed.orderReference.toUpperCase()) {
      return { kind: "reject" as const, message: "EDI 990 tender and order references resolve to different authority chains.", branch: null };
    }
  } else if (parsed.orderReference) {
    const matches = await db.collection("transport_tenders").where("order_id", "==", parsed.orderReference.toUpperCase()).limit(10).get();
    const sent = matches.docs.filter((doc) => text(doc.get("status")) === "sent");
    if (sent.length !== 1) return { kind: "reject" as const, message: "EDI 990 order reference does not resolve to one active tender.", branch: null };
    tender = sent[0];
  } else {
    return { kind: "reject" as const, message: "EDI 990 contains no authoritative KCPL tender or order reference.", branch: null };
  }

  const branch = strictBranchValue(tender.get("branch"));
  const orderId = text(tender.get("order_id")).toUpperCase();
  if (!branch || !orderId) return { kind: "reject" as const, message: "EDI 990 target tender has incomplete canonical scope.", branch };
  const order = await db.collection("transport_orders").doc(orderId).get();
  if (!order.exists || !compatibleRecordBranches(branch, order.get("branch"))) {
    return { kind: "reject" as const, message: "EDI 990 tender and order have incompatible KCPL branch scope.", branch };
  }
  return { kind: "ready" as const, branch };
}

async function preflight214(raw: string) {
  const parsed = parse214(raw);
  const db = firebaseAdminDb();
  const candidates = new Map<string, FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot>();
  const direct = parsed.shipmentReference?.trim().toUpperCase();
  if (direct?.startsWith("KCPL-S-")) {
    const shipment = await db.collection("shipments").doc(direct).get();
    if (shipment.exists) candidates.set(shipment.id, shipment);
  }
  for (const reference of [parsed.carrierReference, parsed.bookingReference].filter((value): value is string => Boolean(value))) {
    const matches = await db.collection("shipments").where("carrier_reference", "==", reference).limit(3).get();
    for (const shipment of matches.docs) candidates.set(shipment.id, shipment);
  }
  if (parsed.tenderReference) {
    const tenders = await db.collection("transport_tenders").where("tender_reference", "==", parsed.tenderReference).limit(3).get();
    if (tenders.size !== 1) return { kind: "reject" as const, message: "EDI 214 tender reference is not unique.", branch: null };
    const tender = tenders.docs[0];
    const shipmentReference = text(tender.get("shipment_reference")).toUpperCase();
    if (shipmentReference) {
      const shipment = await db.collection("shipments").doc(shipmentReference).get();
      if (shipment.exists) candidates.set(shipment.id, shipment);
    }
  }
  const matches = [...candidates.values()];
  if (matches.length !== 1) {
    return { kind: "reject" as const, message: matches.length ? "EDI 214 identifiers resolve to multiple shipments." : "EDI 214 could not be matched to a KCPL shipment.", branch: null };
  }
  const shipment = matches[0];
  const branch = strictBranchValue(shipment.get("primary_branch"));
  if (!branch) return { kind: "reject" as const, message: "EDI 214 target shipment has no authoritative primary branch.", branch: null };

  if (parsed.tenderReference) {
    const tenderId = text(shipment.get("tender_id")).toUpperCase();
    if (tenderId) {
      const tender = await db.collection("transport_tenders").doc(tenderId).get();
      if (!tender.exists || !compatibleRecordBranches(branch, tender.get("branch"))) {
        return { kind: "reject" as const, message: "EDI 214 shipment and tender have incompatible KCPL branch scope.", branch };
      }
    }
  }
  return { kind: "ready" as const, branch };
}

/**
 * KCPL_EDI_SECRET is an organization-wide middleware bridge credential, not a
 * per-branch partner identity. Canonical record matching therefore establishes
 * branch authority. Optional incoming branch metadata can only detect a conflict;
 * it never selects or overrides the target record.
 */
export async function ingestEdiPayloadWithTrustBoundary(
  rawValue: string,
  partner: string,
  providerEventId: string | null,
  claimedBranch?: string | null,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const raw = rawValue.replace(/^\uFEFF/, "").trim();
  if (!raw || raw.length > 1_000_000) return { kind: "invalid" as const, message: "EDI payload must be between 1 byte and 1 MB." };
  const envelope = parseX12(raw);
  if (envelope.transactionSet !== "990" && envelope.transactionSet !== "214") {
    return { kind: "invalid" as const, message: "Only inbound EDI 990 and 214 transaction sets are accepted." };
  }
  const preflight = envelope.transactionSet === "990" ? await preflight990(raw) : await preflight214(raw);
  if (preflight.kind !== "ready") return quarantine(raw, envelope.transactionSet, partner, providerEventId, preflight.message, preflight.branch);
  const claimed = claimedBranch?.trim() || "";
  if (claimed && claimed !== preflight.branch) {
    return quarantine(raw, envelope.transactionSet, partner, providerEventId, "Incoming EDI branch metadata conflicts with the canonical target record.", preflight.branch);
  }
  return ingestEdiPayload(raw, partner, providerEventId);
}
