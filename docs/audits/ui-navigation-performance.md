# KCPL Frontend, UX Reliability, API-Usability and Performance Audit

Audit agent: 6  
Repository: `dirgh8yu/kcpl`  
Audited branch: `main`  
Audited head before report commit: `cc12393c3050f500a56307cb6b6aa22837c7b2b5`  
Audit mode: hostile source audit only. No application code, production configuration, or production data was modified.

## Audit basis

The audit traced the current Operations shell, canonical workspace registry, desktop and mobile navigation, both command/search implementations, Create navigation, query-param deep links, notification polling, representative high-risk workspaces, API failure handling, Firestore read patterns, client state initialization, accessibility primitives, and the repository's test/index configuration.

Static route inspection found the current canonical `workflowWorkspaces` sidebar destinations present in the App Router tree. The primary failure mode is therefore not a simple missing-page problem. The larger risk is that multiple navigation/search systems disagree about which pages exist and which roles may see them, while several workspaces perform expensive reconciliation work during ordinary reads.

No P0 was confirmed from source alone. Twelve P1 findings were confirmed.

---

## UI-001 - Two live Cmd/Ctrl+K implementations collide, and the one that wins is stale

**Severity:** P1  
**Confidence:** High  
**Route:** All `/admin/*` routes  
**File/component:** `app/layout.tsx`; `app/admin/operations-global-search.tsx`; `app/admin/operations-shell.tsx`; `app/admin/operations-command-palette.tsx`; `app/admin/workflow-navigation.ts`

**User reproduction steps**
1. Open any KCPL Operations page.
2. Press Cmd+K on macOS or Ctrl+K elsewhere, or click a shell button whose accessible name is `Open command palette`.
3. Search for `Pickup Scheduling`, `Freight Documents`, `Live Visibility`, `Delivery`, `Carrier Integrations`, `EDI Gateway`, or `Freight Audit`.

**Expected experience**
- Exactly one command palette opens.
- It uses the same canonical workspace registry as the sidebar.
- Every workspace authorized for the current staff member is discoverable.

**Actual failure**
- `app/layout.tsx` mounts `OperationsGlobalSearch` globally.
- `OperationsShell` separately mounts `OperationsCommandPalette`.
- The global search registers capture-phase keyboard and click listeners. On Cmd/Ctrl+K it calls `stopImmediatePropagation()`. On clicks it intercepts buttons with `aria-label="Open command palette"` before the shell handler can run.
- The global search therefore wins the normal entry points and bypasses the newer palette.
- Its private hard-coded workspace registry is stale. It omits current canonical areas including Pickup Scheduling, Freight Documents, Live Visibility, Delivery & POD, Carrier Integrations, EDI Gateway, and Freight Audit & Match-Pay.

**Operational impact**
The exact class of historical KCPL failure where Cmd+K is missing workspaces is still present in current `main`. Operators can be told a workspace exists by the sidebar while the global command interface claims it does not.

**Performance impact**
Both implementations and their supporting code are shipped/mounted in the admin experience. The stale global search also activates its own record-search index path, while the newer palette has a separate search endpoint.

**Recommended remediation**
Retain one command/search implementation only. Drive it from `workflowWorkspaces` and the same capability object used by the sidebar. Remove capture-phase interception by a second search layer.

**Test required**
Browser E2E test mounting the real root layout plus admin shell. Assert that Cmd/Ctrl+K and every search button open exactly one dialog and that every `visibleWorkspaces()` item is discoverable by label/keyword.

---

## UI-002 - The live global search permission model disagrees with the sidebar and can offer unauthorized destinations

**Severity:** P1  
**Confidence:** High  
**Route:** All `/admin/*` routes  
**File/component:** `app/admin/operations-global-search.tsx`; `app/admin/workflow-navigation.ts`; `app/api/admin/search/route.ts`

**User reproduction steps**
1. Sign in as a role without Digital Job File or commercial privileges.
2. Open Cmd/Ctrl+K.
3. Browse/search workspaces such as Shipments, Customs, Documents, Rate Desk, Pricing, or Tendering.

**Expected experience**
Workspace discovery should exactly match sidebar capability rules. A user should never be offered a navigation target that the current role is not intended to enter.

**Actual failure**
The stale global search permission model only understands `canManageFinance`, `canManageStaff`, and `isManagement`. It has no `canManageJobFile` or `canViewCommercial` capability. Several workspaces that are guarded as `job_file` or `commercial` in `workflow-navigation.ts` are unconditional entries in the older search registry.

Server-side route authorization remains the final security boundary, so this is primarily a UX/RBAC consistency defect rather than evidence of direct data disclosure. It still creates dead-end navigation and misleading capability exposure.

**Operational impact**
Staff can be sent to screens they cannot use, creating repeated 403/gate flows and making permissions appear inconsistent or broken.

**Performance impact**
Unauthorized navigation still incurs server rendering/auth/data setup work before the route gate is shown.

**Recommended remediation**
Use one canonical workspace permission registry for sidebar, mobile menu, pinned/recent navigation, Create actions, and Cmd/Ctrl+K. Do not maintain a second partial permission schema.

**Test required**
Role-matrix E2E tests for management, accounts, commercial, and operations that compare sidebar entries with command-palette entries and verify restricted routes are absent from both.

---

## UI-003 - Shell capability defaults can over-show restricted navigation when `/api/admin/navigation` fails

