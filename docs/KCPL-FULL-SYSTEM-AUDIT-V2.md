# KCPL Full System Audit v2

**Audit type:** post-remediation hostile full-system audit  
**Repository:** `dirgh8yu/kcpl`  
**Audit date:** 2026-08-23  
**Audited pre-report `main` SHA:** `11e88e2e6fc0ac76bb902d6e2a0802c2c6de435c`  
**Executable application ref:** `61bd787fdf1d76819ca6547e74383a0e751592a6`  
**Open PRs at final pre-write check:** none  
**Application code changed by this audit:** no  
**Production data mutated:** no

> `main` at `11e88e2` is five documentation commits ahead of `61bd787`. A direct commit comparison shows that the delta contains only the five `docs/audits-v2/*` stage reports. Therefore the executable application code audited here is exactly the post-#130 code at `61bd787`; the final report commit itself is documentation-only.

---

# 1. Executive summary

## Production-readiness verdict: **A. NOT READY**

KCPL is materially safer than it was before remediations #126 through #130. The remediation campaign fixed several of the most dangerous original primitives:

- stale commercial V1 approval no longer transfers to V2;
- canonical TMS booking is transactionally exactly-once for the same authoritative tender/order;
- consolidation membership and booked graph creation are transactionally serialized on the live lineage-aware route;
- persisted `staff_profiles` is now the human authorization authority after bootstrap;
- dedicated machine secrets are not interchangeable;
- external provider observations no longer directly own canonical shipment state;
- provider Delivered is blocked by current Customs/POD/delivery/exception gates;
- ambiguous external target identifiers quarantine rather than mutating the first match;
- booked TMS Freight Audit and Match-Pay use immutable booked commercial lineage rather than today's rate card or today's FX.

Those are real improvements. They are not sufficient for production.

This lead review retains **32 distinct post-remediation findings** after deduplication and severity challenge:

| Severity | Count | Release meaning |
|---|---:|---|
| P0 | 0 | No supported systemic takeover, catastrophic data loss, or proven arbitrary bank-disbursement primitive was found. |
| P1 | 13 | Production blockers remain. They can create financially incorrect transactions, parallel operational truth, unauthorized economic authority, duplicate settlement, or unusable critical workflows. |
| P2 | 17 | Important reliability, legacy, concurrency, branch-consistency, data-quality, and deployment-control defects remain. |
| P3 | 2 | Defense-in-depth or deployment-dependent issues. |
| **Total** | **32** | Deduplicated master findings, not a sum of stage-report counts. |

The central post-remediation weakness is **authority composition**. Individual modules are often locally correct, but the system still has alternate paths that do not consume the same authority:

1. a stale versioned TMS quote can still become Won through the generic quote workflow and mint a non-TMS generic shipment;
2. commercial policy thresholds and manual FX remain caller-controlled inputs to a version that downstream modules correctly trust;
3. booking can use an exact tender/commercial V2 without requiring that the customer was issued the exact V2 quote;
4. manual Delivery Control can write canonical Delivered without the gates that the external-event engine correctly enforces;
5. financial settlement is still bill-local rather than procurement-obligation-local;
6. consolidation creates both full master procurement and allocated house procurement records that finance can treat as independent payables;
7. AR invoice creation is not business-event idempotent and is not bound to booked sell lineage;
8. Freight Audit variance approval is not compare-and-set bound to the exact audit state reviewed.

No evidence supports a P0 classification. The presence of thirteen P1 application defects nevertheless makes a production pilot unsafe. KCPL should not process live customer billing, supplier settlement, live consolidated booking, or general operational delivery completion through this build until the P1 backlog is remediated and regression-tested.

---

# 2. Audited main SHA

## Repository state

Final pre-write verification returned:

- `main`: `11e88e2e6fc0ac76bb902d6e2a0802c2c6de435c`
- open PRs: **0**
- `main` branch protection: **disabled**
- required status checks on `main`: **off**

The application-code baseline is `61bd787fdf1d76819ca6547e74383a0e751592a6`, the merge commit for #130. Comparing `61bd787` to `11e88e2` shows only these documentation additions:

- `docs/audits-v2/01-baseline-architecture.md`
- `docs/audits-v2/02-commercial-chain.md`
- `docs/audits-v2/03-execution-external-events.md`
- `docs/audits-v2/04-finance-settlement.md`
- `docs/audits-v2/05-rbac-cross-module.md`

No executable source changed after #130 and before this audit report.

## Remediation merge sequence

| PR | Merge commit | Purpose |
|---|---|---|
| #126 | `5b6cbf82d79cf555f44bbea34082fb417902a051` | Financial settlement integrity |
| #127 | `74e4c2881bab90a4d5075e7c9ea013a03dc817a3` | Tender / booking / consolidation concurrency |
| #128 | `f95d57fad3f41b6ca8da08289bb88cd5040c74a0` | RBAC / trust boundaries |
| #129 | `c29c0bf4e58d543f124013477a170b02ec086806` | Commercial economic lineage |
| #130 | `61bd787fdf1d76819ca6547e74383a0e751592a6` | External event workflow authority |

The remediation PR descriptions and their exact-head CI results were reviewed, but PR claims were not accepted as proof. Important claims were independently rechecked in current source.

---

# 3. Scope

The audited end-to-end chain was:

**Enquiry -> Customer -> Transport Order -> Rate -> Commercial version -> Pricing -> Approval -> Quote -> Tender -> EDI -> Carrier response -> Booking -> Pickup -> Job File -> Tracking -> Customs -> Delivery/POD -> Supplier invoice -> Freight Audit -> Match-Pay -> Profitability**

The review also covered the cross-cutting authority layers that can invalidate that chain:

- staff identity and role authority;
- branch ownership and relationship compatibility;
- machine principals and secret separation;
- Custom GPT read scope and sanitization;
- legacy/unversioned records;
- consolidation master/house lineage;
- concurrency and idempotency boundaries;
- provider event identity, time, ordering, replay and target resolution;
- AR/AP invoice identity and payment identity;
- deployment configuration and provider credentials.

The five v2 stage reports were read in full or in all material finding/control sections, as was `docs/KCPL-FULL-SYSTEM-AUDIT.md`. Original specialist reports were used where the stage reports referenced inherited findings or where severity needed comparison with the pre-remediation audit.

---

# 4. Method

This was an audit-only hostile review. No application code was fixed, no production Firestore state was touched, no provider request was sent, and no payment was initiated.

The method was:

1. fetch current `main` and open PR state;
2. prove whether the post-stage-report application tree differed from #130;
3. read all five v2 stage reports and the original full-system audit;
4. read remediation #126-#130 intent and explicit deferrals;
5. independently inspect current source for the highest-impact findings and claimed defenses;
6. trace cross-module authority rather than accepting module-local correctness;
7. merge findings that share the same root cause;
8. reject findings whose original exploit is now closed;
9. downgrade findings where the prerequisite or impact does not meet the supplied P1 definition;
10. separate application defects from configuration, provider entitlement, migration, process, monitoring and UAT work.

Important current-source paths independently inspected include:

- `app/api/admin/pricing/route.ts`
- `app/admin/pricing/tms-pricing.server.ts`
- `app/admin/rating/tms-rating.server.ts`
- `app/admin/commercial-lineage/commercial-lineage.server.ts`
- `app/admin/tenders/tms-tendering.server.ts`
- `app/admin/tenders/tms-booking-lineage-dispatch.server.ts`
- `app/admin/consolidation/tms-consolidation-lineage.server.ts`
- `app/shipment-data.server.ts`
- `app/api/admin/quotes/[reference]/route.ts`
- `app/admin/admin-data.server.ts`
- `app/admin/delivery/delivery-control.server.ts`
- `app/admin/customs/customs-clearance.server.ts`
- `app/admin/visibility/tracking-visibility.server.ts`
- `app/admin/visibility/external-workflow-state.ts`
- `app/admin/edi/edi-gateway.server.ts`
- `app/admin/freight-audit/freight-audit.server.ts`
- `app/admin/financial-settlement/settlement-policy.ts`
- `app/admin/financial-settlement/payables-settlement.server.ts`
- `app/admin/financial-settlement/receivables-settlement.server.ts`
- `app/admin/finance/finance.server.ts`
- `app/api/admin/finance/invoices/[reference]/payments/route.ts`
- `app/admin/staff-permissions.ts`
- `app/gpt-action-auth.server.ts`
- `app/api/gpt/briefing/route.ts`
- `.env.example`
- `apphosting.yaml`

