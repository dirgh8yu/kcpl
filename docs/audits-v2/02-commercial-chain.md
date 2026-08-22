# KCPL Full System Audit v2 — Stage 2: Commercial Chain

**Audit type:** adversarial / audit-only  
**Repository:** `dirgh8yu/kcpl`  
**Audited application ref:** `61bd787fdf1d76819ca6547e74383a0e751592a6`  
**Audited ref message:** `Harden KCPL external event workflow authority (#130)`  
**Open PRs at audit start and final repository re-check:** none  
**Production data mutated:** no  
**Application code changed:** no

## Audit precondition

The required Stage 1 artifact, `docs/audits-v2/01-baseline-architecture.md`, does **not exist on current `main`**. The absence was re-checked at the end of this audit and remained true. Because this Stage 2 assignment permits modification of **only** `docs/audits-v2/02-commercial-chain.md`, this audit did not create, recreate, or infer the missing Stage 1 file.

Accordingly, this report is grounded directly in the current code, tests, Firestore rules, and the commercial-lineage implementation merged through #129/#130. The missing Stage 1 artifact is a provenance/process limitation for this stage, not a reason to pretend the prerequisite was satisfied.

## Executive verdict

**Yes. Current KCPL can still disagree about which economic decision is authoritative.**

The core #129 lineage model is materially stronger than the pre-remediation architecture: commercial versions are append-only in supported application code, their economic snapshots are deterministically fingerprinted, approvals bind exact version ID + fingerprint + order ID, counteroffers derive new versions, and the normal tender-booking transaction writes an immutable booked snapshot into the shipment. Finance then resolves booked TMS procurement from that embedded snapshot rather than from current rate cards or current FX.

However, authority still splits at several seams around that core:

1. Browser-supplied pricing policy thresholds can make a version declare that Management approval is unnecessary.
2. Arbitrary manual FX can manufacture a favorable calculated margin without an independent policy gate.
3. Repricing can invalidate the order's quote pointer, yet tendering and booking do not require an issued customer quote for the final commercial version.
4. A stale versioned TMS quote can be marked `won` through the generic quote workflow and create a separate shipment with no booked TMS commercial lineage at all.
5. A multi-branch user can select a branch-specific rate card for the wrong order branch, and the immutable procurement snapshot does not record the rate-card branch/lane provenance needed to expose the mismatch later.
6. Legacy unbooked reconstruction calls today's rate-card document and can label today's revision/components as historical merely because the recomputed aggregate still matches the old selected amount.
7. Consolidation can calculate a newly approval-required derived house version and then return before persisting that version, leaving nothing that Management can approve.
8. Consolidation allocation hard-codes two-decimal allocation even for JPY, while commercial lineage rounds JPY to zero decimals, allowing the master total, house version totals, and compatibility projections to disagree.
9. The economic fingerprint covers the snapshot economics but does not attest the version ancestry/provenance fields (`previous_version_id`, `reason`, `source_references`).

The result is a strong immutable core surrounded by several alternate doors. The system is not yet able to guarantee a single authoritative economic decision across the entire requested chain.

---

# 1. Authority model observed

| Stage | Intended/current authority | Important compatibility/snapshot fields | Audit result |
|---|---|---|---|
| Transport Order | `commercial_version_id` + `commercial_fingerprint` once versioned | `selected_cost`, `selected_currency`, `selected_rate_card_id`, `pricing_snapshot`, `quoted_reference` | Compatibility fields mostly project the version, but quote authority can be cleared/skipped and legacy reconstruction still trusts old projections. |
| Rate selection | Live order + live selected rate card reread in one Firestore transaction, then immutable version | order selected fields | Concurrency handling is sound, but card branch is not checked against order branch. |
| Commercial version | `commercial_versions/{versionId}` snapshot + fingerprint | version metadata / source refs | Economic snapshot is strongly bound; ancestry/provenance metadata is not fingerprint-bound. |
| Pricing | New immutable commercial version derived from previous immutable procurement | order `pricing_snapshot`, `pricing_status` | Procurement basis is immutable, but approval thresholds and manual FX can be browser-controlled. |
| FX | FX snapshot stored inside version | pricing projection | NRB decisions are snapshotted; arbitrary manual FX is weakly governed and has no effective/source evidence. |
| Approval | `commercial_approvals/{versionId}` exact ID + fingerprint + order | order approval projection | Exact stale approvals do not float. Policy inputs can instead make approval disappear. |
| Customer quote | Versioned quote stores exact version + fingerprint and locked economics | `quoted_amount`, `internal_cost`, `quote_currency` | Economic PATCH is locked, but final quote is not mandatory for tender/booking and generic `won` can bypass TMS booking. |
| Tender | Tender bound to exact commercial version/fingerprint | offered/counter/final amount/currency | Strong normal-path binding; stale tender/current-order mismatch is rechecked transactionally. |
| Counteroffer | New commercial version when economics change | tender final version pointer, order selected projection | Correctly derives procurement and recalculates margin, but trusts policy thresholds already embedded in the version and can enter the weak manual-FX repricing path. |
| Booking | Transaction rereads order + tender + version + approval + final procurement, then embeds booked snapshot | shipment procurement compatibility fields | Strong normal path. It is bypassed by the generic quote-`won` shipment creator. |
| Consolidation | Released source version + derived allocation version per house | load/member allocation projections | Source lineage is preserved on successful booking; approval transition and JPY allocation have defects. |
| Finance / Freight Audit | `booked_commercial_snapshot` + booked ID/fingerprint | shipment/order procurement fields | Strong for genuine TMS-booked shipments; generic quote-`won` shipments do not carry the fields that classify them as TMS lineage. |

---

# 2. Defenses that held under attack

These controls were specifically challenged and no supported-path bypass was found on the audited ref:

