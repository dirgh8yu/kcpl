# KCPL Full System Audit v2 - Stage 3: Execution and External Events

**Audit type:** hostile end-to-end / audit-only  
**Repository:** `dirgh8yu/kcpl`  
**Latest main at final pre-write check:** `fe85403de04d5ff7885bf38ef9981b17ff91a988`  
**Audited application ref:** `61bd787fdf1d76819ca6547e74383a0e751592a6` (`Harden KCPL external event workflow authority (#130)`)  
**Reason application ref differs from final main:** the two later commits add only `docs/audits-v2/02-commercial-chain.md` and `docs/audits-v2/04-finance-settlement.md`; comparison `61bd787f... → fe85403d...` contains no application-code changes.  
**Open PRs at final pre-write check:** none  
**Production data mutated:** no  
**Application code changed:** no

## Audit precondition

The requested Stage 1 input, `docs/audits-v2/01-baseline-architecture.md`, still does **not** exist on current `main`. This was re-checked after `main` advanced during the audit. Stage 2, `docs/audits-v2/02-commercial-chain.md`, is present on the final audited `main` and was read in full.

Stage 2 materially affects this audit because it proves a separate generic quote-`won` shipment creator can bypass TMS booking authority. Stage 3 re-verified that execution path directly rather than merely inheriting the Stage 2 conclusion.

## Executive verdict

**Stage 3 fails canonical execution-completion integrity.**

Remediation #130 substantially fixed the most dangerous provider-side architecture. DHL/Maersk/EDI214/generic tracking now converge on a shared observation path; external observations are not automatically canonical truth; late valid-timestamp events are historical; conflicting target identifiers fail closed; machine sources require canonical primary branch in the shared tracking transaction; severe open/monitoring exceptions block external promotion; international external final-mile promotion requires explicit KCPL Customs release; external Delivered additionally requires verified POD plus a completed KCPL delivery workflow; canonical `delivered` is terminal against provider regression.

The remaining failures sit around that repaired core. Internal/manual execution writers do not all consume the same authority policy. The most serious result is that **manual Delivery Control can directly write canonical `delivered`, update customer completion counters, and bypass Customs, required documents, POD verification, severe exceptions, and the central workflow transition guard**. Other modules can mint the scalar evidence #130 trusts, race around guard checks, or continue mutating supposedly terminal/closed execution state.

The system therefore has a strong external-observation gate surrounded by weaker internal writers. A lock is only as strong as every door into the room.

---

# 1. Findings

## KCPL-V2-EXEC-001 - Manual Delivery Control is an alternate canonical Delivered authority

**Severity:** CRITICAL

**Affected chain:** Delivery attempt → shipment status → CRM counters → POD / closeout

**Evidence:**

- `app/admin/delivery/delivery-control.ts`
  - `deliveryAttemptTransitionAllowed` permits `scheduled → delivered` directly.
  - `deliveryOutcomeValid` requires only a recipient name for `delivered`.
- `app/admin/delivery/delivery-control.server.ts`
  - `updateDeliveryAttempt` transaction validates the delivery-attempt lifecycle, not `validateShipmentTransition`.
  - On `delivered`, it directly writes shipment `status: "delivered"`.
  - It updates `delivery_last_attempt_status`, delivery state and customer active/completed shipment counters in the same transaction.
  - POD can remain `not_received`; the delivery state becomes `delivered_pod_pending`.
  - No required-document query, Customs checklist/release check, severe-exception query, or central workflow-readiness check is performed before canonical delivery.
- `app/api/admin/jobs/[reference]/delivery/route.ts`
  - exposes `update_attempt` to staff with `canManageJobFile`; it does not call the shipment workflow guard before the server mutation.

**Hostile scenario:**

An international shipment has Customs pending, a high open exception, required documents unverified, no POD, and canonical status `preparing` or `in_transit`. Staff schedule a delivery attempt, then update that attempt directly to `delivered` with a recipient name. Delivery Control commits canonical `shipment.status = delivered` and customer completed counters without satisfying the #130 external Delivered gates or the normal direct-shipment workflow guard.

**Impact:**

Canonical Delivered no longer proves current required execution gates were satisfied. CRM completion metrics can become final before POD/Customs/exception closure. Once canonical status is `delivered`, #130 correctly treats that status as terminal against provider noise, which ironically helps preserve the prematurely completed state.

**Remediation direction:**

