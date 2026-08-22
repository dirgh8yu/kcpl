# KCPL Full System Audit v2 - Stage 4: Finance and Settlement

**Audit type:** hostile financial-integrity audit / audit-only  
**Repository:** `dirgh8yu/kcpl`  
**Latest `main` observed immediately before report write:** `55774dc27f0deaa936511a682e46e2648e77f5f6`  
**Application code ref under that documentation commit:** `61bd787fdf1d76819ca6547e74383a0e751592a6` (`#130`)  
**Open PRs at final pre-write re-check:** none  
**Application code changed:** no  
**Production data mutated:** no

## Audit precondition and predecessor-report state

The assignment required this stage to read:

- `docs/audits-v2/01-baseline-architecture.md`
- `docs/audits-v2/02-commercial-chain.md`
- `docs/audits-v2/03-execution-external-events.md`

Repository state changed while this audit was in progress. At audit start none of those v2 files existed on `main`. Stage 2 was then committed as `55774dc27f0deaa936511a682e46e2648e77f5f6`, and this audit re-read `docs/audits-v2/02-commercial-chain.md` from that exact ref before finalizing Stage 4.

At the final pre-write repository re-check, Stage 1 and Stage 3 still did **not** exist in `docs/audits-v2`. This report therefore does not pretend those prerequisites were available. It uses the current application code directly, the available Stage 2 report, the pre-v2 finance audit, and the merged remediation implementations for #126, #128, #129 and #130.

The missing Stage 1 and Stage 3 artifacts are an audit-chain provenance/process limitation, not a financial application finding by themselves.

---

# Executive verdict

## Overall financial-integrity verdict: FAIL for end-to-end production settlement assurance

PR #126 fixed several genuinely dangerous defects from the first audit. A single AP bill or AR invoice is no longer vulnerable to the old stale-balance concurrent payment race on the normal HTTP path. Payment creation and parent balance mutation now occur in one Firestore transaction. Settlement totals are re-derived and reconciled. Currency mismatches fail closed. Deterministic payment IDs and request fingerprints exist. Supplier invoice identity now has a transaction-backed uniqueness key. Supplier relinking is financially locked once payment exists. PR #129 also materially improves TMS procurement authority: Match-Pay rereads the shipment, order, booked commercial snapshot, booked version/fingerprint and persisted commercial version in the same payment transaction.

Those are strong controls and should not be discounted.

The system still does not provide a single financial truth across the whole requested chain, however. The most serious remaining defects are cross-document and cross-workflow rather than stale writes on one document:

1. A stale TMS quote can still create the parallel non-lineaged shipment identified by Stage 2. Finance classifies that shipment as non-TMS, giving it `not_applicable` Freight Audit treatment and a path to payment without booked commercial Match-Pay.
2. Match-Pay is bill-local, not shipment-obligation-local. Two different supplier invoice references can each match the same full booked procurement and each be paid.
3. Consolidation exposes both master and house shipments as independently billable TMS procurement bases. A master bill and allocated house bills can all independently match and settle, while actual customer profitability cannot allocate a master-only supplier bill back to the houses.
4. Freight Audit still compares booked procurement against supplier **subtotal**, while settlement can pay tax-inclusive total. Tax is attested for staleness but is not commercially validated. A 100% tax entry can still turn a perfectly `matched` 100 procurement into a 200 payable.
5. AR business-event idempotency remains explicitly deferred. Duplicate customer invoices for the same shipment/commercial event can still be created and issued.
6. AR invoice economics are not bound to #129 booked customer sell lineage at all. Amount and currency are finance-entered values rather than an attested booked sell version.
7. The #126 fallback idempotency design conflates identical requests with identical real-world payments, so a legitimate second equal payment can disappear as `idempotent`; conversely a retry after a full or sufficiently large partial payment can return `already_paid`/`overpayment` before the existing idempotent payment is recognized.
8. Commercial “actual profitability” is not settlement truth. It can include draft/unapproved AP if Freight Audit is matched, uses invoice subtotal rather than the payable settlement basis, and is not delivery/POD/final-completion gated.

In short, #126 successfully hardened **one-record settlement mechanics**, and #129 successfully hardened **normal TMS booked procurement lineage**, but their integration still lacks a canonical economic-obligation layer spanning shipment, consolidation and AR revenue.

---

# Severity summary

| ID | Severity | Class | Finding |
|---|---|---|---|
| KCPL-V2-FIN-001 | **CRITICAL** | Code / cross-module | Stage 2’s stale TMS quote shipment can become `not_applicable` finance and bypass booked-lineage Match-Pay |
| KCPL-V2-FIN-002 | **CRITICAL** | Code / financial invariant | Multiple distinct supplier invoices can each match and settle the same booked procurement |
| KCPL-V2-FIN-003 | **CRITICAL** | Code / consolidation | Master and house consolidation costs can both be financially effective; master-only actual cost is not allocated to house profitability |
| KCPL-V2-FIN-004 | **HIGH** | Code / settlement control | Match-Pay validates freight subtotal but does not validate tax economics, so matched procurement can settle materially above booked cost |
| KCPL-V2-FIN-005 | **HIGH** | Code / AR idempotency | AR invoice business-event idempotency remains unresolved; duplicate invoices can be created and issued |
| KCPL-V2-FIN-006 | **HIGH** | Code / lineage integration | AR invoice amount and currency are not bound to booked sell commercial lineage |
| KCPL-V2-FIN-007 | **HIGH** | Code / idempotency | Payment fingerprint fallback can suppress legitimate equal payments and retry recognition occurs after balance/status gates |
| KCPL-V2-FIN-008 | **HIGH** | Code / approval integrity | Freight Audit variance approval is not transactionally bound to the exact audit fingerprint and can race with a refreshed economic state |
| KCPL-V2-FIN-009 | **MEDIUM** | Code / reporting basis | “Actual profitability” can count draft/unapproved supplier invoices and ignores settlement adjustments/credits/tax |
| KCPL-V2-FIN-010 | **HIGH** | Code / reporting | Legacy customer finance totals silently omit non-preferred-currency activity and can coerce malformed legacy currency to NPR |
| KCPL-V2-FIN-011 | **MEDIUM** | Code / state concurrency | AR issue/void and AP approve/void are read-then-write transitions and can produce contradictory status/balance states |
| KCPL-V2-FIN-012 | **MEDIUM** | Code / currency precision | Settlement money is always two-decimal even for JPY, diverging from #129’s zero-decimal JPY commercial authority |
| KCPL-V2-FIN-013 | **HIGH** | Control design | The same Accounts/Management principal can create, approve and settle ordinary AP, including `not_applicable` obligations |

No P1/critical severity was assigned merely because maker-checker is absent. KCPL-V2-FIN-013 is explicitly a control-design finding. The critical findings above are concrete double-obligation or Match-Pay bypass paths.

---

# Controls that held under attack

The following controls were challenged and did not produce a supported-path bypass on the audited code:

- Direct browser Firestore reads/writes are denied by `firestore.rules`.
- `canManageFinance` is restricted to Management and Accounts. Commercial and Operations do not receive AR/AP/Freight Audit/payment mutation capability.
- Canonical branch checks in active #126 settlement paths fail closed on malformed branches.
- AP creation validates shipment branch, supplier owner scope and linked customer branch compatibility.
- AR collection rechecks invoice/customer/shipment compatibility in the settlement transaction.
- AP settlement rechecks supplier scope, shipment branch, order branch, Freight Audit and commercial evidence in the same Firestore transaction.
- Concurrent payments against one AP bill cannot both commit from one stale balance. Firestore transaction retry semantics protect the parent balance.
- Concurrent collections against one AR invoice are similarly transaction-protected on the active route.
- Overpayment is rejected from the transaction’s current outstanding amount.
- Stored subtotal + tax + signed adjustments - credits must reconcile with stored total.
- Stored outstanding must reconcile with total payable - amount already paid.
- Settlement currency must exactly match invoice/bill currency. No hidden FX conversion is performed.
- New AP supplier invoice identity uses a deterministic `supplier_invoice_uniques` document keyed by normalized supplier identity + normalized supplier invoice reference in the creation transaction.
- Supplier reconciliation after any financial payment is blocked. Pre-payment reconciliation invalidates AP approval, removes the published job cost and invalidates Freight Audit review state.
- For a genuine versioned TMS shipment, Freight Audit expected procurement comes from the immutable embedded booked commercial snapshot, not from current rate cards, current order quantity or current FX.
- AP payment rereads the persisted `commercial_versions/{id}` and verifies exact booked version/fingerprint/order consistency before settlement.
- Legacy/unversioned booked TMS shipments do not get reconstructed from current commercial configuration for payment. They remain review-blocked.
- Cross-currency commercial profitability does not silently convert using current FX. It becomes uncomparable instead.
- External carrier Delivered does not directly mark AR/AP paid or financially close the job. #130 keeps provider observation/canonical workflow separate and explicitly deferred new accounting/closed shipment lifecycle states.

These defenses materially reduce the risk compared with the pre-#126/#129 system. The findings below are the remaining seams.

---

# Detailed findings

## KCPL-V2-FIN-001 - CRITICAL - Stale TMS quote shipment can bypass booked-lineage Match-Pay as `not_applicable`

**Affected chain:**  
Commercial V1 quote -> repriced V2 -> stale V1 quote marked Won -> generic shipment -> AP -> Freight Audit -> payment

**Primary files / functions:**

- `docs/audits-v2/02-commercial-chain.md`, KCPL-V2-COM-004
- `app/shipment-data.server.ts`
  - generic won-quote shipment creation path
- `app/admin/financial-settlement/payables-settlement.server.ts`
  - `isTmsShipment`
  - `recordPayablePaymentWithSettlementIntegrity`
- `app/admin/freight-audit/freight-audit.server.ts`
  - `recordFromSource`
  - `ensureFreightAuditForPayment`
- `app/admin/freight-audit/freight-audit.ts`
  - `freightAuditPaymentAllowed`

**Failure chain:**

Stage 2 proved that an old versioned TMS quote can be marked `won` through the generic quote workflow after the Transport Order has moved to a newer commercial version. The resulting generic shipment lacks the normal TMS booking fields, including the authoritative tender/transport-order/booked-commercial snapshot graph.

Finance then asks whether the shipment is TMS using the presence of fields such as `transport_order_id`, `tender_id` or `procurement_rate_card_id`. The generic won-quote shipment does not carry those normal booking fields, so it is classified as non-TMS.

`recordFromSource` assigns a no/missing/non-TMS shipment Freight Audit status `not_applicable`. `freightAuditPaymentAllowed` explicitly permits `not_applicable`. The AP payment transaction applies the extra booked-lineage checks only when `shipment?.exists && isTmsShipment(shipmentData)` is true. For this parallel shipment it is false.

Therefore a shipment that economically originated in the TMS commercial chain can reach supplier settlement without #129 booked procurement authority.

**Concrete financial effect:**

Example:

- V2 authoritative booked procurement: NPR 100,000.
- Stale V1 quote creates a parallel generic shipment.
- Accounts enters a supplier bill against that generic shipment for NPR 500,000 under a unique supplier invoice reference.
- Freight Audit is `not_applicable`, not `review_required` for missing TMS lineage.
- The bill can be approved and, assuming its internal settlement totals reconcile, paid for NPR 500,000.
- The real V2 TMS shipment can separately carry its own NPR 100,000 matched supplier bill.

Total potentially financially effective AP: **NPR 600,000 against one underlying commercial movement whose authoritative booked procurement was NPR 100,000**.

The exact overage is unbounded by booked commercial value because the non-TMS path has no booked procurement amount to compare.

**Why #126/#129 do not save this path:**

#126 strongly validates settlement arithmetic but cannot validate a booked commercial version that the shipment does not possess. #129 strongly validates the normal TMS booking lineage but Stage 2 established an alternate shipment-creation door that bypasses that lineage. The integration currently treats absence of TMS markers as legitimate `not_applicable`, not as suspicious provenance for a TMS-origin quote.

**Severity basis:**

Critical because this is a full Match-Pay escape from a TMS-origin economic flow, not merely stale reporting.

---

## KCPL-V2-FIN-002 - CRITICAL - Match-Pay is bill-local, so multiple invoices can each settle the same booked procurement

**Affected chain:**  
One booked shipment procurement -> supplier bill A -> matched -> paid  
Same booked shipment procurement -> supplier bill B -> matched -> paid

**Primary files / functions:**

- `app/admin/freight-audit/freight-audit.server.ts`
  - `recordFromSource`
  - duplicate detection
- `app/admin/financial-settlement/payables-settlement.server.ts`
  - `createPayableWithSettlementIntegrity`
  - `duplicateForFingerprint`
  - `recordPayablePaymentWithSettlementIntegrity`
- `app/admin/financial-settlement/settlement-policy.ts`
  - `supplierInvoiceUniquenessKey`
- `app/admin/commercial-lineage/commercial-profitability.server.ts`
  - actual invoice aggregation by shipment

**Failure scenario:**

The new AP duplicate control is keyed by normalized supplier identity + normalized **supplier invoice reference**. That correctly prevents the same supplier invoice number from being entered twice through the normal creation path.

It does not establish that one booked procurement can only be settled once, nor does Freight Audit maintain cumulative matched/approved/paid value for a shipment/booked commercial version.

For each payable independently, Freight Audit asks whether that bill subtotal matches the full booked procurement amount. It does not subtract other matched/approved/paid bills for the same shipment/version.

**Concrete exploit / accidental duplicate:**

Booked procurement:

- Carrier: `KCPL-P-123`
- Booked cost: NPR 100,000

Create:

- Bill A, supplier invoice `INV-A`, subtotal NPR 100,000
- Bill B, supplier invoice `INV-B`, subtotal NPR 100,000

The invoice references differ, so AP uniqueness correctly considers them distinct documents. Both suppliers match the booked provider. Both currencies match. Both subtotals match the booked 100,000. Each can therefore be `matched`, approved and paid.

**Financial effect:**

- Expected booked procurement: NPR 100,000
- AP cash settlement: NPR 200,000
- Over-settlement: NPR 100,000, or **100% above booked procurement**

The payment transaction prevents either individual bill from being paid above its own total. It does not prevent the economic obligation represented by the shipment from being financially effective twice across two bill documents.

**Profitability effect:**

`customerCommercialProfitabilitySummary` sums all matching validated audit subtotals for the shipment. In the example it produces actual procurement NPR 200,000 against expected procurement NPR 100,000. Reporting exposes the damage after the fact, but Match-Pay does not prevent it.

**Required invariant missing:**

There is no transactionally enforced cumulative obligation such as:

`sum(eligible supplier settlement basis for booked version) <= approved procurement obligation + explicitly approved supplements`

Split invoices are also not modeled safely. A legitimate 60,000 + 40,000 split would make each individual bill look like a large negative variance against the full 100,000 unless separately approved, while two full 100,000 bills can both independently match.

**Severity basis:**