- Direct browser Firestore access is disabled by `firestore.rules`; operational mutations go through server/Admin SDK paths.
- `selectTmsRate` transactionally rereads the order and chosen live rate card rather than trusting a stale browser rating result.
- Rate reselection is blocked for `tendering`, `booked`, `cancelled`, and released-consolidation-locked house orders.
- Pricing uses `previous.snapshot.procurement.total` and `.currency` from the resolved immutable version, not the mutable `selected_cost` projection, when it calculates a new commercial version.
- Object-key order does not affect the fingerprint because `commercialFingerprintPayload` is an explicit ordered tuple rather than generic object serialization.
- Currency IDs are normalized; whitespace-sensitive identifiers are normalized/trimmed; null/missing nullable fields canonicalize consistently in the fingerprint payload.
- Money canonicalization handles JPY as zero-decimal and the other configured currencies as two-decimal commercial money; `0`/`-0` do not create economically distinct identities.
- NaN, infinity, and negative top-level procurement/sell totals fail `commercialSnapshotIntegrity`.
- Rate card ID and `rate_card_updated_at` are included in the procurement fingerprint.
- Customer ID, pricing-rule ID/scope, markup, target/minimum margin, approval threshold, discount, accessorial pricing, fixed markup, sell amount/currency, profit/margin, and approval-required boolean are fingerprinted.
- NRB FX rate/source/effective metadata and source/target NPR base values are fingerprinted.
- Tender offered/final economics and counteroffer negotiation values are fingerprinted.
- Management approval is exact-version attestation. Approval for V1 does not satisfy V2.
- Duplicate approval is constrained by approval document identity and create semantics.
- Versioned quote economic editing is blocked by the quote commercial policy.
- Tender creation binds the exact commercial version; tender response and booking reread authority inside Firestore transactions.
- A no-economic-change counteroffer does not create meaningless version churn.
- A real counteroffer creates a new commercial version, preserves the customer sell initially, recalculates margin, and invalidates prior approval by changing version identity.
- Currency-changing counteroffers without compatible stored FX do not silently reuse unrelated/current FX. They enter an explicit review/repricing state.
- Standard TMS booking writes `booked_commercial_version_id`, `booked_commercial_fingerprint`, and `booked_commercial_snapshot` to the shipment.
- `resolveBookedCommercialLineage` validates the embedded booked snapshot and its projection before finance/freight audit treats it as authoritative.
- Booked legacy TMS history is **not** reconstructed from today's rate card or today's FX; it is returned as unproven/review-required.
- Released consolidation houses retain source commercial version/fingerprint fields and successful allocation booking writes a separate derived booked version.
- Consolidation retries check member uniqueness and booked graph consistency.

Those controls are worth preserving. The findings below are where authority still escapes them.

---

# 3. Findings

## KCPL-V2-COM-001 — Browser-controlled margin policy can self-disable Management approval

**Severity:** HIGH

**Affected chain:**  
Pricing → Approval → Quote → Tender → Counteroffer → Booking

**Files / functions:**

- `app/api/admin/pricing/route.ts`
  - `POST`, action `calculate`
- `app/admin/pricing/tms-pricing.server.ts`
  - `calculateOrderPricing`
- `app/admin/pricing/tms-pricing.ts`
  - `calculateSellPrice`
- `app/admin/commercial-lineage/commercial-lineage.ts`
  - `commercialApprovalSatisfied`
  - `commercialVersionBookable`

**Exploit / failure scenario:**

A staff principal with `canEditCommercial` but without the Management role submits a pricing calculation with policy fields such as:

- `minimumMarginPercent = 0`
- `approvalBelowMarginPercent = 0`
- `markupPercent = 0`
- no discount

The route accepts those values from the request body. `calculateOrderPricing` uses them in preference to the server-resolved pricing-rule defaults:

- `minimum_margin_percent: overrides.minimumMarginPercent ?? defaults.minimum_margin_percent`
- `approval_below_margin_percent: overrides.approvalBelowMarginPercent ?? defaults.approval_below_margin_percent`

For a same-currency buy of 1,000 and sell of 1,000, `calculateSellPrice` produces 0% margin. With both policy thresholds set to 0, neither approval condition fires and `approval_required` becomes false.

The newly created immutable commercial version then faithfully fingerprints the lowered thresholds and the `approval_required: false` result. `commercialApprovalSatisfied` returns true for any version whose pricing says approval is not required, so no Management attestation is needed before quote/tender/booking.

The same poisoned policy values also weaken later counteroffer review because `deriveCounterofferSnapshot` recalculates against the threshold values already stored in the previous version.

**Actual impact:**

An ordinary commercial editor can redefine the approval policy for a single deal and then create an immutable version that appears fully policy-valid. This is not stale-approval reuse; it is more dangerous conceptually because the version itself says approval was unnecessary.

Low/zero-margin sell decisions, and counteroffers that should require Management review, can reach customer quote, carrier tender, and booking without the intended approval boundary.

**Evidence:**

- The pricing API exposes `minimumMarginPercent` and `approvalBelowMarginPercent` as request-body inputs.
- `calculateOrderPricing` substitutes those browser values directly for resolved rule thresholds.
- `calculateSellPrice` bases `approval_required` entirely on those supplied threshold values plus discount behavior.
- `approveOrderPricing` itself correctly requires `role === "management"`; the bypass occurs before the approval stage by changing whether approval is considered necessary.

**Why tests missed it:**

`tests/commercial-economic-lineage.test.mjs` verifies that changing `minimum_margin_percent` changes the fingerprint. That proves immutability of the resulting decision, not authorization to choose the threshold. The suite contains no attack that submits `minimumMarginPercent` / `approvalBelowMarginPercent` through the pricing route as a non-management commercial editor.

**Recommended remediation direction:**

Treat approval floors/thresholds as server-owned policy, not commercial request inputs. Resolve them from an immutable or revisioned pricing-policy source. If KCPL requires exceptional policy overrides, make the override a separate Management-authorized economic action with an explicit reason, exact policy revision, actor, and version lineage. Counteroffer recalculation must use trusted policy, not thresholds that an earlier commercial request was allowed to redefine.

---

## KCPL-V2-COM-002 — Arbitrary manual FX can manufacture margin and bypass approval

**Severity:** HIGH

**Affected chain:**  
FX → Pricing → Approval → Quote → Tender → Counteroffer → Booking

**Files / functions:**

- `app/api/admin/pricing/route.ts`
  - action `calculate`
  - `inferFxMode`