**Severity:** P1  
**Confidence:** High  
**Route:** Confirmed on `/admin/pickups`; risk applies to any caller passing partial shell capabilities  
**File/component:** `app/admin/operations-shell.tsx`; `app/admin/pickups/page.tsx`; `app/api/admin/navigation/route.ts`

**User reproduction steps**
1. Use a staff role without `canManageJobFile`.
2. Open `/admin/pickups` while `/api/admin/navigation` is unavailable or returns 503.
3. Inspect the shell navigation around the embedded access-restricted gate.

**Expected experience**
The shell should retain the server-resolved least-privilege capabilities even when the supplemental navigation endpoint is down.

**Actual failure**
`OperationsShell` defaults `canViewCommercial = true` and `canManageJobFile = true`. The Pickup page passes only `userName`, `canManageStaff`, `canManageFinance`, and `isManagement` in `shellProps`. A successful client call to `/api/admin/navigation` later corrects this, but the shell intentionally ignores that endpoint's failure. If it fails, the permissive defaults survive.

**Operational impact**
A backend/navigation outage can make restricted workspaces appear in the shell precisely when the application is already degraded, increasing dead-end clicks and undermining trust in RBAC UI.

**Performance impact**
More failing/forbidden route requests during an outage.

**Recommended remediation**
Make capability props explicit and non-permissive. Prefer a single complete server-resolved capability object. A failed client refresh must never expand visible access.

**Test required**
E2E test with `/api/admin/navigation` fault-injected to 503 for each role. Assert the initially rendered shell and post-failure shell show the same authorized workspace set.

---

## UI-004 - Current command-search keyboard, focus, and new-tab behavior is incomplete

**Severity:** P2  
**Confidence:** High  
**Route:** All `/admin/*` routes  
**File/component:** `app/admin/operations-global-search.tsx`; `app/admin/operations-command-palette.tsx`

**User reproduction steps**
1. Open the currently winning Cmd/Ctrl+K search.
2. Type a query with several results.
3. Press ArrowDown/ArrowUp, then attempt Cmd/Ctrl+click on a result or use keyboard focus past the last dialog control.
4. Close the dialog and observe focus.

**Expected experience**
Arrow keys move a selected result, Enter opens it, Escape closes, focus remains trapped inside the modal while open, focus returns to the opener, and link-like results retain browser modifier/new-tab semantics where practical.

**Actual failure**
- The live older global search handles Enter but does not implement ArrowUp/ArrowDown selection.
- Result rows in both old and new implementations are buttons that imperatively navigate. They do not provide normal anchor new-tab/context-menu behavior.
- The newer palette has ArrowUp/ArrowDown support, but it is normally intercepted by UI-001.
- Neither implementation establishes a full focus trap/restoration contract.

**Operational impact**
Power users cannot reliably operate the main global navigation entirely from the keyboard, and opening multiple operational records in separate tabs is unnecessarily difficult.

**Performance impact**
No major backend cost by itself.

**Recommended remediation**
Use one accessible command-list pattern with active-descendant/roving selection, focus trap and focus restoration. Use links for navigation rows or explicitly preserve modifier-click semantics.

**Test required**
Keyboard-only E2E test covering ArrowUp, ArrowDown, Enter, Escape, Tab/Shift+Tab containment, focus restoration, and Cmd/Ctrl+click/new-tab behavior.

---

## UI-005 - The hard-navigation reliability fallback only protects the desktop sidebar

**Severity:** P1  
**Confidence:** High  
**Route:** All `/admin/*` routes  
**File/component:** `app/admin/operations-navigation-fallback.tsx`; `app/admin/operations-shell.tsx`; `app/admin/operations-notification-centre.tsx`

**User reproduction steps**
1. Reproduce or fault-inject a failed Next.js RSC/soft-navigation transition.
2. On desktop, click a normal sidebar link.
3. Repeat from the mobile menu, Create menu, notification centre, or another shell link outside the desktop `<aside>`.

**Expected experience**
Known soft-navigation failure should have one consistent fallback across equivalent Operations navigation surfaces while preserving modifier clicks and new-tab behavior.

**Actual failure**
`OperationsNavigationFallback` explicitly documents the historical case where a soft Next.js navigation can leave the current workspace mounted. It converts only `.kcpl-ops aside a[href]` normal clicks to `window.location.assign()`.

The mobile menu is outside the `<aside>` and remains a Next `<Link>`. Create menu links are outside the `<aside>`. Notifications use `router.push()`. These paths therefore bypass the reliability workaround for the exact failure mode the workaround is meant to contain.

**Operational impact**
Desktop sidebar navigation can recover from a failed RSC transition while mobile or secondary navigation can still leave the wrong page mounted or appear unresponsive.

**Performance impact**
Hard navigation is more expensive than soft navigation, but inconsistent behavior is currently worse: the system pays for both models without a uniform reliability contract.

**Recommended remediation**
Centralize reliable internal navigation behavior and apply it to every Operations navigation surface that needs the documented fallback. Keep modifier-click and external-link behavior intact.

**Test required**
Fault-injected E2E test that aborts/fails the RSC transition and verifies desktop sidebar, mobile menu, Create links, notification links, and Cmd/Ctrl+K all land on the intended page or perform a deterministic hard fallback.

---

## UI-006 - Both record-search architectures scale by recent collection scans and can miss older exact records

**Severity:** P1  
**Confidence:** High  
**Route:** Cmd/Ctrl+K; `/api/admin/search`; `/api/admin/operations-search`  
**File/component:** `app/api/admin/search/route.ts`; `app/api/admin/operations-search/route.ts`; both search clients

