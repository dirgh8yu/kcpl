# KCPL Full System Audit v2 — Stage 1 Baseline & Architecture Map

**Scope:** baseline and architecture inventory only. This report does not perform the hostile commercial-chain audit, does not remediate application code, and does not mutate production state.

## 1. Audited SHA / repository state

- Repository: `dirgh8yu/kcpl`
- Expected starting SHA supplied to the audit: `61bd787fdf1d76819ca6547e74383a0e751592a6`
- Current `main` at the final pre-write check: **`6eaf0be66f74927c5bb0ba98472c93197cce9275`**
- Open PRs at audit start: **0**
- Current `main` is not branch-protected in the GitHub branch metadata; required status-check enforcement is off.
- Comparison of `61bd787f...` to `6eaf0be...` shows only four later audit-document changes under `docs/audits-v2/02-05`. No executable application/configuration code changed after `61bd787f`.
- Therefore the executable post-remediation application baseline audited here is the code tree at `61bd787fdf1d76819ca6547e74383a0e751592a6`, while the repository snapshot containing the concurrent later audit documents is `6eaf0be66f74927c5bb0ba98472c93197cce9275`.
- This Stage 1 report is itself a documentation-only commit created after that snapshot.

### Repository/runtime anchors

- `package.json`: Next.js 16.3.2, React 19.2.8, Firebase 12, Firebase Admin 13, Node >=22.13.0.
- CI: `.github/workflows/ci.yml`
- Hosting config: `apphosting.yaml`
- Environment reference: `.env.example`
- Primary application roots: `app/admin/`, `app/api/`, `app/shipment-types.ts`, Firebase server/client bootstrap files under `app/`.

## 2. System module inventory

The table names the principal server-side authority or policy source and the important API surface. Some domains also have page/client presentation files that are intentionally not treated as authority.