This review did not rerun production/provider integration tests against live services. The executable tree is unchanged from the #130 merge, whose exact candidate tree had green CI according to the remediation evidence. Static correctness findings in this report therefore take precedence over the fact that existing tests pass.

---

# 5. Post-remediation architecture assessment

KCPL now has a substantially better core architecture, but it is not yet one coherent state machine.

## What is structurally strong

### Immutable commercial versions

`commercial_versions` is append-only through `transaction.create()`. Economic changes derive a new version and fingerprint. Exact commercial approvals live separately and attest the version ID and fingerprint. This is the correct basic model.

### Transactional TMS booking authority

Standard booking rereads the tender, order, current commercial version, fingerprint, approval, final procurement and existing booking inside a Firestore transaction. Same-operation retries are idempotent only when the persisted shipment and bridge facts agree. A different booking reference does not silently rewrite booked truth.

### Transactional consolidation membership and booked graph

The live admin booking dispatcher uses the lineage-aware consolidation wrapper. The house order is the membership lock, and release/booking re-read the member set transactionally. The older non-lineage implementation still present in the tree is not the route-facing booking authority and is not treated as a live production bypass in this report.

### Stronger human authority

Persisted staff profiles are authoritative after bootstrap, and malformed/inactive staff profiles fail closed. Ordinary route code does not trust browser role or request branch as the authorization source.

### Stronger machine authority

Dedicated EDI, tracking, pickup, automation, GPT and Maersk credentials are intended to be isolated. External shipment matching is set-based and exactly-one, not first-match-wins.

### External observation separation

Provider evidence is stored as observed tracking state. `evaluateExternalPromotion()` gates machine promotion and makes canonical Delivered terminal. International downstream promotion requires KCPL Customs release; Delivered additionally requires verified POD, completed KCPL delivery workflow and no active high/critical blocker.

### Booked financial lineage

For versioned TMS shipments, Freight Audit and supplier settlement resolve the embedded booked commercial version/fingerprint/snapshot and do not reconstruct booked procurement from the current rate card or current FX.

## What remains structurally weak

The remaining faults sit at **parallel authority boundaries**:

- generic quote Won creates a second shipment authority outside TMS booking;
- client-provided policy/FX inputs decide what the immutable version says;
- customer quote issuance is not a mandatory exact-version gate before tender/booking;
- manual Delivery Control is a separate completion authority from the shared external/central workflow policy;
- Customs release is a scalar authority with weaker production requirements than the downstream consumers assume;
- finance identifies settlement by bill rather than underlying procurement obligation;
- finance identifies customer invoices by generated invoice document rather than business billing event;
- several read-shaped functions still write state;
- legacy reconstruction can turn partial current evidence into asserted historical provenance.

The architecture has moved from broadly mutable truth to multiple stronger islands of truth. Production readiness now depends on joining those islands into one authority graph.

---

# 6. Status of original five master risks

| Remediation | Classification | What is genuinely closed | Why it is not fully closed, if applicable |
|---|---|---|---|
| **#126 Financial settlement integrity** | **PARTIALLY CLOSED** | Same-invoice AP/AR settlement is transactional; concurrent partial payments cannot overpay the same invoice; supplier+invoice reference uniqueness blocks same-reference AP duplicates; settlement rereads bill/audit/lineage in the transaction. | AR invoice business-event idempotency was explicitly deferred. Settlement has no procurement-obligation uniqueness across different bills. Consolidation master/house obligations can double-pay. Payment fallback idempotency can suppress a legitimate second payment. Freight Audit variance approval is not CAS-bound. Tax is not independently attested against procurement authority. |
| **#127 Tender / booking / consolidation concurrency** | **CLOSED** | One-active-tender authority, stale tender resistance, EDI 990 routing through the same transition, same-tender booking exactly-once, consolidation membership locking, release serialization and live consolidated-booking graph consistency are present in current code. | Residual post-booking artifact seeding and pickup/manual state races are execution-handoff defects, not evidence that the original #127 booking/membership concurrency primitive remains open. The consolidation approval deadlock is a #129 interaction, not a reappearance of double membership or duplicate booking. |
| **#128 RBAC / trust boundaries** | **PARTIALLY CLOSED** | `staff_profiles` authority, malformed/inactive fail-closed behavior, canonical finance/shipment checks, machine-secret separation, ambiguity-safe matching, GPT GET-only/sanitization all hold. | Accounts combines commercial-edit and finance-settlement authority with caller-controlled economic policy. Pickup/Customs/Delivery use handling-branch fallback on malformed shipments rather than the strict canonical primary-branch rule. Search/read/aggregate paths can derive weaker scope. GPT organization-wide safety depends on external distribution policy. |
| **#129 Commercial economic lineage** | **PARTIALLY CLOSED** | Commercial versions are immutable; exact V1 approval cannot authorize V2; tender/booking/Freight Audit/Match-Pay use exact version/fingerprint on the canonical TMS path; current FX and current rate cards do not rewrite booked TMS history. | Generic stale TMS quotes can still mint non-TMS shipments; exact final customer quote is optional at booking; approval thresholds/manual FX are caller-controlled; wrong-branch rate cards can enter immutable truth; legacy unbooked reconstruction can fabricate provenance; consolidation cannot persist a newly approval-required derived allocation version. |
| **#130 External event workflow authority** | **PARTIALLY CLOSED** | Provider-specific direct status authority is removed; machine promotion is monotonic and gate-based; provider Delivered cannot bypass current Customs/POD/delivery/exception gates; ambiguity quarantines; canonical Delivered is terminal. | Invalid/missing machine event time becomes receipt-time `now`; EDI 214 outer idempotency can freeze partial processing; manual Delivery Control can bypass the gates #130 correctly enforces; weak internal evidence producers and non-atomic guard/write paths mean canonical completion still has more than one authority. |

No remediation is classified REGRESSED. #127 is the only one classified fully CLOSED because the specific original concurrency invariant it targeted is independently present on the live route-facing path.

---

# 7. Confirmed remaining findings by severity

## P0

**None confirmed.**

No current-code path reviewed establishes arbitrary systemic privilege escalation to every domain, destructive systemic data loss, or direct unbounded bank disbursement sufficient for P0 under the supplied model.

## P1 findings

### KCPL-FSA2-001 - Stale versioned TMS quote can mint a parallel generic shipment and escape TMS financial lineage

**Type:** Application defect  
**Affected chain:** Commercial V1 -> stale quote -> Won -> generic shipment -> Freight Audit -> settlement  
**Primary evidence:** `app/api/admin/quotes/[reference]/route.ts`, `app/admin/admin-data.server.ts`, `app/shipment-data.server.ts`, `app/admin/freight-audit/freight-audit.server.ts`

A versioned TMS quote can remain after the Transport Order is legitimately repriced to V2. The generic quote status path can mark the old quote Won without revalidating the quote version/fingerprint against the Transport Order's current authority. `ensureShipmentForWonQuote()` then creates a normal shipment from quote/customer fields without `transport_order_id`, `tender_id`, booked commercial version/fingerprint or the embedded booked commercial snapshot.

`getQuoteDetail()` can also call `ensureShipmentForWonQuote()` while servicing a GET, so merely loading an already-Won stale quote can complete the parallel shipment creation.

The generic record then does not satisfy normal TMS classification. Freight Audit can treat it as non-TMS and `not_applicable`, allowing finance to operate outside the booked-lineage checks #129 intended to make mandatory.

This is the single most important cross-module bypass because each repaired module is locally correct while the chain routes around them.

### KCPL-FSA2-002 - Caller-controlled approval thresholds/manual FX plus Accounts role composition can manufacture trusted economics without Management approval

**Type:** Application defect  
**Affected chain:** Pricing -> approval decision -> tender/booking -> finance  
**Primary evidence:** `app/api/admin/pricing/route.ts`, `app/admin/pricing/tms-pricing.server.ts`, `app/admin/staff-permissions.ts`