- `app/admin/pricing/tms-pricing.server.ts`
  - `calculateOrderPricing`
  - `manualFx`
- `app/admin/pricing/tms-pricing.ts`
  - `calculateSellPrice`
- `app/integrations/nrb-forex.server.ts`
  - `getNrbForexSnapshot`
  - `deriveNrbMidpointFxRate` consumer path

**Exploit / failure scenario:**

A commercial editor explicitly sends `fxMode: "manual"` and any positive `fxRate`. The server checks only that the manual rate is finite and greater than zero. There is no:

- permitted deviation from NRB,
- Management-only gate,
- automatic approval requirement because manual FX was used,
- source document/reference requirement,
- effective date,
- reason code.

`manualFx` records:

- `source: "manual_override"`
- `effective_date: null`
- `published_on: null`
- `modified_on: null`
- no source/target reference values.

Example: procurement is USD 1,000, sell currency is NPR, and an available NRB-like economic reference would imply roughly 132 NPR/USD. A user supplies manual FX 100. The pricing engine now treats converted buy cost as NPR 100,000 instead of NPR 132,000. With a 15% markup, the computed sell around NPR 115,000 appears to carry a healthy positive margin under the manipulated conversion even though it would be loss-making against the external reference.

Because approval is based on the converted buy cost created by that manual rate, the fake conversion can also avoid the margin approval trigger.

**Actual impact:**

The system can create an immutable, fingerprint-valid commercial version whose apparent profitability depends on an unbounded user-entered FX rate. The fingerprint prevents later drift, but it does not make the economic decision trustworthy.

This is especially dangerous in the counteroffer path: a currency-changing carrier counteroffer correctly enters missing-FX review, but the subsequent allowed pricing operation can resolve that review with arbitrary manual FX.

**Evidence:**

- Explicit `fxMode` values `nrb` and `manual` are accepted by the pricing API.
- The manual branch in `calculateOrderPricing` accepts any finite positive `fxRate`.
- `manualFx` stores no effective date or source evidence.
- Margin and approval calculations consume the resulting converted buy cost.

**Why tests missed it:**

The commercial lineage suite verifies that FX rate/source/effective date changes alter the fingerprint and that a stored manual FX rate can mathematically reproduce a stored conversion. It does not test whether the actor is permitted to choose an arbitrary manual rate, whether the rate must be close to NRB, whether manual FX itself should trigger approval, or whether manual source/effective evidence is required.

**Recommended remediation direction:**

Define a server-side FX authority policy. At minimum, distinguish provider rate, contract rate, treasury rate, and exceptional manual override. Require provenance/effective date for manual decisions. Apply a maximum permitted deviation from the trusted reference and/or require Management approval for manual FX. The exact FX policy revision and decision evidence should be snapshotted with the commercial version.

---

## KCPL-V2-COM-003 — Final customer quote is optional after repricing, so V1 can be customer authority while V2 is tendered/booked

**Severity:** HIGH

**Affected chain:**  
Pricing → Quote → Repricing → Tender → Counteroffer → Booking

**Files / functions:**

- `app/admin/pricing/tms-pricing.server.ts`
  - `calculateOrderPricing`
  - `createQuoteFromOrderPricing`
- `app/admin/tenders/tms-tendering.server.ts`
  - `createTmsTender`
  - counteroffer order update
  - booking transaction

**Exploit / failure scenario:**

1. V1 is priced and issued to the customer as an immutable quote.
2. The order is repriced to V2. `calculateOrderPricing` deliberately sets `quoted_reference: null`.
3. V2 changes sell economics, is otherwise bookable, and receives Management approval if its current policy says approval is required.
4. `createTmsTender` requires a selected order and a bookable commercial version, but it does not require an issued quote bound to that exact version.
5. Booking checks a customer quote only if `order.quoted_reference` exists:
   `if (explicitQuoteReference) { ... verify quote version/fingerprint ... }`
6. Because repricing cleared the pointer, the booking proceeds without any customer-issued V2 quote and creates the hidden booking bridge quote from V2.

The same pattern appears after a counteroffer: the order's `quoted_reference` is cleared. A currency-changing counteroffer can then be repriced, including sell-side changes, and the final version can be booked without a reissued customer quote.

**Actual impact:**

KCPL can operationally tender and book economics that the customer never received or accepted, while an older immutable V1 quote remains the latest actual customer-facing commercial document.

The hidden booking bridge quote is an internal compatibility artifact, not proof that the customer was quoted the final version. Therefore the quote authority and booking authority can legitimately point to different economic decisions.

**Evidence:**

- Repricing writes `quoted_reference: null`.
- Counteroffer version creation also writes `quoted_reference: null`.
- Tender creation checks commercial bookability but not an exact issued quote.
- Booking validates the explicit quote only conditionally when the pointer is non-null.
- Booking otherwise creates/updates `tms_order_booking_bridge` with the final version.

**Why tests missed it:**

`tests/commercial-economic-lineage.test.mjs` has no assertion around `quoted_reference` as a prerequisite. Its quote test attacks economic mutation of a versioned quote, not absence/staleness of the customer quote at tender/booking time.

**Recommended remediation direction:**

Define customer quote authority explicitly. If the documented chain is Quote → Tender → Booking, tender and/or booking must require an exact customer-issued quote reference bound to the current commercial version/fingerprint. If KCPL intentionally permits procurement tender before customer quote, then booking must still require customer authority before operational release. If a counteroffer changes only buy economics and customer sell truly remains identical, represent that continuity explicitly rather than silently clearing the quote and treating absence as acceptable. Any sell amount/currency change must require a new customer quote revision.

---

## KCPL-V2-COM-004 — Stale TMS quote can be marked Won and create a parallel non-lineaged shipment

**Severity:** CRITICAL

**Affected chain:**  
Quote → Shipment → Tender/Booking → Freight Audit / Settlement

**Files / functions:**

- `app/api/admin/quotes/[reference]/route.ts`
  - quote status PATCH path
- `app/admin/admin-data.server.ts`
  - `updateQuoteAdmin`
  - `getQuoteDetail`
