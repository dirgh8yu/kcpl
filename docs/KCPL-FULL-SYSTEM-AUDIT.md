# KCPL Full System Audit

**Lead-review baseline:** `main` at `6a9f9996432d9e9fa91a8229a23fe498b6133e38` before this report commit.  
**Review date:** 2026-08-22  
**Scope:** all six specialist audits plus current-main cross-module verification.  
**Method:** audit only. No application code, production state, live provider, or bank mutation was performed. All six specialist reports were read, important findings were rechecked against current `main`, duplicate root causes were merged, speculative claims were challenged, and severity was normalized to the requested KCPL model.

## 1. Executive Summary

KCPL is **not production-ready**. The lead review retains **62 verified findings: 0 P0, 29 P1, 29 P2, and 4 P3**.

The largest system risks are not isolated UI bugs or individual missing checks. They are cross-module invariant failures:

1. **Commercial truth is mutable across the lifecycle.** Rate selection, pricing approval, quote, tender, carrier counter, booking, Freight Audit, payment and profitability are not bound to one immutable commercial version.
2. **Critical state machines use stale read -> validate -> batch/write flows.** Tendering, booking, consolidation, tracking and AP/AR payments can race and create locally valid but globally contradictory records.
3. **Trust boundaries vary by entry point.** Human Firebase sessions, configured-admin email, helper functions, EDI, pickup automation and Custom GPT do not all apply the same branch/object authority.
4. **External movement events have weaker workflow gates than human updates.** Carrier/EDI events can mutate canonical shipment state without the same customs/document controls enforced by the human shipment transition route.
5. **Finance can record incorrect settlement/profitability state.** AP/AR payment concurrency, Match-Pay basis mismatch, invoice idempotency gaps and multi-currency omission are release blockers.

No P0 was verified. Current code review did not establish direct unauthorized bank disbursement, catastrophic data loss, arbitrary systemic takeover, or another event meeting the supplied P0 threshold. Several specialist findings originally labelled Critical are therefore normalized to P1.

### Verified finding counts

| Severity | Count |
|---|---:|
| P0 Critical | 0 |
| P1 High | 29 |
| P2 Medium | 29 |
| P3 Low | 4 |
| **Total** | **62** |

## 2. Overall System Risk Score

Scores are /10 where 10 is excellent.

| Area | Score /10 | Lead-review rationale |
|---|---:|---|
| Security | 4.0 | Authentication primitives exist, but persistent RBAC can be overridden, object scope is inconsistent, service secrets are broad, and GPT is not branch-scoped. |
| Financial integrity | 3.0 | Payment, Match-Pay, invoice identity and profitability defects can produce incorrect financial results. |
| Operational integrity | 3.0 | Tender, booking, consolidation, pickup, tracking and closeout can diverge or race. |
| Data integrity | 3.5 | Versionless commercial truth, stale aggregates and split writes can create contradictory records. |
| Integration reliability | 2.5 | EDI/DCSA/DHL identity, ordering, validation, replay and recovery need significant hardening. |
| Performance | 3.5 | Broad scans, N+1 work and write-on-read dashboards remain. |
| UI reliability | 4.0 | Command ownership, deep-link state, failure isolation and mobile parity remain weak. |
| **Overall indicative score** | **3.4** | P1 release blockers dominate. |

## Master Finding Table

