import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { gptActionJson, requireGptAction } from "../../../gpt-action-auth.server";
import { kcplBranches, type KcplBranch } from "../../../admin/crm/crm-data";
import { summarizePickups, type PickupQueueRow } from "../../../admin/pickups/pickup-appointments";

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function nullable(value: unknown) { const output = text(value); return output || null; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function numberValue(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function validIso(value: unknown) { const candidate = text(value); const parsed = Date.parse(candidate); return candidate && Number.isFinite(parsed) ? new Date(parsed).toISOString() : null; }

async function loadMap(collection: string, ids: string[]) {
  const db = firebaseAdminDb();
  const unique = [...new Set(ids.map((value) => value.trim()).filter(Boolean))];
  const map = new Map<string, Record<string, unknown>>();
  for (let index = 0; index < unique.length; index += 250) {
    const snapshots = await db.getAll(...unique.slice(index, index + 250).map((id) => db.collection(collection).doc(id)));
    for (const snapshot of snapshots) if (snapshot.exists) map.set(snapshot.id, snapshot.data() as Record<string, unknown>);
  }
  return map;
}

export async function GET(request: Request) {
  const authError = requireGptAction(request);
  if (authError) return authError;
  if (!firebaseRuntimeConfigured()) return gptActionJson({ ok: false, error: "Firebase is unavailable." }, 503);
  try {
    const db = firebaseAdminDb();
    const [shipmentsSnapshot, appointmentsSnapshot] = await Promise.all([
      db.collection("shipments").orderBy("updated_at", "desc").limit(1200).get(),
      db.collection("pickup_appointments").orderBy("updated_at", "desc").limit(1200).get(),
    ]);
    const appointmentMap = new Map(appointmentsSnapshot.docs.map((doc) => [text(doc.get("shipment_reference")), doc.data() as Record<string, unknown>]));
    const relevant = shipmentsSnapshot.docs.filter((doc) => {
      const status = text(doc.get("status"));
      if (status === "delivered" || status === "cancelled") return false;
      return Boolean(nullable(doc.get("booking_reference")) || nullable(doc.get("tender_id")) || nullable(doc.get("transport_order_id")));
    });
    const customerIds = relevant.map((doc) => nullable(doc.get("customer_id"))).filter((value): value is string => Boolean(value));
    const quoteIds = relevant.map((doc) => nullable(doc.get("quote_reference"))).filter((value): value is string => Boolean(value));
    const tenderIds = relevant.map((doc) => nullable(doc.get("tender_id"))).filter((value): value is string => Boolean(value));
    const [customers, quotes, tenders] = await Promise.all([loadMap("customers", customerIds), loadMap("quotes", quoteIds), loadMap("transport_tenders", tenderIds)]);
    const now = new Date().toISOString();
    const rows: PickupQueueRow[] = relevant.flatMap((doc) => {
      const shipment = doc.data() as Record<string, unknown>;
      const primary = branchValue(shipment.primary_branch);
      if (!primary) return [];
      const customerId = nullable(shipment.customer_id);
      const quote = quotes.get(text(shipment.quote_reference)) ?? {};
      const customer = customerId ? customers.get(customerId) ?? {} : {};
      const tenderId = nullable(shipment.tender_id);
      const tender = tenderId ? tenders.get(tenderId) ?? {} : {};
      const appointment = appointmentMap.get(doc.id) ?? {};
      const statusRaw = text(appointment.status, "unscheduled") as PickupQueueRow["status"];
      const status = ["unscheduled", "requested", "confirmed", "driver_assigned", "picked_up", "missed", "cancelled"].includes(statusRaw) ? statusRaw : "unscheduled";
      const channelRaw = text(appointment.channel, "manual") as PickupQueueRow["channel"];
      const channel = ["manual", "email", "carrier_api", "vendor_portal", "edi"].includes(channelRaw) ? channelRaw : "manual";
      return [{
        id: text(appointment.id, `PU-${doc.id}`),
        shipment_reference: doc.id,
        transport_order_id: nullable(shipment.transport_order_id),
        tender_id: tenderId,
        booking_reference: nullable(shipment.booking_reference) ?? nullable(tender.booking_reference),
        branch: primary,
        customer_id: customerId,
        customer_name: text(customer.display_name, text(quote.company_name, text(quote.contact_name, "Customer"))),
        partner_id: nullable(appointment.partner_id) ?? nullable(tender.partner_id),
        partner_name: nullable(appointment.partner_name) ?? nullable(tender.partner_name) ?? nullable(shipment.carrier),
        origin: text(quote.origin, text(shipment.origin)),
        destination: text(quote.destination, text(shipment.destination)),
        status,
        channel,
        requested_window_start: validIso(appointment.requested_window_start),
        requested_window_end: validIso(appointment.requested_window_end),
        confirmed_window_start: validIso(appointment.confirmed_window_start),
        confirmed_window_end: validIso(appointment.confirmed_window_end),
        pickup_location: nullable(appointment.pickup_location) ?? nullable(quote.origin) ?? nullable(shipment.origin),
        contact_name: nullable(appointment.contact_name),
        contact_phone: nullable(appointment.contact_phone),
        provider_reference: nullable(appointment.provider_reference),
        driver_name: nullable(appointment.driver_name),
        driver_phone: nullable(appointment.driver_phone),
        vehicle_reference: nullable(appointment.vehicle_reference),
        attempt_count: Math.max(0, numberValue(appointment.attempt_count)),
        picked_up_at: validIso(appointment.picked_up_at),
        missed_at: validIso(appointment.missed_at),
        missed_reason: nullable(appointment.missed_reason),
        notes: nullable(appointment.notes),
        created_at: validIso(appointment.created_at),
        updated_at: validIso(appointment.updated_at) ?? text(shipment.updated_at, now),
        shipment_status: text(shipment.status, "booking_confirmed"),
        current_location: nullable(shipment.current_location),
      }];
    });
    const summary = summarizePickups(rows, now);
    const attention = rows.filter((row) => row.status === "missed" || row.status === "unscheduled" || row.status === "requested").slice(0, 50).map((row) => ({
      shipmentReference: row.shipment_reference,
      bookingReference: row.booking_reference,
      customerName: row.customer_name,
      route: `${row.origin} → ${row.destination}`,
      branch: row.branch,
      partnerName: row.partner_name,
      pickupStatus: row.status,
      requestedWindowStart: row.requested_window_start,
      requestedWindowEnd: row.requested_window_end,
      confirmedWindowStart: row.confirmed_window_start,
      confirmedWindowEnd: row.confirmed_window_end,
      pickupLocation: row.pickup_location,
      providerReference: row.provider_reference,
      driverName: row.driver_name,
      vehicleReference: row.vehicle_reference,
      missedReason: row.missed_reason,
      attemptCount: row.attempt_count,
    }));
    return gptActionJson({ ok: true, generatedAt: now, sampledShipmentCount: shipmentsSnapshot.size, pickupShipmentCount: rows.length, summary, attentionCount: attention.length, attention, safety: "This Custom GPT action is read-only. Pickup scheduling, confirmation, driver assignment and completion remain authenticated staff actions in KCPL Operations." });
  } catch (error) {
    console.error("KCPL Custom GPT pickup briefing failed", error);
    return gptActionJson({ ok: false, error: "The KCPL pickup briefing is temporarily unavailable." }, 503);
  }
}