Make all canonical delivery transitions call one transactional completion authority. Delivery-attempt state and shipment canonical state must be reconciled in the same transaction with current Customs, required-document, POD, exception and workflow evidence. A delivery attempt may record physical evidence before all gates are complete, but it must not directly grant canonical Delivered authority.

---

## KCPL-V2-EXEC-002 - Generic quote-Won can create a parallel execution graph outside TMS booking authority

**Severity:** CRITICAL

**Affected chain:** Quote → Shipment → Job File → Pickup/Tracking/Finance classification

**Evidence:**

- Stage 2 finding `KCPL-V2-COM-004` proves a stale versioned TMS quote can be marked `won` through the generic quote workflow while the Transport Order can continue through authoritative TMS tender/booking.
- `app/shipment-data.server.ts`
  - `ensureShipmentForWonQuote` creates a fresh `KCPL-S-*` shipment when a won quote has no shipment.
  - It seeds workflow tasks, customs steps, document requirements, initial event and customer activity directly inside its own transaction.
  - It does not require tender/booking authority and does not write the TMS booked tender/procurement/commercial-lineage graph.
  - `branchValue` defaults invalid customer branch data to `Kathmandu`, and the new shipment uses that value as `primary_branch`.
  - workflow task/customs child IDs are random UUID based rather than the deterministic booking-seed IDs used by #127.
- The authoritative TMS path instead writes tender/order/booked commercial lineage and then calls deterministic `ensureBookingArtifacts`.

**Hostile scenario:**

V1 customer quote becomes stale after repricing to V2. V1 is marked Won through the generic quote path, creating Shipment A and a complete-looking Job File. V2 then proceeds through tender and booking, creating Shipment B with booked commercial lineage. Operations can now schedule pickup, upload documents and track Shipment A even though it never passed the TMS booking authority.

**Impact:**

There can be two execution truths for one commercial movement, with different economics, different shipment references and different downstream classification. The generic graph also fabricates canonical branch authority from customer data/Kathmandu fallback rather than inheriting a booked Transport Order authority. This defeats the premise that Booking is the unique handoff into execution.

**Remediation direction:**

TMS-originated/versioned quotes must have exactly one shipment-creation authority. Reject generic quote-Won shipment creation for TMS-linked quotes or route the action through the authoritative booking transaction. New execution records must inherit canonical branch and commercial lineage from the booked source, never reconstruct them from customer fallbacks.

---

## KCPL-V2-EXEC-003 - Customs release can be minted without the readiness state that consumers assume

**Severity:** HIGH

**Affected chain:** Customs desk → #130 external final-mile gate → Delivered

**Evidence:**

- `app/admin/customs/customs-policy.ts` can calculate blocked Customs state from holds, missing documents and open required steps.
- `app/admin/customs/customs-clearance.server.ts` `updateCustomsClearance` does not consume that readiness state before writing the authoritative shipment scalar.
- A `released` update requires an entry point plus a declaration reference or short free-text release evidence, but does not require:
  - required customs steps complete,
  - required operational documents verified,
  - prior hold resolution from the wider execution graph,
  - severe exception clearance,
  - a compare-and-set against the current Customs state.
- `app/admin/visibility/external-workflow-state.ts` appropriately trusts explicit KCPL `customs_clearance_status === "released"` when evaluating provider final-mile promotion.

**Hostile scenario:**

Required customs steps and documents remain incomplete. Staff writes Customs `released` with a declaration/reference or free-text evidence. A later carrier Out-for-delivery/Delivered observation sees the persisted KCPL release flag as valid Customs authority.

**Impact:**

The strong #130 consumer can be unlocked by a weaker producer. Tracking itself does not fabricate Customs, but the scalar release state is not strong enough to mean what the reconciliation engine assumes it means.

**Remediation direction:**

Create one transactional Customs-release authority that validates current required customs steps, relevant document readiness, holds and branch authority before writing `released`. Provider tracking may observe Customs milestones but must never substitute for that authority.

---

## KCPL-V2-EXEC-004 - Document review/delete TOCTOU can create a verified phantom document

**Severity:** HIGH

**Affected chain:** Document Vault → required-document readiness → workflow/Delivered/closeout

**Evidence:**

- `app/api/admin/shipments/[reference]/documents/[id]/route.ts`
  - PATCH reads metadata, validates the requested transition, then separately calls `updateShipmentDocumentControl`.
  - DELETE separately reads metadata, authorizes deletion, then calls `deleteShipmentDocument`.
- `app/shipment-documents.server.ts`
  - `updateShipmentDocumentControl` re-reads the document but does not re-run transition validation against that fresh state; it writes the requested review status in a non-transactional batch.
  - `deleteShipmentDocument` tombstones metadata then deletes the storage object.
