# KCPL Whole Product Redesign Plan

## Objective
Create a coherent KCPL staff operating system that feels like a fast, calm, premium logistics product inspired by Linear, Stripe, Flexport/project44 and Ramp — while staying unmistakably KCPL. This is a whole-product redesign, not a dashboard skin or a route-local patch.

## Scope and constraints
- Preserve KCPL brand palette: crimson, black, neutral canvas, white and restrained neutrals.
- Keep Inter as the staff UI typography baseline and Lucide as the icon system.
- Keep the public website and staff app distinct but aligned to the same brand foundation.
- Treat the staff admin app as the design unit; do not redesign only a dashboard or a single page.
- Do not bypass permissions, workflow gates, URL state handling, or server-side policy.
- Do not add duplicate navigation registries, duplicate notification bridges, or new override-style systems.

## Repository facts verified from code
- `app/layout.tsx` imports a long sequence of CSS files, including legacy admin hotfixes and refinements, then loads the canonical admin system last.
- `app/admin/workflow-navigation.ts` is the single canonical workspace registry and permission map.
- `app/admin/operations-ui.tsx` defines the shared Ops primitives used across the staff UI.
- `app/admin/operations-system.css` is the active shared styling layer for the admin product.
- `app/admin/shipments/shipment-queue-policy.ts` explicitly states that priority logic is display-only and not a mutation permission.
- `app/admin/workflow-guard.ts`, `app/admin/staff-permissions.ts`, and related policies control workflow readiness and access.
- `app/admin/use-workspace-query.ts` owns URL state, filters, selection and return context.

## 1) Product route and surface inventory

### Public marketing site
- `/`
- `/about`
- `/contact`
- `/network`
- `/privacy`
- `/quote`
- `/tracking`
- `/services`
- `/services/air-freight`
- `/services/break-bulk-cargo`
- `/services/customs-clearance`
- `/services/door-to-door`
- `/services/ground-transport`
- `/services/open-top-container`
- `/services/packaging-storage`
- `/services/project-cargo`
- `/services/road-freight`
- `/services/sea-freight`
- `/services/warehousing`

### Staff operations system
- `/admin`
- `/admin/command-centre`
- `/admin/shipments`
- `/admin/jobs/[reference]`
- `/admin/jobs/[reference]/profitability`
- `/admin/freight-documents`
- `/admin/visibility`
- `/admin/customs`
- `/admin/documents`
- `/admin/delivery`
- `/admin/alerts`
- `/admin/notifications`
- `/admin/enquiries`
- `/admin/crm`
- `/admin/crm/[id]`
- `/admin/crm/new`
- `/admin/market-estimate`
- `/admin/rating`
- `/admin/rating/[order]`
- `/admin/pricing`
- `/admin/consolidation`
- `/admin/tenders`
- `/admin/tenders/[tender]`
- `/admin/partners`
- `/admin/partners/[id]`
- `/admin/partners/new`
- `/admin/partners/reconciliation`
- `/admin/carrier-integrations`
- `/admin/edi`
- `/admin/finance`
- `/admin/finance/invoices/[reference]`
- `/admin/finance/new`
- `/admin/finance/new/[shipmentReference]`
- `/admin/payables`
- `/admin/payables/bills/[reference]`
- `/admin/freight-audit`
- `/admin/management`
- `/admin/migration`
- `/admin/migration/archive`
- `/admin/migration/batches/[batchId]`
- `/admin/migration/recovery`
- `/admin/staff`
- `/admin/pickups`
- `/admin/branches/[branch]`
- `/admin/workload/[key]`

## 2) Design debt and duplicated UI systems

### Duplicate CSS ownership
The repo currently loads multiple overlapping admin CSS layers in `app/layout.tsx`:
- `globals.css`
- `operations-theme.css`
- `operations-polish.css`
- `operations-hotfix.css`
- `operations-v4-compat.css`
- `brand-system.css`
- `operations-editorial.css`
- `operations-mobile.css`
- `operations-action-hierarchy.css`
- `operations-detail-refinement.css`
- `commercial-v4-compat.css`
- `commercial-detail-refinement.css`
- `admin-design-system.css`
- `operations-overview-refinement.css`
- `operations-overview-responsive.css`
- `operations-overview-interactive.css`
- `shipment-detail-v2.css`
- `admin-typography.css`
- `shipment-detail-hierarchy.css`
- `operations-system.css`

This is direct evidence of duplicated UI systems and overlapping design ownership. A safe redesign must consolidate these layers before adding more per-route styles.

### Inherited drift in repo guidance
`docs/OPERATING_SYSTEM.md` explicitly states the original system loaded 18 overlapping admin stylesheets and drifted in hierarchy, density and action emphasis. That is the design debt the new plan addresses.

