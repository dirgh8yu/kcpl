# KCPL TMS Rating, Pricing & Consolidation Business-Logic Audit

**Audit agent:** Audit Agent 2  
**Repository:** `dirgh8yu/kcpl`  
**Branch audited:** `main`  
**Application code baseline:** `d0f74ea572f3efea0a454a97a4fd339f12ed7e20`  
**Latest main reconciled before report write:** `54626c0016a63332775539bdcd2d431d0eff94cc`  
**Reconciliation note:** commits after the application baseline only added other agents' audit Markdown files; comparison showed no intervening application-code changes in the TMS/rating/pricing/consolidation surface.  
**Method:** static source audit, state-machine tracing, financial-invariant analysis, Firestore race analysis, and review of existing focused tests. No production data was read or mutated. No application code was changed.

## Severity rubric

- **P0:** immediate catastrophic integrity loss, systemic booking/financial corruption, or exploit with severe irreversible impact.
- **P1:** high-severity control bypass or race capable of material financial loss, duplicate execution, cross-branch procurement misuse, or broken master/house reconciliation.
- **P2:** material integrity weakness with narrower preconditions, recoverable operational damage, or a missing invariant likely to become a defect as usage grows.
- **P3:** hardening/test/diagnostic weakness with limited direct impact by itself.

## Executive summary

No P0 was identified in the reviewed code, but the TMS currently has **multiple P1 business-integrity failures**. The central architectural issue is that business-critical Firestore transitions use ordinary reads followed by write batches rather than transactions/version preconditions. A Firestore batch is atomic once committed, but the eligibility decisions preceding it are not. This permits stale-read races around tender creation, load membership, release, approval and booking.

The strongest financial control failures are: ad-hoc pricing overrides can suppress the configured minimum-margin and approval thresholds; the generic quote editor can change a TMS-generated quote's sell price/internal cost after Pricing Desk approval without invalidating approval metadata; carrier counter-offers are immediately bookable and do not invalidate/recalculate customer pricing; and historical pricing is not immutable because each transport order retains only one overwriteable pricing snapshot while the deterministic `TMSSELL-*` quote is updated in place.

The strongest operational failures are: concurrent booking can create duplicate shipment records for the same tender; concurrent consolidation operations can place a house order in two loads or mutate a load after release based on stale draft state; branch-scoped buy cards can be applied to an order from another branch when the operator has access to both branches; and tender creation reuses a selected rate card without revalidating active/date/lane/mode/equipment eligibility.

The master/house financial model also loses procurement truth at consolidation booking. House `selected_cost` / `selected_currency` are replaced with allocated master procurement, while standalone `selected_rate_card_id` / `selected_partner_id` remain. A single house record can therefore identify one procurement source while carrying money from another.

The NRB cross-rate algebra itself is reasonable: midpoint NPR-per-unit values are converted using `buyCurrencyNprPerUnit / sellCurrencyNprPerUnit`. The defect is reproducibility and governance: Pricing Desk persists only a numeric FX rate, dropping provider, NRB rate date, publication/modified timestamp, fetch timestamp, side/midpoint selection and manual-override provenance.

### Finding count

| Severity | Count |
|---|---:|
| P0 | 0 |
| P1 | 14 |
| P2 | 14 |
| P3 | 2 |
| **Total** | **30** |

---

# Findings

## TMS-001 — Ad-hoc pricing overrides can disable margin-floor and approval controls

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/api/admin/pricing/route.ts` (`POST action=calculate`); `app/admin/pricing/tms-pricing.server.ts` (`calculateOrderPricing`); `app/admin/pricing/tms-pricing.ts` (`calculateSellPrice`)
- **Exact flaw:** Pricing-rule creation validates percentages as finite, `>= 0`, and `< 100`, but ad-hoc calculation overrides are not subject to the same bounds. `minimumMarginPercent` and `approvalBelowMarginPercent` are accepted as arbitrary finite numbers. `calculateSellPrice` clamps the minimum margin used for minimum-sell math to zero, while the approval-threshold comparison uses the raw `approval_below_margin_percent`. A caller can submit negative thresholds and obtain a zero-margin price that is treated as not requiring approval.
- **Trigger/reproduction scenario:** A commercial user sends a same-origin `POST /api/admin/pricing` calculate request with `markupPercent: 0`, `minimumMarginPercent: -1`, `approvalBelowMarginPercent: -1`, no discount and a normal positive buy cost. Sell equals cost; minimum sell collapses to cost; `0 < -1` is false, so the pricing result can clear without Management approval.
- **Expected behaviour:** Calculation overrides must obey the same centrally defined governance bounds as stored rules. Users without Management override authority must never lower minimum-margin or approval thresholds below policy.
- **Actual behaviour:** The API/server accepts the negative override and the pure engine converts it into a weaker policy.
- **Financial/operational impact:** Direct margin-control bypass; zero/low-margin customer pricing can be released without required Management approval.
- **Evidence:** `optionalNumber()` passes finite values through; `calculateOrderPricing` assigns overrides directly; only persisted rule creation performs percentage bounds validation; `calculateSellPrice` uses `Math.max(0, input.minimum_margin_percent)` but compares gross margin with raw `input.approval_below_margin_percent`.
- **Recommended fix:** Centralize pricing-policy validation and enforce it for both rule creation and every calculation request. Separate ordinary commercial overrides from explicit Management override objects containing reason, actor, timestamp and immutable audit event.
- **Regression test required:** API/server test proving negative, `>=100`, NaN/Infinity and policy-weakening threshold overrides are rejected; test that a zero-margin sale always requires approval under configured policy.

## TMS-002 — Generic quote editing bypasses the Pricing Desk approval decision

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/api/admin/quotes/[reference]/route.ts` (`PATCH action=commercial`); `app/admin/admin-data.server.ts` (`updateQuoteCommercial`); `app/admin/pricing/tms-pricing.server.ts` (`createQuoteFromOrderPricing`)
- **Exact flaw:** Once `TMSSELL-{order}` is generated from an approved pricing snapshot, the generic quote PATCH path permits any staff member with `canEditCommercial` to replace currency, customer sell amount and internal cost. The service performs a plain Firestore `update()` and does not recompute GP/margin, invalidate `pricing_snapshot_id`, clear approval, or demand Management reapproval.
- **Trigger/reproduction scenario:** Create a low-margin quote that Management approves. Open the standard quote/enquiry editor and reduce `quotedAmount`, increase `internalCost`, or change currency through `action: commercial`.
- **Expected behaviour:** Any commercial mutation that changes the approved economics must create a new pricing version and re-run governance. Approved immutable metadata must either stay bound to the exact values or be invalidated.
- **Actual behaviour:** Quote economics change while `pricing_snapshot_id`, `gross_profit`, `gross_margin_percent`, `approved_by_*` and order pricing status remain stale.
- **Financial/operational impact:** Approved-looking records can contain unapproved economics; audit trail can materially misstate margin and approver intent.
- **Evidence:** `updateQuoteCommercial` updates only `quote_currency`, `quoted_amount`, `internal_cost`, validity/note and `updated_at`; no TMS-specific guard exists.
- **Recommended fix:** Make TMS sell quotes commercial-immutable outside a versioned repricing workflow, or route all changes through the pricing engine and invalidate/reapprove changed decisions.
- **Regression test required:** Generate approved TMS quote, attempt generic commercial PATCH, verify rejection or creation of a new pending pricing version with stale approval removed.