- `app/admin/workflow-guard.server.ts`
  - required-document readiness counts active metadata whose review state is `verified` and unexpired.
  - it does not verify blob existence, `storage_deleted_at`, or object availability before counting the document ready.

**Hostile scenario:**

Reviewer A validates `received → verified`. Concurrent reviewer B deletes the same still-received document and the blob is removed. A then enters `updateShipmentDocumentControl`, which writes `review_status: verified` over the tombstone. Download returns object-missing, but workflow readiness counts the metadata as a verified required document.

**Impact:**

A missing physical document can satisfy required-document and POD-style metadata gates. The risk is concurrency, not public file exposure: storage itself is private/no-store and normal upload validation is strong.

**Remediation direction:**

Move transition validation and update into one Firestore transaction with current-version/CAS semantics. Deletion/supersession/review must be mutually exclusive lifecycle transitions. Readiness should additionally require a non-deleted storage binding and, where practical, a durable object-presence invariant rather than trusting review metadata alone.

---

## KCPL-V2-EXEC-005 - #128 canonical primary-branch authority is not uniformly enforced by Pickup, Customs and Delivery

**Severity:** HIGH

**Affected chain:** branch authority → Pickup / Customs / Delivery canonical mutation

**Evidence:**

- `app/admin/shipment-access-policy.ts` correctly requires a valid canonical `primary_branch`; `checkShipmentBranchAccess` fails closed otherwise.
- `app/api/admin/shipments/[reference]/route.ts` and Job File routes use that strict guard.
- In contrast:
  - `app/admin/pickups/pickup-appointments.server.ts` `shipmentScope` accepts `primary_branch ?? handling_branches[0]`.
  - `app/api/admin/pickups/route.ts` relies on that helper and has no separate strict shipment-branch pre-guard.
  - `app/admin/delivery/delivery-control.server.ts` builds access from primary plus handling and sets its working primary to `primary ?? branches[0]`.
  - `app/api/admin/jobs/[reference]/delivery/route.ts` relies on that helper and has no strict `checkShipmentBranchAccess` pre-guard.
  - `app/admin/customs/customs-clearance.server.ts` authorizes using the looser branch-set policy; `app/api/admin/customs/[reference]/route.ts` has no strict pre-guard.

**Hostile scenario:**

A malformed/legacy shipment has no valid `primary_branch` but retains a valid handling branch. Shared machine tracking correctly returns invalid branch. A staff member in the handling branch can still schedule/complete pickup, write Customs release or use Delivery Control, including the direct Delivered path in EXEC-001.

**Impact:**

The same shipment has different branch truth depending on the module. #128's canonical primary-branch invariant is therefore not a system-wide execution invariant.

**Remediation direction:**

Use the strict canonical shipment access policy for every authority-sensitive execution mutation. Handling branches may grant collaboration only after a valid primary branch exists; they must never substitute for missing canonical primary authority.

---

## KCPL-V2-EXEC-006 - Manual pickup updates are not transactionally coupled to shipment pickup state

**Severity:** HIGH

**Affected chain:** Pickup appointment → shipment pickup projection → tracking promotion

**Evidence:**

- `app/admin/pickups/pickup-appointments.server.ts`
  - `confirmPickup`, `assignPickupDriver`, `completePickup`, `missPickup` and `cancelPickup` read the appointment and then perform appointment and shipment updates with separate writes/`Promise.all`, not a Firestore transaction/CAS.
  - the provider pickup path in `app/api/integrations/pickups/route.ts` does use a transaction and revalidates state, demonstrating the intended safer pattern.

**Hostile scenario:**

Staff cancels while another staff/provider action completes or reassigns the same appointment. Each actor validated an older state. Appointment status and shipment `pickup_status` can be written in a different interleaving, leaving one `cancelled` and the other `picked_up`/`confirmed`.

**Impact:**

#130 promotion logic consumes shipment pickup state. A torn manual pickup graph can therefore influence later external canonical reconciliation even though the provider ingestion transaction itself is safe.

**Remediation direction:**

Serialize every pickup lifecycle mutation through one transaction that rereads shipment + deterministic appointment + expected state/version and writes both projections atomically. Ancillary activity/tracking effects should be deterministic and retryable.

---

## KCPL-V2-EXEC-007 - Provider pickup events have no appointment-generation or event-time ordering guard

**Severity:** HIGH

**Affected chain:** provider pickup → appointment → shipment pickup projection → tracking

