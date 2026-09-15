# KCPL UI/UX design standard

**Required reading for every coding agent, including ChatGPT chat mode.** Read this file before designing or changing an interface. Apply it to the shared system and every screen in the requested scope, not just the dashboard.

## 1. What we are building

KCPL is working software for cargo operations. The interface should make a shipment, its current state, its blocker and its next permitted action immediately understandable. The target is a whole-product operational system, not a single polished screen or a dashboard skin. Aim for the clarity, restraint and interaction quality associated with Linear, Stripe, Flexport, project44 and Ramp: readable typography, considered spacing, quiet surfaces, predictable navigation, polished controls and unmistakably operational hierarchy. These are quality references, not instructions to copy their branding or reproduce their layouts.

“Compact” does not mean tiny, cramped or unfinished. “Clean” does not mean removing useful information or making every surface look identical. Changing the font and rounding existing boxes is not a complete redesign. Fix hierarchy, grouping, alignment, content and behavior together across the whole product.

### Authority and scope

1. Follow the user's current task, scope and delivery instructions.
2. Read [AGENTS.md](../AGENTS.md), this guide and [OPERATING_SYSTEM.md](OPERATING_SYSTEM.md). This guide defines the design target; the operating system contract defines implementation ownership and workflow constraints.
3. Read the relevant current components, styles, routes and server policies before writing code. Existing code is evidence of behavior, not proof of good design. Treat the full product as the design unit: inventory the whole user-facing system, not just the current route.
4. Preserve the KCPL identity in [BRAND_SYSTEM.md](BRAND_SYSTEM.md). Use Inter for interface text. Preserve approved logo artwork and its wordmark.
5. If an old density or typography value conflicts with this guide, evolve the shared tokens and primitives. Do not work around them with local overrides.
6. A valid redesign must improve the shared system and the consumers of that system; a token-only or one-page polish is not the target.

**This document defines the target, not a claim that every current screen already meets it.** The sizes below must be implemented in the canonical stylesheet during an authorized UI task; adding this document alone does not change runtime styling. For a scoped task, improve its shared components and affected screens without rewriting unrelated workflows.

## 2. Identify the problem before changing the screen

Inspect the actual route and its dependencies. Record the following privately or in the implementation notes; do not require a user interview for answers available in the repository.

| Question | Required outcome |
| --- | --- |
| Who uses this screen, and for which task? | A concrete task such as finding shipments blocked at customs. |
| What must they see first? | The relevant records, state, owner, blocker and next action. |
| What is slowing them down? | Specific issues: repeated navigation, oversized summaries, weak table hierarchy, lost filters, unclear actions or hidden errors. |
| What already exists centrally? | Applicable shell, primitives, tokens, navigation entries, URL-state hook and server policies. |
| What is the smallest coherent fix? | A shared improvement plus the necessary screen changes, with no second design system. |

Choose a real, frequently used register and a detail/form screen as reference implementations for a system-wide redesign. Establish their shared patterns, then apply those patterns to the remaining modules. Do not design every module independently.

## 3. Colour: unmistakably KCPL, mostly calm

Use the existing tokens below. Literal values are shown to document the identity; do not paste them into JSX or introduce a new palette per module.

| Role | Token | Value / use |
| --- | --- | --- |
| Brand accent | `--admin-crimson` | `#DC143C`; primary action and restrained active emphasis. |
| Primary text | `--admin-ink` | `#101010`; headings, body and important values. |
| Page canvas | `--admin-canvas` | `#F6F6F3`; application background. |
| Working surface | `--admin-surface` | `#FFFFFF`; records, forms, menus and dialogs. |
| Subtle grouping | `--admin-surface-muted` | `#EEEEE8`; secondary sections and quiet hover treatment. |
| Secondary text | `--admin-muted` | `#5B5B57`; supporting information, not disabled body copy. |
| Borders | `--admin-line` | `#D6D6D0`; group boundaries and control edges. |
| Stronger boundary | `--admin-line-strong` | `#AFAFA8`; where a control needs more definition. |
| Success / warning | `--admin-success` / `--admin-warning` | `#18794E` / `#72500C`; actual operational states only. |
| Danger / information | `--admin-danger` / `--admin-info` | `#A80E2F` / `#315D83`; actual errors or information only. |
| Keyboard focus | `--app-focus` | `#315D83`; a visible focus indicator, not another brand accent. |

