# KCPL Full System Audit v2 - Stage 5: RBAC and Cross-Module Trust Boundaries

**Audit type:** hostile authorization / trust-boundary audit, audit-only  
**Repository:** `dirgh8yu/kcpl`  
**Latest `main` immediately before report write:** `fe85403de04d5ff7885bf38ef9981b17ff91a988`  
**Application code ref audited:** `61bd787fdf1d76819ca6547e74383a0e751592a6` (`#130`)  
**Application delta from `61bd787` to pre-write `main`:** documentation only (`02-commercial-chain.md`, `04-finance-settlement.md`)  
**Open PRs at final pre-write check:** none  
**Application code changed:** no  
**Production data mutated:** no

## Audit precondition and predecessor-report state

The assignment required Stage 5 to read all prior v2 stage reports. Repository state was changing while this audit ran.

At the final pre-write check, the following v2 reports existed on `main` and were read in full:

- `docs/audits-v2/02-commercial-chain.md`
- `docs/audits-v2/04-finance-settlement.md`

The following required predecessor reports did **not** exist on current `main` at the final pre-write check:

- `docs/audits-v2/01-baseline-architecture.md`
- `docs/audits-v2/03-execution-external-events.md`

This report does not invent their contents. The missing artifacts are a provenance/process limitation. To compensate, this Stage 5 audit re-read the current authorization, branch-policy, commercial, finance, machine-principal, GPT, archive, integration and route code directly. A commit comparison proved that application code had not changed after `61bd787`; the only changes between that application ref and the pre-write head were the Stage 2 and Stage 4 reports.

---

# Executive verdict

## Overall Stage 5 verdict: FAIL for cross-module least privilege

PR #128 materially improved KCPL's foundational trust model. The current code no longer relies on a browser role, browser branch, ordinary email allowlist or shared integration token as the primary server authorization source. `staff_profiles` is the human authority. Invalid/inactive staff profiles fail closed. Management's organization-wide scope does not make an invalid canonical branch valid. Dedicated EDI, tracking, pickup, automation and Maersk secrets are isolated. GPT is explicitly modeled as a separate organization-wide read-only machine principal. Normal finance settlement and shipment-detail mutation paths use strict branch checks.

The failures now sit one layer above those primitives, where separately reasonable modules compose into a stronger authority than intended.

The two highest-risk Stage 5 findings are:

1. **Accounts is a cross-module economic super-principal.** #128 gives Accounts both commercial-edit and finance-settlement capability. Combined with the Stage 2 pricing defects, an Accounts principal can supply policy thresholds/manual FX that make Management commercial approval disappear, then continue into the finance authority that #126 trusts.
2. **Several read-shaped paths are real mutation authorities.** A quote GET can create a shipment, rating GET updates Transport Order workflow state, Freight Audit GET refreshes/persists audit state, and finance dashboard reads can persist overdue status changes. The quote GET composes directly with Stage 2 `KCPL-V2-COM-004` and Stage 4 `KCPL-V2-FIN-001`: merely loading an already-Won stale TMS quote can finish creating the generic shipment that later falls outside booked-lineage Match-Pay.

Additional medium-risk gaps remain in branch authority consistency. Search/list/derived-state modules sometimes substitute a customer branch for a malformed shipment branch, accept handling-only scope, bypass relationship validation for all-branch users, or calculate finance totals from independently linked records that the canonical detail/settlement paths would reject.

Machine-principal isolation itself held. The remaining GPT concern is architectural: the GPT secret represents one Management-equivalent organization-wide reader, not the human user. If that private GPT is distributed to branch-scoped or non-Management staff, the API becomes an intentional cross-branch read oracle because the backend has no human identity to re-scope.

No P0 finding is assigned in this Stage. The P1 findings below have concrete integrity/privilege consequences; lower-severity findings require malformed/legacy data or an external distribution/configuration condition.

---

# Severity summary

| ID | Severity | Finding |
|---|---|---|
| `KCPL-V2-SEC-001` | **P1 / High** | Accounts can combine non-Management commercial-policy control with finance settlement authority, bypassing the intended Management economic gate |
| `KCPL-V2-SEC-002` | **P1 / High** | Read-shaped routes and loaders mutate commercial, shipment and finance state; quote GET can complete the stale-quote generic-shipment/Match-Pay bypass chain |
| `KCPL-V2-SEC-003` | **P2 / Medium** | Search/list modules weaken canonical shipment branch authority through customer fallback, handling-only scope and all-branch malformed-record visibility |
| `KCPL-V2-SEC-004` | **P2 / Medium** | Branchless website enquiries can be converted into canonical CRM/shipment branch ownership using caller-derived defaults, including hard-coded Kathmandu for all-branch staff |
| `KCPL-V2-SEC-005` | **P2 / Medium** | Finance dashboard and customer aggregate paths do not consistently enforce the same branch relationships as invoice detail/settlement, allowing malformed links to leak or contaminate derived state |
| `KCPL-V2-SEC-006` | **P3 / Low, deployment-dependent** | GPT is deliberately organization-wide and has no human branch identity; safe use depends on external Management-only distribution that the repository cannot enforce |

---

# Controls that held under attack

The following controls were specifically challenged and no supported-path bypass was found on the audited application ref:

- `staff_profiles` is the authoritative human staff record once the directory exists.
- Inactive profiles fail closed.
- Unsupported roles fail closed.
- Unsupported `branch_scope` values fail closed.
- `selected` scope without a non-empty canonical branch set fails closed.
- Management/all-branch access still requires a valid canonical target branch in the strict branch helpers.
- Bootstrap allowlisting is limited to the configured user while the staff directory is positively empty; it does not override an existing invalid/inactive profile.
- Legacy environment role helpers remain in code for compatibility/presentation, but no active data-bearing API authorization path found in this audit used them instead of `getStaffContext`.
- The admin search degraded fallback may expose legacy permission flags if staff-context resolution errors, but it returns an empty result set rather than data.
- Direct browser Firestore access remains denied by Firestore rules; the material trust boundaries are server/Admin SDK routes.
- Commercial/Operations cannot call finance mutation routes through a hidden server path found in this audit because finance routes recheck `canManageFinance`.
- Operations cannot select buy rates, reprice economics, queue EDI 204 tender dispatch or approve commercial pricing through the checked server APIs.
- Commercial cannot record AP/AR settlement or approve Freight Audit variance through the checked server APIs.
- Management cannot make malformed invoice/shipment branches valid through the canonical finance settlement or shipment access helpers.
- Dedicated machine secrets are not interchangeable in the machine-auth policy or regression matrix.
- Missing machine secrets fail closed with 503 rather than falling back to another integration credential.
- Tracking and pickup ingestion require a canonical target shipment and do not make a provider-supplied branch the canonical branch.
- Maersk webhook auth is distinct from generic tracking auth.
- Automation auth is distinct from tracking/pickup/EDI/GPT auth.
- GPT routes audited are GET-only and use centralized response sanitization.
- GPT sanitization strips secret/password/credential/auth fields, raw X12/EDI payload fields, storage paths and private/signed URL shapes.
- GPT EDI response exposes curated transaction metadata rather than raw X12.
- GPT freight-document response exposes metadata rather than private storage paths or signed download URLs.
- Paper archive access is Management-only and same-origin protected for upload.
- Archive organization scope is explicit only for `migration_batch`; customer/shipment/finance entity types remain branch-related and do not inherit organization scope merely because branch data is missing.

These controls should be preserved. The findings below are cross-module exceptions to this otherwise much stronger base.

---

# Human staff authority re-verification

## Authoritative source

Human access resolves through `getAdminAccess()` followed by `getStaffContext()` / `staffProfileByUid()`.

`app/admin/staff-authority-policy.ts` strictly validates:

- `active === true`
- role in `management | accounts | commercial | operations`
- scope in `all | selected`
- selected scope has at least one valid KCPL branch
- all branch values are canonical

Malformed persisted staff records are denied rather than normalized into a usable role/scope.

## Bootstrap behavior

Bootstrap authority requires both:

1. the identity is in the configured bootstrap allowlist, and
2. the staff directory is positively empty.

Once any directory record exists, bootstrap no longer becomes a parallel authority source. An invalid/inactive record for the same person is not rescued by the allowlist.

## Email / client role / browser branch attacks

No active data-bearing mutation path found here trusts:

- request-supplied role,
- browser-stored role,
- request-supplied branch as proof of access,
- an arbitrary query parameter branch without subsequent staff-scope validation.

The important exceptions are subtler and are covered below: some modules **derive** or **substitute** branch authority from another record or from the caller profile rather than requiring the target record's own canonical branch.

---

# Capability map against actual server APIs

| Role | Commercial view | Commercial edit | Rate cards | Customer edit | Job file / execution | Finance settlement | Staff | Important Stage 5 result |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Management | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Org-wide for valid branches; malformed target data still intended to fail closed |
| Accounts | Yes | Yes | No | Yes | Yes | Yes | No | **Cross-module risk:** commercial edit plus finance cash authority; see SEC-001 |
| Commercial | Yes | Yes | Yes | Yes | Yes | No | No | Cannot directly settle AR/AP through checked finance APIs |
| Operations | No | No | No | Yes | Yes | No | No | Cannot mutate rate/pricing/finance through checked APIs; can still act on org-wide unlinked enquiries through customer-edit capability |

Important route-level checks observed:

- staff management API: Management only; same-origin on writes;
- pricing API: commercial visibility at entry, same-origin on POST, server checks commercial mutation, Management-only approval;
- rating API: commercial visibility, same-origin on POST, server requires `canManageRateCards` for rate creation and `canEditCommercial` for rate selection;
- EDI staff API: job-file access to view, additional commercial edit required to dispatch 204;
- shipment mutation API: job-file capability plus canonical shipment branch check;
- AR/AP/payment APIs: `canManageFinance` plus branch/relationship checks;
- Freight Audit: Management/Accounts; variance approval requires Management;
- partner editing: Operations denied; other roles remain subject to owner-branch policy;
- archive: Management only.

No endpoint was found where the UI is the only barrier to a finance or commercial mutation. The principal capability defect is instead the **combination** granted to Accounts.

---

# Findings

## KCPL-V2-SEC-001 - P1 / High - Accounts can combine commercial-policy override with finance settlement authority

**Affected trust chain:**

Accounts role -> pricing policy / FX -> commercial version -> approval decision -> tender/booking -> AR/AP/Freight Audit/payment

**Primary code / prior findings:**

- `app/admin/staff-permissions.ts`
- `app/api/admin/pricing/route.ts`
- `app/admin/pricing/tms-pricing.server.ts`
- Stage 2 `KCPL-V2-COM-001`
- Stage 2 `KCPL-V2-COM-002`
- Stage 4 `KCPL-V2-FIN-013`

### Root cause

#128 defines Accounts with both:

- `canEditCommercial = true`
- `canManageFinance = true`