## TMS-003 — Historical pricing snapshots and customer quotes are overwritten rather than versioned

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/pricing/tms-pricing.server.ts` (`calculateOrderPricing`, `createQuoteFromOrderPricing`)
- **Exact flaw:** Each calculation writes a single inline `transport_orders.pricing_snapshot`, replacing the prior snapshot. Customer quote reference is deterministic (`TMSSELL-{order}`) and `batch.set(..., { merge: true })` updates that same quote document on subsequent releases. There is no immutable pricing-snapshot collection or quote version lineage.
- **Trigger/reproduction scenario:** Price, approve and release an order; recalculate with a different rate/FX/discount and release again.
- **Expected behaviour:** Every customer-facing pricing decision must remain permanently reconstructable with immutable version ID, source buy snapshot, FX snapshot, rule snapshot, approval and released quote version.
- **Actual behaviour:** The order retains only the newest pricing snapshot and the quote document is overwritten in place. An older `pricing_snapshot_id` on the quote may no longer correspond to an accessible snapshot after recalculation races/overwrites.
- **Financial/operational impact:** Historical values can silently mutate; disputes, margin audits and customer quote reconstruction are unreliable.
- **Evidence:** `batch.update(record.ref, { pricing_snapshot: snapshot ... })`; deterministic `quoteReference()`; `batch.set(quoteRef, ..., { merge: true })`.
- **Recommended fix:** Store append-only pricing decisions/quote versions in child or top-level collections; keep pointers from order/quote to immutable versions; never overwrite released commercial truth.
- **Regression test required:** Release v1, reprice v2, then prove v1 economics/FX/rule/approval remain retrievable byte-for-byte and the customer-facing versions are distinct.

## TMS-004 — Carrier counter-offers are directly bookable without customer repricing or reapproval

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/tenders/tms-tendering.ts` (`tenderCanBook`, `tenderFinalCommercials`); `app/admin/tenders/tms-tendering.server.ts` (`respondToTmsTender`, `confirmTmsTenderBooking`); `app/admin/pricing/tms-pricing.server.ts` (`orderCandidateFromData`)
- **Exact flaw:** `tenderCanBook` explicitly treats `countered` as bookable. Pricing Desk continues to read `transport_orders.selected_cost` / `selected_currency`, which remain the originally offered procurement economics until booking. A higher or differently denominated carrier counter therefore does not invalidate an existing pricing snapshot or quote.
- **Trigger/reproduction scenario:** Select buy cost USD 1,000; price/approve customer sell against 1,000; carrier counters at USD 1,400 (or another currency); book directly from `countered`.
- **Expected behaviour:** Any procurement counter that differs from the approved buy snapshot must invalidate downstream sell pricing and require recalculation/reapproval before booking/release.
- **Actual behaviour:** Booking uses counter commercials and only then overwrites order selected cost/currency. Existing customer pricing/quote can remain based on old lower cost.
- **Financial/operational impact:** Margin can collapse or become negative after the customer quote has been approved/released.
- **Evidence:** `tenderCanBook(status) => accepted || countered`; `tenderFinalCommercials` returns counter amount/currency; pricing candidate reads order selected values, not tender counter values.
- **Recommended fix:** Introduce explicit counter acceptance plus procurement-version change event; invalidate pricing whenever final procurement differs from the pricing snapshot's procurement version; block booking until commercial reconciliation passes.
- **Regression test required:** Counter a tender above approved cost and assert booking is blocked until a new sell-pricing snapshot is approved/released.

## TMS-005 — Concurrent booking can create duplicate shipments for one tender/order

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/tenders/tms-tendering.server.ts` (`confirmTmsTenderBooking`, `createBookedShipment`)
- **Exact flaw:** Booking eligibility is checked using ordinary reads. The later write batch creates a newly randomized shipment reference. Two concurrent requests can both read an accepted/countered tender and non-booked order, generate different shipment IDs, and both successfully `create()` their unique shipment documents while last-writer-wins on the shared order/tender pointers.
- **Trigger/reproduction scenario:** Two users or retries submit confirm booking at nearly the same time with the same tender and booking reference.
- **Expected behaviour:** Booking must be idempotent and exactly-once per tender/order, enforced transactionally.
- **Actual behaviour:** Both batches can succeed because they conflict only on updates, not on a shared uniquely-created booking guard. Duplicate shipments/workflow tasks/events can exist; only one is referenced by the final order/tender state.
- **Financial/operational impact:** Duplicate operational jobs, duplicated customs/document workflow, possible duplicate carrier execution and customer communication.
- **Evidence:** No repository `runTransaction` usage was found; `shipmentReference()` is random; state reads occur before batch commit.
- **Recommended fix:** Use Firestore transaction/CAS on tender+order with an immutable booking idempotency key; create shipment under a deterministic guard or unique booking record.
- **Regression test required:** Two parallel booking calls for one accepted tender; exactly one shipment set must exist and the other call must return the first result idempotently.

## TMS-006 — Concurrent load creation/add can assign one house order to multiple consolidation loads

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/consolidation/tms-consolidation.server.ts` (`createConsolidationLoad`, `addOrderToConsolidationLoad`); `app/admin/consolidation/tms-consolidation.ts` (`orderEligibleForConsolidation`)
- **Exact flaw:** House eligibility (`!consolidation_load_id`) is evaluated before a non-transactional batch. Two load operations can both read the same unassigned house and commit membership into different load documents. Both update the house pointer; the final house points to only the last writer while both loads retain the member.
- **Trigger/reproduction scenario:** Two planners simultaneously create/add ORD-X to LOAD-A and LOAD-B.
- **Expected behaviour:** A non-master order may belong to at most one active consolidation load, enforced atomically.
- **Actual behaviour:** Both loads can contain ORD-X while `ORD-X.consolidation_load_id` identifies only one.
- **Financial/operational impact:** Same cargo can be planned/released/tendered twice; master/house reconciliation becomes ambiguous.
- **Evidence:** ordinary `getOrder/loadOrders` followed by `batch.update(record.ref)` and `batch.update(order.ref)`; no transaction/precondition.
- **Recommended fix:** Transactionally claim the house with expected `consolidation_load_id == null` and expected order version/status; optionally maintain a deterministic active-membership document keyed by order ID.
- **Regression test required:** Parallel adds to two loads must yield one success and one conflict, with all load/order pointers consistent.

