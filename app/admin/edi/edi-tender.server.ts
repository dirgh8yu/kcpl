import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canMutateBranchValue, compatibleRecordBranches, strictBranchValue } from "../branch-access-policy";
import type { KcplStaffContext } from "../staff-directory.server";
import { queueEdi204 } from "./edi-gateway.server";

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const output = text(value); return output || null; }
function numberValue(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

export async function queueTenderAsEdi204(tenderIdValue: string, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const tenderId = tenderIdValue.trim().toUpperCase();
  const tenderRef = firebaseAdminDb().collection("transport_tenders").doc(tenderId);
  const tender = await tenderRef.get();
  if (!tender.exists) return { kind: "missing" as const };
  const tenderBranch = strictBranchValue(tender.get("branch"));
  if (!tenderBranch) return { kind: "invalid_branch" as const };
  if (!canMutateBranchValue(context, tenderBranch)) return { kind: "forbidden" as const };
  if (text(tender.get("status")) !== "sent") return { kind: "invalid_state" as const };
  const currentChannel = text(tender.get("channel"));
  if (currentChannel === "email") return { kind: "already_dispatched" as const };
  if (currentChannel !== "manual" && currentChannel !== "edi_204") return { kind: "wrong_channel" as const };
  const orderId = text(tender.get("order_id")).toUpperCase();
  const order = await firebaseAdminDb().collection("transport_orders").doc(orderId).get();
  if (!order.exists) return { kind: "missing_order" as const };
  if (!compatibleRecordBranches(tenderBranch, order.get("branch"))) return { kind: "branch_mismatch" as const };
  const partnerId = text(tender.get("partner_id")).toUpperCase();
  if (!partnerId) return { kind: "missing_partner" as const };
  const partner = await firebaseAdminDb().collection("partners").doc(partnerId).get();
  if (!partner.exists) return { kind: "missing_partner" as const };
  const ownerBranch = partner.get("owner_branch");
  if (ownerBranch !== "Global" && !compatibleRecordBranches(tenderBranch, ownerBranch)) return { kind: "partner_branch_mismatch" as const };

  const result = await queueEdi204({
    branch: tenderBranch,
    tenderId,
    tenderReference: text(tender.get("tender_reference"), tenderId),
    orderReference: orderId,
    partnerId,
    partnerName: text(tender.get("partner_name"), partnerId),
    ediReceiverId: nullable(partner.get("edi_receiver_id")) ?? nullable(partner.get("scac")),
    origin: text(tender.get("origin"), text(order.get("origin"))),
    destination: text(tender.get("destination"), text(order.get("destination"))),
    pickupDate: nullable(tender.get("pickup_date")) ?? nullable(order.get("pickup_date")),
    deliveryDate: nullable(order.get("delivery_date")),
    equipment: nullable(tender.get("equipment")) ?? nullable(order.get("equipment")),
    mode: text(tender.get("mode"), text(order.get("mode"), "road")),
    weightKg: numberValue(order.get("weight_kg")),
    pieces: Math.max(0, Math.trunc(numberValue(order.get("pieces")))),
    offeredCost: Math.max(0, numberValue(tender.get("offered_cost"))),
    currency: text(tender.get("currency"), "NPR"),
  }, actor);
  const now = new Date().toISOString();
  if (result.kind === "queued" || result.kind === "duplicate") {
    await tenderRef.update({ channel: "edi_204", edi_204_status: result.kind === "queued" ? "queued" : "queued_duplicate", edi_204_transaction_id: result.transactionId, updated_at: now });
  } else {
    await tenderRef.update({ edi_204_status: "queue_failed", updated_at: now });
  }
  return result;
}