It also grants Accounts job-file/execution capability.

Stage 2 proved that `POST /api/admin/pricing` action `calculate` accepts request-supplied economic policy inputs including:

- `minimumMarginPercent`
- `approvalBelowMarginPercent`
- explicit `fxMode: "manual"`
- arbitrary positive `fxRate`

Those inputs are not Management-only. `calculateOrderPricing` can therefore create a version whose immutable snapshot says `approval_required = false` because the caller lowered the policy threshold or manipulated the conversion basis. The downstream exact-version approval machinery then behaves correctly: it does not demand Management approval for a version that says approval is unnecessary.

Stage 4 separately established that the same Accounts role can create, approve and settle ordinary AP, and can operate AR/collections.

### Concrete privilege chain

A compromised or malicious Accounts principal can:

1. select/use an existing permitted procurement basis;
2. calculate a new commercial version with lowered approval thresholds and/or arbitrary manual FX;
3. produce a fingerprint-valid version whose own policy state says Management approval is not required;
4. progress that version through the commercial/execution chain available to the role;
5. later exercise Accounts finance authority over AR/AP/settlement derived from the resulting operational records.

For a genuine TMS AP, #126/#129 payment-time checks do not rescue this because they correctly trust the booked commercial version. The problem is that the same principal was allowed to manufacture the economic authority that the settlement transaction later attests.

### Impact

This defeats the intended separation between Management economic approval and Accounts settlement. It can turn one Accounts credential into a principal capable of both shaping the trusted economics and executing financial settlement against them.

This is more than the maker-checker design concern in Stage 4. The combined remediations let the role alter the upstream criterion that decides whether the Management gate exists at all.

### Severity basis

P1/High because the path is reachable with a normal Accounts identity and has concrete economic-integrity and settlement-authority consequences. No software exploit outside the application is required.

### Remediation direction

Server-own margin/approval policy thresholds. Treat exceptional manual FX/policy override as a separate privileged decision with explicit authority and immutable provenance. Revisit the Accounts capability bundle so finance settlement does not automatically imply authority to create/alter the commercial decision that settlement later trusts.

---

## KCPL-V2-SEC-002 - P1 / High - Read-shaped paths are mutation authorities across quote, rating and finance

**Affected trust chain:**

GET/read/navigation -> hidden server write -> commercial/shipment/audit state -> downstream execution/finance

**Primary code:**

- `app/api/admin/quotes/[reference]/route.ts`
- `app/admin/admin-data.server.ts` -> `getQuoteDetail`
- `app/shipment-data.server.ts` -> `ensureShipmentForWonQuote`
- `app/api/admin/rating/route.ts`
- `app/admin/rating/tms-rating.server.ts` -> `rateTmsOrder`
- `app/api/admin/freight-audit/route.ts`
- `app/admin/freight-audit/freight-audit.server.ts`
- `app/admin/finance/finance.server.ts` -> `listFinanceDashboard`
- Stage 2 `KCPL-V2-COM-004`
- Stage 4 `KCPL-V2-FIN-001`
- Stage 4 `KCPL-V2-FIN-008`

### Mutation 1: quote detail GET can create a shipment

`GET /api/admin/quotes/[reference]` calls `loadAccessibleQuote()`, which calls `getQuoteDetail()`.

`getQuoteDetail()` performs:

1. load quote;
2. load shipment for quote;
3. if no shipment exists and quote is `won` with a customer, call `ensureShipmentForWonQuote()`;
4. `ensureShipmentForWonQuote()` transactionally creates the shipment, seeds operational workflow artifacts, updates the quote's `shipment_reference`, increments customer counters and writes customer activity.

Therefore a read/navigation request is an operational shipment-creation authority.

This composes with Stage 2 and Stage 4. Stage 2 proved that a stale TMS quote can enter the generic Won path and create a parallel non-lineaged shipment. Stage 4 proved that this generic shipment can be classified non-TMS and receive `not_applicable` Freight Audit treatment, bypassing booked-lineage Match-Pay. The GET path means that, once the stale quote is Won, simply loading it can complete that high-impact state creation.

### Mutation 2: rating GET writes Transport Order workflow state

`GET /api/admin/rating?order=...` invokes `rateTmsOrder()`.

After calculating results, `rateTmsOrder()` writes the order:

- `status = rated` unless already selected;
- `updated_at = now`.

The route's POST mutations have `isTrustedSameOriginRequest()` protection. This GET mutation has no write-specific same-origin gate because it is implemented as a read route.

### Mutation 3: Freight Audit GET persists audit state

`GET /api/admin/freight-audit?reference=...` calls `getFreightAudit(reference, staff, true)`.

The `refresh=true` path recomputes and persists the audit/fingerprint/state. This is a finance-control write performed by GET.

Stage 4 `KCPL-V2-FIN-008` already found that Management variance approval is not atomically bound to the exact approved fingerprint. A refresh is one of the writers that can change the audit state around that approval race.

### Mutation 4: finance dashboard reads persist invoice status changes

`listFinanceDashboard()` computes effective overdue/paid presentation status and batches writes when stored status differs. A dashboard read can therefore update invoice status/`updated_at`.

### Security significance

SameSite Strict session cookies reduce classic cross-site CSRF reachability, so this finding does **not** claim any arbitrary off-site GET can mutate authenticated state. The defect is the internal trust model: navigation, prefetch, monitoring, links, API clients and future caches/proxies can no longer treat GET/read paths as side-effect free.

Mutation policy is split by HTTP shape rather than actual side effect. Explicit POST/PATCH routes receive same-origin protections that their hidden GET writes bypass.

