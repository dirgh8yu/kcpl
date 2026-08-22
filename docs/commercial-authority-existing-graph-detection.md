# Commercial Authority Existing-Graph Detection

This is a read-only review plan for records created before the commercial-authority seam remediation. It does not authorize automated repair or production Firestore mutation.

## Block / financial-lineage review

- A quote with TMS markers (`transport_order_id`, `commercial_version_id`, `commercial_fingerprint`, `commercial_locked`, or a `tms_*` source) is `won` and points at a shipment that lacks `transport_order_id`, `tender_id`, `booked_commercial_version_id`, `booked_commercial_fingerprint`, or `booked_commercial_snapshot`.
- A shipment linked to a versioned TMS quote lacks the booked commercial lineage fields above.
- A booked customer-bearing order has no `commercial_customer_acceptances/{booked_commercial_version_id}` attestation matching order, customer, fingerprint, sell amount, and sell currency.

These records can affect AR/AP or expected-profit lineage and require manual financial/commercial review before any later repair is considered.

## Stale customer-commercial authority review

- A TMS sell quote's `commercial_version_id` or `commercial_fingerprint` differs from its Transport Order's current pointer.
- A `won` TMS sell quote has no exact acceptance attestation for its own commercial version.
- A customer acceptance attestation has a mismatched order, customer, fingerprint, sell amount, or sell currency.
- A house shipment records an internal bridge quote but no `customer_quote_reference` proving the customer-facing authority from which its exact acceptance was derived.

Old quotes remain evidence. Do not silently rebind them to a newer commercial version or manufacture acceptance metadata.

## Rate-applicability review

- A Transport Order's selected/current commercial procurement names a branch-specific rate card whose stored `rate_card_branch` differs from the order branch.
- A legacy selected order whose current rate card branch is neither `Global` nor the order branch cannot be automatically reconstructed and must remain review-required.
- For old commercial versions that predate `rate_card_branch` provenance, do not infer historical legality from today's mutable rate card. Classify them as legacy provenance review where branch legality matters.

## Suggested read-only query strategy

Use an authorized server-side review/export tool and join only by stable IDs, never display names:

1. Quotes to Transport Orders by `transport_order_id`.
2. Quotes to shipments by `shipment_reference` and legacy `quote_reference`.
3. Booked orders/shipments/tenders to `commercial_versions` by exact booked version and fingerprint.
4. Exact commercial version IDs to `commercial_customer_acceptances`.
5. Commercial procurement snapshots to their stored `rate_card_branch`, origin, destination, rate-card ID, and order branch.

Classify the flagged records into the review groups above and preserve the original documents as evidence. A later migration/remediation ticket can decide whether external records prove a safe repair.

## Explicit non-actions

This remediation does **not** automatically rewrite, delete, reissue, accept, fabricate, backfill, or create any production quote, acceptance, shipment, rate selection, commercial version, approval, AR/AP record, or booking. Production Firestore mutation remains **NO**.
