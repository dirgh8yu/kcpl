# KCPL Financial Integrity Audit: Finance, Freight Audit and Match-Pay

**Audit agent:** Audit Agent 5  
**Repository:** `dirgh8yu/kcpl`  
**Branch audited:** `main`  
**Main commit re-checked before report write:** `d0f74ea572f3efea0a454a97a4fd339f12ed7e20`  
**Audit date:** 2026-08-22  
**Mode:** Audit only. No application code, Firestore data, or production configuration was changed.

## Executive finding

The financial control stack is **not yet safe to treat as a hard Match-Pay invariant**.

The normal AP payment HTTP route does refresh Freight Audit immediately before calling the payment function, and the audit correctly blocks `review_required`, `disputed`, `rejected`, and other non-payable statuses. Direct browser Firestore writes are also denied by `firestore.rules`. Those are meaningful controls.

However, payment is still possible under several financially unsafe conditions. The highest-risk paths are:

1. concurrent AP payments can both commit against the same pre-payment balance, creating two payment records while the parent bill reflects only one;
2. Freight Audit matches booked procurement against **supplier invoice subtotal**, while AP settles **supplier invoice total**, so tax can increase the payable far beyond the amount that passed Match-Pay;
3. `not_applicable` is explicitly payment-allowed, including no-shipment/general bills and many ancillary supplier bills;
4. the audit gate and payment write are separate operations, so a commercial or supplier mutation can occur after the audit check and before settlement;
5. payment commits before several post-payment side effects complete, so a post-commit error can present as a failed request and invite a retry that records another payment;
6. supplier reconciliation can rewrite supplier identity on approved, partially paid, and fully paid bills;
7. AR uses the same non-transactional stale-balance payment pattern;
8. customer profitability silently excludes invoices and job costs in currencies other than the customer's preferred currency.

**Overall financial-integrity verdict: FAIL for production-grade Match-Pay / settlement assurance.**

---

## Severity summary

| ID | Severity | Finding |
|---|---|---|
| FIN-01 | **CRITICAL** | Concurrent AP payments can double-settle the payment subledger while the bill balance records only one payment |
| FIN-02 | **CRITICAL** | Match-Pay validates subtotal but payment settles total, permitting tax-driven overpayment |
| FIN-03 | **HIGH** | `not_applicable` is a broad payment-allowed class and no-shipment bills bypass freight matching |
| FIN-04 | **HIGH** | Freight Audit check and AP settlement are non-atomic, creating a stale-audit TOCTOU payment window |
| FIN-05 | **HIGH** | AP/AR payment can commit and then fail during side effects, making a successful payment look retryable |
| FIN-06 | **HIGH** | AP duplicate-invoice prevention is race-prone and disappears when supplier invoice reference is absent |
| FIN-07 | **HIGH** | Supplier reconciliation can rewrite creditor identity after approval or settlement |
| FIN-08 | **HIGH** | No maker-checker segregation for ordinary AP: Accounts can create, approve, and pay the same bill |
| FIN-09 | **HIGH** | AR receipts have the same concurrent double-record / parent-balance corruption race as AP |
| FIN-10 | **HIGH** | AR invoice creation has no request idempotency or duplicate commercial-document guard |
| FIN-11 | **HIGH** | Customer financial totals silently omit non-preferred-currency revenue and costs |
| FIN-12 | **MEDIUM** | Freight Audit can return `matched` even when current order/rate-card economics can no longer reproduce the booked procurement snapshot |
| FIN-13 | **MEDIUM** | Zero-value tender counteroffers can become booked procurement, interacting badly with the absolute tolerance floor |
| FIN-14 | **MEDIUM** | Approved-variance review actions are replayable and can overwrite approval provenance |
| FIN-15 | **MEDIUM** | Invalid or corrupt stored currencies are silently coerced to NPR in financial readers |
| FIN-16 | **MEDIUM** | Profitability is calculated from tax-inclusive invoice/payable totals, while Freight Audit matches pre-tax subtotal |
| FIN-17 | **MEDIUM** | Legacy supplier invoice references can evade normalized duplicate detection; normalization can also collapse distinct references |
| FIN-18 | **MEDIUM** | AR calendar-date validation is weaker than AP and permits impossible dates / due-before-issue chronology |
| FIN-19 | **MEDIUM** | Match-Pay is enforced at the current HTTP route, not inside the payment domain primitive |
| FIN-20 | **LOW** | Freight Audit queue is capped at 250 recent payables, creating material review-visibility blind spots |

