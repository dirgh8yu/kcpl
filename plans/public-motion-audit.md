# Public UI motion audit

- **Status**: DONE — all items shipped; both `AUDIT.md` deviations **decided and closed**
  (see Decisions below); the three open feel-checks are now either enforced by
  `tests/public-ui-motion-contract.test.mjs` or down to one browser-only check
- **Commit stamped**: `c86557e`
- **Scope**: public routes only — `app/globals.css`, `app/components/**` (the admin
  product has its own sheet and its own audit: [admin-motion-audit.md](admin-motion-audit.md))
- **Method**: `find-animation-opportunities` sweep + `improve-animations` audit
  against `.claude/skills/improve-animations/AUDIT.md`

## Shipped

| # | Location | Today (before) | Purpose | Motion now |
|---|---|---|---|---|
| 1 | `app/globals.css:28` motion tokens | 26 hand-typed `cubic-bezier(.22,1,.36,1)` literals drifting from the admin sheet | Cohesion | `--ease-out` / `--ease-in-out` / `--ease-drawer` declared once and referenced repo-wide |
| 2 | `app/globals.css:37` press feedback | No `:active` state on public controls | Feedback | `:active { transform: scale(.97) }`, `transition: transform 160ms var(--ease-out)` on pointer-down, plus `touch-action: manipulation` and no long-press selection |
| 3 | 26 public `:hover` rules that move (`.services-route-card:hover img`, `.why-stage:hover`, …) | Fired on touch taps as sticky hovers | Accessibility | Wrapped in `@media (hover: hover) and (pointer: fine)` (35 gates in `globals.css`, 1 in the admin sheet) |
| 4 | `app/components/faq-section.tsx` + `globals.css:995` | Accordion snapped via `hidden` | State indication | Grid-rows `0fr → 1fr`, `.34s var(--ease-in-out)`; panels stay mounted with `aria-hidden`; chevron rotates in the same beat |
| 5 | `.why-stage` hover lift | `whileHover={{ x: 6 }}` in Motion — JS-driven and ungated for touch | Feedback | Gated CSS `transform:translateX(6px)`, `.22s var(--ease-out)`, joining the stage's existing hover rules |
| 6 | `.journey-moving-point` (home journey timeline) | `animate={{ left: "0%" → "100%" }}` — layout every frame | Explanation | Full-bleed `.journey-moving-point-track` wrapper animated with `x`, so the dot travels the identical distance on the compositor; hidden on mobile as before |
| 7 | `.quote-flight-plane` (quote launch graphic) | `animate={{ left, bottom }}` — layout every frame | Explanation | Same wrapper technique: `.quote-flight-plane-track` animates `x`/`y` as percentages of a full-bleed box, which equals the old container-relative `left`/`bottom` exactly; `rotate` stays on the plane |
| 8 | `.satellite-marker-ring` / `-core` (network map) | `transition: height, width` — layout animation on hover/active/focus | State indication | `transform: scale(1.5556)` / `scale(1.5)` with compensated `border-width` (`.9643px` / `.6667px`, and `1.2857px` for the focus ring) so the rendered stroke is unchanged; hover variants gated |
| 9 | `.satellite-marker-label` | `transition: font-size` | Polish | Font-size dropped from the transition list (colour still transitions, size snaps with the panel swap) |

## Decisions (closed — do not re-open without new evidence)

### DECISION 1 — `AUDIT.md` §5 “Framer Motion `x`/`y`/`scale` shorthands are not hardware-accelerated” → **not adopted**

The rule stays deliberately unapplied. The installed renderer is `motion@13.1.0`, whose `motion-dom`
build lists `transform` itself in `acceleratedValues`
(`node_modules/motion-dom/dist/es/animation/waapi/utils/accelerated-values.mjs`):
independent transforms (`x`, `y`, `scale`, `rotate`) are composed into that single
`transform` property, which is the accelerated path. Rewriting ~20 sites in
`app/components/home-motion.tsx` — including the scroll-linked hero layers that
drive two satellite images — to raw transform strings would churn the most
delicate motion in the repo for no measurable gain, and the string form is the
form Motion must interpolate in JS.

