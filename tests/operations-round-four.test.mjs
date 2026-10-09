import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  base32Decode,
  base32Encode,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  newRecoveryCodes,
  otpauthUri,
  totpCode,
  twoStepCounter,
  twoStepLockedUntil,
  twoStepRequiredForRole,
  verifyTotp,
  TWO_STEP_LOCK_MS,
} from "../app/admin/two-step-policy.ts";
import { containerDatesInOrder, containerDetention, containerFromRecord, containerNumberValid, containersSummary, parseContainerNumbers } from "../app/shipment-containers.ts";
import { computeDutyEstimate, dutyEstimateFromInput } from "../app/shipment-duty-estimate.ts";
import { cleanDocumentReading, documentReadingSchema, dutyLinesFromReading } from "../app/document-reading.ts";
import { decidePartnerAccount, normalizePartnerEmail, partnerCanSeeShipment, partnerEmailValid, partnerShipmentAccessFromRecord } from "../app/partner/partner-access-policy.ts";
import { instantPrice, priceCardUsable, priceNeedsQuantity } from "../app/portal/portal-instant-price.ts";
import { commissionSettingsFrom, commissionSettingsFromInput, invoiceCostShare, invoicePaidShare, managerMargins, marginPeriod } from "../app/admin/management/account-margin.ts";
import { activeWorkspace, workflowWorkspaces } from "../app/admin/workflow-navigation.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Two-step sign-in
test("authenticator codes match RFC 6238 and each step works once", () => {
  // RFC 6238 appendix B, SHA-1, secret "12345678901234567890", T = 59 s.
  const secret = new TextEncoder().encode("12345678901234567890");
  const base32 = base32Encode(secret);
  assert.deepEqual([...base32Decode(base32)], [...secret]);
  assert.equal(totpCode(secret, twoStepCounter(59_000)), "287082");
  assert.equal(totpCode(secret, twoStepCounter(1_111_111_109_000)), "081804");

  const now = 1_111_111_109_000;
  const ok = verifyTotp(base32, "081 804", now, null);
  assert.deepEqual(ok, { ok: true, counter: twoStepCounter(now) });
  // The code from the step before still counts, once; the same step again does not.
  assert.equal(verifyTotp(base32, totpCode(secret, twoStepCounter(now) - 1), now, null).ok, true);
  assert.deepEqual(verifyTotp(base32, "081804", now, ok.counter), { ok: false, reason: "reused" });
  assert.deepEqual(verifyTotp(base32, "000000", now, null), { ok: false, reason: "wrong" });
  assert.deepEqual(verifyTotp(base32, "12345", now, null), { ok: false, reason: "format" });
  // Two steps away is too far.
  assert.equal(verifyTotp(base32, totpCode(secret, twoStepCounter(now) + 2), now, null).ok, false);
});

test("two-step is for Management and Accounts, with recovery codes kept as hashes and a lockout", () => {
  assert.equal(twoStepRequiredForRole("management"), true);
  assert.equal(twoStepRequiredForRole("accounts"), true);
  assert.equal(twoStepRequiredForRole("operations"), false);
  assert.equal(twoStepRequiredForRole(null), false);
  const codes = newRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(looksLikeRecoveryCode(codes[0].toLowerCase()), true);
  assert.equal(looksLikeRecoveryCode("123456"), false);
  assert.equal(hashRecoveryCode("uid-1", codes[0]), hashRecoveryCode("uid-1", codes[0].replace("-", " ").toLowerCase()));
  assert.notEqual(hashRecoveryCode("uid-1", codes[0]), hashRecoveryCode("uid-2", codes[0]));
  assert.equal(twoStepLockedUntil(4, 1000), null);
  assert.equal(twoStepLockedUntil(5, 1000), 1000 + TWO_STEP_LOCK_MS);
  assert.match(otpauthUri("ABC", "a@kcpl.example"), /^otpauth:\/\/totp\/KCPL%20Operations%3Aa%40kcpl\.example\?secret=ABC&issuer=KCPL\+Operations/);
});

