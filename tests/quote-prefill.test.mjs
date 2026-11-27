import assert from "node:assert/strict";
import test from "node:test";
import { quotePrefillRoute } from "../app/components/quote-prefill.ts";
import { quoteCopy } from "../app/components/quote-copy.ts";

/* A lane page hands the form a corridor. The form has to say which corridor and
 * mode it prefilled, and still has to say it in every locale the site serves. */

const locales = ["en", "ne", "hi", "zh"];

test("a lane link's route is read back as the prefilled corridor", () => {
  assert.deepEqual(
    quotePrefillRoute({ origin: "Kathmandu", destination: "Lhasa", mode: "road", source: "lane", from: "/en/lanes/nepal-to-tibet" }),
    { origin: "Kathmandu", destination: "Lhasa", mode: "road" },
  );
});

test("no corridor is announced when the link did not name both cities", () => {
  assert.equal(quotePrefillRoute({ source: "lane", from: "/en/lanes" }), null);
  assert.equal(quotePrefillRoute({ origin: "Kathmandu", source: "lane" }), null);
  assert.equal(quotePrefillRoute({ origin: "  ", destination: "Lhasa" }), null);
  assert.equal(quotePrefillRoute({}), null);
});

test("an unknown mode is announced as unsure rather than dropped", () => {
  assert.equal(quotePrefillRoute({ origin: "Kathmandu", destination: "Lhasa", mode: "drone" })?.mode, "unsure");
  assert.equal(quotePrefillRoute({ origin: "Kathmandu", destination: "Lhasa" })?.mode, "unsure");
});

test("every locale announces the prefilled corridor and repeats it on confirmation", () => {
  for (const locale of locales) {
    const copy = quoteCopy[locale];
    const notice = copy.prefillNotice("Kathmandu", "Lhasa", copy.road);
    assert.ok(notice.includes("Kathmandu") && notice.includes("Lhasa"), `${locale}: notice names both cities`);
    assert.ok(notice.includes(copy.road), `${locale}: notice names the mode`);
    const confirmation = copy.receivedRoute("Kathmandu", "Lhasa", copy.road);
    assert.ok(confirmation.includes("Kathmandu") && confirmation.includes("Lhasa"), `${locale}: confirmation names both cities`);
    assert.ok(confirmation.includes(copy.road), `${locale}: confirmation names the mode`);
  }
});