---

# Detailed findings

## FIN-01 - CRITICAL - Concurrent AP payments can create two cash-payment records while the parent bill records only one

**Affected code**
- `app/admin/payables/payables.server.ts`
- `recordPayablePayment()`

**Evidence**

`recordPayablePayment()` reads the bill and its `amount_paid` / `balance_due` before starting any transaction. It then calculates `nextPaid` and `nextBalance` from that snapshot, creates a random child payment document, and updates the bill in a Firestore batch. A batch is atomic for its own writes, but it does not protect the preceding read from concurrent changes.

**Adversarial sequence**

Assume a bill has total 100.00, amount paid 0.00, balance 100.00.

1. Request A reads balance 100.00.
2. Request B reads balance 100.00 before A commits.
3. A validates payment 100.00, creates payment child A for 100.00, updates parent to paid 100.00 / balance 0.00.
4. B has already passed the same validation. It creates a different random payment child B for 100.00 and writes the same parent values: paid 100.00 / balance 0.00.
5. Payment subcollection now totals 200.00 while the AP control document reports only 100.00 paid.

There is no transaction precondition on the current bill version and no idempotency key preventing the second child payment.

**Financial impact**

This is a direct duplicate-payment and ledger-reconciliation failure. A bank/payment integration acting on the child payment records could transfer 200.00 while KCPL's AP balance shows only 100.00 paid. The parent/subledger inconsistency can also conceal the overpayment from ordinary balance reporting.

---

## FIN-02 - CRITICAL - Match-Pay validates supplier subtotal but AP settles supplier total

**Affected code**
- `app/admin/freight-audit/freight-audit.server.ts`
- `app/admin/payables/payables.server.ts`
- `app/admin/freight-audit/freight-audit.ts`

**Evidence**

Freight Audit computes variance between `shipment.procurement_cost` and `bill.subtotal`. Tax is included in the fingerprint and displayed as `invoice_tax`, but there is no tax-policy issue and no comparison that limits the amount ultimately payable.

AP payment, however, uses the bill's `total` / `balance_due`, where:

`total = subtotal + tax_total`

Supplier bill creation accepts tax rates from 0 through 100 percent.

**Concrete exploit**

- Booked procurement cost: NPR 100.00
- Supplier invoice subtotal: NPR 100.00
- Tax rate entered: 100%
- Supplier invoice tax: NPR 100.00
- Supplier invoice total / AP balance: NPR 200.00

Freight Audit variance is 0.00 because 100.00 subtotal exactly matches 100.00 booked procurement. The bill can become `matched`, be approved, and then be paid for 200.00.

The same problem exists for less extreme but still material tax errors. The fingerprint only detects a later tax change after an audit refresh. It does not declare an excessive or unsupported tax amount to be a discrepancy.

**Financial impact**

A bill can pass Match-Pay while the actual cash obligation is materially greater than the approved procurement cost. Match-Pay therefore does not currently prove that the amount being paid is the amount commercially booked.

---

## FIN-03 - HIGH - `not_applicable` is payment-allowed and provides a broad escape from freight matching

**Affected code**
- `app/admin/freight-audit/freight-audit.server.ts`
- `app/admin/freight-audit/freight-audit.ts`

**Evidence**

`freightAuditPaymentAllowed()` explicitly returns true for:
- `matched`
- `approved_variance`
- `not_applicable`

`recordFromSource()` marks a payable `not_applicable` when there is no shipment reference, the shipment does not exist / is not TMS-booked, or when a TMS bill is classified as ancillary under the supplier/category rules.

For the no-shipment path, duplicate supplier invoice issues are not applied before status becomes `not_applicable`.

**Adversarial cases**

