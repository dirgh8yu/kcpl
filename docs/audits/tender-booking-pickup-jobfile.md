# KCPL Shipment Execution Workflow Adversarial Audit

**Audit agent:** Audit Agent 3  
**Repository:** `dirgh8yu/kcpl`  
**Branch:** `main`  
**Latest main re-checked before report write:** `54626c0016a63332775539bdcd2d431d0eff94cc`  
**Application-code baseline:** execution code remains the `d0f74ea572f3efea0a454a97a4fd339f12ed7e20` EDI 204/990/214 application state; later main commits inspected before this write added audit documents only.  
**Audit date:** 2026-08-22  
**Mode:** AUDIT ONLY. No application code, configuration, production data, or production workflow state was changed.

## Scope and method

Adversarial review traced the execution chain:

`Transport Order -> Tender -> Carrier response -> Booking -> Pickup -> Shipment -> Digital Job File`

The review concentrated on transactional boundaries, stale reads, competing requests, idempotency, external-provider ordering, cross-document invariants, audit-history durability, and impossible composite states. Pure validation was treated as secondary unless it created a workflow integrity failure.

Important controls that were observed and not misreported as defects:

- the dedicated tender-expiry reconciler re-reads the tender and checks `order.active_tender_id` and `order.status` inside a Firestore transaction before clearing the order;
- booking references are required before TMS booking creation;
- an individual normal booking write set and an individual consolidation booking write set use Firestore batches, so a single batch does not partially commit;
- provider pickup ingestion uses a deterministic provider-event document and catches the duplicate-create race for the appointment/provider-event batch;
- internal Job File and shipment routes perform authentication and branch checks;
- workflow-navigation tests cover `/admin/jobs/<reference>` and the principal execution workspaces; no confirmed broken Job File deep link was found in the reviewed route path.

Those controls do not remove the race conditions below because most eligibility checks are performed before the write batch/transaction or because later side effects are outside the atomic write.

---

# Findings

## EXEC-001 - Concurrent tender creation can violate the one-active-tender invariant

**Severity:** Critical  
**Confidence:** High  
**File / function:** `app/admin/tenders/tms-tendering.server.ts` - `createTmsTender()`, `activeTenderForOrder()`

**State before:** One transport order is `selected`, has a selected partner/rate, and has no active tender.

**Action:** Two users, browser retries, or API clients call `createTmsTender()` for the same order concurrently.

**Bad resulting state:** Both calls can read `selected`; both can query and see no active tender; each then creates a different `transport_tenders` document in a different Firestore batch. Both tenders remain in an active status. The order's `active_tender_id` is only the last writer's tender ID, hiding the other active tender rather than preventing it.

**Business impact:** Two carriers can receive valid tenders for the same movement. Both can accept. An older hidden tender can later be booked, producing conflicting procurement commitments and duplicated shipment execution.

**Evidence:** `activeTenderForOrder()` is a normal query performed before the batch. The batch creates the new tender and updates the order but does not transactionally assert that the order still has no active tender or that its status is still `selected`.

**Recommended remediation:** Make the order document the concurrency lock. In one Firestore transaction, re-read the order, require `status === selected` and no live active-tender pointer, create the tender, and move the order to `tendering`. Consider a deterministic per-order active-tender lock/document if query uniqueness is otherwise required.

**Test required:** Run 2, 10, and 50 parallel tender-create attempts for one order. Assert exactly one active tender exists, exactly one request succeeds, and `order.active_tender_id` identifies that same tender.

---

## EXEC-002 - Stale tender responses and cancellation can overwrite a newer order state

**Severity:** Critical  
**Confidence:** High  
**File / function:** `app/admin/tenders/tms-tendering.server.ts` - `respondToTmsTender()`, `cancelTmsTender()`

**State before:** A tender has been read as `sent`, `accepted`, or `countered`; the related order can change before that action commits. This is especially reachable after the duplicate-active-tender race or during cancel-versus-book competition.

**Action:** A stale rejection, expiry detected inside `respondToTmsTender()`, or cancellation commits after a newer tender or booking has changed the order.

**Bad resulting state:** These paths can write the order back to `selected` and clear `active_tender_id` without checking that the tender being acted on is still the order's active tender. A cancellation racing a booking can commit after the booking batch and leave an active shipment linked to a tender now marked `cancelled`, while the order is rolled back from `booked` to `selected`.

**Business impact:** Procurement truth can split across the order, tender, and shipment. Operations can re-tender an already booked movement, or lose the pointer to the actually active tender.

**Evidence:** `cancelTmsTender()` reads tender/order outside a transaction and later unconditionally updates the order to `selected`/`null`. Rejection and the direct expired-response path do the same. By contrast, `reconcileExpiredTmsTenders()` correctly checks the fresh active pointer in a transaction, showing the stronger pattern already exists elsewhere.

**Recommended remediation:** Every tender lifecycle mutation that changes the order must transactionally re-read both records and assert `order.active_tender_id === tender.id` plus the expected order/tender states. Booking and cancellation must be mutually exclusive compare-and-set transitions.

**Test required:** Race cancel versus booking, reject versus retender, expired-response versus retender, and two active tenders where the non-pointer tender is acted on. Assert the newer order state cannot be rolled back.

---

## EXEC-003 - Same-state tender responses are replayable and can rewrite response/commercial history

**Severity:** High  
**Confidence:** High  
**File / function:** `app/admin/tenders/tms-tendering.ts` - `tenderResponseAllowed()`; `app/admin/tenders/tms-tendering.server.ts` - `respondToTmsTender()`

**State before:** Tender is already `accepted`, `rejected`, or `countered`.

**Action:** The same response status is submitted again, intentionally or as a retry. Two response calls can also race from the same original `sent` snapshot.

**Bad resulting state:** `tenderResponseAllowed()` returns true when `current === next`. A second `countered` response can replace `counter_cost`, `counter_currency`, note, response timestamp, and actor-facing event without a revision model. Repeated acceptance/rejection rewrites response metadata and creates additional response events. Concurrent `accepted` and `rejected` calls can both pass a stale `sent` check, with last-writer tender state and order side effects diverging.

**Business impact:** The system cannot prove which counteroffer was the carrier's original response, which retry was duplicate, or which commercial version was later booked. Audit history can look like multiple legitimate responses rather than one response plus retries/amendments.

**Evidence:** The policy explicitly allows same-state transitions. The existing tender policy test checks `accepted -> rejected` is false but does not test `accepted -> accepted` or `countered -> countered` idempotency/versioning.