- `app/shipment-data.server.ts`
  - `ensureShipmentForWonQuote`
- `app/admin/tenders/tms-tendering.server.ts`
  - authoritative TMS booking path for contrast
- `app/admin/financial-settlement/payables-settlement.server.ts`
  - `isTmsShipment`
- `app/admin/financial-settlement/settlement-policy.ts`
  - `resolveBookedCommercialLineage`

**Exploit / failure scenario:**

1. V1 is priced/approved/quoted.
2. The Transport Order is legitimately repriced to V2, so V1 is now stale for the order.
3. A commercial user opens the old V1 quote and marks it `won` through the generic quote admin status path.
4. `updateQuoteAdmin` checks status-transition permission and customer presence, but does **not** reread:
   - the quote's commercial version,
   - the quote fingerprint,
   - the Transport Order's current version/fingerprint,
   - current approval,
   - tender authority,
   - booking state.
5. `ensureShipmentForWonQuote` sees a `won` quote and creates a normal shipment from quote/customer fields.
6. That shipment does not contain the TMS booked lineage graph written by the real booking path. It lacks the authoritative `transport_order_id` / `tender_id` / booked version + fingerprint + embedded booked commercial snapshot used by the remediated TMS path.
7. The V2 Transport Order can still be tendered/booked separately, creating another shipment with a different economic authority.

There is an additional persistence mechanism: `getQuoteDetail` attempts `ensureShipmentForWonQuote` when a won quote has no shipment. Therefore merely loading the quote later can finish creating the parallel shipment even if the original status PATCH did not do so.

**Actual impact:**

This creates two operational truths:

- a generic shipment born from stale V1 quote authority, and
- a TMS shipment born from V2 tender/booking authority.

The generic shipment also lacks the fields used by `isTmsShipment` to classify a shipment as TMS. Therefore downstream TMS-specific booked-lineage enforcement can fail to activate for a shipment that actually originated from a TMS sell-pricing quote.

Consequences include duplicate shipment/job records, stale customer economics becoming operational, finance/freight-audit classification inconsistency, and loss of the exact tender/procurement authority that #129 intended to make mandatory.

**Evidence:**

- `updateQuoteAdmin` does not resolve/revalidate commercial lineage before a transition to `won`.
- `ensureShipmentForWonQuote` creates a shipment from quote/customer data without writing the TMS booked commercial snapshot graph.
- Normal `confirmTmsTenderBooking` does write `commercial_version_id`, `commercial_fingerprint`, `booked_commercial_*`, tender and procurement fields.
- `isTmsShipment` identifies TMS shipments from transport/tender/procurement fields that the generic quote-won shipment does not carry.

**Why tests missed it:**

The commercial lineage test file contains no `won` attack. It verifies that versioned quote **economic editing** is locked, but does not follow a versioned TMS quote through generic status transition → generic shipment creation → TMS finance classification.

**Recommended remediation direction:**

There must be one shipment-creation authority for TMS-originated quotes. A quote carrying TMS commercial lineage/source must not be allowed to use the generic `ensureShipmentForWonQuote` path. Either block `won` until the exact current order/version/tender prerequisites are satisfied, or route the transition through the same authoritative TMS booking transaction. Generic quote shipment creation should explicitly reject TMS-linked quotes. Existing TMS quotes/shipments should be reviewed for this split-path shape.

---

## KCPL-V2-COM-005 — Branch-specific rate cards can be selected for the wrong order branch, and the immutable snapshot hides the mismatch

**Severity:** HIGH

**Affected chain:**  
Transport Order → Rate selection → Commercial version → Pricing → Tender → Booking

**Files / functions:**

- `app/admin/rating/tms-rating.ts`
  - `calculateRating`
  - `rateOrder`
- `app/admin/rating/tms-rating.server.ts`
  - `canAccessRateCard`
  - `rateTmsOrder`
  - `selectTmsRate`
  - `selectedRateSnapshot`
- `app/admin/commercial-lineage/commercial-lineage.ts`
  - `CommercialProcurementSnapshot`
  - `commercialFingerprintPayload`

**Exploit / failure scenario:**

A Management or other all/multi-branch staff member can access both a Kathmandu Transport Order and a Birgunj-only rate card.

`canAccessRateCard` asks whether the staff member can access the card's branch. `calculateRating` checks mode, lane, equipment and date validity, but it does not enforce:

`card.branch === "Global" || card.branch === order.branch`.

The Birgunj card can therefore rate and be selected for the Kathmandu order if its other dimensions match.

The created commercial snapshot records the **order** branch at the root but does not record the rate-card branch, rate-card origin, or rate-card destination inside `CommercialProcurementSnapshot`. The fingerprint therefore cannot expose that the rate-card scope used to create the version was incompatible with the order scope.

**Actual impact:**

A branch-specific tariff can cross branch boundaries and become an immutable authoritative commercial version. Every downstream control can then work exactly as designed while pricing, tendering, and booking the wrong tariff.

This is a provenance failure at the point where untrusted mutable rate-card data becomes immutable lineage.

**Evidence:**

- `PartnerBuyRateCard` has a `branch` field.
- `canAccessRateCard` checks staff access to the card branch, not equality with the order branch.
- `calculateRating` has no branch comparison.
- `CommercialProcurementSnapshot` includes rate-card ID/update/validity but not rate-card branch or lane fields.

**Why tests missed it:**

The lineage suite checks rate-card ID/update identity and general branch presence on the commercial snapshot. It contains no cross-branch rate-card selection attack, and the fingerprint cannot test a field that the snapshot never records.

**Recommended remediation direction:**

Enforce card scope server-side at rating and selection: a non-global rate card must match the order branch. Snapshot and fingerprint the rate-card scope that justified selection, including at least rate-card branch and immutable lane/revision identity. Prefer immutable rate-card revisions over treating `updated_at` on a mutable document as the revision identity.

---

## KCPL-V2-COM-006 — Legacy unbooked reconstruction can fabricate historical rate-card provenance from today's card

**Severity:** HIGH

**Affected chain:**  
Legacy Transport Order → Commercial reconstruction → Pricing → Tender → Booking

**Files / functions:**