| Domain | Principal sources / policy | Important API surface |
|---|---|---|
| Authentication | `app/admin/admin-auth.ts`, Firebase server bootstrap, `app/admin/staff-directory.server.ts` | authenticated admin routes under `app/api/admin/**` |
| Staff profiles | `app/admin/staff-directory.server.ts`, `app/admin/staff-authority-policy.ts` | staff/admin access flows |
| RBAC | `app/admin/staff-authority-policy.ts`, `app/admin/admin-auth.ts`, domain authorization helpers | enforced per admin API/server action |
| Branch authorization | `app/admin/branch-access-policy.ts`, `app/admin/canonical-record-match.ts`, `app/admin/shipment-access-policy.ts`, `app/admin/shipment-access.server.ts` | shipment, CRM, finance, tender, EDI, migration APIs |
| CRM / customers | `app/admin/crm/crm-access.server.ts`, `crm-customer-management.server.ts`, CRM data/server modules | `app/api/admin/crm/customers/[id]/route.ts` and CRM admin flows |
| Enquiries | CRM/admin enquiry workflow under `app/admin/crm/` | admin CRM/enquiry flow; conversion into transport-order workflow |
| Quotes | CRM quote linkage plus commercial-lineage quote policy | `app/api/admin/quotes/[reference]/route.ts` |
| Transport orders | `app/admin/rating/tms-rating.ts` for core order type/status; order/rating/pricing server modules | rating, pricing, tender and consolidation APIs operate on canonical orders |
| Rate Desk | `app/admin/rating/tms-rating.ts`, `app/admin/rating/tms-rating.server.ts` | `app/api/admin/rating/route.ts` |
| Partner rate cards | rating server/data model in `app/admin/rating/` | rating API |
| Pricing | `app/admin/pricing/tms-pricing.server.ts` | `app/api/admin/pricing/route.ts` |
| FX | commercial/pricing snapshot inputs and finance/CRM currency handling | read/query surfaces plus commercial snapshot creation; settlement itself does not silently FX-convert |
| `commercial_versions` | `app/admin/commercial-lineage/commercial-lineage.ts`, `commercial-lineage.server.ts` | commercial mutation endpoints call server lineage policy |
| `commercial_approvals` | `commercial-mutation-policy.server.ts`, `quote-commercial-policy.server.ts` | pricing/quote mutation endpoints |
| Consolidation | `app/admin/consolidation/tms-consolidation.ts`, `tms-consolidation.server.ts`, lineage/release helpers | `app/api/admin/consolidation/route.ts` |
| Tenders | `app/admin/tenders/tms-tendering.ts`, `tms-tendering.server.ts`, expiry and booking-artifact helpers | `app/api/admin/tenders/route.ts` |
| EDI 204 / 990 / 214 | `app/admin/edi/edi-gateway.server.ts`, `edi-tender.server.ts`, `edi-match-policy.ts`, `edi-trust-boundary.server.ts` | `app/api/admin/edi/route.ts`, `app/api/integrations/edi/route.ts` |
| Booking | tender server + `app/admin/tenders/tms-booking-artifacts.server.ts`, booking-lineage dispatch helper | tender API; creates canonical shipment/booking artifacts |
| Pickup | `app/admin/pickups/pickup-appointments.ts` plus pickup server workflow | `app/api/integrations/pickups/route.ts`, `app/api/gpt/pickups/route.ts` |
| Job File | deterministic booking artifact seeding under `tms-booking-artifacts.server.ts` | seeded from booking transaction/workflow, then shipment-scoped subcollections |
| Freight documents | freight-document workflow modules under admin/document features | admin document APIs/workflows |
| Document Vault | document policy/server modules; document regression suite | document/admin surfaces |
| Tracking | `app/admin/visibility/tracking-visibility.ts`, `tracking-visibility.server.ts`, `tracking-ingest.server.ts` | `app/api/integrations/tracking/route.ts` |
| DHL | carrier integration server under `app/admin/carrier-integrations/` | provider-backed carrier/tracking integration surfaces |
| Maersk / DCSA | `app/admin/carrier-integrations/carrier-integrations.server.ts`, `maersk-webhook.server.ts` | `app/api/integrations/carriers/maersk/route.ts` |
| Customs | `app/admin/customs/customs-policy.ts` plus customs server workflow | customs admin/workflow surfaces |
| Shipment exceptions | shipment exception policy/workflow plus canonical shipment `exception` state | shipment/admin workflow |
| Delivery / POD | `app/admin/delivery/delivery-control.ts` and server workflow | delivery/admin workflow and document evidence paths |
| AR | `app/admin/financial-settlement/receivables-settlement.server.ts`, finance server | `app/api/admin/finance/invoices/route.ts`, `.../invoices/[reference]/payments/route.ts` |
| AP | `app/admin/financial-settlement/payables-settlement.server.ts` | `app/api/admin/payables/bills/route.ts`, `.../bills/[reference]/payments/route.ts` |
| Freight Audit | `app/admin/freight-audit/freight-audit.ts`, `freight-audit.server.ts` | `app/api/admin/freight-audit/route.ts` |
| Match-Pay | `app/admin/financial-settlement/settlement-policy.ts` + AP settlement server + Freight Audit gate | AP payment route |
| Supplier reconciliation | `supplier-reconciliation-settlement.server.ts`, finance-linking helpers | `app/api/admin/partners/reconciliation/route.ts` |
| Profitability | `app/admin/commercial-lineage/commercial-profitability.ts`, `.server.ts` | server-derived profitability from booked lineage/financial facts |
| Paper archive / migration | `app/admin/migration/archive/archive-scope-policy.ts`, `archive.server.ts` | `app/api/admin/migration/archive/route.ts` |
| GPT read-only gateway | `app/gpt-action-auth.server.ts`, GPT read routes | GPT routes including briefing/pickup/read models; principal secret is distinct from staff auth |
| Machine principals | `app/machine-auth-policy.ts`, EDI trust-boundary helper, integration-specific server auth | EDI, tracking, pickup, Maersk, automation integration routes |
| Admin navigation/search | admin navigation/workflow-navigation code and route/page registry | browser navigation and Cmd+K UI; never authorization authority |

