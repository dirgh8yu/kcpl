import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { confirmConsolidatedLoadBookingWithLineage } from "../consolidation/tms-consolidation-lineage.server";
import type { KcplStaffContext } from "../staff-directory.server";
import { confirmTmsTenderBooking } from "./tms-tendering.server";

type Actor = { name: string; email: string };
type BookingInput = { bookingReference: string; pickupConfirmation?: string };

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function nullable(value: unknown) { const output = text(value); return output || null; }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function currencyValue(value: unknown): CrmCurrency | null { return crmCurrencies.includes(value as CrmCurrency) ? value as CrmCurrency : null; }

async function confirmStandardBooking(tenderId: string, input: BookingInput, actor: Actor, staff: KcplStaffContext) {
  return confirmTmsTenderBooking(tenderId, input, actor, staff);
}

/**
 * Authoritative booking dispatcher used by the admin API.
 * Standard tenders retain PR #127's transaction. Consolidation masters use the
 * lineage-aware transaction so all house allocation versions lock atomically.
 * Successful results expose one canonical route-facing shipmentReference while
 * preserving booking-specific metadata for callers that need it.
 */
export async function confirmTmsTenderBookingWithCommercialLineage(
  tenderIdValue: string,
  input: BookingInput,
  actor: Actor,
  staff: KcplStaffContext,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const tenderId = tenderIdValue.trim().toUpperCase();
  const db = firebaseAdminDb();
  const tender = await db.collection("transport_tenders").doc(tenderId).get();
  if (!tender.exists) return { kind: "missing" as const };
  const orderId = text(tender.get("order_id")).toUpperCase();
  if (!orderId) return { kind: "missing_order" as const };
  const order = await db.collection("transport_orders").doc(orderId).get();
  if (!order.exists) return { kind: "missing_order" as const };
  const loadId = nullable(order.get("consolidation_load_id"));
  const isMaster = order.get("is_consolidation_master") === true;
  if (!loadId || !isMaster) {
    const result = await confirmStandardBooking(tenderId, input, actor, staff);
    return result.kind === "booked" ? { ...result, bookingType: "standard" as const } : result;
  }

  const status = text(tender.get("status"));
  let amount: number | null = null;
  let currency: CrmCurrency | null = null;
  if (status === "accepted") {
    amount = numberValue(tender.get("offered_cost"));
    currency = currencyValue(tender.get("currency"));
  } else if (status === "countered") {
    amount = numberValue(tender.get("counter_cost"));
    currency = currencyValue(tender.get("counter_currency"));
  } else if (status === "booked") {
    amount = numberValue(tender.get("final_cost"));
    currency = currencyValue(tender.get("final_currency"));
  }
  if (amount === null || amount < 0 || !currency) return { kind: "commercials_required" as const };

  const result = await confirmConsolidatedLoadBookingWithLineage({
    loadId,
    masterOrderId: orderId,
    tenderId,
    tenderReference: text(tender.get("tender_reference")) || tenderId,
    partnerId: text(tender.get("partner_id")).toUpperCase(),
    partnerName: text(tender.get("partner_name")) || "Partner",
    rateCardId: text(tender.get("rate_card_id")).toUpperCase(),
    bookingReference: input.bookingReference,
    pickupConfirmation: input.pickupConfirmation,
    amount,
    currency,
    expectedTenderUpdatedAt: text(tender.get("updated_at")),
  }, actor, staff);
  if (result.kind !== "booked") return result;
  return {
    ...result,
    shipmentReference: result.masterShipmentReference,
    bookingType: "consolidated" as const,
    consolidationLoadId: loadId,
  };
}