Critical because it permits direct double settlement of one booked procurement despite every individual #126/#129 control passing.

---

## KCPL-V2-FIN-003 - CRITICAL - Consolidation has two independently payable procurement layers and no canonical actual-cost allocation

**Affected chain:**  
Consolidation master procurement -> master shipment -> master AP  
Same procurement -> allocated house shipments -> house AP -> customer profitability

**Primary files / functions:**

- `app/admin/consolidation/tms-consolidation-lineage.server.ts`
  - `confirmConsolidatedLoadBookingWithLineage`
- `app/admin/consolidation/tms-consolidation.ts`
  - `allocateProcurementCost`
- `app/admin/freight-audit/freight-audit.server.ts`
- `app/admin/financial-settlement/payables-settlement.server.ts`
- `app/admin/commercial-lineage/commercial-profitability.server.ts`

**Observed topology:**

Successful consolidation creates:

1. a master shipment with:
   - `customer_id: null`
   - master booked procurement = full carrier cost
   - master booked commercial version
2. one house shipment per customer order with:
   - customer ID
   - allocated procurement cost
   - separate derived booked commercial version

The normal allocation algorithm is intended to conserve the master cost across houses, aside from the JPY defect already identified by Stage 2.

Finance, however, treats each shipment as independently billable and independently Match-Pay eligible.

**Failure mode A: master bill only**

Example master procurement NPR 100,000, allocated as:

- House A expected procurement: NPR 60,000
- House B expected procurement: NPR 40,000

A carrier issues one natural consolidated invoice for NPR 100,000. Accounts links it to the master shipment. It matches the master booked procurement and can be paid.

But the master shipment has no customer ID, so its payable does not enter either house customer’s `actualByShipment`. Customer commercial actual profitability therefore has no actual supplier cost for House A/B even though KCPL has a real paid/approved master supplier obligation.

**Failure mode B: master plus house bills**

If Accounts also creates house bills to make customer actual profitability reflect allocation:

- Master bill NPR 100,000 matches master and pays.
- House A bill NPR 60,000 matches House A and pays.
- House B bill NPR 40,000 matches House B and pays.

Each bill sees a valid booked commercial version for its own shipment. There is no consolidation-load settlement exclusivity check.

**Financial effect:**

- One external carrier procurement: NPR 100,000
- Total AP capable of independently matching and settling: NPR 200,000
- Over-settlement: NPR 100,000

Customer profitability can still show only NPR 100,000 of house actual procurement because the master bill is customerless, masking the extra master-layer cash in customer profitability.

**Interaction with Stage 2 JPY finding:**

Stage 2 KCPL-V2-COM-008 separately showed that JPY house commercial totals can fail allocation conservation because the allocator uses cents while JPY lineage uses zero decimals. Finance accepts each house’s booked snapshot as its authority. That means the master/house dual-settlement risk can be amplified by a house allocation whose authoritative totals already exceed the master.

**Severity basis:**

Critical because the data model exposes two valid settlement bases for one physical procurement with no load-level obligation authority, while the profitability model cannot faithfully allocate a normal master-only supplier invoice.

---

## KCPL-V2-FIN-004 - HIGH - Tax is settlement-effective but not commercially validated by Match-Pay

**Affected chain:**  
Booked procurement -> supplier invoice subtotal/tax -> Freight Audit -> AP settlement

**Primary files / functions:**

- `app/admin/freight-audit/freight-audit.server.ts`
  - `recordFromSource`
- `app/admin/financial-settlement/settlement-policy.ts`
  - `resolveSettlementBasis`
- `app/admin/financial-settlement/payables-settlement.server.ts`
  - AP creation and payment

**What #126 fixed:**

The old system could compare subtotal and then settle a mutable/different total without proving that the tax-inclusive payable being paid was the one audited. #126 now fingerprints invoice subtotal, tax and total, and the payment transaction verifies the current audit’s invoice subtotal/tax/total against the current settlement basis. This closes the stale-total TOCTOU problem.

**What remains:**

Freight Audit’s commercial match status is still determined by **booked procurement versus invoice subtotal**. Tax is copied into the audit but there is no tax policy issue, no expected-tax authority, no statutory tax validation and no requirement for Management approval when tax materially increases payable.

AP creation allows a tax rate from 0 through 100 percent.

**Concrete financial effect:**

- Booked procurement: NPR 100,000
- Supplier invoice subtotal: NPR 100,000
- Tax entered: 100%
- Tax: NPR 100,000
- Payable total: NPR 200,000

Freight variance is zero because subtotal exactly matches booked procurement. Audit status can be `matched`. Ordinary Accounts approval can follow. Settlement then correctly and safely pays the internally reconciled payable total of NPR 200,000.

The transaction is mechanically correct while the business economic result is double the booked procurement.

**Signed adjustments / credits:**

`resolveSettlementBasis` correctly supports:

`subtotal + taxes + signed adjustments - credits = total payable`

and rejects internally inconsistent totals. Current normal AP creation initializes adjustments/credits to zero and this audit found no ordinary API edit route for post-creation adjustment/credit mutation. Therefore the immediately reachable exploit is tax, not an adjustment edit. Historical/migrated records with adjustments/credits still need business-policy review because Match-Pay status is based on freight subtotal, not the whole economic settlement basis.

**Severity basis:**

High because an Accounts-entered field can materially increase cash settlement while the audit still says `matched`. It is lower than the Critical findings because tax can be a legitimate obligation and the missing control is tax authority/policy rather than duplicate cash by construction.

---

## KCPL-V2-FIN-005 - HIGH - AR invoice business-event idempotency remains unresolved

**Affected chain:**  
Booked/customer shipment -> AR invoice create -> issue -> customer balance/revenue

**Primary files / functions:**

- `app/api/admin/finance/invoices/route.ts`
- `app/admin/finance/finance.server.ts`
  - `createFinanceInvoice`
  - `issueFinanceInvoice`

**Remediation status:**

PR #126 explicitly deferred “Customer AR invoice business-event idempotency” from the earlier finance audit. The current code confirms it remains deferred.

Every invoice create request generates a fresh random `KCPL-I-*` reference. There is no:

- `Idempotency-Key` handling on invoice creation,
- deterministic customer/shipment/commercial event invoice identity,
- uniqueness record equivalent to AP `supplier_invoice_uniques`,
- one-invoice-per-shipment/version guard,
- duplicate semantic payload check.

**Concrete failure:**

Shipment S should be invoiced NPR 150,000 once.

A double-click, browser retry after an ambiguous response, or two Accounts operators submit the same create request. Two distinct draft invoices are created. Both can be issued.

**Financial effect:**

- Intended customer receivable: NPR 150,000
- Issued AR: NPR 300,000
- Overstated receivable/revenue: NPR 150,000

`recomputeCustomerFinance` sums both non-draft/non-void invoice totals when they match the customer preferred currency, so the duplicate propagates into customer revenue and outstanding balance.

**Severity basis:**

High because ordinary retry/concurrency can duplicate customer obligations. It is the specifically requested unresolved AR idempotency issue from the earlier audit.

---

## KCPL-V2-FIN-006 - HIGH - AR invoice economics are not bound to #129 booked sell lineage

**Affected chain:**  
Booked expected revenue -> AR invoice -> issued revenue -> collections

**Primary files / functions:**

- `app/admin/finance/finance.server.ts`
  - `createFinanceInvoice`
  - `recomputeCustomerFinance`
- `app/api/admin/finance/invoices/route.ts`
- `app/admin/commercial-lineage/commercial-profitability.server.ts`

**Observed authority split:**

