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

### Released documents

The sweep also mails a customer when KCPL releases a document to them, which is
usually the thing they were actually waiting for. Three guards:

- **The same release rules as the portal**, so an email can never point at a
  document the recipient is not allowed to download.
- **A baseline per shipment.** `documents_baseline_at` is stamped the first time
  a shipment is swept, and only releases after it are notified — switching the
  topic on never mails a customer their entire back catalogue of paperwork.
- **Keyed by document id**, so a later re-review of the same document (an expiry
  change, a re-verification) never mails about it twice.

A document the customer sent themselves is never announced back to them.

Documents live in a per-shipment subcollection, so checking them would cost a
read per shipment per sweep. Releasing a document touches the shipment's
`updated_at`, so the sweep compares that against `last_seen_updated_at` and
skips the read entirely when nothing can have changed.

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

## Free time and demurrage

For a landlocked lane the clock at the port or the ICD is where money leaks: a
container that sits past its free days accrues a daily charge nobody notices
until the invoice arrives. KCPL records what the carrier granted on the Job File
(**Free time**, right-hand column); the customer sees a countdown.

`app/shipment-free-time.ts` is pure and shared, so the staff panel, the portal
and the notification sweep all compute the same number. Dates are calendar days,
not timestamps — a free-time allowance is counted in days by the carrier, and a
time zone would make the last day ambiguous exactly when it matters.

The allowance **includes the day it starts**: three days from the 18th covers the
18th, 19th and 20th. The last day is its own state rather than an expired one, so
a customer is not told they are safe on the day a charge begins, nor panicked a
day early.

Customers are warned at **three days, one day and the last day**, and not again.
A daily countdown is a countdown people stop reading. The warning never states a
charge amount: the rate KCPL records is what the carrier quoted, not an invoice,
and a number in an inbox reads as one. The internal note stays internal.

Free time rides on the shipment document the sweep and the overview already read,
so the countdown costs no extra reads anywhere.

## Delivery confirmation

A consignee can confirm receipt from the shipment page once it is out for
delivery or delivered. This is **evidence, never authority**: canonical Delivered
is written by the delivery authority from a verified POD, and the confirmation
route writes no shipment status, no delivery attempt and no POD evidence. It
lands in its own `customer_confirmations` subcollection and on the Job File
activity, and the operator's notification says plainly that it is not a POD.

One confirmation per account per shipment — a deterministic id makes a double
submit idempotent instead of stacking duplicates on the Job File.

## Invoices: printing and remittances

There is no server-side PDF. `/portal/invoices/<reference>` is a print-optimised
statement, and the print stylesheet hides the application chrome so a filed or
forwarded copy is the record and nothing else. That needs no new dependency —
worth stating plainly, because a PDF library would have to pass the repository's
`npm audit` gate forever after.

A customer can send a **payment receipt** against an invoice. Like customer
document uploads it is a claim awaiting review: nothing writes `amount_paid`,
`balance_due` or the invoice status. Money is applied by KCPL accounts through
the staff payments path against a bank statement — a customer's own figure is a
number on a form until somebody checks it. The same file twice is recognised as a
double submit rather than a second payment, and the invoice's creator is notified.

Remittances live under the invoice rather than in the shipment Document Vault.
Keeping them apart matters: `customer_safe` governs what KCPL releases *to* a
customer, and a bank receipt flowing the other way has no business inheriting
those semantics.

## What the portal never writes

A customer request (`POST /api/portal/requests`) creates an ordinary enquiry in `quotes`
with `customer_id: null` and `crm_match_state: "suggested"`. The staff-owned CRM link
stays a staff decision; the portal writes its own `portal_customer_id` field for its own
scoping. A "ask to proceed" on a quote writes a note and a namespaced
`portal_booking_request` marker — it never sets a status, a price or a booking. Nothing
in the portal touches the commercial authority chain (commercial versions, approvals,
tenders, bookings, settlement).

## Customer-managed team logins

An account **owner** can invite colleagues from `/portal/settings` without going
through KCPL — the phone call the portal exists to remove. The decision lives in
`decidePortalTeamChange`, a pure function with its own tests, and the route
supplies only session facts:

- **Owners only.** A member managing logins would make the access level meaningless.
- **Members only, never owners.** An owner cannot create or disable another owner.
  Who holds commercial authority over an account is KCPL's decision, and it keeps
  one compromised owner from locking the real one out.
- **Never yourself**, so the last owner cannot strand the account.
- **Own customer only.** The customer id comes from the session; an address already
  provisioned under a different customer is refused rather than reassigned.
- **A seat limit** (`PORTAL_TEAM_MEMBER_LIMIT`, currently 10). Not licensing — blast
  radius: each login is a door into that customer's shipments, and the ceiling stops
  a compromised owner minting them indefinitely. KCPL can provision beyond it from
  the staff side.
