# KCPL-FSA2-005 — Consolidation Allocation Approval Remediation

## Scope

This remediation changes only the consolidation commercial-allocation approval workflow. It does not implement canonical delivery authority, procurement payable authority, AR revenue authority, or Freight Audit / Match-Pay settlement approval changes.

Starting authority: `main` at `74980ff58dd327db746f7a70bc4bdaf1b54517a5` (`#131 Harden KCPL commercial authority seams`).

## Invariant

For a released consolidation load, the exact allocation-derived `commercial_versions/{id}` documents staged before approval are the exact versions that final consolidated booking consumes.

There is no approval of recomputed economics. Final booking does not call allocation derivation or create another house commercial version.

## Staged lifecycle

The existing load statuses remain authoritative and unchanged:

`draft → ready_for_procurement → tendering → booked`

Commercial allocation has a separate, small lifecycle:

`not prepared → pending_approval | ready → booked`

A prior package may become `stale` when a changed authoritative economic state produces a different package identity.

The durable package is stored in `consolidation_allocation_packages/{deterministicId}`. It records:

- load and canonical branch
- released-manifest fingerprint and release lock timestamp
- master order, master commercial version/fingerprint and authoritative tender
- master procurement partner/rate-card identity
- allocation method, basis, basis inputs, currency precision and master total
- deterministic residual strategy and recipients
- source house commercial version IDs/fingerprints
- derived house commercial version IDs/fingerprints
- allocated procurement per house
- approval requirement/reasons per house
- package fingerprint, preparer and timestamps

The load stores only the current package pointer/fingerprint and a progress projection. Booking never trusts that projection as authority.

## Deterministic identity

The package fingerprint hashes the released manifest, master commercial/tender authority, source version fingerprints, server-owned physical allocation inputs, allocation method and exact allocation output.

The package ID is derived from that fingerprint. Each house derived commercial-version ID is derived from:

`package fingerprint + house order ID + source commercial-version ID`

An identical prepare retry therefore targets the same package and the same derived version documents. Changed economic inputs produce a different package/version identity. Old versions and approvals remain historical.

## Allocation math

The staged allocator works in integer minor units:

- JPY: 0 decimal places
- current other KCPL currencies: 2 decimal places

Basis selection remains deterministic:

1. weight when total weight is positive
2. volume when weight is zero and total volume is positive
3. pieces when weight/volume are zero and total pieces is positive
4. explicit equal split when all physical bases are zero

Base allocations use floor minor units. Residual minor units use largest fractional remainder, with canonical order ID descending as the deterministic tie-breaker. Thus NPR 100.00 across three equal houses is 33.33 / 33.33 / 33.34 for ORD-1 / ORD-2 / ORD-3 regardless of query or array order.

Negative, non-finite, duplicate-house, unsafe-large, or over-20-house inputs fail closed. No current FX or current rate card is fetched during staged house derivation. Existing historical FX provenance may be reused only when the existing lineage proves the allocation-currency to sell-currency relation; otherwise preparation requires commercial review.

## Customer sell authority

Allocation changes buy-side procurement only. For each house, preparation reuses #131's `prepareCustomerSellAuthorityCarryForwardInTransaction` and `persistPreparedCustomerSellAuthorityCarryForwardInTransaction` split.

Carry-forward is materialized as an exact target-version `commercial_customer_acceptances/{derivedVersionId}` record only when order, customer, sell amount and sell currency match. A missing/conflicting source acceptance or changed sell economics fails closed.

Internal consolidation bridge quotes are not customer acceptance authority.

## Management approval

No `consolidation_approvals` collection exists. Staged versions use the existing `commercial_approvals/{commercialVersionId}` authority.

The consolidation approval command is Management-only and validates:

- current load/package pointer
- canonical branch access
- target version is a required member of the current package
- exact commercial version ID, fingerprint and order
- current package has not become stale/booked

It then calls the existing exact `createCommercialApprovalInTransaction`. It does not mutate the house order's active commercial pointer.

Partial approvals keep the package pending. Booking independently rereads exact approvals and does not trust a stored `ready` flag.

## Final booking