## 3. Status inventory

This inventory uses code constants/types and regression-contract values, not UI labels.

### Transport orders
`TmsOrderStatus` in `app/admin/rating/tms-rating.ts`:

`draft` → `rated` → `selected` → `tendering` → `booked`, with `cancelled` as a terminal alternative.

Exact values: **`draft`, `rated`, `selected`, `tendering`, `booked`, `cancelled`**.

### Tenders
`tmsTenderStatuses` in `app/admin/tenders/tms-tendering.ts`:

**`sent`, `accepted`, `rejected`, `countered`, `expired`, `cancelled`, `booked`**.

Active states are `sent`, `accepted`, `countered`. Terminal states are `rejected`, `expired`, `cancelled`, `booked`. Only `accepted` or `countered` can book.

### Canonical shipments / bookings
`shipmentStatuses` in `app/shipment-types.ts`:

**`booking_confirmed`, `preparing`, `in_transit`, `customs_clearance`, `out_for_delivery`, `delivered`, `exception`**.

`delivered` is terminal for external promotion policy. `exception` requires KCPL resolution rather than provider overwrite.

### Consolidation loads
`tmsLoadStatuses` in `app/admin/consolidation/tms-consolidation.ts`:

**`draft`, `ready_for_procurement`, `tendering`, `booked`, `cancelled`**.

Membership mutation is limited to `draft`; procurement then locks member ownership.

### Pickup appointments
The pickup policy/regression contract uses:

**`unscheduled`, `requested`, `confirmed`, `driver_assigned`, `missed`, `picked_up`, `cancelled`**.

`picked_up` and `cancelled` are terminal; `missed` can be rescheduled.

### Customs
`customsClearanceStatuses` in `app/admin/customs/customs-policy.ts`:

**`not_started`, `preparing`, `lodged`, `held`, `released`**.

Derived customs-desk states are **`blocked`, `in_progress`, `awaiting_release`, `ready`, `released`**.

### Delivery / POD
Delivery attempt policy uses **`scheduled`, `out_for_delivery`, `delivered`, `failed`, `refused`** in the verified transition contract. POD evidence is independently tracked as **`not_received`, `received`, `verified`** in the delivery state derivation. Derived desk state distinguishes `delivery_active`, `delivery_failed`, `delivered_pod_pending`, and `pod_verified`.

### Shipment exceptions
Canonical shipment state has a distinct **`exception`** status. Exception records are separate operational records and external exception observations do not automatically clear or overwrite KCPL canonical state. Stage 1 deliberately does not invent an exception-record enum where no single exported enum was established during this baseline pass.

### AR / AP invoices and bills
Settlement authority is not represented as one shared invoice/bill enum. Payment truth is composite: canonical invoice/bill facts, amount already paid, outstanding amount, payment records/idempotency, and for TMS supplier bills Freight Audit eligibility. Stage 1 therefore does not substitute UI labels for an unverified common enum.

### Freight Audit
`freightAuditStatuses` in `app/admin/freight-audit/freight-audit.ts`:

**`pending`, `matched`, `review_required`, `disputed`, `approved_variance`, `rejected`, `not_applicable`**.

Payment allowed: `matched`, `approved_variance`, `not_applicable`. Payment blocked for the other states.

Commercial-lineage classification on an audit record is **`versioned`, `legacy_unversioned`, `commercial_review_required`**.

### Tracking milestones / external reconciliation
The external workflow policy handles milestones including pickup scheduling/pickup, terminal/departure/transshipment/arrival, export/import customs, out-for-delivery, delivery attempts, delivered, provider exception, and delivery refused. Canonical promotion decisions are exactly:

**`promote`, `observe_only`, `blocked`, `no_change`**.

A provider milestone is therefore not itself a canonical shipment status transition.

### Commercial lineage
`commercial_versions` are immutable economic snapshots bound by schema/fingerprint rather than a mutable lifecycle status. Approval is represented separately by commercial approval/mutation policy. Booked records carry the immutable version/fingerprint forward.