#129 stores booked expected customer sell economics in the immutable commercial snapshot and uses those fields for `commercial_expected_revenue_total`.

AR creation does not consume or attest that booked sell authority. It resolves customer/shipment/quote relationships, then accepts from the finance request:

- any supported `currency`,
- any positive `amount`,
- tax rate 0 to 100,
- free-form description.

The created invoice stores shipment/quote/customer links but no booked commercial version ID/fingerprint and no expected sell attestation.

**Concrete failure:**

Booked commercial version says:

- expected sell: NPR 150,000

Accounts can create and issue:

- NPR 250,000, or
- USD 2,000,

against the same TMS shipment without a commercial-lineage mismatch.

There is no server-side check that AR amount/currency is equal to or explicitly derived from the booked sell decision.

**Financial effect:**

KCPL can simultaneously report:

- immutable expected revenue: NPR 150,000
- issued AR revenue: NPR 250,000

with no control-state explaining the NPR 100,000 difference.

A duplicate invoice from KCPL-V2-FIN-005 compounds the divergence.

**Customer reassignment behavior:**

Collection is safer than creation. The #126 AR settlement transaction rereads shipment/customer linkage and blocks collection when the invoice customer no longer matches the shipment. That prevents cash posting into a stale cross-customer relationship. It does not stop a stale/incorrect invoice from being created or issued before the mismatch is detected, and no current invoice relinking/correction workflow was found.

**Severity basis:**

High because #129’s expected revenue authority and AR’s actual customer charge are separate economic systems.

---

## KCPL-V2-FIN-007 - HIGH - Payment idempotency fallback can lose legitimate payments and retries are not always recognized idempotently

**Affected chain:**  
AR collection and AP payment retry / partial settlement

**Primary files / functions:**

- `app/admin/financial-settlement/settlement-policy.ts`
  - `settlementRequestFingerprint`
  - `paymentDocumentId`
- `app/admin/financial-settlement/receivables-settlement.server.ts`
- `app/admin/financial-settlement/payables-settlement.server.ts`

### Part A: two legitimate equal payments collapse without an explicit idempotency key

When the caller does not send an idempotency key, `paymentDocumentId` uses the request fingerprint itself as the identity key.

The request fingerprint includes:

- account reference,
- amount,
- currency,
- payment date,
- method,
- external reference.

It does not include a unique real-world payment event ID. Notes are intentionally irrelevant to identity.

Therefore two **different real payments** that happen to have the same account, amount, day, method and blank/same external reference produce the same payment document ID.

Example AR:

- Invoice outstanding: NPR 200,000
- First cash collection: NPR 100,000 today, method cash, no external reference
- Second independent cash collection: NPR 100,000 later the same day, method cash, no external reference

The first records normally. The second resolves to the same payment document and returns `idempotent` instead of recording the second real collection.

**Financial effect:**

- Real cash received: NPR 200,000
- KCPL recorded received: NPR 100,000
- KCPL outstanding remains: NPR 100,000

The same collision exists for AP if two legitimate same-day equal payments have identical request identity fields.

### Part B: an actual retry can fail before the existing idempotent payment is checked

Both AR and AP settlement functions evaluate current status/balance and call `applySettlementPayment` **before** reading the deterministic existing payment document.

Examples:

- Full payment retry: first request pays the invoice fully. Exact retry now encounters `status === paid` / `balance_due <= 0` and returns `already_paid`, not `idempotent`.
- Partial payment retry: bill total 150, first request pays 100. Exact retry of 100 sees only 50 outstanding and returns `overpayment` before the existing payment ID is checked.

No duplicate financial effect occurs in those cases, but the API violates the operational promise of safe retry and can encourage an operator/client to alter the key/request and try again.

**Severity basis:**

High because the same design both suppresses legitimate cash events and makes ambiguous successful retries appear unsuccessful. The old double-write race is fixed, but business-event identity is not yet robust.

---

## KCPL-V2-FIN-008 - HIGH - Freight Audit variance approval is not bound atomically to the exact fingerprint it approved

**Affected chain:**  
Freight Audit V1 -> Management variance approval -> concurrent supplier/economic refresh V2 -> payment

**Primary files / functions:**

- `app/admin/freight-audit/freight-audit.server.ts`
  - `getFreightAudit`
  - `persistAudit`
  - `reviewFreightAudit`
- `app/admin/financial-settlement/supplier-reconciliation-settlement.server.ts`
- `app/admin/financial-settlement/payables-settlement.server.ts`

**What normally protects stale approval:**

`recordFromSource` preserves `approved_variance` only when the stored audit fingerprint equals the freshly calculated fingerprint. If bill/supplier/commercial evidence changes and the audit is refreshed normally, approval drops back to a review state. AP payment also recalculates the economic fingerprint transactionally.

**Race:**

`reviewFreightAudit` is not one transaction from “read reviewed fingerprint” to “write approval bound to fingerprint.” It:

1. calls `getFreightAudit(..., true)` and receives audit V1;
2. performs role/note/status checks in application memory;
3. later performs a separate merge write containing `status: approved_variance` and approval provenance, but no `approved_fingerprint` precondition.

A concurrent sequence can be:

1. Management begins approving review-required V1.
2. Supplier reconciliation or another economic mutation invalidates V1.
3. Another audit refresh computes and persists V2 fingerprint/status.
4. The original Management request completes its status-only merge, writing `approved_variance` onto the now-current V2 audit document.

Because the stored fingerprint is now V2 and the status is now `approved_variance`, a subsequent refresh sees an unchanged V2 fingerprint and preserves the approved status. The payment transaction validates V2 fingerprint correctly but has no evidence that Management actually approved V2.

**Financial effect:**

The exact amount depends on the state changed between V1 and V2. The important invariant failure is that a Management exception intended for one supplier/economic state can authorize another. A large variance or supplier mismatch can therefore inherit approval without a second Management decision.

**Why this survives the strong payment transaction:**

Payment proves “the bill I am paying equals the current audit fingerprint.” It does not prove “the Management approval on this audit was issued for this fingerprint,” because approval provenance does not include/lock an approved fingerprint/version in a transaction.

**Severity basis:**

High due to direct exception-approval authority transfer, although exploitation requires a concurrency window and an economic-state mutation/refresh sequence.

---

## KCPL-V2-FIN-009 - MEDIUM - Commercial “actual profitability” is not an approved/settled/final cost basis

**Affected chain:**  
Supplier bill -> Freight Audit -> profitability

**Primary files / functions:**

- `app/admin/commercial-lineage/commercial-profitability.server.ts`
- `app/admin/commercial-lineage/commercial-profitability.ts`
- `app/admin/freight-audit/freight-audit.server.ts`

**Observed basis:**

`customerCommercialProfitabilitySummary` collects payables when:

- payable status is anything except `void`,
- payable has a shipment reference,
- corresponding Freight Audit status is `matched` or `approved_variance`,
- audit lineage status is `versioned`.

It does **not** require the payable itself to be approved, partially paid or paid.

Freight Audit can be refreshed while the payable is still draft. A draft bill whose supplier/subtotal/currency matches booked procurement can therefore become an “actual procurement” fact before AP approval.

The actual amount used is `audit.invoice_subtotal`. It does not use the #126 settlement basis:

- taxes are excluded,
- signed adjustments are excluded,
- credits are excluded,
- amount paid is irrelevant.

It also does not require delivered/POD/canonical completion.

**Concrete reporting effect:**

Booked sell NPR 150,000, expected procurement NPR 100,000.

A draft supplier bill arrives:

- subtotal 100,000
- credit 20,000 in historical/imported settlement fields
- payable settlement basis 80,000 before any tax/other adjustment

