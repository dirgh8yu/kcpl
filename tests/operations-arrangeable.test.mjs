import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LAYOUT_PRESETS,
  OVERVIEW_SECTION_ORDER,
  WORKSPACE_PRESETS,
  WORKSPACE_SECTIONS,
  isDefaultArrangement,
  isDefaultArrangementFor,
  moveSection,
  normalizeArrangement,
  normalizeArrangementFor,
  normalizeSavedLayouts,
  parseSectionDndId,
  presetForState,
  presetForStateIn,
  savedLayoutForState,
  sectionDndId,
} from "../app/admin/operations-arrangeable.ts";

test("normalizeArrangement falls back to the default order for empty input", () => {
  const state = normalizeArrangement(null);
  assert.deepEqual(state.order, [...OVERVIEW_SECTION_ORDER]);
  assert.deepEqual(state.hidden, []);
  assert.equal(isDefaultArrangement(state), true);
});

test("normalizeArrangement keeps valid custom order and appends unknown sections", () => {
  const state = normalizeArrangement({ order: ["finance", "work-queue", "today"], hidden: ["pulse"] });
  assert.equal(state.order[0], "finance");
  assert.equal(state.order[1], "work-queue");
  assert.equal(state.order[2], "today");
  assert.equal(state.order.length, OVERVIEW_SECTION_ORDER.length);
  assert.deepEqual(state.hidden, ["pulse"]);
});

test("normalizeArrangement drops junk, duplicates and hidden ids that are not sections", () => {
  const state = normalizeArrangement({
    order: ["finance", "finance", "bogus", 42, null],
    hidden: ["nope", "notes", "notes"],
  });
  assert.equal(state.order[0], "finance");
  assert.deepEqual(state.hidden, ["notes"]);
});

test("normalizeArrangement hides a section at most once and only if it is in the order", () => {
  const state = normalizeArrangement({ order: ["today"], hidden: ["today", "today"] });
  assert.deepEqual(state.hidden, ["today"]);
});

test("moveSection moves a section before its target", () => {
  const order = ["work-queue", "today", "finance"];
  assert.deepEqual(moveSection(order, "finance", "today"), ["work-queue", "finance", "today"]);
  // Dropping onto the last item: remove the item (today, finance), then insert at
  // finance's shifted index (2) — the item lands after finance.
  assert.deepEqual(moveSection(order, "work-queue", "finance"), ["today", "finance", "work-queue"]);
});

test("moveSection is a no-op for missing ids or same-position moves", () => {
  const order = ["work-queue", "today", "finance"];
  assert.deepEqual(moveSection(order, "nope", "today"), order);
  assert.deepEqual(moveSection(order, "today", "today"), order);
  // Original array is never mutated.
  assert.deepEqual(order, ["work-queue", "today", "finance"]);
});

test("isDefaultArrangement detects both order and hidden changes", () => {
  assert.equal(isDefaultArrangement({ order: [...OVERVIEW_SECTION_ORDER], hidden: [] }), true);
  assert.equal(
    isDefaultArrangement({ order: [...OVERVIEW_SECTION_ORDER].reverse(), hidden: [] }),
    false,
  );
  assert.equal(isDefaultArrangement({ order: [...OVERVIEW_SECTION_ORDER], hidden: ["notes"] }), false);
});

test("section dnd ids round-trip", () => {
  assert.equal(parseSectionDndId("overview", sectionDndId("overview", "pulse")), "pulse");
  assert.equal(parseSectionDndId("overview", "overview-section-bogus"), "bogus");
  assert.equal(parseSectionDndId("overview", "other"), null);
  assert.equal(parseSectionDndId("shipments", "customs-section-rail"), null);
  assert.equal(parseSectionDndId("shipments", sectionDndId("shipments", "rail")), "rail");
});

test("register workspaces have valid sections and presets", () => {
  assert.deepEqual([...WORKSPACE_SECTIONS.shipments], ["rail", "register"]);
  assert.deepEqual([...WORKSPACE_SECTIONS.customs], ["pulse", "rail", "queue"]);
  assert.deepEqual([...WORKSPACE_SECTIONS.pickups], ["rail", "register"]);
  assert.deepEqual([...WORKSPACE_SECTIONS.alerts], ["rail", "register"]);
  assert.deepEqual([...WORKSPACE_SECTIONS.finance], ["rail", "register"]);
  assert.deepEqual([...WORKSPACE_SECTIONS.payables], ["rail", "register"]);
  for (const workspace of ["shipments", "customs", "delivery", "freight-documents", "pickups", "alerts", "finance", "payables"]) {
    assert.ok(WORKSPACE_PRESETS[workspace].length >= 2, `${workspace} needs presets`);
    for (const preset of WORKSPACE_PRESETS[workspace]) {
      const normalized = normalizeArrangementFor(workspace, preset.layout);
      assert.deepEqual(normalized.order, preset.layout.order);
      assert.deepEqual(normalized.hidden, preset.layout.hidden);
      assert.equal(presetForStateIn(workspace, normalized), preset.id);
    }
  }
});