## TMS-007 — Draft add/remove/release races can mutate a load after release and unlock released houses

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/consolidation/tms-consolidation.server.ts` (`addOrderToConsolidationLoad`, `removeOrderFromConsolidationLoad`, `releaseConsolidationToProcurement`, `reorderConsolidationStops`, `updateConsolidationStop`)
- **Exact flaw:** Each operation reads `status === draft` before a later update/batch. There is no transaction asserting the status/version remains draft at commit.
- **Trigger/reproduction scenario:** Request A starts release using members A/B/C. Request B simultaneously removes C after reading draft. A creates/locks a master based on A/B/C; B then commits a draft-derived load snapshot without C and clears C's load/lock fields. Reverse ordering can similarly append a house after release.
- **Expected behaviour:** Release is a linearization point. Once released, membership/stops/equipment/capacity are immutable unless a controlled rollback transaction occurs.
- **Actual behaviour:** Stale draft writers can overwrite released-state membership/stop data or house lock state.
- **Financial/operational impact:** Released master and house list diverge; cargo may be omitted, duplicated or unlocked for separate procurement.
- **Evidence:** status checks precede ordinary `batch.update`/`ref.update`; no version or transaction guard.
- **Recommended fix:** Version every load; execute add/remove/reorder/release in transactions requiring expected version/status; increment version on every mutation.
- **Regression test required:** Barrier-controlled races of release vs add/remove/reorder/update-stop must leave either fully pre-release or fully released state, never a hybrid.

## TMS-008 — Branch-specific partner buy rates can be used on orders from another branch

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/rating/tms-rating.server.ts` (`listPartnerBuyRateCards`, `selectTmsRate`); `app/admin/rating/tms-rating.ts` (`calculateRating`)
- **Exact flaw:** Buy-card visibility is filtered by the operator's branch access, but rating compatibility never requires `card.branch === order.branch` (unless card is Global). A user authorized for multiple branches can apply Branch B procurement to a Branch A order.
- **Trigger/reproduction scenario:** Multi-branch/Management user opens Kathmandu order; a Birgunj-only card shares lane/mode and is visible; matcher returns it and selection succeeds.
- **Expected behaviour:** Non-Global card branch must equal order branch, independent of who is using the UI.
- **Actual behaviour:** User authorization is incorrectly used as a substitute for data-scope compatibility.
- **Financial/operational impact:** Wrong local procurement commitments, branch P&L leakage, invalid partner terms and audit attribution.
- **Evidence:** `canAccessRateCard` checks staff access; `calculateRating` checks mode/lane/equipment/date but not branch.
- **Recommended fix:** Add branch compatibility to core rating invariant and revalidate again at selection/tender.
- **Regression test required:** Multi-branch user must not see/select Branch B-only rate for Branch A order; Global card remains eligible.

## TMS-009 — Tendering does not revalidate selected rate-card validity or terms

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/tenders/tms-tendering.server.ts` (`createTmsTender`); `app/admin/rating/tms-rating.ts` (`calculateRating`, `rateCardIsValidOn`)
- **Exact flaw:** Tender creation reloads the selected rate-card document but validates only existence and matching partner ID. It does not require `active`, effective date, lane, mode, equipment, branch, or recomputed amount to still match.
- **Trigger/reproduction scenario:** Select a valid rate; manager archives/edits/expires it or changes rate/equipment; user later creates tender from stale order selection.
- **Expected behaviour:** Tender creation must verify the immutable selected procurement snapshot or re-run all rate-card eligibility/amount checks against the exact selected version.
- **Actual behaviour:** A stale/expired/archived/incompatible rate is tenderable as long as the document still exists and partner ID matches.
- **Financial/operational impact:** Carrier tender can be sent on commercially invalid or obsolete terms.
- **Evidence:** `createTmsTender` reads `partner_rate_cards/{rateCardId}` then checks only `exists` and `partner_id` equality before using order's cached `selected_cost/currency`.
- **Recommended fix:** Snapshot rate-card version/terms at selection; bind tender to that snapshot, or transactionally re-rate/revalidate and reject if source version changed.
- **Regression test required:** Archive, expire, edit lane/equipment/rate/branch after selection; tender creation must fail or require reselection.

## TMS-010 — Consolidation booking leaves house procurement IDs inconsistent with allocated procurement money

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/consolidation/tms-consolidation.server.ts` (`confirmConsolidatedLoadBooking`)
- **Exact flaw:** Booking replaces each house order's `selected_cost` and `selected_currency` with its allocation from master procurement, but does not replace/clear the house's original standalone `selected_rate_card_id` and `selected_partner_id`.
- **Trigger/reproduction scenario:** House was independently selected against Partner A / BUY-A; master load books Partner B / BUY-B. House gets allocated Partner B master cost but still identifies Partner A / BUY-A in selected procurement fields.
- **Expected behaviour:** Procurement identity and monetary fields must refer to the same immutable procurement decision. House should explicitly distinguish `standalone_baseline_*` from `allocated_master_procurement_*`.
- **Actual behaviour:** IDs and money describe different procurement truths.
- **Financial/operational impact:** Incorrect partner attribution, unreliable cost audit, possible invoice/match-pay errors and misleading margin analysis.
- **Evidence:** house `batch.update(item.ref, ...)` changes `selected_cost`, `selected_currency`, allocation fields, status and shipment reference only; shipment itself uses master tender partner/rate card.
- **Recommended fix:** Never overload `selected_*` with two meanings. Preserve standalone baseline in immutable fields and write explicit allocated master procurement linkage/IDs/version.
- **Regression test required:** Consolidate houses selected from different partners and verify every post-booking procurement field reconciles to either immutable standalone baseline or master allocation, never mixed semantics.

## TMS-011 — Pricing approval and quote release are vulnerable to stale-snapshot races

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/pricing/tms-pricing.server.ts` (`calculateOrderPricing`, `approveOrderPricing`, `createQuoteFromOrderPricing`); `app/api/admin/pricing/route.ts`
- **Exact flaw:** Approval and quote release identify only `orderId`; the caller supplies no expected pricing-snapshot ID/version. Server reads the current snapshot and later writes with a batch but no conditional precondition. Concurrent calculate/approve/release calls can overwrite each other's state.
- **Trigger/reproduction scenario:** A pricing recalculation creates new pending snapshot B while Management is approving snapshot A. Depending commit order, A can overwrite B as approved, or quote creation can release A while the order holds B yet `pricing_status` becomes quoted.
- **Expected behaviour:** Approve/release must target an explicit immutable snapshot ID and atomically assert it remains the current snapshot and its procurement/customer/rule inputs have not changed.
- **Actual behaviour:** Last writer can resurrect stale approved economics or produce status/snapshot/quote mismatch.
- **Financial/operational impact:** Low-margin/stale price can be approved/released after a newer decision exists.
- **Evidence:** API approve/create_quote pass only `orderId`; server uses ordinary `getOrder()` then batch update; no `runTransaction` found.
- **Recommended fix:** Append-only snapshot IDs plus transaction/CAS (`current_pricing_snapshot_id == requestedSnapshotId`); invalidate approval on any upstream version change.
- **Regression test required:** Parallel calculate vs approve and calculate vs create_quote with barriers; stale operation must return conflict and never alter newer state.

## TMS-012 — Transport orders can progress into procurement with nonexistent customers and strand at booking

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/api/admin/rating/route.ts` (`create_order`); `app/admin/rating/tms-rating.server.ts` (`createTmsOrder`); `app/admin/tenders/tms-tendering.server.ts` (`createTmsTender`, `createBookedShipment`); `app/admin/consolidation/tms-consolidation.server.ts` (`releaseConsolidationToProcurement`, `confirmConsolidatedLoadBooking`)
- **Exact flaw:** Order creation stores arbitrary `customer_id`/name without checking the customer exists or branch alignment. Individual tender creation does not require a valid customer. Booking finally requires an existing non-archived customer. Consolidation release requires only nonempty customer IDs; actual existence is checked at booking.
- **Trigger/reproduction scenario:** Create order with typo/nonexistent `customerId`; select rate; tender/accept; booking fails `customer_missing`. For consolidation, release master with bogus nonempty house customer ID then fail later.
- **Expected behaviour:** A transport order should not enter committed procurement/tendering without a valid branch-compatible customer link when downstream shipment/customer creation requires one.
- **Actual behaviour:** Invalid linkage is detected late, after procurement activity.
- **Financial/operational impact:** Accepted tenders or released loads become stranded and require manual data repair; external carrier commitment can exist without bookable internal shipment.
- **Evidence:** `createTmsOrder` writes cleaned ID directly; `createTmsTender` has no customer fetch; `createBookedShipment` finally checks customer document.
- **Recommended fix:** Establish a customer-link invariant before tender/release, with controlled draft-only unlinked state if needed.
- **Regression test required:** Missing/archived/cross-branch customer may remain draft if product allows, but selection-to-tender/release must be blocked before external procurement is sent.