- Most of the interface is neutral. Crimson must help locate an action or selection; it must not cover every button, card, heading or icon.
- Prefer a neutral selected surface with a restrained crimson indicator. Never communicate selection, warning or completion through colour alone.
- Use text and a relevant icon to distinguish destructive actions from ordinary crimson primary actions. Put destructive actions away from routine actions and confirm consequences where necessary.
- Use semantic status colours for status, not a different decorative theme for each module. Keep badges small, readable and consistently shaped.
- Add any necessary tint, elevation or spacing token in the canonical stylesheet. Reuse it; do not scatter computed colour values across components.
- Meet a contrast target of at least 4.5:1 for ordinary text and 3:1 for large text and meaningful control indicators. A palette token is not proof that every foreground/background pairing passes.

## 4. Typography: Inter, readable at working distance

Use the existing font-loading path and shared typography owner. Do not add duplicate font requests, a new display font, or per-page font declarations. Use Inter for navigation, headings, forms, tables, buttons, dialogs, notifications and public-facing functional controls. The supplied graphic wordmark may retain its approved typography; it is not the UI font.

### Target scale

| Role | Size / line height | Weight | Usage |
| --- | --- | --- | --- |
| Page title | 24px / 32px | 600 | One main title per page; use 22px / 30px on narrow screens if needed. |
| Section or dialog title | 16px / 24px | 600 | Surface headings and task groups. |
| Body, navigation, form labels | 14px / 20px | 400–500 | Default interface text; labels normally 500. |
| Buttons | 14px / 20px | 500 | Sentence case, action-oriented wording. |
| Register cells | 13–14px / 20px | 400–500 | Use 14px unless information density requires 13px. |
| Metadata and badges | 12px / 16px | 400–500 | Secondary information; never the only place a critical state is shown. |

- Do not use 8–11px type for essential labels, table contents or workflow status. Density comes from better organization, not unreadable type.
- Use weight and spacing before adding colour or uppercase. Avoid widely tracked, all-caps labels throughout the app.
- Use sentence case and short headings. Avoid oversized dashboard titles and heavy 700–800 weights across the interface.
- Use tabular numerals for aligned quantities and money. Show currency and units explicitly. Use monospace only when exact character comparison helps, such as a reference ID or code.
- Allow names and descriptions to wrap where useful. Truncate only with a way to access the full value; do not depend solely on a hover tooltip for essential content.

## 5. Spacing, surfaces and density

Use a shared spacing scale of **4, 8, 12, 16, 24 and 32px**. Align related elements to the same edges. Group tightly related information more closely than separate tasks.

| Element | Target |
| --- | --- |
| Desktop page padding | 24px; 16px at narrow widths. |
| Section spacing | 24px; use 16px inside a working section. |
| Desktop controls | 38–40px tall; consistent within a toolbar. |
| Standard register rows | Approximately 48px minimum for single-line rows; grow for multiline content. |
| Optional compact register | 40–42px only when explicitly useful; keep readable text and accessible actions. |
| Touch controls | At least 44px interaction area; mobile text inputs use 16px text. |
| Radii | 6px controls, 8px surfaces, 12px dialogs; introduce shared semantic tokens where needed. |
| Shell | Quiet grouped navigation and a restrained toolbar; preserve the existing shell structure and adapt its dimensions centrally. |

The current implementation has smaller defaults, including a 34px control, 42px row and single 4px radius. Those are migration starting points, not the required visual target. Add or evolve semantic tokens such as control, surface and dialog radius centrally; do not assume proposed tokens already exist.

Use three understandable layers: canvas, working surface and temporary overlay. Separate them with spacing and subtle boundaries. Use a restrained shadow for floating menus and dialogs when it clarifies elevation. Do not put every field or value inside another bordered card. Avoid gradients, glass effects, excessive shadows, giant pill buttons and decorative panels.

## 6. Icons: one modern, consistent family

Use **Lucide React**, already installed as `lucide-react`. Use named imports and one consistent outline treatment. Do not add another icon package, emoji navigation, stock clip-art or mixed filled/outline families.