**Recommended remediation:** Treat carrier response as immutable once accepted/rejected/countered, or introduce an explicit versioned amendment/counteroffer lifecycle. Require idempotency keys for external responses and transactionally compare the current response version.

**Test required:** Repeat identical accepted/rejected/countered requests; submit a countered retry with a different amount; race accepted versus rejected and accepted versus countered. Verify one immutable response or an explicit ordered amendment history.

---

## EXEC-004 - Email/EDI dispatch failure leaves an active tender that can block the order

**Severity:** High  
**Confidence:** High  
**File / function:** `app/api/admin/tenders/route.ts` - create action; `app/admin/tenders/tms-tender-email.server.ts` - `sendTmsTenderEmail()`; `app/admin/edi/edi-tender.server.ts` - `queueTenderAsEdi204()`

**State before:** Order is `selected` and ready to tender.

**Action:** Create an email or EDI tender, then SendGrid is unconfigured/fails or EDI queue handoff fails.

**Bad resulting state:** The tender record has already been created as `sent`, and the order has already moved to `tendering` with that active tender. The HTTP request returns an error, but the failed delivery does not roll back or move the tender to a non-active dispatch-failed state.

**Business impact:** A failed external side effect looks retryable to the user/client, yet a clean retry is blocked by the active tender. Staff must know to cancel/repair the failed tender. A carrier may never have received a tender that KCPL treats as live.

**Evidence:** `createTmsTender()` commits first. The route then calls email or EDI delivery. Email failure only records `delivery_status: failed`; EDI queue failure records `edi_204_status: queue_failed`; neither removes active status or restores the order.

**Recommended remediation:** Separate `created/pending_dispatch` from `sent`, or use an outbox pattern. The order should become actively tendered only when dispatch is durably queued. Failed delivery should have an explicit recoverable state and idempotent resend action.

**Test required:** Inject SendGrid not-configured, timeout, provider 5xx, Firestore failure while recording delivery status, and EDI queue failure. Verify retries cannot create duplicates and the order is never stranded behind a tender the partner did not receive.

---

## EXEC-005 - EDI 204 retries and queue polling can double-dispatch the same tender

**Severity:** High  
**Confidence:** High  
**File / function:** `app/admin/edi/edi-tender.server.ts` - `queueTenderAsEdi204()`; `app/admin/edi/edi-gateway.server.ts` - `queueEdi204()`, `listOutboundEdiQueue()`, `acknowledgeOutboundEdi()`; `app/admin/edi/edi-x12.ts` - `build204()`

**State before:** A tender is `sent` with channel `manual` or `edi_204`, or an outbound 204 is queued but not acknowledged.

**Action:** Re-run `queueTenderAsEdi204()`, retry after an uncertain response, or allow two integration workers to read the outbound queue before either acknowledges dispatch.

**Bad resulting state:** A manual tender that may already have been sent outside KCPL can be converted to EDI because there is no durable `manual_dispatched_at` invariant. Re-running an EDI tender rebuilds X12 with a new current-time/control number; the payload fingerprint and transaction ID therefore change, so a second outbound transaction can be created for the same tender. Separately, queue listing has no atomic claim/lease state, so two workers can read the same `queued` 204 and both transmit it before post-send acknowledgement.

**Business impact:** A carrier can receive duplicate load tenders over manual plus EDI or multiple EDI 204 messages, potentially generating duplicate carrier actions or conflicting 990 responses.

**Evidence:** `queueTenderAsEdi204()` allows both `manual` and `edi_204`. `build204()` derives control/time from `new Date()` when no fixed control is supplied. `queueEdi204()` dedupes the generated payload fingerprint, not the business key `tender_id`. Outbound workers only change state through a later acknowledgement.

**Recommended remediation:** Idempotency must be keyed to the tender/business command, not the generated envelope. Persist one outbound 204 record per tender/version and reuse its envelope on retry. Add an atomic claim/lease before transport dispatch and durable channel dispatch provenance.

**Test required:** Queue the same tender repeatedly across different milliseconds; run two queue workers concurrently; simulate send-success/ack-failure; convert an already manually dispatched tender to EDI. Assert one external dispatch per tender version.

---

## EXEC-006 - Inbound EDI responses are authenticated globally, not bound to the tender's expected partner

**Severity:** High  
**Confidence:** High  
**File / function:** `app/api/integrations/edi/route.ts`; `app/admin/edi/edi-gateway.server.ts` - `findTenderFor990()`, `process990()`

**State before:** Multiple trading partners use the EDI integration and a live tender exists for Partner A.

**Action:** Any integration party or bridge holding the shared EDI bearer secret submits a valid 990 referencing Partner A's tender/order while claiming another `partner` string.

**Bad resulting state:** The 990 can be accepted based on tender/order reference alone. `process990()` does not prove the authenticated sender/ISA/GS identity or request partner equals `tender.partner_id`, expected SCAC, or configured EDI receiver/sender identity.

**Business impact:** A cross-partner response can accept or reject another carrier's tender and change order procurement state while the audit record labels the caller-supplied integration actor as the source.

**Evidence:** The integration route uses a shared `KCPL_EDI_SECRET`; `partner` is supplied with the request. Tender matching is reference-based and does not compare the matched tender's partner identity with envelope sender/request partner.

**Recommended remediation:** Use partner-scoped credentials/signatures and bind the authenticated principal plus X12 sender identifiers to the tender's configured partner/SCAC. Quarantine any identifier mismatch.

**Test required:** Valid Partner A 990; Partner B credential/reference for A; mismatched ISA sender; correct tender reference with wrong SCAC/partner; shared-secret replay with altered partner field.

---

## EXEC-007 - A carrier counteroffer is directly booking-eligible without a distinct KCPL acceptance state

**Severity:** High  
**Confidence:** High  
**File / function:** `app/admin/tenders/tms-tendering.ts` - `tenderCanBook()`, `tenderFinalCommercials()`; `tests/tms-tender-policy.test.mjs`

**State before:** Carrier has responded `countered` with revised amount/currency.

**Action:** KCPL clicks/requests booking without recording a separate acceptance/approval of the counteroffer.

**Bad resulting state:** `countered` is treated as bookable, and the carrier's counter amount becomes the procurement snapshot immediately. There is no state representing `counter_received -> counter_accepted` versus `counter_rejected`.