**Evidence:**

- `app/api/integrations/pickups/route.ts` provides strong per-event idempotency and transactional state revalidation.
- Cancelled and picked-up appointment states are terminal, so a provider event cannot resurrect a currently cancelled appointment.
- However, the transaction does not compare provider `eventTime` with appointment `updated_at`, the current confirmed window, or an appointment generation/version.
- A distinct stable provider event ID is sufficient to make an older event a new event for idempotency purposes.
- The pickup domain mutation also does not reject a shipment merely because the shipment canonical status is already `delivered`.

**Hostile scenario:**

An appointment is rescheduled/confirmed for a newer window. A genuinely old carrier event with a unique provider event ID arrives late. If its transition is legal from the *current* appointment status, it can cancel or complete the newer appointment despite an older event timestamp. Similarly, a late pickup event can change subordinate pickup state after the shipment is already Delivered.

**Impact:**

Provider events cannot resurrect a currently cancelled appointment, but stale physical evidence can still overwrite a newer appointment generation or mutate a terminal shipment's subordinate execution graph.

**Remediation direction:**

Version pickup appointments/generations and bind provider events to the intended generation where available. Reject or archive older event-time transitions without changing current pickup state. Enforce shipment terminal/closed rules in the pickup transaction.

---

## KCPL-V2-EXEC-008 - Booking can commit while the execution graph is missing or only partly seeded

**Severity:** HIGH

**Affected chain:** Tender → Booking → Shipment → Job File artifacts

**Evidence:**

- `app/admin/tenders/tms-tendering.server.ts` commits the authoritative standard booking transaction first, including shipment, quote bridge, customer counter, tender/order booked state and booked commercial lineage.
- Only after that transaction succeeds does it call `ensureBookingArtifacts`.
- `app/admin/tenders/tms-booking-artifacts.server.ts` uses deterministic IDs and a seed marker, so retries can repair missing artifacts safely.
- Consolidation booking similarly commits the master/house booked graph, then sequentially seeds master and house artifacts. A failure midway can leave a mixed seeded/unseeded consolidation.

**Hostile scenario:**

The booking transaction succeeds, then artifact seeding throws. The API returns unavailable even though booking is durable. Before an operator retries the same booking path, Pickup/Shipment/other modules can observe a booked shipment whose required tasks/customs/document requirements/activity graph is absent. In consolidation, some houses can be seeded while others are not.

**Impact:**

The answer to “Can booking succeed while execution graph is incomplete?” is **yes**. #127 gives excellent deterministic retry repair, but does not make the Booking → Execution handoff atomic or self-healing without a retry trigger.

**Remediation direction:**

Keep deterministic artifact IDs, but add a durable outbox/readiness state or transactional handoff marker that prevents downstream execution until seeding is complete and can be automatically repaired. For consolidation, readiness should be load-wide if operations require all master/house Job Files to exist together.

---

## KCPL-V2-EXEC-009 - Invalid or missing machine event time is promoted to “now,” defeating #130 ordering guarantees

**Severity:** HIGH

**Affected chain:** DHL/Maersk/EDI214/generic observation → ordering → ETA/location/canonical promotion

**Evidence:**

- `app/admin/visibility/tracking-visibility.server.ts` sets:
  - `eventTime = validIso(input.eventTime) ?? new Date().toISOString()`.
- Late/historical determination and “latest” ETA/location/external milestone updates then use this synthesized time.
- EDI214 passes `event.eventTime || ""`, so missing parsed event time reaches the fallback.

**Hostile scenario:**

A stale carrier event arrives with malformed or absent event time. Instead of being rejected/unknown-time evidence, it becomes a fresh event at receipt time. It can become the newest external milestone, update current location/ETA, and, if all canonical gates are otherwise satisfied, receive promotion authority that a correctly timestamped stale event would not have.

**Impact:**

The core #130 rule “late observations are historical and cannot regress/promote current state” is only as good as the timestamp parser. Unknown time currently gains maximum freshness.

**Remediation direction:**

For machine events, reject invalid event timestamps when the provider contract requires one. Otherwise represent `observed_at = null` separately from `received_at` and prohibit unknown-time events from winning latest-state or canonical-promotion decisions.

---

## KCPL-V2-EXEC-010 - EDI214 outer idempotency can freeze a partially processed multi-event message

**Severity:** HIGH

**Affected chain:** EDI214 envelope → multiple normalized observations → canonical reconciliation

**Evidence:**