**User reproduction steps**
1. Create enough historical shipments/customers/enquiries/orders/tenders/etc. to exceed the hard-coded recent limits.
2. Search by an exact older reference.
3. Rapidly type several 2+ character queries in the newer palette path.

**Expected experience**
Exact identifiers should remain findable regardless of age. Search cost should scale with the query/result count, not with broad collection windows on each user interaction.

**Actual failure**
The currently winning `/api/admin/search` builds an in-memory index by reading up to 350 shipments + 300 quotes + 350 customers. That is up to 1,000 document reads per cache rebuild and it excludes older records outside the windows.

The newer `/api/admin/operations-search` scans recent windows on every debounced query. For a fully privileged user its explicit limits total up to 2,650 documents: 450 shipments, 400 customers, 350 quotes, 350 partners, 400 orders, 350 tenders, and 350 payables. Matching occurs in application memory. Client AbortController use does not guarantee Firestore reads already started on the server are cancelled.

**Operational impact**
A known historical job/customer can be effectively unsearchable from the global interface. If UI-001 is fixed by simply enabling the newer palette without redesigning its backend, rapid typing can create a large read spike.

**Performance impact**
High. Search is capable of 1,000-read index rebuilds today and up to roughly 2,650 reads per newer search request for a fully privileged role.

**Recommended remediation**
Introduce query-oriented searchable fields/indexes and exact-ID fast paths. Bound server results, paginate where necessary, and avoid shipping/scanning a broad recent corpus for each search. Cache only where it preserves authorization and correctness.

**Test required**
E2E/API tests for exact references older than all current scan limits, rapid typing/race ordering, aborted requests, degraded Firebase, role filtering, and read-count/performance budgets.

---

## UI-007 - Notification polling can fan out into thousands of Firestore reads every 30 seconds per open admin tab

**Severity:** P1  
**Confidence:** High  
**Route:** All `/admin/*` routes  
**File/component:** `app/admin/operations-notification-centre.tsx`; `app/api/admin/notifications/route.ts`; `app/admin/notifications/assignment-notifications.server.ts`; `app/admin/notifications/notification-centre.server.ts`; `app/admin/alerts/alert-engine.server.ts`

**User reproduction steps**
1. Open any admin page and leave the tab open.
2. Observe `/api/admin/notifications` every 30 seconds.
3. Populate assignment/task/alert collections toward their coded limits, including many customer tasks.
4. Leave multiple admin tabs open or refocus a tab around the polling interval.

**Expected experience**
The global bell should use a cheap bounded unread/feed query, avoid polling hidden tabs, prevent overlapping refreshes, and back off when the service is unhealthy.

**Actual failure**
The notification centre schedules an immediate load, a 30-second interval, and another load on window focus. There is no visibility-state pause, backoff, jitter, request deduplication, or AbortController for overlapping loads.

One assignment refresh can read up to two 500-shipment queries, four 1,000 task collection-group queries, 1,000 receipts, preferences, then perform a serial customer document lookup for each merged customer task. The base feed can separately load up to 1,000 alerts, shipment branch documents for alert references, 500 direct notifications, 1,000 receipts, and preferences. The coded upper bounds imply a pathological request can cross 10,000 reads before considering auth/staff-context work.

The API does use `Promise.allSettled` to keep a failed supplemental assignment source from killing the primary notification feed. That isolation is good, but it does not control the read volume.

**Operational impact**
High risk of Firestore quota/cost pressure and cross-workspace latency amplification. Multiple idle admin tabs multiply the load. During Firestore degradation, the clients continue polling the failing service.

**Performance impact**
Critical hotspot. This is the highest recurring background-read risk found in the frontend path.

**Recommended remediation**
Materialize a bounded per-user notification/unread feed, batch customer lookups, eliminate broad assignment scans, pause polling when hidden, prevent overlap, back off on errors, and consider event-driven/push delivery or a much cheaper unread-count endpoint.

**Test required**
Load test with large assignment/alert datasets, multiple tabs, hidden-tab behavior, focus storms, 503 responses, slow responses exceeding 30 seconds, and a hard Firestore-read budget per poll.

---

## UI-008 - Tender Desk performs large scans and expiry writes during ordinary page reads

**Severity:** P1  
**Confidence:** High  
**Route:** `/admin/tenders`; indirectly `/admin/edi`  
**File/component:** `app/admin/tenders/page.tsx`; `app/admin/tenders/tms-tender-expiry.server.ts`; `app/admin/tenders/tms-tendering.server.ts`; `app/admin/rating/tms-rating.server.ts`; `app/admin/crm/crm-data.server.ts`

**User reproduction steps**
1. Populate tender/order/customer collections near their coded limits.
2. Include many `sent` tenders, including expired ones.
3. Open Tender Desk.

**Expected experience**
Opening a workspace should be a bounded read. Tender expiry should be reconciled independently or by a targeted due-date query, not by page-view side effects.

**Actual failure**
Tender Desk first calls `reconcileExpiredTmsTenders()`, which scans up to 500 `sent` tenders and can run a transaction per expired tender. It then loads orders, tenders, and customers in parallel.

Those list paths can read up to 500 transport orders, 1,000 tenders, and 2,000 customers plus staff profiles. `listTmsTenders()` independently checks expiry again and can write expired statuses. Ordinary navigation can therefore trigger thousands of reads plus expiry writes.

**Operational impact**
Tender Desk startup latency and failure probability grow with business history. Page views can contend with live tender responses because reads also perform workflow maintenance.