Pricing accepts request-supplied `minimumMarginPercent`, `approvalBelowMarginPercent`, manual `fxMode` and arbitrary finite positive `fxRate`. Those inputs are available to `canEditCommercial`, not Management-only authority. Accounts currently has both `canEditCommercial` and `canManageFinance`.

The immutable commercial ledger then faithfully freezes an economic version whose own policy may say approval is not required. Downstream exact-version checks cannot rescue a bad upstream authority decision because they correctly trust that version.

The defect is not that the version can later be rewritten. The defect is that a non-Management principal can decide the policy/FX facts that determine whether Management approval exists.

### KCPL-FSA2-003 - Tender/booking does not require an issued customer quote for the exact final commercial version

**Type:** Application defect  
**Affected chain:** Pricing V1/Quote V1 -> Reprice V2 -> Tender -> Booking  
**Primary evidence:** `app/admin/pricing/tms-pricing.server.ts`, `app/admin/tenders/tms-tendering.server.ts`

Repricing creates V2 and clears `quoted_reference`. Canonical booking validates a quote if `order.quoted_reference` exists, but it does not require one. It can therefore book V2 without proving that a customer-facing quote for V2 was issued. The booking transaction creates its own deterministic hidden quote bridge.

Commercial approval and tender economics can be internally consistent while the customer still holds V1. This is not a tender-vs-booking mismatch; it is a customer-sell-authority mismatch.

### KCPL-FSA2-004 - Branch-specific buy rate can be selected for an order in another branch

**Type:** Application defect  
**Affected chain:** Rate -> Commercial version -> Tender -> Booking  
**Primary evidence:** `app/admin/rating/tms-rating.server.ts`

`canAccessRateCard()` validates whether the staff principal may access the card's branch. `selectTmsRate()` validates the order branch separately. It does not require `card.branch === Global || card.branch === order.branch`.

An all-branch or multi-branch user can therefore select a Birgunj-only tariff for a Kathmandu order if the other rating dimensions match. The immutable procurement snapshot records the order branch but not the rate-card branch/lane provenance needed to prove compatibility.

This can produce a financially incorrect procurement decision without any later module violating its local rules.

### KCPL-FSA2-005 - Consolidation allocation that newly requires approval has no persisted version to approve

**Type:** Application defect  
**Affected chain:** Released house -> master procurement -> allocation -> derived house version -> approval -> consolidated booking  
**Primary evidence:** `app/admin/consolidation/tms-consolidation-lineage.server.ts`

The lineage-aware consolidated booking derives a house allocation version in memory. If the derived economics newly require approval, the transaction returns `approval_required` before the new version is persisted. The normal approval API can only approve a real exact version ID/fingerprint.

Retrying derives another transient decision and returns the same blocker. A legitimate load can therefore enter an unrecoverable supported-workflow deadlock.

### KCPL-FSA2-006 - Manual Delivery Control can set canonical Delivered without current Customs/POD/document/exception workflow gates

**Type:** Application defect  
**Affected chain:** Delivery attempt -> canonical shipment -> customer completion  
**Primary evidence:** `app/admin/delivery/delivery-control.server.ts`

The manual delivery path can transition an attempt to Delivered with recipient evidence and directly update the shipment to `status: delivered`. It does not route the canonical status change through the same full transition authority used by the guarded shipment path or #130 external promotion.

As a result, the provider path correctly blocks Delivered while Customs is pending or POD is unverified, but a staff-side delivery path can still create canonical Delivered under those conditions.

### KCPL-FSA2-007 - Match-Pay lacks a procurement-obligation uniqueness key across distinct supplier bills

**Type:** Application defect  
**Affected chain:** Booked procurement -> supplier invoice A/B -> Freight Audit -> payment  
**Primary evidence:** `app/admin/financial-settlement/payables-settlement.server.ts`, `app/admin/financial-settlement/settlement-policy.ts`

#126 protects one bill document extremely well. It does not create a durable identity for the underlying booked procurement obligation. Supplier invoice uniqueness is supplier+invoice-reference, not shipment/order/commercial-obligation identity.

Two different legitimate-looking supplier invoice references can each represent the full same booked procurement, each pass Freight Audit, and each be settled independently. This is duplicate settlement at the economic-obligation level even though neither bill is paid twice.

### KCPL-FSA2-008 - Consolidation exposes both master full procurement and house allocations as independent payable truth

**Type:** Application defect  
**Affected chain:** Consolidation master -> house allocations -> supplier bills -> profitability  
**Primary evidence:** `app/admin/consolidation/tms-consolidation-lineage.server.ts`, finance/Freight Audit settlement paths

The master shipment carries the full master procurement. Each house shipment carries an allocated booked procurement version. Finance does not model those as alternative representations of one physical obligation.

A master supplier invoice and house supplier invoices can therefore all become payable, double-counting the same physical procurement. The inverse problem also exists: if the real carrier issues only the master bill, house-level actual profitability does not automatically receive the correct allocation of that actual cost.

This is distinct from #127 membership correctness. The master/house operational graph can be perfect while financial obligation identity is wrong.

### KCPL-FSA2-009 - Freight Audit matches procurement subtotal while settlement pays an independently supplied tax-inclusive amount

**Type:** Application defect  
**Affected chain:** AP bill -> Freight Audit -> Match-Pay  
**Primary evidence:** `app/admin/freight-audit/freight-audit.server.ts`, `app/admin/financial-settlement/settlement-policy.ts`, `app/admin/finance/finance.server.ts`

Freight Audit compares booked procurement to invoice subtotal. Settlement basis pays subtotal plus tax plus adjustments minus credits. The bill input accepts a broad tax percentage, while the audit's matched decision does not independently attest that the tax is legitimate for that supplier/jurisdiction/transaction.

Matching a booked cost therefore does not bound the cash payable to that cost. A materially overstated tax can pass a matched procurement comparison and then increase settlement.

If KCPL intends tax to sit outside freight procurement, that is an accounting design choice, but it still needs a separate authoritative tax validation. The current implementation has no such control in the audited path.

### KCPL-FSA2-010 - AR invoice creation is not business-event idempotent

**Type:** Application defect  
**Affected chain:** Booked customer revenue -> AR invoice  
**Primary evidence:** `app/admin/finance/finance.server.ts`

Every AR create can generate a new invoice reference. There is no deterministic customer-billing event identity for shipment/order/commercial version. Browser retry, network retry, double click, or two staff actions can create duplicate invoices for the same intended receivable.

This was explicitly deferred by #126 and remains a release blocker.

### KCPL-FSA2-011 - AR invoice amount/currency is not bound to immutable booked sell lineage

**Type:** Application defect  
**Affected chain:** Booked commercial sell -> AR invoice -> collections -> profitability  
**Primary evidence:** `app/admin/finance/finance.server.ts`

Finance can create a customer invoice with supported amount/currency values without proving that the invoice equals or validly derives from the shipment's booked customer sell amount/currency. A linked versioned shipment does not force use of its immutable booked revenue authority.

The system therefore has strong booked procurement lineage on AP but no equivalent enforced booked sell lineage on AR.

### KCPL-FSA2-012 - Payment fallback idempotency can suppress a legitimate second payment and make some retries non-idempotent

**Type:** Application defect  
**Affected chain:** AR/AP payment -> retry/reconciliation  
**Primary evidence:** `app/admin/financial-settlement/settlement-policy.ts`, payable/receivable settlement servers

When the caller supplies no explicit idempotency key, the payment document identity falls back to a fingerprint of payment fields. Two genuinely separate equal-value payments with the same account/date/method/external-reference shape can collide and the second real cash event can disappear from the ledger.

The settlement paths can also reject on current remaining balance before returning the previously recorded payment identity in some fully-settled retry shapes, so a network retry is not uniformly observable as the same successful command.

### KCPL-FSA2-013 - Freight Audit variance approval is not atomically bound to the exact audit state reviewed

**Type:** Application defect  
**Affected chain:** Freight Audit V1 -> Management review -> concurrent refresh V2 -> approved variance  
**Primary evidence:** `app/admin/freight-audit/freight-audit.server.ts`

Variance review reads the audit and validates state/digest, then later writes `approved_variance` with a merge rather than a transaction/CAS against the exact reviewed fingerprint/version. A concurrent audit refresh can change the persisted audit between review and approval write.