The rule *was* applied where it is unambiguously correct: every animated
`left` / `bottom` / `width` / `height` / `font-size` in the public sheet is gone
(#6–#9 above), verified by:

```bash
grep -n "transition:[^;]*\(width\|height\|font-size\|left\|right\|top\|bottom\|margin\|padding\)" app/globals.css   # no output
```

### DECISION 2 — `AUDIT.md` §5 animated layout properties → **adopted everywhere it applies**

Nothing animated that forces layout is left in either sheet, and the public site now has a
regression guard for it (`tests/public-ui-motion-contract.test.mjs`, test 1: "no public
transition animates a layout property"). The only remaining case is not a decision: `app/admin/operations-system.css` still has
`transition: width 160ms ease` on `.kcpl-ops-overview .overview-status-item-track span`,
which is dead CSS — no component renders `kcpl-ops-overview` or
`overview-status-item*`. It belongs to the leftover selectors tracked by
[admin-css-consolidation.md](admin-css-consolidation.md), not to motion work.

## Deliberately not animated (gate: frequency / function)

- `.site-header` scroll-state change — already transitions in `.26s`; anything
  slower on a surface seen on every scroll fails the frequency gate.
- Hero headline and phase copy — state changes are scroll-driven; adding an
  entrance per phase would fight the pinned scroll narrative.
- `journey-stage` / `why-stage` list content — read, not acted on; decoration on
  readable content hinders.
- Affiliation rail logo marquee — continuous motion, `linear`, must never be
  “improved” with easing.
- Form field focus rings — functional state, instant.

## Verification

```bash
npm run check:ui          # UI contract: stylesheet order, no !important, token presence
npx tsc -b --noEmit
npm run lint
node --experimental-strip-types --test tests/admin-ui-system.test.mjs tests/operations-overview-ui-contract.test.mjs tests/shipment-detail-ui-contract.test.mjs tests/commercial-ui-contract.test.mjs tests/workflow-navigation.test.mjs tests/public-ui-motion-contract.test.mjs
```

### Now enforced mechanically

`tests/public-ui-motion-contract.test.mjs` (in `npm test`, so CI covers it) pins the four
things that used to be “look at it in the browser” claims:

1. no `transition` in `app/globals.css` animates `width`/`height`/`font-size`/`left`/
   `right`/`top`/`bottom`/`margin`/`padding` (`stroke-width` and `border-width` excluded —
   they paint a stroke on a fixed-size element rather than moving siblings);
2. the map marker's `scale × border-width` still equals the resting stroke at rest, on
   hover and on keyboard focus (`1.5556 × .9643 ≈ 1.5`, `1.5 × .6667 ≈ 1.0`,
   `1.5556 × 1.2857 ≈ 2.0`), including the legacy 18px/28px and 8px/12px geometry the
   scales came from;
3. the journey dot and quote flight plane travel on a full-bleed `position:absolute;
   inset:0; pointer-events:none` track, and neither moving point declares an animated
   offset — so the travel distance is the same as the old `left`/`bottom` animation;
4. the blanket reduced-motion reset is present **and** `.why-stage:hover` carries its own
   carve-out, which it needs because the blanket reset is single-class specificity.

### Still needs a browser

- Sub-pixel rasterisation of the compensated borders: the arithmetic is now exact, but
  whether the browser rounds `0.9643px × 1.5556` to the same device pixels it used to
  round a plain `1.5px` can only be confirmed visually (DevTools → Rendering → Paint
  flashing / 10% animation playback).
- The journey dot and flight plane must *look* like they start and finish at the same
  points. The structure that makes that true is pinned by test 3; the endpoints themselves
  are still an eyeball comparison against the pre-refactor build.