test("a person waiting on the second step is never treated as signed in", () => {
  const auth = read("app/admin/admin-auth.ts");
  // The pending person is under `pending`, so code reading `user` off the access can't pass it.
  assert.match(auth, /kind: "two-step"; step: "enrol" \| "verify"; pending: AdminUser/);
  assert.doesNotMatch(auth, /kind: "two-step"[^}]*\buser:/);
  const mobile = read("app/admin/ops-mobile-api.server.ts");
  assert.match(mobile, /access\.kind === "two-step"\) return opsJson\(\{ ok: false, code: access\.step === "enrol" \? "two_step_enrol_on_web" : "two_step_required"/);
  // A wrong code is not an expired sign-in: the app would refresh and sign out on a 401.
  const route = read("app/api/mobile/ops/v1/two-step/route.ts");
  assert.doesNotMatch(route, /code: "(wrong|reused)"[^\n]*401\)/);
});

// Containers
test("container numbers are checked by their ISO 6346 digit, and pasted lists split", () => {
  assert.equal(containerNumberValid("CSQU3054383"), true);
  assert.equal(containerNumberValid("csqu 305438 3"), true);
  assert.equal(containerNumberValid("CSQU3054384"), false);
  assert.equal(containerNumberValid("MSKU1234565"), true);
  const parsed = parseContainerNumbers("CSQU3054383, MSKU1234565\nCSQU3054384\nCSQU3054383");
  assert.deepEqual(parsed, { valid: ["CSQU3054383", "MSKU1234565"], invalid: ["CSQU3054384"] });
  assert.deepEqual(parseContainerNumbers("CSQU3054383MSKU1234565").valid, ["CSQU3054383", "MSKU1234565"]);
});

test("detention runs from gate-out and stops when the empty is returned", () => {
  const out = containerFromRecord("CSQU3054383", { number: "CSQU3054383", gated_out_on: "2026-10-01", detention_free_days: 5, detention_daily_rate: 40, detention_currency: "USD" });
  // Days 1 to 5 are free; on the 9th, four days are over.
  assert.deepEqual(containerDetention(out, "2026-10-09"), { state: "expired", deadline: "2026-10-05", daysRemaining: -4, daysOverdue: 4, projectedCharge: 160 });
  const back = containerFromRecord("CSQU3054383", { ...out, gated_out_on: "2026-10-01", detention_free_days: 5, detention_daily_rate: 40, empty_returned_on: "2026-10-06" });
  assert.equal(containerDetention(back, "2026-10-20").projectedCharge, 40);
  assert.equal(containerDatesInOrder({ gated_out_on: "2026-10-01", delivered_on: "2026-10-03", empty_returned_on: "2026-10-02" }), false);
  assert.equal(containerDatesInOrder({ gated_out_on: null, delivered_on: null, empty_returned_on: "2026-10-02" }), false);
  const summary = containersSummary([out, back, containerFromRecord("MSKU1234565", { number: "MSKU1234565" })], "2026-10-09");
  assert.deepEqual({ ...summary, charges: summary.charges }, { total: 3, out: 1, returned: 1, overdue: 2, dueSoon: 0, charges: [{ currency: "USD", total: 200 }] });
});

// Duty estimate
test("the duty estimate follows Nepal's order: duty on CIF, excise on CIF plus duty, VAT on all three", () => {
  const parsed = dutyEstimateFromInput({
    currency: "USD", basis: "FOB", freight: "300", insurance: "100", exchangeRate: "133.5",
    lines: [{ hsCode: "8471.30", value: "3000", dutyRate: "10", exciseRate: "0" }, { hsCode: "2203", value: "1000", dutyRate: "30", exciseRate: "40" }],
    levies: [{ label: "Customs service fee", kind: "percent", amount: "0.5" }, { label: "", kind: "fixed", amount: "" }],
  });
  assert.equal(parsed.ok, true);
  const result = computeDutyEstimate(parsed.input);
  // Freight and insurance are shared 3:1. Line 1: CIF 3300 USD; line 2: 1100 USD.
  assert.equal(result.cif_value, 4400);
  assert.equal(result.lines[0].cif_npr, 440550);
  assert.equal(result.lines[0].duty, 44055);
  assert.equal(result.lines[0].vat, 62998.65);
  assert.equal(result.lines[1].cif_npr, 146850);
  assert.equal(result.lines[1].duty, 44055);
  assert.equal(result.lines[1].excise, 76362);
  assert.equal(result.lines[1].vat, 34744.71);
  assert.equal(result.levies.length, 1);
  assert.equal(result.levies[0].npr, 3759.36);
  assert.equal(result.total, Math.round((result.duty + result.excise + result.vat + result.levy_total) * 100) / 100);
  assert.deepEqual(dutyEstimateFromInput({ currency: "USD", exchangeRate: "133", lines: [{ hsCode: "12", value: "5", dutyRate: "5" }] }), { ok: false, error: "Line 1: enter the HS code, 4 to 10 digits." });
  assert.deepEqual(dutyEstimateFromInput({ currency: "USD", lines: [{ hsCode: "1234", value: "5", dutyRate: "5" }] }).ok, false);
  // Rupee invoices need no exchange rate.
  assert.equal(dutyEstimateFromInput({ currency: "NPR", lines: [{ hsCode: "1234", value: "5", dutyRate: "5" }] }).input.exchange_rate, 1);
});