If the audit remains matched on the 100,000 freight subtotal, commercial actual profitability can treat actual procurement as 100,000, not 80,000. If the bill is still draft, the customer “actual” figure has also moved before AP approval.

**Interpretation risk:**

This may be intended as “supplier invoice freight subtotal observed” rather than GAAP/accounting profit or cash profit. The problem is that the stored field names are `commercial_actual_procurement_total` and `commercial_actual_profit_total` without an approval/finality state. They can be mistaken for settled actual cost.

**External Delivered attack result:**

No external Delivered observation directly financially completes these values. The opposite issue exists: “actual” commercial profitability can appear before delivery/completion because it is audit-evidence based, not canonical-completion based.

**Severity basis:**

Medium because this is primarily reporting/basis integrity, not a path to send extra cash by itself.

---

## KCPL-V2-FIN-010 - HIGH - Legacy customer finance totals silently omit other currencies and can coerce malformed currency to NPR

**Affected chain:**  
AR/AP -> customer revenue/cost/profit/outstanding summary

**Primary file / function:**

- `app/admin/finance/finance.server.ts`
  - `currencyValue`
  - `recomputeCustomerFinance`

**Observed legacy summary behavior:**

Customer finance chooses the customer’s preferred currency and then:

- includes invoice revenue only when invoice currency equals that currency,
- includes job costs only when job cost currency equals that currency,
- does not convert other currencies,
- does not expose an omitted-currency count/amount in the legacy `revenue_total`, `cost_total`, `profit_total` fields.

Avoiding hidden FX is correct. Silently dropping other-currency economics while still publishing one `profit_total` is not.

Example:

Customer preferred currency NPR:

- issued NPR invoice: 100,000
- issued USD invoice: 2,000
- approved NPR job cost: 60,000
- approved USD job cost: 1,500

Legacy customer fields report only NPR 100,000 revenue, NPR 60,000 cost, NPR 40,000 profit. The USD activity disappears from those totals without a “not comparable” signal.

**Malformed legacy currency issue:**

`currencyValue` returns NPR when a stored currency is not one of the supported values. Settlement code correctly fails invalid currency, but dashboard/recompute readers can treat malformed legacy data as NPR.

A historical invoice with currency `US D` can therefore be read into some customer/dashboard calculations as NPR rather than quarantined as invalid data.

**Interaction with #129:**

The new `commercial_*` profitability fields are safer for cross-currency economics because they only aggregate same-currency comparable facts and track uncomparable counts. The customer document now contains both the legacy finance summary and the #129 commercial summary with different economic definitions. There is no single canonical `profit` field spanning both.

**Severity basis:**

High because business reporting can materially understate/misclassify revenue/cost without a visible error, even though payment mutation itself fails closed on invalid currency.

---

## KCPL-V2-FIN-011 - MEDIUM - AR issue/void and AP approve/void transitions can race into contradictory financial state

**Affected chain:**  
Draft invoice/bill -> issue/approve versus void

**Primary file / functions:**

- `app/admin/finance/finance.server.ts`
  - `issueFinanceInvoice`
  - `voidFinanceInvoice`
- `app/admin/payables/payables.server.ts`
  - `approvePayable`
  - `voidPayable`

**Pattern:**

These workflow actions use a read-then-write sequence rather than a Firestore transaction/precondition on the current document version.

### AR example

Invoice draft:

- total 100
- balance_due 100

Request A loads draft to issue. Request B loads draft to void.

If B writes first, it sets:

- status void
- balance_due 0

A can then perform its stale update setting only:

- status issued/overdue
- issued metadata

Final state can be:

- status issued
- total 100
- amount_paid 0
- balance_due 0

`recomputeCustomerFinance` can count the 100 as revenue but zero outstanding. Collection sees non-positive balance and treats it as already paid/uncollectable despite no payment.

### AP example

Draft bill total 100. Void can set balance 0 and delete its job cost. A stale approve can then set status approved and republish the full 100 job cost without restoring outstanding.

Final state can show an approved supplier cost in profitability/job costs with zero payable balance and no payment.

**Severity basis:**

Medium because this needs concurrent conflicting operator actions and does not directly create duplicate cash, but it can corrupt authoritative status/balance and customer cost/revenue projections.

---

## KCPL-V2-FIN-012 - MEDIUM - JPY settlement precision disagrees with commercial lineage precision

**Affected chain:**  
Booked JPY commercial -> supplier bill/AR -> settlement -> Freight Audit/consolidation

**Primary files / functions:**

- `app/admin/commercial-lineage/commercial-lineage.ts`
  - commercial currency decimal policy
- `app/admin/financial-settlement/settlement-policy.ts`
  - `money`
  - `applySettlementPayment`
- AP/AR creation functions using `Math.round(value * 100) / 100`

**Observed mismatch:**

#129 commercial lineage treats JPY as zero-decimal money.

#126 settlement `money()` always rounds to two decimals regardless of currency. AP/AR creation similarly use two-decimal rounding for all configured currencies.

Therefore KCPL can create and settle fractional JPY values even though the booked commercial authority normalizes JPY to whole yen.

Example:

- Booked JPY procurement: 100
- Supplier invoice subtotal: JPY 100.50

AP can store the 100.50 subtotal. Freight tolerance has an absolute floor of 1, so the 0.50 variance can still be within tolerance and become `matched`. Settlement can pay JPY 100.50.

A payment of JPY 0.01 is also mechanically representable by the settlement policy if outstanding permits it.

**Interaction with consolidation:**

Stage 2 KCPL-V2-COM-008 already found that consolidation allocates in cents before JPY commercial rounding. The two-decimal settlement model creates another currency precision regime around the same flow.

**Severity basis:**

Medium because normal JPY amounts make the absolute error small, but it violates currency-unit integrity and compounds the consolidation allocation defect.

---

## KCPL-V2-FIN-013 - HIGH - Same principal can create, approve and settle ordinary AP

**Class:** control-design finding, not a code execution vulnerability

**Affected roles / functions:**

- `app/admin/staff-permissions.ts`
- AP create / approve / payment routes
- Freight Audit review routes

**Observed RBAC:**

- Management: `canManageFinance = true`
- Accounts: `canManageFinance = true`
- Commercial: `canManageFinance = false`
- Operations: `canManageFinance = false`

Both Management and Accounts can create supplier bills, approve ordinary payable bills and record payments. Management is required for `approve_variance` / reject, but a `matched` or `not_applicable` bill does not require a second principal.

A particularly important legitimate-but-high-risk path is a general no-shipment payable:

1. Accounts creates a supplier bill with a unique supplier invoice reference.
2. It has no shipment/booked procurement, so Freight Audit is `not_applicable`.
3. `not_applicable` is payment-allowed.
4. The same Accounts user approves the bill.
5. The same Accounts user records payment.

There is no independent maker/checker boundary in that chain.

Accounts also has `canEditCommercial = true`, so the role spans commercial editing and finance settlement, although Management-only commercial approval still applies when the commercial version itself says approval is required.

**Business risk:**

A compromised or malicious Accounts credential can create a plausible external obligation and take it through approval/settlement without an independent person when the bill is matched or outside Match-Pay scope.

**Severity rationale:**

High as a control-design risk because AP payment is a real cash-control function and KCPL is moving from paper to system-enforced workflows. It is **not** classified Critical/P1 merely because maker-checker is absent. The concrete Critical findings in this report are system invariants that allow duplicate or unbounded economic effect even when users follow ordinary authorized paths.

---

# AR audit conclusion

