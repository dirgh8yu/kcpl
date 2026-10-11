import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dutyToolEstimate, storageToolEstimate, volumeToolEstimate } from "../app/importer-tools.ts";
import { computeDutyEstimate } from "../app/shipment-duty-estimate.ts";
import { freeTimeStatus } from "../app/shipment-free-time.ts";
import { sitemapPaths } from "../app/sitemap-content.ts";
import { siteLocales } from "../app/site-i18n.ts";
import { tools, toolSlugs } from "../app/tool-data.ts";

const duty = (overrides = {}) => dutyToolEstimate({
  value: "10,000", currency: "USD", basis: "FOB", freight: "800", insurance: "100", exchangeRate: "133.5", dutyRate: "15", exciseRate: "", vatRate: "13", ...overrides,
});

test("the duty tool gives the Job File's figures for the same goods", () => {
  const outcome = duty();
  assert.equal(outcome.ok, true);
  // CIF 10,900 USD at 133.5 = 14,55,150; duty 15%; VAT 13% on CIF plus duty.
  assert.equal(outcome.result.cif_npr, 1_455_150);
  assert.equal(outcome.result.duty, 218_272.5);
  assert.equal(outcome.result.vat, 217_544.93);
  assert.equal(outcome.result.total, 435_817.43);
  const staff = computeDutyEstimate({
    currency: "USD", basis: "FOB", freight: 800, insurance: 100, exchange_rate: 133.5, vat_rate: 13,
    lines: [{ hs_code: "84713000", description: "", value: 10_000, duty_rate: 15, excise_rate: 0 }], levies: [], shared_with_customer: false,
  });
  assert.equal(outcome.result.total, staff.total);
});

test("the duty tool charges excise on value plus duty, and VAT on all three", () => {
  const { result } = duty({ basis: "CIF", value: "1000", exchangeRate: "100", dutyRate: "10", exciseRate: "20", vatRate: "" });
  assert.equal(result.cif_npr, 100_000, "a CIF value takes no freight on top");
  assert.equal(result.duty, 10_000);
  assert.equal(result.excise, 22_000);
  assert.equal(result.vat, 17_160, "VAT defaults to 13%");
});

test("an invoice in rupees needs no exchange rate", () => {
  const outcome = duty({ currency: "NPR", exchangeRate: "", basis: "CIF", value: "50000" });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.cif_npr, 50_000);
});

test("the duty tool says what is missing instead of showing a wrong figure", () => {
  assert.deepEqual(duty({ value: "" }), { ok: false, error: "value" });
  assert.deepEqual(duty({ exchangeRate: "0" }), { ok: false, error: "exchange" });
  assert.deepEqual(duty({ freight: "-5" }), { ok: false, error: "costs" });
  assert.deepEqual(duty({ vatRate: "130" }), { ok: false, error: "rate" });
  assert.deepEqual(duty({ dutyRate: "abc" }), { ok: false, error: "rate" });
});

test("the storage tool counts free days the way the shipment record does", () => {
  for (const days of [1, 3, 7, 14]) {
    for (let offset = 0; offset <= 20; offset += 1) {
      const collectOn = new Date(Date.UTC(2026, 9, 1 + offset)).toISOString().slice(0, 10);
      const { result } = storageToolEstimate({ startedOn: "2026-10-01", freeDays: String(days), collectOn, dailyRate: "10" });
      const status = freeTimeStatus({ location: null, days, started_on: "2026-10-01", daily_charge: 10, charge_currency: "USD", bearer: "customer", note: null, updated_at: null, updated_by: null, ended_on: null }, collectOn);
      assert.equal(result.lastFreeDay, status.deadline, `${days} days, collected ${collectOn}`);
      assert.equal(result.chargeableDays, status.daysOverdue, `${days} days, collected ${collectOn}`);
      assert.equal(result.total, status.projectedCharge ?? 0, `${days} days, collected ${collectOn}`);
    }
  }
});

test("seven free days from the 1st end on the 7th; collecting on the 10th is three days", () => {
  const { result } = storageToolEstimate({ startedOn: "2026-10-01", freeDays: "7", collectOn: "2026-10-10", dailyRate: "25" });
  assert.equal(result.lastFreeDay, "2026-10-07");
  assert.equal(result.chargeableDays, 3);
  assert.equal(result.total, 75);
});

test("a stepped rate charges the first rate up to the step and the second after", () => {
  const { result } = storageToolEstimate({ startedOn: "2026-10-01", freeDays: "7", collectOn: "2026-10-20", dailyRate: "10", laterRate: "20", laterAfterDays: "5" });
  assert.equal(result.chargeableDays, 13);
  assert.deepEqual(result.bands, [{ days: 5, rate: 10, amount: 50 }, { days: 8, rate: 20, amount: 160 }]);
  assert.equal(result.total, 210);
  const short = storageToolEstimate({ startedOn: "2026-10-01", freeDays: "7", collectOn: "2026-10-09", dailyRate: "10", laterRate: "20", laterAfterDays: "5" });
  assert.deepEqual(short.result.bands, [{ days: 2, rate: 10, amount: 20 }], "a step not reached is not charged");
});

