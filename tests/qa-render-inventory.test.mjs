import assert from "node:assert/strict";
import test from "node:test";

import { detectGate, renderedClasses } from "../scripts/qa-render-inventory.mjs";

// scripts/qa-render-inventory.mjs is the evidence behind the "248 dead rules
// under .kcpl-ops-overview" finding, and that finding is the basis for deleting
// ~1,175 lines of admin CSS. A silent extraction miss would read as "dead", so
// the parser's behaviour is pinned rather than trusted.

test("renderedClasses reads class and className attributes", () => {
  const html = `<div class="kcpl-admin-shell another" id="x"><span className="app-nav-item-main">a</span></div>`;
  assert.deepEqual([...renderedClasses(html)].sort(), ["another", "app-nav-item-main", "kcpl-admin-shell"]);
});

test("renderedClasses keeps arbitrary-value utilities intact", () => {
  const html = `<div class="bg-[#091624] text-[#d4ad62] p-[13px]"></div>`;
  assert.deepEqual([...renderedClasses(html)].sort(), ["bg-[#091624]", "p-[13px]", "text-[#d4ad62]"]);
});

test("renderedClasses tolerates empty, quoted and single-token attributes", () => {
  assert.deepEqual([...renderedClasses(`<div class=""></div>`)], []);
  assert.deepEqual([...renderedClasses(`<div class="   "></div>`)], []);
  assert.deepEqual([...renderedClasses(`<div class="one"></div>`)], ["one"]);
  assert.deepEqual([...renderedClasses("<div></div>")], []);
});

// The streaming RSC payload repeats class strings inside <script> tags. Scanning
// attributes only is deliberate: it keeps the report about the DOM, and it must
// not be fooled by a payload copy that the DOM does not contain. This is the
// exact false-positive that would mask a genuinely dead selector.
test("renderedClasses does not treat the RSC payload as rendered markup", () => {
  const html =
    `<script>self.__next_f.push([1,"\\"className\\":\\"kcpl-ops-overview\\""])</script>` +
    `<div class="kcpl-admin-shell"></div>`;
  const classes = renderedClasses(html);
  assert.deepEqual([...classes], ["kcpl-admin-shell"]);
  assert.equal([...classes].some((token) => token.includes("kcpl-ops-overview")), false);
});

test("detectGate recognises the unauthenticated admin surfaces", () => {
  assert.equal(detectGate(`<main><h1>Sign in to KCPL Operations</h1></main>`), true);
  assert.equal(detectGate(`<div class="admin-login-form"></div>`), true);
  assert.equal(detectGate(`<div class="kcpl-admin-shell"><span>KCPL QA</span></div>`), false);
});
