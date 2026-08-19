import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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
  assert.match(html, /NEPAL/);
  assert.match(html, /THE WORLD/);
  assert.match(html, /Import into Nepal/);
  assert.match(html, /Export from Nepal/);
  assert.match(html, /Nepalgunj/);
  assert.match(html, /Surkhet/);
  assert.match(html, /Counterparts worldwide/i);
  assert.match(html, /Project Cargo/);
  assert.match(html, /Kapileshwor Cargo Pvt\. Ltd\./);
  assert.doesNotMatch(html, /\[XX\]|to be confirmed|OIA Global/i);
});