- Default sizes: 16px beside text, 18px in navigation, 20px for standalone toolbar controls. Use a consistent `strokeWidth={1.75}` and `currentColor`.
- Place repeated size/stroke rules in a shared icon treatment. If adding an icon wrapper, implement it once before importing it; no such wrapper should be assumed to exist.
- Choose familiar meanings: `Search`, `Plus`, `ChevronDown`, `ArrowLeft`, `MoreHorizontal`, `SlidersHorizontal`, `FileText`, `Truck`, `Check`, `X` and `AlertTriangle`. Verify exports in the installed package when choosing other icons.
- Reuse the navigation registry's icon mapping. The same concept must use the same icon and label across sidebar, command search and actions.
- Icons support comprehension. Do not place an icon beside every metadata label or inside decorative coloured tiles.
- A decorative icon beside visible text has `aria-hidden="true"`. An icon-only button needs a specific accessible name, visible keyboard focus and a tooltip available on focus as well as hover. Keep the interaction area at least 44px even if the glyph is 20px.
- Keep text on primary and consequential actions. A trash icon alone is insufficient for an irreversible action.

Existing primitive API example:

```tsx
import { Plus } from "lucide-react";
import { OpsButton } from "./operations-ui";

// In a component with a real, permission-aware onCreate handler:
<OpsButton variant="primary" type="button" onClick={onCreate}>
  <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
  Create shipment
</OpsButton>
```

Adapt the import path to the file. This example does not supply a handler or authorize shipment creation. Never ship placeholder actions.

## 7. Page patterns that feel like software

### Shell and navigation

Keep one persistent shell, one command palette and one real notification centre. Group destinations around staff work using `workflow-navigation.ts`. Make the current location clear with selected navigation and a concise breadcrumb where it helps. Keep account and utility actions secondary. Never add a second search listener, notification bridge or locally invented navigation list.

### Registers: the main working surface

Order the screen as page title and main action, useful scope/status summary, search/filter toolbar, records, then pagination. Use summary metrics only when they answer an operational question or apply a useful filter. Do not push records below a wall of decorative cards.

- Put the record identifier and customer/context first, then route, state, owner, timing and next action as relevant to the task. Do not force every module into an identical column set.
- Left-align text, right-align numeric comparisons and align headers with their cells. Use restrained row separators and clear hover, selected and keyboard-focus states.
- Provide a real link for opening a record. Keep row actions independently operable; do not nest buttons inside a clickable row button.
- Keep search, active filters and reset together. Show result scope and active filters. Explain when counts cover a limited snapshot.
- Preserve filters, sort, page, selection and return context through `useWorkspaceQuery`. Returning from a record must recover the user's working context. Changing a filter should reset invalid pagination; avoid stale selections after results change.
- If bulk actions are supported by server policies, show them only after selection, state the selected scope and keep consequential actions explicit. Do not imply that “select all” includes records that were never loaded.

### Record detail

Start with identity, state, owner and the next permitted action. Group related information into readable sections: movement details, documents, tasks, commercial information or history as appropriate. Use an inspector for quick contextual work and a full route for complex records. Keep audit history available without giving it the same emphasis as the current task.

### Forms and dialogs

Use visible labels, practical defaults and grouped fields. Use a single column for sequential tasks; pair fields only when their relationship is clear. Place instructions near the relevant field. Put validation errors beside the field and provide an error summary for long forms. Preserve entered values on failure.

Use dialogs for a bounded task or confirmation, not a complete operations workspace. Include a clear title, close action and focused footer. Reuse existing accessible dialog/popover primitives where available; preserve focus entry, keyboard operation, focus containment and return to the trigger. Avoid surprising dismissal that discards a draft.

### Overview and dashboards

Prioritize exceptions, urgent work and useful next actions. Every prominent number must have a clear definition and useful context. Prefer a small relevant summary above a working queue. Charts need a real comparison or trend and actual data; never add a chart to make a page look finished.

## 8. Interaction and workflow quality

Visual polish must improve task completion without changing business truth.