| Master ID | Original audit ID(s) | Severity | Confidence | Subsystem | Affected files/endpoints | Summary | Business impact | Exploit/reproduction | Evidence | Recommended fix | Regression test required | Fix dependency | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| KCPL-FSA-001 | SEC-001 | P1 | High | Identity / RBAC | `app/admin/staff-directory.server.ts` | Configured admin email overrides an existing narrower staff profile and resolves as management/all branches. | Systemic role/branch privilege escalation. | Give a configured admin email a persisted non-management selected-branch profile, then resolve staff context. | `getStaffContext()` explicitly constructs `role=management`, `branch_scope=all` and all branches for `isConfiguredAdmin(email)` even when a narrower profile exists. | Make persisted active profile authoritative after explicit one-time bootstrap; fail closed on missing/inactive profile. | Yes | None. First security fix. | Open |
| KCPL-FSA-002 | SEC-002 | P1 | High | EDI / RBAC | `POST /api/admin/edi`; `edi-tender.server.ts` | Admin EDI dispatch accepts caller-supplied tender ID without object-level branch authorization. | Cross-branch tender mutation and outbound EDI creation. | Branch-limited commercial user POSTs another branch's known `tenderId` to `queue_204`. | Route checks capability/same-origin then calls `queueTenderAsEdi204(tenderId, actor)` without StaffContext; helper has no branch check. | Pass StaffContext into helper and authorize the tender object's branch before mutation. | Yes | Prefer KCPL-FSA-001 first. | Open |
| KCPL-FSA-003 | SEC-003 | P1 | High | Finance / RBAC | finance customer-link route; `finance-linking.server.ts` | Finance customer-linking can mutate shipment/customer relationship before branch-scoped invoice authorization. | Cross-branch CRM/shipment ownership and invoicing corruption. | Accounts user submits another branch's shipment reference to customer-link/invoice resolution. | Linking helpers accept no StaffContext and can set `shipment.customer_id`; authorization can occur after that side effect. | Authorize shipment/customer object scope before any create/link side effect; commit authorized linkage atomically. | Yes | Prefer KCPL-FSA-001 first. | Open |
| KCPL-FSA-004 | SEC-005 | P1 | High | Integration auth | `/api/integrations/pickups`; `/api/internal/automation` | External pickup integrations and internal automation share `KCPL_AUTOMATION_SECRET`. | One credential compromise expands into internal scheduler capability. | Use the pickup bearer against the internal automation endpoint. | Both routes validate the same environment secret. | Split scoped secrets/service identities and rotate the shared secret. | Yes | Deployment/secret rotation. | Open |
| KCPL-FSA-005 | TMS-013, EXEC-001, EXEC-002, EXEC-003, EXEC-009 | P1 | High | Tendering | `tms-tendering.server.ts` | One-active-tender/current-tender invariants are not transactional; stale tender actions can overwrite newer order state. | Competing tenders, wrong tender booking, workflow rollback. | Race tender creation or act on an old tender after retendering. | Create/respond/cancel/book read state before later batches; reject/expire/cancel can clear order state without asserting current `active_tender_id`. | Transactional tender state machine with order version/current tender assertion and uniqueness key. | Yes | Foundational. | Open |
| KCPL-FSA-006 | TMS-005, EXEC-008 | P1 | High | Booking | `tms-tendering.server.ts` | Booking is not exactly-once. | Duplicate shipment/Job File and downstream work. | Send two booking confirmations before either write is visible. | Booking creates random shipment reference in a plain batch with no deterministic tender/order idempotency claim. | Deterministic booking key plus transaction that atomically claims tender/order. | Yes | KCPL-FSA-005 recommended. | Open |
| KCPL-FSA-007 | TMS-006, TMS-007, EXEC-011 | P1 | High | Consolidation | `tms-consolidation.server.ts` | House membership, release and consolidated booking use stale reads without CAS. | Double membership, duplicate release/booking, contradictory master/house state. | Race add-to-load, release or confirm-booking requests from the same snapshot. | Add/remove/release/confirm paths use independent reads and plain batches without transactional re-read of membership/booked preconditions. | Versioned transactional membership/release/booking with deterministic booking IDs. | Yes | Foundational consolidation fix. | Open |
| KCPL-FSA-008 | TMS-002, TMS-003, TMS-011, TMS-014, TMS-017, FIN-12 | P1 | High | Commercial lineage | `tms-pricing.server.ts`; `admin-data.server.ts`; `freight-audit.server.ts` | Pricing approval, quote, tender/booking and Freight Audit are not bound to one immutable commercial version. | KCPL cannot prove approved, sold, bought, booked, audited and reported economics are the same version. | Approve pricing, edit/reprice economics after tendering, then continue to booking/audit. | Pricing uses mutable `pricing_snapshot`; quote merge updates overwrite economics; generic quote edit changes commercial fields; no shared immutable version reaches booking/audit. | Immutable commercial version records referenced by approval, quote, tender, booking, audit and profitability; sanctioned change invalidates dependants. | Yes | Commercial version schema. | Open |
| KCPL-FSA-009 | TMS-001 | P1 | High | Pricing controls | `tms-pricing.server.ts` | Per-order pricing overrides can weaken minimum-margin/approval thresholds without equivalent validation. | Margin governance can be bypassed. | Submit weak/negative override thresholds and recalculate pricing. | Stored rule inputs are range-validated, but order `PricingOverrides` feed calculation thresholds without the same explicit validation. | Validate override ranges and prevent weakening governance floors except explicit management approval. | Yes | None. | Open |
| KCPL-FSA-010 | TMS-009 | P1 | High | Procurement | tender/rate-card selection | Tender creation does not fully revalidate selected buy-rate validity/applicability immediately before tendering. | Expired, wrong-branch or stale procurement can become live carrier tender. | Select a valid rate, then invalidate/expire/change applicability before tender creation. | Specialist current-main review found tender path does not re-run the full rate-card compatibility contract at commit time. | Re-resolve/revalidate rate inside tender transaction. | Yes | KCPL-FSA-008 recommended. | Open |
| KCPL-FSA-011 | TMS-004, EXEC-007 | P1 | High | Tender / Pricing | `tms-tendering.server.ts` | Carrier counteroffer can become booking economics without renewed customer repricing/margin approval. | Buy cost can rise while approved sell/margin remains stale. | Accept/book a higher counteroffer directly. | Counter state is booking-eligible and booking uses final tender commercials without sell-pricing invalidation/reapproval. | Counter that changes buy cost must invalidate dependent pricing approval and require reapproval. | Yes | KCPL-FSA-008. | Open |
| KCPL-FSA-012 | TMS-008 | P1 | High | Rate Desk / Branching | rate-card compatibility | Branch-specific buy rate can be applied outside intended branch. | Wrong procurement cost/partner selection. | Rate card matches lane/mode but belongs to another branch. | Specialist compatibility review found branch equality is not enforced as a required applicability dimension. | Enforce branch at rate selection and tender time. | Yes | None. | Open |
| KCPL-FSA-013 | TMS-010, TMS-016, TMS-028 | P1 | High | Consolidation / Finance | `tms-consolidation.server.ts` | Consolidation overwrites house selected cost/currency with allocation while stale standalone rate/partner identity can remain; some bases can yield zero allocation. | House procurement lineage and profitability become contradictory. | Book consolidation and compare house selected cost/currency with selected rate/partner and allocation basis. | Booking updates allocated cost/currency but leaves prior selected rate/partner fields; allocations derive from stored member snapshots. | Separate immutable source procurement from allocation; version allocation basis and enforce complete nonzero basis rules. | Yes | KCPL-FSA-007/008. | Open |
| KCPL-FSA-014 | EXEC-018 | P1 | High | Tracking / Workflow | `tracking-visibility.server.ts`; `workflow-guard.server.ts`; `delivery-control.server.ts` | Carrier/EDI tracking can set canonical shipment state, including Delivered, without the human workflow guard. | Customs/document gates can be bypassed by machine events. | Ingest Delivered milestone on a shipment the human PATCH route would block, then adopt tracked delivery. | `recordTrackingEvent()` writes status from milestone directly; human shipment PATCH calls `validateShipmentTransition()`; `adoptTrackedDelivery()` only requires shipment status `delivered`. | Route all machine status changes through the same policy with explicit quarantine/override rules. | Yes | Machine-event workflow policy. | Open |
| KCPL-FSA-015 | EXEC-019, INT-004, INT-005, INT-006 | P1 | High | Tracking ingestion | tracking visibility/ingest | Tracking dedupe/order are query-then-write; invalid/missing timestamps become ingestion time. | Newer movement truth can be rolled back or polluted. | Race adjacent events or send malformed/missing timestamp. | Provider-ID duplicate query and latest-time comparison occur outside a transaction; invalid time falls back to now. | Deterministic event IDs, transactional monotonic state, quarantine invalid-time events. | Yes | KCPL-FSA-014 recommended. | Open |
| KCPL-FSA-016 | INT-002, INT-003 | P1 | High | Maersk / DCSA | `carrier-integrations.server.ts`; carrier normalization | DCSA correlation can stop after first unique identifier and planned events can become actual movement too early. | Wrong-shipment or false movement mutation. | Send conflicting identifiers or planned event payload. | Matcher breaks once accumulated matches equal one rather than reconciling all identifiers; specialist review found planned/actual classification is late. | Intersect/validate all identifiers and classify planned vs actual before milestone mapping. | Yes | KCPL-FSA-014/015 recommended. | Open |
| KCPL-FSA-017 | EXEC-006, INT-011, INT-012 | P1 | High | EDI 990 | `edi-gateway.server.ts`; `/api/integrations/edi` | Inbound 990 auth is global, not expected-carrier-bound, and response application is not transactionally tied to current tender. | Unauthorized/wrong carrier response or stale response can corrupt tender/order state. | Holder of global EDI secret submits matching 990; race responses. | One `KCPL_EDI_SECRET`; tender lookup validates references/status but not authenticated partner; batch does not assert current tender. | Partner-specific credentials/signatures and transactionally bind expected carrier/current tender. | Yes | Partner profile model. | Open |
| KCPL-FSA-018 | EXEC-005, INT-013, INT-014 | P1 | High | EDI 204 | `edi-gateway.server.ts` | Outbound 204 idempotency depends on timestamped payload and queue has no atomic claim/lease. | Duplicate carrier tender dispatch. | Generate/consume same business tender twice or race consumers before ACK. | Fingerprint is generated payload hash; payload contains time/control values; queue returns queued rows without claim semantics. | One durable business 204 per tender/version plus claim/lease/ack/retry state. | Yes | EDI worker contract. | Open |
| KCPL-FSA-019 | INT-017, INT-018, INT-019, INT-020, INT-021 | P1 | High | X12 EDI semantics | `edi-x12.ts`; `edi-gateway.server.ts` | Envelope validation, 214 matching/time/milestone mapping and 204 test/production indicator are unsafe. | Malformed/misread EDI can become live workflow state. | Submit malformed controls, local-time 214, X3/X4, or use generated 204 in production. | Parser is delimiter-based without envelope/count validation; 214 booking ref is matched through carrier ref; event time is forced UTC; X3/X4 map picked-up; ISA15 hardcoded `T`. | Validate envelopes/controls/counts, partner profiles/time codes/mappings and environment indicator. | Yes | Partner EDI fixtures. | Open |
| KCPL-FSA-020 | EXEC-025, INT-028 | P1 | High | EDI 214 idempotency | EDI gateway/tracking | Multi-event 214 can partially apply before failure; retry/dedupe cannot guarantee healing or payload-conflict detection. | Permanent partial shipment history/state. | Fail after first event in a multi-event 214, then retry same message/provider ID. | Events commit one-by-one before transaction marked processed; existing fingerprint returns duplicate early. | Resumable per-event deterministic identities and same-ID/different-payload conflict detection. | Yes | KCPL-FSA-015. | Open |
| KCPL-FSA-021 | INT-007 | P1 | High | DHL | `carrier-integrations.server.ts` | DHL sync can use booking reference as tracking number and does not bind response identity back to shipment. | Unrelated checkpoints can contaminate shipment. | Shipment lacks tracking number but has booking reference; sync. | Tracking reference is `carrier_reference || tracking_number || booking_reference`; normalized 200 payload identity is not verified against request. | Strict DHL identifier normalization and response identity validation. | Yes | Provider fixtures. | Open |
| KCPL-FSA-022 | EXEC-012, EXEC-013, EXEC-014, EXEC-015, EXEC-016, EXEC-017 | P1 | High | Pickup execution | `pickup-appointments.server.ts`; pickup integration route | Pickup uses split writes/permissive transitions, can contradict shipment state, retain stale driver data, miss secondary-branch scope, and cannot heal post-commit tracking failure. | Appointment, shipment and tracking truth diverge. | Race request/complete/miss/cancel; force tracking failure after provider core commit and retry same event ID. | Manual paths update appointment/shipment then events/tracking separately; provider commits dedupe/core state before tracking and duplicate retry exits early. | Transactional pickup state machine with all relevant branches and outbox-based side effects. | Yes | Credential split recommended. | Open |
| KCPL-FSA-023 | EXEC-021, EXEC-023 | P1 | High | Digital Job File | `job-file.server.ts`; `workflow-guard.server.ts` | Closed Job Files remain mutable and closeout uses stale readiness snapshot. | Formal closeout can be invalid while new/open blockers exist. | Create/reopen blocker during close or mutate task/customs/cost after `job_closed_at`. | Mutation helpers do not check closed state; close computes readiness then later batches closure without blocker/version precondition. | Closed-file immutability plus workflow version updated by every blocker mutation and asserted on close. | Yes | Workflow version primitive. | Open |
| KCPL-FSA-024 | SEC-004, FIN-01, FIN-05, FIN-09 | P1 | High | AP / AR payments | `payables.server.ts`; `finance.server.ts` | Payment recording uses stale balances/absolute aggregate writes; retry after post-commit failure can duplicate payment. | Incorrect paid/balance state and duplicate ledger payment. | Race two payments or retry after core commit but later side effect failure. | Both paths read balance first, create random payment child, write absolute totals in batch, then run post-commit side effects. | Firestore transaction with deterministic idempotency key, atomic child/aggregate and outbox. | Yes | Finance idempotency convention. | Open |
| KCPL-FSA-025 | FIN-02, FIN-04, FIN-19 | P1 | High | Freight Audit / Match-Pay | `freight-audit.server.ts`; AP payment route | Match-Pay compares invoice subtotal but payment settles total, and audit authorization is separate from payment commit. | A bill can pass on one monetary basis and settle another; approval can go stale. | Taxed invoice subtotal matches procurement but total differs; mutate state between check and pay. | Variance uses `invoiceSubtotal`; payable settlement uses total/balance; route calls audit check then separate payment function. | One explicit gross/net/tax basis, immutable versions, atomic check+settlement. | Yes | KCPL-FSA-008/024. | Open |
| KCPL-FSA-026 | FIN-06, FIN-10 | P1 | High | AP / AR invoice identity | Payables/Finance | Supplier-bill and customer-invoice creation lack transactional business idempotency. | Duplicate obligations/receivables. | Race duplicate supplier bill query/create or repeat customer invoice creation. | AP duplicate check is query then random-ID create; AR creates new reference without business uniqueness key. | Deterministic business keys plus transactional create-or-return. | Yes | Business key/index schema. | Open |
| KCPL-FSA-027 | FIN-07 | P1 | High | Supplier reconciliation | Payables/reconciliation | Supplier reconciliation can rewrite creditor identity after approval/payment. | Paid obligation can be attributed to wrong supplier; audit provenance breaks. | Reconcile an approved/paid legacy bill to another partner. | Specialist finance review confirmed partner linkage remains mutable after approval/payment. | Lock creditor after approval/payment; explicit reversal/reissue correction workflow. | Yes | Finance correction policy. | Open |
| KCPL-FSA-028 | FIN-11, FIN-16 | P1 | High | Profitability | `finance.server.ts`; Job File profitability | Customer profitability silently omits non-preferred-currency transactions and tax bases differ across finance/audit. | Materially wrong management profitability. | Create revenue/costs in multiple currencies and compare dashboard with ledger. | `recomputeCustomerFinance()` skips items not in preferred currency; finance uses invoice total while Match-Pay uses subtotal. | Per-currency or fully FX-converted reporting with stored FX source/date/version and explicit tax basis. | Yes | Accounting/FX policy, KCPL-FSA-008. | Open |
| KCPL-FSA-029 | INT-027 | P1 | High | Custom GPT / RBAC | `gpt-action-auth.server.ts`; `/api/gpt/*` | One GPT secret grants organization-wide reads without human branch identity. | Cross-branch customer/operational disclosure that normal staff RBAC would deny. | Call `/api/gpt/search` with service secret and query data outside a branch-limited staff scope. | Auth validates only static secret; GPT search reads global recent shipments/quotes/customers with no branch filter and returns customer contact/operational metadata. | Scoped identity/claims, branch-filter every route, minimize returned fields. | Yes | KCPL-FSA-001 branch policy. | Open |
| KCPL-FSA-030 | TMS-017, TMS-018 | P2 | High | Procurement lineage | rating/pricing/tender records | Procurement and FX lack immutable reproducible provenance. | Later audit cannot reproduce selected buy economics. | Inspect booked record after rate/FX source changes. | No immutable procurement+FX provenance object is carried through downstream modules. | Store source rate, FX source/rate/time/version and immutable procurement snapshot ID. | Yes | KCPL-FSA-008. | Open |
| KCPL-FSA-031 | TMS-015 | P2 | High | Pricing architecture | CRM sell rate cards; TMS pricing | CRM customer sell-rate cards and TMS pricing are disconnected. | Two sell-pricing truths create inconsistent quoting. | Configure CRM sell rate and price same lane through TMS. | Specialist review found no shared resolver/contract. | One pricing resolver or explicit precedence/source model. | Yes | Commercial pricing design. | Open |
| KCPL-FSA-032 | TMS-019, TMS-020, TMS-021, TMS-022, TMS-030 | P2 | High | Rating validation | rating/pricing modules | Equipment/date/numeric/overlap validation is permissive; invalid numbers can become zero; rated state can be misleading. | Recoverable bad rate selection/price. | Use malformed dates/numbers, overlapping cards or loose equipment match. | Specialist current-main review identified wildcard/permissive matching, weak validation and no deterministic overlap conflict invariant. | Strict schema validation, currency-aware numeric rules and deterministic precedence/conflict rejection. | Yes | None. | Open |
| KCPL-FSA-033 | TMS-023, TMS-024, TMS-025, TMS-026 | P2 | High | Load planning | consolidation | Release does not fully revalidate equipment, route continuity, ownership/compatibility and planned-time chronology. | Invalid load can be released but is operationally recoverable. | Change member/stop/equipment assumptions before release. | Release checks selected conditions but not the full planning contract transactionally. | Full release-time validation and version assertion. | Yes | KCPL-FSA-007. | Open |
| KCPL-FSA-034 | TMS-027, TMS-028 | P2 | High | Consolidation allocation | consolidation | Allocation precision is fixed to cents and can rely on stale snapshots. | JPY/other currency rounding and savings/allocation errors. | Allocate JPY or mutate member cost after snapshot. | Allocation rounding is not currency-precision aware; calculations use stored members. | Currency precision table and immutable allocation snapshot. | Yes | KCPL-FSA-013. | Open |
| KCPL-FSA-035 | TMS-029, EXEC-010 | P2 | High | CRM counters | booking/consolidation | Active shipment counters use stale absolute updates. | Lost counter increments under concurrent bookings. | Book two shipments for same customer concurrently. | Customer count is read then written as previous+1 rather than transactional/atomic increment. | Transaction or atomic increment with reconciliation. | Yes | Booking/consolidation fixes. | Open |
| KCPL-FSA-036 | SEC-006 | P2 | High | Document Vault | verify/delete/replace paths | Document lifecycle checks can race. | Recoverable inconsistent document state/version. | Race verify with delete/replace. | Read/validate/write lifecycle operations lack common version precondition. | Transaction/version preconditions across document transitions. | Yes | None. | Open |
| KCPL-FSA-037 | SEC-007 | P2 | High | POD / File validation | `delivery-control.server.ts` | POD validation trusts declared MIME/type and size without magic-byte validation. | Invalid/disguised content can enter evidence storage. | Upload content whose bytes do not match declared allowed MIME. | Upload checks `podFileAccepted(file.type,file.size)`, hashes bytes, but does not verify file signature. | Magic-byte/content validation and malware scanning policy. | Yes | Storage/security policy. | Open |
| KCPL-FSA-038 | SEC-008 | P2 | Medium | Public quote intake | public quote endpoint | Anonymous quote intake lacks strong application abuse controls. | Spam/resource exhaustion/operational noise. | High-volume anonymous submissions. | Specialist security review found insufficient application-level throttling/challenge. | Edge/app rate limits, bot controls, body limits and monitoring. | Yes | Deployment edge config. | Open |
| KCPL-FSA-039 | SEC-009 | P2 | High | Exports | management CSV | User-controlled CSV cells are not formula-neutralized. | Spreadsheet formula execution when staff opens export. | Store cell starting `=`, `+`, `-` or `@`, then export/open. | Specialist review confirmed raw cell emission. | Prefix/escape dangerous spreadsheet formulas and test. | Yes | None. | Open |
| KCPL-FSA-040 | SEC-010, INT-001 | P2 | Medium | Shared-secret endpoints | EDI/DCSA/automation/integration routes | Secret strength, rotation, replay-window and request-signature semantics are inconsistent. | Broader replay/credential abuse exposure. | Replay a valid machine request or compare weakly configured endpoint secrets. | Machine routes use different secret validation policies; DCSA path relies on static bearer rather than signed timestamped request semantics. | Standard M2M auth baseline with per-provider identity, rotation, signature/timestamp/replay cache where supported. | Yes | Secret-management policy. | Open |
| KCPL-FSA-041 | INT-008, INT-009, INT-010, INT-025 | P2 | Medium | Carrier resilience | `carrier-integrations.server.ts` | Carrier calls lack retry/backoff; deploy-time base URL controls credential destination; semantic-empty success can look healthy. | Reliability and configuration risk. | Trigger 429/5xx/timeout or malformed 200; misconfigure base URL. | `fetchJson()` has timeout but no retry; base URLs are env-driven; successful HTTP can record provider health despite zero/invalid events. | Retry/backoff/Retry-After, host allowlist, redirect policy and semantic health. | Yes | Provider deployment config. | Open |
| KCPL-FSA-042 | INT-015, INT-016, INT-022, INT-023, INT-024 | P2 | High | EDI transport reliability | EDI route/gateway/X12 | ACK authority is broad; queue recovery/starvation, durable controls, functional ACK and pre-read body limits are weak. | Operational reliability/replay issues. | Hold global secret, ACK queued message; exercise large body/old queue/no functional ACK. | ACK is separate read/update; queue is capped; controls timestamp-derived; no 997/TA1 flow found; some limits occur after body materialization. | Scoped ACK/claim lease, recovery worker, durable controls, functional ACK, streaming/pre-read limits. | Yes | EDI transport design. | Open |
| KCPL-FSA-043 | FIN-03, FIN-12, FIN-13 | P2 | High | Freight Audit controls | freight audit | Broad `not_applicable`, missing reproducible baseline and zero-cost tolerance can weaken Match-Pay evidence. | Recoverable control bypass/weak assurance. | Use ancillary/no-shipment/no-baseline or zero cost case. | Audit can lack booked baseline or use not-applicable; zero tender/counter values are accepted by execution path. | Tight applicability policy, mandatory baseline where required and nonzero commercial validation. | Yes | KCPL-FSA-008/025. | Open |
| KCPL-FSA-044 | FIN-14, FIN-15, FIN-18 | P2 | High | Finance data quality | finance/payables | Variance approval provenance can be overwritten; invalid currency coerces to NPR; date chronology is weak. | Recoverable but material accounting-data corruption. | Resubmit approval, invalid currency/date combinations. | Current parsers default invalid currency to NPR; specialist audit found approval/date weaknesses. | Reject invalid currency, immutable approval events and strict date chronology/schema. | Yes | Accounting policy. | Open |
| KCPL-FSA-045 | UI-001 | P2 | High | Command palette | root layout/global search/admin shell | Two command systems compete for Cmd/Ctrl+K. | Navigation/search becomes unreliable. | Press Cmd+K where both handlers are mounted. | Root `OperationsGlobalSearch` uses capture handler and `stopImmediatePropagation`; admin shell has separate command UI. | One command palette and one owner for shortcut/search state. | Yes | UI-only. | Open |
| KCPL-FSA-046 | UI-002, UI-003, UI-013 | P2 | High | Navigation state | shell/search/navigation | Permission/workspace models drift, fallback visibility can over-show, and same-route query selection can stay stale. | Misleading UI and wrong visible record context; server still gates writes. | Fail permission metadata or navigate between same-route query selections/back-forward. | Separate search workspace permission list/fallback behavior; specialist UI review reproduced stale selection. | One server-derived navigation capability model and route-keyed selection state. | Yes | KCPL-FSA-001 policy helpful. | Open |
| KCPL-FSA-047 | UI-006 | P2 | High | Global search | admin search/global search | Search uses fixed recent caps and in-memory filtering. | Older live records silently disappear. | Search for older valid shipment/customer beyond cap. | Current search loads bounded recent collections then filters locally. | Indexed server-side search/pagination with explicit result window. | Yes | Firestore indexes. | Open |
| KCPL-FSA-048 | UI-007 | P2 | High | Notifications | notifications | Polling repeatedly scans broad datasets per tab. | Firestore read amplification/cost and latency. | Open multiple tabs at normal polling interval. | Specialist UI audit traced repeated broad notification reads. | Cursor/unread indexed query, visibility-aware polling/backoff or subscription. | Yes | Index/query design. | Open |
| KCPL-FSA-049 | UI-008, EXEC-004 | P2 | High | Tender Desk reliability | tender listing/dispatch | Tender Desk scans broadly and can repair expiry state on read; dispatch failure can leave active stranded tender. | Operational reliability issue and hidden state mutation. | Load large Tender Desk or fail dispatch after tender activation. | Listing/expiry logic can mutate while reading; execution audit found dispatch failure path leaves active tender state. | Pure paginated reads; scheduler owns expiry; transactional dispatch state/outbox. | Yes | KCPL-FSA-005. | Open |
| KCPL-FSA-050 | UI-009 | P2 | High | Pickup workspace | `listPickupWorkspace()` | Pickup scans up to 2000 shipments + 2000 appointments plus linked records; caps can hide old unresolved work. | Significant performance/visibility issue. | Populate beyond caps and inspect unresolved pickup queue. | Current code reads fixed 2000/2000 and hydrates customer/quote/tender maps. | Indexed state-specific pagination. | Yes | Firestore indexes. | Open |
| KCPL-FSA-051 | UI-010 | P2 | High | Freight Audit performance | Freight Audit dashboard | Dashboard performs serialized N+1 reconciliation and write-on-read. | Latency, cost and failure amplification. | Load large audit queue. | Specialist UI audit traced per-row reconciliation/query/write behavior. | Precomputed/read model or bounded background reconciliation; pure dashboard reads. | Yes | Query/index redesign. | Open |
| KCPL-FSA-052 | UI-011; lead-review AR analogue | P2 | High | Finance dashboards | `payables.server.ts`; `finance.server.ts` | Payables and Receivables repair statuses while being read; Payables can exceed 500-write batch limit. | Dashboard can fail or mutate state merely by rendering. | Load >500 stale payable statuses; concurrently open finance dashboards. | Payables reads up to 3000 and queues corrections in one batch; current AR dashboard contains analogous read-triggered correction logic. | Make reads pure; chunked bounded repair worker/transaction. | Yes | None. | Open |
| KCPL-FSA-053 | UI-012 | P2 | High | Job File UI reliability | Job File page/supplemental queries | Supplemental data failure can take down critical Job File workspace. | Critical operational UI becomes unusable despite core data being available. | Force one supplemental query to fail. | Specialist UI review found supplemental fetches on critical render path without independent degradation. | Failure-isolated loading boundaries and degraded components. | Yes | None. | Open |
| KCPL-FSA-054 | UI-014 | P2 | High | EDI UI coupling | admin EDI page; Tender Desk | EDI workspace availability is hard-coupled to Tender Desk load/state. | EDI becomes unavailable because unrelated tender listing fails. | Make `listTmsTenders()` unavailable while EDI ledger is healthy. | Admin EDI GET awaits both dashboard and tenders and returns failure unless both ready. | Degrade independently; load eligible tender selector separately. | Yes | None. | Open |
| KCPL-FSA-055 | UI-017 | P2 | High | Firestore configuration | repo config | Composite indexes are not source-controlled. | Runtime configuration cannot be reproduced/reviewed reliably. | Fresh environment from repository only. | `firestore.indexes.json` is absent on current main. This proves reproducibility gap, not that deployed indexes are absent. | Export/source-control indexes and deploy via CI. | Yes | Config/CI. | Open |
| KCPL-FSA-056 | SEC-013 | P2 | High | Repository governance | GitHub `main` | `main` is unprotected with no required status checks. | High-risk fixes can bypass review/CI. | Inspect branch protection. | Current GitHub branch reports `protected=false` and status-check enforcement off. | Require PR review, required CI, restrict force-push/delete and gate production deploy. | Yes | Repo admin. | Open |
| KCPL-FSA-057 | EXEC-022, EXEC-024 | P2 | High | Audit provenance | `job-file.server.ts` | Task/customs completion attribution is mutable/erasable and Job File metadata can commit before activity event. | Audit trail can disagree with current state. | Toggle completion off/on or force activity write failure after metadata update. | Toggle functions overwrite completion attribution; `updateDigitalJobFile()` writes shipment then activity separately. | Append-only completion/correction events and transactional/outbox audit publication. | Yes | KCPL-FSA-023 useful. | Open |
| KCPL-FSA-058 | EXEC-026 | P2 | High | Tender time semantics | Tender Desk client/server | Browser-local deadline semantics can diverge from Nepal operational time. | Premature/late tender decisions. | Use browser in non-Nepal timezone around deadline. | Specialist execution audit found client deadline handling inconsistent with Asia/Kathmandu policy. | Normalize all tender deadlines to explicit zone/UTC and render with declared operational zone. | Yes | None. | Open |
| KCPL-FSA-059 | SEC-011 | P3 | High | Document API | document API | Internal `storage_path` is exposed to clients unnecessarily. | Low-impact information disclosure. | Read document API response. | Specialist security audit confirmed field exposure. | Remove internal path from public/admin response DTO unless required. | Yes | None. | Open |
| KCPL-FSA-060 | SEC-012 | P3 | High | Session UX | logout route | Logout is state-changing GET. | Forced sign-out/undesired prefetch behavior. | Navigate/prefetch/cross-site link to logout GET. | Specialist security audit confirmed GET mutation. | POST logout with same-origin/CSRF semantics. | Yes | None. | Open |
| KCPL-FSA-061 | UI-004, UI-005, UI-015, UI-016, UI-019 | P3 | High | Admin UX / Accessibility | command/navigation/mobile | Keyboard focus, labels, hard-navigation fallback and mobile pinned/recent parity have gaps. | Low-impact usability/accessibility debt. | Keyboard/mobile navigation audit. | Specialist UI audit confirmed these issues; no server authorization bypass. | Focus management, labels, mobile parity and reliable fallback. | Yes | UI cleanup. | Open |
| KCPL-FSA-062 | UI-018 | P3 | High | Public performance | `app/layout.tsx` | Admin global search/fallback and admin CSS are mounted from public root layout. | Avoidable public-page JS/CSS/runtime cost. | Load public site and inspect root imports/bundle. | Root layout imports `OperationsGlobalSearch`, navigation fallback and admin styles for every route. | Move admin-only providers/styles into admin layout. | Yes | UI cleanup. | Open |

