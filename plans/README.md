# Motion and UI plans

Status index for the `plans/` directory. Produced by the `improve-animations` /
`find-animation-opportunities` skills (Emil Kowalski motion philosophy, see
`.claude/skills/`). One row per plan; update the status column when a plan lands.

| # | Plan | Area | Severity | Status |
|---|---|---|---|---|
| — | [admin-motion-audit.md](admin-motion-audit.md) | `app/admin/**` motion | MEDIUM | **DONE** — all 7 opportunities shipped at `c86557e` |
| — | [public-motion-audit.md](public-motion-audit.md) | Public site motion | HIGH | **DONE** at `c86557e`; both `AUDIT.md` deviations now **decided and closed**, and the feel-checks are enforced by `tests/public-ui-motion-contract.test.mjs` |
| — | [admin-css-consolidation.md](admin-css-consolidation.md) | Admin stylesheets | MEDIUM | **PARTIAL** — 5 files promoted out of `@layer kcpl-legacy`; 7 files / 119 live compat rules remain and are blocked on visual QA. Dead CSS is now measured by `npm run audit:dead-css` and gated by `tests/dead-css-baseline.test.mjs`: 137 unreachable rules deleted, 275 rules / 1224 lines left in `operations-system.css` (one 1066-line run, too large for the capped editing path), and 552 rules / 1680 lines across all 22 sheets |

## Execution order

1. `admin-motion-audit.md` (#1–#7) — overlays and primitives first; the shell is the most-used surface. ✅
2. `public-motion-audit.md` — tokens, press feedback and hover gating across `app/globals.css`. ✅
3. `admin-css-consolidation.md` — the only plan still open. Independent of the motion work: it is a raw-hex-to-token sweep across admin JSX, best done file-by-file with `npm run check:ui` after each batch. **Blocked on browser access** — the compat rules only lose to Tailwind's arbitrary-value utilities where the utility declares the same property, so the sweep re-skins the staff product rather than being a mechanical no-op. Its dead-CSS half no longer needs a browser for *measurement* (`npm run audit:dead-css`), only for the last-mile deletion, which is too large for the capped edit path in this workspace.

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
| 1 — transform/opacity/colour only | `tests/public-ui-motion-contract.test.mjs` test 1 (public sheet). Admin sheet is review-only; it still carries one dead layout transition (`overview-status-item-track span`, `operations-system.css:2250`) inside the retired block that the capped edit path could not remove, see `admin-css-consolidation.md`. |
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
