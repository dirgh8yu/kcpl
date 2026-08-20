import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function resolveInvoiceCustomerFromShipment(shipmentReference: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };

  const shipmentId = shipmentReference.trim().toUpperCase();
  if (!shipmentId) return { kind: "not_requested" as const };

  const db = firebaseAdminDb();
  const shipment = await db.collection("shipments").doc(shipmentId).get();
  if (!shipment.exists) return { kind: "shipment_missing" as const };

  const directCustomerId = text(shipment.get("customer_id")).toUpperCase();
  if (directCustomerId) {
    const customer = await db.collection("customers").doc(directCustomerId).get();
    if (customer.exists) return { kind: "resolved" as const, customerId: directCustomerId };
  }

  const quoteReference = text(shipment.get("quote_reference")).toUpperCase();
  if (quoteReference) {
    const quote = await db.collection("quotes").doc(quoteReference).get();
    if (quote.exists) {
      const quoteCustomerId = text(quote.get("customer_id")).toUpperCase();
      if (quoteCustomerId) {
        const customer = await db.collection("customers").doc(quoteCustomerId).get();
        if (customer.exists) {
          await shipment.ref.set({ customer_id: quoteCustomerId, updated_at: new Date().toISOString() }, { merge: true });
          return { kind: "resolved" as const, customerId: quoteCustomerId };
        }
      }
    }
  }

  return { kind: "unlinked" as const, quoteReference: quoteReference || null };
}
