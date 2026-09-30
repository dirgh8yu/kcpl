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
  roleOverviewArrangement,
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
  const state = normalizeArrangement({ order: ["finance", "work-queue", "today"], hidden: ["workload"] });
  assert.equal(state.order[0], "finance");
  assert.equal(state.order[1], "work-queue");
  assert.equal(state.order[2], "today");
  assert.equal(state.order.length, OVERVIEW_SECTION_ORDER.length);
  assert.deepEqual(state.hidden, ["workload"]);
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
  assert.equal(parseSectionDndId("overview", sectionDndId("overview", "today")), "today");
  assert.equal(parseSectionDndId("overview", "overview-section-bogus"), "bogus");
  assert.equal(parseSectionDndId("overview", "other"), null);
  assert.equal(parseSectionDndId("shipments", "customs-section-rail"), null);
  assert.equal(parseSectionDndId("shipments", sectionDndId("shipments", "rail")), "rail");
});

test("only the Overview is arranged per person; registers keep one layout", () => {
  assert.deepEqual(Object.keys(WORKSPACE_SECTIONS), ["overview"]);
  assert.deepEqual([...WORKSPACE_SECTIONS.overview], [...OVERVIEW_SECTION_ORDER]);
  assert.deepEqual(Object.keys(WORKSPACE_PRESETS), ["overview"]);
  for (const preset of WORKSPACE_PRESETS.overview) {
    const normalized = normalizeArrangementFor("overview", preset.layout);
    assert.deepEqual(normalized.order, preset.layout.order);
    assert.deepEqual(normalized.hidden, preset.layout.hidden);
    assert.equal(presetForStateIn("overview", normalized), preset.id);
  }
});

test("normalizeArrangementFor drops unknown ids and completes the order", () => {
  const state = normalizeArrangementFor("overview", { order: ["notes", "bogus"], hidden: ["nope", "notes", "today"] });
  assert.deepEqual(state.order, ["notes", ...OVERVIEW_SECTION_ORDER.filter((id) => id !== "notes")]);
  assert.deepEqual(state.hidden, ["notes", "today"]);
  assert.equal(isDefaultArrangementFor("overview", state), false);
  assert.equal(isDefaultArrangementFor("overview", normalizeArrangementFor("overview", null)), true);
});

test("normalizeSavedLayouts trims, caps and normalises every entry against the workspace", () => {
  const reversed = [...OVERVIEW_SECTION_ORDER].reverse();
  const saved = normalizeSavedLayouts("overview", [
    { id: "a", name: "  Desk  ", order: reversed, hidden: [] },
    { id: "a", name: "dup", order: [...OVERVIEW_SECTION_ORDER], hidden: [] },
    { id: "", name: "no id", order: [...OVERVIEW_SECTION_ORDER], hidden: [] },
    { id: "b", name: "   ", order: [...OVERVIEW_SECTION_ORDER], hidden: [] },
    { id: "c", name: "junk order", order: ["nope", 42, null], hidden: ["nope"] },
  ]);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].id, "a");
  assert.equal(saved[0].name, "Desk");
  assert.deepEqual(saved[0].order, reversed);
  // Junk order entries fall back to the workspace default order.
  assert.deepEqual(saved[1].order, [...OVERVIEW_SECTION_ORDER]);
  assert.deepEqual(saved[1].hidden, []);
});

test("savedLayoutForState matches exactly and saved layouts round-trip through serialize", () => {
  const reversed = [...OVERVIEW_SECTION_ORDER].reverse();
  const layout = { id: "x1", name: "Mine", order: reversed, hidden: ["notes"] };
  const saved = normalizeSavedLayouts("overview", [layout]);
  assert.equal(savedLayoutForState(saved, { order: reversed, hidden: ["notes"] })?.id, "x1");
  assert.equal(savedLayoutForState(saved, { order: [...OVERVIEW_SECTION_ORDER], hidden: [] }), null);
  const roundTripped = normalizeSavedLayouts("overview", JSON.parse(JSON.stringify(saved)));
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

test("each role starts on its own Overview until the person arranges one", () => {
  assert.equal(presetForState(roleOverviewArrangement("operations")), "dispatch");
  assert.equal(presetForState(roleOverviewArrangement("accounts")), "finance");
  assert.equal(presetForState(roleOverviewArrangement("commercial")), "sales");
  assert.equal(presetForState(roleOverviewArrangement("management")), "manager");
  assert.equal(presetForState(roleOverviewArrangement(null)), "manager");
  // A fresh copy each time: applying it can never mutate the preset table.
  const first = roleOverviewArrangement("operations");
  first.order.reverse();
  assert.equal(presetForState(roleOverviewArrangement("operations")), "dispatch");
  // Operations work the queue; money is not on their first screen.
  assert.ok(roleOverviewArrangement("operations").hidden.includes("finance"));
  assert.equal(roleOverviewArrangement("accounts").order[0], "finance");
});