// Reading documents
test("a document reading is cleaned before anyone sees it: nothing guessed, container digits checked", () => {
  assert.equal(cleanDocumentReading(null), null);
  const reading = cleanDocumentReading({
    document_type: "bill_of_lading", document_number: "  MAEU 123456789  ", carrier: "Maersk", eta: "2026-11-02", shipped_on: "02/10/2026",
    containers: [{ number: "csqu 305438 3", size_type: "40HC", seal_number: "S1" }, { number: "CSQU3054384", size_type: "53FT", seal_number: null }, { number: "" }],
    currency: "usd", incoterm: "fob", packages: -3, gross_weight_kg: 12000.12345,
    lines: [{ hs_code: "8471.30.00", description: "Laptops", quantity: 10, value: 5000 }, { hs_code: "12", description: "", quantity: null, value: null }],
    notes: "Stamp partly unreadable",
  });
  assert.equal(reading.document_number, "MAEU 123456789");
  assert.equal(reading.shipped_on, null, "a date not in the asked form is left out, not guessed");
  assert.equal(reading.eta, "2026-11-02");
  assert.deepEqual(reading.containers, [
    { number: "CSQU3054383", size_type: "40HC", seal_number: "S1", valid: true },
    { number: "CSQU3054384", size_type: null, seal_number: null, valid: false },
  ]);
  assert.equal(reading.currency, "USD");
  assert.equal(reading.incoterm, "FOB");
  assert.equal(reading.packages, null);
  assert.equal(reading.gross_weight_kg, 12000.123);
  assert.deepEqual(reading.lines, [{ hs_code: "84713000", description: "Laptops", quantity: 10, value: 5000 }]);
  assert.deepEqual(dutyLinesFromReading(reading), [{ hsCode: "84713000", description: "Laptops", value: "5000" }]);
  assert.equal(cleanDocumentReading({ document_type: "passport" }).document_type, "other");
  // Structured output needs every object closed and every field required.
  assert.equal(documentReadingSchema.additionalProperties, false);
  assert.deepEqual([...documentReadingSchema.required].sort(), Object.keys(documentReadingSchema.properties).sort());
});