- `app/admin/commercial-lineage/commercial-lineage.server.ts`
  - `reconstructLegacySelectedVersion`
  - `resolveCurrentCommercialVersionInTransaction`
- `tests/commercial-economic-lineage.test.mjs`
  - legacy reconstruction tests

**Exploit / failure scenario:**

A legacy unbooked order has only compatibility fields such as:

- selected rate-card ID,
- selected partner,
- selected currency,
- selected aggregate cost.

There is no immutable historical commercial version.

`reconstructLegacySelectedVersion` loads the **current** `partner_rate_cards/{rateCardId}` document, recomputes today's components using current rate-card fields and current order quantities, and accepts reconstruction when current partner/currency and the recomputed aggregate match the stored selected cost at commercial money precision.

That does not prove historical provenance.

Example: the historical selection was USD 1,000 flat linehaul with no accessorial. Today the same rate-card document has been changed to USD 950 linehaul + USD 50 accessorial, still totaling USD 1,000. Reconstruction passes the aggregate check and creates `legacy_selected_reconstructed` using today's rate-card `updated_at` and today's components, thereby asserting that today's composition/revision was the historical economic decision.

The same conceptual failure exists whenever multiple current components can produce the same stored legacy aggregate. Equality of aggregate total is not proof of the historical revision that produced it.

**Actual impact:**

Unbooked legacy data can acquire fabricated lineage and then continue into pricing/tender/booking as if the reconstructed version were historically proven. The version becomes immutable after reconstruction, cementing the false provenance.

This violates the audit requirement that lazy legacy reconstruction be **exactly provable**.

**Evidence:**

- The function explicitly reads the current `partner_rate_cards` document.
- Its proof gate includes current partner/currency and `sameCommercialMoney(total, selectedCost, selectedCurrency)`.
- It then emits reason `legacy_selected_reconstructed` with current rate-card detail.
- Booked legacy records are correctly blocked by `legacy_booked_history_unproven`; the defect is the unbooked reconstruction standard.

**Why tests missed it:**

Test 37 asserts that reconstruction contains the current-total equality check and labels that behavior “exactly provable.” The test proves the implementation matches its intended check, but the check itself is epistemically insufficient: current aggregate equality does not prove historic rate-card revision/components.

**Recommended remediation direction:**

Do not automatically reconstruct historical procurement from a mutable current rate card unless an immutable revision/snapshot/event captured at selection time exists and can be matched exactly. Legacy records without such evidence should remain `commercial_review_required` and require an explicit migration/review attestation that does not masquerade as machine-proven historical lineage.

**Reachability note:** the audited admin rating API exposes rate-card creation and no normal edit action was found in that route. That reduces ordinary UI reachability of the example today, but it does not make current-document reconstruction historically provable; server/admin migrations, prior mutations, future editing, or existing mutable data can still trigger the flaw.

---

## KCPL-V2-COM-007 — Consolidation cannot complete newly-triggered approval because the derived version is returned before it is persisted

**Severity:** HIGH

**Affected chain:**  
Released house source version → Master procurement → Allocation → Derived house version → Approval → Consolidated booking

**Files / functions:**

- `app/admin/consolidation/tms-consolidation-lineage.server.ts`
  - `confirmConsolidatedLoadBookingWithLineage`
- `app/admin/commercial-lineage/commercial-lineage.ts`
  - `deriveConsolidationAllocationSnapshot`
- `app/admin/commercial-lineage/commercial-lineage.server.ts`
  - approval/version persistence helpers
- `tests/commercial-economic-lineage.test.mjs`
  - tests 28/29

**Exploit / failure scenario:**

A released house source version was previously bookable. Consolidated master procurement is allocated back to the house, and the new allocated buy cost lowers the house margin enough that the **derived** house pricing now has `approval_required: true`.

The consolidation transaction:

1. derives the new allocation snapshot,
2. constructs a new commercial version in memory,
3. sees that the derived pricing requires approval,
4. returns `approval_required`,
5. only later, in the success path, would call `persistCommercialVersionInTransaction(transaction, version)`.

Therefore the approval-required derived version is never written. The order still points at the prior source version. The normal approval API can approve only a real/current exact commercial version ID + fingerprint. There is no persisted derived version for Management to approve.

Retrying the consolidation just derives another transient version and returns the same result.

**Actual impact:**

A legitimate consolidation allocation that should be recoverable by Management approval can become permanently unbookable through the supported workflow. This is a commercial state-machine deadlock.

The system correctly refuses to bypass margin approval, but it fails to provide a state that can actually be approved.

**Evidence:**

- Derived versions are collected in `bookedHouseVersions`.
- The `approval_required` return occurs during derivation/validation.
- `persistCommercialVersionInTransaction(transaction, version)` occurs later when writing the successful booked houses.
- Approval attestation is exact-version based, so a non-existent derived version cannot be approved.

**Why tests missed it:**

Test 28 verifies that successful consolidation persists one derived booked version and preserves the source version. Test 29 verifies the master and **source** house versions are bookable inside the transaction. Neither exercises the case where the *new derived allocation itself* newly requires approval and then verifies that a stable approvable version exists before retry.

**Recommended remediation direction:**

Introduce an explicit pre-booking derived allocation decision state. Persist the derived version immutably as a pending allocation version before requesting approval, bind Management approval to that exact version/fingerprint, and on booking retry verify that the released source, master procurement, allocation inputs, derived version, and approval all still match. Do not mutate or replace the released source version.

---

## KCPL-V2-COM-008 — JPY consolidation allocation uses cents, then lineage rounds to yen, causing master/house economic disagreement

**Severity:** MEDIUM

**Affected chain:**  
Master booking → Consolidation allocation → Derived house versions → House shipments → Finance/Freight Audit

**Files / functions:**

- `app/admin/consolidation/tms-consolidation.ts`
  - `allocateProcurementCost`
- `app/admin/commercial-lineage/commercial-lineage.ts`
  - `commercialCurrencyDecimals`
  - `commercialMoney`
  - `deriveConsolidationAllocationSnapshot`
- `app/admin/consolidation/tms-consolidation-lineage.server.ts`
  - house order/shipment/load allocation persistence