- Staff addresses are refused here exactly as they are in staff provisioning.

The invited colleague receives the same Firebase password-reset invite, so KCPL
never handles a customer password regardless of who did the inviting. If the
invite cannot be sent the login is still created and the response says so, rather
than leaving the owner believing mail went out.

## Language

The portal ships in English and Nepali. The language is stored on the account rather
than in a cookie, because the scheduled notification sweep has no browser to read a
cookie from — and an email arriving in a different language from the portal that sent
it is worse than one that was never translated. A customer changes it themselves from
`/portal/settings`.

Three rules, each enforced rather than intended:

- **Completeness is a compile error.** The Nepali dictionary in `portal-i18n.ts` is
  typed against the English one, so a key added on one side and forgotten on the other
  fails `tsc`. A test additionally scans every Nepali entry for Devanagari, which is
  what catches a key copied across untranslated.
- **Trade vocabulary stays as Nepali freight desks say it.** A Kathmandu clearing
  office says "bill of lading", so the Nepali reads बिल अफ लेडिङ rather than a coined
  translation nobody would match against the document in their hand.
- **Sentences are whole, not assembled.** Nepali puts the place before the subject, so
  cases like the free-time warning carry a with- and a without-location template rather
  than one sentence plus a glued-on phrase.

Label helpers (`portalStatusLabel`, `portalDocumentLabel`, …) take a locale and default
to English, so every staff-side caller is unchanged.

## One login, several customers

A freight agent buying under several KCPL customer records holds one login. The shape
of the rule matters more than the feature:

- `decidePortalAccess` is untouched. It still decides, from the **primary** customer
  alone, whether an identity may hold a portal session at all. The linked scope only
  widens what an already-authorised session reads; it can never be the reason a session
  exists.
- The active customer arrives in its own cookie and carries **no authority**. The
  allowed set is re-derived from Firestore on every request and the cookie intersected
  with it, so a forged or stale id resolves to the primary customer.
- Linking is **Management's, never an owner's**. There is no portal route that reaches
  the writer, and a test asserts it.
- A linked principal KCPL later archives or blacklists drops out silently: stopping
  trade with one of an agent's principals must not cost them the others.

The team panel lists logins that reach a customer through a link, because they really
can read that customer's shipments — but they are another customer's account, so they
are outside the owner's authority and outside the seat count.

## Document access log

Every customer download of a released document writes a row to the shipment's own
`document_access` subcollection, and the Job File shows two halves: what has been
collected, and what has been released but never opened. The second is the half an
operator can act on.

The record names the **account**, because that is the fact in dispute, and stores no IP
address or user agent — neither strengthens the answer, and both turn a dispute record
into a surveillance record. Every download is recorded, not only the first: "downloaded
three times, most recently on the 4th" is a different answer from "downloaded once".

The write is subordinate to the download. It happens after the bytes are in hand, so the
row means "this customer received this file", and a failed write returns false rather
than throwing: the customer has the document either way.

## Push notifications

Push is a second **transport**, not a second policy. Whether a customer hears about a
fact stays in `portal-notifications.ts`; the push path only carries an already-decided
message, keyed by the same deterministic notification key, so a phone and a laptop each
get one notification rather than the same fact twice on both.

Encryption (RFC 8291) and VAPID signing (RFC 8292) are implemented directly on
`node:crypto` — no dependency, for the same reason invoices print rather than render
through a PDF library. The tests decrypt a real payload back with an independently
written reader and verify the VAPID signature with Node's own verifier.

Subscriptions are per **device**: a customer who turns push on at the office has not
asked for it on the phone they left at home. A push service answering 404 or 410 is
telling KCPL the subscription is dead, so the row is dropped rather than retried.

The permission prompt is only ever raised from the button. A permission asked for on
page load is the fastest way to have it denied permanently, and a denied permission
cannot be re-requested from script.

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
| `additional_customer_ids` | further customers this login may read; staff-granted only |
| `locale` | `en` \| `ne`; the language for both the portal and this account's emails |
| `created_*`, `updated_*`, `last_sign_in_at` | provenance |

`shipments/{reference}/document_access/{id}`: one row per customer download — the
document, the account that fetched it, and when. No IP address or user agent.

`portal_push_subscriptions/{sha256(endpoint)}`: one row per browser — endpoint, the
subscription's public key and auth secret, the owning account and its language.