### Severity basis

P1/High because the quote GET has a concrete cross-module integrity consequence already proven to reach the Stage 4 Match-Pay bypass chain. The rating/audit/dashboard writers broaden the same architectural failure.

### Remediation direction

Make GET/read functions side-effect free. Move shipment initialization, rating-state transitions, audit refresh persistence and finance status persistence behind explicit mutation commands with the same capability, relationship and same-origin protections as other writes. Read-time repair may return `needs_repair` / computed status without committing it.

---

## KCPL-V2-SEC-003 - P2 / Medium - Search/list modules weaken canonical shipment branch authority

**Affected trust chain:**

Malformed/partial shipment -> search/list fallback -> cross-branch visibility despite canonical detail denial

**Primary code:**

- `app/admin/branch-access-policy.ts`
- `app/admin/shipment-access-policy.ts`
- `app/admin/shipment-access.server.ts`
- `app/api/admin/search/route.ts`
- `app/api/admin/operations-search/route.ts`
- `app/admin/admin-data.server.ts` -> `listQuoteSummaries`

### Canonical policy

`resolveShipmentBranchAccess()` requires a valid canonical `primary_branch`. If it is missing or malformed, the shipment is forbidden, including for Management. This is the correct #128 fail-closed rule.

### Weaker search policy

The general admin search derives shipment primary branch as:

`strictBranchValue(shipment.primary_branch) ?? strictBranchValue(customer.primary_branch)`

It then calls `canAccessBranchSet()`.

A shipment whose own `primary_branch` is invalid can therefore become visible in search based on the linked customer branch. Search returns operational metadata such as route, status, carrier/reference, current location and job identifiers even though `checkShipmentBranchAccess()` would reject the same shipment.

`operations-search` also calls the generic branch-set helper directly for some shipment discovery. `canAccessBranchSet()` accepts a set with a valid handling branch even if the primary branch is invalid, whereas canonical shipment access requires a valid primary branch first.

### Quote list variant

`listQuoteSummaries()` has two additional inconsistencies:

- for all-branch contexts, it returns every visible quote without validating broken shipment/customer relationships first;
- for scoped users, the linked-shipment calculation can again substitute customer branch when shipment primary branch is invalid.

`checkQuoteBranchAccess()` also deliberately allows all-branch staff to read a quote whose linked shipment/customer is missing (`shipment_missing` / `customer_missing`). This makes Management a repair reader for broken links even though the stated #128 malformed-record principle is otherwise fail closed.

### Impact

A malformed or partially migrated shipment can leak operational metadata through discovery/search surfaces to a branch that would be denied canonical shipment detail. Management can also see broken linked quotes through special all-branch fallbacks rather than a dedicated repair surface.

This is a read exposure, not a proven cross-branch mutation of the malformed shipment itself. Hence Medium rather than P1.

### Remediation direction

Use one canonical shipment relationship/branch resolver for every human-facing read and write. If repair visibility is required, expose it through a dedicated Management maintenance capability and clearly label it as malformed-data repair rather than silently substituting another record's branch.

---

## KCPL-V2-SEC-004 - P2 / Medium - Branchless website enquiries acquire canonical branch ownership from caller defaults

**Affected trust chain:**

Public enquiry -> unlinked global visibility -> create CRM customer -> caller-derived branch -> Won -> shipment branch

**Primary code:**

- `app/api/quotes/route.ts`
- `app/admin/quote-access.server.ts`
- `app/api/admin/quotes/[reference]/route.ts`
- `app/admin/crm/crm-quote-links.server.ts`
- `app/shipment-data.server.ts`

### Normal intake state

The public website quote endpoint intentionally creates an enquiry with:

- no `shipment_reference`;
- no `customer_id`;
- no canonical branch.

`checkQuoteBranchAccess()` treats such an unlinked enquiry as visible to every authenticated staff profile.

### Branch assignment

The quote action `create_customer` requires `canEditCustomer`. All four current roles have that capability.

The route chooses branch authority internally as:

- all-branch staff: hard-coded `Kathmandu`;
- scoped staff: `staff.branches[0]`.

It then creates/links the CRM customer using that branch.

If a commercial-capable user later marks the quote Won, the generic shipment creator carries the customer branch into `shipments.primary_branch` and `handling_branches`.

### Why this is a trust-boundary defect

The caller cannot spoof an arbitrary branch in the request, which is good. The problem is that the system turns an **absence of branch authority** into a canonical branch by defaulting from the caller profile. An org-wide unassigned lead can be claimed into a branch without an explicit assignment/triage decision. For Management/all-branch staff, Kathmandu is fabricated regardless of the enquiry origin, destination, account manager or an explicit business rule.

This is particularly inconsistent with #128's broader rule that missing/malformed authoritative branch data should not silently become Kathmandu.

### Impact

This can misroute customer ownership and later shipment/job scope. It also allows Operations, which has no commercial-view capability, to perform the customer-creation branch claim on an unlinked enquiry because customer-edit permission is sufficient.

No prior branch is being bypassed because the intake record is genuinely unassigned, so this is Medium rather than P1. The problem is implicit authority creation, not theft of an already canonical branch.

### Remediation direction

Represent new enquiries as explicitly `unassigned` at organization scope, then require an explicit assignment action that chooses a valid branch under a documented capability. Record assignment actor/reason/time. Do not infer canonical ownership from `branches[0]`, and do not hard-code Kathmandu for all-branch principals.

---

