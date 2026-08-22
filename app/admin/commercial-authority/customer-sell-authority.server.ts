import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { loadCommercialVersionInTransaction } from "../commercial-lineage/commercial-lineage.server";
import {
  normalizeCommercialCurrency,
  normalizeCommercialId,
  sameCommercialMoney,
  type CommercialVersion,
} from "../commercial-lineage/commercial-lineage";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import {
  customerSellEconomicsMatch,
  quoteHasTmsAuthorityMarkers,
  tmsCustomerQuoteReference,
} from "./commercial-authority";

type Actor = { name: string; email: string };

export type CustomerSellAuthorityFailure =
  | "customer_quote_required"
  | "customer_quote_stale"
  | "customer_acceptance_required";

type CustomerAcceptanceRecord = {
  commercial_version_id: string;
  commercial_fingerprint: string;
  order_id: string;
  customer_id: string;
  quote_reference: string;
  sell_amount: number;
  sell_currency: string;
  accepted_at: string;
  accepted_by_name: string;
  accepted_by_email: string;
  acceptance_source: string;
};

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function branchValue(value: unknown): KcplBranch | null { return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null; }
function acceptanceRef(versionId: string) { return firebaseAdminDb().collection("commercial_customer_acceptances").doc(normalizeCommercialId(versionId)); }

function acceptanceFromData(data: Record<string, unknown>): CustomerAcceptanceRecord | null {
  const sellAmount = Number(data.sell_amount);
  const sellCurrency = normalizeCommercialCurrency(data.sell_currency);
  const record: CustomerAcceptanceRecord = {
    commercial_version_id: normalizeCommercialId(data.commercial_version_id),
    commercial_fingerprint: text(data.commercial_fingerprint),
    order_id: normalizeCommercialId(data.order_id),
    customer_id: normalizeCommercialId(data.customer_id),
    quote_reference: normalizeCommercialId(data.quote_reference),
    sell_amount: sellAmount,
    sell_currency: sellCurrency,
    accepted_at: text(data.accepted_at),
    accepted_by_name: text(data.accepted_by_name),
    accepted_by_email: text(data.accepted_by_email).toLowerCase(),
    acceptance_source: text(data.acceptance_source),
  };
  return data.status === "accepted"
    && record.commercial_version_id
    && record.commercial_fingerprint
    && record.order_id
    && record.customer_id
    && record.quote_reference
    && Number.isFinite(record.sell_amount)
    && record.sell_amount >= 0
    && record.sell_currency
    && record.accepted_at
    && record.accepted_by_email
    && record.acceptance_source
    ? record
    : null;
}

function acceptanceMatchesVersion(record: CustomerAcceptanceRecord, version: CommercialVersion) {
  const pricing = version.snapshot.pricing;
  const customerId = normalizeCommercialId(version.snapshot.customer_id);
  if (!pricing || !customerId) return false;
  const sellCurrency = normalizeCommercialCurrency(pricing.sell_currency);
  return Boolean(
    record.commercial_version_id === version.id
    && record.commercial_fingerprint === version.fingerprint
    && record.order_id === normalizeCommercialId(version.snapshot.order_id)
    && record.customer_id === customerId
    && record.sell_currency === sellCurrency
    && sameCommercialMoney(record.sell_amount, pricing.sell_amount, sellCurrency),
  );
}

export async function assertCustomerQuoteIssuedInTransaction(
  transaction: FirebaseFirestore.Transaction,
  version: CommercialVersion,
): Promise<{ ok: true; quoteReference: string } | { ok: false; reason: CustomerSellAuthorityFailure }> {
  const customerId = normalizeCommercialId(version.snapshot.customer_id);
  const pricing = version.snapshot.pricing;
  if (!customerId || !pricing) return { ok: false, reason: "customer_quote_required" };
  const reference = tmsCustomerQuoteReference(version.snapshot.order_id, version.id);
  const quote = await transaction.get(firebaseAdminDb().collection("quotes").doc(reference));
  if (!quote.exists) return { ok: false, reason: "customer_quote_required" };
  const quoteBranch = text(quote.get("branch"));
  const sellCurrency = normalizeCommercialCurrency(pricing.sell_currency);
  if (
    text(quote.get("source")) !== "tms_sell_pricing_engine"
    || quote.get("commercial_locked") !== true
    || normalizeCommercialId(quote.get("transport_order_id")) !== normalizeCommercialId(version.snapshot.order_id)
    || normalizeCommercialId(quote.get("customer_id")) !== customerId
    || normalizeCommercialId(quote.get("commercial_version_id")) !== version.id
    || text(quote.get("commercial_fingerprint")) !== version.fingerprint
    || (quoteBranch && quoteBranch !== version.snapshot.branch)
    || normalizeCommercialCurrency(quote.get("quote_currency")) !== sellCurrency
    || !sameCommercialMoney(quote.get("quoted_amount"), pricing.sell_amount, sellCurrency)
  ) return { ok: false, reason: "customer_quote_stale" };
  return { ok: true, quoteReference: reference };
}