## 3. P0 Findings

**None verified on current main.** Duplicate KCPL payment records are P1 because no reviewed path proves that recording the payment automatically executes a bank transfer. If a payment connector later auto-disburses from this state without another control, KCPL-FSA-024 must be reconsidered for P0.

## 4. P1 Findings

- **Identity / branch trust:** KCPL-FSA-001 to 004 and 029.
- **Tender / booking / consolidation state:** KCPL-FSA-005 to 007.
- **Commercial integrity:** KCPL-FSA-008 to 013.
- **External movement truth:** KCPL-FSA-014 to 021.
- **Pickup / Job File closeout:** KCPL-FSA-022 to 023.
- **Financial settlement:** KCPL-FSA-024 to 028.

All P1 findings are release blockers for the affected enabled subsystem.

## 5. P2 Findings

- **Commercial/planning quality:** KCPL-FSA-030 to 035.
- **Security/data/integration hardening:** KCPL-FSA-036 to 044.
- **UI/performance/reliability:** KCPL-FSA-045 to 054.
- **Configuration/auditability:** KCPL-FSA-055 to 058.

## 6. P3 Findings

KCPL-FSA-059 to 062 cover unnecessary storage metadata exposure, state-changing GET logout, accessibility/mobile/navigation polish, and public loading of admin-only assets.