- `app/admin/financial-settlement/settlement-policy.ts`
  - `resolveBookedCommercialLineage`

**Exploit / failure scenario:**

`allocateProcurementCost` hard-codes two-decimal smallest units:

- `totalCents = Math.round(totalCost * 100)`
- each allocation is `cents / 100`

But commercial lineage defines JPY as zero-decimal money.

Example, 20 houses share a JPY 10 master procurement equally:

- allocator produces JPY 0.50 per house,
- `deriveConsolidationAllocationSnapshot` applies JPY commercial rounding and stores JPY 1 as each house's authoritative version procurement total,
- 20 derived house versions therefore total JPY 20 against a JPY 10 master,
- meanwhile the order/shipment compatibility fields are written using the raw `allocation` value (JPY 0.50).

Even in realistic large values, remainder/rounding can make the sum of derived house commercial totals differ from the master by several yen.

`resolveBookedCommercialLineage` compares shipment projection and snapshot with `sameCommercialMoney`, which itself rounds both to JPY zero decimals, so a raw fractional-JPY compatibility projection can still be accepted as equivalent to the integer booked snapshot.

**Actual impact:**

The master procurement authority, per-house immutable commercial versions, and per-house compatibility fields can hold different economic totals. This breaks allocation conservation and creates avoidable reconciliation noise in audit/profitability reporting.

The absolute amount is usually small for normal JPY freight values, so severity is Medium, but it directly violates the single-economic-authority invariant.

**Evidence:**

- Allocation always uses ×100 regardless of currency.
- Commercial money explicitly uses zero decimals for JPY.
- Derived allocation snapshot rounds the allocated amount with `roundMoney(..., currency)`.
- House order/shipment/load allocation projections use the pre-lineage raw `allocation` value.
- The existing JPY test covers `commercialMoney(12.6, "JPY") === 13`, not consolidation allocation conservation.

**Why tests missed it:**

The lineage suite tests generic JPY money canonicalization and tests consolidation source preservation, but it does not run currency-aware allocation cases or assert:

`sum(derived house procurement totals) === master procurement total`

in the currency's smallest unit.

**Recommended remediation direction:**

Make allocation currency-aware. Allocate in the target currency's actual smallest unit (`1` for JPY, `0.01` for the current two-decimal currencies), distribute the remainder deterministically, and use that one rounded allocation value everywhere: derived version, order projection, shipment projection, load member, and audit payload. Assert conservation before commit.

---

## KCPL-V2-COM-009 — Economic fingerprint does not attest version ancestry/source references

**Severity:** MEDIUM

**Affected chain:**  
Commercial version → Counteroffer lineage → Consolidation source/derived lineage → Audit/history

**Files / functions:**

- `app/admin/commercial-lineage/commercial-lineage.ts`
  - `CommercialVersion`
  - `commercialFingerprintPayload`
  - `commercialFingerprint`
- `app/admin/commercial-lineage/commercial-lineage.server.ts`
  - version serialization/deserialization/persistence

**Exploit / failure scenario:**

`CommercialVersion` contains lineage-significant metadata outside `snapshot`:

- `previous_version_id`
- `reason`
- `source_references`
- creator/time metadata

`commercialFingerprint` hashes only `CommercialSnapshot`. Therefore a version can retain the same valid commercial fingerprint if its ancestry or source references are changed.

For example, a consolidation allocation version's economic snapshot can remain byte-for-byte economically identical while its claimed load/master/source references or previous-version edge are changed. The fingerprint still verifies.

The audited supported application code is materially protected because commercial versions are created append-only and direct browser Firestore writes are denied. This reduces immediate exploitability. It does not, however, make the claimed immutable **lineage** cryptographically/self-consistently attested. A server-side bug, migration, privileged repair, or data corruption can rewrite provenance without an economic fingerprint mismatch.

**Actual impact:**

The system can prove “these economics equal this fingerprint,” but cannot independently prove “these economics came from this prior version / tender / load / source graph” using that fingerprint. For an architecture whose remediation goal is immutable commercial lineage, that is an integrity gap.

**Evidence:**

- `commercialFingerprintPayload` receives only `CommercialSnapshot`.
- `previous_version_id`, `reason`, and `source_references` live on `CommercialVersion`, outside the snapshot.
- The code comment intentionally excludes general actor/activity metadata, but source ancestry is more than display metadata in counteroffer/consolidation history.

**Why tests missed it:**

The suite strongly tests economics fingerprinting and append-only supported application writes. It does not mutate ancestry/source-reference metadata and assert that version identity becomes invalid.

**Recommended remediation direction:**

Keep the economic fingerprint if useful, but add a lineage/provenance attestation that covers at least version ID, previous version ID, reason, source references, and economic fingerprint. Alternatively include normalized ancestry/source references in a version-identity hash. Preserve actor/display metadata separately if those fields are intentionally non-authoritative.

---

# 4. Attack-by-area conclusions

## Rate selection

**Concurrent rate selections:** guarded by Firestore transaction rereads. No successful stale-browser selection race found.  
**Stale rate card:** selection rereads the card and recomputes rating; good.  
**Rate-card edit after a version exists:** current immutable versions retain selected values; later card changes do not rewrite them.  
**Revision provenance:** partial. ID + `updated_at` + validity are captured, but card branch/lane provenance is omitted.  
**Partner/mode/unit:** selected partner comes from the card; mode/lane/equipment/date/quantity checks exist. Partner lifecycle status is not part of the immutable procurement snapshot.  
**Zero/negative/NaN:** negative and non-finite critical inputs are rejected/clamped in current creation/calculation paths; zero rate is permitted. No business rule establishing that zero is always invalid was found, so this was not promoted to a finding.  
**Minimum/fuel/accessorial/rating quantity:** captured in the selected snapshot and fingerprint.  
**Branch mismatch:** vulnerable; see KCPL-V2-COM-005.  
**Reselection after tender/release/booking:** blocked.

## Fingerprint

