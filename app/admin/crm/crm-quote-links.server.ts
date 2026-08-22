import type { DocumentSnapshot } from "firebase-admin/firestore";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { canMutateBranchValue, compatibleRecordBranches, strictBranchValue } from "../branch-access-policy";
import { recomputeCustomerFinance } from "../finance/finance.server";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "./crm-data";
import { createCrmCustomer, findCrmDuplicates } from "./crm-data.server";

type Actor = { name: string; email: string };

export type CrmQuoteLinkItem = {
  reference: string;
  created_at: string;
  status: string;
  origin: string;
  destination: string;
  contact_name: string;
  contact_email: string;
  company_name: string | null;
  phone: string | null;
  customer_id: string | null;
  match_reason: string | null;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activityId(suffix: string) {
  return `activity-${Date.now()}-${suffix}-${crypto.randomUUID().slice(0, 8)}`;
}

function shipmentVisible(snapshot: DocumentSnapshot, context?: KcplStaffContext) {
  if (!context) return true;
  const branch = snapshot.get("primary_branch");
  if (!kcplBranches.includes(branch as KcplBranch)) return false;
  return context.can_access_all_branches || staffCanAccessBranch(context, branch as KcplBranch);
}

async function visibleQuoteDocs(docs: FirebaseFirestore.QueryDocumentSnapshot[], context?: KcplStaffContext) {
  if (!context) return docs;
  const references = [...new Set(docs.map((doc) => nullable(doc.get("shipment_reference"))).filter((value): value is string => Boolean(value)))];
  if (!references.length) return docs;
  const db = firebaseAdminDb();
  const snapshots = await db.getAll(...references.map((reference) => db.collection("shipments").doc(reference)));
  const visibleReferences = new Set(snapshots.filter((snapshot) => snapshot.exists && shipmentVisible(snapshot, context)).map((snapshot) => snapshot.id));
  return docs.filter((doc) => {
    const shipmentReference = nullable(doc.get("shipment_reference"));
    return !shipmentReference || visibleReferences.has(shipmentReference);
  });
}

function quoteFromDoc(id: string, data: Record<string, unknown>, customerId: string): CrmQuoteLinkItem {
  const matches = Array.isArray(data.crm_matches) ? data.crm_matches : [];
  const match = matches.find((item) => {
    if (!item || typeof item !== "object") return false;
    return (item as Record<string, unknown>).id === customerId;
  }) as Record<string, unknown> | undefined;

  return {
    reference: id,
    created_at: text(data.created_at),
    status: text(data.status, "new"),
    origin: text(data.origin),
    destination: text(data.destination),
    contact_name: text(data.contact_name),
    contact_email: text(data.contact_email),
    company_name: nullable(data.company_name),
    phone: nullable(data.phone),
    customer_id: nullable(data.customer_id),
    match_reason: match ? nullable(match.reason) : null,
  };
}

export async function listCrmQuoteLinks(customerId: string, context?: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return null;
  const db = firebaseAdminDb();
  const id = customerId.trim().toUpperCase();
  const [linkedSnapshot, suggestedSnapshot] = await Promise.all([
    db.collection("quotes").where("customer_id", "==", id).limit(250).get(),
    db.collection("quotes").where("crm_match_ids", "array-contains", id).limit(100).get(),
  ]);

  const [visibleLinkedDocs, visibleSuggestedDocs] = await Promise.all([
    visibleQuoteDocs(linkedSnapshot.docs, context),
    visibleQuoteDocs(suggestedSnapshot.docs, context),
  ]);

  const linked = visibleLinkedDocs
    .map((doc) => quoteFromDoc(doc.id, doc.data() as Record<string, unknown>, id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const linkedIds = new Set(linked.map((item) => item.reference));
  const suggested = visibleSuggestedDocs
    .filter((doc) => !linkedIds.has(doc.id) && !nullable(doc.get("customer_id")))
    .map((doc) => quoteFromDoc(doc.id, doc.data() as Record<string, unknown>, id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return { linked, suggested };
}

export async function linkQuoteToCrmCustomer(customerId: string, quoteReference: string, actor: Actor, context?: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const id = customerId.trim().toUpperCase();
  const quoteId = quoteReference.trim().toUpperCase();
  const targetRef = db.collection("customers").doc(id);
  const quoteRef = db.collection("quotes").doc(quoteId);
  const now = new Date().toISOString();

  const result = await db.runTransaction(async (transaction) => {
    const [targetSnapshot, quoteSnapshot] = await Promise.all([
      transaction.get(targetRef),
      transaction.get(quoteRef),
    ]);
    if (!targetSnapshot.exists) return { kind: "missing_customer" as const };
    if (!quoteSnapshot.exists) return { kind: "missing_quote" as const };

    const targetBranch = strictBranchValue(targetSnapshot.get("primary_branch"));
    if (!targetBranch) return { kind: "invalid_branch" as const };
    if (context && !canMutateBranchValue(context, targetBranch)) return { kind: "forbidden" as const };

    const currentCustomerId = nullable(quoteSnapshot.get("customer_id"));
    const shipmentReference = nullable(quoteSnapshot.get("shipment_reference"));
    const shipmentRef = shipmentReference ? db.collection("shipments").doc(shipmentReference) : null;
    const shipmentSnapshot = shipmentRef ? await transaction.get(shipmentRef) : null;
    if (shipmentRef && !shipmentSnapshot?.exists) return { kind: "missing_shipment" as const };

    const shipmentBranch = shipmentSnapshot?.exists ? strictBranchValue(shipmentSnapshot.get("primary_branch")) : null;
    if (shipmentSnapshot?.exists) {
      if (!shipmentBranch) return { kind: "invalid_branch" as const };
      if (!compatibleRecordBranches(targetBranch, shipmentBranch)) return { kind: "branch_mismatch" as const };
      if (context && !canMutateBranchValue(context, shipmentBranch)) return { kind: "forbidden" as const };
    }

    const shipmentCustomerId = shipmentSnapshot?.exists ? nullable(shipmentSnapshot.get("customer_id")) : null;
    const previousQuoteRef = currentCustomerId && currentCustomerId !== id
      ? db.collection("customers").doc(currentCustomerId)
      : null;
    const previousShipmentRef = shipmentCustomerId && shipmentCustomerId !== id && shipmentCustomerId !== currentCustomerId
      ? db.collection("customers").doc(shipmentCustomerId)
      : null;

    const previousQuoteSnapshot = previousQuoteRef ? await transaction.get(previousQuoteRef) : null;
    const previousShipmentSnapshot = previousShipmentRef ? await transaction.get(previousShipmentRef) : null;
    if (previousQuoteRef && !previousQuoteSnapshot?.exists) return { kind: "related_customer_missing" as const };
    if (previousShipmentRef && !previousShipmentSnapshot?.exists) return { kind: "related_customer_missing" as const };
    for (const previous of [previousQuoteSnapshot, previousShipmentSnapshot]) {
      if (!previous?.exists) continue;
      if (!compatibleRecordBranches(targetBranch, previous.get("primary_branch"))) return { kind: "branch_mismatch" as const };
    }

    const quoteAlreadyLinked = currentCustomerId === id;
    const shipmentAlreadyLinked = !shipmentSnapshot?.exists || shipmentCustomerId === id;
    const affectedCustomerIds = [...new Set([id, currentCustomerId, shipmentCustomerId].filter((value): value is string => Boolean(value)))];

    if (quoteAlreadyLinked && shipmentAlreadyLinked) return { kind: "linked" as const, affectedCustomerIds };

    if (!quoteAlreadyLinked) {
      transaction.update(quoteRef, {
        customer_id: id,
        crm_match_state: "confirmed",
        crm_linked_at: now,
        crm_linked_by_name: actor.name,
        crm_linked_by_email: actor.email,
        updated_at: now,
      });
      transaction.update(targetRef, {
        quote_count: numberValue(targetSnapshot.get("quote_count")) + 1,
        updated_at: now,
      });
      transaction.create(targetRef.collection("activity").doc(activityId(`${quoteId}-linked`)), {
        type: "quote_linked",
        title: `Quote linked: ${quoteId}`,
        detail: `${text(quoteSnapshot.get("origin"))} → ${text(quoteSnapshot.get("destination"))}`,
        actor_name: actor.name,
        actor_email: actor.email,
        created_at: now,
      });
    }

    if (previousQuoteRef && previousQuoteSnapshot?.exists) {
      transaction.update(previousQuoteRef, {
        quote_count: Math.max(0, numberValue(previousQuoteSnapshot.get("quote_count")) - 1),
        updated_at: now,
      });
      transaction.create(previousQuoteRef.collection("activity").doc(activityId(`${quoteId}-moved`)), {
        type: "quote_unlinked",
        title: `Quote moved: ${quoteId}`,
        detail: `Quote reassigned to ${id}.`,
        actor_name: actor.name,
        actor_email: actor.email,
        created_at: now,
      });
    }

    if (shipmentRef && shipmentSnapshot?.exists && !shipmentAlreadyLinked) {
      const delivered = text(shipmentSnapshot.get("status")) === "delivered";
      transaction.update(shipmentRef, { customer_id: id, updated_at: now });

      const targetActive = numberValue(targetSnapshot.get("active_shipment_count"));
      const targetCompleted = numberValue(targetSnapshot.get("completed_shipment_count"));
      transaction.update(targetRef, {
        active_shipment_count: targetActive + (delivered ? 0 : 1),
        completed_shipment_count: targetCompleted + (delivered ? 1 : 0),
        lead_stage: "won",
        updated_at: now,
      });
      transaction.create(targetRef.collection("activity").doc(activityId(`${shipmentReference}-linked`)), {
        type: "shipment_linked",
        title: `Shipment linked: ${shipmentReference}`,
        detail: `Inherited from quote ${quoteId}.`,
        actor_name: actor.name,
        actor_email: actor.email,
        created_at: now,
      });

      const losingShipmentRef = shipmentCustomerId === currentCustomerId ? previousQuoteRef : previousShipmentRef;
      const losingShipmentSnapshot = shipmentCustomerId === currentCustomerId ? previousQuoteSnapshot : previousShipmentSnapshot;
      if (losingShipmentRef && losingShipmentSnapshot?.exists) {
        transaction.update(losingShipmentRef, {
          active_shipment_count: Math.max(0, numberValue(losingShipmentSnapshot.get("active_shipment_count")) - (delivered ? 0 : 1)),
          completed_shipment_count: Math.max(0, numberValue(losingShipmentSnapshot.get("completed_shipment_count")) - (delivered ? 1 : 0)),
          updated_at: now,
        });
        transaction.create(losingShipmentRef.collection("activity").doc(activityId(`${shipmentReference}-moved`)), {
          type: "shipment_unlinked",
          title: `Shipment moved: ${shipmentReference}`,
          detail: `Shipment reassigned to ${id}.`,
          actor_name: actor.name,
          actor_email: actor.email,
          created_at: now,
        });
      }
    }

    return { kind: "linked" as const, affectedCustomerIds };
  });

  if (result.kind === "linked") {
    await Promise.all(result.affectedCustomerIds.map((customerIdToRefresh) => recomputeCustomerFinance(customerIdToRefresh)));
    return { kind: "linked" as const };
  }
  return result;
}

export async function createCrmCustomerFromQuote(
  quoteReference: string,
  actor: Actor,
  primaryBranch?: KcplBranch,
  context?: KcplStaffContext,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const quoteId = quoteReference.trim().toUpperCase();
  const quote = await db.collection("quotes").doc(quoteId).get();
  if (!quote.exists) return { kind: "missing_quote" as const };
  const currentCustomerId = nullable(quote.get("customer_id"));
  if (currentCustomerId) return { kind: "already_linked" as const, customerId: currentCustomerId };

  const shipmentReference = nullable(quote.get("shipment_reference"));
  let canonicalBranch = strictBranchValue(primaryBranch);
  if (shipmentReference) {
    const shipment = await db.collection("shipments").doc(shipmentReference).get();
    if (!shipment.exists) return { kind: "missing_shipment" as const };
    const shipmentBranch = strictBranchValue(shipment.get("primary_branch"));
    if (!shipmentBranch) return { kind: "invalid_branch" as const };
    if (canonicalBranch && canonicalBranch !== shipmentBranch) return { kind: "branch_mismatch" as const };
    canonicalBranch = shipmentBranch;
  }
  if (!canonicalBranch) return { kind: "invalid_branch" as const };
  if (context && !canMutateBranchValue(context, canonicalBranch)) return { kind: "forbidden" as const };

  const displayName = text(quote.get("company_name"), text(quote.get("contact_name"), "New customer")).trim();
  const primaryEmail = text(quote.get("contact_email")).trim().toLowerCase();
  const primaryPhone = text(quote.get("phone")).trim();
  const duplicates = await findCrmDuplicates({ displayName, primaryEmail, primaryPhone, taxId: "" });
  if (duplicates.length) return { kind: "duplicates" as const, matches: duplicates };

  const quoteCurrency = text(quote.get("quote_currency"), "NPR").toUpperCase();
  const preferredCurrency = crmCurrencies.includes(quoteCurrency as CrmCurrency) ? quoteCurrency as CrmCurrency : "NPR";
  const accountManagerUid = text(quote.get("assigned_to_uid")).trim();
  const accountManagerName = text(quote.get("assigned_to_name"), text(quote.get("assigned_to"))).trim();
  const accountManagerEmail = text(quote.get("assigned_to_email")).trim().toLowerCase();
  const accountManagerPhone = text(quote.get("assigned_to_phone")).trim();
  const created = await createCrmCustomer({
    entityKind: nullable(quote.get("company_name")) ? "company" : "individual",
    displayName,
    legalName: "",
    tradingName: "",
    relationshipTypes: ["customer"],
    accountStatus: "prospect",
    leadStage: "quote_requested",
    leadSource: "website",
    primaryEmail,
    primaryPhone,
    website: "",
    industry: "",
    taxId: "",
    country: "Not recorded",
    primaryBranch: canonicalBranch,
    accountManagerUid,
    accountManagerName,
    accountManagerEmail,
    accountManagerPhone,
    billingEmail: primaryEmail,
    preferredCurrency,
    paymentTermsDays: "",
    creditLimit: "",
    outstandingBalance: "",
    pricingNotes: "",
    markupPercent: "",
    preferredCarriers: [],
    transportPreferences: text(quote.get("mode")) ? [text(quote.get("mode"))] : [],
    tags: ["website-enquiry"],
    internalSummary: `Created from ${quoteId}: ${text(quote.get("origin"))} → ${text(quote.get("destination"))}.`,
  }, actor);
  if (created.kind !== "created") return created;

  const linked = await linkQuoteToCrmCustomer(created.customer.id, quoteId, actor, context);
  if (linked.kind !== "linked") return linked;
  return { kind: "created_and_linked" as const, customer: created.customer };
}
