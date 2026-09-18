# Legacy CSS consolidation

- **Status**: PARTIAL — compat promotions done, dead-CSS pass started and gated; raw-literal sweep still blocked on visual QA
- **Owner track**: admin UI (Operations + Commercial surfaces) and the public sheets
- **Gates**: `npm run check:ui` must stay satisfied, the literal baseline must not grow, and
  `tests/dead-css-baseline.test.mjs` must not go red

## Tooling

```bash
npm run audit:dead-css              # three admin sheets (system, polish, hotfix)
npm run audit:dead-css -- --list    # every unreachable rule, with its tokens
npm run audit:dead-css -- --spans   # contiguous dead runs, no live rule inside
npm run audit:dead-css -- --safe-runs
                                    # runs that are safe to cut in one edit, with byte offsets
npm run audit:dead-css -- --json    # machine-readable (used by the gate test)
npm run audit:dead-css -- --file app/globals.css
                                    # any sheet, including the public ones
```

`tests/dead-css-baseline.test.mjs` pins the current ceiling (275 rules / 1224 lines across the
three sheets) and asserts that classes the app demonstrably renders — `kcpl-admin-content`,
`ops-field`, `ops-metric`, `app-nav-search` — are never reported unreachable. It is a ceiling,
not an equality: deleting more is always allowed.

## Method, and the two bugs that had to be fixed first

A rule is unreachable when **every** selector in its list requires a class that cannot render.
Two corrections matter, because an over-eager "dead" verdict deletes live styling:

1. **`:where()` / `:is()` are selector lists, not conjunctions.** `.a :where(.b, .c)` matches
   when *either* alternative matches, so a rule is dead only when *no* alternative can match.
   An earlier version of this audit treated any single unreachable class as fatal and therefore
   reported live rules as dead. `:not()` is ignored (it constrains nothing decidable here) and
   `:has()` is treated as a choice.
2. **CSS-module classes are never string literals.** They are consumed as
   `styles.overviewDashboardKpi`, so a scan for quoted tokens sees nothing and reports the whole
   module sheet as dead. Every class defined in a `*.module.css` is now live in both its kebab
   and camelCase spellings. Before this fix, `overview-dashboard.module.css` looked 135/164 dead;
   it is now 0.

"Can render" is deliberately **over**-approximated, so the audit can only under-report dead
rules:

1. every kebab token anywhere in `app/**/*.{ts,tsx}` — catches
   `className={cond ? "a" : "b"}` and lookup objects, which a `className="…"`-only scan misses;
2. every word inside a string literal in those files — single-word classes such as `loc` and
   `grid` are real and an earlier hyphen-only token scan missed them;
3. every class in every `*.module.css`;
4. `className` template literals, compiled to globs, so `affiliation-mark-${x}` keeps
   `affiliation-mark-*` alive;
5. the rendered-token snapshot from `scripts/qa-render-inventory.mjs`, when present.

Rules are found by a character-level parser that descends into at-rules and expands nesting, so
a dead rule inside `@media` is reported — a media query is not a reason for a selector to start
matching. Comments are blanked rather than removed, so reported line numbers address the real
file.

## What this pass deleted (verified)

| Sheet | Rules before | Rules after | Unreachable before | after |
|---|---:|---:|---:|---:|
| `operations-system.css` | 1012 | 943 | 344 | 275 |
| `operations-polish.css` | 175 | 109 | 66 | 0 |
| `operations-hotfix.css` | 4 | 2 | 2 | 0 |

137 unreachable rules removed (~200 lines), including the whole `ops-stat*` family in
`operations-polish.css`, the `.shipment-peek-*` / `.shipments-register-*` / `.shipments-table`
duplicates, and a first slice of the retired `overview-dashboard-*` / `.overview-*` copies in the
system sheet.

**One loose end stays open.** The admin's last layout-property transition,
`.kcpl-admin-content .kcpl-ops-overview .overview-status-item-track span { transition: width 160ms ease }`,
is still in the sheet at line 2250 *inside the unreachable run described below* — so it cannot
apply either, but it is not deleted, and it is still the example
[public-motion-audit.md](public-motion-audit.md) points at.

**How the deletion was proven safe.** On every sheet the number of deleted rules equals the
drop in the unreachable count exactly (69 = 344−275, 66 = 66−0, 2 = 2−0), and a rule's verdict
does not depend on any other rule, so no live rule can have been removed. Brace balance is 0 on
both sheets afterwards.