## Invoice creation

**Customer identity:** generally strong relation checks. Shipment customer is preferred over a caller-supplied customer, customer existence is verified, and quote/shipment/customer relationships are checked.

**Branch compatibility:** current create/get/collection paths use canonical branch compatibility and fail closed. No cross-branch AR mutation bypass was found.

**Shipment/order linkage:** shipment linkage is optional, and AR stores shipment/quote references when present. It does not store/order-bind the booked commercial version.

**Duplicate invoice:** unsafe. KCPL-V2-FIN-005.

**Commercial amount/currency:** unsafe relative to #129. KCPL-V2-FIN-006.

**Subtotal/tax/total:** creation calculates one line item and rounds to two decimals. Settlement later re-derives the basis. Internal arithmetic is protected, subject to JPY precision and large-number concerns below.

**Issue date / due date:** AR `safeDate` checks only `YYYY-MM-DD` shape, not full calendar validity, and does not require due date >= issue date. The older AR chronology weakness therefore remains. It was not promoted to a separate Stage 4 finding because its primary effect is aging/operational correctness rather than duplicate cash, but it remains a cleanup target.

## Collections

**Partial collection:** transaction-safe. Current balance is reread.

**Overcollection:** blocked.

**Concurrent collection:** old stale-balance race is fixed on the active route.

**Duplicate retry:** partially fixed, but idempotency semantics have the defect in KCPL-V2-FIN-007.

**Credit handling:** settlement can consume `credit_total` if present and internally consistent, but normal AR creation does not currently establish a credit/reversal workflow. No supported post-payment credit-note accounting workflow was found.

**Stale invoice/customer state:** collection rereads current customer/shipment relationship and blocks mismatches. This is fail-closed, but stale issued invoices can become stranded rather than being automatically corrected/reissued.

---

# AP audit conclusion

## Supplier invoice creation

**Normalized supplier + invoice identity:** materially improved. A transaction-backed uniqueness document now protects the normal create path.

**Supplier reference:** required on the active create route, including general payables.

**Concurrent duplicate create:** protected for the new unique-key path. Legacy duplicate scans remain bounded and are not equivalent to a full historical migration, discussed below.

**Supplier relinking:** financially safe after settlement. Any payment locks reconciliation. Pre-payment relinking resets bill to draft, invalidates approval, removes job cost and invalidates Freight Audit.

**Shipment/customer/branch linkage:** active create/payment paths are strict. No malformed-branch authorization fallback was found.

**Currency:** supported currency required; payment currency must exactly match. No hidden FX.

**Subtotal/tax/total:** internal math is revalidated at settlement. Business validation of tax remains weak, KCPL-V2-FIN-004.

## Payment

**Partial payment:** transaction-safe.

**Overpayment:** blocked from current balance.

**Concurrent payment:** the old single-bill double-write race is fixed.

**Idempotency:** structurally improved but semantically flawed, KCPL-V2-FIN-007.

**Supplier changes during payment:** payment and supplier reconciliation contend transactionally on the bill; financially settled bills are locked from reconciliation. This attack held.

**Bill amount changes during payment:** no normal AP amount-edit route was found. If a server/migration changes settlement economics, the payment transaction requires the current basis to reconcile and the Freight Audit fingerprint/total to match. The transaction therefore fails stale/inconsistent rather than paying a stale version.

---

# Freight Audit conclusion

## Expected procurement source

For a genuine versioned TMS shipment, Freight Audit correctly resolves expected procurement from the immutable booked commercial snapshot.

The following attacks held:

- current rate card changed: no effect on booked expected cost;
- current FX changed: no effect on booked expected cost;
- current order quantity edited: Freight Audit does not reconstruct from live quantity;
- commercial version mismatch: blocking/review required;
- shipment/order branch mismatch: blocked;
- missing persisted commercial version at payment: blocked;
- legacy unversioned booked shipment: automated payment blocked;
- payment-time stale fingerprint: blocked in transaction.

## Remaining defects

- TMS provenance can disappear through the Stage 2 generic quote-won shipment path, KCPL-V2-FIN-001.
- Audit is bill-local rather than cumulative economic-obligation-local, KCPL-V2-FIN-002.
- Tax is not a commercial match criterion, KCPL-V2-FIN-004.
- Management variance approval does not carry an atomic exact approved fingerprint, KCPL-V2-FIN-008.
- `not_applicable` remains intentionally payment-allowed for non-TMS/general/ancillary cases. That is not automatically wrong, but it must not become the accidental classification for a TMS-origin shipment.
- Freight Audit queue presentation still reads only the latest 250 payables. Older items can remain outside normal review visibility. Payment itself does not trust the queue and still rechecks the targeted bill, so this is a monitoring/control weakness rather than a direct settlement bypass.

---

# Match-Pay transactional attack table

| Attack | Result |
|---|---|
| Audit V1, shipment changes to V2 before payment | **Blocked** for a normal TMS shipment because payment recalculates current fingerprint/version inside the transaction |
| Current rate card changes after booking | **No effect** on versioned Match-Pay expected procurement |
| Current FX changes after booking | **No effect** on versioned Match-Pay expected procurement |
| Supplier changes before payment | Reconciliation invalidates approval/audit and payment rereads supplier scope; normal race is transaction-protected |
| Supplier changes after payment | **Blocked** by financial lock |
| Invoice amount/tax stale audit | Payment compares current audit subtotal/tax/total to current settlement basis; stale state blocks |
| Duplicate request, same key, before balance makes request invalid | Deterministic payment ID protects duplicate write |
| Exact retry after full payment | Returns `already_paid`, not idempotent - KCPL-V2-FIN-007 |
| Exact retry of partial payment now larger than remaining balance | Returns `overpayment` before existing-payment lookup - KCPL-V2-FIN-007 |
| Two concurrent payments against one bill | Firestore transaction prevents stale double-settlement |
| Payment currency differs from bill | **Blocked**, no hidden FX |
| Approved variance then economic fingerprint changes normally | Refresh resets to review-required unless the approval race in KCPL-V2-FIN-008 occurs |
| Two separate full-value supplier bills for same booked shipment | **Both can match and pay** - KCPL-V2-FIN-002 |
| Master and house consolidation bills | **Both layers can match and pay** - KCPL-V2-FIN-003 |
| Stale TMS quote generic shipment | Can become non-TMS `not_applicable` and bypass booked Match-Pay - KCPL-V2-FIN-001 |

## Can one invoice be financially effective twice?

### One AP document

The old “two concurrent child payments against one stale parent balance” vulnerability is fixed on the active #126 path. A single bill cannot exceed its current reconciled outstanding through ordinary concurrent payment calls.

A single real-world payment can still be recorded twice if callers deliberately use different idempotency keys and the remaining balance permits it, because external payment references are not globally unique business-event locks. That is a general idempotency-contract limitation. The stronger proven defect is the reverse collision in KCPL-V2-FIN-007, where two real equal payments can collapse into one when no explicit unique idempotency key exists.

### One booked procurement obligation

**Yes.** It can be financially effective multiple times through distinct AP invoice documents, KCPL-V2-FIN-002, and through consolidation master/house layers, KCPL-V2-FIN-003.

---

# Settlement-basis audit

Authoritative #126 settlement basis:

`subtotal + taxes + signed adjustments - credits = total payable`

then:

`total payable - amount paid = outstanding`

## Defenses

- subtotal must be positive;
- tax cannot be negative;
- credits cannot be negative;
- paid/outstanding cannot be negative;
- signed adjustment can be positive or negative;
- total payable must remain positive;
- stored total must reconcile to re-derived total;
- amount paid cannot exceed total;
- stored outstanding must reconcile;
- payment amount must be positive and cannot exceed outstanding.

