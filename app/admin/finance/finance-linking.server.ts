import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { linkQuoteToCrmCustomer } from "../crm/crm-quote-links.server";
import type { FinanceCustomerResolution, FinanceCustomerSuggestion } from "./finance-customer-resolution";

type Actor = { name: string; email: string };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function suggestionsFromQuote(value: unknown): FinanceCustomerSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const data = item as Record<string, unknown>;
    const id = text(data.id).toUpperCase();
    if (!id) return [];
    return [{ id, display_name: text(data.display_name) || id, reason: text(data.reason) || "CRM match" }];
  });
}

export async function resolveInvoiceCustomerFromShipment(shipmentReference: string): Promise<FinanceCustomerResolution> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };

  const shipmentId = shipmentReference.trim().toUpperCase();
  if (!shipmentId) return { kind: "not_requested" };

  const db = firebaseAdminDb();
  const shipment = await db.collection("shipments").doc(shipmentId).get();
  if (!shipment.exists) return { kind: "shipment_missing" };

  const directCustomerId = text(shipment.get("customer_id")).toUpperCase();
  if (directCustomerId) {
    const customer = await db.collection("customers").doc(directCustomerId).get();
    if (customer.exists) {
      return { kind: "resolved", customerId: directCustomerId, customerName: text(customer.get("display_name")) || directCustomerId };
    }
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
          return { kind: "resolved", customerId: quoteCustomerId, customerName: text(customer.get("display_name")) || quoteCustomerId };
        }
      }

      return {
        kind: "unlinked",
        quoteReference,
        suggestions: suggestionsFromQuote(quote.get("crm_matches")),
      };
    }
  }

  return { kind: "unlinked", quoteReference: quoteReference || null, suggestions: [] };
}

export async function confirmInvoiceCustomerForShipment(
  shipmentReference: string,
  customerId: string,
  actor: Actor,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };

  const shipmentId = shipmentReference.trim().toUpperCase();
  const targetCustomerId = customerId.trim().toUpperCase();
  if (!shipmentId || !targetCustomerId) return { kind: "invalid" as const };

  const resolution = await resolveInvoiceCustomerFromShipment(shipmentId);
  if (resolution.kind === "shipment_missing") return resolution;
  if (resolution.kind === "unavailable") return resolution;
  if (resolution.kind === "resolved") {
    return resolution.customerId === targetCustomerId
      ? { kind: "linked" as const, customerId: resolution.customerId }
      : { kind: "already_linked" as const, customerId: resolution.customerId };
  }
  if (!resolution.quoteReference) return { kind: "quote_missing" as const };

  const result = await linkQuoteToCrmCustomer(targetCustomerId, resolution.quoteReference, actor);
  if (result.kind === "missing_customer") return { kind: "missing_customer" as const };
  if (result.kind === "missing_quote") return { kind: "quote_missing" as const };
  if (result.kind === "unavailable") return { kind: "unavailable" as const };

  const db = firebaseAdminDb();
  await db.collection("shipments").doc(shipmentId).set({
    customer_id: targetCustomerId,
    updated_at: new Date().toISOString(),
  }, { merge: true });
  return { kind: "linked" as const, customerId: targetCustomerId };
}
