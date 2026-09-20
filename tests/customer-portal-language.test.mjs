import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  portalLocaleLabels,
  portalLocaleTags,
  portalLocaleValue,
  portalLocales,
  portalText,
  portalTranslator,
} from "../app/portal/portal-i18n.ts";
import {
  portalDocumentLabel,
  portalInvoiceStatusLabel,
  portalModeLabel,
  portalStatusLabel,
} from "../app/portal/portal-format.ts";
import { freeTimeSummary } from "../app/shipment-free-time.ts";
import {
  portalDocumentReleaseMessage,
  portalFreeTimeMessage,
  portalMilestoneMessage,
} from "../app/portal/portal-notifications.ts";

const repo = (path) => new URL(`../${path}`, import.meta.url);

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const devanagari = /[ऀ-ॿ]/;

/* ------------------------------------------------------------------ *
 * The dictionary itself
 * ------------------------------------------------------------------ */

test("an unknown or absent language resolves to English, never to nothing", () => {
  assert.equal(portalLocaleValue("ne"), "ne");
  assert.equal(portalLocaleValue("en"), "en");
  for (const value of [null, undefined, "", "fr", "NE", 7, {}]) {
    assert.equal(portalLocaleValue(value), "en", String(value));
  }
});

test("every locale carries a label and a BCP 47 tag", () => {
  for (const locale of portalLocales) {
    assert.ok(portalLocaleLabels[locale]?.length, locale);
    assert.ok(portalLocaleTags[locale]?.length, locale);
  }
  // The Nepali option names itself in Devanagari, so a reader who does not
  // know the English word for their language still recognises it.
  assert.match(portalLocaleLabels.ne, devanagari);
});

test("placeholders are substituted, not concatenated", () => {
  // Nepali does not put the number where English does, so each language owns
  // its whole sentence and fills the value in at its own position.
  const english = portalText("en", "fts.days_at", { days: 3, location: "Birgunj" });
  const nepali = portalText("ne", "fts.days_at", { days: 3, location: "Birgunj" });
  assert.ok(english.includes("3") && english.includes("Birgunj"));
  assert.ok(nepali.includes("3") && nepali.includes("Birgunj"));
  assert.notEqual(english, nepali);
  assert.doesNotMatch(english, /\{days\}|\{location\}/);
  assert.doesNotMatch(nepali, /\{days\}|\{location\}/);
});

test("a placeholder with no value is left alone rather than printed as undefined", () => {
  const text = portalText("en", "fts.days_at", { days: 3 });
  assert.doesNotMatch(text, /undefined/);
  assert.match(text, /\{location\}/);
});

test("a bound translator is the same function by another name", () => {
  const t = portalTranslator("ne");
  assert.equal(t("chrome.overview"), portalText("ne", "chrome.overview"));
});

test("every Nepali string is actually Nepali", async () => {
  // The completeness of the dictionary is a compile error, not a test: `ne` is
  // typed against `en`. What a type cannot catch is a key copied across
  // untranslated, which is what this checks.
  const source = await readFile(repo("app/portal/portal-i18n.ts"), "utf8");
  const nepaliBlock = source.slice(source.indexOf("const ne: Record<PortalTextKey, string>"));
  const entries = [...nepaliBlock.matchAll(/^\s{2}"([\w.]+)":\s*"([^"]*)",$/gm)];
  assert.ok(entries.length > 150, `expected a full dictionary, found ${entries.length}`);

  // A handful of entries are legitimately not Devanagari: an em dash, a Latin
  // placeholder address, and the language's own English name.
  const exempt = new Set(["common.none", "team.email_placeholder", "req.weight_placeholder"]);
  const untranslated = entries
    .filter(([, key]) => !exempt.has(key))
    .filter(([, , value]) => !devanagari.test(value))
    .map(([, key]) => key);
  assert.deepEqual(untranslated, [], `keys left in English: ${untranslated.join(", ")}`);
});

test("English and Nepali never render the same sentence for a translated key", () => {
  for (const key of ["chrome.overview", "status.in_transit", "settings.title", "mail.status_delivered"]) {
    assert.notEqual(portalText("en", key), portalText("ne", key), key);
  }
});