The final record can therefore carry a Management approval decision that was made against an older state. This is the remaining system-wide stale-approval path. It is separate from commercial approval, where exact-version binding works.

## P2 findings

### KCPL-FSA2-014 - Legacy unbooked commercial reconstruction can assert today's rate-card composition as historical truth

**Type:** Legacy-data cleanup/migration plus application defect  
**Evidence:** `app/admin/commercial-lineage/commercial-lineage.server.ts`

`reconstructLegacySelectedVersion()` reloads the current mutable rate card and accepts it when current partner/currency and recomputed aggregate total equal the legacy selected projection. Equal aggregate totals do not prove equal historical component/revision provenance. Booked legacy history correctly fails closed; the weakness is unbooked legacy promotion into modern authority.

### KCPL-FSA2-015 - JPY and fixed two-decimal allocation/settlement precision are inconsistent

**Type:** Application defect  
**Evidence:** consolidation allocation and `settlement-policy.ts`

Consolidation allocation uses a cents-style `*100` model while commercial lineage treats JPY as zero-decimal. Settlement money helpers also normalize to two decimals. Master/house conservation and downstream reconciliation can differ by currency-specific rounding.

### KCPL-FSA2-016 - Customs `released` is a weaker authority producer than its consumers assume

**Type:** Application defect  
**Evidence:** `app/admin/customs/customs-clearance.server.ts`

Manual Customs completion can set `released` with evidence notes without recomputing all current document, hold and severe-exception conditions that later treat the scalar as authoritative. External tracking cannot fabricate release, but KCPL staff can under-prove it.

### KCPL-FSA2-017 - Freight-document review/delete race can leave verified metadata after the underlying blob is gone

**Type:** Application defect  
**Evidence:** Stage 3 document lifecycle paths

Document verification and deletion are not serialized around one revision. A verifier can commit verified metadata based on a document that another actor has deleted, producing phantom workflow evidence.

### KCPL-FSA2-018 - Pickup/Customs/Delivery can authorize malformed shipments from handling-branch fallback

**Type:** Legacy-data cleanup/migration plus application defect  
**Evidence:** Pickup/Customs/Delivery branch helpers

The strict #128 canonical rule requires a valid shipment `primary_branch`. These operational modules can fall back to `handling_branches[0]`. A malformed or legacy shipment missing its canonical primary branch can therefore be mutable by staff whose handling-branch scope would not be authority under the strict policy.

This is P2 rather than P1 because it requires malformed/legacy target data; ordinary well-formed shipments retain correct branch authority.

### KCPL-FSA2-019 - Pickup state is not one serialized generation across manual and provider writers

**Type:** Application defect  
**Evidence:** pickup appointment/manual/provider paths

Manual pickup updates can split appointment and shipment projection writes. Provider events are transactionally idempotent but do not bind an event to the current appointment generation/window or compare event time to the latest schedule generation. A unique old event can legally mutate a newer appointment state.

### KCPL-FSA2-020 - Booking can commit before Job File execution artifacts are completely seeded

**Type:** Application defect / monitoring requirement  
**Evidence:** `app/admin/tenders/tms-tendering.server.ts` and booking-artifact seeding

The booking transaction commits first, then deterministic Job File/task/customs/document artifacts are seeded. Retry can repair, but a durable booked shipment can be visible with missing or partially seeded execution graph. Consolidations can have a mixed seeded/unseeded house set after a post-commit failure.

### KCPL-FSA2-021 - Invalid or missing machine event time becomes receipt-time `now`

**Type:** Application defect  
**Evidence:** `app/admin/visibility/tracking-visibility.server.ts`

`eventTime = validIso(input.eventTime) ?? new Date().toISOString()`. Unknown-time stale evidence therefore becomes newest evidence and can update ETA/location/latest milestone or obtain promotion authority if all workflow gates are otherwise satisfied.

### KCPL-FSA2-022 - EDI 214 envelope idempotency can freeze partially processed events

**Type:** Application defect  
**Evidence:** `app/admin/edi/edi-gateway.server.ts`

A multi-event 214 processes events one by one. If an earlier event commits and a later event fails, the outer ledger becomes failed. Retrying the identical message returns duplicate for any existing outer record instead of resuming failed/queued work. Per-event idempotency is stronger than envelope recovery and can be defeated by the outer layer.

### KCPL-FSA2-023 - Canonical workflow/close/task/exception decisions are not consistently CAS-bound to current evidence

**Type:** Application defect  
**Evidence:** central shipment transition, Job File close, task/customs toggles, exception updates

Several staff workflows follow read -> validate -> later write without a shared workflow revision. Evidence can change between guard and canonical write. `job_closed_at` is also not a hard terminal invariant for all provider/child-state operations, and manual child/exception updates can last-write-win from stale UI state.

### KCPL-FSA2-024 - Tracking target resolution is fail-closed but some valid consolidated/provider identifiers do not map cleanly

**Type:** Application defect / monitoring requirement  
**Evidence:** `app/admin/edi/edi-gateway.server.ts`, provider matching paths

Wrong-target mutation was not reproduced. The remaining issue is availability: standard bookings store carrier references differently from some provider lookup fields; EDI 214 direct references accept `KCPL-S-*` but not consolidation `KCPL-M-*`; shared master/house identifiers can legitimately produce ambiguity. Valid events can be quarantined or unmatched.

### KCPL-FSA2-025 - “Actual profitability” can include audit-matched draft/unapproved AP and uses invoice subtotal rather than final settled payable

**Type:** Application defect / accounting policy requirement  
**Evidence:** Stage 4 profitability path

A matched Freight Audit supplier fact can contribute to actual procurement before AP approval/payment and may use subtotal rather than final tax/adjustment/credit-inclusive settlement. The metric is therefore closer to audited expected invoice cost than realized cash/accounting profitability.

### KCPL-FSA2-026 - AR/AP issue/approve/void lifecycle transitions retain stale read/write races

**Type:** Application defect  
**Evidence:** finance lifecycle helpers

Money settlement itself is transactional, but several invoice/bill lifecycle transitions read state before a later write without expected-state/CAS semantics. Concurrent issue/void/approve actions can leave recoverable contradictory workflow state.

### KCPL-FSA2-027 - GET/read-shaped paths still mutate rating, Freight Audit and finance state

**Type:** Application defect  
**Evidence:** rating GET, Freight Audit refresh GET, finance dashboard overdue persistence

The high-impact quote GET is merged into P1 `KCPL-FSA2-001`. The remaining read-side effects are retained at P2: reading can move an order to rated, refresh/persist audit state or persist overdue invoice status, bypassing the conceptual separation applied to explicit mutations.

### KCPL-FSA2-028 - Secondary/intake/read surfaces still derive noncanonical branch ownership

**Type:** Application defect / legacy-data cleanup  
**Evidence:** quote intake/customer linking, search/list/aggregate policies

An unassigned public enquiry can become owned by `staff.branches[0]`, or hard-coded Kathmandu for all-branch staff, rather than an explicit assignment decision. Search/list/finance aggregate surfaces can also substitute customer/handling relationships when canonical detail would fail malformed shipment/invoice authority.

This is not a proven ordinary cross-branch mutation of a valid record, so P2 is appropriate.

### KCPL-FSA2-029 - Legacy finance aggregates can omit unsupported currencies or coerce malformed currency into NPR-style reporting

**Type:** Legacy-data cleanup/migration  
**Evidence:** Stage 4 legacy finance aggregation

Canonical settlement is stricter, but legacy reporting/aggregates can be financially misleading for malformed or non-preferred-currency historical records. This is a reporting/data-migration blocker, not evidence that current settlement silently converts versioned TMS money.

### KCPL-FSA2-030 - `main` has no branch protection or required status checks

**Type:** Deployment/configuration requirement  
**Evidence:** GitHub branch metadata at final pre-write check

`main.protected = false`, protection is disabled and required checks are off. This is not an application-code defect, but it is unsafe release governance for a system whose integrity depends on exact transaction/lineage semantics.

## P3 findings

### KCPL-FSA2-031 - GPT organization-wide scope is safe only if distribution remains Management-only