- `app/admin/edi/edi-gateway.server.ts` creates one deterministic outer `edi_transactions` ledger record per inbound message/provider event ID.
- `process214` loops AT7 events, each of which is individually retry-safe through `recordOrderedTrackingEvent`.
- Per-event outcomes other than `created`/`duplicate` are not converted into an overall failure before the outer transaction is marked `processed`.
- If an exception occurs after earlier event commits, the outer ledger is marked `failed`.
- `ingestEdiPayload` immediately returns `duplicate` for any existing outer ledger record regardless of `queued`, `failed`, `quarantined` or `processed` state, so an identical retry does not resume remaining events.

**Hostile scenario:**

A 214 contains three events. Event 1 commits. Event 2 throws because of a transient backend failure. The outer ledger becomes failed. Carrier retries the identical 214. The outer fingerprint already exists, so ingestion returns duplicate without replaying event 2/3. Conversely, a non-created per-event result can be silently skipped while the envelope is marked processed.

**Impact:**

#130's deterministic per-observation repair is defeated by a less capable envelope-level idempotency layer. Shipment history can be permanently incomplete even under correct carrier retry behavior.

**Remediation direction:**

Make the outer ledger resumable. Persist per-event processing state/fingerprints and allow failed/queued envelopes to continue idempotently. Only mark the envelope processed when every event reached an explicit terminal outcome such as created, duplicate or intentionally quarantined.

---

## KCPL-V2-EXEC-011 - Workflow guard decisions are not atomic with status change or Job File close

**Severity:** HIGH

**Affected chain:** documents/customs/exceptions/tasks → direct status PATCH / closeout

**Evidence:**

- `app/api/admin/shipments/[reference]/route.ts` calls `validateShipmentTransition`, then separately calls `updateShipment`.
- `updateShipment` starts a new transaction and rereads the shipment, but does not re-read/revalidate the document, customs, task and exception evidence used by the prior guard decision.
- `app/admin/workflow-guard.server.ts` `closeShipmentJob` similarly calculates readiness before a later batch that writes `job_closed_at`.
- Management may explicitly override blockers with a reason of at least eight characters; that is an intentional escape hatch, separate from the race.

**Hostile scenario:**

Transition validation sees all documents verified, Customs released and no blocker. Before `updateShipment` commits Delivered, another actor deletes a required document, opens a high exception or places Customs on hold. The later status transaction still commits based on the stale validation result. The same check-then-write window exists for closing a Job File.

**Impact:**

Even the central guard cannot guarantee that the gates were true at the instant canonical state changed. Direct API status mutation is therefore safer than Delivery Control but still not serializable against gate mutations.

**Remediation direction:**

Move transition/close authorization into a transaction or use a workflow revision/fingerprint that all gate-changing operations update. The canonical write must fail if the authority revision changed after validation. Define which Management overrides are intentionally allowed and audit them separately from concurrency success.

---

## KCPL-V2-EXEC-012 - Closed is not terminal against provider reconciliation or child-state mutation

**Severity:** HIGH

**Affected chain:** Job File close → tracking/pickup/tasks/customs

**Evidence:**

- `closeShipmentJob` normally requires Delivered and all closeout blockers cleared, but Management can override any close blocker with an eight-character reason, including “shipment must be Delivered.”
- `app/admin/visibility/external-workflow-state.ts` evaluates canonical shipment status, pickup, Customs, POD and exceptions, but not `job_closed_at`.
- Therefore a non-Delivered shipment closed via Management override can later receive an external machine observation that promotes canonical status while the Job File remains closed.
- `toggleJobTask` and `toggleCustomsStep` do not reject `job_closed_at`; stale/manual child actions can continue changing closed-job readiness state.

**Hostile scenario:**

Management override-closes an `in_transit` shipment for an exceptional reason. A later valid carrier Out-for-delivery event arrives. Because `job_closed_at` is not a reconciliation blocker and canonical status is not Delivered terminal, #130 can advance the shipment while its Job File remains closed.

**Impact:**

`Closed` is a label, not a terminal execution invariant. Provider noise cannot regress canonical Delivered, but it can mutate canonical workflow after an overridden non-Delivered close. Human child-state changes can also continue after close.

**Remediation direction:**

Decide whether Closed is terminal. If yes, make `job_closed_at` a hard blocker for machine promotion and operational child mutation until explicit Management reopen. If override-close-before-delivery must exist, it should represent a distinct suspended/administratively-closed state rather than normal operational closure.

---

## KCPL-V2-EXEC-013 - Set-based matching is safe but current identifier schemas make valid consolidated observations unmatchable or ambiguous