## 7. Cross-Module Findings

### 7.1 Commercial version drift across the full lifecycle

**Rate selection -> Pricing approval -> Customer quote -> Tender -> Carrier counter -> Booking -> Supplier invoice -> Freight Audit -> Payment -> Profitability** is not bound to one immutable commercial version.

KCPL-FSA-008 is the central cross-module defect. Pricing is approved against mutable state, quote economics can be edited/overwritten, repricing can occur after tendering, tender creation does not fully revalidate the buy rate, counters can become final booking economics, Freight Audit may not recover a reproducible booking baseline, and profitability later aggregates finance data without that common version.

**Required invariant:** every commercial mutation preserves the same immutable `commercial_version_id` or creates a new version that explicitly invalidates dependent approval/tender/audit state.

### 7.2 External Delivered can bypass human workflow controls

Human shipment PATCH calls `validateShipmentTransition()`. Tracking ingestion writes canonical state from normalized milestones directly. A DCSA/EDI/DHL event can therefore mark a shipment Delivered without the same customs/document guard. `adoptTrackedDelivery()` then checks only that shipment status is `delivered` before creating a delivered attempt. POD remains separately pending, which is useful, but canonical delivery truth may already be inconsistent. See KCPL-FSA-014 to 021.

### 7.3 Branch authority depends on entry point