**Performance impact**
High: up to several thousand reads on a single page load, plus potentially many transactions/writes.

**Recommended remediation**
Move expiry reconciliation to a scheduled/idempotent workflow or targeted indexed query. Keep GET/render paths pure. Paginate orders/tenders/customers and load customer options by search rather than a 2,000-record list.

**Test required**
Performance test at collection limits, concurrent expiry/accept/reject activity, no-write-on-GET assertion, and degraded customer/order source tests proving the useful tender shell remains available.

---

## UI-009 - Pickup Scheduling reads multi-thousand collections and then hydrates linked records in bulk

**Severity:** P1  
**Confidence:** High  
**Route:** `/admin/pickups`  
**File/component:** `app/admin/pickups/page.tsx`; `app/admin/pickups/pickup-appointments.server.ts`; `app/admin/pickups/pickup-appointments-workspace.tsx`

**User reproduction steps**
1. Grow shipments and pickup appointments beyond a small operational dataset.
2. Open Pickup Scheduling or press Refresh.

**Expected experience**
Pickup queue should query only actionable booked movements in the staff branch scope, paginate results, and hydrate only visible rows.

**Actual failure**
`listPickupWorkspace()` reads up to 2,000 recent shipments and 2,000 pickup appointments, filters in memory, then collects customer/quote/tender IDs and batch-fetches those documents with `getAll`. The full resulting queue is passed into client state.

Records outside the recent 2,000 shipment/appointment windows can also disappear from this operational view even if still relevant.

**Operational impact**
Pickup Scheduling gets slower and more expensive as shipment history grows, and an older unresolved booking can become invisible because the source window is based on recency rather than queue state.

**Performance impact**
High: at least 4,000 base reads at the explicit caps, plus linked customer/quote/tender reads.

**Recommended remediation**
Query actionable statuses/booking state directly, scope by branch server-side where possible, paginate, and hydrate related records only for the current page. Use denormalized display snapshots where operationally safe.

**Test required**
Large-dataset test with >2,000 newer irrelevant shipments and an older unresolved pickup. Assert the unresolved item remains discoverable and enforce a page-level read budget.

---

## UI-010 - Freight Audit has a serialized N+1 read/query/write loop on page load

**Severity:** P1  
**Confidence:** High  
**Route:** `/admin/freight-audit`; `/api/admin/freight-audit`  
**File/component:** `app/admin/freight-audit/freight-audit.server.ts`; `app/admin/freight-audit/page.tsx`; `app/admin/freight-audit/freight-audit-workspace.tsx`

**User reproduction steps**
1. Populate 200-250 accessible payables linked to TMS shipments.
2. Open Freight Audit or press Refresh.
3. Measure Firestore operations and end-to-end response latency.

**Expected experience**
The queue should load bounded audit summaries in a few bulk queries. Reading the queue should not rewrite every audit record.

**Actual failure**
The queue reads up to 250 payables, then serially awaits `getFreightAudit()` for each row. That path re-reads the payable, may read shipment/order/rate-card, runs a duplicate-invoice query, reads the stored audit, and writes the audit because `refresh=true`. The queue then reads the shipment again for carrier reference.

This is both N+1 and serialized, and the GET/list path performs persistent writes.

**Operational impact**
Freight Audit can become the slowest finance screen and can time out or fail under normal growth. A simple refresh also generates write traffic and contention on audit records.

**Performance impact**
Very high. A 250-row queue can create well over 1,000 Firestore operations with serialized latency, depending on linkage.

**Recommended remediation**
Bulk-load payables, linked shipments/orders/rate cards and existing audits into maps; batch duplicate detection; eliminate the redundant shipment read; paginate; and persist recalculated audits only on explicit/event-driven mutation paths rather than list rendering.

**Test required**
250-row performance test with Firestore operation counting, no-write-on-GET assertion, duplicate-invoice coverage, and timeout/degraded-source tests.

---

## UI-011 - Payables dashboard scans up to 3,000 bills and can exceed Firestore's write-batch limit during a read

**Severity:** P1  
**Confidence:** High  
**Route:** `/admin/payables`  
**File/component:** `app/admin/payables/payables.server.ts`

**User reproduction steps**
1. Populate Payables with a large number of records whose stored status differs from the computed effective overdue/paid status.
2. Open the Payables dashboard.

**Expected experience**
Dashboard rendering should be a paginated/read-only projection. Status maintenance should be bounded and independent of opening the screen.

**Actual failure**
`listPayablesDashboard()` reads up to 3,000 payables. While iterating, it queues status corrections into one Firestore `WriteBatch`, then commits that batch after the scan.

A Firestore batch supports at most 500 writes. If more than 500 statuses require correction, the dashboard's maintenance commit can fail and take down the read path. Even below that threshold, opening the screen mutates persisted records.

**Operational impact**
A backlog or date rollover can make Accounts Payable fail to open exactly when many statuses need refreshing. The user action of viewing the dashboard becomes coupled to mass data maintenance.

**Performance impact**
High: up to 3,000 reads plus hundreds of writes on a single dashboard request.

**Recommended remediation**
Separate status reconciliation from dashboard reads, chunk any required maintenance safely, and query/paginate the operational subsets needed by the UI.

**Test required**
Regression test with >500 stale statuses, >3,000 total records, page refresh concurrency, and an assertion that dashboard GET/render does not mutate data.

---

## UI-012 - A supplemental Job File query can take down the entire page and remove the Operations shell