export async function assertCustomerSellAuthorityInTransaction(
  transaction: FirebaseFirestore.Transaction,
  version: CommercialVersion,
): Promise<{ ok: true; quoteReference: string; acceptance: CustomerAcceptanceRecord } | { ok: false; reason: CustomerSellAuthorityFailure }> {
  const customerId = normalizeCommercialId(version.snapshot.customer_id);
  const pricing = version.snapshot.pricing;
  if (!customerId || !pricing) return { ok: false, reason: "customer_quote_required" };
  const snapshot = await transaction.get(acceptanceRef(version.id));
  if (!snapshot.exists) return { ok: false, reason: "customer_acceptance_required" };
  const record = acceptanceFromData(snapshot.data() as Record<string, unknown>);
  if (!record || !acceptanceMatchesVersion(record, version)) return { ok: false, reason: "customer_quote_stale" };
  return { ok: true, quoteReference: record.quote_reference, acceptance: record };
}

export async function carryForwardCustomerSellAuthorityInTransaction(
  transaction: FirebaseFirestore.Transaction,
  sourceVersion: CommercialVersion,
  derivedVersion: CommercialVersion,
  actor: Actor,
) {
  if (!customerSellEconomicsMatch(sourceVersion.snapshot, derivedVersion.snapshot)) return { kind: "not_carried" as const };
  const source = await assertCustomerSellAuthorityInTransaction(transaction, sourceVersion);
  if (!source.ok) return { kind: "not_carried" as const };
  const ref = acceptanceRef(derivedVersion.id);
  const existing = await transaction.get(ref);
  if (existing.exists) {
    const record = acceptanceFromData(existing.data() as Record<string, unknown>);
    return record && acceptanceMatchesVersion(record, derivedVersion)
      ? { kind: "carried" as const, quoteReference: record.quote_reference, idempotent: true }
      : { kind: "conflict" as const };
  }
  const pricing = derivedVersion.snapshot.pricing!;
  const now = new Date().toISOString();
  transaction.create(ref, {
    status: "accepted",
    commercial_version_id: derivedVersion.id,
    commercial_fingerprint: derivedVersion.fingerprint,
    order_id: normalizeCommercialId(derivedVersion.snapshot.order_id),
    customer_id: normalizeCommercialId(derivedVersion.snapshot.customer_id),
    quote_reference: source.quoteReference,
    sell_amount: pricing.sell_amount,
    sell_currency: normalizeCommercialCurrency(pricing.sell_currency),
    accepted_at: source.acceptance.accepted_at,
    accepted_by_name: source.acceptance.accepted_by_name,
    accepted_by_email: source.acceptance.accepted_by_email,
    acceptance_source: source.acceptance.acceptance_source,
    authority_derivation: "buy_side_only_carry_forward",
    source_commercial_version_id: sourceVersion.id,
    source_commercial_fingerprint: sourceVersion.fingerprint,
    carried_forward_at: now,
    carried_forward_by_name: actor.name,
    carried_forward_by_email: actor.email,
    immutable: true,
    created_at: now,
  });
  return { kind: "carried" as const, quoteReference: source.quoteReference, idempotent: false };
}