**Business impact:** Merely recording a carrier counter can be interpreted as KCPL agreeing to revised procurement terms. This weakens commercial authorization and makes it difficult to prove who accepted a changed buy rate.

**Evidence:** `tenderCanBook()` returns true for both `accepted` and `countered`; `tenderFinalCommercials()` uses counter amount/currency. The existing unit test explicitly asserts this behavior.

**Recommended remediation:** Introduce an explicit counteroffer decision state or an audited management/commercial acceptance action before booking. Snapshot the accepted counter version, not a mutable counter field.

**Test required:** Counter received but not approved must not book; approved counter books exact version; amended counter invalidates prior approval; rejected counter returns order to a controlled retender state.

---

## EXEC-008 - Concurrent booking confirmation can create two shipments and two Digital Job Files for one tender/order

**Severity:** Critical  
**Confidence:** High  
**File / function:** `app/admin/tenders/tms-tendering.server.ts` - `confirmTmsTenderBooking()`, `createBookedShipment()`

**State before:** Tender is `accepted` or `countered`; order is not yet `booked`.

**Action:** Two booking requests execute concurrently, including double-click, network retry, or two operators.

**Bad resulting state:** Both calls read a bookable tender and unbooked order before either writes. Each generates a different random shipment reference and builds a valid Firestore batch. Both batches can commit because the new shipment IDs differ. The last tender/order pointer wins, while the other shipment and seeded Job File remain real but orphaned from the canonical pointer.

**Business impact:** One order can have two executable shipments, two task/customs/document sets, duplicate customer activity, and two procurement snapshots. Operations may execute both or discover only one through normal navigation.

**Evidence:** Idempotency checks happen before `createBookedShipment()`. The write batch has no precondition that tender/order are still unbooked and does not use a deterministic shipment ID derived from the booking command.

**Recommended remediation:** Perform booking in a transaction using the tender/order as compare-and-set locks, or create a deterministic one-booking-per-order/tender command document and derive/reuse the shipment reference. Re-check all eligibility inside the transaction.

**Test required:** 2/10 parallel bookings with same and different booking references; retry after client timeout; cancel-versus-book. Assert one shipment, one Job File, one booking event set, and stable idempotent response.

---

## EXEC-009 - Booking does not prove the tender is still the order's active procurement decision

**Severity:** Critical  
**Confidence:** High  
**File / function:** `app/admin/tenders/tms-tendering.server.ts` - `confirmTmsTenderBooking()`

**State before:** A tender document is `accepted` or `countered`, but the order's active tender/pointer/status may have changed through re-tendering, cancellation races, repair, or duplicate-active-tender creation.

**Action:** Book the stale tender.

**Bad resulting state:** Booking proceeds because the function checks the tender's own status and only short-circuits if the order already has a shipment. It does not require `order.active_tender_id === tender.id`, does not require the order to still be `tendering`, and does not re-check those conditions atomically at commit.

**Business impact:** An old carrier decision can become the active shipment after procurement moved elsewhere. One order can be linked to a shipment based on an incompatible/obsolete tender.

**Evidence:** `confirmTmsTenderBooking()` loads tender and order separately, evaluates tender bookability, then calls the booking builder. There is no active-tender pointer assertion.

**Recommended remediation:** Booking transaction must assert expected order state, active tender ID, tender status/version, customer link, and commercial snapshot in one read/write boundary.

**Test required:** Retender after old acceptance, change active pointer, then attempt old booking; race old booking against new tender; cancel old accepted tender while booking. All stale bookings must fail without creating a shipment.

---

## EXEC-010 - Customer active-shipment counters lose increments under concurrent bookings

**Severity:** Medium  
**Confidence:** High  
**File / function:** `app/admin/tenders/tms-tendering.server.ts` - `createBookedShipment()`; `app/admin/consolidation/tms-consolidation.server.ts` - `confirmConsolidatedLoadBooking()`

**State before:** Customer has `active_shipment_count = N`.

**Action:** Two different orders for the same customer are booked concurrently, or a consolidation booking overlaps another shipment creation.

**Bad resulting state:** Both flows can read the same customer count and later set `N + 1` (or stale `N + batch increment`) rather than transactionally incrementing from the latest value. Two real shipments can therefore increase the parent counter only once.

**Business impact:** CRM workload and customer activity metrics undercount active shipments, affecting operational capacity views and potentially downstream finance/customer logic that trusts the counter.

**Evidence:** TMS booking reads the customer before the batch and writes `active_shipment_count: currentActive + 1`. Consolidation computes increments from customer snapshots obtained before its batch.

**Recommended remediation:** Include the customer in the same transaction as booking with a fresh read, use a safe atomic increment only where corresponding decrement/reconciliation guarantees exist, or derive counts rather than treating the field as authoritative.

**Test required:** Parallel bookings for one customer, including normal plus consolidation; assert count equals actual active shipment documents after all commits.

---

## EXEC-011 - Concurrent consolidation booking can duplicate the entire master/house shipment hierarchy

**Severity:** Critical  
**Confidence:** High  
**File / function:** `app/admin/consolidation/tms-consolidation.server.ts` - `confirmConsolidatedLoadBooking()`

**State before:** Consolidation load is `ready_for_procurement` or `tendering` and has not yet been booked.

**Action:** Two booking confirmations run concurrently.

**Bad resulting state:** Both calls can read the same bookable load before either changes it. Each generates a new master shipment reference and a full set of new house shipment references, seeded Job Files, quote bridges, events, and customer updates. Both batches can commit because generated shipment IDs differ. The load/master pointers from the last writer hide the earlier hierarchy.

**Business impact:** A single consolidation can create duplicate master shipments plus duplicate house shipments for every member order, multiplying operational work, procurement allocation, customer activity, and execution ambiguity.

**Evidence:** The load status check is outside a transaction. The batch is atomic only within one invocation; it has no precondition that the load/tender/master order remain unbooked.

**Recommended remediation:** Treat the consolidation load document as a transaction lock and allocate persistent master/house references once. Transactionally change load state to a booking-in-progress/committed version before materializing children, or make the full command idempotent on a stable booking key.

**Test required:** Two concurrent confirmation requests against a multi-house load; retries with same/different booking references; verify exactly one master, one house per member order, one allocation, and one canonical pointer set.

---

## EXEC-012 - Manual pickup transitions split appointment, shipment, audit, and tracking writes across failure boundaries