**Severity:** P1  
**Confidence:** High  
**Route:** `/admin/jobs/[reference]`  
**File/component:** `app/admin/jobs/[reference]/page.tsx`; Job File service modules

**User reproduction steps**
1. Open a valid accessible Digital Job File.
2. Fault one supplemental source such as activity timeline, exceptions, or delivery control while the primary Job File remains available.
3. Separately fault workflow readiness or base Firestore access.

**Expected experience**
Primary Job File data and the Operations shell should remain usable. A failed supplemental section should show its own degraded/error state. Authorized 404/403/503 states should preserve useful navigation whenever practical.

**Actual failure**
After loading the base job, the page uses one `Promise.all()` across workflow readiness, activity, exception cases, and delivery. Any rejection from any member rejects the entire render. This is especially inconsistent because the eventual JSX already treats exceptions, delivery, and activity as optional by checking `kind === "ready"`.

Multiple early `Gate` returns for unavailable/missing/forbidden Job File states also render without `OperationsShell`.

**Operational impact**
A nonessential section failure can strand an operator outside the shell and make an otherwise usable Job File disappear. This directly conflicts with the requirement that the Operations shell remain useful during backend degradation.

**Performance impact**
Retries/reloads repeat all Job File reads when only one supplemental service is unhealthy.

**Recommended remediation**
Render the authorized shell as early as possible, isolate supplemental reads with independent boundaries or `Promise.allSettled`, and reserve whole-page failure for the minimum data required to identify/access the job.

**Test required**
Fault-injection E2E matrix for activity, exceptions, delivery, workflow, Firebase 503, 403, 404, and generic 500. Assert shell availability and which sections remain usable in each case.

---

## UI-013 - Query-param deep links can leave client selection stale across same-route navigation and browser history

**Severity:** P2  
**Confidence:** High  
**Route:** Confirmed patterns on `/admin/tenders?tender=...`, `/admin/pickups?shipment=...`, `/admin/freight-audit?q=...`  
**File/component:** `app/admin/tenders/page.tsx`; `app/admin/tenders/tms-tender-workspace.tsx`; `app/admin/pickups/page.tsx`; `app/admin/pickups/pickup-appointments-workspace.tsx`; `app/admin/freight-audit/page.tsx`; `app/admin/freight-audit/freight-audit-workspace.tsx`

**User reproduction steps**
1. Open one deep link, for example `/admin/pickups?shipment=A`.
2. Navigate within the same route to `/admin/pickups?shipment=B` without a full document reload, or use browser Back/Forward between two query-param targets.
3. Compare the URL with the selected row/form state.

**Expected experience**
The record identified by the URL should become the selected/focused record whenever search parameters change.

**Actual failure**
These pages derive reordered/initial props from search params, but their client workspaces copy those props into `useState()` only on first mount. There is no effect or key that re-synchronizes selection and associated form fields when `initialReference`, `initialFocus`, or reordered initial data changes.

**Operational impact**
The URL can identify record B while the UI still shows record A, especially after soft same-route navigation or browser history. That is dangerous in operational forms because a user can act on the wrong visible context.

**Performance impact**
Users often hard-refresh to recover, re-running expensive page loads.

**Recommended remediation**
Make URL/search params the source of truth for focus, or explicitly synchronize state on param/prop changes. Key record-detail state by the deep-link identifier where appropriate.

**Test required**
E2E tests for A-to-B same-route navigation, Back, Forward, refresh, opening deep links in a new tab, and mutations immediately after a history change.

---

## UI-014 - EDI Gateway hard-couples the ledger to Tender Desk availability and inherits tender-side load/write behavior

**Severity:** P1  
**Confidence:** High  
**Route:** `/admin/edi`  
**File/component:** `app/admin/edi/page.tsx`; `app/admin/edi/edi-gateway.server.ts`; `app/admin/tenders/tms-tendering.server.ts`

**User reproduction steps**
1. Keep EDI transaction storage healthy.
2. Make the tender query fail, become unavailable, or hit an index/storage problem.
3. Open `/admin/edi`.

**Expected experience**
The EDI transaction ledger, quarantine state and gateway health should remain visible. Only the optional 204 tender-handoff control should degrade.

**Actual failure**
The page loads `listEdiGatewayDashboard()` and `listTmsTenders()` in a single `Promise.all()`. A failure/non-ready result from either source replaces the entire EDI workspace with an unavailable gate. The tender list is supplemental to the core ledger but can take down the screen.

The page also reads up to 750 EDI transactions plus up to 1,000 tenders, and `listTmsTenders()` can perform expiry writes while EDI is merely being viewed.

**Operational impact**
An unrelated tender-store problem can hide EDI 990/214 history and quarantined transactions during an integration incident, removing the exact diagnostic surface operators need.

**Performance impact**
High relative to the screen's purpose: up to roughly 1,750 base rows plus possible expiry writes before linked activity.

**Recommended remediation**
Load core EDI ledger independently from optional tender handoff data. Show an isolated degraded state for 204 eligibility. Remove tender-expiry side effects from list rendering.

**Test required**
Fault tender storage while EDI storage is healthy; assert the ledger still renders. Also test the inverse, plus 750/1,000-row performance budgets.

---

## UI-015 - Shared search inputs can be exposed to assistive technology without an accessible name

**Severity:** P2  
**Confidence:** High  
**Route:** Multiple workspaces, confirmed in Pickup Scheduling; older global search also affected  
**File/component:** `app/admin/operations-ui.tsx` `OpsSearch`; `app/admin/pickups/pickup-appointments-workspace.tsx`; `app/admin/operations-global-search.tsx`

