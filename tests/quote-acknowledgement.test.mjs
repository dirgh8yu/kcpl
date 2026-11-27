import assert from "node:assert/strict";
import test from "node:test";

import {
  KCPL_PUBLIC_CONTACT,
  formatReplyBy,
  quoteAcknowledgementChecklist,
  quoteAcknowledgementMessage,
  quoteModeLabel,
  replyByDate,
} from "../app/api/quotes/quote-acknowledgement-policy.ts";

// The acknowledgement is the first thing a customer receives after an enquiry, so
// what matters is that it names the reference, promises only a working day KCPL
// actually keeps, asks for the documents a quote needs, and never leaks an
// unescaped value from the public form into the email body.

const base = {
  reference: "KC-7F3A2B",
  contactName: "Sita Sharma",
  contactEmail: "sita@example.com",
  origin: "Shanghai",
  destination: "Birgunj",
  mode: "sea",
  cargoType: "FCL 40HQ",
};

// KCPL works Sunday to Friday, so Saturday is the only day that cannot be a
// reply-by date. 2026-11-26 is a Thursday, 27 Friday, 28 Saturday, 29 Sunday.
const thursday = new Date("2026-11-26T10:00:00+05:45");
const friday = new Date("2026-11-27T10:00:00+05:45");
const saturday = new Date("2026-11-28T10:00:00+05:45");

test("reply-by skips Saturday and stays within the working week", () => {
  assert.equal(formatReplyBy(thursday), "Friday, 27 November 2026");
  assert.equal(formatReplyBy(friday), "Sunday, 29 November 2026");
  assert.equal(formatReplyBy(saturday), "Sunday, 29 November 2026");
});

test("reply-by never lands on a Saturday", () => {
  const start = new Date("2026-11-01T09:00:00+05:45");
  for (let offset = 0; offset < 60; offset += 1) {
    const now = new Date(start.getTime() + offset * 24 * 60 * 60 * 1000);
    const weekday = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      timeZone: "Asia/Kathmandu",
    }).format(replyByDate(now));
    assert.notEqual(weekday, "Saturday", `offset ${offset} produced a Saturday reply-by`);
  }
});

test("the email names the reference, route and mode", () => {
  const message = quoteAcknowledgementMessage(base, friday);
  assert.match(message.subject, /KC-7F3A2B/);
  assert.match(message.subject, /Shanghai to Birgunj/);
  assert.match(message.text, /KC-7F3A2B/);
  assert.match(message.text, /Shanghai/);
  assert.match(message.text, /Birgunj/);
  assert.match(message.text, /sea freight/i);
  assert.match(message.text, /Sunday, 29 November 2026/);
  assert.match(message.text, /Sita/);
});

test("the document checklist is complete and present in both bodies", () => {
  const message = quoteAcknowledgementMessage(base, friday);
  assert.equal(quoteAcknowledgementChecklist.length, 8);
  for (const item of quoteAcknowledgementChecklist) {
    assert.ok(message.text.includes(item), `text is missing: ${item}`);
    assert.ok(message.html.includes(item.replaceAll("&", "&amp;")), `html is missing: ${item}`);
  }
});

test("the acknowledgement never promises a price or a clearance outcome", () => {
  const message = quoteAcknowledgementMessage(base, friday);
  const body = `${message.subject}\n${message.text}\n${message.html}`.toLowerCase();
  for (const forbidden of ["usd", "npr", "guarantee", "guaranteed", "clearance will", "total price"]) {
    assert.ok(!body.includes(forbidden), `body should not contain "${forbidden}"`);
  }
});

test("customer-supplied values are escaped in the HTML body", () => {
  const message = quoteAcknowledgementMessage(
    {
      ...base,
      origin: "<script>alert(1)</script>",
      cargoType: "Steel & <b>coils</b>",
      contactName: "<img src=x onerror=alert(1)>",
    },
    friday,
  );
  assert.ok(!message.html.includes("<script>alert(1)</script>"));
  assert.ok(!message.html.includes("<img src=x"));
  assert.ok(!message.html.includes("<b>coils</b>"));
  assert.ok(message.html.includes("&lt;script&gt;"));
  assert.ok(message.html.includes("Steel &amp;"));
});

test("mode labels and contact details come from one source", () => {
  assert.equal(quoteModeLabel("air"), "Air freight");
  assert.equal(quoteModeLabel("unsure"), "Mode to be confirmed");
  assert.equal(quoteModeLabel(""), "Mode to be confirmed");
  assert.equal(quoteModeLabel("Sea"), "Sea freight");
  const message = quoteAcknowledgementMessage(base, friday);
  assert.ok(message.text.includes(KCPL_PUBLIC_CONTACT.phone));
  assert.ok(message.text.includes(KCPL_PUBLIC_CONTACT.email));
});