**Severity:** High  
**Confidence:** High  
**File / function:** `app/admin/pickups/pickup-appointments.server.ts` - `confirmPickup()`, `assignPickupDriver()`, `completePickup()`, `missPickup()`, `cancelPickup()`, `writeAppointmentEvent()`

**State before:** A pickup appointment and shipment have matching pickup state.

**Action:** A manual transition runs while one Firestore write fails, the audit-event batch fails, tracking fails, or a competing transition runs.

**Bad resulting state:** Core appointment and shipment updates are commonly performed through separate promises in `Promise.all`, not a single batch/transaction. Audit events are written afterward, and tracking is later again. One write can succeed while another fails, or competing actions can interleave appointment and shipment values.

**Business impact:** The appointment can say `picked_up` while the shipment pickup status says `missed`, or the operational state can change without matching Job File/activity evidence. Recovery is manual and chronology may no longer explain the canonical state.

**Evidence:** `confirmPickup`, driver assignment, completion, missed, and cancel each issue distinct appointment/shipment updates. `writeAppointmentEvent()` is a later commit. Completion/missed then call the tracking writer after those commits.

**Recommended remediation:** Put appointment state, shipment pickup projection, and durable transition event into one transaction/batch with an expected current-state precondition. Use an outbox for tracking/notification side effects and make retries resumable.

**Test required:** Fault-inject each write position; race complete versus missed/cancel/confirm; kill request after core write but before event/tracking; assert convergence and complete audit history.

---

## EXEC-013 - Pickup lifecycle accepts out-of-order regressions and completion before confirmation

**Severity:** High  
**Confidence:** High  
**File / function:** `app/admin/pickups/pickup-appointments.ts` - `pickupTransitionAllowed()`; `app/admin/pickups/pickup-appointments.server.ts`; `app/api/integrations/pickups/route.ts`

**State before:** Appointment is `requested`, `driver_assigned`, or `missed` with a known newer state/event.

**Action:** Complete an unconfirmed requested pickup, or receive a unique but late provider `request`/`confirm` event after a newer state.

**Bad resulting state:** The policy explicitly allows `requested -> picked_up`. Manual `completePickup()` rejects only `picked_up`/`cancelled`, so it also permits completion from `missed`. The provider route does not compare `eventTime` with the current provider-event/state timestamp and directly assigns `requested`, `confirmed`, `driver_assigned`, `missed`, etc. A late confirm can therefore regress `driver_assigned` or `missed` back to `confirmed`.

**Business impact:** Appointment state can move backward because messages arrive out of order, masking missed pickups or losing driver assignment semantics. Completion can bypass the confirmation control expected by operations.

**Evidence:** Provider dedupe prevents an identical event ID from reapplying, but unique out-of-order events are accepted. No monotonic sequence/version check exists for pickup state.

**Recommended remediation:** Define and enforce a transition matrix on every writer, with explicit reschedule/reopen operations. Provider events need ordering/version semantics and historical-event storage when older than the state they would mutate.

**Test required:** Late request after confirm; late confirm after driver assignment/missed; requested -> picked_up; missed -> picked_up without reschedule; duplicate and unique reordered provider events.

---

## EXEC-014 - Pickup rescheduling preserves stale driver/vehicle assignment

**Severity:** Medium  
**Confidence:** High  
**File / function:** `app/admin/pickups/pickup-appointments.server.ts` - `schedulePickup()`

**State before:** Existing appointment has a driver/vehicle and is missed or otherwise being rescheduled.

**Action:** Schedule a new requested/confirmed window.

**Bad resulting state:** The appointment status/window are replaced and missed fields cleared, but `driver_name`, `driver_phone`, and `vehicle_reference` are copied from the previous appointment state. A new `requested` pickup can therefore display the driver/vehicle assigned to the old failed window.

**Business impact:** Dispatchers can send or trust stale driver details for the new attempt, causing incorrect handoff instructions and provider confusion.

**Evidence:** `schedulePickup()` explicitly sets driver/vehicle fields from `existing` while resetting status/window/missed fields.

**Recommended remediation:** Reschedule should explicitly decide whether assignment is carried forward, with a recorded reason/provider confirmation. Default to clearing assignment when a missed/cancelled attempt creates a new attempt unless the same assignment is positively reconfirmed.

**Test required:** Missed pickup with driver -> reschedule; requested reschedule with existing driver; confirm carry-forward only through an explicit option/action.

---

## EXEC-015 - Provider pickup commit and tracking promotion are non-atomic, and a retry cannot heal the partial failure

**Severity:** Critical  
**Confidence:** High  
**File / function:** `app/api/integrations/pickups/route.ts`; `app/admin/visibility/tracking-visibility.server.ts` - `recordTrackingEvent()`

**State before:** Valid provider event with new deterministic `providerEventId`.

**Action:** Provider sends `picked_up`, `missed`, `request`, or `confirm`; the appointment/provider-event/shipment-pickup batch commits, but the later tracking write throws or the request dies.

**Bad resulting state:** The appointment/provider event and shipment `pickup_status` are durable, but the tracking event and shipment main status promotion are missing. On retry with the same event ID, the route returns `duplicate: true` before re-running tracking, so the partial failure is permanently considered handled.

**Business impact:** Example: `pickup_status = picked_up` while shipment main `status` remains `booking_confirmed`; or `pickup_status = missed` without the expected exception tracking state. External provider sees a successful duplicate response on retry although KCPL never completed the downstream state change.

**Evidence:** Provider core state is one batch. `recordTrackingEvent()` is called only after the batch. Early duplicate detection returns before tracking.

**Recommended remediation:** Use an outbox/work item created atomically with the provider event. Mark the provider event fully processed only after tracking side effects complete, and allow retries/workers to resume incomplete processing idempotently.

**Test required:** Force tracking failure after provider batch; retry same event ID; restart worker/process; assert tracking and shipment main state eventually converge exactly once.

---

## EXEC-016 - Pickup state can contradict a terminal shipment, including `missed` while shipment is `delivered`

**Severity:** High  
**Confidence:** High  
**File / function:** `app/admin/pickups/pickup-appointments.server.ts` - `missPickup()`, `cancelPickup()`, `completePickup()`; `app/api/integrations/pickups/route.ts`

**State before:** Shipment has already reached `delivered`, but its pickup appointment remains non-terminal due to stale/incomplete pickup data.

**Action:** Direct manual/provider pickup action marks that appointment `missed` or `cancelled`.

