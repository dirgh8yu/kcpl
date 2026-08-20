import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { addCrmContact, createCrmCustomer, findCrmDuplicates } from "../crm/crm-data.server";
import { crmCurrencies, kcplBranches, type CrmCreateCustomerInput, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
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
  if (resolution.kind === "not_requested") return { kind: "invalid" as const };
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

export async function createInvoiceCustomerFromShipmentQuote(
  shipmentReference: string,
  actor: Actor,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };

  const shipmentId = shipmentReference.trim().toUpperCase();
  if (!shipmentId) return { kind: "invalid" as const };

  const resolution = await resolveInvoiceCustomerFromShipment(shipmentId);
  if (resolution.kind === "shipment_missing" || resolution.kind === "unavailable") return resolution;
  if (resolution.kind === "not_requested") return { kind: "invalid" as const };
  if (resolution.kind === "resolved") return { kind: "linked" as const, customerId: resolution.customerId };
  if (!resolution.quoteReference) return { kind: "quote_missing" as const };

  const db = firebaseAdminDb();
  const [shipment, quote] = await Promise.all([
    db.collection("shipments").doc(shipmentId).get(),
    db.collection("quotes").doc(resolution.quoteReference).get(),
  ]);
  if (!shipment.exists) return { kind: "shipment_missing" as const };
  if (!quote.exists) return { kind: "quote_missing" as const };

  const companyName = text(quote.get("company_name"));
  const contactName = text(quote.get("contact_name"));
  const email = text(quote.get("contact_email")).toLowerCase();
  const phone = text(quote.get("phone"));
  const displayName = companyName || contactName || `Customer for ${resolution.quoteReference}`;
  const rawBranch = text(shipment.get("primary_branch"));
  const primaryBranch: KcplBranch = kcplBranches.includes(rawBranch as KcplBranch) ? rawBranch as KcplBranch : "Kathmandu";
  const rawCurrency = text(quote.get("quote_currency")).toUpperCase();
  const preferredCurrency: CrmCurrency = crmCurrencies.includes(rawCurrency as CrmCurrency) ? rawCurrency as CrmCurrency : "NPR";

  const duplicates = await findCrmDuplicates({ displayName, primaryEmail: email, primaryPhone: phone, taxId: "" });
  if (duplicates.length) {
    return {
      kind: "possible_duplicate" as const,
      suggestions: duplicates.map((item) => ({ id: item.id, display_name: item.display_name, reason: item.reason })),
    };
  }

  const input: CrmCreateCustomerInput = {
    entityKind: companyName ? "company" : "individual",
    displayName,
    legalName: companyName,
    tradingName: "",
    relationshipTypes: ["customer"],
    accountStatus: "active",
    leadStage: "won",
    leadSource: "website",
    primaryEmail: email,
    primaryPhone: phone,
    website: "",
    industry: "",
    taxId: "",
    country: "Nepal",
    primaryBranch,
    accountManagerName: "",
    accountManagerEmail: "",
    billingEmail: email,
    preferredCurrency,
    paymentTermsDays: "",
    creditLimit: "",
    outstandingBalance: "",
    pricingNotes: "",
    markupPercent: "",
    preferredCarriers: [],
    transportPreferences: [],
    tags: ["Website Enquiry"],
    internalSummary: `Created from quote ${resolution.quoteReference} during invoice setup.`,
  };

  const created = await createCrmCustomer(input, actor);
  if (created.kind === "unavailable") return { kind: "unavailable" as const };
  const customerId = created.customer.id;

  if (contactName) {
    await addCrmContact(customerId, {
      name: contactName,
      jobTitle: "",
      email,
      phone,
      communicationPreference: email ? "email" : phone ? "phone" : "",
      isPrimary: true,
      notes: `Created from quote ${resolution.quoteReference}.`,
    }, actor);
  }

  const linked = await linkQuoteToCrmCustomer(customerId, resolution.quoteReference, actor);
  if (linked.kind === "missing_quote") return { kind: "quote_missing" as const };
  if (linked.kind === "unavailable") return { kind: "unavailable" as const };

  await db.collection("shipments").doc(shipmentId).set({
    customer_id: customerId,
    updated_at: new Date().toISOString(),
  }, { merge: true });

  return { kind: "created_and_linked" as const, customerId, customerName: displayName };
}