**User reproduction steps**
1. Navigate to a workspace using `OpsSearch`, such as Pickup Scheduling.
2. Inspect the input with a screen reader/accessibility tree.
3. Repeat for the older global-search input.

**Expected experience**
Every search field has a stable programmatic accessible name independent of placeholder text.

**Actual failure**
`OpsSearch` wraps the input in a `<label>`, but the only other content is an `aria-hidden` search icon. Callers commonly provide a placeholder but no label/`aria-label`. A wrapping label with no textual content does not create a useful name. The older global search similarly relies on placeholder/context rather than an explicit input label.

**Operational impact**
Screen-reader users can encounter generic/unlabeled edit controls in key operational searches.

**Performance impact**
None material.

**Recommended remediation**
Make `OpsSearch` require an accessible label prop or include visually-hidden label text. Add explicit labeling to global search.

**Test required**
Automated axe/accessibility-name tests plus keyboard/screen-reader smoke tests across every workspace using shared search primitives.

---

## UI-016 - Mobile operational density remains risky in EDI and Job File controls

**Severity:** P2  
**Confidence:** High  
**Route:** `/admin/edi`; `/admin/jobs/[reference]`  
**File/component:** `app/admin/edi/edi-workspace.tsx`; `app/admin/jobs/[reference]/page.tsx`

**User reproduction steps**
1. Open EDI Gateway on a narrow phone viewport.
2. Inspect the ledger and attempt to compare reference, status, date and message.
3. Open a Job File on the same viewport and scroll through lower content while finance controls are visible.

**Expected experience**
Critical operational identity/status/actions should remain readable without hunting through a wide grid, and fixed actions should not obscure content or collide with mobile browser chrome.

**Actual failure**
The EDI ledger is a `min-w-[900px]` table with 9px text inside a horizontal scroller. It is technically scrollable, but critical columns are separated across a width far beyond a phone viewport and long references/messages increase scan burden.

The Job File can render a fixed bottom-right finance action stack with up to three controls (`Job profitability`, `Create invoice`, `Add supplier bill`) without an evident mobile-specific placement/reserved content inset in the page component.

**Operational impact**
Higher wrong-row/wrong-action risk on phones, especially during pickup/delivery/EDI work where mobile use is plausible.

**Performance impact**
Large client-rendered row sets also increase DOM work on narrow devices.

**Recommended remediation**
Use responsive operational row/cards or pinned identity/status columns for narrow screens, preserve an explicit horizontal-table mode only when useful, and move fixed Job File actions into a mobile-safe action sheet/sticky region with reserved space.

**Test required**
Visual/mobile E2E at 320, 375, 390 and 430px widths covering long references, keyboard/browser chrome, table scrolling, modals/dropdowns, and bottom action overlap.

---

## UI-017 - Firestore index configuration is not versioned while runtime code depends on collection-group queries

**Severity:** P2  
**Confidence:** High  
**Route:** Notifications/assignment feeds; automation/customs/task paths  
**File/component:** `firebase.json`; repository root; `app/admin/notifications/assignment-notifications.server.ts`; `app/admin/alerts/alert-engine.server.ts`; `app/api/admin/notifications/route.ts`

**User reproduction steps**
1. Deploy the same source to a fresh Firebase project without manually recreated indexes.
2. Exercise notification assignment queries using `collectionGroup("job_tasks")` and `collectionGroup("tasks")`, plus other collection-group paths.

**Expected experience**
Required Firestore index state should be reproducible from source control and deployment configuration.

**Actual failure**
No `firestore.indexes.json` was found in the audited tree, and `firebase.json` references only Firestore rules. Runtime code depends on multiple collection-group queries. The notification API comments explicitly anticipate that a missing index may make the assignment feed fail and intentionally degrades that supplemental feed.

This means index availability can depend on manually created project state and can differ between environments.

**Operational impact**
A fresh/staging/DR environment can pass build/tests yet silently lose assignment notifications or fail query paths at runtime. Index drift becomes an operational reliability problem rather than a deploy-time failure.

**Performance impact**
Missing indexes cause query failures; poorly targeted index/query design also encourages the broad scans documented elsewhere.

**Recommended remediation**
Inventory every Firestore query and version required collection-group/composite indexes in the repository. Validate index deployment in CI/staging. When optimizing tender expiry and other range queries, include the new composite requirements explicitly.

**Test required**
Deploy-to-clean-project integration test or emulator/index validation that exercises every collection-group/composite query and fails CI on missing index configuration.

---

## UI-018 - Admin-only search/navigation client code and Operations styles are mounted from the root application layout

**Severity:** P2  
**Confidence:** High  
**Route:** Root application, including non-admin pages  
**File/component:** `app/layout.tsx`; `app/admin/operations-global-search.tsx`; `app/admin/operations-navigation-fallback.tsx`; Operations CSS imports

**User reproduction steps**
1. Inspect the root layout dependency graph/build output for a public page.
2. Compare with a layout where Operations-only client components/styles are scoped under `/admin`.

**Expected experience**
Admin-only global listeners/search infrastructure and admin styling should be scoped to the admin route tree unless there is a deliberate cross-site requirement.

**Actual failure**
`app/layout.tsx` directly mounts `OperationsNavigationFallback` and `OperationsGlobalSearch` for the entire app; they self-disable based on route after client execution. The root layout also imports Operations theme/polish/hotfix CSS globally.

This architecture created UI-001 and places admin-only client dependencies in the root layout graph.