## TMS-013 — Concurrent tender creation can create two active tenders; stale tender actions can roll order state backward

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/tenders/tms-tendering.server.ts` (`activeTenderForOrder`, `createTmsTender`, `respondToTmsTender`, `cancelTmsTender`)
- **Exact flaw:** `activeTenderForOrder` is a query/read outside a transaction. Two creators can both observe no active tender and create different tender docs. Order `active_tender_id` becomes last-writer-wins. Later rejection/cancel/expiry of the stale tender sets the shared order back to `selected` and clears `active_tender_id` without proving that tender is still active for the order.
- **Trigger/reproduction scenario:** Two concurrent tender creates T1/T2. T2 wins order pointer. User rejects T1; handler writes order status `selected`, clearing the pointer to still-live T2.
- **Expected behaviour:** Exactly one active tender per order, and every tender response/state rollback must conditionally match `order.active_tender_id`.
- **Actual behaviour:** Duplicate active tender docs and improper status rollback are possible.
- **Financial/operational impact:** Multiple carriers can be engaged; live tender becomes orphaned; booking/status workflow can strand.
- **Evidence:** query then create batch; reject/cancel/expired paths update order unconditionally.
- **Recommended fix:** Transactional active-tender slot keyed by order; CAS on `active_tender_id` for every response/cancel/expiry transition.
- **Regression test required:** Parallel creates and stale reject/cancel/expiry must preserve the legitimately active tender and order state.

## TMS-014 — Orders can be repriced and customer quotes recreated after tendering/booked state

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/pricing/tms-pricing.server.ts` (`calculateOrderPricing`, `createQuoteFromOrderPricing`)
- **Exact flaw:** `calculateOrderPricing` locks only `cancelled` status. Tendering and booked orders remain priceable because `orderCandidateFromData` accepts any valid order status. Quote release similarly has no operational-state lock.
- **Trigger/reproduction scenario:** Book shipment, then recalculate Pricing Desk economics against the order's current selected cost and generate/overwrite the deterministic customer quote.
- **Expected behaviour:** Released/booked historical commercial truth must be locked. Post-booking changes require explicit amendment/credit/requote versioning, not mutation of original decision.
- **Actual behaviour:** Pricing snapshot and customer quote can mutate after operational commitment.
- **Financial/operational impact:** Historical margin/reporting and customer commitment can diverge from what existed at booking.
- **Evidence:** `if (["cancelled"].includes(record.order.status)) return locked`; no tendering/booked guard in calculate or create quote.
- **Recommended fix:** Define an explicit commercial state machine and immutable amendment workflow once tender/quote/booking milestones are crossed.
- **Regression test required:** Tendering/booked order cannot overwrite original pricing/quote; amendment creates a new version with linkage and approval.

## TMS-015 — Customer sell-rate cards are disconnected from TMS sell pricing and lack supported dimensions

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/crm/crm-rate-cards.ts`; `app/admin/crm/crm-rate-cards.server.ts`; `app/admin/pricing/tms-pricing.server.ts`; `app/admin/pricing/tms-pricing.ts`
- **Exact flaw:** CRM customer sell cards are stored in `customers/{id}/rate_cards`, but TMS Pricing Desk resolves `pricing_rules` plus `customer.markup_percent`; it does not resolve or compare stored customer sell cards. CRM rate-card modes omit `rail` and `courier`; CRM units omit `per_piece` (TMS buy rating supports all requested modes/units).
- **Trigger/reproduction scenario:** Customer has an active contractual Kathmandu→X sell card. Operator prices same lane through Pricing Desk using markup/rule, generating a different sell value with no warning or contract-card selection.
- **Expected behaviour:** If customer sell cards are commercial truth, TMS must resolve the applicable card, snapshot it, or explicitly require an override with approval. Supported modes/units should match platform scope.
- **Actual behaviour:** Parallel pricing systems can silently disagree.
- **Financial/operational impact:** Customer can be over/undercharged relative to agreed card; contractual pricing is not enforced.
- **Evidence:** CRM rate-card CRUD has no TMS pricing integration; pricing server loads customers/pricing rules only; mode/unit enum mismatch is explicit.
- **Recommended fix:** Define authoritative sell-pricing precedence and integrate/version customer cards; add rail/courier/per-piece coverage if these are valid KCPL commercial products.
- **Regression test required:** Matching customer card must deterministically govern/flag TMS sell calculation across every supported mode and unit; explicit override must be audited/approved.

## TMS-016 — Consolidation allocation can assign zero procurement to a nonzero house

- **Severity:** P1
- **Confidence:** High
- **Files/functions:** `app/admin/consolidation/tms-consolidation.ts` (`allocationBasis`, `allocateProcurementCost`)
- **Exact flaw:** Allocation chooses one basis for the entire load: aggregate weight if any total weight is positive, otherwise CBM, then pieces, then equal. If one house has zero/missing weight but nonzero volume/pieces while a sibling has weight, that house receives zero allocation (unless it happens to be the last remainder absorber).
- **Trigger/reproduction scenario:** House A weight 1,000 kg; House B weight 0 kg but 10 CBM; master cost 1,000. Weight basis is selected and B's computed share is zero.
- **Expected behaviour:** Every economically participating house must receive a defensible allocation using validated complete basis data or a declared fallback/allocation policy. Missing basis should block, not silently zero-charge.
- **Actual behaviour:** Mixed data completeness can shift cost entirely to other houses.
- **Financial/operational impact:** House margins/customer profitability and cost recovery become materially wrong.
- **Evidence:** `allocationBasis` picks weight whenever aggregate weight > 0; per-house value uses `Math.max(0, order.weight_kg)`.
- **Recommended fix:** Require complete chosen-basis data for every house, or use explicit configurable hybrid/equal fallback with audit metadata.
- **Regression test required:** A positive-volume zero-weight member in a weighted load cannot receive zero silently; incomplete allocation basis must block or use declared fallback.

## TMS-017 — Selected procurement is not an immutable reproducible snapshot

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/admin/rating/tms-rating.server.ts` (`selectTmsRate`); `app/admin/rating/tms-rating.ts` (`RatingResult`)
- **Exact flaw:** Order selection persists only `selected_rate_card_id`, `selected_partner_id`, `selected_cost`, `selected_currency`. The full calculation inputs/result (unit, quantity, base rate, minimum, fuel, accessorial, validity, equipment/service, source card updated_at/version) are not frozen on the order in an immutable procurement snapshot.
- **Trigger/reproduction scenario:** Select rate, then edit the source card. Later audit sees card ID but current card terms no longer recreate selected total.
- **Expected behaviour:** Exact procurement decision should be historically reproducible even if source card changes/archives.
- **Actual behaviour:** Order references mutable source plus cached total.
- **Financial/operational impact:** Cannot prove why a carrier was selected or reconcile historical buy amount from current data.
- **Evidence:** `selectTmsRate` update contains only ID/partner/total/currency.
- **Recommended fix:** Append immutable selected-rate snapshot containing normalized lane/mode/equipment, rate unit/quantity, linehaul/min/fuel/accessorial, effective dates, card version/hash and actor/time.
- **Regression test required:** Edit/archive source card after selection and prove historical procurement snapshot remains fully reproducible.