| State / interaction | Required behavior |
| --- | --- |
| Loading | Preserve layout with a restrained placeholder; mark the relevant region busy. Do not show a false empty state first. |
| Refreshing | Keep usable existing data visible when safe, identify refresh activity and handle stale responses. |
| Empty dataset | Explain what belongs here and offer a real permitted first action. |
| No search results | Preserve the query and provide a clear reset or adjustment. |
| Error / unavailable | Explain what failed and provide a working retry where possible. Do not replace an error with zero metrics. |
| Partial data | State the available scope or snapshot limit; never imply a complete result. |
| Saving | Show progress on the relevant action, prevent duplicate submissions and retain drafts on failure. |
| Success | Confirm the specific result near the work; avoid a toast for every harmless interaction. |
| Permission restriction | Explain a relevant unavailable action or omit inaccessible navigation. Server authorization remains mandatory. |
| Keyboard | Provide logical tab order, visible focus and semantic links/buttons; expose sorting and selection state accessibly. |
| Motion | Keep transitions restrained, typically 120–180ms; respect reduced-motion preferences. No hover bouncing or unnecessary entrance animations. |

Reuse `shipments/shipment-queue-policy.ts` for shipment priority and suggested next actions. Keep shipment transitions, commercial versions, tender/booking, customs gates, POD verification and settlement under their existing server policies. Do not mark work complete or bypass approval to simplify an interaction.

Do not start automation scans, writes or notification dispatch from a page render or refresh. Do not invent unread dots, fake healthy states, optimistic permissions or unimplemented workflow steps.

Use progressive disclosure for infrequent information. Keep frequent actions close to their records. Preserve a draft and navigation context when practical. Avoid extra confirmation dialogs for harmless reversible actions; reserve them for meaningful consequences.

## 9. Responsive and accessible by design

- At narrow widths, collapse navigation into an accessible drawer and keep the current page and primary action discoverable. Wrap toolbars in a deliberate order rather than squeezing controls.
- Choose a deliberate mobile register pattern: priority columns with access to the full record, or a labelled horizontally scrollable table region. Do not clip data silently or turn every cell into an unrelated card.
- Keep long names, empty values, large currency values and translated-length labels from breaking layouts. Show unavailable values explicitly; zero is a real value.
- Use semantic headings and table headers. Do not add ARIA attributes redundantly or duplicate JSX attributes. Associate field labels and errors with their inputs.
- Preserve browser zoom and normal text selection. Ensure sticky toolbars and action bars do not obscure focused controls or the last table row.
- When visual review is authorized, inspect representative narrow, tablet and desktop widths, keyboard navigation and at least one long-content state. If it is skipped, report that honestly; do not label the interface visually verified.

## 10. Implementation ownership: one system across modules

| Responsibility | Existing source |
| --- | --- |
| Shared chrome | `app/admin/operations-shell.tsx` |
| Page and control primitives | `app/admin/operations-ui.tsx` |
| Canonical staff visual rules and tokens | `app/admin/operations-system.css` |
| Staff typography mapping | `app/admin/admin-typography.css` |
| Brand foundation | `app/brand-system.css` and `docs/BRAND_SYSTEM.md` |
| Navigation and capabilities | `app/admin/workflow-navigation.ts` |
| Register URL state | `app/admin/use-workspace-query.ts` |
| Shipment display priority | `app/admin/shipments/shipment-queue-policy.ts` |

Inspect current exports before using them. Existing primitives include `OpsPage`, `OpsPageHeader`, `OpsSurface`, `OpsToolbar`, `OpsTableWrap`, `OpsButton`, `OpsSearch`, `OpsField`, `OpsBadge`, `OpsEmptyState`, `OpsNotice` and `OpsErrorState`. Use their real props, and improve a shared primitive when multiple screens need the same capability.

`OpsButton` defaults to a secondary action and `type="button"`. Use `variant="primary"` for the main task, `secondary` for supporting actions, `ghost` for low emphasis and `danger` for destruction. Form submissions must explicitly use `type="submit"`.

Do not add new override stylesheets, `!important`, CSS selectors that target fragments of Tailwind class names, arbitrary component-level hex colours or repeated literal type/radius/shadow values. Keep frozen `@layer kcpl-legacy` styles untouched. Migrate a touched screen to semantic classes and shared tokens rather than adding another compatibility patch. Preserve the canonical stylesheet's existing import order.

For public-facing interface work, reuse the brand foundation and Inter control typography; do not mount staff chrome on the public website. Preserve the approved public marketing and logo context unless that is part of the requested change.

### Execute each UI task in this order