## 4. Authority matrix

| Domain | Authoritative source | Non-authoritative / derived inputs |
|---|---|---|
| Human identity | Firebase authenticated identity | browser claims alone |
| Staff authorization | persisted staff directory/profile interpreted by `staff-authority-policy` | email allowlists, client role labels, navigation visibility |
| Staff role/scope | persisted staff profile; bootstrap exception is a special initialization path | arbitrary request role/scope |
| Branch access | canonical record branch + persisted staff scope, evaluated by branch/access helpers | query/body/browser-selected branch by itself |
| Customer | canonical CRM customer record | quote/order display copy of customer name |
| Transport order | canonical TMS order document | UI state |
| Procurement/rate selection | selected rate-card/order facts, then immutable commercial snapshot once versioned | mutable presentation totals after booking |
| Commercial economics | immutable `commercial_versions` + fingerprint | recomputed client totals, stale mutable compatibility fields |
| Pricing approval | commercial approval/mutation policy and approval record bound to economic version/fingerprint | button visibility or client approval flag |
| Quote economics | quote bound to approved commercial lineage | client-submitted totals without lineage verification |
| Tender economics | tender snapshot/version lineage and accepted/countered final commercials | carrier/provider raw payload alone |
| Booked economics | booked commercial version ID/fingerprint/snapshot propagated to canonical booking/shipment | current rate card after booking |
| Consolidation membership | canonical load + order membership fields under transactional server authority | client list composition |
| Booking/shipment identity | canonical shipment/booking document and deterministic cross-references | provider tracking identity alone |
| Pickup | KCPL pickup appointment record | provider pickup observation by itself |
| Job File | deterministic shipment-scoped booking artifacts | browser-generated tasks |
| Tracking | provider data is an observation; KCPL tracking ingestion stores normalized observation | provider status string as workflow authority |
| Canonical shipment workflow | `app/shipment-types.ts` plus KCPL external promotion/workflow policy | DHL/Maersk/DCSA/EDI tracking status directly |
| Customs | KCPL customs workflow and explicit release evidence | provider customs milestone alone |
| Delivery/POD | KCPL delivery attempt workflow + verified POD evidence | carrier `delivered` observation alone |
| Operational exceptions | KCPL exception workflow; external events may create/derive exception work | provider exception resolving itself |
| AP supplier bill | canonical bill facts + supplier identity | copied shipment display fields |
| Freight Audit | Freight Audit record recomputed/validated against booked commercial lineage and bill fingerprint | stale prior audit after bill/economic edits |
| Match-Pay / supplier settlement | transactional AP settlement policy, Freight Audit payment gate, payment idempotency | UI paid checkbox |
| AR settlement | transactional receivables settlement facts/payment records | client outstanding calculation |
| Supplier reconciliation | transactional reconciliation server + canonical supplier identity | free-text supplier match |
| Profitability | booked commercial lineage combined with canonical financial facts | current rate-card estimate |
| GPT | read-only projection/gateway | GPT output is never canonical mutation authority |

## 5. Trust boundary matrix