## KCPL-V2-SEC-005 - P2 / Medium - Finance read/aggregate paths accept relationships that canonical invoice access rejects

**Affected trust chain:**

Malformed invoice/customer/shipment relation -> dashboard/aggregate -> visibility or customer financial state -> detail/settlement later rejects

**Primary code:**

- `app/admin/finance/finance.server.ts`
  - `getFinanceInvoice`
  - `listFinanceDashboard`
  - `recomputeCustomerFinance`
- `app/admin/crm/crm-customer-finance.server.ts`
- #126 settlement paths for contrast

### Canonical finance detail is strict

`getFinanceInvoice()` requires:

- valid invoice branch;
- staff access to that branch;
- existing customer;
- invoice branch compatible with customer branch;
- linked shipment branch compatible with invoice branch;
- shipment customer identity compatible with invoice customer.

AR collection and AP settlement add similarly strict transaction-time relationship checks. These controls held.

### Dashboard is weaker

`listFinanceDashboard()` filters each invoice only by the invoice's raw branch access, then materializes the invoice without revalidating the linked customer/shipment relationship. It can therefore display a branch-local invoice whose linked customer/shipment would make `getFinanceInvoice()` return `relationship_mismatch`.

The same dashboard read can also persist effective status changes, compounding SEC-002.

### Customer aggregate is weaker

`recomputeCustomerFinance(customerId)` has no staff context and aggregates all invoice documents with that `customer_id` plus all shipments with that `customer_id`. It does not require those records' branches to match the customer's canonical branch before writing customer totals.

The CRM finance snapshot improves per-record staff visibility filtering, but it still asks whether the viewer can see each invoice/shipment branch rather than proving that the invoice/shipment branch is relationship-compatible with the customer being summarized.

### Impact

Malformed, legacy or partially migrated cross-branch links can:

- appear in a branch finance dashboard even though detailed access/settlement correctly rejects them;
- contaminate stored customer revenue/cost/outstanding/profit projections across branch relationships;
- create differing truths between dashboard, customer aggregate and canonical settlement/detail APIs.

The hardened current create/payment paths reduce ordinary creation of this malformed state, so exploitation generally requires legacy/corrupt/migration data. Severity is therefore Medium.

### Remediation direction

Make relationship validity part of every finance read-model inclusion rule. Invalid relationships should be quarantined into an integrity/reconciliation queue and excluded from ordinary dashboard/customer totals rather than being accepted by one module and rejected by another.

---

## KCPL-V2-SEC-006 - P3 / Low, deployment-dependent - GPT organization-wide principal has no human branch identity

**Affected trust chain:**

Human uses private GPT -> GPT holds one machine secret -> organization-wide search/read -> branch-scoped human receives data

**Primary code:**

- `app/gpt-action-auth.server.ts`
- `app/api/gpt/search/route.ts`
- other `/api/gpt/*` routes

### Intended design is explicit

The code explicitly defines the GPT principal as:

- `kcpl-internal-management-intelligence`
- organization-wide scope
- Management-read-only equivalent
- not the human staff member asking the question

This is a coherent machine-principal model. GPT is **intentionally broader than human branch scope**.

### Data reach

`/api/gpt/search` reads recent shipments, customers and quotes across the organization without human branch filtering. Curated output includes customer contact email/phone, quote contact email/phone, route/status and shipment metadata.

The API has no Firebase human session/UID to determine who is using the GPT. Anyone who can invoke the configured private GPT receives the same Management-equivalent backend scope.

### Safety controls that held

- GET-only GPT route model in the audited tree;
- dedicated long secret;
- no fallback to EDI/tracking/pickup/automation keys;
- centralized recursive sanitizer;
- no raw X12/private storage path/signed URL exposure found;
- response header `x-kcpl-machine-scope: management-read-only` explicitly identifies machine scope.

### Residual gap

The authorization boundary therefore moves outside this repository to the Custom GPT's distribution/sharing policy. If that GPT is available to branch-scoped or non-Management staff, it becomes a cross-branch PII/operations oracle by design. The API cannot re-scope to the human.

The machine-scope header is useful for technical clients, but normal response bodies such as `/api/gpt/search` do not themselves explain to a downstream human that results are organization-wide Management intelligence rather than their personal staff scope.

### Severity basis

Low/deployment-dependent because repository code explicitly documents the intended Management-only scope and no evidence in this repository proves the GPT is shared more broadly. If external distribution includes non-Management staff, the impact becomes a concrete Medium cross-branch disclosure.

### Remediation direction

Either enforce Management-only GPT distribution outside the application and verify it operationally, or propagate a real KCPL human identity/authorization assertion into the GPT action so the server can apply normal staff branch scope. Keep the machine principal distinct from human identity either way.

---

# Branch attack conclusions by domain

