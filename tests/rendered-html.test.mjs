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
  assert.doesNotMatch(html, /\[XX\]|to be confirmed|OIA Global/i);
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