**Type:** Deployment/configuration requirement  
**Evidence:** `app/gpt-action-auth.server.ts`

The GPT secret intentionally represents one organization-wide Management-equivalent read-only machine principal. The backend cannot infer the human user's branch. Current GPT routes are GET-only and centrally sanitized, so this is not an application mutation bypass. If the GPT is shared with branch-scoped/non-Management staff, it becomes an intentional cross-branch read oracle.

### KCPL-FSA2-032 - Commercial fingerprint does not cover non-economic ancestry metadata

**Type:** Application hardening  
**Evidence:** Stage 2 ancestry review

`previous_version_id`, reason and source-reference metadata sit outside the economic fingerprint. Given append-only server persistence and no supported generic version mutation, no current exploit was established. Retain as defense-in-depth rather than elevating it to a production blocker.

---

# 8. Rejected or downgraded stage findings

The lead review does not carry every stage severity forward unchanged.

| Stage claim/theme | Lead disposition | Reason |
|---|---|---|
| Same-tender duplicate booking under concurrency remains open | **REJECTED as current finding** | Current booking transaction claims the authoritative tender/order and validates an existing same-operation shipment before idempotent success. #127 closed this primitive. |
| Consolidation house double-assignment/member corruption under concurrency remains open | **REJECTED as current finding** | Live lineage-aware route serializes membership on the house order and validates released/booked member graph transactionally. |
| Stale V1 commercial approval can authorize V2 | **REJECTED** | Exact version ID + fingerprint approval is transactionally enforced. V2 cannot inherit V1 approval. |
| Provider-specific tracking can directly set Delivered outside KCPL gates | **REJECTED** | #130 shared external promotion policy is live. Provider Delivered is blocked without required Customs/POD/delivery/exception state. |
| First-match-wins tracking can mutate the wrong shipment | **REJECTED** | EDI/Maersk matching accumulates candidates and requires exactly one. Ambiguity quarantines. Remaining issue is availability, P2-024. |
| Machine secrets remain cross-fallback compatible | **REJECTED** | #128 dedicated principal model holds in the audited policy/stage regression evidence. |
| GPT can mutate business data | **REJECTED** | Audited GPT route tree is GET-only and central auth policy explicitly read-only. |
| Current FX can rewrite versioned booked TMS history/profitability | **REJECTED** | Booked commercial snapshot persists exact FX decision and current settlement resolution does not recalculate booked truth from current FX. |
| Freight Audit uses current mutable rate-card truth for versioned booked TMS | **REJECTED** | It resolves the booked commercial version/fingerprint/snapshot. Legacy unbooked reconstruction is a different P2 finding. |
| Stage 5 generalized GET-mutation finding as P1 across rating/audit/dashboard | **DOWNGRADED/SPLIT** | Quote GET is retained inside P1-001 because it completes a real stale-lineage shipment bypass. Rating/audit/dashboard write-on-read effects are P2-027. |
| Legacy finance total/currency defect as High | **DOWNGRADED to P2** | Canonical settlement fails more strictly; the surviving impact is legacy aggregate/reporting correctness. |
| Maker-checker absence by itself as a P1 software vulnerability | **REJECTED at P1** | It is an operational/governance control requirement unless paired with a concrete software authority bypass. The concrete Accounts policy+finance composition is already P1-002. |
| GPT organization-wide scope as a code security bug | **DOWNGRADED to P3 deployment-dependent** | Source deliberately defines Management-equivalent organization-wide scope and sanitization. Risk depends on external sharing/distribution. |
| Fingerprint exclusion of ancestry metadata as material economic rewrite | **DOWNGRADED to P3** | No supported mutable version path was found; economic fingerprint remains intact. |

---

# 9. Cross-module failure chains

## 9.1 Rate V1 -> Pricing V1 -> Approval V1 -> Reprice V2 -> Tender/Booking

**Result: commercial stale-approval attack is blocked, customer-authority chain still fails.**

- V1 approval does not authorize V2.
- If V2 says approval is required, canonical tender/booking requires exact V2 approval.
- Repricing clears old quote authority.
- However, V2 can become tendered/booked without an issued customer quote for exact V2, P1-003.
- The inputs that decide whether V2 requires approval remain caller-controlled, P1-002.
- Old V1 quote can separately be marked Won and create a generic shipment, P1-001.

So the repaired core is correct, but the system can still have customer V1, operational TMS V2, and a separate generic V1 shipment.

## 9.2 Carrier counteroffer -> margin -> approval -> booking -> Freight Audit

**Result: lineage mostly works, approval policy authority remains unsafe.**

A material counteroffer derives a new immutable commercial version, recalculates margin, clears stale quote/approval authority, and booking/Freight Audit follow exact booked lineage. This closes the original “counter changes buy cost but booking uses old approval” defect.

The residual gap is upstream: caller-controlled policy thresholds/manual FX can make the new version say approval is not required. No exact customer quote for the post-counter economics is mandatory. Therefore the counter lineage is cryptographically consistent but business approval authority is not fully trustworthy.

## 9.3 Consolidated house source -> master allocation -> booked house -> supplier bill -> profitability

**Result: operational lineage passes; finance fails.**

- source house version is frozen at release;
- master/house booking graph is transactional;
- house allocation derives exact booked commercial versions;
- membership double-assignment was not reproduced;
- if derived allocation newly requires approval, workflow can deadlock before booking, P1-005;
- once booked, full master procurement and allocated house procurement coexist as separately payable finance targets, P1-008;
- JPY allocation can fail conservation, P2-015;
- actual profitability does not resolve master-only actual invoice cost back to houses reliably, P2-025.

This is a classic case where every local lineage record can be internally valid while the economic obligation is counted twice.

## 9.4 EDI 990 acceptance race -> booking

**Result: PASS for the original race.**

`process990()` resolves one tender and calls the same authoritative `respondToTmsTenderFromEdi990()` transition. Stale/race-losing tender responses quarantine. Booking rereads authoritative tender/order/version state transactionally. No supported EDI 990 acceptance race was found that can make a stale tender book.

## 9.5 Carrier Delivered -> Customs pending -> POD pending -> canonical workflow

**Result: provider path PASS, system-wide FAIL.**

External Delivered is blocked by `evaluateExternalPromotion()` unless required Customs is released, POD is verified, KCPL delivery workflow is complete and there is no active high/critical blocker.

Manual Delivery Control can still directly set canonical Delivered without those same gates, P1-006. Therefore “carrier Delivered cannot bypass KCPL” is true, but “canonical Delivered proves all KCPL gates were satisfied” is false.

## 9.6 Tracking target ambiguity -> wrong shipment -> delivery/finance

**Result: wrong-target mutation blocked.**

EDI 214 and Maersk matching are set-based. More than one candidate yields ambiguity/quarantine. No current first-match mutation was found. The residual is P2-024: some legitimate master/house/provider identifier combinations may be unmatched or ambiguous and therefore operationally invisible until reconciliation.

## 9.7 Supplier invoice -> Freight Audit -> payment retry

**Result: exact booked lineage passes; obligation and retry semantics fail.**

The supplier payment transaction rereads current bill/audit/shipment/order/commercial version and blocks stale TMS lineage. However:

- two distinct bills can represent one procurement obligation, P1-007;
- master/house consolidation can double-represent one procurement, P1-008;
- matched subtotal does not independently validate tax-inclusive payable authority, P1-009;
- variance approval can race audit refresh, P1-013;
- fallback payment fingerprint can suppress a legitimate second payment, P1-012.

## 9.8 Branch movement -> linked quotes/orders/shipments/finance

**Result: normal canonical movement largely passes, malformed/secondary surfaces remain inconsistent.**

#128 added relationship compatibility so ordinary customer branch reassignment cannot silently drag incompatible linked shipments/finance across branches. Strict settlement/shipment detail paths still require canonical branches.

The remaining issues require an unassigned or malformed state: intake can invent branch ownership from caller defaults, search/read surfaces can substitute other relationship branches, and Pickup/Customs/Delivery can use handling branch when primary is missing. These are P2-018/P2-028, not evidence that a valid canonical record can be freely moved cross-branch.

## 9.9 GPT org-wide read -> sanitizer / secret leakage

**Result: code PASS, deployment conditional.**

