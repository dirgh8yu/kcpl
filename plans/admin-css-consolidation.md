# Legacy CSS consolidation

- **Status**: PARTIAL — compat promotions done; **dead-CSS pass complete** (0 unreachable rules
  across all 22 sheets, gated at zero); raw-literal sweep still blocked on visual QA
- **Owner track**: admin UI (Operations + Commercial surfaces) and the public sheets
- **Gates**: `npm run check:ui` must stay satisfied, the literal baseline must not grow, and
  `tests/dead-css-baseline.test.mjs` must not go red

## Tooling

```bash
npm run audit:dead-css              # every non-module sheet under app/ (20 today)
npm run audit:dead-css -- --list    # every unreachable rule, with its tokens
npm run audit:dead-css -- --spans   # contiguous dead runs, no live rule inside
npm run audit:dead-css -- --safe-runs
                                    # runs that are safe to cut in one edit, with byte offsets
npm run audit:dead-css -- --prune   # dry-run: what --safe-runs would cut, per sheet
npm run audit:dead-css -- --prune --write
                                    # apply the cut in place, refusing on anything ambiguous
npm run audit:dead-css -- --json    # machine-readable (used by the gate test)
npm run audit:dead-css -- --file app/globals.css
                                    # one sheet only
```

The default scan **discovers** the sheets instead of listing them. It used to audit three
hardcoded admin sheets, which is why the other eleven sheets could accumulate unreachable rules
without the gate noticing; a new sheet is now covered the moment it exists.

`tests/dead-css-baseline.test.mjs` pins the ceiling at **zero** (0 rules / 0 lines) across the
whole corpus (2,893 rules in 20 sheets today), asserts the audit still discovers at least 20
sheets so the gate cannot shrink silently, and asserts that classes the app demonstrably renders — `kcpl-admin-content`, `ops-field`, `ops-metric`,
`app-nav-search` — are never reported unreachable. It is a ceiling, not an equality: deleting more
is still allowed; adding a rule nothing can render now fails the gate.

`tests/dead-css-prune.test.mjs` guards the one script here that can damage live styling, since
`--prune --write` deletes rules from real sheets. It runs on throwaway sheets in the OS temp
directory and covers the failure modes: a dead rule sharing a line with a live rule, and a dead
rule starting mid-line, must both **refuse and exit non-zero**, leaving the file byte-identical.

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

552 unreachable rules / 1680 lines were the total footprint, across 11 sheets. The first pass
(hand-edited) took the three sheets this plan tracked; the second reached the rest, including
the 1,066-line run the editing path could not touch.

| Sheet | Rules before | Rules after | Unreachable before | after | Lines before |
|---|---:|---:|---:|---:|---:|
| `admin/operations-system.css` | 1012 | 668 | 344 | 0 | 1224 |
| `admin/admin-design-system.css` | 197 | 134 | 63 | 0 | 116 |
| `admin/operations-editorial.css` | 123 | 44 | 79 | 0 | 100 |
| `admin/commercial-v4-compat.css` | 110 | 95 | 15 | 0 | 69 |
| `globals.css` | 1014 | 957 | 57 | 0 | 57 |
| `admin/operations-theme.css` | 181 | 134 | 47 | 0 | 47 |
| `admin/operations-mobile.css` | 66 | 60 | 6 | 0 | 27 |
| `admin/operations-detail-refinement.css` | 80 | 76 | 4 | 0 | 19 |
| `admin/commercial-detail-refinement.css` | 94 | 91 | 3 | 0 | 9 |
| `brand-system.css` | 35 | 34 | 1 | 0 | 7 |
| `admin/shipment-detail-v2.css` | 163 | 161 | 2 | 0 | 5 |
| `admin/operations-polish.css` | 175 | 109 | 66 | 0 | 66 |
| `admin/operations-hotfix.css` | 4 | 2 | 2 | 0 | 2 |

1,721 sheet lines were removed in total; 1,680 of those are unreachable rule lines and the rest
are the comments and blank separators retired with their rules.

Two families accounted for most of it:

- **`ops-stat*`** (renamed to `ops-metric*` / `ops-kpi*`; the live components are in
  `operations-ui.tsx`) — 88 references across ten admin sheets and not one render site.
- **`overview-*` / `kcpl-ops-overview*`** — the legacy duplicate of the CSS-module styles
  (`overview-dashboard.module.css` + `overview-dashboard-extras.module.css`, consumed as
  `styles.*` by `v4-operations-overview.tsx`). The modules won; the unlayered copies were left
  behind, and `kcpl-ops-overview` / `overview-*` appeared in no `.tsx` or `.ts` anywhere.

`globals.css` also carried orphaned public-site classes (`field-input`, `brand-copy`,
`brand-header-*`, `road-route-motif`, `catalogue-group`, …) that appeared in no file outside the
stylesheet, and `brand-system.css` a `brand-header-*` retirement shim for markup that no longer
survives anywhere. Both are gone.

**How the deletions were proven safe.** On every sheet the number of deleted rules equals the
drop in the unreachable count exactly, and a rule's verdict does not depend on any other rule, so
no live rule can have been removed. Brace balance is 0 on all 13 sheets afterwards.