`portal_push_deliveries/{sha256(key)}`: the same claim-before-send record the email
transport keeps, so one fact reaches a recipient's devices once.

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
| `/portal/invoices/[reference]` | Printable invoice statement and payment receipts |
| `/portal/settings` | Notification preferences, and team logins for account owners |
| `POST /api/portal/session` | Mints the session cookie from a fresh, verified Firebase sign-in |
| `GET /api/portal/documents/[reference]/[id]` | Download; ownership then release are checked before any bytes are read |
| `POST /api/portal/documents/[reference]` | Customer upload against a shipment; lands unreviewed and unreleased |
| `POST /api/portal/requests` | Customer-raised enquiry or "ask to proceed" |
| `POST /api/portal/notifications` | Saves the signed-in account's notification topics |
| `POST /api/portal/locale` | Saves the signed-in account's language |
| `POST /api/portal/customer` | Switches which linked customer the session is scoped to |
| `POST`/`DELETE /api/portal/push` | Registers or removes this browser's push subscription |
| `GET`/`POST /api/portal/team` | An account owner's own team logins (owners only) |
| `POST /api/portal/shipments/[reference]/confirm-delivery` | Customer confirmation of receipt, as evidence |
| `GET`/`POST /api/portal/invoices/[reference]/remittance` | Payment receipts against an invoice |
| `GET /api/portal/invoices/[reference]/remittance/[id]` | Re-download of a receipt the customer sent |
| `GET`/`PUT /api/admin/jobs/[reference]/free-time` | Staff free-time record (Job File) |
| `/admin/portal-access`, `/api/admin/portal-access` | Staff provisioning (Management) |

Portal pages are `force-dynamic`, `no-store` and `robots: noindex`, and `/portal` is
excluded from public analytics and from the public site's mobile quote CTA.

## Known gaps

- **QA preview reaches the screens, not the data.** `KCPL_QA_AUTH_BYPASS` plus a separate
  `KCPL_QA_PORTAL` renders every signed-in surface as an invented customer, so the portal
  can be reviewed without a real account. It is fenced by the same helper as the staff
  bypass, which refuses outside a Vercel preview or a development server, and the second
  flag exists so enabling the staff preview never opens a customer surface by accident.
  `tests/portal-qa-preview.test.mjs` holds that fence.

  The preview customer id matches no real record, so every reader scopes to nothing and
  the screens render in their empty states. That is enough to review layout, navigation,
  both languages and the empty copy; it is not enough to review a populated table. A
  provisioned test customer remains the way to see the portal with data in it.
- **Document coverage is bounded.** `/portal/documents` scans the 40 most recently
  updated shipments (documents live in a per-shipment subcollection, so a full history
  scan costs one read per shipment). The workspace states the coverage when it is capped.
- **No payment capture.** A customer can tell KCPL they paid and attach the receipt,
  but the portal takes no money and applies none: bank details, payment references and
  credit terms stay with KCPL accounts.
- **Free time is only as good as what staff record.** Nothing imports carrier free days
  automatically, so an unrecorded allowance simply shows no countdown rather than a
  wrong one.
- **Remittances are not malware-scanned**, on the same terms as customer documents.
- **Uploads are not malware-scanned.** Type, extension, size and magic bytes are
  checked, and files are served back only through authenticated, force-download routes
  with `X-Content-Type-Options: nosniff` — but no antivirus runs over them. Staff open
  customer-supplied files at the same risk they do an emailed attachment today.
- **Notification latency is the sweep interval.** Milestone emails go out when
  `/api/internal/automation` next runs, not the instant a status changes. If KCPL wants
  near-real-time delivery, the sweep needs to run more often — the dispatcher itself is
  cheap and idempotent, so that is a scheduling decision rather than a code change.
- **Email and web push.** WhatsApp is still the channel most KCPL customers actually
  read; the dispatcher takes a second transport beside the mailer without touching the
  decision rules, which is how push was added.
- **Push has never reached a real device.** The encryption round-trips against an
  independently written reader and the VAPID token verifies with Node's own verifier,
  but nothing here has been sent to a live push service. The failure modes are loud —
  a browser that cannot decrypt drops the message, a bad token gets a 401 — rather
  than silent, but the first real subscription is still the first real test.
- **Push needs VAPID keys.** `KCPL_VAPID_PUBLIC_KEY`, `KCPL_VAPID_PRIVATE_KEY` and
  `KCPL_VAPID_SUBJECT` must all be set or the control does not appear and the sweep
  skips the transport entirely.
- **Team invites depend on the same mail configuration.** Without a provider, an
  account owner has to pass the one-time link to their colleague themselves, exactly
  as KCPL staff do.
- **Linked customers are staff-granted only.** An agent can hold one login across
  several KCPL customer records, but only Management can link them: an account owner
  who could link customers could grant themselves another company's shipments.
- **Nepali covers the portal, not the data.** Every screen a signed-in customer sees
  and all three notification emails are translated. Place names, shipment references,
  filenames, carrier names and staff notes are records and stay as KCPL holds them.
  Dates stay Gregorian in both languages, because every carrier document and customs
  entry the portal reports on is Gregorian. The sign-in page stays English: it renders
  before anyone has identified themselves.
- **The portal installs, but stores nothing offline.** The service worker exists to
  receive push and focus a tab. It has no fetch handler and no cache, because a cached
  shipment status is a wrong shipment status.