## Rounding

Two-decimal settlement arithmetic is internally consistent for current two-decimal currencies. JPY is inconsistent with commercial currency precision, KCPL-V2-FIN-012.

## Large values

The functions use JavaScript `number` and check finiteness, not safe-integer cent range. Extremely large finite values beyond exact IEEE-754 cent precision can lose minor units while still passing `Number.isFinite`. Freight transactions in ordinary KCPL operating ranges are unlikely to approach this boundary, so this was not promoted to a separate finding. A future accounting hardening pass should define maximum monetary magnitude and currency-specific minor-unit integer representation.

## Zero / negative

Zero subtotal/total/payment is blocked. Signed adjustments are intentionally permitted but total must remain positive.

## Tax changes / credits after partial payment

No ordinary server API for editing tax/adjustments/credits after partial payment was found. Direct Firestore client mutation is denied. If historical/migration/admin repair changes these fields inconsistently, settlement fails reconciliation. KCPL still lacks a first-class credit-note/reversal workflow, so historical corrections are a control/data-design need rather than a demonstrated ordinary-route overpayment exploit.

## Supplier edits after payment

Financially locked by the #126 reconciliation path. This attack held.

---

# Commercial-lineage integration

## Booked procurement -> Freight Audit expected -> supplier actual -> payment

Normal versioned TMS path is strong:

1. shipment embeds exact booked commercial snapshot/version/fingerprint;
2. Freight Audit uses booked snapshot procurement, not current rate/FX;
3. supplier bill is compared in same currency;
4. payment transaction rereads bill, audit, shipment, order and persisted commercial version;
5. current audit fingerprint/amount/tax/total must still match;
6. payment records booked commercial version/fingerprint on the payment.

Breaks remain at obligation aggregation and alternate shipment provenance, KCPL-V2-FIN-001/002/003.

## Booked expected revenue -> AR/customer revenue

This side is not equivalent. Expected revenue is immutable #129 commercial lineage, but AR is manually finance-entered and has no exact booked-sell binding. KCPL-V2-FIN-005/006 are the primary gaps.

## Mutable current commercial configuration

No remaining versioned TMS AP Match-Pay path was found that uses current rate card or current FX as expected historical cost. Stage 2 separately identified unsafe legacy **unbooked** reconstruction using current rate-card state before booking. Once such a reconstructed version is booked, finance trusts that version as immutable history. Therefore Stage 2 KCPL-V2-COM-006 remains an upstream provenance risk to finance even though finance itself does not call the current rate card.

---

# Profitability audit

KCPL now has two materially different profit concepts on the customer record.

## Legacy finance totals

`recomputeCustomerFinance` writes:

- `revenue_total`: issued/non-void AR invoice totals in preferred currency;
- `cost_total`: job-cost amounts in preferred currency;
- `profit_total = revenue_total - cost_total`;
- `outstanding_balance`.

These are operational accounting projections and can silently omit other currencies, KCPL-V2-FIN-010.

Approved AP job costs are tax-inclusive `bill.total`, so this legacy profit basis includes supplier tax and customer invoice tax in its totals.

## #129 commercial profitability totals

`customerCommercialProfitabilitySummary` writes:

- expected revenue from booked sell amount;
- expected procurement from booked procurement;
- expected profit/margin only when same currency;
- actual procurement from validated Freight Audit `invoice_subtotal` values bound to booked lineage;
- actual profit only when expected sell and actual supplier subtotal are same currency;
- uncomparable counts rather than hidden FX.

This is substantially better for commercial margin integrity, but it is not settlement/accounting profit because of KCPL-V2-FIN-009.

## Attack results

**Same currency:** calculation is straightforward when the facts are present.

**Cross currency:** no current FX aggregation; facts are uncomparable. Good.

**Current FX:** not used to rewrite booked or actual commercial profit. Good.

**Partial supplier payment:** commercial actual cost uses invoice evidence, not cash paid. Partial payment does not proportionally change commercial actual procurement. This is an accrual/evidence basis, not cash-profit basis.

**Multiple AP bills:** all validated invoice subtotals sum. This exposes, but does not prevent, KCPL-V2-FIN-002.

**Credits:** ignored by commercial actual procurement because audit subtotal is used, KCPL-V2-FIN-009.

**Unresolved audit:** excluded from actual cost. Good fail-closed behavior for commercial actuals.

**Shipment not delivered:** expected and actual commercial profitability are not delivery-gated. They can represent booked/invoice economics on in-progress shipments. This must not be presented as final closed-job profit.

**Missing lineage:** shipment is skipped rather than reconstructed. Safer than current-state reconstruction, but historical totals can be incomplete unless data-quality counts make omissions obvious.

---

# Consolidation finance audit

## House expected cost

Derived house booked versions carry allocated procurement. Successful normal non-JPY allocation is designed to sum to the master procurement.

## Master procurement

Master shipment separately carries the full booked procurement and its own booked commercial lineage.

## Supplier bill / Freight Audit / payment

Both master and houses are valid TMS shipment records. There is no field indicating which layer owns the external supplier obligation or whether the other layer is allocation-only for profitability.

Result: KCPL-V2-FIN-003.

## Profitability

Master shipment has `customer_id: null`, so master supplier invoice actual cost is not allocated into customer commercial actual profitability. Houses have customer IDs and expected allocated costs, but there is no mechanism to distribute an actual master supplier bill across houses.

## Can master cost be double-counted?

**Yes at AP/settlement level.** Master + house bills can independently match and settle.

## Can house costs sum incorrectly?

**Yes for JPY**, inherited from Stage 2 KCPL-V2-COM-008. Normal two-decimal currency allocation intentionally assigns rounding remainder to the final house and conserves cents.

## Can master and house both hit profitability as independent cost?

Not in the same customer commercial summary under the current code because the master is customerless. That prevents one kind of customer double-counting, but creates a different defect: master-only actual supplier cost disappears from house/customer actual profitability while remaining a real AP/cash obligation. House bills then restore customer actual cost but can coexist with the master bill and double-settle AP.

---

# RBAC and branch re-check

## Roles

| Role | Finance mutate | Commercial edit | Relevant Stage 4 result |
|---|---:|---:|---|
| Management | Yes | Yes | Organization-wide valid-branch finance, variance approval/reject, create/approve/pay |
| Accounts | Yes | Yes | Branch-scoped finance, can create/approve/pay ordinary bills and AR |
| Commercial | No | Yes | Cannot directly mutate AR/AP/settlement |
| Operations | No | No commercial edit | Cannot directly mutate finance |

## Branch isolation

Current #128 branch helpers parse only canonical KCPL branches and fail closed when branch is missing/malformed. Active finance settlement code uses raw strict branch checks before mutation.

No supported cross-branch mutation was found for:

- AR collection,
- AP create/payment,
- supplier reconciliation,
- Freight Audit/payment,
- linked shipment/order relationship validation.

Some legacy read-model functions still have presentation fallbacks such as invalid payable currency -> NPR and older payable branch parser -> Kathmandu. In the active payables dashboard/get path, branch access is checked against the raw stored branch before the rendered fallback is used, so malformed branch did not become an authorization bypass in this audit. Currency fallback remains a reporting/data-quality risk under KCPL-V2-FIN-010.

---

# Maker-checker / control gaps

KCPL-V2-FIN-013 is the primary finding.

The most financially sensitive current combination is not “Accounts can approve a matched carrier bill” by itself. It is the combination of:

- Accounts can create AP;
- `not_applicable` is payment-allowed for general/non-TMS obligations;
- the same Accounts user can approve;
- the same Accounts user can record payment;
- Accounts also has commercial edit capability.

Management-only variance approval provides a second-person boundary only when the audit enters a variance/review state and the approving actor is a different person in practice. The code does not prevent the same Management principal from creating, variance-approving and paying.

This is a meaningful internal-control design weakness but was not elevated to Critical merely because segregation of duties is absent.

---

# Legacy and data-quality risks

This section separates migration/cleanup needs from reachable code vulnerabilities.

## Migration / cleanup need: malformed or unsupported stored currencies

Settlement correctly blocks invalid current currency. Some readers still coerce unsupported currency to NPR. Historical finance data should be inventoried and normalized/quarantined rather than relying on reader fallbacks.

## Migration / cleanup need: old totals without #126 basis fields

Historical documents can lack `adjustment_total`, `credit_total`, settlement basis metadata or exact paid/outstanding consistency. #126 payment fails closed when totals do not reconcile. These records need explicit migration/review, not code fallback.

## Migration / cleanup need: unversioned booked shipments

Versioned TMS Match-Pay intentionally blocks legacy unversioned commercial history instead of reconstructing with current rate/FX. Those shipments need an explicit review/migration strategy. Profitability will otherwise omit them from versioned commercial totals.

## Migration / cleanup need: legacy duplicate supplier invoices

New AP creation has a strong unique-key path. Legacy duplicate detection still relies on bounded queries while historical records may predate normalized keys. A one-time migration/index of all historical supplier identity + normalized invoice references is still needed to prove the historical ledger contains no duplicates.

## Migration / cleanup need: partially historical payment subcollections

Older pre-#126 random payment documents do not necessarily carry request fingerprints, settlement basis/version, balance-before/after or booked commercial evidence. They remain historical records, but they do not provide the same attestation guarantees as new payments.

## Code vulnerability versus data cleanup

- KCPL-V2-FIN-001 through FIN-013 are current-code/control findings.
- The legacy items above are data/migration assurance needs unless a current route is shown to create the same malformed state.

---

# Cross-module hostile chains

## Wrong commercial version -> audit -> payment

For a normal TMS shipment, current payment blocks this. Shipment/order/audit/persisted commercial version must agree.

The alternate stale quote generic-shipment chain bypasses the classification entirely, KCPL-V2-FIN-001.

## Wrong shipment -> supplier invoice -> payment

AP creation verifies the referenced shipment exists and branch/customer relationships are compatible. It does not prove the shipment is the unique economic shipment for the supplier obligation. A duplicate/parallel shipment can therefore host a separate payable. Stage 2’s parallel shipment makes this concrete.

## External Delivered -> financial completion

#130 external Delivered is gated canonical workflow authority and does not directly mark AR/AP paid or perform accounting close. No provider-observation-to-cash-state mutation was found. Good separation.

Commercial actual profitability is also not delivery-gated, so it should be interpreted as booked/invoice economic evidence, not final closed-job profit.

## Consolidation allocation -> supplier bill -> profitability

Expected allocation is on houses; natural external supplier invoice is likely master-level. Actual profitability has no master-to-house actual allocation. Paying at both layers can double-settle, KCPL-V2-FIN-003.

## Customer reassignment -> AR

Collection rereads current customer/shipment relation and fails closed on mismatch. Concurrent invoice issue/reassignment can still strand a stale issued invoice, but no cross-customer collection bypass was found.

## Supplier reassignment -> AP

Pre-payment reconciliation invalidates approval/audit/job cost. Post-payment reassignment is locked. This attack held, except for the separate variance-approval race in KCPL-V2-FIN-008.

---

# Required finance invariants after this audit

The code currently enforces many document-level invariants. The missing system-level invariants are clearer after #126/#129:

1. **One economic shipment authority:** a TMS-origin quote cannot create a non-lineaged parallel shipment.
2. **One booked procurement obligation:** total supplier obligations accepted against one booked commercial version cannot exceed the authorized obligation except through an explicit approved supplemental-cost mechanism.
3. **One consolidation settlement layer:** master versus house must have an explicit external-obligation owner, with actual master cost allocation to houses that does not create additional payable obligations.
4. **One booked revenue authority:** AR invoices for a TMS shipment must reference the exact booked sell authority or explicitly record an approved commercial adjustment/rebill lineage.
5. **Business-event identity:** invoice creation and payment events require identity that distinguishes retry from a second legitimate event.
6. **Approval attestation:** variance approval must bind exact audit fingerprint/economic state, not just mutable audit document status.
7. **Profit basis labels:** expected commercial, observed supplier subtotal, approved AP cost, paid cash cost and final closed-job profit are different facts and must not collapse into one ambiguous “actual profit.”
8. **Currency minor units:** financial settlement must share the same currency precision policy as commercial lineage.

---

# Test gaps exposed by this Stage 4 audit

The merged #126/#129 test suites cover many local invariants. The remaining defects are composition cases. High-value missing adversarial scenarios include:

1. stale versioned TMS quote -> generic won shipment -> AP -> `not_applicable` -> approve/pay;
2. two distinct supplier invoice references, same shipment/provider, each equal full booked cost, both match/pay;
3. consolidation master bill plus house allocation bills, all matching and all settling;
4. master-only consolidation supplier bill -> verify house/customer actual profitability allocation;
5. booked subtotal 100 + tax 100 -> audit status and payable amount;
6. duplicate AR invoice create retry for one shipment/business event;
7. booked sell amount/currency versus arbitrary AR amount/currency;
8. two legitimate equal same-day payments without explicit idempotency key;
9. exact retry after full payment and after a partial payment that reduces outstanding below retry amount;
10. concurrent variance review V1 + supplier/economic refresh V2 + stale approval completion;
11. draft matched AP appearing in `commercial_actual_procurement_total`;
12. credit/adjustment settlement basis versus commercial actual procurement subtotal;
13. concurrent AR issue/void and AP approve/void;
14. JPY fractional invoice/payment and JPY consolidation finance conservation;
15. invalid legacy currency appearing in dashboard/customer totals;
16. customer preferred-currency summary with additional valid foreign-currency AR/AP.

This audit did not modify application tests or rerun CI because its permitted mutation scope is only this report. The findings are source-path and transaction-composition findings against the exact application state merged through #130 and the Stage 2 documentation commit above.

---

# Final assessment of #126 integrated with #129

## #126 result

**Substantially successful at single-document settlement integrity.**

The most dangerous original stale-balance payment races, overpayment arithmetic errors, weak AP invoice uniqueness and post-payment supplier relinking are materially hardened on the active routes.

## #129 result

**Substantially successful at immutable normal-path TMS procurement history and payment-time attestation.**

Freight Audit/Match-Pay no longer need current rate card/current FX/current order quantity to explain a genuine booked shipment.

## Integration result

**Incomplete.**

The shared weakness is the absence of a canonical economic-obligation identity above individual documents:

- AR has no booked sell obligation binding;
- AP has no cumulative booked procurement obligation binding;
- consolidation has both master and house booked procurement layers without settlement exclusivity;
- stale TMS quote generic shipment creation can erase the very lineage finance relies on;
- profitability mixes forecast, invoice evidence and accounting projections under different fields without one closed-job financial authority.

KCPL should therefore not yet represent Match-Pay as “a booked procurement can only be paid once” or commercial profitability as final accounting profit.

**Stage 4 verdict: FAIL pending remediation of the Critical cross-module obligation-identity defects and High AR/settlement control gaps.**