**Object key order:** safe through explicit tuple canonicalization.  
**Null vs missing:** nullable canonicalizers generally collapse both consistently.  
**0 vs -0:** no economically meaningful divergence observed.  
**Floating precision:** money, percentages, quantity, and FX have explicit canonical precision.  
**Currency casing / whitespace:** normalized.  
**JPY precision:** fingerprint money precision is correct; consolidation allocation is not, see KCPL-V2-COM-008.  
**FX precision:** 12-decimal fingerprint precision.  
**Customer scope:** customer IDs and pricing rule identity/scope are fingerprinted.  
**Counteroffer values:** included.  
**Relevant omissions:** rate-card branch/lane are absent from the procurement snapshot; ancestry/source references are outside the economic fingerprint.  
**Acceptable omissions:** `partner_name` and human-readable `approval_reasons` are not fingerprinted; the actual partner ID and approval-driving numeric policy/boolean are fingerprinted, so the omitted labels/text are not independently authoritative economics.

A residual hardening weakness was noted but not promoted to a finding: `commercialSnapshotIntegrity` validates top-level nonnegative totals, customer match, and FX relationship, but does not independently re-derive every procurement/pricing arithmetic component. Current supported creators compute those components server-side and no direct browser writer to `commercial_versions` exists, so no reachable malformed-version path was proven on this ref. It remains a useful defense-in-depth target.

## Pricing

Pricing correctly rereads immutable procurement from the previous commercial version rather than trusting the order's mutable `selected_cost`. Current pricing-rule edits therefore do not retroactively change an existing version's stored economics.

The serious defect is policy authority at **version creation**: client inputs can redefine approval thresholds and manual FX, see KCPL-V2-COM-001/002. Pricing-rule ID and selected numerical inputs are stored, but the exact pricing-rule revision (`updated_at`/revision ID) is not captured; economics are reproducible from the snapshot, while full rule provenance is weaker.

## FX

NRB-derived decisions are stored with concrete rate/source/effective metadata and base NPR values. Existing versioned history does not recalculate from today's provider data.

Manual FX does not drift after version creation because the entered value is snapshotted and fingerprinted. The defect is that it can be arbitrary and lacks sufficient decision provenance/control at creation, not that old versions later change.

## Approval

Exact stale approval resistance held:

- approve V1 vs reprice V2: V1 approval does not satisfy V2;
- approve V1 vs counteroffer V2: same;
- duplicate approval: exact version document/create semantics constrain it;
- partial commercial pointer: review-required;
- missing/bad version: review-required;
- Management role is required to write approval.

The bypass is upstream: browser-controlled policy/FX can produce a version that says approval is not required.

## Quote

Versioned quote economics are locked against the normal admin commercial PATCH. Historical quote amount/currency/internal cost cannot be rewritten through that path.

Quote **authority** is still unsafe:

- final issued customer quote is optional for tender/booking after the pointer is cleared, and
- a stale TMS quote can take the generic `won` shipment path.

See KCPL-V2-COM-003/004.

## Tender

The normal tender path is one of the strongest pieces of #129:

- one active tender authority is transactionally controlled;
- offered economics come from the bound commercial version;
- acceptance at unchanged economics retains that version;
- real counteroffer derives a new version;
- final amount/currency are revalidated at booking;
- stale order/tender/version pointers fail closed.

No normal-path case was found where the tender's final procurement can differ from the version it claims while still passing booking validation.

## Counteroffer

For the requested scenario, starting sell 1,300 / buy 1,000 and a carrier counteroffer of 1,200:

- a new procurement version is derived;
- customer sell initially remains 1,300;
- converted buy/margin are recomputed when FX is available;
- the old approval cannot satisfy the new version;
- the new version becomes approval-required when its stored policy thresholds demand it;
- booking is blocked until the exact current version is bookable.

The derivation itself is sound. It can still bypass the **real** KCPL margin policy if the source version's thresholds were already lowered through KCPL-V2-COM-001. A currency-changing counteroffer can also enter the arbitrary manual-FX path in KCPL-V2-COM-002.

## Booking

The authoritative TMS booking transaction rereads:

- order,
- tender,
- final commercial version/fingerprint,
- approval,
- customer,
- tender final economics,
- current order commercial pointer.

It then embeds the booked commercial snapshot in the shipment. Same-reference retries have explicit state checks. This path did not show a normal race that locks economics different from tender authority.

The major exception is architectural, not an internal booking race: the generic quote-`won` path can create a shipment without going through this booking authority at all.

## Consolidation

Successful normal consolidation preserves both:

- released house source version/fingerprint, and
- derived booked allocation version/fingerprint.

Source house mutation is locked after release and the booking transaction rereads source pointers.

Two defects remain:

- newly approval-required derived versions are not persistently approvable (KCPL-V2-COM-007), and
- currency precision can make JPY master/house allocation disagree (KCPL-V2-COM-008).

No successful path was found that simply overwrites/erases the original released house commercial version.

## Legacy

Booked history fails closed rather than using today's rate/pricing/FX. That is correct.

Unbooked lazy reconstruction is not exactly provable because it uses today's rate-card document as evidence of yesterday's decision. See KCPL-V2-COM-006.

---

# 5. Cross-module duplicate economic fields

## `transport_orders`

Fields such as `selected_cost`, `selected_currency`, `selected_rate_card_id`, `pricing_snapshot`, `pricing_status`, `quoted_reference`, tender pointers, and booked pointers coexist with `commercial_version_id` / fingerprint.

**Classification:** mostly compatibility/projection fields.  
**Authority:** downstream remediated pricing/tender/booking generally rereads the immutable version.  
**Danger:** legacy reconstruction elevates old selection projections into new lineage; quote-pointer absence is treated as acceptable; consolidation JPY can store a raw projection that differs from rounded immutable house procurement.

## `quotes`

`quoted_amount`, `quote_currency`, `internal_cost`, and commercial version/fingerprint are snapshots.

**Classification:** versioned TMS quote economic snapshots.  
**Authority:** economic PATCH is correctly locked.  
**Danger:** status remains independently actionable; `won` can create a generic shipment without validating current TMS commercial authority. A cleared order quote pointer also makes a customer quote optional downstream.

## `transport_tenders`

