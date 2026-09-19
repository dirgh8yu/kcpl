# KCPL Customer Portal

`/portal` is the authenticated self-service surface for KCPL's customers. It shows a
customer their own shipments, the documents KCPL has released to them, their issued
invoices and the quotes they have been given, and it lets them raise a new freight
request.

It is built on the same foundation as the staff product: `app/admin/operations-ui.tsx`
primitives inside `app/admin/operations-system.css`. The portal adds no second design
system — `app/portal/layout.tsx` renders `kcpl-admin-route kcpl-portal-route`, the shell
nests `kcpl-admin-shell` / `kcpl-admin-content`, and the portal block at the end of
`operations-system.css` only replaces the staff chrome (fixed sidebar gutter, fixed
toolbar offset) with a sticky customer header.

## Authority model

A portal principal is **not** a staff principal, and the two can never be held by the
same login.

| Concern | Staff | Customer |
|---|---|---|
| Session cookie | `kcpl_admin_session` | `kcpl_portal_session` |
| TTL | 12 hours | 8 hours |
| Resolver | `app/admin/admin-auth.ts` | `app/portal/portal-auth.ts` |
| Authority record | `staff_profiles` | `portal_accounts` |
| Scope | role + branch | exactly one `customer_id` |

`app/portal/portal-access-policy.ts` holds every decision as a pure function, with no
Firebase and no cookies, so the rules are unit-tested directly
(`tests/customer-portal-access.test.mjs`). A session is granted only when **all** of the
following hold:

1. Firebase reports `email_verified` — a password account can be created for any
   address, so verification is what proves control of it;
2. the address is **not** an active `staff_profiles` account and is not in
   `KCPL_ADMIN_EMAILS`;
3. an **active** `portal_accounts` record exists for the address and names a customer;
4. the record's bound `uid` matches, or the record is unbound and this sign-in claims it
   (compare-and-set, so a recreated Firebase account cannot inherit the customer);
5. the customer exists, is not archived and is not `blacklisted`. A credit hold
   (`on_hold`) deliberately still allows sign-in — that is when a customer most needs to
   see the balance they are being chased for.

Every denial is logged with its reason server-side and reported to the caller as one
generic message: which check failed would otherwise map out other people's accounts.

## Data scope and redaction

`app/portal/portal-data.server.ts` takes the resolved session and scopes every query by
`session.customerId`. No reader accepts a customer id from a caller.

Projections are **allowlists, not deletions**: `portalShipmentView`, `portalInvoiceView`,
`portalQuoteView` and `portalDocumentView` copy named fields out of a raw record, so an
internal economic field added to a staff document later cannot reach a customer payload
by default. `internal_cost`, `procurement_cost`, `commercial_snapshot`, job costs,
margin, internal notes and staff assignment never have a route to the portal.

Release rules:

- **Documents** — released only when a staff member has set `customer_safe` on the
  document AND it is not `rejected`, `superseded` or `deleted` and has not passed its
  `expires_on` date. An absent `customer_safe` is a no.
- **Invoices** — `draft` and `void` are never shown. Opening balances from migration are
  shown and labelled.
- **Quotes** — only once priced; `lost` and `cancelled` are hidden.
- **Shipments** — scoped by `customer_id`. A shipment belonging to another customer is
  reported as *missing*, never *forbidden*, so the portal cannot be used to test whether
  a reference exists.

## Inbound documents

Documents move both ways. `/portal/shipments/<reference>` shows the customer their
half of the Document Vault: one line per requirement KCPL seeded on the shipment,
in customer language rather than review language.

| State | Meaning |
|---|---|
| **Needed** | Required, and nothing live has been supplied |
| **With KCPL** | Supplied, waiting on review |
| **Confirmed** | Verified by KCPL and not expired |
| **Send again** | Rejected; KCPL needs it re-sent |

Fulfilment is derived from the documents themselves, exactly as the staff workflow
guard derives it — the requirement record carries no completion flag. The checklist is
computed from **every** live document, including ones the customer cannot see, so a
line never reads "still needed" because the paper KCPL already holds has not been
released back. The staff review note is deliberately never carried into any state: it
is internal reviewer copy, not a message written for a customer.

### What a customer may send

`customerUploadableDocumentTypes` is a default-deny allowlist of the papers a
*shipper* originates: commercial invoice, packing list, certificate of origin, import
and export permits, dangerous-goods declaration, insurance certificate, other.
Everything absent from it — bills of lading, air waybills, delivery orders, manifests,
customs entries, proof of delivery — is produced by KCPL, a carrier or an authority,
so accepting a customer's copy would put a document KCPL did not issue into the same
vault as the ones it did.

