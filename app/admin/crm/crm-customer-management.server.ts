import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { compatibleRecordBranches, strictBranchValue } from "../branch-access-policy";
import { resolveStaffIdentity } from "../staff-directory.server";
import type {
  CrmAccountStatus,
  CrmCurrency,
  CrmEntityKind,
  CrmLeadSource,
  CrmLeadStage,
  CrmRelationshipType,
  KcplBranch,
} from "./crm-data";

type Actor = { name: string; email: string };

export type CrmCustomerUpdateInput = {
  entityKind: CrmEntityKind;
  displayName: string;
  legalName: string;
  tradingName: string;
  relationshipTypes: CrmRelationshipType[];
  accountStatus: CrmAccountStatus;
  leadStage: CrmLeadStage;
  leadSource: CrmLeadSource | "";
  primaryEmail: string;
  primaryPhone: string;
  website: string;
  industry: string;
  taxId: string;
  country: string;
  primaryBranch: KcplBranch;
  accountManagerUid?: string;
  accountManagerName: string;
  accountManagerEmail: string;
  accountManagerPhone: string;
  billingEmail: string;
  tags: string[];
  transportPreferences: string[];
  internalSummary: string;
  preferredCurrency?: CrmCurrency;
  paymentTermsDays?: number | null;
  creditLimit?: number | null;
  pricingNotes?: string;
  markupPercent?: number | null;
  preferredCarriers?: string[];
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

function activityId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

export async function updateCrmCustomer(
  customerId: string,
  input: CrmCustomerUpdateInput,
  actor: Actor,
  options: { allowCommercial: boolean; allowCredit: boolean },
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const id = customerId.trim().toUpperCase();
  const customerRef = db.collection("customers").doc(id);
  const now = new Date().toISOString();
  const manager = await resolveStaffIdentity({ uid: input.accountManagerUid, name: input.accountManagerName, email: input.accountManagerEmail, phone: input.accountManagerPhone });

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(customerRef);
    if (!snapshot.exists || snapshot.get("archived") === true) return { kind: "missing" as const };
    const currentBranch = strictBranchValue(snapshot.get("primary_branch"));
    if (!currentBranch) return { kind: "invalid_branch" as const };

    if (currentBranch !== input.primaryBranch) {
      const [shipments, invoices, payables, quotes] = await Promise.all([
        transaction.get(db.collection("shipments").where("customer_id", "==", id)),
        transaction.get(db.collection("invoices").where("customer_id", "==", id)),
        transaction.get(db.collection("payables").where("customer_id", "==", id)),
        transaction.get(db.collection("quotes").where("customer_id", "==", id)),
      ]);
      for (const shipment of shipments.docs) {
        if (!compatibleRecordBranches(input.primaryBranch, shipment.get("primary_branch"))) return { kind: "branch_conflict" as const, relation: "shipment" as const, reference: shipment.id };
      }
      for (const invoice of invoices.docs) {
        if (!compatibleRecordBranches(input.primaryBranch, invoice.get("branch"))) return { kind: "branch_conflict" as const, relation: "invoice" as const, reference: invoice.id };
      }
      for (const payable of payables.docs) {
        if (!compatibleRecordBranches(input.primaryBranch, payable.get("branch"))) return { kind: "branch_conflict" as const, relation: "payable" as const, reference: payable.id };
      }
      const linkedShipmentIds = [...new Set(quotes.docs.map((quote) => typeof quote.get("shipment_reference") === "string" ? quote.get("shipment_reference").trim().toUpperCase() : "").filter(Boolean))];
      for (const shipmentId of linkedShipmentIds) {
        const linkedShipment = await transaction.get(db.collection("shipments").doc(shipmentId));
        if (!linkedShipment.exists || !compatibleRecordBranches(input.primaryBranch, linkedShipment.get("primary_branch"))) {
          return { kind: "branch_conflict" as const, relation: "quote_shipment" as const, reference: shipmentId };
        }
      }
    }

    const update: Record<string, unknown> = {
      entity_kind: input.entityKind,
      display_name: input.displayName.trim(),
      legal_name: input.legalName.trim() || null,
      trading_name: input.tradingName.trim() || null,
      relationship_types: input.relationshipTypes,
      account_status: input.accountStatus,
      lead_stage: input.leadStage,
      lead_source: input.leadSource || null,
      primary_email: input.primaryEmail.trim() || null,
      primary_phone: input.primaryPhone.trim() || null,
      website: input.website.trim() || null,
      industry: input.industry.trim() || null,
      tax_id: input.taxId.trim() || null,
      country: input.country.trim() || "Nepal",
      primary_branch: input.primaryBranch,
      account_manager_uid: manager.uid,
      account_manager_name: manager.name,
      account_manager_email: manager.email,
      account_manager_phone: manager.phone,
      billing_email: input.billingEmail.trim() || null,
      tags: input.tags,
      transport_preferences: input.transportPreferences,
      internal_summary: input.internalSummary.trim() || null,
      normalized_name: normalize(input.displayName),
      normalized_email: normalize(input.primaryEmail),
      normalized_phone: normalizePhone(input.primaryPhone),
      normalized_tax_id: normalize(input.taxId),
      updated_at: now,
      updated_by_name: actor.name,
      updated_by_email: actor.email,
    };

    if (options.allowCommercial) {
      if (input.preferredCurrency !== undefined) update.preferred_currency = input.preferredCurrency;
      if (input.pricingNotes !== undefined) update.pricing_notes = input.pricingNotes.trim() || null;
      if (input.markupPercent !== undefined) update.markup_percent = input.markupPercent;
      if (input.preferredCarriers !== undefined) update.preferred_carriers = input.preferredCarriers;
    }

    if (options.allowCredit) {
      if (input.paymentTermsDays !== undefined) update.payment_terms_days = input.paymentTermsDays;
      if (input.creditLimit !== undefined) update.credit_limit = input.creditLimit;
    }

    transaction.update(customerRef, update);
    transaction.create(customerRef.collection("activity").doc(activityId("activity")), {
      type: "customer_updated",
      title: "Customer record updated",
      detail: `${actor.name} updated the CRM profile.`,
      actor_name: actor.name,
      actor_email: actor.email,
      created_at: now,
    });

    return { kind: "updated" as const };
  });
}

export async function archiveCrmCustomer(customerId: string, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const id = customerId.trim().toUpperCase();
  const customerRef = db.collection("customers").doc(id);
  const now = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(customerRef);
    if (!snapshot.exists || snapshot.get("archived") === true) return { kind: "missing" as const };

    transaction.update(customerRef, {
      archived: true,
      archived_at: now,
      archived_by_name: actor.name,
      archived_by_email: actor.email,
      updated_at: now,
    });
    transaction.create(customerRef.collection("activity").doc(activityId("activity")), {
      type: "customer_archived",
      title: "CRM record archived",
      detail: "The record was archived without deleting its operational history.",
      actor_name: actor.name,
      actor_email: actor.email,
      created_at: now,
    });

    return { kind: "archived" as const };
  });
}
