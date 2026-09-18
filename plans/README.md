# Motion and UI plans

Status index for the `plans/` directory. Produced by the `improve-animations` /
`find-animation-opportunities` skills (Emil Kowalski motion philosophy, see
`.claude/skills/`). One row per plan; update the status column when a plan lands.

| # | Plan | Area | Severity | Status |
|---|---|---|---|---|
| — | [admin-motion-audit.md](admin-motion-audit.md) | `app/admin/**` motion | MEDIUM | **DONE** — all 7 opportunities shipped at `c86557e` |
| — | [public-motion-audit.md](public-motion-audit.md) | Public site motion | HIGH | **DONE** at `c86557e` — two deviations documented in the file |
| — | [admin-css-consolidation.md](admin-css-consolidation.md) | Admin stylesheets | MEDIUM | **TODO** — not started; all 15 stylesheets are still imported from `app/layout.tsx` |

## Execution order

1. `admin-motion-audit.md` (#1–#7) — overlays and primitives first; the shell is the most-used surface. ✅
2. `public-motion-audit.md` — tokens, press feedback and hover gating across `app/globals.css`. ✅
3. `admin-css-consolidation.md` — styling maintenance, the only plan still open. Independent of the motion work: it is a raw-hex-to-token sweep across admin JSX, best done file-by-file with `npm run check:ui` after each batch.

## Dependencies

- All motion plans depend on the shared tokens: `--ease-out` / `--ease-in-out` /
  `--ease-drawer` in `app/globals.css` and `--app-ease-*` / `--app-duration-*` in
  `app/admin/operations-system.css`. Add curves there, never inline in a component.
- `public-motion-audit.md` and `admin-motion-audit.md` touch disjoint stylesheets
  and can run in parallel, except for the reduced-motion carve-outs, which must be
  added to the sheet that owns the transition.
- The `.why-stage` hover move now lives in `app/globals.css`, not in
  `app/components/home-motion.tsx` — keep it there so touch devices never see it.

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