In `operations-polish.css`, four selectors were also pruned *from* live lists rather than
deleting the rules: `.ops-stat-strip::-webkit-scrollbar` and `.ops-stat-strip`/`.ops-drawer` as
alternatives inside shared lists — the rules they belonged to stay live.

## What is still in the three sheets, and why

275 rules / 1224 lines remain in `operations-system.css`, of which **182 rules / 1066 lines are
one contiguous run** starting at byte offset ~103,000 of a 152 KB file, plus three smaller runs
at ~77 K, ~87 K and ~91 K bytes.

They are not undeleted by choice. The editing path available here (`str_replace` through the
workspace sync) **could not match content beyond roughly the first 60 KB of the file**: it
reported "not found" for strings that `sed`/`cat -A` proved present at byte ~63 K and ~103 K,
while the same file edited correctly at byte ~200 and ~39 K. Reproducing 150 KB of sheet by hand
through a full-file write is not a safe way to finish it.

So the last mile needs one of:

1. VS Code in the workspace (no cap) plus `npm run audit:dead-css -- --safe-runs` for the exact
   ranges — the run list and byte offsets are printed for that purpose;
2. or a browser-verified pass, which is what the remaining work needs anyway.

The mechanism behind the block is known: it is the **legacy duplicate of the CSS-module styles**
(`overview-dashboard.module.css` + `overview-dashboard-extras.module.css`, consumed as
`styles.*` by `v4-operations-overview.tsx`). The modules won; the unlayered copies were left
behind, and `kcpl-ops-overview` / `overview-*` appear in no `.tsx` or `.ts` anywhere.

## Measured across every stylesheet

Same tool, `--file` on each sheet — the dead-CSS footprint is much wider than the three sheets
this plan tracked. 552 unreachable rules / 1680 lines of 3627:

| Sheet | Rules | Unreachable | Lines |
|---|---:|---:|---:|
| `admin/operations-system.css` | 943 | 275 | 1224 |
| `admin/admin-design-system.css` | 197 | 63 | 116 |
| `admin/operations-editorial.css` | 123 | 79 | 100 |
| `admin/commercial-v4-compat.css` | 110 | 15 | 69 |
| `globals.css` | 1014 | 57 | 57 |
| `admin/operations-theme.css` | 181 | 47 | 47 |
| `admin/operations-mobile.css` | 66 | 6 | 27 |
| `admin/operations-detail-refinement.css` | 80 | 4 | 19 |
| `admin/commercial-detail-refinement.css` | 94 | 3 | 9 |
| `brand-system.css` | 35 | 1 | 7 |
| `admin/shipment-detail-v2.css` | 163 | 2 | 5 |

Two families account for most of it:

- **`ops-stat*`** (renamed to `ops-metric*` / `ops-kpi*`; the live components are in
  `operations-ui.tsx`) — 88 references across ten admin sheets and not one render site.
- **`overview-*` / `kcpl-ops-overview*`** — the module duplicate described above.

`globals.css` also carries orphaned public-site classes (`field-input`, `brand-copy`,
`brand-header-*`, `road-route-motif`, `catalogue-group`, …) that appear in no file outside the
stylesheet. Worth its own pass; not touched here because `globals.css` is the shared root sheet
and it needs the same visual check as the rest.

## What is already done: compat promotions

Five admin stylesheets declared zero `[class*=…]` overrides and have been **promoted out of
`@layer kcpl-legacy`** so they cascade normally, exactly like `operations-system.css`. Each
carries a header comment recording this. Verified:

```bash
grep -n '@layer kcpl-legacy\s*{' app/admin/*.css   # these five are absent
```

| File | Lines | Rules |
|---|---:|---:|
| `admin-design-system.css` | 630 | 197 |
| `operations-polish.css` | 553 | 175 |
| `operations-detail-refinement.css` | 536 | 80 |
| `shipment-detail-hierarchy.css` | 273 | 49 |
| `operations-hotfix.css` | 37 | 4 |

`operations-system.css` still loads last, so it wins any overlapping selector — the promotion
changes what wins inside the former legacy layer, not the sheet order.

## What is still frozen

Seven files remain wrapped in `@layer kcpl-legacy { … }`. Their attribute-substring rules are
**still live**, so they cannot be deleted yet:

| File | Lines | Substring rules | Live | Dead |
|---|---:|---:|---:|---:|
| `commercial-detail-refinement.css` | 611 | 55 | 53 | 2 |
| `commercial-v4-compat.css` | 743 | 17 | 17 | 0 |
| `operations-v4-compat.css` | 149 | 16 | 16 | 0 |
| `operations-theme.css` | 289 | 14 | 13 | 1 |
| `operations-editorial.css` | 345 | 11 | 11 | 0 |
| `operations-action-hierarchy.css` | 119 | 5 | 5 | 0 |
| `operations-mobile.css` | 383 | 5 | 4 | 1 |
| **total** | | **123** | **119** | **4** |

"Substring rules" counts rule *blocks* containing `[class*="…"]`, not comma-separated selector
lines — the earlier estimate of 310 counted selector lines, which overstates the work roughly
threefold. A rule is scored **dead** only when *every* literal in its selector group has a
generated Tailwind utility that declares *every* property the rule sets.

## The finding that changes how the JSX sweep must be done

The root sheet declares its cascade order once, in `app/globals.css:2`:

```css
@layer theme, base, kcpl-legacy, components, utilities;
```

`utilities` is **last**, and layer order beats specificity. So a Tailwind arbitrary-value
utility always outranks the compat rule written to retarget it:

```css
/* @layer utilities — wins */
.bg-\[\#091624\] { background-color: #091624; }
/* @layer kcpl-legacy — loses */
.kcpl-ops [class*="bg-[#091624]"] { background-color: var(--ops-accent); }
```

Only the 119 live rules survive that comparison, and only because each sets at least one property
the competing utility does **not** declare (padding, letter-spacing, grid-template-columns,
backdrop-filter, box-shadow, border-color, …).

**Consequences for the JSX sweep — the plan's original premise was wrong in one important way:**

1. The compat files are not "retargeting hexes to tokens" in the way their banner claims. For any
   property the utility also declares, the raw hex is what actually renders today.
2. Replacing `bg-[#091624]` with `bg-[var(--ops-accent)]` in JSX is therefore **not a no-op** — it
   changes a navy surface to coral. The sweep is a re-skin that changes the rendered admin UI, and
   every change has to be looked at.
3. Live-rule count is the scoreboard: it must fall, and `npm run check:ui` must keep passing.

## Why the literal sweep is still not done

~123 live compat rules still depend on raw literals in `app/admin/**/*.tsx` (28 files, ~178
literal occurrences). Per the finding above the sweep changes rendered colour and spacing across
the whole staff product, and the admin UI is authenticated behind Firebase — it cannot be
rendered or screenshotted from this environment; the one attempt recorded in PR #214's test plan
was blocked the same way ("no Firebase credentials in this dev environment").

Shipping a blind 178-site substitution nobody can look at would trade a known, working legacy
layer for an unknown set of visual regressions. It needs a browser session with staff access.
`scripts/qa-render-inventory.mjs` (with the QA auth bypass) covers the auth half and reports which
literals actually reach the DOM; it cannot judge colour.

## Next steps (in order)

1. Open the admin product with real credentials and capture the current appearance of each of the
   7 frozen files' surface areas (Operations overview, shipment detail, commercial workspaces,
   mobile).
2. Sweep file-by-file, not hex-by-hex: for each `.tsx`, replace its arbitrary literals with the
   token named by that file's own compat rule, then `npm run check:ui` and eyeball the screen.
3. Finish the dead-CSS deletion with an editor that has no content cap, using
   `npm run audit:dead-css -- --safe-runs` for the ranges, then lower the ceiling in
   `tests/dead-css-baseline.test.mjs`.
4. Clean the `ops-stat*` family out of the other nine admin sheets, and the orphaned public-site
   classes out of `globals.css`.
5. When a compat file has no remaining matched literal in JSX, delete the file and its import from
   `app/layout.tsx`.
6. Re-run `npm run audit:dead-css` after each batch to confirm the live count is falling.

## Reproducing the cascade analysis

```bash
# 1. generate the utilities layer the browser actually receives
npx --yes @tailwindcss/cli@4.2.1 -i app/globals.css -o /tmp/tw.css

# 2. index utility class -> declared properties, then compare each compat
#    [class*=…] rule's properties against the utility of its own literal.
#    A rule is live if any property it sets is absent from that utility.
```