**Severity:** MEDIUM

**Affected chain:** Maersk / EDI214 → target resolution → master/house tracking

**Evidence:**

- #128's set-based principle holds: Maersk and EDI214 union all supplied identifiers and require exactly one canonical shipment. Conflicting identifiers do not use first-match-wins.
- Standard TMS booking stores the carrier booking reference in `carrier_reference`; it does not populate top-level `booking_reference` on the shipment.
- Maersk's `carrierBookingReference` lookup targets `booking_reference`.
- EDI214 direct reference matching accepts only `KCPL-S-*`, so consolidation master references `KCPL-M-*` do not resolve through the direct-reference branch.
- Consolidation master/houses can share carrier-reference context, so a carrier-ref-only observation can produce multiple candidates. A tender reference can identify the master while another supplied shared identifier adds houses, correctly causing ambiguity/quarantine.

**Hostile scenario:**

A legitimate 214/DCSA event for a consolidation supplies the master reference and/or carrier booking identifiers but not the exact field combination KCPL stores. The safe union resolver yields missing or multiple candidates and quarantines the event.

**Impact:**

No wrong shipment mutation was proven, which is the important #128 success. The failure is availability/visibility: valid carrier evidence can disappear into unmatched/ambiguous queues, especially for master/house movements.

**Remediation direction:**

Define one canonical external-identifier registry/binding model for shipment, master and house records. Populate it at booking from immutable carrier/tender facts and make all providers query the same normalized bindings. Preserve exactly-one-set resolution.

---

## KCPL-V2-EXEC-014 - Job task/customs toggles are stale last-write-wins operations

**Severity:** MEDIUM

**Affected chain:** Job File tasks/customs → readiness → delivery/closeout

**Evidence:**

- `app/admin/job-file.server.ts` `toggleJobTask` and `toggleCustomsStep` load the Job File, read the child, then issue a direct child update.
- No child revision/expected-state token is used.
- No closed-job/terminal-state check is made by the toggle helper.
- The live API does perform strict shipment and child branch guards first, so the older helper branch fallback is **not** being classified here as a reachable branch bypass through that API.

**Hostile scenario:**

Two staff members open the same task/customs step. One completes it after updated evidence; the other submits a stale reopen/complete action from an old page. Last write wins and readiness changes with no conflict signal. The same action can occur after Job File closure.

**Impact:**

Required Customs/task readiness is vulnerable to stale UI state and concurrent staff actions, which can combine with EXEC-003/011 to create inconsistent completion evidence.

**Remediation direction:**

Use expected revision/state in child mutations and reject stale updates. Closed jobs should require explicit reopen before operational child state can change.

---

## KCPL-V2-EXEC-015 - Manual exception resolution/reopen is not compare-and-set protected

**Severity:** MEDIUM

**Affected chain:** severe exception → resolution/monitoring/reopen → external promotion

**Evidence:**

- `app/admin/shipment-exceptions.server.ts` `updateShipmentException` reads current exception state, validates a transition, then later commits a batch update without a transaction/CAS on the previously-read state.
- #130 correctly queries high/critical `open` and `monitoring` exceptions before machine promotion and does not auto-resolve them.

**Hostile scenario:**

Two staff actors concurrently resolve/reopen or move the same severe exception between monitoring/open/resolved based on stale reads. One valid transition can overwrite the other after both passed their own pre-checks.

**Impact:**

Tracking does not auto-resolve severe exceptions and will not miss a correctly persisted active blocker, but human concurrency can leave the persisted blocker state different from the transition history users believed they recorded.

**Remediation direction:**

Transactionally validate the current exception status and write the next state with expected-version/CAS semantics.

---

# 2. Defenses that held under hostile review

The following requested attacks did **not** produce a supported-path bypass on the audited application ref:

