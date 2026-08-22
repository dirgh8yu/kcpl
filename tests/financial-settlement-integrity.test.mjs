import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { commercialFingerprint, COMMERCIAL_VERSION_SCHEMA } from "../app/admin/commercial-lineage/commercial-lineage.ts";
import {
  applySettlementPayment,
  freightAuditEconomicFingerprint,
  paymentDocumentId,
  resolveSettlementBasis,
  settlementCurrenciesMatch,
  settlementRequestFingerprint,
  supplierInvoiceUniquenessKey,
} from "../app/admin/financial-settlement/settlement-policy.ts";
import { classifyFreightAuditSupplier, freightAuditPaymentAllowed } from "../app/admin/freight-audit/freight-audit.ts";

const apServer = readFileSync(new URL("../app/admin/financial-settlement/payables-settlement.server.ts", import.meta.url), "utf8");
const arServer = readFileSync(new URL("../app/admin/financial-settlement/receivables-settlement.server.ts", import.meta.url), "utf8");
const apRoute = readFileSync(new URL("../app/api/admin/payables/bills/[reference]/payments/route.ts", import.meta.url), "utf8");
const arRoute = readFileSync(new URL("../app/api/admin/finance/invoices/[reference]/payments/route.ts", import.meta.url), "utf8");
const reconcileServer = readFileSync(new URL("../app/admin/financial-settlement/supplier-reconciliation-settlement.server.ts", import.meta.url), "utf8");

function basis(overrides = {}) {
  return resolveSettlementBasis({
    subtotal: 100,
    taxes: 10,
    adjustments: 5,
    credits: 2,
    storedTotal: 113,
    amountAlreadyPaid: 0,
    storedOutstanding: 113,
    ...overrides,
  });
}

function bookedSnapshot(overrides = {}) {
  const base = {
    schema_version: COMMERCIAL_VERSION_SCHEMA,
    order_id: "KCPL-TO-1",
    branch: "Kathmandu",
    customer_id: "CUST-1",
    mode: "road",
    procurement: {
      rate_card_id: "KCPL-RC-1",
      rate_card_updated_at: "2026-08-01T00:00:00.000Z",
      rate_card_valid_from: "2026-08-01",
      rate_card_valid_until: "2026-08-31",
      partner_id: "KCPL-P-1",
      partner_name: "Carrier One",
      mode: "road",
      service: "standard",
      equipment: "truck",
      rating_unit: "flat",
      rating_quantity: 1,
      base_rate: 100,
      base_charge: 100,
      minimum_charge: null,
      minimum_applied: false,
      fuel_surcharge_percent: 0,
      fuel_surcharge: 0,
      accessorials: 0,
      total: 100,
      currency: "USD",
    },
    pricing: null,
    fx: null,
    negotiation: null,
  };
  return { ...base, ...overrides, procurement: { ...base.procurement, ...(overrides.procurement ?? {}) } };
}

function economic(overrides = {}) {
  const snapshot = bookedSnapshot(overrides.snapshot ?? {});
  const fingerprint = commercialFingerprint(snapshot);
  return {
    payableReference: "KCPL-B-20260822-ABC",
    bill: {
      supplier_id: "KCPL-P-1",
      supplier_name: "Carrier One",
      category: "freight",
      supplier_bill_reference: "INV-100",
      shipment_reference: "KCPL-S-1",
      currency: "USD",
      subtotal: 100,
      total: 110,
      tax_total: 10,
      ...(overrides.bill ?? overrides),
    },
    shipment: {
      partner_id: snapshot.procurement.partner_id,
      carrier: snapshot.procurement.partner_name,
      procurement_currency: snapshot.procurement.currency,
      procurement_cost: snapshot.procurement.total,
      transport_order_id: snapshot.order_id,
      tender_id: "KCPL-T-1",
      procurement_rate_card_id: snapshot.procurement.rate_card_id,
      booked_commercial_version_id: "CV-1",
      booked_commercial_fingerprint: fingerprint,
      booked_commercial_snapshot: snapshot,
      ...(overrides.shipment ?? {}),
    },
    duplicateOf: null,
  };
}

