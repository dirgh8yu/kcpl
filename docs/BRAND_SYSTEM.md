# KCPL Brand System

This document is the implementation contract for KCPL visual work in the website, customer portal, and Operations UI.

## Source of truth

The KCPL Figma brand file is the visual source of truth. Code must implement the Figma specification rather than preserve older website styling when the two conflict.

Figma source: `o1q9pbJNBPFNsLS1LyZAPU`

## Core palette

Only these colours are KCPL brand colours:

- **KCPL Crimson** — `#DC143C`
- **KCPL Black** — `#101010`
- **Neutral Canvas** — `#F6F6F3`

White may be used as a surface or reversed text colour. Neutral greys may be derived from KCPL Black for borders, secondary copy, disabled states, and data density. Semantic status colours are allowed in operational interfaces only when they communicate state (success, warning, danger, information); they are not brand accents.

### Colour rules

1. Crimson is the single brand accent for interactive emphasis, active states, key rules, and branded highlights.
2. Black is the primary text and dark-surface colour.
3. Neutral Canvas is the default light page background.
4. Do not introduce new gold, navy, rhododendron, pine, glacier, beige, or decorative brand palettes.
5. Existing legacy variables using those names are migration aliases only. New code must use `--kcpl-*` semantic tokens.
6. Do not hard-code new brand hex values inside components. Use the central tokens in `app/brand-system.css`.

## Typography

The KCPL brand typeface is **Manrope**.

- **ExtraBold / 800** — wordmark, major display headings, important branded statements.
- **SemiBold / 600** — navigation, buttons, labels, subheads, operational emphasis.
- **Regular / Medium** — permitted for long-form body copy, tables, forms, metadata, and dense operational UI where ExtraBold/SemiBold would harm readability.

### Typography rules

1. Do not introduce serif display fonts into KCPL product or marketing UI.
2. Cormorant Garamond and Instrument Serif are legacy website styling and must not be used for new work.
3. Headings must use Manrope, not a fallback serif.
4. Uppercase and wide tracking should be reserved for short labels, the wordmark descriptor, and small navigation/eyebrow copy—not paragraphs.
5. Typography must remain readable at mobile sizes; brand styling never overrides accessibility.

## Logo

The approved mark is the Figma **Gateway K** symbol. The approved primary lockup pairs it with:

- `KAPILESHWOR` — Manrope ExtraBold, uppercase
- `CARGO PVT. LTD.` — Manrope SemiBold, uppercase, letter-spaced

The exact symbol export is committed at `public/images/brand/kcpl-gateway-k.svg`.

### Logo rules

1. Keep clear space of at least **1/4 of the mark height** around the lockup.
2. Use the Gateway K symbol alone at small sizes where the wordmark cannot remain legible.
3. Do not redraw, distort, rotate, recolour, outline, crop, animate, or place the mark inside a decorative circle.
4. Do not substitute the previous circular PNG mark or animated serif wordmark.
5. On dark surfaces, keep the Gateway K crimson and reverse the wordmark to white.

## Functional UI rule

A control must never look usable unless it performs a real action.

- A button must have a working action, submit behaviour, or navigation target.
- A link must navigate to a real route/resource.
- If a feature is unavailable, hide the action or present an explicit unavailable state with a reason.
- Do not use active-looking buttons as decoration.
- Placeholder tools must not appear in primary navigation or command search until their route and core workflow work.
- Every new tool must include an empty state, loading state, error state, and permission-denied state before it is considered production-ready.

## Migration policy

Legacy compatibility CSS may remain temporarily to protect working screens, but it is not a design system. When a section is touched, migrate its one-off colours, radii, typography, and controls toward the shared KCPL tokens/primitives instead of adding another override layer.

The intended end state is fewer compatibility selectors and fewer `!important` rules, not more.