- **Stale tender → booking:** authoritative TMS booking rereads tender/order/commercial version and blocks stale/non-authoritative tender state. A stale tender cannot simply create a booking.
- **Booked commercial lineage:** normal standard and consolidation booking preserve immutable booked lineage. The live admin dispatcher uses the lineage-aware consolidation wrapper; the older consolidation core remaining in the tree is not the live booking authority.
- **Provider-specific direct status mutation:** DHL, Maersk/DCSA, EDI214 and generic tracking converge on the shared normalized tracking authority. No provider-specific side route was found directly writing `shipment.status`.
- **Provider observation vs canonical truth:** #130 separates observed milestone fields from canonical status and records promotion decision/reason.
- **Duplicate normalized observations:** deterministic fingerprints and deterministic ancillary effect IDs make shared tracking retries repairable.
- **Late valid-timestamp tracking events:** do not overwrite newest location/ETA or regress/promote canonical state.
- **Canonical Delivered against provider noise:** once canonical status is `delivered`, machine observation promotion is terminal/no-change.
- **External Delivered gates:** external provider Delivered is blocked unless current KCPL requirements include Customs release where applicable, verified POD, completed KCPL delivery workflow and no active high/critical open/monitoring exception.
- **Tracking auto-resolution:** shared tracking opens deterministic derived exceptions but does not auto-resolve severe manual exceptions.
- **Provider-created Customs release:** no tracking path was found that directly writes KCPL Customs `released` authority.
- **Cancelled pickup resurrection:** the provider pickup transaction treats current `cancelled` appointment as terminal; it stores conflicting provider evidence for reconciliation rather than resurrecting it.
- **Target matching correctness:** conflicting existing shipment identifiers in Maersk/EDI214 yield ambiguity/quarantine, not first match.
- **Machine-secret isolation:** `KCPL_EDI_SECRET`, `KCPL_TRACKING_INGEST_SECRET`, `KCPL_PICKUP_INTEGRATION_SECRET`, `MAERSK_WEBHOOK_SECRET` and `KCPL_AUTOMATION_SECRET` remain isolated by the shared machine-auth policy. No cross-secret fallback or browser-session fallback was found in those machine routes.
- **Secret exposure:** no credential values were found intentionally logged or projected into client bundles in the audited paths.
- **GPT distinction:** GPT responses retain backwards-compatible `status`/`statusCounts` while exposing canonical workflow status separately from observed external milestone. The read model states the observation semantics rather than implying provider evidence is canonical truth.
- **GPT sanitization:** recursive sanitization remains in place for secret/credential/token fields, raw EDI/X12 payloads, storage paths and private/signed URLs.
- **Document transport/storage:** shipment document downloads are server-mediated, `private, no-store`, and uploaded objects are not exposed through public signed URLs in the audited flow. The finding is lifecycle concurrency, not storage publicity.

---

# 3. Requested cross-system failure chains

## A. stale tender → booking → pickup

**Result: blocked at booking on the normal TMS path.**

Tender/order/current commercial authority is transactionally reread. However, EXEC-002 provides a different path around tender/booking entirely through generic quote-Won shipment creation, and EXEC-008 allows a valid booking to become visible before deterministic execution artifacts finish seeding.

## B. provider pickup → shipment state → tracking

**Result: partially safe.**

The provider pickup domain transaction is atomic and idempotent, and the subsequent observation goes through #130. Cancelled pickup is not resurrected. The remaining defects are stale event chronology/generation (EXEC-007) and split-brain manual pickup state (EXEC-006).

## C. carrier Delivered → Customs pending → POD missing

**External-only result: blocked.** #130 records the observation but does not promote canonical Delivered.

**System-wide result: bypassable.** Manual Delivery Control can directly create canonical Delivered with Customs pending and POD missing (EXEC-001). Weak manual Customs release can also satisfy the scalar release prerequisite without full Customs readiness (EXEC-003).

## D. carrier Delivered → Freight Audit/finance interprets shipment as complete

**Freight Audit lineage result: largely contained.** The audited Freight Audit/settlement lineage resolver uses immutable booked commercial authority rather than treating provider Delivered as procurement truth.

**Operational/CRM result: unsafe.** EXEC-001 updates the customer's active/completed shipment counters at manual Delivered before POD/Customs/exception gates. Separately, Stage 2's generic quote-Won shipment can evade TMS-lineage classification altogether (EXEC-002).

## E. wrong shipment matched by EDI214 → canonical mutation

**Result: no first-match-wins mutation found.** Conflicting candidate identifiers union to multiple shipments and the message is quarantined. The residual risk is incomplete processing/retry (EXEC-010) and valid-event matching availability (EXEC-013), not proven wrong-target mutation.

## F. house/master consolidation tracking confusion

**Result: fail-closed but operationally weak.** Shared carrier identifiers across master/houses can produce ambiguity; EDI214 direct reference matching does not accept `KCPL-M-*`; Maersk carrier-booking lookup does not align cleanly with the TMS shipment field used for that booking reference. This is EXEC-013.

---

# 4. Direct answers to Stage 3 questions