Firebase-authenticated human routes, configured-admin email, finance/EDI helper functions, EDI transport credentials, pickup automation and the GPT gateway apply different scope models. Branch authority must be a property of the target object and identity, not of which route was used. See KCPL-FSA-001 to 004 and 029.

### 7.4 Consolidation economics can disagree with house Job Files and profitability

Consolidated booking allocates master procurement cost to houses and overwrites selected cost/currency while earlier standalone rate/partner identity can remain. Freight Audit, Job File economics and profitability can therefore describe inconsistent procurement provenance. See KCPL-FSA-013.

### 7.5 Read paths perform hidden writes across modules

Tender expiry repair, Payables status repair, Receivables status repair and Freight Audit reconciliation can write while a dashboard is being read. The lead review found the Receivables analogue in current `finance.server.ts` in addition to the specialist Payables/UI finding. See KCPL-FSA-049, 051 and 052.

### 7.6 Duplicate external events do not currently prove duplicate finance activity

The requested cross-chain review included duplicate provider/webhook events causing downstream duplicate finance activity. Current code verifies serious tracking/EDI duplication and ordering defects, but the lead review did **not** find a direct automatic bridge from a duplicate tracking event to an AP/AR payment. That claim is therefore not retained. Finance has independent duplicate-payment defects in KCPL-FSA-024.

