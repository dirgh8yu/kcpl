import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders KCPL production content", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Nepal moves through us\./);
  assert.match(html, /The world opens/);
  assert.match(html, /Import into Nepal/);
  assert.match(html, /Export from Nepal/);
  assert.match(html, /Nepalgunj/);
  assert.match(html, /Surkhet/);
  assert.match(html, /Counterparts worldwide/i);
  assert.match(html, /Project Cargo/);
  assert.match(html, /Kapileshwor Cargo Pvt\. Ltd\./);
  assert.doesNotMatch(html, /KATHMANDU \/ NEPAL \/ LOGISTICS/);
  assert.doesNotMatch(html, /\[XX\]|to be confirmed|OIA Global/i);
});

test("server-renders confirmed Managing Director experience", async () => {
  const response = await render("/about");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Ramesh Mishra/);
  assert.match(html, /More than 25 years of experience in freight forwarding and logistics\./);
});

const serviceRoutes = [
  "air-freight",
  "sea-freight",
  "road-freight",
  "project-cargo",
  "break-bulk-cargo",
  "open-top-container",
  "warehousing",
  "packaging-storage",
  "ground-transport",
  "door-to-door",
  "customs-clearance",
];

test("server-renders every KCPL service route", async (t) => {
  for (const route of serviceRoutes) {
    await t.test(route, async () => {
      const response = await render(`/services/${route}`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /Service overview/);
      assert.match(html, /What KCPL coordinates/);
      assert.match(html, /Representative logistics imagery/);
      assert.doesNotMatch(html, /\[XX\]|to be confirmed|OIA Global/i);
    });
  }
});

test("renders launch metadata, FAQs, privacy and the live quote submission flow", async () => {
  const services = await render("/services");
  const servicesHtml = await services.text();
  assert.match(servicesHtml, /Logistics &amp; Freight Services \| Kapileshwor Cargo/);
  assert.match(servicesHtml, /Does KCPL coordinate both imports and exports\?/);

  const service = await render("/services/air-freight");
  const serviceHtml = await service.text();
  assert.match(serviceHtml, /BreadcrumbList/);
  assert.match(serviceHtml, /Air Freight Forwarding in Nepal \| Kapileshwor Cargo/);

  const quote = await render("/quote");
  const quoteHtml = await quote.text();
  assert.match(quoteHtml, /type="email"/);
  assert.match(quoteHtml, /Submit quote request/);
  assert.match(quoteHtml, /securely submitted to KCPL for review/i);
  assert.doesNotMatch(quoteHtml, /Your enquiry is not sent until you send the email\./);

  const privacy = await render("/privacy");
  assert.equal(privacy.status, 200);
  const privacyHtml = await privacy.text();
  assert.match(privacyHtml, /KCPL receives and stores the route, cargo and contact details/i);
  assert.match(privacyHtml, /authorised KCPL staff/i);
  assert.match(privacyHtml, /reference number/i);
});

test("keeps the KCPL operations dashboard closed until admin secrets are configured", async () => {
  const response = await render("/admin");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Admin login needs configuration\./);
  assert.doesNotMatch(html, /Freight enquiry desk/);
});

test("returns the branded not-found experience with a real 404 status", async () => {
  const response = await render("/missing-launch-audit-page");
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /This page has moved beyond the map\./);
  assert.match(html, /Return home/);
  assert.match(html, /noindex/);
});
