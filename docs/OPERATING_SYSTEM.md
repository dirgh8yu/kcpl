# KCPL operating system contract

This is the engineering and workflow contract for the KCPL staff operating system as a whole, not just one page or one `/admin` route. Read [UI_UX_DESIGN_GUIDE.md](UI_UX_DESIGN_GUIDE.md) for the required visual quality, typography, icons, interaction patterns and implementation sequence. It applies to every module and every coding model. The public website keeps its brand/marketing layout; staff work uses the application system below.

## Why the interface drifted

The original system loaded 18 overlapping admin stylesheets. Repeated editorial, compatibility and hotfix rules competed through specificity and `!important`. Headers reached 48px, operational labels fell to 8px, and the action hierarchy forced primary, secondary, ghost and destructive buttons to the same crimson fill. Separate navigation/search implementations owned different workspace lists. A DOM notification bridge targeted a bell that no longer existed, while the shell displayed a constant unread dot.

Legacy compatibility styles may be modified or removed as part of an intentional route migration. Preserve behaviour, migrate consumers to the canonical system, validate the affected workflows, and do not create new compatibility layers. `operations-system.css` is the sole active shared design owner. `admin-typography.css` owns the Inter/Manrope/monospace mapping.

## Required page anatomy

1. `OperationsShell`: grouped navigation, a restrained desktop toolbar, breadcrumb, one command palette, actual notifications and refresh. It derives all modules and access from `workflow-navigation.ts`. The current 224px sidebar and 48px toolbar are implementation defaults; refine dimensions centrally when applying the design guide.
2. `OpsPage` and `OpsPageHeader`: compact title, concise description, optional scope metadata and a focused primary action. Use them consistently across the KCPL product so the system feels coherent instead of one-off page designs.
3. `OpsToolbar`: search, filters, sort and reset beside the register. Keep filters shareable and persistent with `useWorkspaceQuery`.
4. `OpsSurface` / `OpsTableWrap`: the working records. Use a contextual inspector or a linked record for details. Do not substitute large decorative metric cards for the register.
5. Pending, failed, empty and incomplete states must describe the actual data available. Do not hide failures behind zeros.
6. Every route in the operational system should use the same hierarchy, density and interaction model; a route that breaks the pattern should be treated as a shared-system bug, not as an acceptable local exception.

## Shared components and tokens

| Purpose | Source / convention |
| --- | --- |
| Application chrome | `app/admin/operations-shell.tsx` |
| Page, panels, tables, inputs, badges, actions | `app/admin/operations-ui.tsx` |
| Visual rules | `app/admin/operations-system.css` |
| Navigation and capabilities | `app/admin/workflow-navigation.ts` |
| Register URL state | `app/admin/use-workspace-query.ts` |
| Shipment priority / next action | `app/admin/shipments/shipment-queue-policy.ts` |
| Colour | `--admin-crimson`, `--admin-ink`, `--admin-canvas`, `--admin-surface`, `--admin-muted`, `--admin-line`; semantic success/warning/danger/info |
| Density | `--app-control-height`, `--app-row-height`, `--app-page-gap`, `--app-radius` |
| Type | Inter; target 24px page titles, 14px body/labels and 12px metadata per the design guide; tabular numerals for numeric comparisons and monospace only where character comparison helps |
| Touch | 44px controls, 16px form inputs, responsive navigation and scrollable tables |

Use token utilities when a primitive cannot express the layout, for example `text-[var(--admin-muted)]`, `bg-[var(--admin-surface)]`, `rounded-[var(--app-radius)]`. New shared rules belong in the canonical stylesheet under application or semantic component selectors. Do not add unrelated global element rules. Current density/type token values are migration starting points, not a requirement to keep small controls and labels; evolve them centrally toward the design guide during UI implementation.

## Actions and forms

`OpsButton` defaults to a neutral secondary action and `type="button"`. Choose `variant="primary"` for the main task, `secondary` for supporting actions, `ghost` for low emphasis, and `danger` for destructive intent. Form submission explicitly uses `type="submit"`. Preserve disabled/pending states. Do not make every action crimson or animate buttons upward on hover.

## Workflow consistency

The shipment register includes delivered records as well as active movements; Overview remains active-only. Priority order is exception, overdue tasks, customs requirements, missing owner, urgent, high, ordinary work. Within each group, blockers and update times break ties deterministically. Overview and the register reuse the same policy. Delivered shipments are not advertised as missing active owners.

Status metrics respect query, branch, mode and attention filters. Clicking a metric applies its status. The register supports 50-row pages, priority/recent sorting and shareable filters. Opening a Job File preserves the return URL, page and selection. Next-action links target existing exception, work and delivery sections. This display policy does not authorize transitions or bypass any workflow gate.

Overview rendering no longer performs three network-wide automation scans/writes. The existing Tasks & Alerts evaluation action and `/api/internal/automation` remain responsible for automation. The overview toolbar refreshes the current data snapshot; it does not trigger notification dispatch. Snapshot limits are disclosed in the shipment register because client pagination does not imply an unlimited server dataset.

## Enforcement across models

`AGENTS.md` is the root agent entry point; `.github/copilot-instructions.md` points to it. `npm run check:ui` runs in GitHub Actions. It rejects new component-level literal styling beyond the recorded migration budget, changes to frozen stylesheets, new override stylesheets, duplicate chrome/search integrations, optimistic navigation defaults, and a displaced canonical CSS import. PRs cannot increase the baseline budget alongside their changes.

The baseline records existing design debt. It is not a template for new code. Do not initialize or refresh it again. New components begin with zero legacy allowances. Reduce legacy allowances as components are migrated; never increase them to bypass the contract. This check catches specific forms of drift, not every design or workflow error. Keep existing lint, type, policy and build gates.

### Chat-mode handoff

For a new chat using any model, provide the repository and this instruction:

> Work in dirgh8yu/kcpl. First read AGENTS.md, docs/UI_UX_DESIGN_GUIDE.md and docs/OPERATING_SYSTEM.md from the current branch. Apply the guide's KCPL palette, Inter typography, Lucide icons and page/interaction patterns through the shared OperationsShell, Ops primitives and canonical tokens. Preserve the navigation registry, register URL state and existing server workflow policies. Do not invent a visual system, override stylesheet or duplicated business policy, and do not loosen the UI baseline. Follow the validation and merge instructions in my request.

The design guide contains a fuller task prompt and a file-attachment workflow for chat mode without repository access. Instructions do not give a model repository access or prove that it has applied a patch.

Repository instructions make the standard discoverable. The CI contract provides mechanical enforcement even when a chat does not automatically load agent instructions. Required-check enforcement still depends on the repository's branch protection configuration; this change does not alter it.