| Principal / boundary | Authentication mechanism | Allowed scope | Branch authority | Read/write | Canonical transitions |
|---|---|---|---|---|---|
| Human staff | Firebase identity followed by persisted staff authorization | role/capability constrained | persisted staff scope checked against canonical record branch | read/write by capability | only through domain server policies |
| Bootstrap staff/admin path | special initialization logic in staff authority/directory | bootstrap only | must not become general bypass | narrowly scoped write | establishes staff authority, not business workflow state |
| GPT | `KCPL_GPT_ACTION_SECRET` / GPT action auth | dedicated GPT gateway | server-side query scoping | intended read-only | none |
| EDI machine principal | `KCPL_EDI_SECRET` through EDI trust-boundary code | EDI messages only | canonical matched order/tender/shipment branch | controlled write | 204 dispatch and 990/214 handling only through shared domain transitions |
| Tracking ingestion | `KCPL_TRACKING_INGEST_SECRET` | normalized tracking observations | matched canonical shipment | observation write; guarded reconciliation | may request promotion only when `evaluateExternalPromotion` permits it |
| Pickup integration | `KCPL_PICKUP_INTEGRATION_SECRET` | pickup workflow observations/updates | matched shipment/pickup branch | controlled write | pickup-domain only; canonical promotion remains guarded |
| Maersk webhook | `MAERSK_WEBHOOK_SECRET` | Maersk/DCSA events | matched shipment | observation write | no direct provider-owned canonical state |
| Internal automation | `KCPL_AUTOMATION_SECRET` | explicitly implemented automation actions | canonical target record | controlled machine write | only domain transitions exposed by automation policy |
| DHL outbound integration | DHL credentials | provider query/API operations | server-selected shipment | provider read/observation ingestion | none directly |
| Maersk outbound integration | Maersk credentials | provider query/API operations | server-selected shipment | provider read/observation ingestion | none directly |
| External carrier/provider | provider response/webhook payload | untrusted external facts | never caller-provided branch authority | observation/input | cannot independently override KCPL workflow gates |

Key post-remediation trust-boundary rule: a machine credential authenticates a machine principal only. It does not acquire a human role, organization-wide staff scope, or arbitrary branch authority.

## 6. Data-lineage map

The key lineage is relational rather than a single collection chain. The principal binding fields/fingerprints are:

```text
Customer
  customer_id
      ↓
Enquiry
  enquiry/customer reference
      ↓
Transport Order
  order_id + branch + customer_id
      ↓
Rate selection / pricing
  selected rate_card_id + partner_id + procurement economics
      ↓
commercial_versions
  commercial_version_id
  commercial fingerprint
  immutable economic snapshot
      ↓
commercial_approvals / quote policy
  approval bound to approved version/economics
      ↓
Quote
  quote/reference + order/customer + commercial version/fingerprint
      ↓
Tender (optional procurement path)
  tender_id + order_id + partner + commercial lineage
  accepted/countered final commercials
      ↓
Booking / Shipment
  booking_reference + shipment_reference
  transport_order_id + tender_id where applicable
  branch + customer_id
  booked_commercial_version_id
  booked_commercial_fingerprint
  booked commercial snapshot
      ↓
Consolidation (optional)
  load_id/reference + master order/tender/booking
  member order IDs + house shipment references
      ↓
Pickup / Job File / Tracking / Customs / Delivery
  shipment_reference is the principal operational join
  deterministic job artifacts live under shipment scope
  tracking has provider/event identity + observation fingerprint/time
  customs and delivery/POD remain KCPL workflow records
      ↓
Supplier Bill / Freight Audit
  payable_reference + supplier_bill_reference
  shipment_reference
  booked commercial version/fingerprint
  audit economic fingerprint
      ↓
Payment / Match-Pay
  payable/invoice reference + deterministic/idempotent payment identity
  outstanding balance updated transactionally
      ↓
Profitability
  booked sell/procurement lineage + canonical AR/AP settlement facts
```

Important integrity bindings observed in the remediations/tests include `active_tender_id`, deterministic booking operation identity, `shipment_reference`, `booking_reference`, consolidation master/house references, `booked_commercial_version_id`, `booked_commercial_fingerprint`, commercial snapshot fingerprints, Freight Audit economic fingerprint, and deterministic payment/idempotency keys.

## 7. End-to-end lifecycle

### Primary intended chain

```text
Enquiry
→ Customer
→ Transport Order
→ Rate selection
→ Pricing
→ Approval
→ Quote
→ Tender
→ EDI 204 where applicable
→ 990 / carrier response where applicable
→ Booking
→ Pickup
→ Job File
→ Tracking observations
→ Customs workflow where required
→ Delivery / POD
→ Freight Audit
→ Match-Pay
→ Profitability
```

This is a dependency map, not a mandatory single state machine.

