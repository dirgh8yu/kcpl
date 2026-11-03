import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { captureQuoteAttribution, sanitizeQuoteAttribution } from "../app/quote-attribution.ts";
import { buildAttributionReport } from "../app/admin/attribution/attribution.ts";
import { buildPartnerScorecard } from "../app/partner/partner-scorecard.ts";
import { partnerTenderAction, partnerTenderView } from "../app/partner/partner-tenders.ts";
import { parseFreeTimeIngest } from "../app/free-time-ingest.ts";
import { mergeTimeline, portalTimeline } from "../app/shipment-timeline.ts";
import { trackingTokenFromInput } from "../app/tracking/tracking-link-input.ts";

test("quote attribution captures only allowlisted landing context", () => {
  const attribution = captureQuoteAttribution({
    search: "?tool=volume-weight&utm_source=Google&utm_medium=cpc&utm_campaign=nepal+import&email=someone%40example.com",
    referrer: "https://www.google.com/search?q=freight+nepal",
    pathname: "/quote",
  });
  assert.equal(attribution.source, "Google");
  assert.equal(attribution.medium, "cpc");
  assert.equal(attribution.campaign, "nepal import");
  assert.equal(attribution.tool, "volume-weight");
  assert.equal(attribution.referrer_host, "www.google.com");
  assert.equal(attribution.landing_path, "/quote");
  assert.equal(JSON.stringify(attribution).includes("someone@example.com"), false);
});

test("server attribution sanitizer rejects scripts, bad tools and foreign paths", () => {
  const cleaned = sanitizeQuoteAttribution({
    source: "Google\u0000<script>",
    tool: "not-a-tool",
    referrer_host: "google.com",
    landing_path: "https://evil.example/quote?x=1",
    campaign: "autumn",
  });
  assert.equal(cleaned.source, "Google<script>");
  assert.equal(cleaned.tool, null);
  assert.equal(cleaned.referrer_host, "google.com");
  assert.equal(cleaned.landing_path, "/quote");
  assert.equal(cleaned.campaign, "autumn");
  assert.equal(sanitizeQuoteAttribution({ medium: "cpc" }), null);
});

test("attribution report counts enquiries, quotes and wins by source without PII", () => {
  const report = buildAttributionReport([
    { data: { reference: "Q-1", status: "new", attribution: { source: "Google", medium: "cpc", tool: "volume-weight" } } },
    { data: { reference: "Q-2", status: "quoted", quote_currency: "USD", quoted_amount: 1200, attribution: { source: "Google", medium: "cpc", tool: "volume-weight", contact_email: "hidden@example.com" } } },
    { data: { reference: "Q-3", status: "won", quote_currency: "USD", quoted_amount: 1800, attribution: { source: "Google", medium: "cpc", tool: "volume-weight" } } },
    { data: { reference: "Q-4", status: "quoted", quote_currency: "NPR", quoted_amount: 50000, source: "customer_portal" } },
    { data: { status: "new" } },
  ], [
    { quote_reference: "Q-3", status: "issued", currency: "USD", total: 1750, amount_paid: 1000 },
    { quote_reference: "Q-3", status: "draft", currency: "USD", total: 500, amount_paid: 0 },
  ]);
  assert.equal(report.total, 5);
  assert.equal(report.rows.length, 3);
  assert.equal(report.unattributed, 1);
  assert.equal(report.quoted, 3);
  assert.equal(report.won, 1);
  const google = report.rows.find((row) => row.source === "Google");
  assert.equal(google.enquiries, 3);
  assert.equal(google.quoted, 2);
  assert.equal(google.won, 1);
  assert.equal(google.values.USD, 3000);
  assert.equal(google.invoiced.USD, 1750);
  assert.equal(google.collected.USD, 1000);
  assert.equal(report.invoiced.USD, 1750);
  assert.equal(report.collected.USD, 1000);
  assert.equal(JSON.stringify(report).includes("hidden@example.com"), false);
});

test("partner tender view exposes only the carrier's commercial offer", () => {
  const now = "2026-11-03T10:00:00.000Z";
  const view = partnerTenderView("TND-1", {
    tender_reference: "KCPL-T-1",
    order_id: "ORD-1",
    status: "sent",
    mode: "sea",
    origin: "Shanghai",
    destination: "Kathmandu",
    currency: "USD",
    offered_cost: 1200,
    response_due_at: "2026-11-04T10:00:00.000Z",
    sent_at: "2026-11-03T09:00:00.000Z",
    customer_name: "Hidden customer",
    sell_price: 1800,
    internal_cost: 900,
  }, now);
  assert.equal(view?.can_respond, true);
  assert.equal(view?.can_counter, true);
  assert.equal("customer_name" in view, false);
  assert.equal("sell_price" in view, false);
  assert.equal("internal_cost" in view, false);
  assert.equal(partnerTenderView("TND-2", { status: "sent", currency: "USD", response_due_at: "2026-11-02T10:00:00.000Z" }, now)?.expired, true);
  assert.equal(partnerTenderAction("counter"), "counter");
  assert.equal(partnerTenderAction("book"), null);
});

