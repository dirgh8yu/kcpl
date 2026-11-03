# Connected freight workflows

This release adds six connective surfaces around the existing KCPL authorities. None of them introduces a second source of truth for tender, booking, delivery, payment or document release state.

## 1. Partner tender desk

- **Partner UI:** `/partner/tenders`, `/partner/tenders/[id]`
- **Partner API:** `POST /api/partner/tenders/[id]/respond`
- **Authority:** `respondToTmsTenderFromPartner` in `app/admin/tenders/tms-tendering.server.ts`

A partner session may answer only a tender whose `partner_id` matches its own partner record. The response then runs through the same `applyTenderResponse` transaction as staff and EDI 990: commercial-version checks, counter-offer lineage, expiry, stale-state protection and booking state all remain in one place. Accept, decline and counter-offer are supported.

The partner portal now has navigation for Shipments and Tender desk, and its home page shows the partner's own tender response, acceptance and on-time rates. New tenders create a partner notification, and the automation sweep creates one deadline reminder per tender for anything due inside 24 hours. Partner responses are rate-limited per account and use the same tender transaction as staff and EDI.

## 2. Unified shipment activity

`app/shipment-timeline.ts` defines one ordered activity model for:

- shipment milestones
- documents
- delivery confirmation
- partner invoices

The customer shipment page now reads this model for its Activity feed. `/partner/shipments/[reference]` uses the same model with partner-visible documents and the partner's own invoices. Audience is explicit on every entry; internal job activity is never passed to a customer or partner feed.

## 3. Document intake intelligence and wider archive

- Customer and partner uploads still use the existing value, type, size, magic-byte and release gates.
- When `ANTHROPIC_API_KEY` is configured, customer uploads are read automatically **after** the request completes. The reading is stored beside the document for staff review; it never applies fields by itself.
- `/portal/documents` now scans up to 200 recently updated shipments instead of 40. Search and direction/type filters remain client-side.

## 4. Quote attribution

- Landing context is captured by `app/quote-attribution.ts` from allowlisted campaign parameters, the referrer host, the landing path and the tool slug.
- `POST /api/quotes` sanitises the object again and stores `attribution` plus a top-level `source` on the quote.
- Tool pages pass `?tool=duty-estimate|storage-charges|volume-weight`.
- Management can review source, tool, enquiry, pricing and win counts at `/admin/attribution` (Management role only).
- The same view rolls up invoice totals and collected cash by quote reference, so a source can be judged on realized money rather than quote value alone.

No third-party analytics call or cookie is added by this feature.

## 5. Online payments from the web portal

- **Web route:** `GET`/`POST /api/portal/invoices/[reference]/pay`
- **UI:** payment panel on `/portal/invoices/[reference]`

The existing payment engine already calculates partial amounts and foreign-currency NPR conversion server-side. The web panel now exposes those existing capabilities instead of limiting customers to a receipt upload. Card and wallet credentials stay with the gateway.

## 6. Carrier free-time ingestion

- **Endpoint:** `POST /api/integrations/free-time`
- **Auth:** `Authorization: Bearer <KCPL_FREE_TIME_INGEST_SECRET>`, falling back to `KCPL_TRACKING_INGEST_SECRET` when no separate credential is issued.
- **Module:** `app/free-time-ingest.ts` validates the payload; `applyCarrierFreeTime` writes only namespaced `free_time_*` fields, one provider idempotency key and a Job File activity line.

Example payload:

```json
{
  "reference": "KCPL-S-20261103-ABC123",
  "location": "Birgunj ICD",
  "days": 5,
  "started_on": "2026-11-01",
  "daily_charge": 45,
  "charge_currency": "USD",
  "bearer": "customer",
  "provider": "Carrier feed",
  "provider_event_id": "free-time-2026-11-01-001",
  "note": "Carrier allowance"
}
```

The endpoint is idempotent on `provider_event_id`; a retry returns `{ "ok": true, "duplicate": true }`.