| Domain | Result |
|---|---|
| Customer | Normal CRM mutation uses staff capability and canonical customer branch; unlinked enquiry conversion invents branch from caller defaults, SEC-004 |
| Quote | Linked branch checks exist, but unlinked quotes are global and all-branch missing-link repair fallbacks exist; list/search can be weaker than detail |
| Transport Order | Canonical order branch is used for staff access; Stage 2 `COM-005` still proves an all/multi-branch user can select a rate card owned by another branch because card branch is checked against staff, not against order |
| Rate selection | No Operations bypass found; cross-branch rate-card compatibility remains the inherited Stage 2 defect |
| Tender | Normal create/respond/book transactions recheck branch/version relationships; no new Stage 5 bypass found |
| Shipment | Canonical detail/mutation requires valid `primary_branch`; search/index can substitute/fallback, SEC-003 |
| Pickup | Dedicated machine principal; canonical target shipment branch; no provider branch authority found |
| Documents | Human shipment access guards the checked job/document paths; GPT returns metadata only |
| Tracking | Dedicated machine principal and target shipment authority; no cross-secret fallback found |
| Customs | Shipment/job-file authorization remains the enclosing human scope in checked paths |
| Delivery | External observations do not directly gain finance authority; #130 canonical acceptance separation held in checked code |
| Supplier | Partner owner policy distinguishes Global from branch-owned; finance creation/settlement rechecks supplier/record scope |
| AP | Active create/payment paths strict; inherited obligation-level double-pay defects are Stage 4, not a branch bypass |
| AR | Active collection strict; invoice business-event/economic-lineage defects remain Stage 4, not a new branch bypass |
| Freight Audit | Active target relationship checks strict, but GET refresh is a write and participates in state-race surface, SEC-002 |
| Archive | Only `migration_batch` receives organization relationship scope; no customer/shipment/finance inheritance found |

## Management and malformed data

Management's all-branch human context does **not** make arbitrary malformed branch strings canonical in the strict helpers. That defense held in settlement/shipment-detail paths.

However, special read surfaces do soften the policy:

- all-branch quote list skips relationship branch validation;
- quote detail policy explicitly permits missing linked shipment/customer for all-branch staff;
- search can derive shipment branch from customer.

If Management repair access is intended, it should be an explicit maintenance capability. It should not make ordinary search/list semantics differ from canonical access semantics.

---

# Direct API attack conclusions

## Missing authentication

No unintentional unauthenticated mutation route was found in the checked admin/integration surface.

The public quote submission route is intentionally unauthenticated/public but same-origin constrained, schema-limited and creates only the expected unlinked enquiry state.

## Missing capability

No direct Operations-to-pricing or Commercial-to-finance mutation endpoint was found.

The important authorization problem is role composition, SEC-001, not a missing `if` on one finance endpoint.

## GET with mutation side effects

**Confirmed.** See SEC-002.

## Same-origin protection

Explicit admin POST/PATCH mutation routes generally call `isTrustedSameOriginRequest()`. The weakness is that hidden mutations implemented inside GET/read functions do not pass through this mutation gate.

## Request-supplied role/branch

No checked route trusted request-supplied role as authority.

Request-supplied branch fields are validated against staff scope in ordinary create/update paths. The concerning branch behaviors are server-side derivation/fallback rather than client spoofing.

## Weak relationship validation

Confirmed in read/aggregate/search surfaces, SEC-003 and SEC-005. Active finance settlement and canonical shipment mutation are stronger.

---

# Machine-principal isolation matrix

| Principal | Credential | Intended authority | Cross-auth result |
|---|---|---|---|
| GPT | `KCPL_GPT_ACTION_SECRET` | Org-wide Management-equivalent read-only intelligence | Dedicated; not accepted as EDI/tracking/pickup/automation/Maersk in checked policy/tests |
| EDI | `KCPL_EDI_SECRET` | EDI gateway / permitted EDI event paths | Dedicated bearer or `x-edi-key`; no fallback to other machine keys |
| Tracking | `KCPL_TRACKING_INGEST_SECRET` | Tracking observation ingestion | Dedicated bearer; absent secret fails closed |
| Pickup | `KCPL_PICKUP_INTEGRATION_SECRET` | Pickup integration mutations | Dedicated bearer; absent secret fails closed |
| Automation | `KCPL_AUTOMATION_SECRET` | Scheduled alerts/freight/payables automation and notifications | Dedicated bearer; no tracking/EDI fallback |
| Maersk | `MAERSK_WEBHOOK_SECRET` | Maersk webhook/DCSA ingestion | Dedicated bearer; distinct from generic tracking principal |

### Cross-auth attacks

The #128 regression matrix explicitly tests each configured secret against the other machine authorizers. No shared-secret fallback remains in `machine-auth-policy.ts`.

No path was found where:

- EDI secret authenticates tracking;
- tracking secret authenticates pickup;
- pickup secret authenticates automation;
- automation secret authenticates tracking;
- GPT secret authenticates a mutation route;
- Maersk secret authenticates generic tracking/EDI.

### Domain confinement

Tracking/pickup/Maersk integrations resolve target shipments and use canonical workflow/integration logic rather than accepting provider branch as KCPL branch authority. Automation is intentionally organization-level but is not accepted by other integration routes.

No new machine-principal confusion finding is raised beyond the GPT human-scope caveat in SEC-006.

---

# GPT audit conclusion

## GET-only

Held on the audited `/api/gpt` tree. No GPT mutation method found.

## Read-only

Held at the API method level. GPT routes read Admin SDK data and return sanitized summaries.

## Sanitization

Central `sanitizeGptResponse()` strips secret/auth/token-related keys, raw EDI/X12 payload keys and storage/private URL keys recursively. Signed/private URL string patterns are redacted defensively.

## Raw EDI

No raw X12 returned from the audited GPT EDI route.

## Private storage / signed URLs

No private storage path or signed download URL exposure found in the audited freight-document route. The central sanitizer is additional defense.

## Scope

Intentionally organization-wide Management-equivalent machine scope, not human branch scope. This is clear in source and a machine-scope response header, but the ordinary JSON result does not always surface the distinction to a human user. See SEC-006.

---

# Commercial privilege attacks

## Can Operations directly mutate rate, pricing, approval, quote economics or commercial version through a hidden route?