## 3) Workflow and permission constraints that must not change
- `workflow-navigation.ts` is the sole source of navigation visibility.
- `workspaceAllowed` and `activeWorkspace` determine access and active state.
- `useWorkspaceQuery` preserves filters, sort, pagination, selection and return context.
- `shipment-queue-policy.ts` is display-only; it never authorizes transitions.
- `workflow-guard.ts` and related policy files enforce blockers, readiness and closure.
- `staff-permissions.ts` governs commercial, finance, job-file and staff access.
- Overview and register UIs must not trigger automation or notifications on render.

## 4) Canonical shared-system changes to prioritize first
- `app/admin/operations-system.css` — shared design tokens, base styling, shell, page anatomy, controls and table patterns.
- `app/admin/operations-ui.tsx` — shared page, toolbar, search, field, button and status primitives.
- `app/admin/operations-shell.tsx` — shell chrome and app-level structure.
- `app/admin/workflow-navigation.ts` — canonical navigation grouping and permission registry.
- `app/admin/admin-typography.css` — typography mapping.
- `app/admin/use-workspace-query.ts` — route-state continuity across list/detail flows.

## 5) Migration batches

### Batch 0: route audit and dependency lock
- Confirm all route files and actual user-facing paths.
- Confirm which CSS layers are legacy vs canonical.
- Confirm the shell and route registry remain authoritative.

### Batch 1: shared foundation
- Unify tokens, spacing, type scale, control height and surface rhythm.
- Normalize shell, toolbar and page heading behavior.
- Consistent button, search, filter chip and form styling.

### Batch 2: core operations surfaces
- `/admin/command-centre`
- `/admin/shipments`
- `/admin/jobs/[reference]`
- `/admin/freight-documents`
- `/admin/customs`
- `/admin/documents`
- `/admin/delivery`
- `/admin/alerts`
- `/admin/notifications`
- `/admin/visibility`
- `/admin/pickups`

### Batch 3: commercial and network surfaces
- `/admin/enquiries`
- `/admin/crm`
- `/admin/crm/[id]`
- `/admin/crm/new`
- `/admin/market-estimate`
- `/admin/rating`
- `/admin/rating/[order]`
- `/admin/pricing`
- `/admin/consolidation`
- `/admin/tenders`
- `/admin/tenders/[tender]`
- `/admin/partners`
- `/admin/partners/[id]`
- `/admin/partners/new`
- `/admin/partners/reconciliation`
- `/admin/carrier-integrations`
- `/admin/edi`

### Batch 4: finance, management, staff, and migration
- `/admin/finance`
- `/admin/finance/invoices/[reference]`
- `/admin/finance/new`
- `/admin/finance/new/[shipmentReference]`
- `/admin/payables`
- `/admin/payables/bills/[reference]`
- `/admin/freight-audit`
- `/admin/management`
- `/admin/migration`
- `/admin/migration/archive`
- `/admin/migration/batches/[batchId]`
- `/admin/migration/recovery`
- `/admin/staff`

### Batch 5: public marketing alignment
- `/`
- `/services/*`
- marketing pages and landing sections

## 6) Safest implementation order
1. Shared foundation first.
2. Core operations surfaces next.
3. Commercial/network surfaces after that.
4. Finance, management and migration next.
5. Public marketing pages last.

This order keeps all business and permission logic intact while reducing design drift early and preventing route-by-route cosmetic patching.

## 7) Validation matrix
For each migration batch, validate with:
- `npm run check:ui`
- `npm run lint`
- `npm test`
- permission and navigation checks for protected routes
- list/detail return-state review for filters and selection
- keyboard/focus review for key screens
- loading/empty/error states review

## 8) Blockers and external dependencies
- Cloudflare Workers Builds failures have been reported externally and do not provide actionable repo-level diagnostics.
- Browser validation is constrained by auth/sign-in gates and remote host assumptions.
- Some workflows require external credentials or live carrier/partner data not available in a clean local environment.
- UI changes cannot bypass server-side permissions or workflow policy.

## 9) Success criteria
The redesign is successful when the KCPL staff operating system reads as one coherent product: calm, precise, legible, operationally confident, fast to scan and unmistakably KCPL, while preserving real business logic, permissions and workflow truth.

## 10) Notes for the next agent
- Start with the shared product foundations before any route-level redesign.
- Treat duplicate CSS and route-local patchwork as design debt rather than a final state.
- Keep the product as a single system with one shared interaction model.
- If a route is blocked by missing infrastructure or credentials, document the blocker rather than forcing a workaround.