1. Create a supplier bill without a shipment reference. It is outside Match-Pay and `not_applicable` is payment-allowed.
2. A carrier-related cost recorded as a non-`freight` / non-`transport` category against a supplier different from the booked provider can be classified as ancillary and paid without comparing its amount to booked procurement.
3. Two no-shipment bills can carry the same economic obligation and still reach a payment-allowed audit class if the creation-time duplicate control does not catch them.

General overhead and genuine ancillary costs may intentionally sit outside carrier matching, but there is no stronger compensating approval workflow for this payment-allowed class.

**Financial impact**

The statement “payment is impossible without Match-Pay” is false. A large category of AP is expressly payable without procurement matching, while ordinary Accounts users can also approve and pay those bills.

---

## FIN-04 - HIGH - Freight Audit and AP payment are separated by a TOCTOU window

**Affected code**
- `app/api/admin/payables/bills/[reference]/payments/route.ts`
- `app/admin/freight-audit/freight-audit.server.ts`
- `app/admin/payables/payables.server.ts`
- `app/admin/partners/reconciliation/supplier-reconciliation.server.ts`

**Evidence**

The HTTP payment route first calls `ensureFreightAuditForPayment()`. Only after that async operation returns `allowed` does it call `recordPayablePayment()`.

The payment function does not receive or enforce the audited commercial fingerprint and does not revalidate the audit inside the same Firestore transaction as settlement.

**Concrete stale-audit race**

1. Payment request refreshes the audit and receives `matched`.
2. Before the payment function reads/writes the payable, another request reconciles the supplier identity, or another server-side mutation changes commercial evidence.
3. Payment proceeds because `recordPayablePayment()` checks only AP status and balance, not the fingerprint that was just approved.

The supplier reconciliation path is transactional in isolation, but it can still execute between these two independent operations.

**Financial impact**

The system correctly detects stale fingerprints when it gets another chance to refresh them. It does not prove that the exact record version paid is the record version audited.

---

## FIN-05 - HIGH - Payment can commit successfully and then return an error, encouraging duplicate retry

**Affected code**
- `app/admin/payables/payables.server.ts`
- `app/admin/finance/finance.server.ts`

**Evidence**

Both AP and AR commit the money-state batch before executing follow-on work.

AP performs the payment batch, then writes shipment / partner activity. AR performs the receipt batch, then recomputes customer finance and writes customer / job activity.

If a post-commit operation throws, the request can fail after the payment/receipt has already been persisted. There is no caller-supplied idempotency token that makes a retry safe.

**Adversarial / operational sequence**

1. Payment batch commits.
2. Activity or recomputation fails transiently.
3. Client receives a server error or connection failure and cannot know the cash-state write succeeded.
4. User or automated client retries.
5. A new random payment document can be created.

FIN-01 and FIN-09 make the consequence worse under simultaneous retry.

**Financial impact**

A transient non-financial side-effect failure can turn into a duplicate financial transaction.

---

## FIN-06 - HIGH - AP duplicate-invoice prevention is not concurrency-safe and can be disabled by a missing supplier reference

**Affected code**
- `app/admin/payables/payables.server.ts`
- `app/admin/freight-audit/freight-audit.server.ts`

**Evidence**

`createPayable()` performs a duplicate query first and then creates the new bill under a random KCPL bill reference. There is no transaction or deterministic unique document keyed by supplier plus normalized supplier invoice reference.

Two concurrent requests for the same supplier invoice can both observe “no duplicate” and both create separate payable documents.

If `supplier_bill_reference` is blank, the creation duplicate check has no normalized key to compare. For a core TMS freight bill, Freight Audit later blocks the missing reference, but no-shipment / non-TMS bills become `not_applicable` instead.

**Financial impact**

Duplicate obligations can enter AP despite the duplicate check, and some classes remain payment-eligible.

---

## FIN-07 - HIGH - Supplier reconciliation can rewrite the creditor on approved, partially paid, or fully paid bills

**Affected code**
- `app/admin/partners/reconciliation/supplier-reconciliation.server.ts`

**Evidence**

