# KCPL repository instructions — every coding model and every chat

Before changing this repository, read `docs/OPERATING_SYSTEM.md`, then the relevant source and server policy. These instructions apply to ChatGPT, Codex, Copilot, GPT-5.6 and any other coding agent. Read the current repository rather than relying on chat history.

## Staff software

- `/admin` is an operational application: compact toolbar, grouped navigation, registers, contextual detail and explicit next actions. Never turn it into a marketing landing page or a decorative dashboard.
- `app/admin/operations-system.css` is the authoritative product design contract. Use its tokens for colour, typography, spacing, radius and density. Inter is the staff UI font; Manrope is for the KCPL brand lockup and public marketing.
- Reuse `OperationsShell` and the primitives in `app/admin/operations-ui.tsx`. Add reusable behavior to those components, not a locally restyled copy. Default buttons are secondary and `type="button"`; form submissions MUST explicitly set `type="submit"`.
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