test("with no free days the first day is already charged", () => {
  const { result } = storageToolEstimate({ startedOn: "2026-10-01", freeDays: "0", collectOn: "2026-10-01", dailyRate: "10" });
  assert.equal(result.lastFreeDay, null);
  assert.equal(result.chargeableDays, 1);
});

test("the storage tool refuses dates out of order and fractional days", () => {
  assert.deepEqual(storageToolEstimate({ startedOn: "2026-10-05", freeDays: "7", collectOn: "2026-10-01", dailyRate: "10" }), { ok: false, error: "dates" });
  assert.deepEqual(storageToolEstimate({ startedOn: "2026-10-01", freeDays: "2.5", collectOn: "2026-10-09", dailyRate: "10" }), { ok: false, error: "days" });
  assert.deepEqual(storageToolEstimate({ startedOn: "2026-10-01", freeDays: "7", collectOn: "2026-10-09", dailyRate: "-1" }), { ok: false, error: "rate" });
});

test("volume, air volumetric weight and sea weight-or-measure", () => {
  const { result } = volumeToolEstimate([
    { length: "120", width: "80", height: "100", quantity: "2", weight: "250" },
    { length: "", width: "", height: "", quantity: "1", weight: "" },
  ], { length: "cm", weight: "kg" });
  assert.equal(result.pieces, 2, "a row left blank is not counted");
  assert.equal(result.cbm, 1.92);
  assert.equal(result.grossKg, 500);
  assert.equal(result.volumetricKg, 320, "cubic centimetres over 6,000");
  assert.equal(result.airChargeableKg, 500, "the greater of actual and volumetric");
  assert.equal(result.seaRevenueTonnes, 1.92, "the greater of cubic metres and tonnes");
  assert.deepEqual(result.containers.map((box) => box.percent), [6, 3, 3]);
});

test("light, bulky cargo is charged on its volume by air", () => {
  const { result } = volumeToolEstimate([{ length: "100", width: "100", height: "100", quantity: "1", weight: "40" }], { length: "cm", weight: "kg" });
  assert.equal(result.volumetricKg, 166.67);
  assert.equal(result.airChargeableKg, 166.67);
});

test("inches and pounds convert before anything is added up", () => {
  const { result } = volumeToolEstimate([{ length: "10", width: "10", height: "10", quantity: "1", weight: "10" }], { length: "in", weight: "lb" });
  assert.equal(result.cbm, 0.016);
  assert.equal(result.grossKg, 4.54);
  assert.equal(result.volumetricKg, 2.73);
});

test("a half-filled package is a mistake to point out, not a row to skip", () => {
  assert.deepEqual(volumeToolEstimate([{ length: "120", width: "", height: "100", quantity: "1", weight: "" }], { length: "cm", weight: "kg" }), { ok: false, error: "dimensions" });
  assert.deepEqual(volumeToolEstimate([{ length: "120", width: "80", height: "100", quantity: "1.5", weight: "" }], { length: "cm", weight: "kg" }), { ok: false, error: "dimensions" });
  assert.deepEqual(volumeToolEstimate([], { length: "cm", weight: "kg" }), { ok: false, error: "pieces" });
});

test("every tool is in the sitemap and speaks every site language", () => {
  assert.ok(sitemapPaths().includes("/tools"));
  const shape = (value) => (Array.isArray(value) ? `array:${value.length}` : typeof value === "object" ? Object.keys(value).sort().map((key) => `${key}=${shape(value[key])}`).join(",") : typeof value);
  for (const slug of toolSlugs) assert.ok(sitemapPaths().includes(`/tools/${slug}`), slug);
  for (const locale of siteLocales) {
    assert.equal(shape(tools[locale]), shape(tools.en), `${locale} tool copy has a different shape from English`);
    const strings = JSON.stringify(tools[locale]).match(/"(?:[^"\\]|\\.)*"/g);
    assert.ok(!strings.includes('""'), `${locale} tool copy has an empty string`);
    for (const slug of toolSlugs) {
      for (const [key, english] of Object.entries(tools.en[slug])) {
        if (typeof english !== "string") continue;
        for (const placeholder of english.match(/\{\w+\}/g) ?? []) assert.ok(tools[locale][slug][key].includes(placeholder), `${locale}/${slug}.${key} lost ${placeholder}`);
      }
    }
  }
});

test("the calculators keep the dictionaries and the portal's copy out of the browser", () => {
  // Each language's words reach the calculator as props; importing the site
  // dictionary or the free-time module (which brings the portal dictionary)
  // would ship every language to every reader.
  const client = readFileSync(new URL("../app/components/importer-tool-forms.tsx", import.meta.url), "utf8");
  assert.match(client, /^"use client";/);
  for (const line of client.split("\n").filter((entry) => entry.startsWith("import "))) {
    if (/from "\.\.\/(site-i18n|tool-data|guide-data)"/.test(line)) assert.match(line, /^import type /, line);
  }
  const sums = readFileSync(new URL("../app/importer-tools.ts", import.meta.url), "utf8");
  assert.doesNotMatch(sums, /from "\.\/(shipment-free-time|portal\/)/);
});