`reconcileSupplierBill()` rejects only `void` bills. It does not prohibit reconciliation when status is `approved`, `overdue`, `partially_paid`, or `paid`.

The transaction changes:
- `supplier_id`
- `supplier_name`
- `supplier_key`
- linked job-cost `partner_id`
- linked job-cost `vendor`

It records reconciliation history, but the canonical AP bill and profitability cost attribution are still rewritten.

**Financial impact**

A settled creditor ledger can change identity after authorization and payment. For a partially paid bill, historical payments remain children of a parent whose supplier identity may now be different from the supplier identity under which those payments were authorized. For a fully paid bill, ordinary Match-Pay may never run again to surface the changed fingerprint.

This is also a concrete mutation that can exploit the FIN-04 audit/payment race.

---

## FIN-08 - HIGH - Ordinary AP lacks maker-checker segregation

**Affected code**
- `app/admin/staff-permissions.ts`
- payable create / approve / payment routes

**Evidence**

`canManageFinance` is granted to both `management` and `accounts`. The same capability controls creating supplier bills, approving ordinary bills, and recording payments.

Management is required for `approve_variance`, but a bill that is `matched` or `not_applicable` needs no second person.

**Adversarial sequence**

An Accounts user can:
1. create a no-shipment supplier bill;
2. receive `not_applicable` from Freight Audit;
3. approve the bill;
4. record its payment.

No independent approver is required anywhere in that sequence.

**Financial impact**

A compromised or malicious Accounts account has an end-to-end path from obligation creation to settlement for ordinary / non-matched AP.

---

## FIN-09 - HIGH - AR receipts have the same stale-balance concurrency defect as AP

**Affected code**
- `app/admin/finance/finance.server.ts`
- `recordFinancePayment()`

**Evidence**

AR loads invoice balance before any transaction, calculates the new paid/balance values, then creates a random payment child and overwrites the invoice totals in a batch.

**Adversarial sequence**

For an invoice with balance 100.00, two concurrent receipt requests of 100.00 can both validate against the same balance. Each creates a distinct 100.00 child receipt. Both set the parent to amount paid 100.00 and balance 0.00.

Result:
- payment subcollection: 200.00 received
- invoice control total: 100.00 received

**Financial impact**

Customer receipts, bank reconciliation, collection reporting, and customer statements can disagree. The same issue is triggered naturally by retries because payment references are optional and not unique.

---

## FIN-10 - HIGH - AR invoice creation is not idempotent and has no duplicate commercial-document guard

**Affected code**
- `app/admin/finance/finance.server.ts`
- `app/api/admin/finance/invoices/route.ts`

**Evidence**

Every create request generates a new random `KCPL-I-*` reference. There is no request idempotency key, no uniqueness key based on customer/shipment/commercial event, and no equivalent of the supplier-reference duplicate check used in AP.

A double-click, network retry, or two callers submitting the same invoice payload can therefore create two draft invoices. Each can later be issued.

**Financial impact**

KCPL can overstate receivables and send duplicate invoices for the same service without the data layer identifying them as duplicates.

---

## FIN-11 - HIGH - Customer profitability silently drops all non-preferred-currency activity

**Affected code**
- `app/admin/finance/finance.server.ts`
- `recomputeCustomerFinance()`

**Evidence**

Customer finance selects one currency: the customer's `preferred_currency`. It then:
- skips every invoice whose currency differs;
- skips every job cost whose currency differs;
- writes single scalar `revenue_total`, `cost_total`, `profit_total`, and `outstanding_balance` values in the preferred currency.

There is deliberately no hidden FX conversion, which is good, but the excluded currency positions are not represented in these scalar totals.

**Example**

Customer preferred currency = NPR. A shipment produces USD 10,000 revenue and USD 8,000 cost. Those amounts contribute zero to the customer's `revenue_total`, `cost_total`, and `profit_total` unless separately viewed elsewhere.

**Financial impact**

Customer-level profitability and exposure can be materially understated or appear as zero even when substantial business exists. “No hidden FX” currently becomes “silent omission” rather than explicit multi-currency accounting.

---

## FIN-12 - MEDIUM - `matched` does not prove the procurement snapshot remains reproducible