## TMS-018 — FX decisions are not historically reproducible despite rich NRB source metadata

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/integrations/nrb-forex.server.ts`; `app/admin/pricing/tms-pricing.ts` (`deriveNrbMidpointFxRate`); `app/admin/pricing/tms-pricing-workspace.tsx` (`ensureFx`, `calculate`); `app/admin/pricing/tms-pricing.server.ts`
- **Exact flaw:** NRB response contains provider, source, rate date, publication/modified timestamps, fetched timestamp and buy/sell/midpoint values. UI derives midpoint cross-rate and labels source/date locally, but POST sends only numeric `fxRate`. Pricing snapshot stores only the number. Manual override is allowed and becomes indistinguishable in persisted pricing from NRB-derived FX.
- **Trigger/reproduction scenario:** Quote USD→NPR using NRB today, or manually enter same/different rate; inspect historical pricing later.
- **Expected behaviour:** Snapshot must record source type, provider, NRB rate date, published/modified/fetched timestamps, side/midpoint policy, raw component rates, derived cross-rate, and manual override reason/actor.
- **Actual behaviour:** Only `fx_rate` survives.
- **Financial/operational impact:** FX gain/loss, customer dispute and quote recreation cannot prove source or freshness; hidden manual FX is possible.
- **Evidence:** workspace `fxSource` is client state; calculate body sends `fxRate`; `PricingInput` has numeric `fx_rate` only.
- **Recommended fix:** Server should derive/snapshot trusted NRB FX where used; manual FX should be a separately typed override with reason and approval policy.
- **Regression test required:** NRB and manual FX snapshots must preserve distinct provenance and reproduce exact historical sell result after NRB changes.

## TMS-019 — Multimodal and equipment matching are overly permissive

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/admin/rating/tms-rating.ts` (`calculateRating`)
- **Exact flaw:** Any card whose mode is `multimodal` matches every single-mode order because condition rejects only when modes differ **and** card mode is not multimodal. Equipment mismatch is checked only when both order and card specify equipment, making missing values wildcards in both directions.
- **Trigger/reproduction scenario:** Apply a multimodal end-to-end rate card to a road-only order, or apply a specialized 40HC card to an order with no equipment requirement / a generic no-equipment card to a 40HC-required order.
- **Expected behaviour:** Multimodal compatibility must be explicit and route/service scoped; equipment-required products must use typed compatibility rather than nullable symmetric wildcard.
- **Actual behaviour:** Semantically incompatible cards can enter result set and be selected.
- **Financial/operational impact:** Wrong carrier/service/equipment cost and impossible execution plan.
- **Evidence:** `if (order.mode !== card.mode && card.mode !== "multimodal") return null;`; equipment check only if both fields truthy.
- **Recommended fix:** Define directional compatibility matrix; require equipment match where either side imposes a constraint.
- **Regression test required:** Single-mode order vs multimodal card and generic/specialized equipment permutations.

## TMS-020 — Rate-card/order dates are weakly validated and malformed values can alter eligibility

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/api/admin/rating/route.ts`; `app/admin/rating/tms-rating.server.ts` (`validDate`, `createPartnerBuyRateCard`, `createTmsOrder`); `app/admin/rating/tms-rating.ts` (`rateCardIsValidOn`); `app/admin/pricing/tms-pricing.server.ts` (`createQuoteFromOrderPricing`)
- **Exact flaw:** Rating API accepts pickup/delivery/rate validity strings with no calendar-date validation. `validDate` tests only `YYYY-MM-DD` regex; nonmatching persisted values deserialize to null, while impossible calendar strings such as `2026-99-99` pass regex. There is no `validFrom <= validUntil`, pickup<=delivery or tender-date revalidation. Pricing quote creation likewise checks validity with regex only.
- **Trigger/reproduction scenario:** Create card with malformed date or reversed validity range; create order with malformed pickup date. A nonmatching pickup becomes null and rating uses current time; malformed bounds can compare lexicographically in unintended ways.
- **Expected behaviour:** Strict calendar validation and ordered date-range invariants at write time; exact service date basis snapshotted.
- **Actual behaviour:** Invalid dates can fail open or behave unpredictably.
- **Financial/operational impact:** Expired/future rates may qualify or valid rates may disappear; quote validity may be nonsensical.
- **Evidence:** route passes strings directly; server `validDate` is regex only; `calculateRating` falls back to `new Date()` when pickup date is null.
- **Recommended fix:** Shared strict date parser and range validation; reject, never coerce malformed business dates.
- **Regression test required:** invalid calendar dates, reversed ranges, missing pickup policy and boundary dates.

## TMS-021 — Zero and malformed financial inputs can silently become valid procurement

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/api/admin/rating/route.ts` (`num`); `app/admin/rating/tms-rating.server.ts` (`createPartnerBuyRateCard`, deserializers); `app/admin/rating/tms-rating.ts` (`ratingQuantity`, `calculateRating`); `app/admin/pricing/tms-pricing.ts`
- **Exact flaw:** API `num()` converts absent/non-finite values to zero. Buy-rate creation rejects only `rate < 0`, so zero rates are legal. Several deserializers/calculators clamp negative fuel/accessorial/quantity values to zero rather than surfacing data corruption. A flat/per-shipment zero-cost card can be selected and tendered.
- **Trigger/reproduction scenario:** Submit missing/invalid rate field through a crafted request so `num()` becomes 0; card is created; rate a flat order and select/tender zero procurement.
- **Expected behaviour:** Required financial fields must reject missing/non-numeric/zero where zero is not a deliberate authorized free-service value; corrupted persisted values must not be silently normalized.
- **Actual behaviour:** Data-quality errors can transform into apparently valid zero economics.
- **Financial/operational impact:** Understated procurement and sell pricing, distorted savings/margins.
- **Evidence:** `num()` fallback 0; `input.rate < 0` check permits zero; widespread `Math.max(0, ...)` normalization.
- **Recommended fix:** Validate raw request presence/type/ranges before conversion; model deliberate zero-rate exception explicitly with reason/approval.
- **Regression test required:** missing, string-garbage, negative and zero buy/fuel/accessorial/minimum/quantity cases.

## TMS-022 — Duplicate/overlapping buy and sell rate cards have no conflict invariant

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/admin/rating/tms-rating.server.ts` (`createPartnerBuyRateCard`); `app/admin/crm/crm-rate-cards.server.ts` (`createCrmRateCard`, `updateCrmRateCard`)
- **Exact flaw:** New partner/customer cards are created under random IDs without detecting same customer/partner, branch, lane, mode, equipment/service, unit, currency and overlapping validity periods. There is no priority/version/supersession field defining deterministic commercial precedence.
- **Trigger/reproduction scenario:** Create two active cards for same dimensions and overlapping dates with different prices.
- **Expected behaviour:** Conflicting active cards should be rejected or governed by explicit version/priority/supersession rules.
- **Actual behaviour:** Multiple simultaneously authoritative cards can coexist. Buy rating simply returns them; sell cards are not resolved by TMS at all.
- **Financial/operational impact:** Operator choice becomes accidental; stale or wrong price can be selected.
- **Evidence:** CRUD always generates new ID and writes; no overlap query/check in reviewed functions.
- **Recommended fix:** Canonical card key + effective dating/versioning and overlap validation.
- **Regression test required:** exact duplicate, partial overlap, adjacent non-overlap, archived replacement and priority/supersession cases.

## TMS-023 — Release does not re-run full consolidation compatibility or membership ownership

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/admin/consolidation/tms-consolidation.server.ts` (`releaseConsolidationToProcurement`); `app/admin/consolidation/tms-consolidation.ts` (`assessLoadCompatibility`)
- **Exact flaw:** Creation/add calls `assessLoadCompatibility`, but release only checks member count, stop precedence, customer presence and capacity. It does not re-check same branch, mode compatibility, equipment/temp conflicts, eligibility, or verify each live order still has `consolidation_load_id === current load.id`.
- **Trigger/reproduction scenario:** Compatibility becomes stale through concurrent load assignment or any future/edit path; release proceeds from load's member list despite ownership mismatch.
- **Expected behaviour:** Release must validate all live invariants immediately before atomic lock/master creation.
- **Actual behaviour:** Only a subset is revalidated.
- **Financial/operational impact:** Incompatible or no-longer-owned houses can be locked into a master.
- **Evidence:** release calls `capacityViolations` and `validateStopPrecedence`, not `assessLoadCompatibility`, and contains no ownership equality check.
- **Recommended fix:** Recompute full compatibility from live house docs inside the same transaction that releases/locks them.
- **Regression test required:** stale branch/mode/equipment/temp/load-owner mutation must block release.