## 8. Race Conditions / Concurrency

| Area | Finding(s) | Required invariant |
|---|---|---|
| Tender current state | KCPL-FSA-005 | Transactionally assert one active/current tender. |
| Booking exactly-once | KCPL-FSA-006 | Deterministic idempotency key and transactional claim. |
| Consolidation | KCPL-FSA-007, 013 | Versioned membership/release/booking and allocation. |
| Commercial approval | KCPL-FSA-008 | Immutable approved commercial version. |
| Tracking | KCPL-FSA-015 | Deterministic event IDs and monotonic transactional state. |
| EDI | KCPL-FSA-017, 018, 020 | Partner-bound, claimable, resumable message/event state. |
| Pickup | KCPL-FSA-022 | Atomic state plus retryable outbox. |
| Job close | KCPL-FSA-023 | Close against workflow version changed by every blocker mutation. |
| AP/AR payments | KCPL-FSA-024 | Transactional balance plus deterministic payment idempotency. |
| Match-Pay | KCPL-FSA-025 | Audit version and payment commit are atomic. |
| Invoice creation | KCPL-FSA-026 | Transactional business uniqueness key. |
| CRM counters | KCPL-FSA-035 | Atomic increment/transaction. |
| Documents | KCPL-FSA-036 | Version/precondition on lifecycle transitions. |
| Dashboard repairs | KCPL-FSA-052 | Reads are pure; repairs run in bounded workers. |

## 9. Security Trust Boundaries

| Boundary | Required production control |
|---|---|
| Firebase session -> staff profile | Persisted active profile authoritative; bootstrap separate/auditable. |
| Staff capability -> object | Role + branch + object-state authorization immediately before read/write. |
| Browser -> mutation | Same-origin/CSRF plus object authorization. |
| GPT -> KCPL data | Scoped identity/claims, branch filters and field minimization. |
| EDI -> tender/shipment | Per-partner credentials/signatures, replay protection and expected-partner binding. |
| Pickup -> scheduler | Separate scoped credentials/service identities. |
| Carrier webhook -> shipment | Signature/replay, identity reconciliation, quarantine and common workflow gate. |
| Upload -> storage | Content signature/magic-byte validation and malware policy. |
| GitHub -> production | Protected main, review and required CI/status checks. |

## 10. Financial Invariants