**Affected code**
- `app/admin/freight-audit/freight-audit.server.ts`
- `bookingBaseline()` / `recordFromSource()`

**Evidence**

The commercial fingerprint includes current transport-order quantities and current rate-card economics. If they change, an existing approved variance is invalidated on refresh.

However, `bookingBaseline()` returns `null` when the current order/rate-card economics no longer reproduce the stored booked procurement cost. A null baseline does not create a blocking audit issue.

If the supplier subtotal still equals the stored `shipment.procurement_cost`, the refreshed audit can become `matched` even though the live supporting rate-card/order evidence can no longer reproduce that booking.

**Financial impact**

`matched` proves invoice-to-snapshot equality, not snapshot-to-source-commercial reproducibility. A mutated rate card, quantity, or historical commercial record can therefore leave a payment-allowed audit with no reconstructable pricing baseline.

---

## FIN-13 - MEDIUM - Zero-value tender counteroffers can become booked procurement

**Affected code**
- `app/admin/tenders/tms-tendering.server.ts`
- `app/admin/tenders/tms-tendering.ts`
- `app/admin/freight-audit/freight-audit.ts`

**Evidence**

Counteroffer validation rejects values `< 0`, not values `<= 0`. `tenderFinalCommercials()` accepts the stored counter cost without a positive-value requirement, and booking writes that amount into `shipment.procurement_cost`.

Freight Audit uses an absolute tolerance floor of 1 currency unit. For booked cost 0.00, an invoice subtotal of up to 1.00 is within tolerance.

**Financial impact**

A zero procurement snapshot is treated as a legitimate commercial baseline and can generate a `matched` audit for a small nonzero supplier invoice. More importantly, zero-cost bookings can contaminate margin and procurement reporting without being treated as exceptional.

---

## FIN-14 - MEDIUM - Variance approval can be replayed and approval provenance overwritten

**Affected code**
- `app/admin/freight-audit/freight-audit.server.ts`
- `reviewFreightAudit()`

**Evidence**

The review function blocks actions only when current status is `not_applicable` or `matched`. It does not implement a strict transition matrix for `review_required`, `disputed`, `approved_variance`, and `rejected`.

A management user can call `approve_variance` again while the unchanged audit is already `approved_variance`. The write replaces `approved_at`, `approved_by_name`, `approved_by_email`, and resolution note.

Similar cross-state actions can change a previously rejected/disputed record without preserving the original decision as immutable canonical approval metadata.

**Financial impact**

The audit activity trail records events, but the primary approval fields do not reliably preserve who first approved a variance and when. This weakens non-repudiation for payment authorization.

---

## FIN-15 - MEDIUM - Invalid stored currencies are silently coerced to NPR

**Affected code**
- `app/admin/payables/payables.server.ts`
- `app/admin/finance/finance.server.ts`
- `app/admin/freight-audit/freight-audit.server.ts`
- `app/admin/job-file.server.ts`

**Evidence**

Several `currencyValue()` readers return `NPR` when a stored value is absent, invalid, or no longer in the supported enum.

This is different from validating a new request. It means corrupt or legacy financial records can be interpreted as NPR instead of failing closed as an invalid-currency record.

**Financial impact**

Malformed historical USD/AUD/etc. data can be presented, aggregated, audited, or compared as NPR. A data-integrity problem can therefore become a financial misclassification rather than an explicit exception.

---

## FIN-16 - MEDIUM - Profitability uses tax-inclusive totals while procurement matching uses pre-tax subtotal

**Affected code**
- `app/admin/payables/payables.server.ts`
- `app/admin/job-file.server.ts`
- `app/admin/finance/finance.server.ts`

**Evidence**

When an AP bill is approved, the linked job cost is written using `bill.total`, including tax. Job revenue is calculated from issued customer invoice `total`, also including tax. Job profit is revenue total minus cost total.

Freight Audit, meanwhile, validates booked procurement against supplier `subtotal`.

**Financial impact**