### Legitimate alternate paths

- A shipment does not have to use EDI. Tender channels include `manual`, `email`, and `edi_204`.
- A quote/order may follow a non-EDI booking path when the carrier/procurement process does not require EDI.
- A shipment does not have to belong to a consolidation. Consolidation adds a master/house graph only for eligible grouped orders.
- Consolidation creates master procurement/booking authority plus house/member shipment identities; it is not a replacement for each member's customer/order lineage.
- Pickup is its own appointment workflow and may be rescheduled after `missed`; it is not a synonym for shipment `preparing`.
- Tracking events are observations and can arrive late or out of order. They are reconciled against canonical pickup/customs/delivery state.
- Customs is conditional on direction/service and can overlap operational tracking. Release is a separate KCPL fact.
- Carrier `delivered` is insufficient for canonical delivered promotion without KCPL delivery completion and verified POD.
- Ancillary supplier bills can be Freight-Audit `not_applicable` while carrier freight bills remain subject to Match-Pay controls.
- Manual KCPL workflow actions remain legitimate even where external provider observations also exist.

## 8. Remediation #126-#130 touchpoints

### #126 Financial settlement integrity

Core changed files:

- `app/admin/financial-settlement/payables-settlement.server.ts`
- `app/admin/financial-settlement/receivables-settlement.server.ts`
- `app/admin/financial-settlement/settlement-policy.ts`
- `app/admin/financial-settlement/supplier-reconciliation-settlement.server.ts`
- AP/AR payment routes
- partner reconciliation route
- `tests/financial-settlement-integrity.test.mjs`

Primary boundaries introduced/strengthened: transactional payment posting, duplicate supplier invoice uniqueness, deterministic payment/idempotency identity, tax-inclusive settlement basis, overpayment prevention, Freight Audit staleness/fingerprint checks, supplier-reconciliation locking.

### #127 Tender / booking / consolidation concurrency

Core changed files:

- `app/admin/consolidation/tms-consolidation.server.ts`
- `app/admin/consolidation/tms-consolidation.ts`
- `app/admin/edi/edi-gateway.server.ts`
- `app/admin/tenders/tms-booking-artifacts.server.ts`
- `app/admin/tenders/tms-tender-expiry.server.ts`
- `app/admin/tenders/tms-tendering.server.ts`
- `app/admin/tenders/tms-tendering.ts`
- consolidation/tender APIs
- `tests/tms-consolidation.test.mjs`
- `tests/tms-tender-policy.test.mjs`

Primary boundaries: one-active-tender pointer/state, transaction-time response/cancellation checks, one-booking invariant, deterministic shipment/job-artifact creation, consolidation membership/procurement locking, EDI 990 routed through shared tender transition.

### #128 RBAC / trust boundaries

Core changed files include:

- `app/admin/admin-auth.ts`
- `app/admin/staff-authority-policy.ts`
- `app/admin/staff-directory.server.ts`
- `app/admin/branch-access-policy.ts`
- `app/admin/canonical-record-match.ts`
- shipment access policy/server
- CRM access/customer/quote-link servers
- EDI match/trust-boundary servers
- finance authorization/linking/server
- Freight Audit and financial-settlement servers
- migration archive scope/server
- Maersk webhook server
- `app/gpt-action-auth.server.ts`
- `app/machine-auth-policy.ts`
- dangerous admin, finance, migration, tender, shipment, EDI, GPT and integration routes
- `.env.example`
- four RBAC/trust-boundary regression suites

Primary boundaries: persisted staff authority, fail-closed role/scope/branch checks, canonical-record branch matching, separate machine principals, GPT read-only authority, same-origin/capability controls on dangerous human mutations.

### #129 Commercial economic lineage

Core changed files:

- `app/admin/commercial-lineage/commercial-lineage.ts`
- `commercial-lineage.server.ts`
- `commercial-mutation-policy.ts` / `.server.ts`
- `quote-commercial-policy.ts` / `.server.ts`
- `commercial-profitability.ts` / `.server.ts`
- rating/pricing server code
- tender booking-lineage dispatch
- consolidation lineage/release helpers
- finance, Freight Audit and settlement integration
- rating/pricing/quote/tender/consolidation APIs
- commercial lineage/profitability/booking-lineage tests

Primary data introduced/strengthened: immutable `commercial_versions`, commercial fingerprints, approval-bound mutation, booked commercial version/fingerprint/snapshot, lineage-aware profitability and Freight Audit/settlement validation.

### #130 External event workflow authority

Actual changed files reverified directly from PR #130:

- `app/admin/carrier-integrations/carrier-integrations.server.ts`
- `app/admin/visibility/external-workflow-state.ts`
- `app/admin/visibility/tracking-ingest.server.ts`
- `app/admin/visibility/tracking-visibility.server.ts`
- `app/admin/visibility/tracking-visibility.ts`
- `app/api/gpt/briefing/route.ts`
- `app/api/integrations/pickups/route.ts`
- `app/api/integrations/tracking/route.ts`
- `tests/external-workflow-ingestion-hardening.test.mjs`
- `tests/external-workflow-state.test.mjs`

Primary boundary: external events are observations. Canonical promotion is separately evaluated and may return `promote`, `observe_only`, `blocked`, or `no_change`. Pickup reconciliation, blocking exceptions, customs release, POD verification, delivery workflow completion, terminal state and late-event rules constrain promotion.

## 9. Configuration inventory

### Secrets/integration configuration referenced by the post-remediation system

`.env.example` documents, among others:

- `KCPL_GPT_ACTION_SECRET`
- `KCPL_EDI_SECRET`
- `KCPL_AUTOMATION_SECRET`
- `KCPL_TRACKING_INGEST_SECRET`
- `KCPL_PICKUP_INTEGRATION_SECRET`
- `MAERSK_WEBHOOK_SECRET`
- DHL credentials
- Maersk credentials
- SendGrid/email configuration
- Google Maps/provider configuration where used

The runtime trust-boundary code has dedicated principals/routes for GPT, EDI, automation, tracking ingestion, pickup integration and Maersk webhook handling.

### App Hosting comparison

Checked-in `apphosting.yaml` binds **`KCPL_GPT_ACTION_SECRET`** but does not declare corresponding bindings for the other remediation-era machine-principal secrets listed above.

This is recorded as a **configuration-readiness mismatch**, not proof that production is currently unauthenticated or broken. Those secrets may be provisioned through deployment/environment mechanisms outside the checked-in file. Stage 1 did not mutate or inspect production secret state.

## 10. Test inventory

`package.json` at the executable baseline registers **27 explicit Node test files** in `npm test` using `node --experimental-strip-types --test`.

Coverage families include:

- RBAC/security: 4 suites
- customs policy
- document policy
- migration recovery
- production readiness
- shipment exceptions
- TMS rating
- tender policy
- consolidation
- pricing
- tracking visibility
- delivery/POD
- Freight Audit
- financial settlement integrity
- commercial economic lineage
- commercial profitability lineage
- booking-lineage dispatch
- workflow navigation
- pickup appointments
- freight documents
- carrier integrations
- EDI X12
- external workflow state
- external workflow ingestion hardening

CI in `.github/workflows/ci.yml` runs on pull requests and pushes to `main` and performs:

1. `npm ci`
2. production dependency audit at high severity
3. `npm run lint`
4. `npx tsc --noEmit`
5. `npm test`
6. `npm run build`

This audit did not treat the existence of green tests as proof of correctness. The test script enumerates files explicitly rather than discovering all `tests/**` automatically.

## 11. Baseline findings

### KCPL-V2-BASE-001 — P2 — Checked-in App Hosting bindings lag the machine-principal configuration surface

`.env.example` and runtime architecture define separate secrets for EDI, automation, tracking ingestion, pickup integration and Maersk webhook handling, but checked-in `apphosting.yaml` only binds `KCPL_GPT_ACTION_SECRET` among this remediation-era principal set.

