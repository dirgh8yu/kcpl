import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { telHref, whatsappHref } from "../app/contact-links.ts";

test("tap-to-call dials the number without its punctuation", () => {
  assert.equal(telHref("+977-1-4987510"), "tel:+97714987510");
  assert.equal(telHref("+977 1 498 7510"), "tel:+97714987510");
});

test("WhatsApp stays hidden until KCPL has a number for it", () => {
  assert.equal(whatsappHref("", "Hello"), null);
  assert.equal(whatsappHref("12345", "Hello"), null, "too short to be an international number");
  assert.equal(whatsappHref("+977 980-0000000", "Hello KCPL, I need a quote."), "https://wa.me/9779800000000?text=Hello%20KCPL%2C%20I%20need%20a%20quote.");
});

test("the call and WhatsApp buttons are wired to those helpers, and WhatsApp only renders with a link", () => {
  const chrome = readFileSync(new URL("../app/components/site-chrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /whatsappHref\(company\.whatsapp,/);
  assert.match(chrome, /\{whatsapp \? \(/, "the WhatsApp button must be conditional on a valid link");
  assert.match(chrome, /href=\{telHref\(company\.phones\[0\]\)\}/);
  assert.match(chrome, /path === "\/quote" \? null/, "the quote page does not offer itself");
});
