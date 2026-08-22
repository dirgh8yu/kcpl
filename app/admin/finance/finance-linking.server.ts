import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { addCrmContact, createCrmCustomer, findCrmDuplicates } from "../crm/crm-data.server";
import { crmCurrencies, type CrmCreateCustomerInput, type CrmCurrency } from "../crm/crm-data";
import { linkQuoteToCrmCustomer } from "../crm/crm-quote-links.server";
import type { KcplStaffContext } from "../staff-directory.server";
import { authorizeFinanceCustomerLink } from "./finance-authorization.server";
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

/**
 * Read-only resolution. This helper deliberately performs no relationship write.
 * Mutation callers must authorize the canonical shipment graph first and then
 * use the transaction-backed CRM link helper with the staff context.
 */
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
  context: KcplStaffContext,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };

  const shipmentId = shipmentReference.trim().toUpperCase();
  const targetCustomerId = customerId.trim().toUpperCase();
  if (!shipmentId || !targetCustomerId) return { kind: "invalid" as const };

  const authorization = await authorizeFinanceCustomerLink(shipmentId, targetCustomerId, context);
  if (authorization.kind !== "authorized") return authorization;

  const resolution = await resolveInvoiceCustomerFromShipment(shipmentId);
  if (resolution.kind === "shipment_missing" || resolution.kind === "unavailable") return resolution;
  if (resolution.kind === "not_requested") return { kind: "invalid" as const };
  if (resolution.kind === "resolved") {
    return resolution.customerId === targetCustomerId
      ? { kind: "linked" as const, customerId: resolution.customerId }
      : { kind: "already_linked" as const, customerId: resolution.customerId };
  }
  if (!resolution.quoteReference) return { kind: "quote_missing" as const };

  const result = await linkQuoteToCrmCustomer(targetCustomerId, resolution.quoteReference, actor, context);
  if (result.kind === "missing_customer") return { kind: "missing_customer" as const };
  if (result.kind === "missing_quote") return { kind: "quote_missing" as const };
  if (result.kind === "unavailable") return { kind: "unavailable" as const };
  if (result.kind === "forbidden") return { kind: "relationship_mismatch" as const };
  return { kind: "linked" as const, customerId: targetCustomerId };
}

export async function createInvoiceCustomerFromShipmentQuote(
  shipmentReference: string,
  actor: Actor,
  context: KcplStaffContext,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };

  const shipmentId = shipmentReference.trim().toUpperCase();
  if (!shipmentId) return { kind: "invalid" as const };

  const authorization = await authorizeFinanceCustomerLink(shipmentId, null, context);
  if (authorization.kind !== "authorized") return authorization;
  const resolution = await resolveInvoiceCustomerFromShipment(shipmentId);
  if (resolution.kind === "shipment_missing" || resolution.kind === "unavailable") return resolution;
  if (resolution.kind === "not_requested") return { kind: "invalid" as const };
  if (resolution.kind === "resolved") return { kind: "linked" as const, customerId: resolution.customerId };
  if (!resolution.quoteReference || authorization.quoteReference !== resolution.quoteReference) {
    return { kind: "quote_missing" as const };
  }

  const db = firebaseAdminDb();
  const quote = await db.collection("quotes").doc(resolution.quoteReference).get();
  if (!quote.exists) return { kind: "quote_missing" as const };
  const quoteShipment = text(quote.get("shipment_reference")).toUpperCase();
  if (quoteShipment && quoteShipment !== authorization.shipmentId) return { kind: "relationship_mismatch" as const };

  const companyName = text(quote.get("company_name"));
  const contactName = text(quote.get("contact_name"));
  const email = text(quote.get("contact_email")).toLowerCase();
  const phone = text(quote.get("phone"));
  const displayName = companyName || contactName || `Customer for ${resolution.quoteReference}`;
  const rawCurrency = text(quote.get("quote_currency")).toUpperCase();
  const preferredCurrency: CrmCurrency = crmCurrencies.includes(rawCurrency as CrmCurrency) ? rawCurrency as CrmCurrency : "NPR";
  const accountManagerUid = text(quote.get("assigned_to_uid"));
  const accountManagerName = text(quote.get("assigned_to_name")) || text(quote.get("assigned_to"));
  const accountManagerEmail = text(quote.get("assigned_to_email")).toLowerCase();
  const accountManagerPhone = text(quote.get("assigned_to_phone"));

  const duplicates = await findCrmDuplicates({ displayName, primaryEmail: email, primaryPhone: phone, taxId: "" });
  const sameBranchDuplicates: typeof duplicates = [];
  for (const duplicate of duplicates) {
    const customer = await db.collection("customers").doc(duplicate.id).get();
    if (customer.exists && customer.get("primary_branch") === authorization.branch) sameBranchDuplicates.push(duplicate);
  }
  if (sameBranchDuplicates.length) {
    return {
      kind: "possible_duplicate" as const,
      suggestions: sameBranchDuplicates.map((item) => ({ id: item.id, display_name: item.display_name, reason: item.reason })),
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
    primaryBranch: authorization.branch,
    accountManagerUid,
    accountManagerName,
    accountManagerEmail,
    accountManagerPhone,
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

  const linked = await linkQuoteToCrmCustomer(customerId, resolution.quoteReference, actor, context);
  if (linked.kind === "missing_quote") return { kind: "quote_missing" as const };
  if (linked.kind === "unavailable") return { kind: "unavailable" as const };
  if (linked.kind === "forbidden") return { kind: "relationship_mismatch" as const };

  return { kind: "created_and_linked" as const, customerId, customerName: displayName };
}