**Impact:** a deployment based solely on checked-in App Hosting bindings can be operationally incomplete or fail closed on those integrations. This is a deployment-readiness/configuration gap, not evidence that the application has an authorization bypass.

**Stage follow-up:** verify actual deployed secret bindings independently of code and prove each machine route fails closed when its secret is absent/incorrect.

### KCPL-V2-BASE-002 — P3 — Regression test registration is explicit rather than discovery-based

`npm test` names 27 suite files individually.

**Impact:** a new test file can exist in `tests/` yet not execute in CI unless `package.json` is updated. This weakens the regression-control envelope but is not itself an application defect.

### KCPL-V2-BASE-003 — P3 — Legacy tender-authority repair remains a live compatibility path

`tms-tendering.ts` deliberately supports a `legacy_unique` authority decision when the canonical `active_tender_id` pointer is absent/stale but exactly one compatible live tender can be proven.

**Impact:** this is a complexity/trust-reconstruction path, not a confirmed bypass. It deserves adversarial coverage because authority is being repaired from multiple facts rather than read from one pointer.

**Stage follow-up:** attack ambiguous, stale, cross-branch, concurrently retendered and partially migrated records and confirm the repair path always fails closed when uniqueness/branch identity is not provable.

### KCPL-V2-BASE-004 — P3 — `main` is currently unprotected at the repository control layer

GitHub branch metadata reports `main` as unprotected with required status-check enforcement off.

**Impact:** CI is defined but repository policy does not require those checks before changes reach `main`. This is repository governance risk, not an application runtime vulnerability.

No P0 or P1 baseline finding is asserted at Stage 1.

## 12. Questions Stage 2 must attack

Stage 2 should treat this map as hypotheses to break, especially:

1. Can any quote, pricing, tender, consolidation or booking path create/change economics without a valid immutable `commercial_version` and matching fingerprint?
2. Can a valid approval be replayed after sell/buy price, FX, rate card, partner, service, equipment, quantity, surcharge or accessorial economics change?
3. Are all quote/tender/booking alternate paths bound to the same booked economic lineage, including counter-offers and consolidation master procurement?
4. Is any compatibility/legacy economic field still trusted as authority after a versioned record exists?
5. Can the `legacy_unique` tender repair path ever select an old/stale/cross-branch tender after retendering or concurrent updates?
6. Does every dangerous API derive branch authority from persisted canonical records plus persisted staff scope, never from browser/query/body/customer fallback alone?
7. Can any machine principal cross into another integration's scope, impersonate staff, acquire organization-wide access, or trigger a transition outside its intended domain?
8. Can EDI 990/214, pickup integration, tracking ingestion, Maersk/DCSA events or another provider directly mutate canonical workflow state without the shared KCPL transition policy?
9. Can a late or duplicated external event regress state, clear an exception, bypass pickup reconciliation, bypass customs release, or produce canonical delivery without verified POD?
10. Are booking and consolidation graph creation truly atomic from order/tender state through shipment/master-house references and deterministic Job File artifacts, including retry repair?
11. Can supplier identity, invoice totals/tax/currency, booked commercial lineage or Freight Audit facts change after approval without making the audit stale and blocking payment?
12. Can any AP posting/reconciliation path pay a TMS carrier bill before Freight Audit/Match-Pay eligibility, or overpay under concurrent/duplicate requests?
13. Are all required machine/provider secrets actually bound in the deployed runtime even though checked-in `apphosting.yaml` does not declare most of them?
14. Are there tests present under `tests/` that are omitted from the explicit `npm test` list, and do all critical routes have negative authorization/state-transition tests?
15. Which alternate lifecycle paths are intentional, and which are bypass-looking dead/legacy routes that no longer share canonical authority helpers?

---

**Stage 1 stop point:** baseline, architecture, authority, trust-boundary, lineage, configuration and regression-test inventory complete. No application remediation performed. No Stage 2 commercial-chain conclusion is asserted here.