**Bad resulting state:** Pickup writers do not reject actions based on shipment main status. The pickup projection can become `missed` while tracking's delivered-terminal logic keeps the shipment `delivered`.

**Business impact:** KCPL can display mutually impossible operational truth for the same physical movement. Exceptions, SLA reporting, customer communication, and audit review can disagree about whether cargo was ever collected.

**Evidence:** Pickup scope loads the shipment for branch/access but does not enforce a compatible shipment status. Tracking deliberately keeps delivered terminal, so the contradictory pickup projection is not automatically repaired.

**Recommended remediation:** Add cross-aggregate invariants: terminal shipment states must restrict pickup mutations. Historical corrections should use an explicit correction/reconciliation event rather than changing the live pickup state.

**Test required:** Delivered shipment with stale confirmed appointment -> missed/cancel/picked_up actions; assert mutations are rejected or recorded only as historical corrections.

---

## EXEC-017 - Pickup branch scoping ignores secondary handling branches

**Severity:** Medium  
**Confidence:** High  
**File / function:** `app/admin/pickups/pickup-appointments.server.ts` - `shipmentScope()`, `listPickupWorkspace()`

**State before:** Shipment primary branch is A; `handling_branches` includes A and B; user is authorized for handling branch B but not A.

**Action:** User in branch B opens or manages Pickup Desk for the shipment.

**Bad resulting state:** Pickup code resolves only `primary_branch`, falling back only to the first handling branch. It then tests access against that one branch. A legitimate secondary handling branch user can be denied and the shipment can be hidden from their pickup workspace, even though Job File/shipment access elsewhere recognizes handling-branch access.

**Business impact:** A handling branch can be unable to execute its pickup responsibility, creating operational handoff gaps or forcing broader permissions than necessary.

**Evidence:** `shipmentScope()` and workspace filtering use `primary_branch ?? handling_branches[0]`, not `any accessible handling branch`.

**Recommended remediation:** Reuse the canonical shipment branch-access helper and preserve the actual operational branch on the appointment/event. Do not derive authorization from one arbitrary branch slot.

**Test required:** Primary-only staff, first handling branch, second/third handling branch, all-branch management, and invalid branch data. Compare Pickup Desk visibility with Job File visibility.

---

## EXEC-018 - Tracking ingestion bypasses the shipment workflow guard and can jump directly across controlled statuses

**Severity:** Critical  
**Confidence:** High  
**File / function:** `app/admin/visibility/tracking-visibility.server.ts` - `recordTrackingEvent()`; `app/admin/workflow-guard.server.ts` - `validateShipmentTransition()`; EDI 214/provider tracking routes

**State before:** Shipment is `booking_confirmed` or otherwise before required customs/document/customer controls.

**Action:** Carrier/API/EDI event normalizes to `picked_up`, `departed`, `out_for_delivery`, or `delivered`.

**Bad resulting state:** `recordTrackingEvent()` computes `milestoneShipmentStatus()` and directly writes shipment `status`. It does not call the workflow guard. For example a tracking event can move `booking_confirmed -> in_transit`, although the guard only allows `booking_confirmed -> preparing/exception`, and a delivered event can promote state without the manual route's customs/document/customer controls.

**Business impact:** External tracking can become a privileged state-transition engine that bypasses KCPL operational gates. Delivery/status can outrun customs, document verification, tasks, and controlled workflow sequencing.

**Evidence:** The manual shipment PATCH calls `validateShipmentTransition()`. Tracking writes the status in its own Firestore batch based only on milestone mapping/current snapshot.

**Recommended remediation:** Define one authoritative transition primitive for both human and external events. External evidence may record a physical milestone, but canonical workflow state promotion must apply explicit reconciliation rules and required controls.

**Test required:** Feed picked_up/departed/out_for_delivery/delivered from every precondition state with missing customs/docs/customer/POD controls; assert physical event storage does not bypass canonical workflow rules.

---

## EXEC-019 - Tracking dedupe/order checks are raceable and can roll a delivered shipment back to an older state

**Severity:** Critical  
**Confidence:** High  
**File / function:** `app/admin/visibility/tracking-ingest.server.ts` - `recordOrderedTrackingEvent()`, `archiveHistoricalEvent()`; `app/admin/visibility/tracking-visibility.server.ts` - `recordTrackingEvent()`

**State before:** Shipment latest tracking time is T0 and status is non-terminal.

**Action:** Two events are ingested concurrently: newer delivered event T2 and older picked-up/in-transit event T1, with T0 < T1 < T2. Both read the T0 snapshot before either commits.

**Bad resulting state:** Both can decide they are current. If delivered commits first and the older event's batch commits second using its stale pre-delivery snapshot, the second batch can overwrite `status`, `tracking_last_event_at`, milestone, and location with older truth. The normal `current === delivered` protection does not help because the losing request calculated its next state before delivery was visible. Provider-event dedupe has a similar query-then-create race when random tracking event IDs are used.

**Business impact:** The explicit impossible transition `delivered -> picked_up/in_transit` becomes reachable through commit ordering. Chronology and canonical status disagree, and duplicate exceptions/activity can be generated.

**Evidence:** Event-order comparison and duplicate query happen before the write batch and have no transaction precondition on current `tracking_last_event_at` or provider-event uniqueness.

**Recommended remediation:** Insert/dedupe event plus latest-state promotion transactionally. Use deterministic provider-event uniqueness and compare incoming event time/version with the fresh current latest state inside the transaction, including a tie-break rule.

**Test required:** Concurrent delivered/older event in both commit orders; equal timestamps; 10 identical provider events; distinct reordered events; delivered plus exception. Verify monotonic latest pointers and terminal protection.

---

## EXEC-020 - Even the guarded manual shipment PATCH has a validate-then-write race

**Severity:** High  
**Confidence:** High  
**File / function:** `app/api/admin/shipments/[reference]/route.ts` - `PATCH`; `app/admin/workflow-guard.server.ts` - `validateShipmentTransition()`; `app/shipment-data.server.ts` - `updateShipment()`

**State before:** Shipment status S0 permits two different transitions A and B individually from S0.

**Action:** Request A and request B validate concurrently against S0. A commits first. B then enters `updateShipment()` after its earlier validation.

**Bad resulting state:** `updateShipment()` does use a Firestore transaction, but it does not assert its freshly read current status equals the status that was validated. It simply writes B. B can therefore create a transition from A -> B that the workflow guard would reject if evaluated on the current state.