| Question | Answer |
|---|---|
| Can booking succeed while the execution graph is incomplete? | **YES.** Booking commits before post-transaction artifact seeding; retries can repair. |
| Can provider event resurrect a currently cancelled pickup? | **NO.** Current cancelled pickup is terminal in provider transition policy. |
| Can an older unique provider pickup event mutate a newer appointment generation? | **YES.** No event-time/generation ordering guard. |
| Can pickup state tear under concurrent manual/provider/staff actions? | **YES.** Manual writers are not transactional with shipment pickup projection. |
| Can required document gates be bypassed by simple unverified upload metadata? | **NO.** Normal readiness requires verified/unexpired metadata. |
| Can document lifecycle concurrency create false verified readiness? | **YES.** Delete/review TOCTOU can produce verified metadata with missing blob. |
| Can a provider-specific tracking path directly mutate `shipment.status` outside #130? | **No supported path found.** |
| Can malformed machine event time defeat late-event protection? | **YES.** It falls back to receipt-time “now.” |
| Can provider tracking fabricate KCPL Customs release? | **NO.** |
| Can KCPL staff fabricate/under-prove the Customs release scalar that tracking trusts? | **YES.** |
| Can a severe open/monitoring exception be missed by #130 external promotion? | **No supported query-gap found.** |
| Can tracking auto-resolve that exception? | **NO.** |
| Can manual Delivered skip that exception? | **YES.** |
| Can external Delivered skip Customs/POD/delivery workflow gates? | **NO.** |
| Can manual Delivered skip them? | **YES.** |
| Can provider Delivered plus manual Delivered double-increment customer completion counters? | **No simple path found.** Counter adjustment checks the current canonical Delivered state. Duplicate ancillary manual event/activity noise is still possible. |
| Can provider noise regress canonical Delivered? | **NO.** |
| Can provider noise mutate a Job File that is Closed via non-Delivered management override? | **YES.** Closed is not part of #130 promotion authority. |
| Is first-match-wins still present for Maersk/EDI214 target matching? | **NO.** Set-based exactly-one matching holds. |
| Are machine secrets cross-fallback compatible? | **NO.** Isolation holds. |
| Does GPT conflate observed carrier milestone with canonical status? | **NO supported conflation found in the audited read model.** |

---

# 5. Remediation interaction assessment

## #127 - Tender / booking / consolidation concurrency

**What held:** booking core transactions, stale tender resistance, deterministic seed IDs, retryable artifact repair, consolidation booked-graph consistency.

**What remains:** booking-to-execution seeding is post-commit and can expose a durably booked but incompletely initialized execution graph (EXEC-008). Manual pickup state did not inherit the same transaction/CAS discipline (EXEC-006).

## #128 - RBAC / trust boundaries

**What held:** strict shipment access policy exists; direct shipment API and Job File routes use it; machine tracking requires canonical primary branch; set-based target matching rejects ambiguity; machine secrets are isolated.

**What remains:** Pickup, Customs and Delivery do not all route through the strict canonical primary-branch policy (EXEC-005). The generic quote-Won creator can also fabricate new shipment primary branch from customer/Kathmandu fallback (EXEC-002).

## #130 - External event workflow authority

**What held:** provider observation/canonical distinction, monotonic promotion, late-event handling for valid timestamps, deterministic observations/effects, severe-exception blockers, external Customs/POD/delivery gates, Delivered terminal protection, GPT semantics.

**What remains:** invalid timestamp fallback can convert stale evidence into fresh evidence (EXEC-009); EDI envelope-level replay semantics can defeat per-observation repair (EXEC-010); provider reconciliation does not treat Closed as terminal (EXEC-012); and, most importantly, internal/manual writers can bypass or cheaply mint the canonical evidence #130 consumes (EXEC-001/003/004/011).

---

# 6. Stage 3 conclusion

The central lesson is not that #130 failed. Its shared external-observation engine is one of the stronger parts of the current execution architecture. The failure is **authority composition**.

KCPL currently has at least four different ways to affect completion truth:

1. shared external reconciliation,
2. direct shipment workflow guard,
3. Delivery Control,
4. Customs/document/Job File evidence writers.

Those paths do not serialize against the same current evidence and do not all require the same canonical branch or terminal-state policy. On top of that, Stage 2's generic quote-Won route can create a completely separate execution graph without TMS booking authority.

Therefore the authoritative Stage 3 answer is:

> **Provider observations are now mostly observations rather than canonical truth, but KCPL still cannot guarantee that canonical completion means every current required execution gate was satisfied. Internal/manual side paths can bypass, race, or manufacture the evidence used by the repaired external gate.**

No application code was changed during this audit.