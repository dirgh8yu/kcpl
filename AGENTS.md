# KCPL repository instructions — every coding model and every chat

Before changing this repository, read `docs/UI_UX_DESIGN_GUIDE.md` and `docs/OPERATING_SYSTEM.md`, then the relevant source and server policy. These instructions apply to ChatGPT, Codex, Copilot, GPT-5.6 and any other coding agent. Read the current repository rather than relying on chat history. The design guide includes an executable task sequence, acceptance criteria and a copy-paste handoff for chat mode without automatic repository instruction loading.

## Staff software

- `/admin` is an operational application: compact toolbar, grouped navigation, registers, contextual detail and explicit next actions. Never turn it into a marketing landing page or a decorative dashboard.
- **Approved Figma Make UI is the visual design source of truth for `/admin`.** When implementing or repairing a screen, read the relevant Figma Make design first and reproduce its layout, hierarchy, spacing, surface treatment, density, typography, icon language and interaction model in the real application. Do not reinterpret an approved Figma screen into an older repository layout merely because legacy components already exist. The backend and server policies remain the functional source of truth.
- `docs/UI_UX_DESIGN_GUIDE.md` defines the implementation quality and accessibility constraints used to translate the approved Figma Make design into production. `app/admin/operations-system.css` owns runtime tokens and shared rules. Use the KCPL palette, Inter for interface text and consistent Lucide outline icons. Preserve approved logo artwork and public marketing context.
- Reuse `OperationsShell` and the primitives in `app/admin/operations-ui.tsx` when they faithfully support the approved Figma design. Evolve shared primitives when needed instead of forcing the design into an outdated pattern or creating a locally restyled duplicate. Default buttons are secondary and `type="button"`; form submissions MUST explicitly set `type="submit"`.
- `workflow-navigation.ts` is the sole navigation registry. Do not duplicate workspace lists, keyboard-search listeners, notification bridges or application chrome. Permission flags default to false; the server remains authoritative.
- Keep shared UI in the canonical stylesheet. Existing styles inside `@layer kcpl-legacy` are frozen migration support. Do not create another hotfix/refinement stylesheet, use `!important`, target Tailwind class strings in CSS, or add arbitrary literal colours/sizes/shadows to components.
- `npm run check:ui` enforces this contract in CI. Do not regenerate, loosen or delete its baseline to make a change pass. Retire legacy literals by converting them to semantic tokens and primitives.

## Workflow and data

- Keep canonical shipment/delivery state, commercial versions, tender booking, customs gates, POD verification and financial settlement under their existing server-side policy. A UI change must not bypass permissions or mark a workflow complete.
- Reuse `shipments/shipment-queue-policy.ts` for priority and next actions. It is a display policy, never mutation authorization.
- Register filters, sorting, pagination and selected records should use `useWorkspaceQuery`. Preserve unrelated query parameters and return context. Validate URL values against actual allowed values; URL state never grants access.
- Scope all data server-side. Distinguish an empty result from an unavailable or incomplete snapshot. Never invent healthy counts, unread notifications or completion states.
- Keep network-wide automation out of Overview rendering; use the existing authenticated alert action or protected internal automation endpoint. Do not send notifications from a page read.
- Resolve pending/error states and duplicate submissions; keep working drafts when requests fail. Background fetches must ignore stale responses and abort on unmount where applicable.

## Delivery

Honor the user's requested scope and validation level. Do not claim tests, builds, browser QA, deployment or merge succeeded unless they did. Do not disable repository protections or required checks. A request to merge to main authorizes the normal branch/PR/merge flow.
