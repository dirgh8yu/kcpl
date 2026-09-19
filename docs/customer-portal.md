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
| `/portal/documents` | Every released document across recent shipments |
| `/portal/invoices` | Issued invoices and balances (account owners) |
| `/portal/requests` | New freight request, issued quotes, open requests |
| `POST /api/portal/session` | Mints the session cookie from a fresh, verified Firebase sign-in |
| `GET /api/portal/documents/[reference]/[id]` | Download; ownership then release are checked before any bytes are read |
| `POST /api/portal/requests` | Customer-raised enquiry or "ask to proceed" |
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
- **Single customer per login.** A contact who buys through two KCPL customer records
  needs two portal accounts.