1. Read the entry-point instructions and inspect the current route, shared components and relevant business policies.
2. Define the task, primary information, primary action, hierarchy, states and responsive behavior. Resolve routine design choices using this guide.
3. Identify which tokens or primitive changes solve the problem consistently. Implement those centrally before composing screen-specific changes.
4. Implement the page pattern and actual interactions. Preserve existing data contracts, permissions, drafts and navigation state.
5. Update the affected consumers. For a whole-system request, inventory modules from the navigation registry and track each as migrated, already compliant or blocked with a specific reason. A refreshed Overview alone does not complete that request.
6. Inspect the diff for accidental workflow changes, duplicated attributes, dead actions, new visual literals and conflicting styles. Update documentation if a shared convention changed.
7. Follow the user's validation scope and required repository gates. `npm run check:ui` checks specific design drift; lint, types, builds and policy tests cover different risks. Do not loosen baselines or disable checks to pass. Do not claim commands or visual review that were not performed.
8. Deliver or merge according to the user's existing authorization. Identify any remaining limitation accurately; do not claim the complete system was redesigned after changing only tokens or one route.

### Design acceptance criteria

Use these as a concrete review rubric, not an automatic assertion that a change passed:

- A user can identify the page purpose, relevant records and main action without reading an essay.
- The interface uses the KCPL palette, Inter, consistent Lucide icons and the shared type/spacing/control hierarchy.
- Repeated controls and states behave the same across the affected modules.
- The register or task is visually dominant; decorative cards and nested borders do not compete with it.
- The main action is specific and functional. Secondary and destructive actions are distinguishable.
- Loading, empty, filtered-empty, error, partial-data and permission states are handled where applicable.
- Filters and return context survive the workflow; failed requests preserve work; duplicate actions are prevented.
- Server policies, required checks and the frozen-style baseline remain intact.
- Any unverified responsive, accessibility or visual behavior is identified as unverified.

## 11. Run this standard from ChatGPT chat mode

Repository Markdown is an instruction source, not a mechanism that every chat model automatically loads. Start each new coding chat with the prompt below. A connected repository lets an agent read and edit current files; without repository tools, attach the documents and relevant source files and request a patch.

### Copy-paste task prompt

```text
Work on dirgh8yu/kcpl. Before writing code, read the current AGENTS.md,
docs/UI_UX_DESIGN_GUIDE.md, docs/OPERATING_SYSTEM.md and the relevant current
source files. Read docs/BRAND_SYSTEM.md for KCPL identity. Do not rely on
earlier chat descriptions of the repository.

Task: [describe the screen, workflow or system-wide change].
Scope: [routes/modules; say whole system only when that is intended].
Delivery: [patch, commit, PR or merge to main].
Validation: [requested checks, or explicitly skipped visual QA].

Use the clarity and polish described in the guide: KCPL crimson/black/neutral
palette, Inter interface typography, consistent Lucide outline icons,
readable density, quiet surfaces and a clear action hierarchy. Fix layout,
content and interaction quality together. Implement through the shared shell,
Ops primitives and canonical semantic tokens, then update affected screens.

Preserve real server permissions and workflow policies, URL filter/selection/
return state, draft recovery and honest loading/error/partial-data states.
Do not create another theme, override stylesheet, duplicated navigation or
business policy. Do not loosen the UI baseline or invent component APIs.

With repository tools, make the requested edits and follow the authorized
delivery flow. Without them, request the missing current files needed for a
correct patch, then provide an applicable unified diff with exact repository
paths. Never claim files were edited, checks passed or main was updated when
you only provided text. Honor my communication preference.
```

### Minimum handoff when the chat cannot read GitHub

Attach `AGENTS.md`, this file, `docs/OPERATING_SYSTEM.md`, `docs/BRAND_SYSTEM.md`, the relevant current page/component files, their imported shared UI/styles and the relevant server action/policy or data types. Include `package.json` so the agent can verify the available libraries. Supply screenshots only if available or requested for a specific unresolved layout issue; source-based work can begin without them.

If a required file is missing, the agent should identify the exact missing dependency instead of guessing its API or replacing the application. A prose proposal is not a code patch, and an attachment is not a GitHub push.

### Keep future agents consistent

`AGENTS.md`, `.github/copilot-instructions.md`, the README and the PR template point to this guide. Keep this file as the single design guide instead of copying divergent rules into model-specific files. The existing UI contract check catches some mechanical drift, but it does not evaluate visual quality or guarantee that chat mode has read this document. Use the handoff prompt to load the standard explicitly.