`gptTrustPolicy` explicitly declares organization-wide Management read-only scope. `gptActionJson()` recursively sanitizes secret/password/credential/auth keys, token forms, raw EDI/X12 fields, storage paths and signed/private URLs. The audited GPT briefing route is GET-only.

No secret leak or mutation route was found. The external distribution of the GPT must remain Management-only because the secret does not carry a human branch identity, P3-031.

## 9.10 Legacy unversioned record -> modern workflow

**Result: booked history fails closed; unbooked selected legacy can acquire weakly proven authority.**

Booked unversioned TMS history is not reconstructed from today's rate card/FX. That is correct. Unbooked selected orders can be reconstructed when today's card reproduces the stored aggregate selected cost, even though equal total does not prove equal historical components/revision. That is P2-014.

---

# 10. Security/RBAC assessment

## Human staff authority

The foundational #128 authority model held:

- persisted `staff_profiles` is authoritative once the directory exists;
- inactive staff fails closed;
- unsupported role fails closed;
- unsupported branch scope fails closed;
- selected scope without canonical branch set fails closed;
- Management organization-wide scope still does not make an invalid canonical target branch valid;
- no checked application mutation route used a browser role/query branch as its primary authorization source.

## Capability composition

The most important remaining RBAC problem is not a missing route check. It is the capability bundle:

- Management: commercial + finance + all branches;
- Accounts: commercial edit + job file + finance;
- Commercial: commercial edit, no finance;
- Operations: job file/customer edit, no commercial/finance.

Accounts having both `canEditCommercial` and `canManageFinance` becomes P1 only because pricing policy/FX inputs are not server-owned. If those economic policy inputs were authoritative and Management-only where exceptional, the role combination would be a governance choice rather than an immediate bypass.

## Cross-branch mutation

No supported path was found for a scoped staff member to mutate an ordinary well-formed shipment/invoice in another canonical branch through the strict settlement/shipment APIs.

A cross-branch mutation remains possible for malformed/legacy shipments in Pickup/Customs/Delivery because those helpers can substitute a handling branch when `primary_branch` is missing. This is P2-018.

## Machine principals

The current intended principals are:

| Principal | Credential | Intended authority |
|---|---|---|
| GPT | `KCPL_GPT_ACTION_SECRET` | Organization-wide Management-equivalent read-only intelligence |
| EDI | `KCPL_EDI_SECRET` | EDI gateway |
| Tracking | `KCPL_TRACKING_INGEST_SECRET` | Generic tracking ingestion |
| Pickup | `KCPL_PICKUP_INTEGRATION_SECRET` | Pickup integration |
| Automation | `KCPL_AUTOMATION_SECRET` | Internal scheduled automation |
| Maersk | `MAERSK_WEBHOOK_SECRET` | Maersk/DCSA webhook |

No cross-secret fallback was supported by the current policy/regression evidence. Missing dedicated secrets are intended to fail closed.

## GPT

`app/gpt-action-auth.server.ts` is explicit that the GPT key is not a human identity. The central response wrapper sanitizes recursively and sends `private, no-store`. The audited `/api/gpt` surface is read-only. Therefore GPT is **not** a business-data mutation path.

The remaining deployment rule is strict: do not distribute that GPT/key to users who should not have organization-wide Management read scope.

---

# 11. Commercial integrity assessment

## Improvements that should be preserved

- append-only commercial versions;
- deterministic economic fingerprint;
- exact version/fingerprint approval attestation;
- pricing changes create V2 rather than mutating V1;
- counteroffers derive a new version when economics change;
- accepted same economics do not create meaningless version churn;
- booking locks exact booked version/fingerprint/snapshot;
- booked TMS historical economics do not reload current rate cards;
- historical FX decision is persisted rather than recalculated from current FX;
- versioned quote economic PATCH/PUT is locked.

## Remaining commercial blockers

The commercial ledger is only as authoritative as the event that enters it.

P1-002 and P1-004 demonstrate bad authority inputs can become perfectly immutable truth:

- a caller can influence margin/approval policy and manual FX;
- an accessible but branch-incompatible rate card can be selected.

P1-003 demonstrates exact internal commercial truth can diverge from customer authority because exact final quote issuance is optional before tender/booking.

P1-001 demonstrates a stale customer-facing TMS quote can re-enter operations through a generic shipment path that does not consume TMS authority at all.

## Can old commercial truth be rewritten?

For modern versioned records: **no supported mutation path found.** The serious defect is reuse/bypass, not silent rewrite.

---

# 12. Execution/workflow assessment

## Tender and booking

The original high-risk concurrency core is materially fixed:

- one authoritative active tender pointer;
- stale tender response isolation;
- EDI 990 shares the same transition;
- booking transaction validates exact current tender/order/commercial authority;
- same booking operation is idempotent;
- existing persisted booking is validated before retry success.

The residual booking problem is the handoff after the transaction. Execution artifacts seed after durable booking, P2-020.

## Pickup

Provider pickup uses stronger transaction/idempotency discipline than the manual path. Residual risks are appointment generation/time ordering and split manual projection, P2-019.

## Documents and Job File

Document readiness is generally based on verified metadata, but delete/review concurrency can create phantom evidence, P2-017. Job/task/customs/exception updates do not all serialize on one workflow revision, P2-023.

## Customs

Provider tracking cannot create Customs release. Human Customs release remains weaker than the downstream scalar contract assumes, P2-016.

## Delivery/POD

External provider Delivered is correctly gated. Manual Delivery Control remains a separate canonical completion writer, P1-006.

This is the main execution release blocker because it invalidates the business meaning of `shipment.status === delivered`.

---

# 13. External integration assessment

## EDI 990

The old stale-response race is closed on the supported path. It calls the shared tender transition and stale/ambiguous state quarantines.

## EDI 214

Target matching correctness is materially improved. Multiple candidate shipments quarantine. The remaining defects are:

- malformed/missing event time gains receipt-time freshness, P2-021;
- envelope-level idempotency cannot resume a partially failed message, P2-022;
- some consolidation/provider identifier schemas are availability-poor, P2-024.

## DHL/Maersk/DCSA/generic tracking

The shared normalized observation architecture is the correct direction. Current-source promotion policy treats provider events as evidence and prevents direct workflow regression. Provider Delivered cannot independently fabricate Customs/POD/delivery readiness.

Provider-specific credentials and entitlements are deployment requirements, not code findings by themselves. A missing DHL credential is not counted as a software bug.

## Provider test vs production

`.env.example` defaults DHL to the MyDHL test base URL. Production use requires productive credentials/account entitlement and deliberate production base URL configuration. Maersk private DCSA products require the appropriate Consumer-Key/OAuth entitlement and webhook registration. These are provider credential/entitlement requirements.

---

# 14. Finance/settlement assessment

## What #126/#129 got right

For a single versioned TMS supplier bill:

- current bill is reread;
- audit state is reread;
- shipment/order/booked version/fingerprint are reread;
- lineage mismatch blocks settlement;
- partial payment is atomic;
- overpayment of that bill is blocked;
- retry payment documents are deterministic;
- supplier+invoice reference duplicates are locked;
- current rate cards/current FX do not silently change booked procurement.

This is a major improvement over the original audit.

## Remaining AP blockers

The transaction boundary is still too narrow. It protects a bill, not the procurement obligation.

- P1-007: two different bills can settle one obligation.
- P1-008: consolidation master and houses can settle one physical movement twice.
- P1-009: matched subtotal does not bound/attest tax-inclusive cash payable.
- P1-012: fallback payment identity can suppress a real second payment.
- P1-013: variance approval can attach to a refreshed/different audit state.

## Remaining AR blockers

- P1-010: no business-event idempotency for invoice creation.
- P1-011: invoice amount/currency is not bound to booked customer revenue.
- P1-012: payment identity collision semantics also affect collections.

## Profitability

Expected profitability from modern booked lineage is substantially stronger and does not use current FX to rewrite history. Actual profitability remains semantically weaker because matched invoice facts can enter before approval/settlement and are not always the final payable basis, P2-025.

---

# 15. Legacy/data-quality assessment

Legacy behavior must not be confused with modern-path correctness.

## Modern booked records

