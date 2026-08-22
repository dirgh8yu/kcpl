import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFreightVariance,
  freightAuditPaymentAllowed,
  freightVarianceWithinTolerance,
  normalizeAuditReference,
  summarizeFreightAudits,
} from "../app/admin/freight-audit/freight-audit.ts";

test("freight variance reports amount and percent without FX assumptions", () => {
  assert.deepEqual(calculateFreightVariance(120000, 137500, true), { amount: 17500, percent: 14.58 });
  assert.deepEqual(calculateFreightVariance(120000, 137500, false), { amount: null, percent: null });
});

test("match tolerance accepts the greater of fixed and percentage tolerance", () => {
  assert.equal(freightVarianceWithinTolerance({ bookedCost: 1000, invoiceSubtotal: 1009, sameCurrency: true, toleranceAmount: 1, tolerancePercent: 1 }), true);
  assert.equal(freightVarianceWithinTolerance({ bookedCost: 1000, invoiceSubtotal: 1011, sameCurrency: true, toleranceAmount: 1, tolerancePercent: 1 }), false);
  assert.equal(freightVarianceWithinTolerance({ bookedCost: 20, invoiceSubtotal: 20.75, sameCurrency: true, toleranceAmount: 1, tolerancePercent: 1 }), true);
  assert.equal(freightVarianceWithinTolerance({ bookedCost: 20, invoiceSubtotal: 20.75, sameCurrency: false, toleranceAmount: 1, tolerancePercent: 1 }), false);
});

test("only matched, approved variance and non-TMS bills pass Match-Pay", () => {
  assert.equal(freightAuditPaymentAllowed("matched"), true);
  assert.equal(freightAuditPaymentAllowed("approved_variance"), true);
  assert.equal(freightAuditPaymentAllowed("not_applicable"), true);
  assert.equal(freightAuditPaymentAllowed("review_required"), false);
  assert.equal(freightAuditPaymentAllowed("disputed"), false);
  assert.equal(freightAuditPaymentAllowed("rejected"), false);
  assert.equal(freightAuditPaymentAllowed("pending"), false);
});

test("supplier invoice references normalize for duplicate matching", () => {
  assert.equal(normalizeAuditReference(" inv-2026 / 0042 "), "INV20260042");
});

test("Freight Audit summary counts payment blocks", () => {
  const base = {
    payable_reference: "B",
    shipment_reference: null,
    supplier_id: null,
    supplier_name: "Supplier",
    supplier_bill_reference: null,
    branch: "Kathmandu",
    invoice_currency: "NPR",
    invoice_subtotal: 0,
    invoice_tax: 0,
    invoice_total: 0,
    booked_partner_id: null,
    booked_partner_name: null,
    booked_currency: null,
    booked_cost: null,
    variance_amount: null,
    variance_percent: null,
    tolerance_amount: 1,
    tolerance_percent: 1,
    within_tolerance: false,
    duplicate_of: null,
    issues: [],
    dispute_note: null,
    resolution_note: null,
    audited_at: null,
    audited_by_name: null,
    audited_by_email: null,
    approved_at: null,
    approved_by_name: null,
    approved_by_email: null,
    updated_at: "2026-08-22T00:00:00.000Z",
    payable_status: "draft",
    customer_name: null,
    carrier_reference: null,
  };
  const rows = [
    { ...base, payable_reference: "B1", status: "matched" },
    { ...base, payable_reference: "B2", status: "review_required" },
    { ...base, payable_reference: "B3", status: "disputed" },
    { ...base, payable_reference: "B4", status: "approved_variance" },
  ];
  assert.deepEqual(summarizeFreightAudits(rows), {
    total: 4,
    matched: 1,
    review_required: 1,
    disputed: 1,
    approved_variance: 1,
    blocked_from_payment: 2,
  });
});
