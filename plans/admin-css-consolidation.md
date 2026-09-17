# Legacy CSS consolidation inventory (Phase 0)

All admin CSS files besides `operations-system.css` open with the same banner (`Frozen compatibility rules. New UI belongs in operations-system.css.`) and are wrapped in `@layer kcpl-legacy` (always loses to unlayered `operations-system.css`).

| File | Attribute-substring selectors (`[class*=...]`) | Status |
|---|---|---|
| `operations-theme.css` | 33 | Load-bearing — retargets old raw-hex Tailwind classes still in JSX to tokens |
| `operations-v4-compat.css` | 71 | Load-bearing — same pattern, largest surface |
| `operations-editorial.css` | 33 | Load-bearing |
| `operations-action-hierarchy.css` | 26 | Load-bearing |
| `commercial-v4-compat.css` | 62 | Load-bearing |
| `commercial-detail-refinement.css` | 85 | Load-bearing |
| `operations-polish.css` | 0 | Structural refinement rules, not attribute-selector patches — candidate to fold into `operations-system.css` directly |
| `operations-hotfix.css` | 0 | Small (36 lines), narrow named fixes — candidate to fold in |
| `operations-detail-refinement.css` | 0 | Candidate to fold in |
| `shipment-detail-hierarchy.css` | 0 | Candidate to fold in |
| `admin-design-system.css` | 0 | Candidate to fold in |

**Reality check:** the six files with `[class*=...]` selectors (310 selectors total) exist because dozens of `.tsx` files across the admin product still carry raw Tailwind arbitrary-hex classes (`bg-[#091624]`, `text-[#8a6c36]`, etc.) directly in JSX. Retiring those CSS files requires going into each of those component files and replacing the raw hex classes with token-based ones (`bg-[var(--admin-crimson)]` etc.) — a wide, mechanical sweep across the whole admin surface, not a CSS-only change. That work is real but large; it's tracked here as a distinct follow-up track rather than bundled into the shell/primitive motion work, so it can be done file-by-file with `npm run check:ui` re-run after each batch.

**This session's scope:** fold the five zero-attribute-selector files into `operations-system.css` where practical, and defer the six selector-heavy files (raw-hex JSX migration) to a dedicated follow-up pass.