Versioned booked records fail closed on fingerprint/snapshot mismatch. Booked unversioned TMS history is not silently reconstructed from today's rate card. This is the correct policy.

## Legacy unbooked selected records

P2-014 remains: current rate-card aggregate equality is treated as sufficient proof to create immutable historical provenance. It is not.

## Malformed branch records

Strict canonical shipment/finance paths deny malformed primary branch. Some operational/read surfaces still derive handling/customer branch, P2-018/P2-028. Existing data must therefore be inventoried before broad rollout.

## Legacy finance records

P2-029 can make historical aggregate reporting incomplete or misleading for unsupported/malformed currency data even though canonical settlement is stricter.

## Required migration stance

Do not “repair” legacy economics by guessing.

Legacy migration should classify records into at least:

1. fully versioned/provable;
2. unbooked with immutable historical source evidence;
3. unbooked requiring human commercial attestation;
4. booked legacy requiring review/read-only archival treatment;
5. malformed branch/relationship records requiring explicit repair;
6. legacy finance records requiring currency/relationship normalization.

A migration attestation must be labeled as human/migration authority, not machine-proven historical lineage.

---

# 16. Deployment/configuration gaps

These items are not application bugs unless the application contradicts the intended configuration.

## Deployment/configuration requirements

1. **Protect `main`.** Branch protection and required CI checks are currently off, P2-030.
2. **Verify runtime secret bindings.** `.env.example` declares dedicated automation, tracking, pickup, GPT, EDI and provider secrets. `apphosting.yaml` visibly binds `KCPL_GPT_ACTION_SECRET`; the repository alone does not prove all other secrets are bound out-of-band. Production deployment must verify each required runtime principal independently.
3. **Keep machine secrets unique.** Do not reuse GPT, EDI, tracking, pickup, automation or Maersk secrets.
4. **Set trusted origins deliberately.** Configure `NEXT_PUBLIC_SITE_URL` and any `KCPL_ALLOWED_ORIGINS` to the real production origin set.
5. **Restrict GPT distribution.** The GPT credential is organization-wide Management read scope, not per-human RBAC.
6. **Verify webhook replay/event contracts.** Providers must supply stable event IDs where required and authoritative event timestamps where the ingestion contract expects them.

## Provider credential/entitlement requirements

- DHL productive MyDHL user/password/account and deliberate production base URL;
- Maersk Consumer-Key and OAuth client entitlement for the specific subscribed product;
- Maersk webhook registration with `MAERSK_WEBHOOK_SECRET`;
- EDI VAN/middleware bridge configuration for `KCPL_EDI_SECRET` and trading-partner routing;
- SendGrid sender/domain verification if transactional quote email is enabled;
- Google Maps server-side keys if those operational features are enabled.

Absence of these credentials from Git is correct. Missing live entitlements are not counted as software defects.

## Operational process/training requirements

- maker/checker rules for high-value AP and commercial overrides;
- explicit customer-quote revision discipline;
- no use of generic quote-Won shipment creation for TMS-originated quotes;
- exception/override training for Job File close and delivery;
- clear ownership of unassigned enquiries rather than implicit first-branch capture;
- defined tax authority and validation process by jurisdiction.

## Monitoring/observability requirements

Production monitoring should surface, at minimum:

- booked shipments with incomplete booking-artifact seed version;
- failed/queued/quarantined EDI envelopes and per-event completion;
- ambiguous/unmatched tracking target queues;
- external observation with invalid/unknown event time;
- commercial review and legacy reconstruction attempts;
- stale/noncurrent quote-Won attempts;
- AP obligation duplicates across bill references;
- master/house consolidation payable overlap;
- payment idempotency-key conflicts;
- Freight Audit refresh/approval version changes;
- malformed primary-branch records;
- manual Delivered while normal completion gates are not simultaneously satisfied.

---

# 17. UAT requirements

KCPL should not use generic “happy path passed” as production evidence. The following adversarial UAT cases are mandatory after remediation.

## Commercial UAT

- approve V1, reprice V2, prove V1 approval cannot book V2;
- prove V2 cannot tender/book until exact customer V2 quote exists if that becomes the intended invariant;
- attempt stale V1 quote Won after V2 exists and prove no shipment is created;
- attempt manual FX and policy-threshold weakening as Accounts/Commercial;
- attempt branch-specific rate card on another branch's order;
- counteroffer that pushes margin below threshold and verify exact reapproval/quote sequence;
- consolidation allocation that newly requires approval and prove a stable approvable version exists.

## Tender/booking/consolidation UAT

- simultaneous tender creation;
- stale old tender accept/reject after retender;
- EDI 990 vs staff response race;
- simultaneous same-reference and different-reference booking requests;
- simultaneous load A/load B add of the same house;
- release vs membership change race;
- consolidated booking retry after partial artifact-seed failure.

## Execution UAT

- manual Delivered with Customs pending;
- manual Delivered with POD missing/unverified;
- manual Delivered with severe open exception;
- delete required document while another reviewer verifies it;
- close/update task/exception concurrently;
- provider old pickup event after reschedule;
- booking transaction success followed by forced artifact-seed failure and automated repair.

## External integration UAT

- provider Delivered with each gate individually missing;
- conflicting shipment identifiers that point to two existing records;
- consolidation master/house shared identifiers;
- malformed/missing event time;
- older event arriving after newer event;
- multi-event EDI 214 failure after event 1 then identical retry;
- duplicate provider event with same ID and same payload;
- duplicate ID with conflicting payload if provider contracts permit detecting it;
- dedicated machine secret cross-auth matrix.

## Finance UAT

- two supplier invoices with different refs for one booked procurement;
- one master bill plus house bills for one consolidation;
- excessive tax on a matched subtotal;
- duplicate AR invoice create retry;
- AR invoice amount/currency different from booked sell;
- two real equal-value payments on same date/method/account;
- exact network retry of one payment after the invoice becomes fully paid;
- Freight Audit refresh racing variance approval;
- AP/AR issue/void/approve races;
- JPY settlement/allocation conservation.

## RBAC/legacy UAT

- malformed shipment with missing `primary_branch` and valid handling branch;
- branch move with linked quote/order/shipment/AP/AR records;
- unassigned enquiry claimed by different role/branch contexts;
- legacy selected order whose current rate-card components changed but aggregate total stayed equal;
- booked unversioned TMS record must fail closed;
- GPT secret used against every mutation/integration route must fail;
- non-GPT machine secret used against GPT must fail;
- GPT responses containing seeded secret/raw-EDI/private-URL-shaped fields must sanitize.

No production classification should improve beyond A until all P1 cases are fixed and their adversarial regressions pass.

---

# 18. Production-readiness verdict

## **A. NOT READY**

The system has no confirmed P0, but it has unresolved P1 code defects in every major economic boundary:

- customer quote authority;
- commercial policy authority;
- rate-card applicability;
- consolidated commercial approval;
- canonical delivery completion;
- AP obligation identity;
- consolidation payable identity;
- Freight Audit/payment basis;
- AR invoice identity;
- AR booked-revenue authority;
- payment idempotency;
- Freight Audit approval concurrency.

A controlled production pilot requires **no unresolved P0/P1 application defects** under the supplied rubric. KCPL does not meet that bar.

The appropriate next milestone is not production pilot. It is **P1 remediation followed by adversarial staging/UAT**.

---

# 19. Ordered remediation backlog

This is an ordered audit backlog only. No fixes were made.

## Release-blocking P1 order

