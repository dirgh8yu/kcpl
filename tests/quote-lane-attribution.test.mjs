import assert from "node:assert/strict";
import test from "node:test";

import {
  captureQuoteAttribution,
  lanePagePath,
  quoteAttributionGroupKey,
  quoteAttributionLabel,
  sanitizeQuoteAttribution,
} from "../app/quote-attribution.ts";
import { buildQuoteRecord } from "../app/api/quotes/quote-record.ts";
import { buildAttributionReport } from "../app/admin/attribution/attribution.ts";
import { laneFor, laneSlugs, laneCopy } from "../app/lane-data.ts";

const locales = ["en", "ne", "hi", "zh"];
const prefixFor = (locale) => (locale === "en" ? "" : `/${locale}`);

/** The query a lane page's closing CTA builds, without importing the JSX. */
function laneQuery(locale, slug) {
  const lane = laneFor(locale, slug);
  const params = new URLSearchParams({
    origin: lane.origin,
    destination: lane.destination,
    mode: lane.mode,
    source: "lane",
    from: `${prefixFor(locale)}/lanes/${slug}`,
  });
  return { search: `?${params.toString()}`, pathname: `${prefixFor(locale)}/quote` };
}

const quote = {
  origin: "Kolkata",
  destination: "Birgunj",
  mode: "sea",
  cargoType: "",
  weight: "",
  weightUnit: "kg",
  length: "",
  width: "",
  height: "",
  dimensionUnit: "cm",
  timing: "",
  requirements: "",
  contactName: "Test Enquirer",
  contactEmail: "test@example.com",
  companyName: "",
  phone: "",
};

test("every lane carries prefilled route values in its own language", () => {
  for (const locale of locales) {
    for (const slug of laneSlugs) {
      const lane = laneFor(locale, slug);
      assert.ok(lane.origin.trim(), `${locale}/${slug} origin`);
      assert.ok(lane.destination.trim(), `${locale}/${slug} destination`);
      assert.ok(["air", "sea", "road"].includes(lane.mode), `${locale}/${slug} mode`);
      assert.notEqual(lane.origin, lane.destination, `${locale}/${slug} must go somewhere`);
    }
  }
  // A Nepali reader is not handed English city names.
  assert.match(laneCopy.ne["kolkata-to-birgunj"].origin, /[\u0900-\u097F]/);
  assert.match(laneCopy.hi["nepal-to-tibet"].destination, /[\u0900-\u097F]/);
  assert.match(laneCopy.zh["haldia-to-kathmandu"].origin, /[\u4e00-\u9fff]/);
  assert.notEqual(laneFor("ne", "kolkata-to-birgunj").origin, laneFor("en", "kolkata-to-birgunj").origin);
});

test("a lane CTA handoff records the lane page and the locale", () => {
  for (const locale of locales) {
    for (const slug of laneSlugs) {
      const { search, pathname } = laneQuery(locale, slug);
      const attribution = captureQuoteAttribution({ search, referrer: "", pathname });
      assert.equal(attribution.source, "lane", `${locale}/${slug} source`);
      assert.equal(attribution.lane_path, `${prefixFor(locale)}/lanes/${slug}`, `${locale}/${slug} lane`);
      assert.equal(attribution.landing_path, `${prefixFor(locale)}/quote`, `${locale}/${slug} landing`);
    }
  }
});

test("the lane index hands off the locale without inventing a corridor", () => {
  for (const locale of locales) {
    const attribution = captureQuoteAttribution({
      search: `?source=lane&from=${encodeURIComponent(`${prefixFor(locale)}/lanes`)}`,
      referrer: "",
      pathname: `${prefixFor(locale)}/quote`,
    });
    assert.equal(attribution.source, "lane", locale);
    assert.equal(attribution.lane_path, `${prefixFor(locale)}/lanes`, locale);
  }
});

test("entry points that are not a lane carry no lane path", () => {
  const direct = captureQuoteAttribution({ search: "", referrer: "", pathname: "/quote" });
  assert.equal(direct.source, "direct");
  assert.equal(direct.lane_path, null);

  const fromServices = captureQuoteAttribution({
    search: "",
    referrer: "https://kapileshworcargo.com.np/services/ocean-freight",
    pathname: "/ne/quote",
  });
  assert.equal(fromServices.source, "kapileshworcargo.com.np");
  assert.equal(fromServices.landing_path, "/ne/quote");
  assert.equal(fromServices.lane_path, null);

  const campaign = captureQuoteAttribution({
    search: "?utm_source=newsletter&utm_medium=email&utm_campaign=nov",
    referrer: "",
    pathname: "/quote",
  });
  assert.equal(campaign.source, "newsletter");
  assert.equal(campaign.medium, "email");
  assert.equal(campaign.campaign, "nov");
  assert.equal(campaign.lane_path, null);

  // The lane-less key is byte-identical to the pre-change key, so existing
  // rollups do not split.
  assert.equal(quoteAttributionGroupKey(captureQuoteAttribution({ search: "", referrer: "", pathname: "/quote" })), "direct|none|none|none");
});