**Business impact:** The central manual guard can be bypassed by normal concurrency even without external tracking. Audit events can show a status sequence that no single serialized request was allowed to create.

**Evidence:** `validateShipmentTransition()` and `updateShipment()` are separate operations. `updateShipment()` reads `currentStatus` mainly for event/customer counters, not as a compare-and-set precondition against the validated `fromStatus`.

**Recommended remediation:** Move transition validation into the same Firestore transaction that writes the status, or pass an expected version/status and fail if the transaction's fresh state differs.

**Test required:** Race two valid-from-S0 transitions whose combination A -> B is illegal; include management override versus normal request; assert one retries/revalidates rather than creating an illegal sequence.

---

## EXEC-021 - Closed Digital Job Files remain mutable without reopening

**Severity:** High  
**Confidence:** High  
**File / function:** `app/admin/job-file.server.ts` - `updateDigitalJobFile()`, `addJobTask()`, `toggleJobTask()`, `addCustomsStep()`, `toggleCustomsStep()`, `addJobCost()`; `app/api/admin/jobs/[reference]/route.ts`

**State before:** `job_closed_at` is set and the Digital Job File is closed.

**Action:** An otherwise authorized user PATCHes Job File metadata or POSTs add/toggle task, add/toggle customs, or add cost.

**Bad resulting state:** These domain functions load/access the Job File but do not reject `job_closed_at`. The route only invokes close/reopen controls for the dedicated close/reopen actions. Closed files can therefore acquire new open tasks/customs steps, changed ownership/branches/notes, altered task completion, or new costs without an explicit reopen event.

**Business impact:** Closure stops being a reliable operational/audit boundary. A file can have been certified closed and later materially changed while still presenting as closed.

**Evidence:** `validateShipmentTransition()` checks `job_closed`, but core Job File mutation functions do not. `getDigitalJobFile()` does not enforce closure as a write guard.

**Recommended remediation:** Centralize a closed-file mutation guard in the domain layer, not only UI/routes. Require management reopen with reason before any mutable operational/commercial child change, with narrowly defined append-only exceptions if needed.

**Test required:** Attempt every Job File mutation against closed job, including direct domain call and HTTP route; assert rejection until a recorded reopen occurs.

---

## EXEC-022 - Task/customs completion history is mutable and can erase prior completion provenance

**Severity:** High  
**Confidence:** High  
**File / function:** `app/admin/job-file.server.ts` - `toggleJobTask()`, `toggleCustomsStep()`; `app/admin/shipment-activity.server.ts`

**State before:** Task/customs step is complete with `completed_at` and `completed_by`.

**Action:** User toggles it incomplete, or concurrent users toggle true/false.

**Bad resulting state:** The same child document is updated in place. Setting incomplete clears `completed_at` and `completed_by`; completing again replaces them with a new actor/time. There is no immutable completion/reopen event in these functions. Activity views that infer completion from the current fields therefore lose evidence of the earlier completion.

**Business impact:** KCPL cannot reconstruct who first completed a required task/customs step, when it was reopened, or whether a closeout control had previously been satisfied. Races become last-writer state with weak forensic evidence.

**Evidence:** Toggle functions directly overwrite completion fields and return. Existing activity generation relies on current completion metadata rather than an append-only transition ledger for each toggle.

**Recommended remediation:** Every task/customs transition should be transactionally versioned and append an immutable event recording from/to state, actor, time, and reason for reopening. Preserve historical completion records.

**Test required:** Complete -> reopen -> complete by different actors; two simultaneous opposite toggles; close/reopen interactions. Assert full ordered history survives and current state is deterministic.

---

## EXEC-023 - Job close can race with newly created blockers and close an invalid file

**Severity:** High  
**Confidence:** High  
**File / function:** `app/admin/workflow-guard.server.ts` - `closeShipmentJob()`, `getShipmentWorkflowReadiness()`; Job File mutation functions

**State before:** Readiness snapshot reports no close blockers.

**Action:** `closeShipmentJob()` obtains readiness, then another request adds/reopens a task/customs/document blocker before the close batch commits.

**Bad resulting state:** Close writes `job_closed_at` based on stale readiness because it does not transactionally re-read blocker sources or assert a workflow version. The file can become closed while newly open work exists. EXEC-021 then allows further mutation even after closure.

**Business impact:** A formally closed Job File can fail the very controls that justified closure, weakening operational completion, audit sign-off, and downstream financial/compliance reliance.

**Evidence:** Readiness queries are completed before a later independent batch writes closure. The batch does not include preconditions on task/customs/document collections or a version counter.

**Recommended remediation:** Maintain a workflow version/close-readiness aggregate updated transactionally by every blocker mutation, then compare-and-set that version during close. Alternatively perform close through a transaction over authoritative aggregate flags rather than unversioned collection scans.

**Test required:** Race close against add task, reopen task, add required customs step, document invalidation/supersession, and status change. Closure must fail/retry when readiness changes after validation.

---

## EXEC-024 - Job File metadata mutation can commit without its audit event

**Severity:** High  
**Confidence:** High  
**File / function:** `app/admin/job-file.server.ts` - `updateDigitalJobFile()`; related route `touchShipment()` side effects

**State before:** Job File metadata is valid and user is authorized.

**Action:** Update owner/priority/internal reference/notes/branch data; the shipment update succeeds but the later `job_activity` create fails.

**Bad resulting state:** Canonical Job File metadata is changed with no corresponding `job_updated` audit event. Similar route-level patterns can create a child successfully and fail later while touching/recomputing other projections.

**Business impact:** Ownership/branch/internal-control changes can lack a durable actor/action trail. A client may see an error after a successful mutation and retry, producing further state churn.

**Evidence:** `updateDigitalJobFile()` executes `await ref.update(update)` and only then performs a separate activity-document create.

**Recommended remediation:** Commit canonical mutation and immutable audit event together in a batch/transaction. Any later derived projection should be driven by a resumable outbox, not be required for the request to look successful.

**Test required:** Fault after state write/before activity write; client retry; concurrent metadata edits. Assert each committed version has exactly one immutable audit record.

---

## EXEC-025 - EDI 214 can partially apply a multi-event message and then become non-retriable

**Severity:** High  
**Confidence:** High  
**File / function:** `app/admin/edi/edi-gateway.server.ts` - `process214()`, `ingestEdiPayload()`; tracking writers

**State before:** One inbound 214 contains multiple status events and has a new fingerprint/provider event ID.

