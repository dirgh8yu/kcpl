# Admin motion audit (Phase 0)

Produced via the `find-animation-opportunities` skill against `app/admin/**` (excluding `.server.ts` and `workflow-navigation.ts`). Feeds Phase 2 (shell) and Phase 3 (primitives).

## Opportunities (ordered by leverage)

| # | Location | Today | Purpose | Frequency | Suggested motion |
|---|---|---|---|---|---|
| 1 | `operations-command-palette.tsx` open/close | Instant mount/unmount | Preventing a jarring change | Occasional | Backdrop fade 150ms ease-out; panel `opacity 0→1` + `translateY(-8px)→0`, 180ms `--app-ease-out`; exit 120ms, no bounce |
| 2 | `operations-notification-centre.tsx` dropdown | Snaps open/closed | Spatial consistency | Occasional | Scale from trigger (`transform-origin: top right`), `scale(0.96)→1` + opacity, 160ms `--app-ease-out`; exit 120ms |
| 3 | `operations-shell.tsx:130` nav `<details>` groups | Native instant show/hide | State indication | Tens/day | Grid-rows trick (`0fr → 1fr`) + opacity, 220ms `--app-ease-out` |
| 4 | `operations-shell.tsx:122-123` mobile drawer + backdrop | Snaps in/out | Spatial consistency | Occasional | Drawer `translateX(-100%)→0`, 220ms `--app-ease-drawer`; backdrop fade 180ms |
| 5 | `OpsButton` | No `:active` feedback | Feedback | Very high | `:active { transform: scale(0.98) }`, 100ms ease-out — near-imperceptible only |
| 6 | `OpsFilterChip`/`OpsStat`/`OpsKpiCard` `data-active` toggles | Instant style swap | State indication | Tens/day | Color-only transition, 140ms ease-out |
| 7 | `OpsEmptyState` first render | Static | Preventing a jarring change | Occasional | `opacity 0→1` + `translateY(4px)→0`, 200ms ease-out |

All: `transform`/`opacity`/color properties only, `prefers-reduced-motion` gated, hover-only rules gated with `(hover: hover) and (pointer: fine)`.

## Rejected (do not animate)

- ⌘K/Ctrl+K global shortcut → palette trigger: keyboard-initiated, never animate the trigger path.
- Mobile menu icon swap (`Menu`↔`X`): instant functional icon, no crossfade.
- Table row hover in `OpsTableWrap` lists: scanned tens–hundreds of times/session, any fade reads as lag.
- `OpsProgress` fill animation: functional data being read, must render true value immediately.
- Command palette result reordering on keystroke: keyboard-adjacent, reorders too often to animate.
- Topbar refresh spin: already correctly animated and gated — no change needed.

## Verdict

Near-zero motion today. Highest leverage: command palette open/close (#1) — most-used overlay, currently most jarring, but must stay ≤180ms since it's triggered by keyboard as often as by click. Nothing on this list should exceed ~220ms; list/table content stays untouched.

## Status — all seven shipped

Verified in `app/admin/operations-system.css` + `operations-shell.tsx` at `c86557e`:

| # | Status | Landed as |
|---|---|---|
| 1 | DONE | `.app-command-backdrop` / `.app-command-dialog` entrance **only** via `@starting-style` (`translateY(-8px) scale(.98)` → settled, `--app-duration-base` = 180ms `--app-ease-out`); the palette unmounts on close, so there is deliberately no exit animation — that is what keeps it keyboard-fast |
| 2 | DONE | `.app-notification-panel` `transform-origin: top right`, `scale(.96) → 1` + opacity, `--app-duration-base`, `@starting-style` |
| 3 | DONE | `.app-nav-group-list` grid-rows `0fr → 1fr` (`--app-duration-*`, `--app-ease-out`); chevron driven by `summary[data-collapsed]`; reduced-motion carve-out |
| 4 | DONE | `.app-sidebar[data-open]` `translateX` with `--app-ease-drawer` + `.app-nav-backdrop` fade; reduced-motion carve-out for the ≤1023px case |
| 5 | DONE | `.kcpl-admin-shell .ops-button:active:not(:disabled)` `scale(.98)` at `--app-duration-fast` (120ms) |
| 6 | DONE | `data-active` toggles (filter chips, tabs, stat toggles) transition colour only at `--app-duration-fast` |
| 7 | DONE | `.ops-empty` `opacity 0→1` + `translateY(4px)→0` (`ops-fade-in`, `--app-duration-slow` = 240ms) |

Follow-up landed after this audit: the KPI card hover lift
(`.kcpl-admin-content button.ops-kpi:hover`) is now gated behind
`@media (hover: hover) and (pointer: fine)` so a touch tap no longer leaves a
stuck `translateY(-1px)`.

Still open from this audit's category work: `transition: width 160ms ease` on
`.kcpl-ops-overview .overview-status-item-track span` is dead CSS (no component
renders `kcpl-ops-overview`). Removing the leftover selectors belongs to
[admin-css-consolidation.md](admin-css-consolidation.md), not to motion work.
