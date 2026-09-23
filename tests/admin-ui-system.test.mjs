import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Flexible UI contract. These assertions lock durable architecture invariants
// (registry-driven navigation, shared Ops primitives, brand tokens, accessibility
// safeguards) rather than a specific legacy appearance. Structure, layout and copy
// are free to evolve as the product is redesigned.

const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const shellPath = new URL("../app/admin/operations-shell.tsx", import.meta.url);
const uiPath = new URL("../app/admin/operations-ui.tsx", import.meta.url);
const productCssPath = new URL("../app/product.css", import.meta.url);
const systemCssPath = new URL("../app/admin/operations-system.css", import.meta.url);
const navigationPath = new URL("../app/admin/workflow-navigation.ts", import.meta.url);
const shipmentsPath = new URL("../app/admin/shipments/shipments-workspace.tsx", import.meta.url);
const accountMenuPath = new URL("../app/admin/operations-account-menu.tsx", import.meta.url);
const profileRoutePath = new URL("../app/api/admin/profile/route.ts", import.meta.url);
const notificationCentrePath = new URL("../app/admin/operations-notification-centre.tsx", import.meta.url);
const preferencesEditorPath = new URL("../app/admin/notifications/notification-preferences-editor.tsx", import.meta.url);
const displayPrefsClientPath = new URL("../app/admin/operations-display-preferences.tsx", import.meta.url);
const displayPrefsServerPath = new URL("../app/admin/notifications/display-preferences.server.ts", import.meta.url);
const displayPrefsRoutePath = new URL("../app/api/admin/display-preferences/route.ts", import.meta.url);
const displayPrefsDataPath = new URL("../app/admin/notifications/display-preferences.ts", import.meta.url);
const adminLayoutPath = new URL("../app/admin/layout.tsx", import.meta.url);

