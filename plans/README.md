# Motion and UI plans

Status index for the `plans/` directory. Produced by the `improve-animations` /
`find-animation-opportunities` skills (Emil Kowalski motion philosophy, see
`.claude/skills/`). One row per plan; update the status column when a plan lands.

## Installing the skills

The skill bodies are local dev tooling, not app code, so `.agents/` and
`.claude/` stay gitignored. Install them before doing motion work:

```bash
npx skills add emilkowalski/skill
```

That writes `.agents/skills/*` and symlinks `.claude/skills/*` at the paths this
directory cites — notably
[`.claude/skills/improve-animations/AUDIT.md`](../.claude/skills/improve-animations/AUDIT.md),
the source of the standing rules below and of the `AUDIT.md §5` decisions closed
in [public-motion-audit.md](public-motion-audit.md).

`skills-lock.json` **is** tracked, and pins the exact revisions the audits in this
directory were written against. If `npx skills add` resolves a newer skill, the
lockfile hashes change — re-read the rules before assuming an old audit's
reasoning still holds.

| # | Plan | Area | Severity | Status |
|---|---|---|---|---|
| — | [admin-motion-audit.md](admin-motion-audit.md) | `app/admin/**` motion | MEDIUM | **DONE** — all 7 opportunities shipped at `c86557e` |
| — | [public-motion-audit.md](public-motion-audit.md) | Public site motion | HIGH | **DONE** at `c86557e`; both `AUDIT.md` deviations now **decided and closed**, and the feel-checks are enforced by `tests/public-ui-motion-contract.test.mjs` |
| — | [admin-css-consolidation.md](admin-css-consolidation.md) | Admin stylesheets | MEDIUM | **PARTIAL** — 5 files promoted out of `@layer kcpl-legacy`; 7 files / 119 live compat rules remain and are blocked on visual QA. **Dead CSS is finished**: `npm run audit:dead-css` scans every non-module sheet under `app/` (20 sheets, 2,893 rules) and reports 0 unreachable rules / 0 lines (552 rules / 1,680 lines deleted), the ceiling in `tests/dead-css-baseline.test.mjs` is now **0**, and `--prune --write` is the tool that cut the 1,066-line run the capped editing path could not reach, guarded by `tests/dead-css-prune.test.mjs` |

## Execution order

1. `admin-motion-audit.md` (#1–#7) — overlays and primitives first; the shell is the most-used surface. ✅
2. `public-motion-audit.md` — tokens, press feedback and hover gating across `app/globals.css`. ✅
3. `admin-css-consolidation.md` — the only plan still open. Independent of the motion work: it is a raw-hex-to-token sweep across admin JSX, best done file-by-file with `npm run check:ui` after each batch. **Blocked on browser access** — the compat rules only lose to Tailwind's arbitrary-value utilities where the utility declares the same property, so the sweep re-skins the staff product rather than being a mechanical no-op. Its dead-CSS half is **complete** (`npm run audit:dead-css` reports 0, gated at 0 by `tests/dead-css-baseline.test.mjs`); what remains is the raw-literal half, which needs a browser.

## Dependencies

- All motion plans depend on the shared tokens: `--ease-out` / `--ease-in-out` /
  `--ease-drawer` in `app/globals.css` and `--app-ease-*` / `--app-duration-*` in
  `app/admin/operations-system.css`. Add curves there, never inline in a component.
- `public-motion-audit.md` and `admin-motion-audit.md` touch disjoint stylesheets
  and can run in parallel, except for the reduced-motion carve-outs, which must be
  added to the sheet that owns the transition.
- The `.why-stage` hover move now lives in `app/globals.css`, not in
  `app/components/home-motion.tsx` — keep it there so touch devices never see it.

## Enforcement map for the standing rules

| Rule | Enforced by |
|---|---|
| 1 — transform/opacity/colour only | `tests/public-ui-motion-contract.test.mjs` test 1 (public sheet). Admin sheet is review-only; the dead layout transition (`overview-status-item-track span`) it used to carry was removed by the 2026-09 dead-CSS prune, see `admin-css-consolidation.md`. |
| 2 — moving `:hover` behind `@media (hover: hover) and (pointer: fine)` | review-only |
| 3 — reduced-motion carve-out for multi-class rules | `tests/public-ui-motion-contract.test.mjs` test 4 (blanket reset present + `.why-stage` carve-out). New multi-class rules elsewhere still need their own. |
| 4 — stylesheet order, no `!important`, no `[class*=…]` in the shared sheet | `scripts/check-ui-contract.mjs` (`npm run check:ui`) |

## Standing rules for new motion work

Full rules live in `.claude/skills/improve-animations/AUDIT.md`. The four that keep
biting this repo:

1. Animate `transform` / `opacity` / colour only — never `width`, `height`, `top`,
   `left`, `margin` or `font-size`.
2. Every `:hover` rule that moves must sit inside
   `@media (hover: hover) and (pointer: fine)`.
3. Both stylesheets reset transitions under `prefers-reduced-motion` with a
   low-specificity blanket rule, so any new rule with two or more classes needs its
   own carve-out or it will keep animating.
4. `app/admin/operations-system.css` must stay the last root stylesheet import and
   must not use `!important` or `[class*=…]` selectors (enforced by
   `scripts/check-ui-contract.mjs`).
