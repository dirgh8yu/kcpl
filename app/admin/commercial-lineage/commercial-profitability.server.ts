import { firebaseAdminDb } from "../../firebase-admin.server";
import { resolveBookedCommercialLineage } from "../financial-settlement/settlement-policy";
import { normalizeCommercialCurrency } from "./commercial-lineage";
import { commercialProfitabilityFromFacts } from "./commercial-profitability";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validatedAuditStatus(value: unknown) {
  return value === "matched" || value === "approved_variance";
}

type ActualProcurementFact = {
  amount: number;
  currency: string;
  versionId: string;
  fingerprint: string;
};

export async function customerCommercialProfitabilitySummary(customerId: string, aggregationCurrency: string) {
  const normalizedCustomerId = customerId.trim().toUpperCase();
  const currency = normalizeCommercialCurrency(aggregationCurrency);
  const db = firebaseAdminDb();
  const [shipmentsSnapshot, payablesSnapshot] = await Promise.all([
    db.collection("shipments").where("customer_id", "==", normalizedCustomerId).limit(1000).get(),
    db.collection("payables").where("customer_id", "==", normalizedCustomerId).limit(2500).get(),
  ]);

  const payableDocs = payablesSnapshot.docs.filter((doc) => text(doc.get("status")) !== "void" && text(doc.get("shipment_reference")));
  const auditSnapshots = payableDocs.length
    ? await db.getAll(...payableDocs.map((doc) => db.collection("freight_audits").doc(doc.id)))
    : [];
  const actualByShipment = new Map<string, ActualProcurementFact[]>();
  for (let index = 0; index < payableDocs.length; index += 1) {
    const payable = payableDocs[index];
    const audit = auditSnapshots[index];
    if (!audit?.exists || !validatedAuditStatus(audit.get("status")) || text(audit.get("commercial_lineage_status")) !== "versioned") continue;
    const shipmentReference = text(payable.get("shipment_reference")).toUpperCase();
    const amount = numberOrNull(audit.get("invoice_subtotal"));
    const auditCurrency = normalizeCommercialCurrency(audit.get("invoice_currency"));
    const versionId = text(audit.get("booked_commercial_version_id")).toUpperCase();
    const fingerprint = text(audit.get("booked_commercial_fingerprint"));
    if (!shipmentReference || amount === null || amount < 0 || !auditCurrency || !versionId || !fingerprint) continue;
    const values = actualByShipment.get(shipmentReference) ?? [];
    values.push({ amount, currency: auditCurrency, versionId, fingerprint });
    actualByShipment.set(shipmentReference, values);
  }

  let expectedRevenueTotal = 0;
  let expectedProcurementTotal = 0;
  let expectedProfitTotal = 0;
  let actualProcurementTotal = 0;
  let actualProfitTotal = 0;
  let expectedComparableCount = 0;
  let actualComparableCount = 0;
  let uncomparableCount = 0;
  let versionedShipmentCount = 0;

  for (const shipment of shipmentsSnapshot.docs) {
    const shipmentData = shipment.data() as Record<string, unknown>;
    const lineage = resolveBookedCommercialLineage(shipmentData);
    if (!lineage.ok) continue;
    versionedShipmentCount += 1;

    const actualValues = (actualByShipment.get(shipment.id) ?? [])
      .filter((value) => value.versionId === lineage.versionId && value.fingerprint === lineage.fingerprint);
    const actualCurrencies = [...new Set(actualValues.map((value) => value.currency))];
    const actual = actualCurrencies.length === 1
      ? { amount: actualValues.reduce((sum, value) => sum + value.amount, 0), currency: actualCurrencies[0] }
      : { amount: null, currency: actualCurrencies.length ? actualCurrencies.join("+") : null };

    const facts = commercialProfitabilityFromFacts({
      expectedRevenue: {
        amount: lineage.snapshot.pricing?.sell_amount ?? null,
        currency: lineage.snapshot.pricing?.sell_currency ?? null,
      },
      expectedProcurement: {
        amount: lineage.snapshot.procurement.total,
        currency: lineage.snapshot.procurement.currency,
      },
      actualProcurement: actual,
    });

    if (facts.expected_comparable && facts.expected_profit_currency === currency) {
      expectedRevenueTotal += facts.expected_revenue_amount ?? 0;
      expectedProcurementTotal += facts.expected_procurement_amount ?? 0;
      expectedProfitTotal += facts.expected_profit_amount ?? 0;
      expectedComparableCount += 1;
    } else if (facts.expected_revenue_amount !== null || facts.expected_procurement_amount !== null) {
      uncomparableCount += 1;
    }

    if (facts.actual_comparable && facts.actual_profit_currency === currency) {
      actualProcurementTotal += facts.actual_procurement_amount ?? 0;
      actualProfitTotal += facts.actual_profit_amount ?? 0;
      actualComparableCount += 1;
    } else if (facts.actual_procurement_amount !== null) {
      uncomparableCount += 1;
    }
  }

  return {
    commercial_expected_revenue_total: expectedRevenueTotal,
    commercial_expected_procurement_total: expectedProcurementTotal,
    commercial_expected_profit_total: expectedProfitTotal,
    commercial_actual_procurement_total: actualProcurementTotal,
    commercial_actual_profit_total: actualProfitTotal,
    commercial_profitability_currency: currency || null,
    commercial_versioned_shipment_count: versionedShipmentCount,
    commercial_expected_comparable_count: expectedComparableCount,
    commercial_actual_comparable_count: actualComparableCount,
    commercial_uncomparable_shipment_count: uncomparableCount,
    commercial_profitability_basis: "verified_booked_lineage_plus_matching_validated_freight_audit",
  };
}
