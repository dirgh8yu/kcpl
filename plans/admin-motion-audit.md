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