No supported path found in the checked APIs.

- Operations fails `canViewCommercial` at rating/pricing APIs.
- Rate selection independently requires `canEditCommercial` in the server helper.
- Pricing approval requires Management.
- Versioned quote economic editing is additionally locked by #129 policy.

Operations does retain customer-edit and job-file capabilities, which is why it can participate in the unlinked-enquiry branch-claim step in SEC-004.

## Can Commercial perform finance settlement?

No checked AR/AP/payment/Freight Audit mutation path allows Commercial. `canManageFinance` is required server-side.

## Can Accounts bypass commercial approval?

**Yes.** This is the central SEC-001 composition. Accounts can edit commercial economics, and Stage 2 proved the request can alter the policy/FX inputs that decide whether approval is required.

## Can Management bypass malformed-data safeguards?

Not through canonical shipment/finance mutation helpers. Management still needs valid canonical branch data.

Read/search repair-style exceptions exist, SEC-003, but they do not by themselves prove Management can settle a malformed finance record.

---

# Finance authorization attack conclusions

## Cross-branch supplier payment

Blocked on the active #126 path by bill, supplier, shipment/order and branch rechecks.

## Wrong customer collection

Blocked transactionally when invoice/customer/shipment relationship disagrees.

## Wrong shipment Freight Audit

Canonical audit/payment checks relationship branches. The separate critical Stage 4 failure is economic obligation identity and the generic non-TMS shipment bypass, not a simple branch spoof.

## Malformed branch bill/invoice

Canonical detail/settlement fails closed. Dashboard/aggregate behavior is weaker, SEC-005.

## Accounts/Management settlement authority

Both roles can finance-settle. Stage 4 already recorded the lack of independent maker-checker. Stage 5 elevates only the new cross-module composition where Accounts can also shape the commercial approval decision, SEC-001.

---

# Archive / migration scope conclusion

`archiveRelationshipScope()` is explicit:

- `migration_batch` -> organization scope;
- branch-linked entity types -> branch relationship scope;
- `general` -> no linked-record relationship requirement.

`archiveLinkedRecordAllowed()` still requires the canonical linked record to exist. Missing/malformed branch does not promote a customer/shipment/finance entity to organization scope.

No path was found where customer, shipment, AP, AR or Freight Audit records accidentally inherit the `migration_batch` organization-scoped exception.

This special-case hardening held.

---

# Configuration / deployment trust

## Repository-declared secret bindings

`apphosting.yaml` explicitly binds only:

- `KCPL_GPT_ACTION_SECRET`

The application code also references security-critical machine credentials including:

- `KCPL_EDI_SECRET`
- `KCPL_TRACKING_INGEST_SECRET`
- `KCPL_PICKUP_INTEGRATION_SECRET`
- `KCPL_AUTOMATION_SECRET`
- `MAERSK_WEBHOOK_SECRET`

`.env.example` documents these machine integrations, but the checked-in App Hosting YAML does not bind them.

## Security interpretation

This is **not** evidence of an authentication bypass. `machine-auth-policy.ts` fails closed when these secrets are absent, returning 503. An integration intentionally unavailable until configured is not a vulnerability.

Firebase App Hosting secrets may also be provisioned through backend/environment configuration outside this repository, so the repository alone cannot prove production absence.

**Deployment verification required:** confirm each enabled production integration has its dedicated secret bound through the actual App Hosting backend/Secret Manager configuration. Do not add a fallback/shared secret to make an unconfigured integration work.

## Secret strength

GPT enforces a minimum configured secret length of 32 characters. The generic machine-auth helper checks non-empty secrets but does not itself enforce equivalent minimum entropy/length for EDI/tracking/pickup/automation/Maersk. `.env.example` guidance should remain strong and deployment secret generation should be verified. This is hardening, not promoted to a current exploit finding because actual deployed secret values are not visible here.

---

# Cross-module privilege chains

## Accounts -> pricing override -> no Management approval -> booked lineage -> finance settlement

**Result: exploitable by design combination.** SEC-001.

This is the clearest answer to the Stage 5 question of whether #126-#130 introduced a combined privilege problem. #129 made the booked version a strong authority and #126 made settlement strongly attest it, but #128 gives Accounts the capability to influence creation of that authority. Strong downstream attestation cannot compensate for weak upstream authorization of the decision itself.

## Stale quote -> GET -> generic shipment -> Freight Audit `not_applicable` -> payment

**Result: concrete inherited critical chain, now with a read-side trigger.**

- Stage 2 `COM-004`: stale TMS quote can create parallel generic shipment.
- Stage 4 `FIN-001`: generic shipment can evade booked-lineage Match-Pay classification.
- Stage 5 `SEC-002`: quote detail GET can itself initialize the missing shipment.

This Stage does not duplicate the earlier critical finding ID, but the GET authority increases its reach and shows a direct API trust-boundary failure.

## Customer edit -> quote relationship -> order/shipment branch

Normal existing customer/linked-shipment mutations use canonical branch checks. The unsafe variant is the branchless enquiry claiming flow in SEC-004.

## Partner edit -> tender -> EDI dispatch

Partner edits are branch/Global policy constrained. EDI 204 staff dispatch additionally requires commercial edit and queue logic revalidates tender/order/partner compatibility. No new privilege bypass found.

Stage 2 `COM-005` remains important upstream: a multi/all-branch user can select a branch-specific rate card for the wrong order branch because rate-card branch is checked against the **staff member** rather than the **order**. Stage 5 did not duplicate that finding, but it remains an unresolved branch-authority defect that downstream lineage faithfully preserves.