Offered/counter/final amounts and currencies duplicate commercial procurement/negotiation economics.

**Classification:** workflow snapshots bound to exact commercial version.  
**Authority:** the commercial version remains authoritative.  
**Danger:** low on the normal path because booking recomputes/verifies final amount/currency and exact pointers.

## `shipments`

Normal TMS booking writes procurement compatibility fields plus exact booked version/fingerprint/full snapshot.

**Classification:** compatibility fields + immutable booked authority.  
**Authority:** `booked_commercial_snapshot` is the finance/audit source for genuine TMS booking.  
**Danger:** generic quote-`won` shipment creation produces a different shipment schema with none of the booked TMS lineage, creating a parallel authority path. Consolidated JPY houses can also contain raw fractional projection values that round to a different immutable snapshot value.

## `payables` / Freight Audit / settlement

Current settlement and Freight Audit logic intentionally resolves genuine TMS booked procurement from the embedded immutable booked snapshot and validates shipment/order booked pointer consistency. No path was found that reconstructs booked procurement from today's rate card or FX.

**Danger:** TMS-specific protection depends on recognizing the shipment as TMS. A stale TMS quote converted by the generic quote-won shipment creator lacks the identifying TMS booking fields, so the wrong shipment creation path can sit outside that lineage classification.

---

# 6. Test adequacy assessment

`tests/commercial-economic-lineage.test.mjs` is valuable, but a significant fraction of it asserts source-code shape or local pure-function behavior. The failures found here sit in **composition between modules**, exactly where source-shape tests are weakest.

The suite correctly covers:

- fingerprint determinism;
- buy/sell/currency/discount/margin/FX/customer fingerprint changes;
- JPY commercial money normalization;
- exact approval binding;
- counteroffer derivation;
- no-economic-change counteroffer;
- successful consolidation source preservation;
- source/master bookability rereads;
- quote economic lock;
- booked finance lineage;
- append-only application writes;
- booked legacy fail-closed behavior.

The missing adversarial scenarios are:

1. non-management caller lowers `minimumMarginPercent` / `approvalBelowMarginPercent` through the real route;
2. arbitrary manual FX manipulates apparent margin;
3. V1 customer quote → reprice V2 → tender/book V2 without new customer quote;
4. stale versioned TMS quote → `won` → generic non-lineaged shipment;
5. wrong-branch rate-card selection by an all-branch user;
6. legacy current card with changed components but the same aggregate selected cost;
7. consolidation allocation newly requiring approval and then attempting Management approval/retry;
8. JPY allocation conservation across multiple houses;
9. provenance/source-reference mutation versus version identity.

These should be treated as cross-module state-machine tests, not only string/source assertions.

---

# 7. Final Stage Verdict

## 1. Can current rate-card edits rewrite history?

**Already versioned/booked history: NO.** The immutable snapshot preserves the selected economics and booked finance does not consult current rate cards.

**Legacy unbooked reconstruction: YES, conditionally.** `reconstructLegacySelectedVersion` reads the current card and can assert today's revision/components as historical when its recomputed aggregate still matches the old selected amount. This is fabricated provenance, even though the aggregate is unchanged.

## 2. Can pricing versions drift?

**The bytes/economics of an existing stored version do not drift through supported application mutation.** Fingerprint/append-only controls are strong.

**But the authoritative version can be wrong at creation.** Client-controlled approval thresholds and arbitrary manual FX can create a fingerprint-valid version that does not represent KCPL's intended policy. Pricing-rule changes do not rewrite prior values, but exact rule revision provenance is incomplete.

## 3. Can stale approvals survive?

**NO, not as the same approval floating from V1 to V2.** Exact version ID + fingerprint + order attestation works.

**However, approval can be bypassed upstream** by creating a version whose browser-controlled policy/FX makes `approval_required` false.

## 4. Can quote/tender/booking disagree?

**YES.**

Two independent failures prove it:

- V1 can remain the last customer-issued quote while V2 is tendered/booked after `quoted_reference` is cleared.
- A stale V1 TMS quote can be marked `won` through the generic quote workflow and create a non-lineaged shipment while V2 continues through TMS tender/booking.

## 5. Can counteroffers bypass margin policy?

**The direct counteroffer derivation does not inherently bypass it; it correctly recalculates margin and creates a new version.**

**Overall system answer: YES.** It trusts the policy thresholds already embedded in the source version, which can have been lowered by KCPL-V2-COM-001. Currency-changing counteroffers can also be resolved through the arbitrary manual-FX path in KCPL-V2-COM-002.

## 6. Can FX history drift?

**Existing versioned FX economics: NO.** The chosen rate is snapshotted/fingerprinted and old booked history does not use today's FX.

**FX decision quality/provenance: unsafe.** Manual FX can be arbitrary, has no effective/source evidence, and can manipulate margin before the immutable version is created.

## 7. Can consolidation destroy lineage?

**No successful booked path was found that erases the released house source lineage.** Source and derived versions are both retained.

**But consolidation integrity is not complete:** newly-triggered derived approval deadlocks the workflow, and JPY allocation can make the master, derived house versions, and compatibility projections disagree.

## 8. Can legacy data fabricate history?

**YES for unbooked legacy selected orders.** Current rate-card state can be used to create `legacy_selected_reconstructed` provenance that is not historically proven.

**NO for booked legacy history through the remediated lineage path.** Booked records without the embedded immutable version fail closed instead of being reconstructed from current rate cards or FX.

---

# Stage 2 conclusion

The #129 remediation established a credible immutable economic record, but **immutability is not the same thing as authority**. KCPL currently has several paths that can create, skip, or operationalize economics outside the intended authority graph.

The most urgent commercial-chain risks are:

1. server ownership of approval policy thresholds,
2. governance of manual FX,
3. mandatory final customer quote authority,
4. removal of the generic quote-`won` bypass for TMS quotes,
5. rate-card branch/revision provenance,
6. provable-only legacy reconstruction,
7. an approvable consolidation derived-version state,
8. currency-aware consolidation allocation.

Until those are remediated, the answer to the central Stage 2 question remains:

> **Yes. The current system can disagree about which economic decision is authoritative.**