export async function acceptCurrentTmsCustomerQuote(
  quoteReference: string,
  actor: Actor,
  staff: KcplStaffContext,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!staff.permissions.canEditCommercial) return { kind: "forbidden" as const };
  const db = firebaseAdminDb();
  const reference = normalizeCommercialId(quoteReference);
  const quoteRef = db.collection("quotes").doc(reference);
  try {
    return await db.runTransaction(async (transaction) => {
      const quote = await transaction.get(quoteRef);
      if (!quote.exists) return { kind: "missing" as const };
      const quoteData = quote.data() as Record<string, unknown>;
      if (!quoteHasTmsAuthorityMarkers(quoteData)) return { kind: "not_tms" as const };
      if (text(quote.get("source")) !== "tms_sell_pricing_engine" || quote.get("commercial_locked") !== true) return { kind: "invalid_tms_quote" as const };
      const orderId = normalizeCommercialId(quote.get("transport_order_id"));
      const versionId = normalizeCommercialId(quote.get("commercial_version_id"));
      const fingerprint = text(quote.get("commercial_fingerprint"));
      if (!orderId || !versionId || !fingerprint || reference !== tmsCustomerQuoteReference(orderId, versionId)) return { kind: "invalid_tms_quote" as const };
      const orderRef = db.collection("transport_orders").doc(orderId);
      const order = await transaction.get(orderRef);
      if (!order.exists) return { kind: "missing_order" as const };
      const branch = branchValue(order.get("branch"));
      if (!branch || !staffCanAccessBranch(staff, branch)) return { kind: "forbidden" as const };
      if (normalizeCommercialId(order.get("commercial_version_id")) !== versionId || text(order.get("commercial_fingerprint")) !== fingerprint) return { kind: "stale_commercial_quote" as const };
      const resolved = await loadCommercialVersionInTransaction(transaction, versionId, fingerprint, orderId);
      if (resolved.kind !== "ready") return { kind: "stale_commercial_quote" as const };
      const version = resolved.version;
      const pricing = version.snapshot.pricing;
      const customerId = normalizeCommercialId(version.snapshot.customer_id);
      if (!pricing || !customerId || version.snapshot.branch !== branch) return { kind: "invalid_tms_quote" as const };
      const customer = await transaction.get(db.collection("customers").doc(customerId));
      if (!customer.exists || customer.get("archived") === true || branchValue(customer.get("primary_branch")) !== branch) return { kind: "customer_missing" as const };
      const issued = await assertCustomerQuoteIssuedInTransaction(transaction, version);
      if (!issued.ok) return { kind: "stale_commercial_quote" as const };
      const status = text(quote.get("status"));
      if (status !== "quoted" && status !== "won") return { kind: "invalid_transition" as const };
      const acceptanceDoc = await transaction.get(acceptanceRef(version.id));
      if (acceptanceDoc.exists) {
        const existing = acceptanceFromData(acceptanceDoc.data() as Record<string, unknown>);
        if (!existing || !acceptanceMatchesVersion(existing, version) || existing.quote_reference !== reference) return { kind: "stale_commercial_quote" as const };
        if (status !== "won" || text(quote.get("customer_acceptance_status")) !== "accepted") {
          transaction.update(quoteRef, { status: "won", customer_acceptance_status: "accepted", updated_at: new Date().toISOString() });
        }
        return { kind: "accepted" as const, quoteReference: reference, commercialVersionId: version.id, idempotent: true };
      }
      const now = new Date().toISOString();
      const sellCurrency = normalizeCommercialCurrency(pricing.sell_currency);
      const acceptance = {
        status: "accepted",
        commercial_version_id: version.id,
        commercial_fingerprint: version.fingerprint,
        order_id: orderId,
        customer_id: customerId,
        quote_reference: reference,
        sell_amount: pricing.sell_amount,
        sell_currency: sellCurrency,
        accepted_at: now,
        accepted_by_name: actor.name,
        accepted_by_email: actor.email.toLowerCase(),
        acceptance_source: "kcpl_staff_recorded_customer_acceptance",
        authority_derivation: "exact_customer_quote",
        source_commercial_version_id: version.id,
        source_commercial_fingerprint: version.fingerprint,
        immutable: true,
        created_at: now,
      };
      transaction.create(acceptanceRef(version.id), acceptance);
      transaction.update(quoteRef, {
        status: "won",
        customer_acceptance_status: "accepted",
        accepted_at: now,
        accepted_by_name: actor.name,
        accepted_by_email: actor.email.toLowerCase(),
        accepted_by_source: "kcpl_staff_recorded_customer_acceptance",
        accepted_order_id: orderId,
        accepted_customer_id: customerId,
        accepted_commercial_version_id: version.id,
        accepted_commercial_fingerprint: version.fingerprint,
        accepted_sell_amount: pricing.sell_amount,
        accepted_sell_currency: sellCurrency,
        updated_at: now,
      });
      return { kind: "accepted" as const, quoteReference: reference, commercialVersionId: version.id, idempotent: false };
    });
  } catch {
    return { kind: "unavailable" as const };
  }
}