test("admin shell derives grouped navigation from the canonical workspace registry", async () => {
  const shell = await readFile(shellPath, "utf8");
  assert.match(shell, /groupedWorkspaces\(capabilities\)/);
  assert.match(shell, /data-workspace-group=/);
  assert.match(shell, /data-workspace-id=/);
  assert.match(shell, /app-workspaces/);
  // Navigation must not be re-hardcoded inside the shell; it flows from the registry.
  assert.doesNotMatch(shell, /const operationsWorkflow = \[/);
  assert.doesNotMatch(shell, /const commercialWorkflow = \[/);
  // Permissions must never default open.
  assert.doesNotMatch(shell, /can(?:ViewCommercial|ManageJobFile|ManageFinance|ManageStaff)\s*=\s*true/);
});

test("operations-system.css is the final staff stylesheet and keeps KCPL identity + accessibility", async () => {
  // The staff sheets moved out of the root layout into product.css so the public
  // pages stop downloading them; the cascade they rely on did not move.
  const [product, css] = await Promise.all([readFile(productCssPath, "utf8"), readFile(systemCssPath, "utf8")]);
  const imports = [...product.matchAll(/@import\s+["'](\.\/[^"']+\.css)["']/g)].map((match) => match[1]);
  assert.equal(imports.at(-1), "./admin/operations-system.css", "operations-system.css must load last so it owns the final cascade");
  assert.ok(
    imports.indexOf("./brand-system.css") > imports.indexOf("./admin/operations-polish.css"),
    "brand-system.css must stay after the operations compatibility layers whose tokens it overrides",
  );
  const rootLayout = await readFile(layoutPath, "utf8");
  assert.doesNotMatch(rootLayout, /import\s+["']\.\/admin\/[^"']+\.css["']/, "staff stylesheets must not return to the root layout: every public page pays for them there");
  // Brand anchors.
  assert.match(css, /--admin-crimson:\s*#DC143C/i);
  assert.match(css, /--admin-ink:\s*#101010/i);
  // Full semantic token set.
  for (const token of ["--admin-danger", "--admin-warning", "--admin-success", "--admin-info"]) {
    assert.ok(css.includes(token), `missing semantic token ${token}`);
  }
  // Accessibility safeguards.
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-height:\s*44px/);
  // The shared cascade must not fight itself with !important or substring selectors.
  assert.doesNotMatch(css, /!important/);
});

test("shared operations primitives expose the reusable component vocabulary", async () => {
  const ui = await readFile(uiPath, "utf8");
  for (const primitive of [
    "OpsPage",
    "OpsPageHeader",
    "OpsSurface",
    "OpsToolbar",
    "OpsTableWrap",
    "OpsBadge",
    "OpsEmptyState",
    "OpsErrorState",
    "OpsButton",
    "OpsMetricStrip",
    "OpsMetric",
    "OpsTimeline",
    "OpsDetailSection",
    "OpsDetailGrid",
    "OpsActionMenu",
    "OpsSkeleton",
  ]) {
    assert.match(ui, new RegExp(`export function ${primitive}\\b`), `missing shared primitive ${primitive}`);
  }
  assert.match(ui, /className="ops-error-state"/);
  assert.match(ui, /className="ops-metric-strip"/);
});

test("shipment register uses shared primitives and keyboard-accessible selection", async () => {
  const shipments = await readFile(shipmentsPath, "utf8");
  assert.match(shipments, /<OpsPage className="shipments-register">/);
  assert.match(shipments, /<OpsPageHeader/);
  assert.match(shipments, /<OpsSearch/);
  assert.match(shipments, /<OpsTableWrap/);
  assert.match(shipments, /<OpsBadge tone=\{statusTone\(job\.status\)\}/);
  assert.match(shipments, /shipmentNextAction\(job\)/);
  // Rows must be operable from the keyboard and must not rely on double-click.
  assert.match(shipments, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.doesNotMatch(shipments, /onDoubleClick=/);
});

test("the profile button embeds the tabbed account settings panel on shared overlay and a11y terms", async () => {
  const [shell, menu, css, route, centre, editor] = await Promise.all([
    readFile(shellPath, "utf8"),
    readFile(accountMenuPath, "utf8"),
    readFile(systemCssPath, "utf8"),
    readFile(profileRoutePath, "utf8"),
    readFile(notificationCentrePath, "utf8"),
    readFile(preferencesEditorPath, "utf8"),
  ]);
  // The profile chip is a real disclosure control wired to the panel.
  assert.match(shell, /className="app-account-trigger"/);
  assert.match(shell, /aria-haspopup="dialog"/);
  assert.match(shell, /aria-expanded=\{accountOpen\}/);
  assert.match(shell, /<OperationsAccountMenu/);
  // Panel exposes a dialog role and dismisses on Escape.
  assert.match(menu, /role="dialog"/);
  assert.match(menu, /aria-label="Account and settings"/);
  assert.match(menu, /event\.key === "Escape"/);
  // Settings are a tabbed surface: real ARIA tabs with a roving tabindex and
  // arrow-key navigation, so sections stay discoverable instead of growing
  // into one long scroll.
  for (const tabId of ["identity", "notifications", "display", "session"]) {
    assert.match(menu, new RegExp(`id="account-tab-${tabId}"`));
    assert.match(menu, new RegExp(`aria-controls="account-panel-${tabId}"`));
    assert.match(menu, new RegExp(`id="account-panel-${tabId}"`));
    assert.match(menu, new RegExp(`aria-labelledby="account-tab-${tabId}"`));
  }
  assert.match(menu, /role="tablist"/);
  assert.match(menu, /role="tab"/);
  // Roving tabindex, spelled per tab: only the selected tab is in the tab order.
  assert.match(menu, /tabIndex=\{tab === "identity" \? 0 : -1\}/);
  assert.match(menu, /tabIndex=\{tab === "notifications" \? 0 : -1\}/);
  assert.match(menu, /tabIndex=\{tab === "session" \? 0 : -1\}/);
  assert.match(menu, /ArrowRight/);
  assert.match(menu, /hidden=\{tab !== "identity"\}/);
  // Notification preferences render through the one shared editor, embedded by
  // the account panel's Notifications tab; the bell overlay deep-links there
  // instead of hosting a second copy — one form, one home, no drift.
  assert.match(menu, /NotificationPreferencesEditor/);
  assert.doesNotMatch(centre, /NotificationPreferencesEditor/);
  assert.match(editor, /export function NotificationPreferencesEditor/);
  assert.doesNotMatch(centre, /Delivery preferences/); // moved into the shared editor
  assert.match(editor, /notificationEmailModes/);      // labels come from notification-data, never hand-typed
  assert.match(editor, /transitionDesks/);
  // The editor owns no transport: hosts fetch and POST, the form is controlled.
  assert.doesNotMatch(editor, /fetch\(/);
  // The bell's settings icon deep-links into the panel's Notifications tab:
  // the centre dispatches, the shell listens and opens the panel on that tab.
  assert.match(centre, /kcpl:open-account-notifications/);
  assert.match(shell, /kcpl:open-account-notifications/);
  assert.match(shell, /setAccountTab\("notifications"\)/);
  assert.match(shell, /tab=\{accountTab\}/);
  assert.match(menu, /onTabChange/);
  // Display tab: per-staff density and motion, saved immediately on selection
  // and only broadcast after the server confirms the persisted value.
  assert.match(menu, /role="radiogroup"/);
  assert.match(menu, /method: "PUT"/);
  assert.match(menu, /kcpl:display-preferences-changed/);
  assert.match(menu, /displayDensities/);
  assert.match(menu, /displayMotions/);
  // Identity comes from the authenticated staff-directory endpoint, not client guesses.
  assert.match(menu, /fetch\("\/api\/admin\/profile"/);
  assert.match(route, /getAdminAccess\(\)/);
  assert.match(route, /getStaffContext\(access\.user\)/);
  // The panel is read-only on authority: no writes to role/branch scope here —
  // staff mutations stay in the management-only People & Branches workspace.
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(menu, /\/admin\/staff/);
  // Token-only styling; the entrance follows the notification panel's
  // @starting-style pattern and is covered by the reduced-motion carve-out;
  // the tab strip follows the ops-scope-tab dialect (color-only hover, state
  // driven via the aria-selected attribute, not a class toggle).
  assert.match(css, /\.app-account-panel \{[^}]*transform-origin/);
  assert.match(css, /@starting-style \{\n {2}\.app-account-panel/);
  assert.match(css, /\.app-command-backdrop, \.app-command-dialog, \.app-notification-panel, \.app-account-panel \{ transition: none; \}/);
  assert.match(css, /\.app-account-tab\[/);
  assert.doesNotMatch(menu, /bg-white|bg-black|#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(editor, /bg-white|bg-black|#[0-9a-fA-F]{3,8}\b/);
});

test("navigation registry keeps every operational and commercial destination reachable", async () => {
  const navigation = await readFile(navigationPath, "utf8");
  for (const href of [
    "/admin/command-centre",
    "/admin/shipments",
    "/admin/pickups",
    "/admin/customs",
    "/admin/documents",
    "/admin/delivery",
    "/admin/alerts",
    "/admin/enquiries",
    "/admin/crm",
    "/admin/finance",
    "/admin/partners",
    "/admin/staff",
  ]) {
    assert.ok(navigation.includes(`href: "${href}"`), `missing registry destination ${href}`);
  }
});

test("display preferences persist per staff member and drive token-level density and motion", async () => {
  const [data, server, route, client, layout, css, menu] = await Promise.all([
    readFile(displayPrefsDataPath, "utf8"),
    readFile(displayPrefsServerPath, "utf8"),
    readFile(displayPrefsRoutePath, "utf8"),
    readFile(displayPrefsClientPath, "utf8"),
    readFile(adminLayoutPath, "utf8"),
    readFile(systemCssPath, "utf8"),
    readFile(accountMenuPath, "utf8"),
  ]);
  // Storage mirrors the notification-preferences pattern: per-staff doc,
  // defaults on first use, merge-write so one field never wipes the other.
  assert.match(data, /displayDensities = \["comfortable", "compact"\]/);
  assert.match(data, /displayMotions = \["full", "reduced"\]/);
  assert.match(server, /staff_display_settings/);
  assert.match(server, /merge: true/);
  assert.match(server, /firebaseRuntimeConfigured\(\)/);
  // Authenticated, validated, no cross-origin writes; GET defaults on first use.
  assert.match(route, /getAdminAccess\(\)/);
  assert.match(route, /getStaffContext\(access\.user\)/);
  assert.match(route, /export async function PUT/);
  assert.doesNotMatch(route, /export async function (POST|PATCH)/);
  // DELETE is the reset action: deletes the doc and returns the defaults —
  // the client never guesses default values.
  assert.match(route, /export async function DELETE/);
  assert.match(route, /defaultDisplayPreferences\(\)/);
  assert.match(server, /clearDisplayPreferences/);
  assert.match(route, /isTrustedSameOriginRequest/);
  // Client applies the choice on the route root; server layout provides the
  // first-paint attributes with fail-open defaults.
  assert.match(client, /data-density/);
  assert.match(client, /data-motion/);
  assert.match(client, /kcpl:display-preferences-changed/);
  assert.match(layout, /data-density=\{density\}/);
  assert.match(layout, /getDisplayPreferences/);
  // The stylesheet consumes exactly those attributes as token overrides —
  // compact rewrites the scale tokens, reduced zeroes the duration tokens.
  assert.match(css, /\.kcpl-admin-route\[data-density="compact"\]/);
  assert.match(css, /\.kcpl-admin-route\[data-motion="reduced"\]/);
  assert.match(css, /--app-duration-fast: 0ms/);
  assert.doesNotMatch(css, /\.kcpl-admin-route:not\(\[data-density\]\)/); // no-op fallback rules banned
  // Compact reaches beyond the scale tokens: the component-local paddings in
  // tables and detail sections are restated, vertical rhythm only.
  assert.match(css, /data-density="compact"\] \.kcpl-admin-content :where\(table td\)/);
  assert.match(css, /data-density="compact"\] \.kcpl-admin-content :where\(table th\)/);
  assert.match(css, /data-density="compact"\] \.kcpl-admin-content \.ops-detail-section /);
  assert.match(css, /data-density="compact"\] \.kcpl-admin-content \.ops-detail-grid/);
  // The reset action exists in the UI and disables itself at defaults.
  assert.match(menu, /Reset to defaults/);
  assert.match(menu, /method: "DELETE"/);
  assert.match(menu, /display\.density === "comfortable" && display\.motion === "full"/);
});