**Action:** Early event(s) commit successfully; a later event or downstream exception/activity write throws.

**Bad resulting state:** `process214()` applies events sequentially, each through independent tracking commits. `ingestEdiPayload()` catches the later error and marks the EDI transaction `failed`. A retry with the same fingerprint/provider event ID sees the existing ledger document and immediately returns `duplicate` regardless of failed status, so processing does not resume the unprocessed tail.

**Business impact:** KCPL can permanently apply only part of one carrier message. The EDI ledger says failed/duplicate while shipment state reflects an arbitrary prefix of the message, requiring manual diagnosis and repair.

**Evidence:** Tracking events are committed inside the `for` loop before the ledger is finally set `processed`. Existing inbound transaction documents short-circuit all later ingestion attempts.

**Recommended remediation:** Make inbound ledger processing resumable. Track per-event completion/checkpoints or atomically enqueue normalized events, and allow retries of `failed` transactions while retaining event-level idempotency.

**Test required:** Fail event 2 of 3, retry exact payload, restart process, duplicate concurrent inbound message, and fail after all events but before ledger processed marker. Assert eventual exactly-once event application and `processed` convergence.

---

## EXEC-026 - Tender deadline input semantics depend on browser timezone while outbound display is hardcoded to Nepal time

**Severity:** Medium  
**Confidence:** Medium  
**File / function:** `app/admin/tenders/tms-tender-workspace.tsx` - `localDeadlineDefault()`, `createTender()`, `dateTime()`; `app/admin/tenders/tms-tender-email.server.ts` - `dateTime()`

**State before:** Staff operates outside Nepal or assumes the visible `datetime-local` value is an NPT business deadline.

**Action:** Staff enters a tender deadline in the browser-local field.

**Bad resulting state:** The client converts the browser-local value with `new Date(responseDueAt).toISOString()`, while the workspace display and tender email always render the stored instant in `Asia/Kathmandu` and label it NPT. A Melbourne, Kolkata, or other branch user's typed wall-clock deadline can therefore be shown/sent as a different NPT wall-clock value without an explicit timezone contract in the data entry step.

**Business impact:** Carrier response deadlines can be several hours earlier/later than intended, affecting expiry, retender decisions, and fairness of carrier response handling.

**Evidence:** Browser-local conversion is explicit in `createTender()`. Email/display timezone is hardcoded to `Asia/Kathmandu`. Job File due-date routes use a separate explicit Nepal-offset normalization, demonstrating inconsistent input semantics across execution modules.

**Recommended remediation:** Define the business timezone for every deadline field. Label it in UI and submit an explicit offset/timezone, or store branch/user timezone plus UTC instant. Use the same parsing contract server-side.

**Test required:** Enter identical wall-clock deadlines from Nepal, Melbourne, Kolkata, UTC, and DST transitions; assert displayed/email expiry matches the documented business-timezone rule.

---

# Executive summary

The execution workflow is **not transactionally safe enough to treat the current order/tender/booking/pickup/shipment/Job File state as a hard single source of truth under concurrency**.

The highest-risk defects are not cosmetic validation gaps. They are race conditions and split commits that can create multiple active tenders, two booked shipments for one order, duplicate consolidation hierarchies, a cancelled tender linked to an active shipment, pickup and shipment states that disagree, shipment status jumps that bypass the workflow guard, and even a delivered shipment rolling back to an older movement state when tracking events race.

Digital Job File closure and audit history are also weaker than their UI semantics imply. Closed files remain mutable, task/customs completion provenance can be erased by toggling, and close readiness is validated before a later unversioned close write.

The code contains several good local controls, especially the transactional expiry reconciler, deterministic provider pickup event ledger, required booking reference, batched single-invocation booking writes, and explicit manual workflow guard. The core problem is that these controls are not consistently located at the authoritative write boundary.

**Production execution-integrity verdict:** FAIL for strong exactly-once procurement/booking execution and monotonic shipment-state assurance until the Critical findings and the High race/partial-failure findings are remediated and concurrency-tested.

# Impossible state transitions found

1. One transport order with two simultaneous active tenders, while `active_tender_id` points to only one.
2. Active shipment exists while its tender is `cancelled` and the transport order has been rolled back to `selected`.
3. Old accepted/countered tender books after the order has moved to another tender decision.
4. Two different shipments and two Digital Job Files link to one order/tender.
5. One consolidation load has two different master shipments and duplicate house-shipment trees.
6. Pickup appointment says `picked_up` while shipment `pickup_status` or main tracking state is stale because a split write/side effect failed.
7. Pickup says `missed` while shipment main state remains `delivered`.
8. `booking_confirmed -> in_transit` or other external milestone jumps occur despite the manual workflow guard disallowing that direct transition.
9. Under concurrent tracking commits, a newer `delivered` event can be overwritten by an older event, producing effective `delivered -> in_transit/picked_up` rollback.
10. Digital Job File is `closed` while new/open tasks, customs work, costs, or changed ownership/branch metadata exist without a reopen.

# Race conditions

- active-tender query followed by create batch has no per-order compare-and-set lock;
- tender reject/cancel/direct-expiry response can clear order state after a newer action;
- cancel-versus-book can leave shipment/tender/order mutually inconsistent;
- same tender response can be replayed or competing responses can both pass a stale `sent` check;
- normal booking eligibility is read before a batch with no expected-state precondition;
- consolidation booking has the same stale-read pattern at larger fan-out;
- customer shipment counters are calculated from stale snapshots;
- manual pickup appointment and shipment writes are independent;
- provider pickup state and later tracking promotion are separate commits;
- provider pickup events are deduped by ID but not ordered by event time/state version;
- tracking event dedupe and latest-event promotion are query/read then batch-write operations without compare-and-set;
- manual shipment workflow validation occurs before a separate update transaction;
- Job File close readiness occurs before an independent close batch;
- task/customs toggles are last-writer-wins with no version or immutable transition event;
- outbound EDI queue has no atomic dispatch claim and the same business tender can generate new envelopes on retry;
- multi-event EDI 214 processing commits each event before the message ledger reaches `processed`.

# Audit-history weaknesses

- repeated same-state tender responses change response metadata and append events without a response-version model;
- counteroffer fields are mutable until booking and do not preserve an immutable counter amendment chain;
- pickup state can commit before its appointment/Job File/tracking event history completes;
- Job File task/customs toggles erase prior `completed_at`/`completed_by` when reopened;
- Job File metadata writes can succeed before the audit event write;
- closed Job Files can be mutated without a reopen event;
- tracking duplicate races can create duplicate chronology/activity and exception candidates;
- EDI failed/duplicate ledger semantics do not prove all message events were applied.