test("a crafted from= cannot become a lane or an off-site URL", () => {
  for (const hostile of ["//evil.example/lanes/x", "javascript:alert(1)", "https://evil.example/lanes/x", "/lanes/../../admin", "/lanes/../quote"]) {
    const attribution = captureQuoteAttribution({ search: `?from=${encodeURIComponent(hostile)}`, referrer: "", pathname: "/quote" });
    assert.equal(attribution.lane_path, null, hostile);
  }
  // A query or fragment is dropped, not carried into the stored path.
  const withQuery = captureQuoteAttribution({ search: `?from=${encodeURIComponent("/lanes?utm_source=x")}`, referrer: "", pathname: "/quote" });
  assert.equal(withQuery.lane_path, "/lanes");
  assert.equal(sanitizeQuoteAttribution({ source: "lane", lane_path: "/lanes/kolkata-to-birgunj" }).lane_path, "/lanes/kolkata-to-birgunj");
  assert.equal(sanitizeQuoteAttribution({ source: "lane", lane_path: "https://evil.example/x" }).lane_path, null);
  assert.equal(lanePagePath("/ZH/Lanes/Nepal-To-Tibet/"), "/zh/lanes/nepal-to-tibet");
});

test("the stored quote document carries the lane that produced it", () => {
  const { search, pathname } = laneQuery("ne", "nepal-to-tibet");
  const attribution = sanitizeQuoteAttribution(captureQuoteAttribution({ search, referrer: "", pathname }));
  const record = buildQuoteRecord({
    reference: "KCPL-Q-20261127-TEST0001",
    createdAt: "2026-11-27T10:00:00.000Z",
    quote,
    attribution,
    crmMatches: [],
  });

  assert.equal(record.attribution.source, "lane");
  assert.equal(record.attribution.lane_path, "/ne/lanes/nepal-to-tibet");
  assert.equal(record.attribution.landing_path, "/ne/quote");
  assert.equal(record.status, "new");
  assert.equal(record.contact_email, "test@example.com");

  // The enquiry keeps the words the visitor typed, and carries the English
  // corridor beside them, so a staff filter for "Kathmandu" finds it.
  assert.equal(record.origin, quote.origin);
  assert.equal(record.destination, quote.destination);
  assert.equal(record.lane_slug, "nepal-to-tibet");
  assert.equal(record.lane_origin, "Kathmandu");
  assert.equal(record.lane_destination, "Lhasa");

  // A direct visit stores a record of the same shape with no lane on it.
  const directAttribution = sanitizeQuoteAttribution(captureQuoteAttribution({ search: "", referrer: "", pathname: "/quote" }));
  const directRecord = buildQuoteRecord({
    reference: "KCPL-Q-20261127-TEST0002",
    createdAt: "2026-11-27T10:05:00.000Z",
    quote,
    attribution: directAttribution,
    crmMatches: [],
  });
  assert.equal(directRecord.attribution.lane_path, null);
  assert.equal(directRecord.lane_slug, null);
  assert.equal(directRecord.lane_origin, null);
  assert.equal(directRecord.lane_destination, null);
  assert.deepEqual(Object.keys(directRecord).sort(), Object.keys(record).sort());
});

test("the lane index names no corridor, and CRM matching is untouched", () => {
  const indexAttribution = sanitizeQuoteAttribution(captureQuoteAttribution({
    search: `?source=lane&from=${encodeURIComponent("/zh/lanes")}`,
    referrer: "",
    pathname: "/zh/quote",
  }));
  assert.equal(indexAttribution.lane_path, "/zh/lanes");

  const record = buildQuoteRecord({
    reference: "KCPL-Q-20261127-TEST0003",
    createdAt: "2026-11-27T10:10:00.000Z",
    quote,
    attribution: indexAttribution,
    crmMatches: [{ id: "crm-1", display_name: "Example Customer", reason: "email" }],
  });
  assert.equal(record.lane_slug, null, "the index has no corridor of its own");
  assert.equal(record.lane_origin, null);
  assert.equal(record.lane_destination, null);
  // Dedupe output is still written exactly as before.
  assert.equal(record.crm_match_state, "suggested");
  assert.deepEqual(record.crm_match_ids, ["crm-1"]);
});

test("the attribution report counts each lane separately from direct submissions", () => {
  const record = (reference, search, pathname) => ({
    data: buildQuoteRecord({
      reference,
      createdAt: "2026-11-27T10:00:00.000Z",
      quote,
      attribution: sanitizeQuoteAttribution(captureQuoteAttribution({ search, referrer: "", pathname })),
      crmMatches: [],
    }),
  });

  const birgunj = laneQuery("en", "kolkata-to-birgunj").search;
  const tibet = laneQuery("zh", "nepal-to-tibet").search;
  const report = buildAttributionReport([
    record("KCPL-Q-1", birgunj, "/quote"),
    record("KCPL-Q-2", tibet, "/zh/quote"),
    record("KCPL-Q-3", "", "/quote"),
    record("KCPL-Q-4", "", "/quote"),
  ]);

  assert.equal(report.total, 4);
  assert.equal(report.rows.length, 3, "two lanes and one direct row");
  const laneRows = report.rows.filter((row) => row.source === "lane");
  assert.equal(laneRows.length, 2);
  assert.deepEqual(laneRows.map((row) => row.lane_path).sort(), ["/lanes/kolkata-to-birgunj", "/zh/lanes/nepal-to-tibet"]);
  assert.ok(laneRows.some((row) => quoteAttributionLabel(row).includes("/zh/lanes/nepal-to-tibet")));
  const direct = report.rows.find((row) => row.source === "direct");
  assert.equal(direct.enquiries, 2);
  assert.equal(quoteAttributionLabel(direct), "direct");
  assert.notEqual(
    quoteAttributionGroupKey({ source: "lane", medium: null, campaign: null, tool: null, referrer_host: null, landing_path: "/quote", lane_path: "/lanes/nepal-to-tibet" }),
    "lane|none|none|none",
  );
});