- AP/AR payment children must sum exactly to parent `paid_amount`; `balance = total - paid_amount` is computed in the same transaction.
- Every payment has a durable idempotency key; retry returns the original result.
- Supplier invoice identity is unique on a documented business key such as supplier + supplier invoice number + legal entity.
- Customer invoice creation is idempotent per business event/commercial version.
- Match-Pay compares and settles the same gross/net/tax/credit/currency basis.
- Match-Pay approval references immutable invoice and procurement versions and is checked in the settlement transaction.
- Approved/paid creditor identity is immutable except through explicit reversal/correction workflow.
- Profitability never silently drops a currency; report per currency or convert every component with stored FX source/date/version.
- Consolidation house allocations sum to master procurement using currency-correct precision and immutable allocation basis.
- Pricing approval, quote, tender and booking share one commercial version or explicit invalidation/reapproval.

## 11. Workflow Invariants

- At most one active tender per order.
- Only the order's current tender can respond/cancel/book; stale tenders become historical only.
- At most one canonical booking/shipment set exists per booking idempotency key.
- Rate applicability is revalidated at tender creation.
- Carrier counter economics invalidate dependent margin approval.
- A house belongs to at most one active load; release freezes or versions the load.
- External movement events use the same workflow transition policy as human events.
- Canonical shipment state is monotonic by event-time/version except explicit supervised correction.
- Pickup cannot regress from picked-up or contradict a terminal delivered shipment.
- Delivered can precede verified POD only as an explicit pending-POD state; Job File close remains blocked until required controls pass.
- Closed Job Files are immutable except through management reopen.
- Closeout is committed against a stable workflow version.

## 12. Integration Risks

### EDI

Partner identity is not tightly bound to 990, 204 lacks durable claim/idempotency, X12 validation/time/milestone semantics are weak, and 214 partial application is not safely resumable. See KCPL-FSA-017 to 020 and 042.

### Maersk / DCSA

Correlation must reconcile all identifiers and classify planned versus actual before canonical state mapping. Request signature/replay policy also needs strengthening. See KCPL-FSA-016 and 040.

### DHL Express

Tracking identifiers require strict normalization/response identity validation. Retry/backoff, provider-host trust and semantic health also need hardening. See KCPL-FSA-021 and 041.

### Pickup integrations

Separate the external pickup credential from internal automation and replace split core/tracking writes with an atomic state machine plus outbox. See KCPL-FSA-004 and 022.

### Custom GPT

Read-only is not equivalent to branch-safe. One service secret currently reads broader data than ordinary human RBAC permits. See KCPL-FSA-029.

## 13. Performance Hotspots

| Hotspot | Finding | Main risk |
|---|---|---|
| Global search | KCPL-FSA-047 | Hard caps silently omit older live records. |
| Notifications | KCPL-FSA-048 | Repeated broad reads per tab/poll. |
| Tender Desk | KCPL-FSA-049 | Scan plus state repair on read. |
| Pickup workspace | KCPL-FSA-050 | Thousands of reads plus hydration and caps. |
| Freight Audit | KCPL-FSA-051 | Serialized N+1 and write-on-read. |
| Payables/Receivables | KCPL-FSA-052 | Thousands of reads plus hidden writes; Payables can exceed 500-write batch limit. |
| Job File | KCPL-FSA-053 | Supplemental query failure can break critical workspace. |
| Public root | KCPL-FSA-062 | Admin-only JS/CSS mounted on public pages. |

## 14. Test Coverage Gaps

- Transactional race tests for tender, booking, consolidation and AP/AR payments.
- Commercial-version tests proving repricing/quote edits invalidate dependent approval/tender/audit.
- Direct cross-branch API tests for EDI, finance linking, documents and GPT.
- Machine-event tests proving carrier/EDI events cannot bypass configured customs/document workflow.
- Tracking ordering tests for races, equal/missing timestamps and conflicting duplicate IDs.
- EDI fixtures for malformed envelopes/counts/controls, time codes, X3/X4, replay and partial 214 failure.
- Pickup fault-injection after every persistence boundary and idempotent retry.
- Job-close race tests and post-close mutation denial.
- Payment fault-injection around core commit/post-commit side effects.
- Match-Pay tax/credit/currency/stale-version tests.
- Multi-currency profitability and FX provenance tests.
- Performance tests above current caps asserting bounded reads and no writes on render.
- Cmd/Ctrl+K ownership, permission-metadata failure, same-route query/back-forward and mobile navigation tests.
- CI/config tests for source-controlled indexes, protected main and unique/minimum-strength service credentials.

## 15. Production Configuration Gaps

| Gap | Current evidence | Required action |
|---|---|---|
| GitHub main | `protected=false`, required checks off. | Require PR review/status checks and protected deploys. |
| Firestore indexes | `firestore.indexes.json` absent in repo. | Source-control/export indexes. This audit does not claim deployed indexes are absent. |
| Service credentials | Pickup and automation share a secret; policies vary elsewhere. | Unique scoped identities/secrets and rotation. |
| EDI partner profiles | Global auth/generic X12 generation. | Partner-specific sender/receiver, auth, environment, control and ACK config. |
| Carrier hosts | Provider base URLs can be overridden by deployment env. | Allowlist production/test hosts and redirects. |
| Public abuse controls | Quote intake lacks strong application throttling. | Edge/app rate limits, bot/body controls and monitoring. |
| Provider health | Transport 2xx can appear healthy despite semantic failure. | Separate transport, parse, correlation and mutation health. |

## 16. False Positives / Findings Rejected

| Original claim | Lead-review disposition | Reason |
|---|---|---|
| INT-026 provider-error prompt injection as privileged exploit | Rejected standalone | Provider text should be sanitized, but no privileged tool/action was shown to execute it. |
| FIN-08 lack of maker-checker as application bug | Rejected as defect; governance recommendation retained | Segregation of duties is strong practice, but no supplied KCPL policy established the required approval matrix. |
| INT-010 direct SSRF | Reduced/merged into KCPL-FSA-041 P2 | Provider base URL is deployment-controlled, not caller-controlled in reviewed routes. |
| UI-002/UI-003 as P1 RBAC bypass | Reduced to KCPL-FSA-046 P2 | UI may over-show, but server authorization still gates protected operations. |
| FIN-01/SEC-004 duplicate payment as P0 | Reduced to KCPL-FSA-024 P1 | Wrong ledger state is verified; direct bank disbursement is not. |
| INT-017 malformed X12 as P0 | Reduced to KCPL-FSA-019 P1 | Serious workflow corruption, not verified systemic compromise/catastrophic loss. |
| Tender/consolidation races labelled Critical | Reduced to P1 | Duplicate booking/workflow corruption fits supplied P1 definition. |
| TMS-030 standalone | Merged into KCPL-FSA-032 | Symptom of rating/result validation rather than independent root cause. |
| FIN-20 standalone | Merged into visibility/performance findings | Same capped-dashboard root cause. |

## 17. Remediation Roadmap

### Wave 0: Immediate P0 containment

No P0 is verified. If EDI, Custom GPT, Maersk webhooks, DHL sync or external pickup already face production traffic, restrict access and rotate shared credentials while Wave 1 lands. This is containment, not a substitute for fixes.