1. **Unify TMS shipment creation authority** so TMS-originated/versioned quotes cannot use the generic Won shipment path. Include a migration query for already-created parallel generic/TMS graphs. `KCPL-FSA2-001`.
2. **Server-own commercial policy and FX authority.** Define immutable policy source, privileged manual FX override and role separation. `KCPL-FSA2-002`.
3. **Require exact final customer sell authority before operational commitment.** Bind exact issued quote/version to tender/booking or define an explicit equivalent customer acceptance event. `KCPL-FSA2-003`.
4. **Enforce rate-card branch applicability and fingerprint its scope/provenance.** `KCPL-FSA2-004`.
5. **Create a persistent pending allocation version/state for consolidation approvals.** `KCPL-FSA2-005`.
6. **Unify canonical Delivered authority** so Delivery Control, direct shipment transition and external promotion consume one current-evidence policy. `KCPL-FSA2-006`.
7. **Introduce procurement-obligation identity** independent of supplier bill document identity. `KCPL-FSA2-007`.
8. **Define master-vs-house financial obligation model** and prevent the same consolidation procurement being payable at both levels. `KCPL-FSA2-008`.
9. **Bind tax/adjustment/credit payable authority** to an explicit accounting/tax decision, not only matched freight subtotal. `KCPL-FSA2-009`.
10. **Introduce AR billing-event idempotency** keyed to the intended revenue obligation/revision. `KCPL-FSA2-010`.
11. **Bind shipment-linked AR to booked sell lineage** or an explicit post-booking revenue adjustment/credit workflow. `KCPL-FSA2-011`.
12. **Require explicit durable payment idempotency identity** and make retry lookup precede remaining-balance rejection where appropriate. `KCPL-FSA2-012`.
13. **CAS-bind Freight Audit variance approval** to exact audit fingerprint/version. `KCPL-FSA2-013`.

## P2 after release blockers

14. replace legacy auto-reconstruction with explicit migration/review authority;
15. make money precision currency-aware end-to-end;
16. strengthen Customs release proof;
17. serialize document verify/delete;
18. remove handling/customer branch substitution from mutation authority;
19. version pickup appointment generations and unify projection writes;
20. add durable booking-artifact readiness/outbox repair;
21. represent unknown event time separately from received time;
22. make EDI 214 envelope processing resumable per event;
23. add workflow revision/CAS for delivery/close/task/customs/exception evidence;
24. normalize external identifier registry for standard/master/house shipments;
25. define actual-profitability accounting semantics;
26. CAS invoice/bill lifecycle transitions;
27. remove write-on-read behavior;
28. make intake assignment and repair-read scope explicit;
29. migrate malformed/legacy finance currency records;
30. protect `main` and require CI.

## P3 hardening

31. enforce/verify Management-only GPT distribution or propagate human identity for branch-scoped GPT use;
32. consider fingerprinting immutable ancestry/provenance metadata separately from the economic fingerprint.

---

# 20. What can safely happen next

Before P1 remediation, the safe next activities are limited to non-production work:

- continue audit/remediation on isolated development branches;
- build migration/inventory reports against non-destructive snapshots;
- run provider integrations only against test/sandbox environments or synthetic records;
- run the adversarial UAT matrix in staging;
- inventory existing stale TMS quotes, generic quote-Won shipments, unversioned commercial records, malformed branches and consolidation finance records;
- design obligation IDs, quote acceptance authority and tax/accounting policy before implementation;
- configure branch protection/CI and deployment secrets without turning on live transactions;
- train staff on the future authoritative workflow after the P1 semantics are fixed.

The following should **not** safely happen on this build:

- live general-production rollout;
- real supplier payment through Match-Pay;
- real customer invoicing as authoritative booked revenue;
- live consolidated procurement settlement;
- reliance on canonical Delivered as proof every completion gate was satisfied;
- broad branch-staff access to the organization-wide GPT;
- silent automated migration of legacy commercial truth;
- production carrier cutover where failed/quarantined events are not actively monitored.

After all P1 code defects are closed, repeat the full cross-module audit rather than testing each fix only inside its owning module. Only then should KCPL be reconsidered for **C. READY FOR CONTROLLED PRODUCTION PILOT**.

---

# 21. Final required questions

The answers below are system-wide. Where the canonical remediated path is safe but an alternate path is not, the answer is YES and the bypass is named.

| Question | YES / NO | Evidence / conclusion |
|---|---|---|
| **Can an old commercial decision be silently rewritten?** | **NO** | Modern `commercial_versions` are append-only and economic changes create new versions. The stale-quote bug reuses old authority but does not rewrite V1. |
| **Can stale approval authorize changed economics?** | **YES** | Commercial V1 approval cannot authorize V2, but Freight Audit variance approval is not CAS-bound to the exact audit state and can race a refresh, `KCPL-FSA2-013`. |
| **Can booking consume economics different from tender?** | **NO** | Canonical TMS booking rereads authoritative tender final economics and exact commercial version/fingerprint inside the transaction. The residual customer-quote problem is different. |
| **Can duplicate booking occur under concurrency?** | **NO** | Same authoritative TMS tender/order booking is transactionally claimed and idempotent. Parallel generic shipment creation from stale quote is P1-001 but is not a duplicate booking race. |
| **Can consolidation double-assign or corrupt house membership?** | **NO** | Live lineage-aware membership/release/booking serializes on the house/load graph and validates exact membership. Finance can still double-count the economic obligation, P1-008. |
| **Can external tracking bypass KCPL workflow?** | **NO** | Machine observations use shared promotion policy; manual tracking is observation-only; provider-specific direct status mutation was not found. |
| **Can provider Delivered bypass Customs/POD?** | **NO** | External Delivered requires current Customs release where applicable, verified POD, completed delivery workflow and no active severe blocker. Manual Delivery can bypass, P1-006. |
| **Can wrong external identifiers mutate the wrong shipment?** | **NO** | EDI/Maersk set-based matching requires exactly one candidate; ambiguity quarantines. Availability problems remain P2-024. |
| **Can cross-branch staff mutate unauthorized records?** | **YES** | A malformed/legacy shipment missing canonical `primary_branch` can still be mutable in Pickup/Customs/Delivery through handling-branch fallback, P2-018. Ordinary valid canonical records are protected. |
| **Can machine secrets cross-authorize other integrations?** | **NO** | Dedicated GPT/EDI/tracking/pickup/automation/Maersk principals are not intended to accept each other's credentials, and the #128 isolation controls held under review. |
| **Can GPT mutate business data?** | **NO** | Audited `/api/gpt` routes are GET-only; `gptTrustPolicy` is explicitly read-only; central response sanitizer is used. |
| **Can Freight Audit use mutable rate-card truth?** | **NO** | For versioned booked TMS, expected procurement resolves immutable booked version/fingerprint/snapshot. Current rate card is not booking/audit truth. |
| **Can Match-Pay pay against stale/different commercial lineage?** | **YES** | The canonical versioned TMS path blocks stale lineage, but stale TMS quote -> generic non-TMS shipment can route to `not_applicable` audit/settlement and bypass the TMS lineage contract, P1-001. |
| **Can duplicate financial settlement occur?** | **YES** | Distinct AP bills can settle one procurement obligation, and consolidation master+house bills can represent the same physical procurement, P1-007/P1-008. |
| **Can current FX rewrite historical profitability?** | **NO** | Modern booked lineage preserves the historical FX decision and does not introduce current-FX reconstruction for booked TMS profitability. |
| **Can malformed legacy data silently become valid authority?** | **YES** | Unbooked legacy selected orders can be reconstructed from today's mutable rate card based on aggregate equality, and malformed shipment branch fallback can grant operational authority, P2-014/P2-018. |
| **Can a critical full-system workflow still strand a real shipment?** | **YES** | Consolidation can deadlock when a derived allocation newly requires approval with no persisted version, and durable booking can precede complete execution artifact seeding. EDI/tracking quarantine/replay gaps can further withhold real movement evidence, P1-005/P2-020/P2-022/P2-024. |

---

# Final audit conclusion

The remediation campaign **did succeed at several hard problems**. It created real immutable commercial lineage, exact-version approval, transactional tender/booking/consolidation authority, stronger persisted RBAC, isolated machine principals and a shared provider-observation workflow gate. Those changes should not be discarded or rewritten casually.

The campaign did **not** yet produce one authoritative full-system chain.

The remaining production blockers are the seams where a different module can create an equally plausible truth without consuming the repaired authority: generic quote-Won shipments, caller-owned economic policy, optional final customer quote, manual completion, bill-local settlement identity, consolidation master/house payables, unbound AR, and stale Freight Audit approval.

Therefore the authoritative post-remediation result is:

> **KCPL is not ready for production. The core remediations are real, #127 is closed, and no P0 remains, but thirteen P1 defects still allow financially incorrect or operationally contradictory full-system outcomes. Production should remain blocked until those P1 authority seams are removed and the complete chain is retested adversarially.**

No application code was changed and no production data was mutated during this audit.