**Operational impact**
Broader coupling makes regressions in Operations navigation capable of affecting the global application shell and makes admin behavior harder to reason about.

**Performance impact**
Potential unnecessary JS/CSS parsing/hydration dependency weight on non-admin routes. Exact bundle bytes require build profiling, but the dependency placement is avoidable.

**Recommended remediation**
Scope Operations-only client components/listeners and styling to `app/admin/layout.tsx` or another admin boundary. Keep the public root layout free of admin search/navigation behavior.

**Test required**
Bundle analyzer/build-budget test comparing public-route JS/CSS before and after scoping; regression test confirming no Operations listeners mount on public pages.

---

## UI-019 - Mobile navigation omits pinned/recent workspaces and does not share desktop reliability behavior

**Severity:** P3  
**Confidence:** High  
**Route:** All `/admin/*` mobile views  
**File/component:** `app/admin/operations-shell.tsx`

**User reproduction steps**
1. Pin several workspaces on desktop and build recent navigation history.
2. Open the mobile menu on the same browser/profile.
3. Compare the mobile menu with desktop sidebar navigation.

**Expected experience**
Pinned/recent navigation should remain useful across responsive variants, or the product should clearly define it as desktop-only. Equivalent links should share the same reliability contract.

**Actual failure**
The desktop sidebar renders Pinned and Recent sections from localStorage. The mobile menu renders only grouped canonical workspaces and sign-out. It omits both Pinned and Recent. It also uses ordinary soft Next.js links and is outside the hard-navigation fallback described in UI-005.

**Operational impact**
Mobile operators lose shortcuts they created on desktop and experience a different navigation reliability model.

**Performance impact**
None material by itself.

**Recommended remediation**
Provide responsive parity for pinned/recent shortcuts where useful and route all menu variants through the same navigation abstraction.

**Test required**
Responsive E2E test that pins/visits workspaces, switches to mobile viewport, verifies shortcut parity, and tests navigation under an injected soft-transition failure.

---

# Executive summary

The current canonical sidebar registry is substantially healthier than KCPL's earlier navigation state: all canonical sidebar hrefs inspected in the static App Router tree exist, permission-aware grouping is centralized in `workflow-navigation.ts`, modifier-clicks are deliberately preserved by the desktop hard-navigation fallback, several major pages keep the Operations shell around their own data-service failure gates, the carrier API layer includes explicit request timeouts, and the notification API already isolates one supplemental assignment source with `Promise.allSettled`.

Those controls are undermined by a second, older navigation/search stack mounted at the application root. That older stack wins Cmd/Ctrl+K and search-button events through capture listeners, has a stale workspace list, and has a weaker permission model. This is the highest-confidence explanation for the previously observed behavior where the sidebar and Cmd+K disagree.

The performance profile also contains several scaling cliffs. The notification bell is the largest recurring background risk. Freight Audit is the strongest serialized N+1 hotspot. Tender Desk, Pickup Scheduling, Payables, EDI and search all use large recent-window scans, and several read/render paths perform persistent maintenance writes. These patterns will become increasingly visible as KCPL moves from paper-era volumes into a long-lived operational database.

No P0 was confirmed. The highest-priority work is to collapse navigation/search to one implementation, eliminate recurring/bulk read amplification, keep primary shells/screens alive when supplemental sources fail, and add browser-level E2E coverage for the historical failure modes.

# Broken/degraded navigation risks

1. **Highest:** duplicate Cmd/Ctrl+K implementations, with the stale root-level implementation winning normal events.
2. **High:** search workspace permissions do not match canonical sidebar permissions.
3. **High:** permissive shell defaults can expose restricted navigation during navigation-capability API failure.
4. **High:** the known hard-navigation fallback only covers desktop `<aside>` links, not mobile/Create/notification routes.
5. **Medium:** query-param focus can drift from client-selected state after same-route navigation or Back/Forward.
6. **Medium:** command results use buttons/imperative navigation rather than normal link semantics, weakening modifier/new-tab behavior.
7. **Low:** pinned/recent navigation disappears on mobile.

Static route inspection did **not** identify a dead href among the current canonical `workflowWorkspaces` sidebar destinations. Create menu `/admin/finance/new` also exists in the route tree. The principal navigation defect is disagreement between navigation systems rather than missing canonical page files.

# Mobile risks

- Mobile menu bypasses the desktop hard-navigation reliability fallback.
- Pinned/recent shortcuts are absent from the mobile menu.
- EDI uses a 900px-minimum table with 9px text, making identity/status comparison horizontally expensive on a phone.
- Job File finance actions can form a fixed bottom-right stack with no obvious mobile-specific safe area in the page component.
- Large client-side row sets in Pickup/EDI/Freight Audit increase DOM and interaction cost on lower-powered devices.
- Shared search accessibility naming and command-dialog focus behavior affect mobile assistive technology as well as desktop.

# Performance hotspots ranked by impact