# Missing tests

Existing tests reviewed are predominantly pure policy/normalization tests. They validate state helpers and happy-path mappings but do not exercise the Firestore interleavings where the failures above live.

Required additions:

1. Firestore integration concurrency test for one-active-tender uniqueness.
2. Reject/cancel/expire-versus-retender and cancel-versus-book races.
3. Same-response replay and competing carrier-response races.
4. Email/EDI dispatch failure with safe retry and outbox recovery.
5. EDI one-business-tender idempotency across regenerated control numbers and concurrent queue workers.
6. Cross-partner EDI 990 authentication/association tests.
7. Counteroffer approval lifecycle test before booking.
8. 2/10-way normal booking race asserting one shipment/Job File.
9. Stale-tender booking after active pointer changes.
10. Concurrent customer shipment-count updates.
11. Consolidation double-book race with multiple house orders.
12. Fault injection across every pickup appointment/shipment/event/tracking write boundary.
13. Provider pickup reordered unique events and late-event archival.
14. Pickup retry after core commit but tracking failure.
15. Delivered-shipment versus stale pickup action contradictions.
16. Secondary handling-branch Pickup Desk access parity.
17. Tracking workflow-guard bypass tests for every milestone/status pair.
18. Delivered/newer versus older tracking race in both commit orders.
19. Manual shipment PATCH validate/write race.
20. Closed Job File mutation matrix.
21. Task/customs complete-reopen-complete immutable history test.
22. Close versus newly added blocker race.
23. Job File mutation versus audit-event failure injection.
24. EDI 214 fail-mid-message and resume/retry tests.
25. Tender deadline timezone tests across Nepal, Melbourne, Kolkata, UTC and DST boundaries.

The reviewed `tests/tms-tender-policy.test.mjs`, `tests/pickup-appointments.test.mjs`, `tests/tracking-visibility.test.mjs`, `tests/tms-consolidation.test.mjs`, `tests/edi-x12.test.mjs`, and `tests/workflow-navigation.test.mjs` do not provide these transactional/concurrency guarantees.

# Top remediation priorities

1. **Make tender creation and booking true compare-and-set transactions.** The order/tender/load document must be the lock that prevents duplicate procurement and duplicate shipment creation.
2. **Unify shipment-state authority.** Tracking, pickup, manual updates, and EDI must feed one transactional state-transition/reconciliation primitive rather than directly writing `shipments.status` through separate paths.
3. **Adopt durable outbox/inbox processing.** External dispatch and provider ingestion need business-key idempotency, processing state, resumable retries, and atomic claim/lease semantics.
4. **Make pickup state changes atomic and ordered.** Appointment, shipment projection, audit event, and downstream tracking command must converge exactly once.
5. **Enforce Job File closure in the domain layer.** Closed means immutable until an explicit, audited reopen; close must compare against a versioned readiness state.
6. **Make operational history append-only.** Task/customs/tender response transitions need immutable versions/events rather than destructive overwrites.
7. **Add concurrency and fault-injection tests before enabling high-volume carrier automation.** Green pure-function tests are not evidence against these races.

# Reviewed files

Application/domain files:

- `app/admin/tenders/tms-tendering.server.ts`
- `app/admin/tenders/tms-tendering.ts`
- `app/admin/tenders/tms-tender-email.server.ts`
- `app/admin/tenders/tms-tender-expiry.server.ts`
- `app/admin/tenders/tms-tender-workspace.tsx`
- `app/api/admin/tenders/route.ts`
- `app/admin/edi/edi-tender.server.ts`
- `app/admin/edi/edi-gateway.server.ts`
- `app/admin/edi/edi-x12.ts`
- `app/api/integrations/edi/route.ts`
- `app/admin/consolidation/tms-consolidation.server.ts`
- `app/admin/consolidation/tms-consolidation.ts`
- `app/admin/pickups/pickup-appointments.server.ts`
- `app/admin/pickups/pickup-appointments.ts`
- `app/api/integrations/pickups/route.ts`
- `app/admin/visibility/tracking-ingest.server.ts`
- `app/admin/visibility/tracking-visibility.server.ts`
- `app/admin/visibility/tracking-visibility.ts`
- `app/api/integrations/tracking/route.ts`
- `app/admin/job-file.server.ts`
- `app/api/admin/jobs/[reference]/route.ts`
- `app/admin/workflow-guard.server.ts`
- `app/admin/shipment-activity.server.ts`
- `app/api/admin/shipments/[reference]/route.ts`
- `app/shipment-data.server.ts`

Tests/navigation reviewed:

- `tests/tms-tender-policy.test.mjs`
- `tests/pickup-appointments.test.mjs`
- `tests/tracking-visibility.test.mjs`
- `tests/tms-consolidation.test.mjs`
- `tests/edi-x12.test.mjs`
- `tests/workflow-navigation.test.mjs`
- repository `tests/` inventory for adjacent policy coverage

Latest-main coordination reviewed:

- commit `1022caf3bbb8df8133a02a7138355f9480612ed0` added `docs/audits/api-carrier-edi-integrations.md` only;
- commit `54626c0016a63332775539bdcd2d431d0eff94cc` added the finance/freight audit document only;
- no application-code delta after the `d0f74ea572f3efea0a454a97a4fd339f12ed7e20` execution baseline was found before this report write.

# Continuation

If this audit is continued after application fixes land, start by re-reading current `main` and re-auditing the state-changing functions, not by assuming the remediation description was implemented correctly.

Priority re-audit sequence:

1. tender/order transactional invariant and response/cancel/book races;
2. normal and consolidated booking exactly-once behavior;
3. pickup atomic transition/outbox behavior and provider event ordering;
4. shipment transition unification for manual, tracking, pickup, EDI 214, and carrier APIs;
5. closed Job File immutability plus versioned close readiness;
6. immutable task/customs/tender-response history;
7. EDI 204 one-business-command idempotency and queue claim semantics;
8. failed EDI 214 resumability;
9. full emulator/integration concurrency suite with fault injection.

Do not close the Critical findings based only on helper-unit tests. Each Critical race requires a database-level concurrency regression test that proves the invariant under overlapping requests and retry/failure conditions.