## Shipment edit -> Freight Audit -> payment

Operational shipment edits do not grant finance capability. Payment rechecks current finance/shipment/order lineage. The dangerous alternate path is generic shipment provenance loss, inherited `COM-004` + `FIN-001`.

## Tracking event -> shipment state -> finance

#130's external observation/canonical acceptance split prevents provider observations from directly becoming finance paid/closed state. No tracking-secret-to-finance mutation path found.

## Archive link -> cross-branch visibility

No organization-scope inheritance beyond genuine `migration_batch` found.

## GPT search -> sensitive data leakage

Machine scope is intentionally organization-wide and includes contact PII. If GPT audience is broader than Management, SEC-006 applies.

---

# Regression/test adequacy

The #128 regression tests are useful and specifically cover many dangerous defaults and cross-secret attempts, but the Stage 5 defects live in module composition.

High-value missing adversarial scenarios include:

1. Accounts user sets `minimumMarginPercent=0` / `approvalBelowMarginPercent=0`, creates a no-approval commercial version, progresses it, then exercises AP/AR finance authority;
2. Accounts user supplies extreme manual FX and confirms Management approval is not forced by the server-owned policy;
3. GET a Won TMS-linked quote with no shipment and assert **no writes** occur;
4. GET rating and assert Transport Order status/`updated_at` do not change;
5. GET Freight Audit and assert audit document is not persisted/refreshed;
6. load finance dashboard and assert no status writes occur from a read;
7. malformed shipment primary branch + valid customer branch: search must deny exactly as shipment detail does;
8. malformed shipment primary branch + valid handling branch: operations search must deny;
9. all-branch Management + quote linked to missing shipment/customer: ordinary quote list/detail should fail closed or route explicitly to repair mode;
10. unlinked public enquiry + Operations user: verify branch assignment requires an explicit authorized triage action rather than implicit first-branch/default behavior;
11. branch-A invoice linked to branch-B customer: dashboard and aggregate must quarantine it exactly as invoice detail/settlement do;
12. GPT test with a simulated branch-scoped human identity should demonstrate that the chosen product policy is either Management-only external distribution or explicit human-scope propagation;
13. every enabled machine integration tested against every other principal's credential and against missing configuration in deployed-equivalent config.

Source-shape tests should be supplemented by end-to-end authorization/state tests that compare **the same malformed record** across search, detail, mutation and aggregate APIs.

---

# Final Stage 5 answers

## Is `staff_profiles` authoritative?

**Yes for current human server authorization.** Bootstrap is narrow and malformed/inactive profiles fail closed.

## Does Management remain org-wide without turning malformed records into valid scope?

**Yes on canonical mutation/detail helpers.** No on every ordinary read surface: quote/search special fallbacks can expose broken records to all-branch staff. SEC-003.

## Are there UI-only permission barriers with unprotected server mutations?

No simple Operations-to-finance or Commercial-to-finance hidden route was found. The more serious issue is that some server **GET/read** paths mutate state, SEC-002.

## Can Operations mutate commercial economics?

No checked pricing/rating/tender-economic route permits it. Operations can edit customers/job files and therefore can participate in unlinked-enquiry branch claiming, SEC-004.

## Can Commercial perform financial settlement?

No checked settlement route permits it.

## Can Accounts bypass commercial approval?

**Yes, through the Stage 2 client-controlled approval-threshold/manual-FX defects combined with Accounts' `canEditCommercial` capability.** SEC-001.

## Are branch relationships uniformly authoritative?

**No.** Canonical settlement/detail paths are much stricter than search/list/aggregate paths. SEC-003 and SEC-005.

## Are machine principals isolated?

**Yes in the audited code.** Dedicated secrets and no cross-secret fallback were verified.

## Can GPT mutate KCPL?

No GPT write route found. GPT is GET-only/read-only in the audited tree.

## Is GPT broader than human branch scope?

**Yes, intentionally.** It is one organization-wide Management-equivalent machine reader. Safe use therefore depends on Management-only distribution or future human identity propagation. SEC-006.

## Can provider branch become canonical branch?

No checked EDI/tracking/pickup/Maersk path was found that promotes a provider-supplied branch into KCPL canonical branch authority.

## Is archive organization scope contained?

Yes. `migration_batch` is the only explicit organization relationship scope found.

## Are security-critical machine secrets fully declared in `apphosting.yaml`?

No. Only GPT is present in the checked YAML. The other integrations fail closed if absent, so this is a deployment verification gap, not an authentication bypass.

---

# Stage 5 conclusion

#128 successfully repaired the obvious trust-boundary failures: human roles/branches now come from authoritative staff profiles, malformed staff data fails closed, Management scope is explicit, machine credentials are separated, and canonical finance/shipment mutations generally validate branch relationships.

The remaining security problem is **authority composition**.

KCPL still has modules that can:

- give one Accounts principal both economic-decision and cash-settlement power;
- mutate important state from read-shaped paths;
- derive branch visibility from a neighboring record when the canonical target is malformed;
- manufacture branch ownership for unassigned enquiries from caller defaults;
- compute finance read models from relationships that settlement itself rejects;
- expose organization-wide GPT intelligence without any human scope inside the API.

The system therefore does not yet enforce one uniform trust boundary across Commercial, Execution, Finance and Intelligence.

**Stage 5 verdict: FAIL pending remediation of SEC-001 and SEC-002, followed by unification of branch/relationship authority across search, quote intake and finance read models.**