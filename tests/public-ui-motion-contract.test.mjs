import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const globals = readFileSync(`${root}/app/globals.css`, "utf8");

// The public sheet is one flat file of single-line rules, so a tiny block reader is
// enough. Bodies keep source order, which is the order the cascade uses.
function bodiesFor(source, selector) {
  const bodies = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectorList]) => selectorList.split(",").some((part) => part.trim() === selector))
    .map(([, , body]) => body);
  assert.ok(bodies.length > 0, `missing rule for selector ${selector}`);
  return bodies;
}

function declaration(body, property) {
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i").exec(body);
  return match ? match[1].trim() : null;
}

// Last declaration across every rule for the selector, i.e. the winning value.
function effective(source, selector, property) {
  const values = bodiesFor(source, selector).map((body) => declaration(body, property)).filter((value) => value !== null);
  assert.ok(values.length > 0, `no ${property} declaration for ${selector}`);
  return values.at(-1);
}

function declares(source, selector, property, expected) {
  return bodiesFor(source, selector).some((body) => declaration(body, property) === expected);
}

function px(value) {
  const parsed = Number.parseFloat(value ?? "");
  assert.ok(Number.isFinite(parsed), `expected a pixel value, received ${JSON.stringify(value)}`);
  return parsed;
}

function scaleOf(transform) {
  return px(/scale\(([\d.]+)\)/.exec(transform ?? "")?.[1]);
}

// #1 - the whole point of the public motion wave: nothing on the public site animates a
// property that forces layout. `stroke-width` and `border-width` are excluded because
// they paint a stroke on an already-fixed-size element instead of moving siblings.
test("no public transition animates a layout property", () => {
  const layoutProperty = /(?<![-\w])(width|height|font-size|left|right|top|bottom|margin|padding)\b/;
  const offenders = [...globals.matchAll(/transition\s*:[^;}]*/g)]
    .map((match) => match[0].trim())
    .filter((value) => layoutProperty.test(value));
  assert.deepEqual(offenders, [], `layout-property transition(s) found:\n${offenders.join("\n")}`);
});

// #2 - the map markers used to grow by animating height/width, which also grew the
// rendered stroke. They now scale, so the stroke width has to be pre-divided by the scale
// to look identical at rest, on hover and on keyboard focus. 18px/28px and 8px/12px are
// the pre-scale diameters this compensation was derived from.
test("map marker scaling compensates its stroke so the border looks unchanged", () => {
  const ringResting = px(effective(globals, ".satellite-marker-ring", "border"));
  const ringScale = scaleOf(effective(globals, ".satellite-marker.is-active .satellite-marker-ring", "transform"));
  const ringStroke = px(effective(globals, ".satellite-marker.is-active .satellite-marker-ring", "border-width"));
  assert.ok(Math.abs(ringScale - 28 / 18) < 0.0001, `ring scale ${ringScale} drifted from the 28px/18px geometry`);
  assert.ok(
    Math.abs(ringScale * ringStroke - ringResting) < 0.005,
    `ring stroke renders at ${(ringScale * ringStroke).toFixed(4)}px instead of ${ringResting}px`,
  );

  const coreResting = px(effective(globals, ".satellite-marker-core", "border"));
  const coreScale = scaleOf(effective(globals, ".satellite-marker.is-active .satellite-marker-core", "transform"));
  const coreStroke = px(effective(globals, ".satellite-marker.is-active .satellite-marker-core", "border-width"));
  assert.ok(Math.abs(coreScale - 12 / 8) < 0.0001, `core scale ${coreScale} drifted from the 12px/8px geometry`);
  assert.ok(
    Math.abs(coreScale * coreStroke - coreResting) < 0.005,
    `core stroke renders at ${(coreScale * coreStroke).toFixed(4)}px instead of ${coreResting}px`,
  );

  // The focus ring was a 2px stroke before it gained a scale transform.
  const focusStroke = px(effective(globals, ".satellite-marker:focus-visible .satellite-marker-ring", "border-width"));
  assert.ok(
    Math.abs(ringScale * focusStroke - 2) < 0.005,
    `focus ring stroke renders at ${(ringScale * focusStroke).toFixed(4)}px instead of 2px`,
  );
});

// #3 - the journey dot and the quote flight plane travel on a full-bleed overlay track so
// the motion is a transform, not an animated `left`/`bottom`. The track has to stay
// transparent to pointer events so it cannot swallow clicks on the stage beneath it.
test("journey and quote moving points travel on a full-bleed compositor track", () => {
  for (const selector of [".journey-moving-point-track", ".quote-flight-plane-track"]) {
    assert.ok(declares(globals, selector, "position", "absolute"), `${selector} must be absolutely positioned`);
    assert.ok(declares(globals, selector, "inset", "0"), `${selector} must span its containing block`);
    assert.ok(declares(globals, selector, "pointer-events", "none"), `${selector} must not capture pointer events`);
  }
  // The moving points keep their own centring transform and no animated offsets.
  assert.match(effective(globals, ".journey-moving-point", "transform"), /translateX\(-100%\)/);
  assert.equal(bodiesFor(globals, ".journey-moving-point").some((body) => declaration(body, "left") !== null), false);
  assert.match(effective(globals, ".quote-flight-plane", "transform"), /translate\(-50%,\s*50%\)/);
});

// #4 - the blanket reduced-motion reset is single-class specificity, so the two-class
// hover rules added by this wave would keep animating without their own carve-out.
test("reduced motion neutralises the public hover lift", () => {
  assert.match(globals, /\*\{[^}]*transition-duration:\.01ms!important/, "blanket reduced-motion reset is missing");
  assert.match(
    globals,
    /@media\s*\(prefers-reduced-motion:reduce\)\s*\{\s*\.why-stage:hover\s*\{\s*transform:none;?\s*\}\s*\}/,
    "the .why-stage hover lift needs its own reduced-motion carve-out",
  );
});