test("normalizeArrangementFor drops unknown ids and completes the order", () => {
  const state = normalizeArrangementFor("customs", { order: ["queue"], hidden: ["nope", "rail"] });
  assert.deepEqual(state.order, ["queue", "pulse", "rail"]);
  assert.deepEqual(state.hidden, ["rail"]);
  assert.equal(isDefaultArrangementFor("customs", state), false);
  assert.equal(isDefaultArrangementFor("customs", normalizeArrangementFor("customs", null)), true);
});

test("normalizeSavedLayouts trims, caps and normalises every entry against the workspace", () => {
  const saved = normalizeSavedLayouts("shipments", [
    { id: "a", name: "  Desk  ", order: ["register", "rail"], hidden: [] },
    { id: "a", name: "dup", order: ["rail", "register"], hidden: [] },
    { id: "", name: "no id", order: ["rail", "register"], hidden: [] },
    { id: "b", name: "   ", order: ["rail", "register"], hidden: [] },
    { id: "c", name: "junk order", order: ["nope", 42, null], hidden: ["nope"] },
  ]);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].id, "a");
  assert.equal(saved[0].name, "Desk");
  assert.deepEqual(saved[0].order, ["register", "rail"]);
  // Junk order entries fall back to the workspace default order.
  assert.deepEqual(saved[1].order, ["rail", "register"]);
  assert.deepEqual(saved[1].hidden, []);
});

test("savedLayoutForState matches exactly and saved layouts round-trip through serialize", () => {
  const layout = { id: "x1", name: "Mine", order: ["register", "rail"], hidden: ["rail"] };
  const saved = normalizeSavedLayouts("shipments", [layout]);
  assert.equal(savedLayoutForState(saved, { order: ["register", "rail"], hidden: ["rail"] })?.id, "x1");
  assert.equal(savedLayoutForState(saved, { order: ["rail", "register"], hidden: [] }), null);
  const roundTripped = normalizeSavedLayouts("shipments", JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(roundTripped, saved);
});

test("every preset layout is a complete valid arrangement", () => {
  for (const preset of LAYOUT_PRESETS) {
    const normalized = normalizeArrangement(preset.layout);
    assert.deepEqual(normalized.order, preset.layout.order);
    assert.deepEqual(normalized.hidden, preset.layout.hidden);
  }
});

test("presetForState matches the dispatch preset exactly", () => {
  const dispatch = LAYOUT_PRESETS.find((preset) => preset.id === "dispatch");
  assert.ok(dispatch);
  assert.equal(presetForState(normalizeArrangement(dispatch.layout)), "dispatch");
  assert.equal(presetForState(normalizeArrangement(null)), "manager"); // default == manager
  assert.equal(presetForState(normalizeArrangement({ order: ["notes", ...OVERVIEW_SECTION_ORDER.filter((id) => id !== "notes")], hidden: [] })), null);
});

test("presetForState survives a save/load round trip", () => {
  const finance = LAYOUT_PRESETS.find((preset) => preset.id === "finance");
  assert.ok(finance);
  const serialized = JSON.parse(JSON.stringify(finance.layout));
  assert.equal(presetForState(normalizeArrangement(serialized)), "finance");
  const shifted = normalizeArrangement({ order: [...finance.layout.order], hidden: ["notes"] });
  assert.equal(presetForState(shifted), null);
  assert.equal(presetForState(normalizeArrangement({ order: [...finance.layout.order].reverse(), hidden: [] })), null);
});

test("manager preset matches the default arrangement and applying it over a custom layout is a real change", () => {
  const manager = LAYOUT_PRESETS.find((preset) => preset.id === "manager");
  assert.ok(manager);
  assert.equal(presetForState(normalizeArrangement(null)), "manager");
  // The save guard is serverState-based, so a custom → manager switch must be
  // seen as different from the default. Pin the invariant the hook relies on.
  const custom = normalizeArrangement({ order: ["finance", ...OVERVIEW_SECTION_ORDER.filter((id) => id !== "finance")], hidden: [] });
  assert.notEqual(
    JSON.stringify(custom),
    JSON.stringify(manager.layout),
  );
});