### How an upload is treated

`POST /api/portal/documents/[reference]` gates in this order, before a byte is stored:
portal session → `canSubmitRequests` → same-origin → the shipment belongs to this
session's customer → the type is on the allowlist → extension is PDF/JPEG/PNG/WEBP →
size within `PORTAL_UPLOAD_MAX_BYTES` (10 MB, narrower than the staff vault's 15 MB) →
magic bytes match the extension. A shipment that is not the caller's is reported as
*missing*, never *forbidden*.

The file then goes through the same `uploadShipmentDocument()` the staff route uses, so
it lands as `review_status: "received"` and `customer_safe: false` — evidence awaiting
review, never verified paperwork, and not releasable back to the portal until a staff
member says so. The route cannot supersede an existing document: replacing KCPL's copy
of anything is a staff decision, so `supersedesDocumentId` is not accepted from it at
all. Uploads are rate limited per portal account.

`uploaded_by_source: "customer_portal"` records provenance. It drives three things: the
**From customer** badge and filter in the staff Document Vault, a
`document_received_from_customer` entry on the Job File activity, and the rule that a
customer can always see a document they sent even before it is released — withholding
it would only hide their own paperwork from them.

## Notifications

The portal is no longer only a pull. Customers are emailed when their cargo moves,
and the operator who owns a job is told when a customer sends paperwork into it.

### Milestone emails

`dispatchPortalNotifications()` is a **scheduled sweep**, not a hook on the writers.
Canonical shipment status is set in several places — the delivery authority, external
event promotion, manual delivery control — and every one sits inside the authority the
system audit is about. Reading the result on a schedule keeps notification concerns
entirely outside that chain: nothing in the dispatcher can fail a booking, delay a
settlement or change a state. The cost is latency, bounded by how often
`POST /api/internal/automation` runs, which is the right trade for a courtesy.

Rules the sweep keeps:

- **Only a real change.** A status equal to the last one notified sends nothing, and a
  shipment seen for the first time is never news — otherwise switching notifications on
  would mail a customer about their entire history.
- **`preparing` is not notified.** It is an internal readiness step that changes nothing
  the customer can act on, and notifications that teach people to ignore notifications
  are worse than none.
- **Only bound, active, subscribed accounts.** An account that has never completed its
  invite has not proved control of the address, so it is never mailed.
- **Exactly once.** Every message carries a deterministic key
  (`portal:topic:reference:fact:recipient`), and a delivery row in
  `portal_email_deliveries` is claimed *before* the provider call and confirmed after,
  so a crash between the two leaves a `pending` row rather than a silent re-send.
- **The watermark advances regardless.** `portal_notification_state/{reference}` records
  the last status seen whether or not anything was sent, so enabling a topic never
  replays history.
- A ceiling of 200 emails per sweep, as a defence against a watermark bug turning into
  a mailshot.

The copy builder takes a fixed set of operational facts — reference, status, mode,
lane, ETA, current location — and there is no parameter through which a rate, a cost,
a supplier or an internal note could reach a customer's inbox. Every interpolated value
is HTML-escaped.

### Preferences

`/portal/settings` lets each customer switch topics for **their own login**: the account
being changed comes from the verified session, never from the request body, so one
portal user cannot silence another's notifications. Absent preferences mean subscribed —
a customer given portal access expects to hear about their own cargo, and every topic is
switchable from the portal itself. The page says plainly when outgoing email is not yet
configured, rather than silently saving settings that do nothing.

### Telling ops about inbound documents

A customer upload notifies the shipment's assigned operator through the existing staff
notification centre (`category: "documents"`), linking into the Document Vault filtered
to that shipment. An unassigned shipment has nobody to tell; the vault's "From
customers" filter is the backstop. The notification is awaited but never thrown: a
notification failure must not turn a stored upload into an error the customer is asked
to retry.

## What the portal never writes

A customer request (`POST /api/portal/requests`) creates an ordinary enquiry in `quotes`
with `customer_id: null` and `crm_match_state: "suggested"`. The staff-owned CRM link
stays a staff decision; the portal writes its own `portal_customer_id` field for its own
scoping. A "ask to proceed" on a quote writes a note and a namespaced
`portal_booking_request` marker — it never sets a status, a price or a booking. Nothing
in the portal touches the commercial authority chain (commercial versions, approvals,
tenders, bookings, settlement).

## Provisioning (staff runbook)

**Operations → Organisation → Customer Portal Access** (`/admin/portal-access`,
Management only — granting a customer a login to their own billing data is an
access-control decision, so it sits with the authority that manages staff accounts).

1. Enter the customer contact's email, choose the customer account and the access level:
   - **Account owner** — shipments, documents, invoices, and can raise requests;
   - **Team member** — shipments and documents only.
2. Choose **Grant access**. This writes the `portal_accounts` record; it does not yet let
   anyone in.
3. Choose **Send invite** on the row. KCPL creates the Firebase identity if it does not
   exist and generates a password-reset link. Completing that link both sets the
   customer's own password and marks the address verified, which is exactly the state the
   sign-in gate requires — KCPL never sets or holds a customer password.
   - With `SENDGRID_API_KEY` and `KCPL_EMAIL_FROM` configured the invitation is emailed.
   - Without them the one-time link is shown once in the workspace for a staff member to
     pass on through their own channel.
4. **Disable** revokes access immediately; the record and its uid binding are kept, so
   re-enabling does not re-open the account to a different person.

Reassigning an address to a different customer is refused. Deactivate the account and
provision the address against the new customer instead.

## Firestore

`portal_accounts/{lowercased email}`:

| Field | Meaning |
|---|---|
| `email` | lowercased address; also the document id |
| `customer_id` | the one customer this login may see |
| `role` | `owner` \| `member` (unknown values resolve to `member`) |
| `active` | false disables sign-in without losing the binding |
| `uid` | Firebase uid, bound on first successful sign-in |
| `created_*`, `updated_*`, `last_sign_in_at` | provenance |

`firestore.rules` denies all direct client access; the portal reads through the Admin SDK
in server routes only, exactly like the staff product.

## Routes

| Route | Purpose |
|---|---|
| `/portal` | Sign-in, or the account overview |
| `/portal/shipments`, `/portal/shipments/[reference]` | Movements, milestones, released documents |
| `/portal/documents` | Released documents and the customer's own submissions, filterable by direction |
| `/portal/invoices` | Issued invoices and balances (account owners) |
| `/portal/requests` | New freight request, issued quotes, open requests |
| `/portal/settings` | The customer's own notification preferences |
| `POST /api/portal/session` | Mints the session cookie from a fresh, verified Firebase sign-in |
| `GET /api/portal/documents/[reference]/[id]` | Download; ownership then release are checked before any bytes are read |
| `POST /api/portal/documents/[reference]` | Customer upload against a shipment; lands unreviewed and unreleased |
| `POST /api/portal/requests` | Customer-raised enquiry or "ask to proceed" |
| `POST /api/portal/notifications` | Saves the signed-in account's notification topics |
| `/admin/portal-access`, `/api/admin/portal-access` | Staff provisioning (Management) |

Portal pages are `force-dynamic`, `no-store` and `robots: noindex`, and `/portal` is
excluded from public analytics and from the public site's mobile quote CTA.

## Known gaps

- **No QA preview fixtures.** The staff product can be rendered without Firebase through
  the double-gated QA bypass (`KCPL_QA_AUTH_BYPASS` + `KCPL_QA_MOCK_DATA`). The portal has
  no equivalent, so its authenticated surfaces cannot be screenshotted without a real
  Firebase project. Adding one means extending an auth bypass to a customer data surface
  and should be a deliberate, separately reviewed decision.
- **Document coverage is bounded.** `/portal/documents` scans the 40 most recently
  updated shipments (documents live in a per-shipment subcollection, so a full history
  scan costs one read per shipment). The workspace states the coverage when it is capped.
- **No payment capture.** Invoices are read-only; bank details, payment references and
  credit terms stay with KCPL accounts.
- **Uploads are not malware-scanned.** Type, extension, size and magic bytes are
  checked, and files are served back only through authenticated, force-download routes
  with `X-Content-Type-Options: nosniff` — but no antivirus runs over them. Staff open
  customer-supplied files at the same risk they do an emailed attachment today.
- **Notification latency is the sweep interval.** Milestone emails go out when
  `/api/internal/automation` next runs, not the instant a status changes. If KCPL wants
  near-real-time delivery, the sweep needs to run more often — the dispatcher itself is
  cheap and idempotent, so that is a scheduling decision rather than a code change.
- **Email only.** WhatsApp is the channel most KCPL customers actually read; the
  dispatcher is written so a second transport can be added beside the mailer without
  touching the decision rules.
- **No notification on document release.** The `documents` topic currently governs the
  ops-side upload notification and is stored for customers, but the sweep does not yet
  mail a customer when KCPL releases a document to them.
- **Single customer per login.** A contact who buys through two KCPL customer records
  needs two portal accounts.