test("the Anthropic key comes from the server's environment only, and reading never writes the shipment", () => {
  const server = read("app/admin/document-reading.server.ts");
  assert.match(server, /process\.env\.ANTHROPIC_API_KEY/);
  assert.doesNotMatch(server, /apiKey\s*:/);
  assert.doesNotMatch(server, /sk-ant-/);
  const readFn = server.slice(server.indexOf("export async function readShipmentDocument"), server.indexOf("export type ReadingChoices"));
  assert.doesNotMatch(readFn, /batch\.update\(shipment/);
  assert.match(server, /stop_reason === "refusal"/);
});

// Partners
test("a partner sees only shipments staff put them on, and only with a verified, active login", () => {
  assert.equal(normalizePartnerEmail("  Agent@Example.COM "), "agent@example.com");
  assert.equal(partnerEmailValid("agent@example.com"), true);
  assert.equal(partnerEmailValid("agent@"), false);
  const shipment = { partner_access_ids: ["p1"], partner_access: [{ partner_id: "p1", partner_name: "Haldia Agent", role: "origin_agent" }, { partner_id: "" }] };
  assert.equal(partnerShipmentAccessFromRecord(shipment.partner_access).length, 1);
  assert.equal(partnerCanSeeShipment(shipment, "p1"), true);
  assert.equal(partnerCanSeeShipment(shipment, "p2"), false);
  assert.equal(partnerCanSeeShipment({ partner_access_ids: ["p2"], partner_access: [] }, "p2"), false, "the id list alone is not enough");
  const identity = { uid: "u1", email: "agent@example.com", emailVerified: true };
  const account = { exists: true, active: true, partner_id: "p1", partner_name: "Haldia Agent" };
  assert.equal(decidePartnerAccount(identity, account, { exists: true, status: "active" }).kind, "allowed");
  assert.deepEqual(decidePartnerAccount({ ...identity, emailVerified: false }, account, { exists: true }), { kind: "denied", reason: "unverified" });
  assert.deepEqual(decidePartnerAccount(identity, { ...account, active: false }, { exists: true }), { kind: "denied", reason: "inactive" });
  assert.deepEqual(decidePartnerAccount(identity, { ...account, uid: "someone-else" }, { exists: true }), { kind: "denied", reason: "other_identity" });
  assert.deepEqual(decidePartnerAccount(identity, account, { exists: true, status: "inactive" }), { kind: "denied", reason: "partner_inactive" });
  assert.deepEqual(decidePartnerAccount(identity, { exists: false }, { exists: true }), { kind: "denied", reason: "no_account" });
});

test("every new staff and partner write goes through its checked request helper", () => {
  for (const path of [
    "app/api/admin/jobs/[reference]/containers/route.ts",
    "app/api/admin/jobs/[reference]/containers/[id]/route.ts",
    "app/api/admin/jobs/[reference]/duty-estimate/route.ts",
    "app/api/admin/jobs/[reference]/partners/route.ts",
    "app/api/admin/jobs/[reference]/documents/[id]/read/route.ts",
    "app/api/admin/jobs/[reference]/documents/[id]/apply/route.ts",
  ]) assert.match(read(path), /await jobWriteRequest\(request, /, path);
  const helper = read("app/api/admin/jobs/job-route-auth.ts");
  assert.match(helper, /isTrustedSameOriginRequest/);
  assert.match(helper, /canManageJobFile/);
  assert.match(helper, /checkShipmentBranchAccess/);
  for (const path of ["app/api/partner/shipments/[reference]/milestones/route.ts", "app/api/partner/shipments/[reference]/documents/route.ts"]) {
    assert.match(read(path), /await partnerWriteRequest\(request\)/, path);
  }
  assert.match(read("app/partner/partner-data.server.ts"), /partnerCanSeeShipment/);
  const commission = read("app/api/admin/management/commission/route.ts");
  assert.match(commission, /isTrustedSameOriginRequest/);
  assert.match(commission, /role !== "management"/);
});

// Instant prices
test("instant prices use the sell rate, never under the minimum, and only from a live card", () => {
  assert.equal(priceNeedsQuantity("flat"), false);
  assert.equal(priceNeedsQuantity("per_kg"), true);
  assert.equal(instantPrice({ sell_rate: 85, unit: "per_kg", minimum_charge: 5000 }, 40), 5000);
  assert.equal(instantPrice({ sell_rate: 85, unit: "per_kg", minimum_charge: 5000 }, "120.5"), 10242.5);
  assert.equal(instantPrice({ sell_rate: 1200, unit: "per_container", minimum_charge: null }, 1.5), null);
  assert.equal(instantPrice({ sell_rate: 1200, unit: "per_container", minimum_charge: null }, 2), 2400);
  assert.equal(instantPrice({ sell_rate: 9000, unit: "flat", minimum_charge: null }, undefined), 9000);
  assert.equal(instantPrice({ sell_rate: 85, unit: "per_kg", minimum_charge: null }, -1), null);
  assert.equal(priceCardUsable({ active: true, valid_from: "2026-10-01", valid_until: "2026-12-31", sell_rate: 85 }, "2026-10-09"), true);
  assert.equal(priceCardUsable({ active: true, valid_from: null, valid_until: "2026-10-08", sell_rate: 85 }, "2026-10-09"), false);
  assert.equal(priceCardUsable({ active: false, valid_from: null, valid_until: null, sell_rate: 85 }, "2026-10-09"), false);
  // The portal never reads what KCPL pays.
  assert.doesNotMatch(read("app/portal/portal-instant-price.server.ts"), /cost_rate/);
});

// Margin and commission
test("margin by account manager shares a shipment's cost across its invoices and pays commission on paid margin", () => {
  assert.equal(invoiceCostShare(60_000, 100_000, 50_000), 30_000);
  assert.equal(invoiceCostShare(60_000, 0, 50_000), 0);
  assert.equal(invoicePaidShare(1000, 250), 0.75);
  assert.equal(invoicePaidShare(0, 0), 1);
  const settings = commissionSettingsFrom({ default_rate: 5, rates: { asha: 10, bad: 400 }, paid_only: true });
  assert.deepEqual(settings, { default_rate: 5, rates: { asha: 10 }, paid_only: true });
  const managers = { c1: { uid: "asha", name: "Asha" }, c2: { uid: "bikash", name: "Bikash" } };
  const rows = managerMargins({
    invoices: [
      // S1 is invoiced twice; its 60,000 cost is shared 2:1.
      { reference: "I1", number: "KCPL/1", customer_id: "c1", customer_name: "Annapurna", shipment_reference: "S1", revenue_npr: 100_000, paid_share: 1 },
      { reference: "I2", number: "KCPL/2", customer_id: "c1", customer_name: "Annapurna", shipment_reference: "S1", revenue_npr: 50_000, paid_share: 0.5 },
      // A loss earns nothing, and takes nothing back.
      { reference: "I3", number: "KCPL/3", customer_id: "c2", customer_name: "Bagmati", shipment_reference: "S2", revenue_npr: 10_000, paid_share: 1 },
      { reference: "I4", number: "KCPL/4", customer_id: null, customer_name: "Walk-in", shipment_reference: null, revenue_npr: 2_000, paid_share: 1 },
    ],
    shipmentCost: new Map([["S1", 60_000], ["S2", 15_000]]),
    shipmentRevenue: new Map([["S1", 150_000], ["S2", 10_000]]),
    managerOf: (id) => managers[id] ?? { uid: null, name: "No account manager" },
    settings,
  });
  assert.deepEqual(rows.map((row) => row.name), ["Asha", "Bikash", "No account manager"]);
  const asha = rows[0];
  assert.equal(asha.revenue, 150_000);
  assert.equal(asha.cost, 60_000);
  assert.equal(asha.margin, 90_000);
  assert.equal(asha.margin_percent, 60);
  // Paid share: all of I1's 60,000 margin and half of I2's 30,000.
  assert.equal(asha.commission_base, 75_000);
  assert.equal(asha.commission, 7_500);
  assert.equal(rows[1].margin, -5_000);
  assert.equal(rows[1].commission, 0);
  assert.equal(rows[2].commission, 0, "nobody earns commission on unassigned customers");
  assert.deepEqual(commissionSettingsFromInput({ defaultRate: "120" }), { ok: false, error: "The usual rate must be between 0 and 100%." });
  assert.deepEqual(commissionSettingsFromInput({ defaultRate: "2.5", paidOnly: false, rates: { asha: "7", bikash: "" } }), { ok: true, settings: { default_rate: 2.5, rates: { asha: 7 }, paid_only: false } });
});

test("margin periods are Nepali months or fiscal years, and the page is Management's, under Reports", () => {
  assert.deepEqual(marginPeriod({ y: "2083", m: "6" }, { year: 2083, month: 6 }), { kind: "month", year: 2083, month: 6, start: "2026-09-17", end: "2026-10-17", label: "Asoj 2083" });
  const fiscal = marginPeriod({ fy: "2083" }, { year: 2083, month: 6 });
  assert.equal(fiscal.start, "2026-07-17");
  assert.equal(fiscal.label, "Fiscal year 2083/84");
  assert.equal(marginPeriod({ y: "2083", m: "13" }, { year: 2083, month: 6 }), null);
  const tab = workflowWorkspaces.find((workspace) => workspace.id === "commission");
  assert.equal(tab.permission, "management");
  assert.equal(tab.hub, "reports");
  const management = { isManagement: true, canManageFinance: true, canManageStaff: true, canViewCommercial: true, canManageJobFile: true };
  assert.equal(activeWorkspace("/admin/management/commission", management)?.id, "commission");
  assert.equal(activeWorkspace("/admin/management", management)?.id, "management");
  assert.equal(activeWorkspace("/admin/management/commission", { ...management, isManagement: false }), null);
  const page = read("app/admin/management/commission/page.tsx");
  assert.match(page, /role !== "management"/);
  assert.match(read("app/admin/management/account-margin.server.ts"), /role !== "management"\) return \{ kind: "forbidden"/);
});