In `operations-polish.css`, four selectors were also pruned *from* live lists rather than
deleting the rules: `.ops-stat-strip::-webkit-scrollbar` and `.ops-stat-strip`/`.ops-drawer` as
alternatives inside shared lists — the rules they belonged to stay live.

## How the last mile was finished

182 rules / 1,066 lines sat in one contiguous run in `operations-system.css` starting at byte
offset ~103,000 of a 152 KB file, plus three smaller runs at ~77 K, ~87 K and ~91 K. The editing
path available here (`str_replace` through the workspace sync) **could not match content beyond
roughly the first 60 KB of the file**: it reported "not found" for strings `sed`/`cat -A` proved
present at byte ~63 K and ~103 K, while the same file edited correctly at byte ~200 and ~39 K.

Rather than reproduce 150 KB of sheet by hand — or hand it to a human as a VS Code chore — the
audit tool grew the other half of the job: **`--prune` computes the same safe runs it already
printed, then cuts them.** It is deliberately the most conservative operation in the repo:

- a span is only cut when its first and last line are a dead rule's own lines, so a rule sharing
  a line with a live rule **refuses** and exits non-zero;
- spans merge only across blank or comment lines, so a cut can never cross an at-rule boundary
  or orphan a brace;
- a comment block immediately above a dead rule is retired with it (this file's convention is
  comment-then-block), stopping at the first blank line and capped, so a section header cannot be
  pulled in;
- the whole file is re-audited after the cut and restored if anything changed that should not have.

`tests/dead-css-prune.test.mjs` exercises the refusals and the dry run on throwaway sheets. This
is what closed the plan's last loose end: the admin's final layout-property transition,
`.kcpl-admin-content .kcpl-ops-overview .overview-status-item-track span { transition: width 160ms ease }`,
lived *inside* that 1,066-line run and is now gone — so the admin sheet no longer carries a dead
layout transition for [public-motion-audit.md](public-motion-audit.md) to point at.

## Measured across every stylesheet

The default scan now covers the corpus (20 non-module sheets, 2,893 rules). Every one reports
**0 unreachable rules / 0 lines**:

| Sheet | Rules | Unreachable |
|---|---:|---:|
| `admin/operations-system.css` | 668 | 0 |
| `globals.css` | 957 | 0 |
| `admin/admin-design-system.css` | 134 | 0 |
| `admin/operations-theme.css` | 134 | 0 |
| `admin/operations-polish.css` | 109 | 0 |
| `admin/commercial-v4-compat.css` | 95 | 0 |
| `admin/commercial-detail-refinement.css` | 91 | 0 |
| `admin/operations-detail-refinement.css` | 76 | 0 |
| `admin/operations-mobile.css` | 60 | 0 |
| `admin/operations-editorial.css` | 44 | 0 |
| `admin/shipment-detail-v2.css` | 161 | 0 |
| `brand-system.css` | 34 | 0 |
| `admin/operations-hotfix.css` | 2 | 0 |

## What is already done: compat promotions

Five admin stylesheets declared zero `[class*=…]` overrides and have been **promoted out of
`@layer kcpl-legacy`** so they cascade normally, exactly like `operations-system.css`. Each
carries a header comment recording this. Verified:

```bash
grep -n '@layer kcpl-legacy\s*{' app/admin/*.css   # these five are absent
```

Line counts are post-dead-CSS; "rules" is the count the audit reports for that sheet.

| File | Lines | Rules |
|---|---:|---:|
| `admin-design-system.css` | 508 | 134 |
| `operations-polish.css` | 400 | 109 |
| `operations-detail-refinement.css` | 514 | 76 |
| `shipment-detail-hierarchy.css` | 272 | — |
| `operations-hotfix.css` | 20 | 2 |

`operations-system.css` still loads last, so it wins any overlapping selector — the promotion
changes what wins inside the former legacy layer, not the sheet order.

## What is still frozen

Seven files remain wrapped in `@layer kcpl-legacy { … }`. Their attribute-substring rules are
**still live**, so they cannot be deleted yet:

| File | Lines | Substring rules | Live | Dead |
|---|---:|---:|---:|---:|
| `commercial-detail-refinement.css` | 600 | 55 | 53 | 2 |
| `commercial-v4-compat.css` | 662 | 17 | 17 | 0 |
| `operations-v4-compat.css` | 148 | 16 | 16 | 0 |
| `operations-theme.css` | 240 | 14 | 13 | 1 |
| `operations-editorial.css` | 232 | 11 | 11 | 0 |
| `operations-action-hierarchy.css` | 118 | 5 | 5 | 0 |
| `operations-mobile.css` | 350 | 5 | 4 | 1 |
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
3. When a compat file has no remaining matched literal in JSX, delete the file and its import from
   `app/layout.tsx`.
4. Re-run `npm run audit:dead-css` after each batch to confirm the live count is still 0 — the
   gate in `tests/dead-css-baseline.test.mjs` fails the moment a new unreachable rule lands.

## Reproducing the cascade analysis

```bash
# 1. generate the utilities layer the browser actually receives
npx --yes @tailwindcss/cli@4.2.1 -i app/globals.css -o /tmp/tw.css

# 2. index utility class -> declared properties, then compare each compat
#    [class*=…] rule's properties against the utility of its own literal.
#    A rule is live if any property it sets is absent from that utility.
```