The route-facing consolidation booking dispatcher now uses the prepared-allocation booking transaction. Standard (#127) booking remains on the existing path.

Before any write, consolidated booking rereads:

- load, master order and tender
- released member/source manifest
- master commercial version and applicable approval
- authoritative live master tender set
- all house orders
- current allocation package and fingerprint
- exact source and derived commercial versions
- exact approval authority for every frozen source version that requires approval
- exact approvals for every derived version that requires one
- exact customer sell authority for each derived house version
- customer records
- master/house bridge quote collision state

It validates current released/tender/source authority against the package. Any mismatch returns `commercial_allocation_stale`; absence returns `allocation_not_prepared`; missing exact derived approval returns `approval_required`. If a previously required source-version approval can no longer be proven, the package is stale and cannot book.

Only after those reads complete does it create the master/house shipment graph and promote each house order to its already-persisted derived commercial version. The package is marked booked in the same transaction.

HTTP retry after success uses #127's booking-reference graph check plus `booked_allocation_package_id` and exact package-derived house version verification.

## Invalidation and supersession

The current package becomes unusable when an economically material authority no longer matches, including:

- released manifest identity or release lock changes
- house order/customer/branch/source pointer changes
- source version/fingerprint changes
- source approval authority disappears or conflicts
- master commercial version/fingerprint changes
- authoritative tender, tender timestamp, partner, rate card, amount or currency changes
- allocation physical inputs change
- persisted derived version/fingerprint/source lineage differs
- exact derived approval is absent or does not match the staged derived version
- exact customer sell authority is absent/conflicting

Preparation of changed authority creates a new deterministic package and marks the prior current package stale. No commercial version, approval, or customer acceptance history is deleted.

Current KCPL cancellation only permits draft-load cancellation. This remediation does not invent a post-release cancellation state. If that product behavior changes later, a cancelled/re-released manifest must naturally produce a new package identity rather than reactivate an old package.

## Firestore read/write order

The new preparation, staged approval, and final booking transactions use explicit READ and WRITE phases. No `transaction.get`, transaction query, or authority helper that reads Firestore appears after the write-phase marker.

This specifically avoids the Firestore read-after-write seam found during #131 hostile review.

## Worst-case transaction budget (20 houses)

### Preparation

Worst new-package writes:

- 20 immutable derived commercial versions
- up to 20 exact carried customer acceptances
- 1 allocation package
- 1 load current-package pointer/progress update
- 1 load audit event
- optionally 1 prior package stale/supersession update

**Maximum: 44 writes.**

Conservative worst-case reads are roughly 146 document reads plus the authoritative master-tender query, including house orders, source versions/approvals, source+target customer acceptance checks, existing derived documents, derived approvals, package/current package and master authority. This is intentionally separated from final booking so the two business actions do not compound into one oversized transaction.

### One staged Management approval

- 1 exact `commercial_approvals` create when not already approved
- 1 package progress update
- 1 load progress update
- 1 load audit event when newly approved

**Maximum: 4 writes.**

It rereads each approval-required derived version/approval so the resulting package progress is based on exact current authority.

### Final booking

For 20 houses, worst-case writes preserve the existing #127/#129 booking graph:

- 1 master bridge quote + 1 master shipment
- 20 house bridge quotes
- 20 house shipments
- 20 house order updates
- 20 house booking events
- up to 20 customer shipment-counter updates
- 1 tender update
- 1 master-order update + 1 master-order event
- 1 allocation-package booked update
- 1 load update + 1 load event

**Maximum: 108 writes.**

Conservative authority reads are roughly 167 documents plus the live master-tender query before the write phase. The extra worst-case 20 reads are the frozen source-version approval revalidation, ensuring an approval that disappears or conflicts after preparation cannot be bypassed. The 108-write maximum remains well below Firestore's 500-write batch/transaction operation ceiling; the staged split also keeps request size and transaction complexity materially below a combined prepare+book design.

## Existing stuck loads: read-only detection and recovery

No production migration is required and none is included.

A read-only operational detection can identify candidates where:

- `consolidation_loads.status` is `ready_for_procurement` or `tendering`
- `released_commercial_sources` is present and matches members
- the deterministic master order exists
- its authoritative tender is accepted/countered
- `current_allocation_package_id` is absent

These are historical loads that would previously recompute an approval-required allocation inside booking and deadlock.

After deployment, recover them without rewriting source history:

1. Open Load Planner.
2. Select the released load.
3. **Prepare allocation**.
4. If required, Management approves the listed exact derived versions.
5. When the package shows **Ready to book**, retry booking in Tender Desk.

The preparation path lazily initializes the package/derived versions from the already-frozen released source manifest and current authoritative master tender. There is no destructive migration and no update to historical source commercial versions.

## Regression suite

`tests/consolidation-allocation-approval.test.mjs` is registered in normal `npm test` and contains 90 hostile cases covering deterministic preparation, immutable derived lineage, exact approval, #131 customer authority carry-forward, booking consumption, staleness, money precision, races, API discoverability, no-write-on-read, and Firestore read-before-write guards.
