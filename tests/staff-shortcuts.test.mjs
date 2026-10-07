import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GO_WINDOW_MS, shortcutAction, shortcutHubs } from "../app/admin/staff-shortcuts-policy.ts";

const hubs = shortcutHubs([
  { id: "overview", label: "Overview", href: "/admin/command-centre" },
  { id: "shipments", label: "Shipments", href: "/admin/shipments" },
  { id: "reports", label: "Reports", href: "/admin/management" },
]);

test("g then a letter opens a section the person can see, and only then", () => {
  const armed = shortcutAction("g", 0, 1000, hubs);
  assert.equal(armed.kind, "none");
  assert.equal(armed.pendingGo, 1000);
  assert.deepEqual(shortcutAction("s", armed.pendingGo, 1500, hubs), { kind: "go", href: "/admin/shipments", pendingGo: 0 });
  // Finance is not among this person's sections, so g f does nothing.
  assert.deepEqual(shortcutAction("f", armed.pendingGo, 1500, hubs), { kind: "none", pendingGo: 0 });
  // Reports has no letter.
  assert.equal(hubs.find((hub) => hub.id === "reports").key, undefined);
  // Too slow: the letter is just a letter again.
  assert.equal(shortcutAction("s", armed.pendingGo, 1000 + GO_WINDOW_MS + 1, hubs).kind, "none");
});

test("single keys map to search, help, rows and New", () => {
  assert.equal(shortcutAction("/", 0, 0, hubs).kind, "search");
  assert.equal(shortcutAction("?", 0, 0, hubs).kind, "help");
  assert.equal(shortcutAction("j", 0, 0, hubs).kind, "next");
  assert.equal(shortcutAction("k", 0, 0, hubs).kind, "previous");
  assert.equal(shortcutAction("n", 0, 0, hubs).kind, "new");
  assert.equal(shortcutAction("x", 0, 0, hubs).kind, "none");
});

test("shortcuts stand down while typing, in dialogs, and with modifier keys", () => {
  const source = readFileSync(new URL("../app/admin/staff-shortcuts.tsx", import.meta.url), "utf8");
  assert.match(source, /event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey/);
  assert.match(source, /closest\("input, textarea, select/);
  assert.match(source, /aria-modal='true'/);
  // n only ever presses a New or Schedule button in the page header.
  assert.match(source, /\[data-page-actions\]/);
  assert.match(source, /\^\\s\*\(New\|Schedule\)\\b/);
});

test("the palette opens without motion from the keyboard and with its entrance from a click", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const shell = await read("app/admin/operations-shell.tsx");
  // ⌘K and the shortcut layer both mark the opening as keyboard-driven.
  assert.match(shell, /setPaletteInstant\(true\);\n\s*setPaletteOpen\(\(current\) => !current\);/);
  assert.match(shell, /onOpenPalette=\{openSearchFromKeyboard\}/);
  assert.match(shell, /const openSearch = useCallback\(\(\) => \{ setMobileOpen\(false\); setPaletteInstant\(false\);/);
  const css = await read("app/admin/operations-system.css");
  assert.match(css, /:is\(\.app-command-backdrop, \.app-command-dialog\)\[data-instant\] \{ transition: none; \}/);
});

test("[ collapses or expands the sidebar, and the shortcuts list says so", () => {
  assert.equal(shortcutAction("[", 0, 0, hubs).kind, "sidebar");
  const source = readFileSync(new URL("../app/admin/staff-shortcuts.tsx", import.meta.url), "utf8");
  assert.match(source, /action\.kind === "sidebar"\) onToggleSidebar\(\)/);
  assert.match(source, /<kbd>\[<\/kbd><\/dt><dd>Collapse or expand the sidebar<\/dd>/);
});