The system is using different economic bases for Match-Pay and profitability. Where taxes are pass-through, recoverable, jurisdiction-dependent, or taxed differently on customer and supplier documents, reported margin can move because of tax rather than freight economics. FIN-02 makes this especially dangerous because an anomalous tax amount can pass Match-Pay and flow directly into cost/profitability.

---

## FIN-17 - MEDIUM - Legacy invoice-reference handling can miss duplicates and normalization can create false collisions

**Affected code**
- `app/admin/payables/payables.server.ts`
- `app/admin/freight-audit/freight-audit.server.ts`
- `app/admin/freight-audit/freight-audit.ts`

**Evidence**

Freight Audit duplicate lookup queries `normalized_supplier_bill_reference`. Legacy records that do not have that field are not comprehensively re-normalized during that query.

The create-time legacy fallback queries the raw `supplier_bill_reference` for the *normalized new value*, so a legacy raw value such as `INV-001` is not guaranteed to match a new normalized value `INV001` unless the legacy normalized field already exists.

The normalization itself removes all punctuation. Distinct references such as punctuation-significant supplier numbering schemes can therefore collapse onto the same normalized token and create false positives.

**Financial impact**

The duplicate control is neither a guaranteed unique key nor a lossless supplier-document identifier across historical data.

---

## FIN-18 - MEDIUM - AR accepts invalid calendar chronology that AP correctly rejects

**Affected code**
- `app/admin/finance/finance.server.ts`

**Evidence**

AR `safeDate()` accepts any string matching `YYYY-MM-DD`; it does not verify that the date exists on the calendar. It also does not enforce due date >= issue date.

AP has dedicated calendar validation and `payableDateError()` chronology checks, so the two ledgers have materially different date-integrity standards.

**Examples**

- `2026-02-31` passes the AR format check.
- A due date before the issue date can be stored.

**Financial impact**

Aging buckets, overdue status, collection priority, and customer statements can be distorted by impossible or reversed dates.

---

## FIN-19 - MEDIUM - Match-Pay is a route-level convention, not a payment-domain invariant

**Affected code**
- `app/api/admin/payables/bills/[reference]/payments/route.ts`
- `app/admin/payables/payables.server.ts`

**Evidence**

The current AP payment HTTP route correctly calls `ensureFreightAuditForPayment()` before `recordPayablePayment()`.

But the exported `recordPayablePayment()` primitive itself performs no Freight Audit check and accepts a bill purely on payable status and balance.

The same architectural split exists for approval: the route performs the audit gate, while `approvePayable()` itself does not.

**Financial impact**

A future internal caller, migration, scheduled job, integration, or refactor can invoke the domain function and bypass Match-Pay without violating its API contract. The rule “never settle an unaudited bill” is therefore not encoded at the financial state-transition boundary.

No current browser Firestore bypass was found, because `firestore.rules` denies all direct client reads/writes.

---

## FIN-20 - LOW - Freight Audit review queue only surfaces 250 recent payables

**Affected code**
- `app/admin/freight-audit/freight-audit.server.ts`
- `listFreightAuditQueue()`

**Evidence**

The queue reads payables ordered by `updated_at` and stops at 250 before branch filtering and audit rendering.

The payment endpoint refreshes the specific payable separately, so this does not by itself bypass Match-Pay. It is still an operational-control blind spot: older unresolved, disputed, or anomalous bills can disappear from the main audit workspace as newer payables accumulate.

**Financial impact**

Exception monitoring is incomplete at scale, increasing the chance that unresolved liabilities or disputes remain invisible until someone accesses the individual bill.

---

# Match-Pay payment-impossibility proof matrix