test("partner scorecard reports response, acceptance and on-time rates", () => {
  const base = { offered_cost: 1000, response_due_at: "2026-11-04T10:00:00.000Z" };
  const tender = (id, status, respondedAt = null) => ({ id, status, responded_at: respondedAt, ...base });
  const scorecard = buildPartnerScorecard([
    tender("T1", "sent"),
    tender("T2", "accepted", "2026-11-03T09:00:00.000Z"),
    tender("T3", "rejected", "2026-11-05T09:00:00.000Z"),
    tender("T4", "countered", "2026-11-03T09:00:00.000Z"),
    tender("T5", "expired"),
    tender("T6", "booked", "2026-11-03T09:00:00.000Z"),
  ]);
  assert.equal(scorecard.tenders, 6);
  assert.equal(scorecard.awaiting, 1);
  assert.equal(scorecard.responded, 4);
  assert.equal(scorecard.accepted, 2);
  assert.equal(scorecard.countered, 1);
  assert.equal(scorecard.rejected, 1);
  assert.equal(scorecard.on_time, 3);
  assert.equal(scorecard.response_rate, 67);
  assert.equal(scorecard.acceptance_rate, 50);
  assert.equal(scorecard.on_time_rate, 75);
});

test("carrier free-time feed accepts bounded calendar data only", () => {
  const parsed = parseFreeTimeIngest({
    reference: "kcpl-s-1",
    location: "Birgunj ICD",
    days: 5,
    started_on: "2026-11-01",
    daily_charge: 45,
    charge_currency: "usd",
    bearer: "customer",
    provider: "Maersk",
    provider_event_id: "evt-1",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.reference, "KCPL-S-1");
  assert.equal(parsed.value.charge_currency, "USD");
  assert.equal(parsed.value.days, 5);
  assert.equal(parseFreeTimeIngest({ reference: "S", location: "Port", days: 1.5, started_on: "2026-11-01", provider_event_id: "x" }).ok, false);
  assert.equal(parseFreeTimeIngest({ reference: "S", location: "Port", days: 2, started_on: "2026-13-01", provider_event_id: "x" }).ok, false);
  assert.equal(parseFreeTimeIngest({ reference: "S", location: "Port", days: 2, started_on: "2026-11-01" }).ok, false);
});

test("shipment timeline merges milestones, documents and confirmation newest first", () => {
  const timeline = portalTimeline(
    [{ id: "e1", title: "Sailed", event_time: "2026-11-01T09:00:00.000Z" }],
    [{ id: 9, filename: "packing-list.pdf", document_type: "packing_list", uploaded_at: "2026-11-02T09:00:00.000Z" }],
    { confirmed_at: "2026-11-03T09:00:00.000Z", received_by: "Site office" },
  );
  assert.deepEqual(timeline.map((entry) => entry.kind), ["confirmation", "document", "milestone"]);
  assert.equal(timeline[1].title, "packing-list.pdf");
  assert.equal(mergeTimeline(timeline).length, 3);
});

test("public tracking accepts a pasted link or token, never a shipment reference", () => {
  const token = "A".repeat(32);
  assert.equal(trackingTokenFromInput(token), token);
  assert.equal(trackingTokenFromInput(`https://kapileshworcargo.com.np/t/${token}`), token);
  assert.equal(trackingTokenFromInput(`https://kapileshworcargo.com.np/t/${token}?utm_source=email`), token);
  assert.equal(trackingTokenFromInput("KCPL-S-20261103-ABC123"), null);
  assert.equal(trackingTokenFromInput(`${token.slice(0, 31)}!`), null);
  assert.equal(trackingTokenFromInput(""), null);
});

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("new surfaces keep their authority boundaries in source", () => {
  const tender = source("app/admin/tenders/tms-tendering.server.ts");
  assert.match(tender, /respondToTmsTenderFromPartner/);
  assert.match(tender, /preflight\.tender\.partner_id !== partner\.partnerId/);
  assert.match(source("app/api/partner/tenders/[id]/respond/route.ts"), /partnerWriteRequest/);
  assert.match(source("app/api/integrations/free-time/route.ts"), /freeTimeMachineAuthorized/);
  assert.match(source("app/api/integrations/free-time/route.ts"), /applyCarrierFreeTime/);
  assert.match(source("app/api/quotes/route.ts"), /sanitizeQuoteAttribution/);
  assert.match(source("app/api/quotes/route.ts"), /attribution/);
  assert.match(source("app/portal/portal-document-intake.server.ts"), /documentReadingConfigured/);
  assert.match(source("app/portal/portal-document-intake.server.ts"), /readShipmentDocument/);
  assert.match(source("app/api/portal/invoices/[reference]/pay/route.ts"), /isTrustedSameOriginRequest/);
  assert.match(source("app/api/portal/invoices/[reference]/pay/route.ts"), /createPaymentIntent/);
  assert.match(source("app/admin/tenders/tms-tendering.server.ts"), /createPartnerNotification/);
  assert.match(source("app/partner/partner-tenders.server.ts"), /checkQuoteRateLimit/);
  assert.match(source("app/api/internal/automation/route.ts"), /dispatchTenderReminders/);
});