/* ------------------------------------------------------------------ *
 * Domain vocabulary
 * ------------------------------------------------------------------ */

test("labels default to English so no staff surface changes", () => {
  assert.equal(portalStatusLabel("in_transit"), "In transit");
  assert.equal(portalModeLabel("sea"), "Sea freight");
  assert.equal(portalDocumentLabel("bill_of_lading"), "Bill of lading (BL)");
  assert.equal(portalInvoiceStatusLabel("paid"), "Paid");
});

test("the same labels come back in Nepali when a reader is known", () => {
  assert.match(portalStatusLabel("in_transit", "ne"), devanagari);
  assert.match(portalModeLabel("sea", "ne"), devanagari);
  assert.match(portalDocumentLabel("bill_of_lading", "ne"), devanagari);
  assert.match(portalInvoiceStatusLabel("paid", "ne"), devanagari);
});

test("an unrecognised value still reads as a label, never as a dictionary key", () => {
  for (const locale of portalLocales) {
    for (const label of [
      portalStatusLabel("no_such_status", locale),
      portalModeLabel("teleport", locale),
      portalDocumentLabel("no_such_document", locale),
      portalInvoiceStatusLabel("no_such_status", locale),
    ]) {
      assert.doesNotMatch(label, /^(status|mode|doc|invoice)\./, label);
      assert.ok(label.length > 0);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Free time reads as a sentence in both languages
 * ------------------------------------------------------------------ */

const freeTime = (location) => ({
  location,
  days: 5,
  started_on: "2026-09-01",
  daily_charge: null,
  charge_currency: null,
  bearer: "undecided",
  note: null,
  updated_at: null,
  updated_by: null,
});

test("the free-time sentence names the place in each language's own word order", () => {
  const status = { state: "expired", deadline: "2026-09-05", daysRemaining: 0, daysOverdue: 3, projectedCharge: null };
  const english = freeTimeSummary(freeTime("Birgunj"), status, "en");
  const nepali = freeTimeSummary(freeTime("Birgunj"), status, "ne");

  assert.match(english, /^Free time at Birgunj/);
  // Nepali places the location first; an English-ordered sentence with a
  // glued-on " at Birgunj" would be the bug this pair of templates prevents.
  assert.match(nepali, /^Birgunj/);
  assert.match(nepali, devanagari);
});

test("a free-time sentence without a location is still a whole sentence", () => {
  const status = { state: "last_day", deadline: "2026-09-05", daysRemaining: 0, daysOverdue: 0, projectedCharge: null };
  for (const locale of portalLocales) {
    const summary = freeTimeSummary(freeTime(null), status, locale);
    assert.doesNotMatch(summary, /\{location\}/, locale);
    assert.doesNotMatch(summary, /\s{2}|\snull|undefined/, locale);
  }
});

test("free time still speaks English by default", () => {
  const status = { state: "last_day", deadline: "2026-09-05", daysRemaining: 0, daysOverdue: 0, projectedCharge: null };
  assert.equal(freeTimeSummary(freeTime(null), status), "Today is the last free day.");
});

/* ------------------------------------------------------------------ *
 * Emails follow the reader, and still redact
 * ------------------------------------------------------------------ */

const milestone = {
  reference: "KCPL-S-1",
  status: "in_transit",
  mode: "sea",
  origin: "Shanghai",
  destination: "Birgunj",
  eta: "2026-10-01T00:00:00.000Z",
  currentLocation: "Kolkata",
  customerName: "Acme Traders",
  portalUrl: "https://example.test/portal/shipments/KCPL-S-1",
};

test("a milestone email is written in the recipient's language", () => {
  const english = portalMilestoneMessage(milestone);
  const nepali = portalMilestoneMessage(milestone, "ne");
  assert.doesNotMatch(english.text, devanagari);
  assert.match(nepali.text, devanagari);
  assert.match(nepali.html, devanagari);
  // Operational data is never translated: the reference, the route and the
  // link are records, and rewriting them would misreport what KCPL holds.
  for (const message of [english, nepali]) {
    assert.ok(message.text.includes("KCPL-S-1"));
    assert.ok(message.text.includes("Shanghai → Birgunj"));
    assert.ok(message.text.includes(milestone.portalUrl));
  }
});

test("a document-release email is written in the recipient's language", () => {
  const facts = {
    reference: "KCPL-S-1",
    documentType: "bill_of_lading",
    filename: "bl.pdf",
    origin: "Shanghai",
    destination: "Birgunj",
    customerName: "Acme Traders",
    portalUrl: "https://example.test/portal",
  };
  const nepali = portalDocumentReleaseMessage(facts, "ne");
  assert.match(nepali.subject, devanagari);
  assert.match(nepali.text, devanagari);
  // `toLowerCase()` on a Devanagari label is a no-op; the Nepali body must not
  // depend on it to read correctly.
  assert.ok(!nepali.text.includes("undefined"));
});

test("a free-time email keeps its language and still names no charge", () => {
  const facts = {
    reference: "KCPL-S-1",
    origin: "Shanghai",
    destination: "Birgunj",
    location: "Birgunj ICD",
    daysRemaining: 1,
    deadline: "2026-09-20",
    customerName: "Acme Traders",
    portalUrl: "https://example.test/portal",
  };
  const nepali = portalFreeTimeMessage(facts, "ne");
  assert.match(nepali.text, devanagari);
  assert.ok(nepali.text.includes("Birgunj ICD"));
  // The rate KCPL records is a carrier quote, not an invoice. Translating the
  // warning must not have smuggled a number into it.
  assert.doesNotMatch(nepali.text, /\b\d+(\.\d+)?\s*(per day|USD|NPR|INR)\b/i);
});

test("emails still default to English for a caller with no reader", () => {
  assert.doesNotMatch(portalMilestoneMessage(milestone).text, devanagari);
});

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

test("the language lives on the account, because the sweep has no browser", async () => {
  const accounts = code(await readFile(repo("app/portal/portal-accounts.server.ts"), "utf8"));
  assert.match(accounts, /locale: portalLocaleValue\(locale\)/);
  const sweep = code(await readFile(repo("app/portal/portal-notifications.server.ts"), "utf8"));
  assert.match(sweep, /locale: portalLocaleValue\(data\.locale\)/);
  // Every one of the three message builders is handed the recipient's language.
  assert.equal((sweep.match(/\}, account\.locale\)/g) ?? []).length, 3);
});

test("a customer can only ever change their own language", async () => {
  const route = code(await readFile(repo("app/api/portal/locale/route.ts"), "utf8"));
  assert.match(route, /savePortalLocale\(access\.session\.email/);
  assert.doesNotMatch(route, /body\.email|body\.customerId/);
  assert.match(route, /isTrustedSameOriginRequest/);
  // An unknown language is refused rather than written and silently ignored.
  assert.match(route, /portalLocales\.includes/);
});

test("the shell declares the language to the browser", async () => {
  const shell = await readFile(repo("app/portal/portal-shell.tsx"), "utf8");
  assert.match(shell, /lang=\{portalLocaleTags\[session\.locale\]\}/);
  assert.match(shell, /data-locale=\{session\.locale\}/);
});

test("the sign-in page stays English, because nobody has identified themselves yet", async () => {
  const login = await readFile(repo("app/portal/portal-login.tsx"), "utf8");
  assert.doesNotMatch(login, /portal-i18n/);
  assert.doesNotMatch(login, devanagari);
});

test("dates stay Gregorian in both languages", async () => {
  const format = code(await readFile(repo("app/portal/portal-format.ts"), "utf8"));
  // Every carrier document, customs entry and invoice the portal reports on is
  // dated Gregorian. Converting to Bikram Sambat would stop the portal
  // matching the paperwork in the reader's hand.
  assert.doesNotMatch(format, /bikram|nepali-calendar|ne-NP-u-ca/i);
  assert.match(format, /new Intl\.DateTimeFormat\("en-GB"/);
});