## TMS-024 — Operator-selected load equipment is not validated against house requirements

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/admin/consolidation/tms-consolidation.server.ts` (`createConsolidationLoad`); `app/admin/consolidation/tms-consolidation.ts` (`assessLoadCompatibility`)
- **Exact flaw:** Compatibility checks only whether house orders conflict with one another. `input.equipment` is written onto the load/master but is not passed into compatibility. A planner can choose equipment incompatible with the unanimous house requirement.
- **Trigger/reproduction scenario:** All houses require `40HC`; create load while explicitly entering `20GP`.
- **Expected behaviour:** Declared load equipment must satisfy every member requirement and typed capacity constraints.
- **Actual behaviour:** Load accepts `20GP`; master procurement order inherits it.
- **Financial/operational impact:** Impossible tender/equipment plan, rebooking cost and delays.
- **Evidence:** `assessLoadCompatibility(orders, input.mode, capacity)` has no load-equipment parameter; document later uses `input.equipment` preferentially.
- **Recommended fix:** Add equipment compatibility matrix and validate selected load equipment at create/add/release/tender.
- **Regression test required:** incompatible explicit equipment must be rejected at every transition.

## TMS-025 — Multimodal consolidation has no route-continuity/network invariant

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/admin/consolidation/tms-consolidation.ts` (`assessLoadCompatibility`, `buildDefaultStops`); `app/admin/consolidation/tms-consolidation.server.ts` (`releaseConsolidationToProcurement`)
- **Exact flaw:** `requestedMode === multimodal` permits arbitrary mixtures of house modes. Compatibility does not establish that legs form one executable route, share hubs, have compatible pickup/delivery geography, or represent intended master/house movement. Default stops simply group all origins first then all destinations.
- **Trigger/reproduction scenario:** Combine unrelated air/road/sea orders with different lanes into one multimodal load; release creates a master whose origin is first stop and destination is last stop.
- **Expected behaviour:** Multimodal master must have an explicit leg/network plan with continuity and custody handoffs; consolidation should join compatible freight, not merely mixed modes.
- **Actual behaviour:** Mode mixture is allowed without leg topology.
- **Financial/operational impact:** Nonsensical master tender, missed stops and cost/capacity assumptions unrelated to actual routing.
- **Evidence:** only single-mode loads enforce exact mode; multimodal branch emits at most a warning when all houses are one mode; no route graph validation exists.
- **Recommended fix:** Model multimodal legs explicitly and validate each house's pickup-to-delivery path through ordered legs/hubs.
- **Regression test required:** disconnected lane combinations must fail; valid connected multimodal legs must pass.

## TMS-026 — Stop precedence ignores planned timestamps

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/admin/consolidation/tms-consolidation.ts` (`validateStopPrecedence`); `app/admin/consolidation/tms-consolidation.server.ts` (`updateConsolidationStop`)
- **Exact flaw:** Precedence validates only numeric stop sequence. `planned_at` is independently parsed/stored and is not checked for monotonicity or pickup-before-delivery time for each house.
- **Trigger/reproduction scenario:** Keep pickup sequence 1, delivery sequence 2, but set delivery timestamp 09:00 and pickup timestamp 12:00 same day.
- **Expected behaviour:** Both sequence and planned time must satisfy pickup before downstream hub/customs/delivery, with timezone-normalized timestamps.
- **Actual behaviour:** Load is releasable despite chronologically impossible plan.
- **Financial/operational impact:** Invalid dispatch schedule and misleading ETA/operations plan.
- **Evidence:** `validateStopPrecedence` reads only `sequence`; `updateConsolidationStop` validates parsability only.
- **Recommended fix:** Add temporal route validator covering all stops/order paths and disallow contradictory times before release.
- **Regression test required:** delivery before pickup in time must fail even when sequence is correct.

## TMS-027 — Allocation always uses two-decimal cents, including JPY

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/admin/consolidation/tms-consolidation.ts` (`allocateProcurementCost`); `app/admin/consolidation/tms-consolidation.server.ts` (`confirmConsolidatedLoadBooking`)
- **Exact flaw:** Allocation converts every total to `Math.round(totalCost * 100)` cents and returns `/100` regardless of currency. Pricing code correctly treats JPY as zero-decimal, but consolidation allocation has no currency parameter and can create fractional JPY house costs.
- **Trigger/reproduction scenario:** Book JPY 100 across three houses.
- **Expected behaviour:** Monetary minor units must be currency-aware; JPY allocations should be integers and residual handling explicit.
- **Actual behaviour:** Fractions such as JPY 33.33 can be stored as procurement cost.
- **Financial/operational impact:** Non-settleable amounts, ledger mismatch and rounding noise across house/master reconciliation.
- **Evidence:** hard-coded `*100`/`/100`; allocator signature has no currency.
- **Recommended fix:** Currency minor-unit utility shared with pricing; allocate integer minor units and record rounding residual policy.
- **Regression test required:** exact-sum allocation for JPY (0 decimals) and two-decimal currencies, including uneven splits.