| Condition at time of payment attempt | Current result | Audit conclusion |
|---|---|---|
| `matched` | Payment allowed | Expected |
| `approved_variance`, unchanged fingerprint | Payment allowed | Expected, subject to approval replay issue |
| `review_required` | Payment blocked by route | Control works |
| `disputed` | Payment blocked by route | Control works |
| `rejected` | Payment blocked by route | Control works |
| `pending` | Payment blocked by policy | Control works |
| fingerprint changed **before** route audit refresh | Recomputed; old approved variance is not retained | Control works |
| missing booking cost on a TMS freight bill | `review_required`, payment blocked | Control works |
| supplier mismatch on carrier-like freight/transport bill | `review_required`, payment blocked | Control works |
| booking/invoice currency mismatch | `review_required`, payment blocked; no hidden FX | Control works |
| invoice subtotal above tolerance | `review_required`, payment blocked | Control works |
| no shipment / non-TMS shipment | `not_applicable`, payment allowed | **Not a hard Match-Pay invariant** |
| ancillary supplier bill | normally `not_applicable`, payment allowed unless duplicate detected | **Not procurement matched** |
| invoice subtotal matches booking but tax inflates total | `matched`; full total can be paid | **Critical bypass** |
| fingerprint changes **after** route audit refresh but before payment write | Payment can continue | **Stale-audit TOCTOU** |
| two simultaneous payment requests against same balance | Both can create child payments | **Critical concurrency failure** |
| committed payment followed by side-effect failure and retry | Retry can create another payment | **Idempotency failure** |

**Conclusion:** payment is **not truly impossible** when the audit is stale in the post-check/pre-write window, when the bill is classified `not_applicable`, when tax increases the payable above the matched subtotal, or when duplicate/concurrent/retried settlement requests occur.

---

# Tolerance and rounding observations

- Default tolerance implements the stated policy: greater of 1 currency unit or 1% of booked procurement.
- Boundary comparison includes a `0.00001` floating-point cushion.
- Booked/invoice variance is rounded to two decimals for reporting, while tolerance comparison uses raw numeric difference plus epsilon.
- No direct floating-point exploit larger than the configured tolerance was identified in the reviewed helper.
- The more serious boundary case is booked procurement of 0.00: the fixed 1-unit floor makes invoice subtotals up to 1.00 match, and zero counteroffers are currently accepted upstream.

---

# Controls that held under adversarial review

These do not negate the findings above, but are important to distinguish from missing controls:

- Firestore client access is denied globally in `firestore.rules`; reviewed finance writes go through server/Admin SDK paths.
- AP bill subtotal must be positive on ordinary create; negative and zero bill amounts are rejected there.
- AP and AR payment amounts must be positive and cannot exceed the balance observed by that request.
- AP tax rate is limited to 0 through 100 percent, although FIN-02 shows this is not sufficient Match-Pay validation.
- AP bill dates use real calendar validation and reject due-before-bill chronology.
- TMS Freight Audit blocks missing booked procurement cost, missing supplier reference, carrier supplier mismatch, currency mismatch, detected duplicates, and amount variance outside tolerance.
- No hidden FX conversion was found in Match-Pay. Currency mismatch blocks instead.
- Commercial fingerprints use SHA-256 and include the core bill, booking, order-quantity and rate-card economics reviewed. No practical cryptographic collision concern was identified.
- When a fingerprint changes before the audit is refreshed, prior `approved_variance` state is not carried forward automatically.
- The normal AP payment route does invoke Freight Audit before calling the payment function.

---

# Test-gap finding appendix

The existing `tests/freight-audit-policy.test.mjs` exercises the pure tolerance, currency, reference-normalization, fingerprint, and payment-status helpers. The reviewed test set does not establish the financial invariants that fail above.

No reviewed test proves all of the following end-to-end:

- two simultaneous AP payment requests cannot double-record;
- two simultaneous AR receipt requests cannot double-record;
- a retry after a post-commit failure is idempotent;
- supplier invoice total, including tax, cannot exceed the commercially authorized amount;
- a no-shipment or ancillary `not_applicable` bill receives an independent settlement approval;
- a supplier reconciliation between audit and payment cannot stale the audit being paid;
- paid bills cannot have their canonical supplier identity rewritten;
- duplicate supplier bills cannot race past the pre-create lookup;
- repeated AR invoice creation requests are idempotent;
- multi-currency customer profitability is complete rather than silently filtered;
- variance approval provenance cannot be replayed/overwritten;
- zero-cost procurement is rejected or explicitly governed.

The absence of these tests is material because several of the corresponding adverse states are reachable from the reviewed implementation, not merely hypothetical coverage concerns.