1. **Notification polling** - every 30 seconds per open admin tab; explicit query limits and N+1 customer task hydration can push a pathological request above 10,000 reads.
2. **Freight Audit queue** - serialized per-payable read/query/write loop across up to 250 rows; easily >1,000 operations plus write-on-read behavior.
3. **Pickup Scheduling** - 2,000 shipments + 2,000 appointments before linked customer/quote/tender hydration.
4. **Tender Desk** - expiry scan/write path plus up to 1,000 tenders, 500 orders and 2,000 customers; expiry logic duplicated across reconciliation/listing.
5. **Payables dashboard** - up to 3,000 reads and mass status writes; one batch can exceed the 500-write limit.
6. **Operations search** - up to 2,650 recent document reads per newer debounced query for a fully privileged role; current older search builds a 1,000-document index.
7. **EDI Gateway** - up to 750 EDI rows plus 1,000 tenders, with the supplemental tender source capable of taking down the ledger.
8. **Carrier Integrations** - up to 1,500 recent shipments are scanned and only then filtered/sliced for the dashboard.
9. **Digital Job File** - multiple per-record subcollection reads are reasonable compared with the above, but mutations often reload broad Job File context and page supplements are all coupled in one Promise chain.

# Likely Firestore-index problems

- No version-controlled `firestore.indexes.json` was found, so required manually scoped indexes cannot be reconstructed from the repository.
- `collectionGroup("job_tasks")` queries filter by `assigned_to_uid` and `assigned_to_email`.
- `collectionGroup("tasks")` queries filter by `assigned_to_uid` and `assigned_to_email`.
- Automation paths also use collection-group reads such as `customs_steps`.
- The notification endpoint's own comment acknowledges missing-index risk for assignment notification collection-group queries.
- Existing simple equality/order queries may currently work through automatic/project-created indexes, but the absence of a manifest makes environment parity unverifiable.
- A proper optimized expiry query using status + response due time will likely introduce an explicit composite-index requirement and should be versioned with the code rather than created ad hoc.

# Reliability anti-patterns

- Duplicate global event owners for the same Cmd/Ctrl+K interaction.
- Multiple hard-coded workspace registries and permission models.
- Permissive UI capability defaults corrected later by a best-effort client fetch.
- Hard-navigation fallback applied to one DOM location rather than one navigation abstraction.
- Broad `Promise.all` coupling where one supplemental source removes an otherwise useful screen.
- Firestore maintenance writes during GET/server render paths.
- Large recent-window collection scans followed by in-memory filtering.
- N+1 reads inside loops, including serial customer hydration and Freight Audit reconstruction.
- Polling without hidden-tab suspension, backoff, jitter or overlap protection.
- Client state initialized from URL-derived props without resynchronization on search-param changes.
- Large client-side queues with no pagination.
- Missing source-controlled Firestore index manifest.

# Missing E2E tests

The repository test script contains domain/security/navigation unit tests but no Playwright/Cypress/browser E2E dependency or browser navigation suite was found. `tests/workflow-navigation.test.mjs` validates the canonical registry in isolation, which is useful but cannot detect the root-layout/global-search collision.

Priority missing browser tests:

1. Root layout + admin shell Cmd/Ctrl+K integration, exactly one palette.
2. Every visible sidebar workspace discoverable in Cmd/Ctrl+K for each role.
3. Desktop sidebar, mobile menu, Create, notification and search navigation under failed RSC transition.
4. Back/Forward and same-route query-param focus for Tender, Pickup and Freight Audit.
5. Search rapid typing, response ordering, aborts, Firebase outage and older exact references.
6. 401/403/404/409/500/503 fault matrix with shell-preservation assertions.
7. Job File supplemental failures independently injected.
8. EDI ledger with Tender source down and Tender handoff with EDI source down.
9. Mobile table/form/modal/dropdown coverage at narrow viewports and long references.
10. Accessibility: focus trap/restoration, search labels, keyboard selection, table semantics, form errors and touch targets.
11. Double-submit/busy-state tests for every mutation flow, including navigation during mutation.
12. Firestore read-budget tests for notifications, Freight Audit, Pickup, Tender, Payables and search.
13. Fresh-environment Firestore index validation.

# Top remediation priorities

1. **Unify navigation/search immediately.** Remove the duplicate root-level command search and make `workflowWorkspaces` plus one capability object authoritative everywhere.
2. **Fix background read amplification.** Replace the 30-second notification fanout with a bounded/materialized feed and stop polling hidden/erroring tabs aggressively.
3. **Eliminate Freight Audit N+1/write-on-read behavior.** Bulk load and paginate before this dataset grows further.
4. **Make read paths read-only.** Move tender expiry, payable status reconciliation and audit persistence out of ordinary page rendering.
5. **Preserve useful screens under partial failure.** Isolate Job File supplements and EDI tender handoff from their primary workspace.
6. **Redesign broad scans.** Pickup, Tender, search, Payables, EDI and Carrier Integrations need query-state pagination and direct operational filters.
7. **Make URL focus authoritative.** Fix query-param/back-forward synchronization before operators rely heavily on cross-workspace deep links.
8. **Version Firestore indexes.** Treat index state as deployable application configuration.
9. **Add browser E2E before more navigation polish.** The current unit navigation test cannot catch the historical soft-nav/Cmd+K class of failures.
10. **Close mobile/accessibility gaps.** Search names, dialog focus, link semantics, mobile data density and fixed actions should be tested as operational reliability, not cosmetic polish.

# Continuation section

A follow-up audit pass should begin from the then-current `main` and verify remediation with runtime browser instrumentation rather than source inspection alone. The highest-value continuation checks are: capture actual Firestore read counts for one minute of idle admin use; run browser fault injection against Next RSC transitions; profile Freight Audit/Pickup/Tender/Payables with production-scale synthetic data; verify every required Firestore index in a clean environment; and add/execute role-aware Playwright coverage for sidebar, mobile navigation, Cmd/Ctrl+K, query-param history, API 401/403/404/409/500/503 states, and modifier/new-tab navigation.

No application fix is included in this audit.