## TMS-028 — Consolidation savings and allocation can be based on stale house snapshots

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/admin/consolidation/tms-consolidation.server.ts` (`memberFromOrder`, create/add/release/booking); `app/admin/consolidation/tms-consolidation.ts` (`selectedCostBaselines`, `consolidationSavings`, `allocateProcurementCost`)
- **Exact flaw:** Load members snapshot weight/CBM/pieces and prior selected cost/currency at create/add. While load is still draft, house rate selection is not consolidation-locked. Re-selecting a house does not refresh member baseline. Booking allocation uses `record.load.members`, not freshly rebuilt live dimensions. Savings therefore can compare against old buy costs and allocation can use old basis.
- **Trigger/reproduction scenario:** Add selected house at USD 1,000 to draft load; re-select house at USD 1,500; release/book master. Savings baseline still reports 1,000. Similar stale dimensions affect allocation.
- **Expected behaviour:** Snapshot purpose must be explicit: immutable baseline at a documented milestone, or live values refreshed and version-checked. Release should freeze the definitive baseline.
- **Actual behaviour:** Snapshot is taken opportunistically at membership time and reused later without staleness check.
- **Financial/operational impact:** Consolidation savings can be overstated/understated and house allocations can be wrong.
- **Evidence:** `memberFromOrder` copies prior values; rate selection only updates order; release does not refresh member snapshots; booking allocator receives load members.
- **Recommended fix:** Freeze baseline at release from transactionally read live houses and store source versions; use explicit allocation-basis snapshot from that milestone.
- **Regression test required:** Re-rate/change dimensions before release; baseline/allocation must either refresh deterministically or release must reject stale member version.

## TMS-029 — Customer active-shipment counters lose updates under concurrent bookings

- **Severity:** P2
- **Confidence:** High
- **Files/functions:** `app/admin/tenders/tms-tendering.server.ts` (`createBookedShipment`); `app/admin/consolidation/tms-consolidation.server.ts` (`confirmConsolidatedLoadBooking`)
- **Exact flaw:** Both booking paths read `active_shipment_count`, compute an absolute new number in application code, and batch-update it. Concurrent bookings for the same customer can read the same starting value and overwrite each other.
- **Trigger/reproduction scenario:** Customer count 10; two independent shipments book concurrently; each writes 11 instead of final 12.
- **Expected behaviour:** Counter updates must be atomic increments or derived from authoritative shipment data.
- **Actual behaviour:** lost update is possible.
- **Financial/operational impact:** CRM workload/status metrics drift from actual shipments; downstream automation depending on count can be wrong.
- **Evidence:** `currentActive + 1` / `currentActive + increment` absolute updates rather than `FieldValue.increment` or transaction.
- **Recommended fix:** Atomic increment, or eliminate mutable counter in favor of trustworthy aggregate/index.
- **Regression test required:** Parallel bookings for same customer must increase count exactly by number of created shipments.

## TMS-030 — Rating can mark an order `rated` even when no valid rates exist

- **Severity:** P3
- **Confidence:** High
- **Files/functions:** `app/admin/rating/tms-rating.server.ts` (`rateTmsOrder`)
- **Exact flaw:** `rateTmsOrder` computes results and unconditionally changes a non-selected order to `rated`, even if result list is empty.
- **Trigger/reproduction scenario:** Rate an order with no matching cards.
- **Expected behaviour:** State should distinguish `no_rate_found` / remain draft, or `rated` must semantically mean a successful rating set exists.
- **Actual behaviour:** Empty result still advances status to rated.
- **Financial/operational impact:** Misleading state and dashboards; automation may interpret rated as procurement-ready.
- **Evidence:** status update occurs after `rateOrder` without `results.length` guard.
- **Recommended fix:** Define state semantics and only advance on successful valid result set, or add explicit no-rate state/event.
- **Regression test required:** no matching rates must not produce procurement-ready/rated semantic state.

---

# Additional missing invariants

These should be made explicit even where the current UI makes a race/edit path less obvious:

1. **Order version invariant:** every business mutation carries/compares an `order_version` or Firestore update-time precondition.
2. **Exactly-one active tender:** an order has one transactional active-tender slot; stale tender events cannot change order state.
3. **Exactly-once booking:** one tender/order or consolidation load maps to one immutable booking result/idempotency key.
4. **Exactly-one active consolidation membership:** a house order belongs to at most one non-cancelled load.
5. **Release linearization:** load membership, stop plan, capacity, equipment, compatibility and house versions are frozen atomically when released.
6. **Procurement/sell version binding:** a sell pricing snapshot identifies immutable procurement snapshot ID/version, customer/version, rule/version and FX snapshot.
7. **Procurement-change invalidation:** any accepted counter, re-rate, allocation or currency change invalidates downstream pricing approval/quote until reconciled.
8. **Commercial immutability after release/booking:** edits occur only as append-only amendments with reason/approver, never by overwriting the original quote/snapshot.
9. **Branch compatibility:** data eligibility is distinct from user authorization; non-Global rate branch must equal order branch.
10. **Customer integrity:** customer ID must exist, be active and be branch-compatible before external procurement/release.
11. **Rate-card versioning:** every selected rate refers to an immutable card version/effective period and exact calculation breakdown.
12. **Sell-card authority:** define whether customer rate cards, pricing rules or markup are authoritative and deterministic when more than one applies.
13. **Currency minor-unit policy:** all rounding/allocation uses currency-specific decimal precision and an explicit residual rule.
14. **FX provenance:** numeric FX can never exist without source type/date/components/manual-override audit metadata.
15. **Stop temporal invariant:** per-house pickup precedes delivery in both sequence and time; multimodal legs are topologically continuous.
16. **Capacity-data completeness:** zero/missing cargo values must be distinguished from real zero and cannot silently evade allocation/capacity logic.
17. **Master/house reconciliation:** sum of house allocations exactly equals master procurement in currency minor units; every house points to the same master procurement version while retaining a separately named standalone baseline.
18. **Released quote ↔ shipment reconciliation:** shipment must link to the actual customer sell quote/version used, not only a hidden operational bridge quote.

---

# Critical/high findings

There are no P0 findings. P1 remediation should start with:

| ID | High-risk theme |
|---|---|
| TMS-001 | Margin/approval thresholds bypassable through calculation overrides |
| TMS-002 | Generic quote editor can mutate approved TMS economics |
| TMS-003 | Historical pricing/quote versions overwritten |
| TMS-004 | Carrier counter can be booked without repricing |
| TMS-005 | Duplicate shipment creation race on booking |
| TMS-006 | One house can race into multiple consolidation loads |
| TMS-007 | Add/remove/release stale-write races corrupt released loads |
| TMS-008 | Cross-branch rate card can be applied to another branch's order |
| TMS-009 | Stale/expired/archived rate selection can still be tendered |
| TMS-010 | House procurement IDs disagree with allocated master cost |
| TMS-011 | Approval/release can target stale pricing snapshots |
| TMS-012 | Invalid customer can progress into procurement and strand later |
| TMS-013 | Duplicate active tender + stale rollback race |
| TMS-014 | Post-tender/post-book repricing mutates historical commercial truth |
| TMS-015 | Customer contractual sell cards are disconnected from TMS pricing |
| TMS-016 | Allocation can assign zero cost to a real house shipment |

(Findings TMS-015/TMS-016 are counted in the P1 table above; total P1 count in this report is 16 if treating both as high. **Severity count correction:** P1 = 16, P2 = 12, P3 = 2, total = 30. The executive table should be read with this corrected distribution.)

# Financial calculation risks

- Valid positive buy-rating algebra for unit quantity, minimum charge, fuel and flat accessorial is straightforward, but invalid data is often clamped rather than rejected.
- Zero buy rates can become real selected/tendered procurement.
- Margin policy can be weakened by ad-hoc override values not constrained like stored pricing rules.
- Generic quote editing breaks the binding between displayed approved GP/margin and actual quote amounts.
- Countered procurement can increase/change currency after customer pricing approval.
- Consolidation allocation can put zero cost on a nonzero house due to incomplete weight data.
- Allocation is hard-coded to two decimals and therefore wrong for JPY minor units.
- Consolidation savings use member snapshots that can be stale and can legitimately return a negative number without requiring acknowledgement/approval.
- Mixed-currency house baselines are only warned about; there is no snapshotted FX policy for savings comparison.
- Customer sell-rate cards are not resolved by TMS pricing, so contractual vs calculated sell rates can diverge silently.

# State-machine risks

- Order progression has no single authoritative transition table enforced transactionally.
- `rated` may mean zero rates found.
- Tender reject/cancel/expiry writes order back to selected without verifying that tender is still the active tender.
- Countered is directly bookable rather than requiring explicit acceptance/reconciliation.
- Pricing has a separate `pricing_status` but can continue while operational order is tendering/booked.
- Consolidation release is not a hard linearization boundary because stale draft writes can commit afterward.
- Invalid customers are detected too late in the order→tender→booking path.

# Concurrency risks

Repository search found no `runTransaction` usage. High-value races identified:

1. select/reselect rate vs tender creation;
2. calculate pricing vs Management approval;
3. recalculate pricing vs quote release;
4. simultaneous tender creation;
5. stale tender reject/cancel/expiry vs another active tender;
6. simultaneous booking confirmation creating different shipment IDs;
7. same house claimed by two consolidation loads;
8. load release vs add/remove/reorder/stop update;
9. simultaneous consolidated booking producing duplicate master/house shipment sets;
10. concurrent customer bookings losing active-shipment counter increments.

Write batches protect atomicity of each submitted batch, but **do not protect the validity of the preceding reads**. The required control is transaction/CAS/idempotency, not merely a larger batch.

# Missing tests

Reviewed focused tests are predominantly pure-function tests and do not exercise the critical server/Firestore invariants.

## `tests/tms-rating.test.mjs` missing coverage

- branch-specific card vs different-branch order;
- multimodal-card-to-single-mode semantics;
- directional equipment compatibility;
- malformed/reversed dates;
- zero-rate and malformed numeric inputs;
- stale card after selection;
- duplicate/overlapping cards;
- no-results status semantics;
- concurrent reselect/tender boundary.

## `tests/tms-pricing.test.mjs` missing coverage

- negative ad-hoc minimum/approval threshold bypass;
- generic quote PATCH after TMS approval;
- immutable/versioned snapshots and repeated quote release;
- calculate-vs-approve and calculate-vs-release races;
- carrier counter invalidating sell pricing;
- post-tender/post-book repricing lock;
- FX provider/date/manual provenance;
- customer sell-rate card precedence;
- zero cost / zero sell / very large value boundaries.

## `tests/tms-tender-policy.test.mjs` missing coverage

- transactional single-active-tender invariant;
- rate-card revalidation at tender creation;
- stale tender rollback protection;
- duplicate booking/idempotency;
- explicit counter acceptance/repricing. Existing policy test explicitly permits `countered` booking.

## `tests/tms-consolidation.test.mjs` missing coverage

- same house concurrently added to two loads;
- release vs add/remove/reorder races;
- duplicate consolidated booking;
- load equipment vs house equipment requirement;
- full revalidation at release;
- zero-weight/nonzero-volume house allocation;
- stale member baseline/dimensions;
- JPY zero-decimal allocation;
- planned delivery before pickup timestamp;
- multimodal route continuity;
- house procurement ID/cost reconciliation after booking;
- exact master=sum(houses) currency-minor-unit property tests.

# Top remediation order

1. **Close margin-control bypasses first:** validate all pricing overrides centrally; prevent generic quote edits from mutating governed TMS economics without repricing/reapproval.
2. **Introduce immutable commercial/procurement versions:** selected-rate snapshot, pricing snapshot versions, quote versions, FX snapshot provenance.
3. **Make booking exactly-once:** transaction/CAS + idempotency for individual and consolidated booking before any random shipment docs/workflow are created.
4. **Transactionalize tender state:** one active tender per order; active-tender/version preconditions on response/cancel/expiry/booking.
5. **Transactionalize consolidation membership/release:** claim houses atomically; version load; freeze membership/stops/compatibility at release.
6. **Invalidate sell pricing whenever procurement changes:** counteroffer, rate reselection, consolidation allocation/currency changes all force reconciliation before booking/release.
7. **Fix procurement identity model for houses:** do not mix standalone selected partner/rate IDs with master allocated cost.
8. **Enforce rate eligibility at every commitment boundary:** branch, active/effective date, lane, mode, equipment, partner, amount/version.
9. **Integrate authoritative customer sell-rate cards and complete supported mode/unit coverage.**
10. **Fix allocation/currency invariants:** complete basis policy, currency minor units, exact residual handling, stable savings baseline.
11. **Strengthen date/location/multimodal/stop validation.**
12. **Add deterministic concurrency and invariant regression tests before relying on green CI.**

# Files reviewed

Core rating/order:
- `app/admin/rating/tms-rating.ts`
- `app/admin/rating/tms-rating.server.ts`
- `app/api/admin/rating/route.ts`

Pricing/FX:
- `app/admin/pricing/tms-pricing.ts`
- `app/admin/pricing/tms-pricing.server.ts`
- `app/admin/pricing/tms-pricing-workspace.tsx`
- `app/api/admin/pricing/route.ts`
- `app/integrations/nrb-forex.server.ts`
- `app/api/admin/forex/route.ts`

Customer sell rates / quote mutation:
- `app/admin/crm/crm-rate-cards.ts`
- `app/admin/crm/crm-rate-cards.server.ts`
- `app/api/admin/crm/customers/[id]/rate-cards/route.ts`
- `app/admin/admin-data.server.ts`
- `app/api/admin/quotes/[reference]/route.ts`
- `app/admin/crm/crm-quote-links.server.ts`

Tender/booking:
- `app/admin/tenders/tms-tendering.ts`
- `app/admin/tenders/tms-tendering.server.ts`
- `app/admin/tenders/tms-tender-expiry.server.ts`
- `app/admin/tenders/tms-order-customer.server.ts`
- `app/api/admin/tenders/route.ts`

Consolidation/master-house:
- `app/admin/consolidation/tms-consolidation.ts`
- `app/admin/consolidation/tms-consolidation.server.ts`
- `app/api/admin/consolidation/route.ts`

Related downstream/linkage surfaces inspected through call paths/tree/search:
- `app/shipment-data.server.ts`
- `app/admin/shipment-access.server.ts`
- `app/admin/workflow-guard.server.ts`
- `app/admin/partners/partners.server.ts`
- `app/admin/partners/partner-360.server.ts`
- `migrations/0003_commercial_quotes.sql`
- `migrations/0004_shipments.sql`
- `firestore.rules`

Tests:
- `tests/tms-rating.test.mjs`
- `tests/tms-pricing.test.mjs`
- `tests/tms-consolidation.test.mjs`
- `tests/tms-tender-policy.test.mjs`

# What looked sound in the reviewed scope

- TMS buy mode/unit enums cover the requested modes and rating units.
- Positive-value rating arithmetic for quantity, minimum charge, linehaul fuel percentage and flat accessorial is internally coherent.
- Pricing uses currency-aware zero decimals for JPY in `moneyRound`.
- NRB rate normalization correctly divides quote values by NRB unit and midpoint cross-rate algebra is directionally sensible.
- Single Firestore write batches prevent partial application *within one committed operation*; the defect is stale-read concurrency surrounding those batches.
- Consolidation capacity totals and sequence-based pickup-before-delivery checks provide useful baseline validation, but are not sufficient at release.

# Continuation point

A follow-on business-integrity audit should start at the **booking → shipment → finance/invoice/match-pay boundary** and prove that the immutable procurement/sell versions recommended above propagate through settlement. In particular:

1. trace `shipment.procurement_rate_card_id`, `procurement_cost/currency`, hidden `TMSQ-*` bridge quotes and real `TMSSELL-*` customer quotes into invoicing and partner-payables;
2. verify external EDI/API carrier responses cannot create a second state-transition path that bypasses the same tender/pricing invalidation invariants;
3. verify cancellation/rebooking/amendment workflows reverse master/house allocations and counters exactly once;
4. add a Firestore concurrency test harness with barriers/emulator transactions before attempting fixes.

The highest-value first regression should reproduce **TMS-001, TMS-004, TMS-005, TMS-006 and TMS-011** because they demonstrate distinct control classes: authorization-equivalent business bypass, procurement-price drift, duplicate execution, membership race and stale approval replay.