test("1 duplicate supplier invoice key is deterministic and creation uses a transactional uniqueness document", () => {
  assert.equal(supplierInvoiceUniquenessKey("KCPL-P-1", "INV100"), supplierInvoiceUniquenessKey("kcpl-p-1", "inv100"));
  assert.match(apServer, /runTransaction/);
  assert.match(apServer, /supplier_invoice_uniques/);
  assert.match(apServer, /legacyDuplicateInTransaction/);
  assert.match(apServer, /supplier_bill_reference_required/);
});

test("2 duplicate or concurrent AP payment is transaction-safe and idempotent", () => {
  const fp = settlementRequestFingerprint({ accountReference: "B1", amount: 50, currency: "USD", paymentDate: "2026-08-22", method: "bank_transfer" });
  assert.equal(paymentDocumentId("B1", "request-1", fp), paymentDocumentId("B1", "request-1", fp));
  assert.match(apServer, /runTransaction/);
  assert.match(apServer, /transaction\.create\(paymentRef/);
  assert.doesNotMatch(apServer, /db\.batch\(\)/);
});

test("3 stale audit is rejected by commercial fingerprint and immutable lineage comparison in the settlement transaction", () => {
  assert.match(apServer, /commercial_fingerprint/);
  assert.match(apServer, /audit_stale/);
  assert.match(apServer, /freightAuditEconomicFingerprint/);
  assert.match(apServer, /booked_commercial_version_id/);
  assert.match(apServer, /collection\("commercial_versions"\)/);
});

test("4 review_required audit blocks payment", () => assert.equal(freightAuditPaymentAllowed("review_required"), false));
test("5 disputed audit blocks payment", () => assert.equal(freightAuditPaymentAllowed("disputed"), false));
test("6 rejected audit blocks payment", () => assert.equal(freightAuditPaymentAllowed("rejected"), false));
test("7 approved variance audit permits payment", () => assert.equal(freightAuditPaymentAllowed("approved_variance"), true));
test("8 matched audit permits payment", () => assert.equal(freightAuditPaymentAllowed("matched"), true));

test("9 invoice amount or tax edit changes the approval fingerprint", () => {
  const original = freightAuditEconomicFingerprint(economic());
  assert.notEqual(original, freightAuditEconomicFingerprint(economic({ bill: { subtotal: 101, total: 111 } })));
  assert.notEqual(original, freightAuditEconomicFingerprint(economic({ bill: { tax_total: 11, total: 111 } })));
  assert.notEqual(original, freightAuditEconomicFingerprint(economic({ bill: { total: 111 } })));
});

test("10 supplier change changes fingerprint and reconciliation explicitly invalidates approval", () => {
  const original = freightAuditEconomicFingerprint(economic());
  assert.notEqual(original, freightAuditEconomicFingerprint(economic({ bill: { supplier_id: "KCPL-P-2", supplier_name: "Carrier Two" } })));
  assert.match(reconcileServer, /financially_locked/);
  assert.match(reconcileServer, /invalidation_reason: "supplier_identity_changed"/);
  assert.match(reconcileServer, /status: "review_required"/);
});

test("11 invoice currency change changes fingerprint", () => {
  assert.notEqual(freightAuditEconomicFingerprint(economic()), freightAuditEconomicFingerprint(economic({ bill: { currency: "NPR" } })));
});

test("12 booked commercial lineage change changes Freight Audit fingerprint even when invoice facts do not", () => {
  const original = freightAuditEconomicFingerprint(economic());
  const revised = economic({ snapshot: { procurement: { total: 101 } } });
  assert.notEqual(original, freightAuditEconomicFingerprint(revised));
});

test("13 settlement basis is tax-inclusive payable truth and is the amount recorded as approved settlement", () => {
  const result = basis();
  assert.equal(result.ok, true);
  assert.equal(result.basis.totalPayable, 113);
  assert.equal(result.basis.outstandingAmount, 113);
  assert.match(apServer, /approved_settlement_amount: basisResult\.basis\.totalPayable/);
  assert.match(apServer, /invoice_total/);
});

test("14 currency handling fails closed and performs no FX", () => {
  assert.equal(settlementCurrenciesMatch("USD", "usd"), true);
  assert.equal(settlementCurrenciesMatch("USD", "NPR"), false);
  assert.equal(settlementCurrenciesMatch("", "USD"), false);
  assert.match(apServer, /currency_mismatch/);
  assert.match(arServer, /currency_mismatch/);
  assert.doesNotMatch(`${apServer}\n${arServer}`, /exchangeRate|fxRate|convertCurrency/);
});

test("15 overpayment is impossible", () => {
  const result = basis();
  assert.equal(result.ok, true);
  assert.deepEqual(applySettlementPayment(result.basis, 114), { ok: false, reason: "overpayment" });
  assert.deepEqual(applySettlementPayment(result.basis, 0), { ok: false, reason: "invalid_amount" });
  assert.deepEqual(applySettlementPayment(result.basis, -1), { ok: false, reason: "invalid_amount" });
});

test("16 partial payments preserve a non-negative atomic outstanding balance", () => {
  const initial = basis();
  assert.equal(initial.ok, true);
  const first = applySettlementPayment(initial.basis, 60);
  assert.equal(first.ok, true);
  assert.equal(first.nextOutstanding, 53);
  const current = basis({ amountAlreadyPaid: first.nextPaid, storedOutstanding: first.nextOutstanding });
  assert.equal(current.ok, true);
  assert.deepEqual(applySettlementPayment(current.basis, 60), { ok: false, reason: "overpayment" });
  assert.match(apServer, /transaction\.update\(billRef/);
  assert.match(arServer, /transaction\.update\(invoiceRef/);
});

test("17 legacy non-TMS bills remain explicitly not-applicable compatible", () => {
  assert.equal(freightAuditPaymentAllowed("not_applicable"), true);
  assert.match(apRoute, /ensureFreightAuditForPayment/);
});

test("18 ancillary supplier bills remain outside carrier comparison without weakening Match-Pay for freight suppliers", () => {
  const ancillary = classifyFreightAuditSupplier({ tmsBooked: true, category: "customs", bookedPartnerId: "P1", supplierId: "P2", supplierName: "Broker" });
  const freight = classifyFreightAuditSupplier({ tmsBooked: true, category: "freight", bookedPartnerId: "P1", supplierId: "P2", supplierName: "Other Carrier" });
  assert.equal(ancillary.ancillarySupplierBill, true);
  assert.equal(freight.ancillarySupplierBill, false);
  assert.match(apServer, /ancillary_supplier_bill/);
});

test("19 finance permissions, branch scope and same-origin mutation gates remain enforced", () => {
  assert.match(apRoute, /permissions\.canManageFinance/);
  assert.match(arRoute, /permissions\.canManageFinance/);
  assert.match(apRoute, /isTrustedSameOriginRequest/);
  assert.match(arRoute, /isTrustedSameOriginRequest/);
  assert.match(apServer, /canAccessBranchValue/);
  assert.match(arServer, /canAccessBranchValue/);
});

test("20 immutable booked lineage mismatch is a payment-stale condition", () => {
  assert.match(apServer, /audit\.get\("booked_commercial_version_id"\)/);
  assert.match(apServer, /order\.get\("booked_commercial_version_id"\)/);
  assert.match(apServer, /storedVersion\.fingerprint !== lineage\.fingerprint/);
  assert.match(apServer, /return \{ kind: "audit_stale" as const \}/);
});

test("inconsistent legacy totals fail safely rather than guessing", () => {
  assert.deepEqual(basis({ storedTotal: 112 }), { ok: false, reason: "inconsistent_total" });
  assert.deepEqual(basis({ amountAlreadyPaid: 10, storedOutstanding: 104 }), { ok: false, reason: "inconsistent_balance" });
});