### Wave 1: Security + financial P1

KCPL-FSA-001, 002, 003, 004, 024, 025, 026, 027, 028, 029.

### Wave 2: Workflow/data integrity P1

KCPL-FSA-005 to 014, plus 022 and 023.

### Wave 3: Integration/concurrency P1/P2

KCPL-FSA-015 to 021, then 030, 035, 036, 040 to 044, 057 and 058.

### Wave 4: Performance/reliability

KCPL-FSA-045 to 056, prioritizing removal of write-on-read dashboards, indexed pagination, failure isolation, source-controlled indexes and protected main.

### Wave 5: UX/P3 cleanup

KCPL-FSA-059 to 062.

## 18. Recommended PR Breakdown

| PR | Findings | Scope |
|---|---|---|
| PR 1 - Staff profiles authoritative | KCPL-FSA-001 | Remove ongoing admin-email promotion after explicit bootstrap; fail closed; add role/branch tests. |
| PR 2 - EDI object scope | KCPL-FSA-002 | Pass StaffContext into queue helper and enforce tender branch. |
| PR 3 - Finance-link object scope | KCPL-FSA-003 | Authorize shipment/customer before any link/create side effect. |
| PR 4 - Split machine credentials | KCPL-FSA-004, 040 | Unique scheduler/pickup/provider identities and rotation. |
| PR 5 - Tender transaction state machine | KCPL-FSA-005 | One active/current tender with transactional stale-action protection. |
| PR 6 - Booking idempotency | KCPL-FSA-006 | Deterministic booking key and transaction. |
| PR 7 - Immutable commercial versions | KCPL-FSA-008, 009, 010, 011, 030 | Bind pricing/approval/quote/tender/booking/audit lineage. |
| PR 8 - Strict rate applicability | KCPL-FSA-012, 032 | Branch/equipment/date/numeric/conflict validation. |
| PR 9 - Consolidation CAS/allocation | KCPL-FSA-007, 013, 033, 034, 035 | Membership/release/booking versions, allocation lineage/precision, counters. |
| PR 10 - Machine-event workflow gate | KCPL-FSA-014 | One transition policy for human and external events. |
| PR 11 - Ordered idempotent tracking | KCPL-FSA-015 | Deterministic events, transactional monotonic state, invalid-time quarantine. |
| PR 12 - DCSA correlation/semantics | KCPL-FSA-016 | Identifier intersection, planned/actual classification, replay/signature. |
| PR 13 - Partner-bound EDI 990 | KCPL-FSA-017 | Expected-carrier credentials and transactional response. |
| PR 14 - EDI 204 claim/idempotency | KCPL-FSA-018 | One durable business message, claim/lease/ack/retry. |
| PR 15 - X12/214 hardening | KCPL-FSA-019, 020, 042 | Envelope/time/mapping validation and resumable event apply. |
| PR 16 - DHL identity/resilience | KCPL-FSA-021, 041 | Strict tracking identity, response binding, retry/backoff, host/health. |
| PR 17 - Pickup state machine/outbox | KCPL-FSA-022 | Atomic appointment/shipment state plus retryable tracking/event publish. |
| PR 18 - Job close/version | KCPL-FSA-023, 057 | Closed immutability, workflow version, durable provenance. |
| PR 19 - Finance payment transactions | KCPL-FSA-024 | AP/AR transaction, idempotency and outbox. |
| PR 20 - Atomic Match-Pay | KCPL-FSA-025, 043 | One monetary basis and same-transaction version check/settlement. |
| PR 21 - Invoice business keys | KCPL-FSA-026 | Deterministic AP/AR idempotency. |
| PR 22 - Creditor identity lock | KCPL-FSA-027 | Freeze after approval/payment; explicit correction workflow. |
| PR 23 - Multi-currency profitability | KCPL-FSA-028, 044 | Per-currency or FX-versioned reporting with explicit tax basis. |
| PR 24 - Branch-scoped GPT | KCPL-FSA-029 | Scoped claims, branch filters and field minimization. |
| PR 25 - One command/navigation model | KCPL-FSA-045, 046 | Single palette/permission source and reliable deep links. |
| PR 26A-D - Paginated read-only workspaces | KCPL-FSA-047 to 054 | Split by search/notifications, tender/pickup, finance/audit, Job File/EDI. |
| PR 27 - Repo/runtime reproducibility | KCPL-FSA-055, 056 | Source-control indexes and protect main/CI. |
| PR 28 - Low-risk hygiene | KCPL-FSA-059 to 062 | Metadata, logout, accessibility/mobile, admin asset split. |

Do **not** combine these into one "fix everything" PR. Each PR should own one small invariant and its regression tests.

## 19. Release Blockers

**KCPL should not currently be considered production-ready.**

### Core unconditional blockers

KCPL-FSA-001, 003, 005 to 015, and 022 to 028.

### Conditional blockers for enabled integrations/features

- **EDI enabled:** KCPL-FSA-002, 017, 018, 019, 020.
- **External pickup enabled:** KCPL-FSA-004 and 022.
- **Maersk/DCSA enabled:** KCPL-FSA-016.
- **DHL automatic tracking enabled:** KCPL-FSA-021.
- **Custom GPT connected to production data:** KCPL-FSA-029.

P2 findings should be triaged before scale-up. In particular KCPL-FSA-052 can turn dashboard rendering into failed/mass state changes, and KCPL-FSA-056 allows code to bypass the review/CI discipline needed while high-risk fixes are landing.

## 20. Next Audit Areas

- Deployed Firestore Security Rules, Storage Rules, IAM/service accounts and emulator-backed deny tests.
- Production Firebase/App Hosting environment, secret rotation, scheduler identity and network exposure.
- DHL, Maersk/DCSA and EDI partner sandbox/certification against real implementation guides.
- Backup, restore, PITR and disaster-recovery drills.
- Malware scanning, retention, legal-hold, deletion and privacy controls for documents/POD.
- Tamper-resistant audit logs, redaction, alerting/SIEM and incident response.
- Accounting policy: tax, FX, credits, reversals, write-offs, maker-checker and bank-payment handoff.
- Legacy migration/reconciliation at production scale.
- Dependency/SCA, package vulnerabilities, build provenance and supply-chain controls.
- Firestore load/cost testing and operational data-volume budgets.
- Customer/vendor/public portal security and abuse controls.
- Data-quality migration for existing records already violating new tender, booking, pricing, consolidation or finance invariants.

## Lead-Review Conclusion

The correct remediation is not a giant rewrite. KCPL needs a small set of shared primitives made authoritative: **staff/object authorization, immutable commercial versions, transactional state/version checks, deterministic idempotency keys, an outbox for cross-module side effects, and one policy-gated external event ingestion path**.

The recommended first fix is **PR 1 - Staff profiles authoritative (KCPL-FSA-001)**. It is narrowly scoped, independently testable, removes a systemic all-branch privilege-escalation path, and gives every later branch-sensitive fix a trustworthy authorization foundation.
