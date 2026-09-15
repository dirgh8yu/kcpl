# KCPL backend capability map for Figma Make

> Design input for the KCPL staff operating system. This document describes what the current backend and server policies actually support so Figma Make can design the interface around real capability instead of inventing product behavior.

**Repository:** `dirgh8yu/kcpl`  
**Initial source snapshot:** `main` at `fbbe208e35255d59490f542117d0682a63c9830a` on 15 September 2026  
**Functional authority:** current server code, data types, permissions and workflow policies in the repository  
**Visual authority:** `docs/UI_UX_DESIGN_GUIDE.md`, `docs/OPERATING_SYSTEM.md`, `docs/BRAND_SYSTEM.md` and approved Figma design work

This file is a design bridge. It does not replace server authorization, Firestore rules, API validation or workflow policy. If this document and current code disagree, the current code wins and this document should be updated.

---

## 1. Instructions for Figma Make

Before designing a KCPL staff screen, use this order of authority:

1. **Backend truth:** this capability map plus the current route, server module, API route, data type and policy for the workspace.
2. **Operating-system rules:** `AGENTS.md`, `docs/UI_UX_DESIGN_GUIDE.md` and `docs/OPERATING_SYSTEM.md`.
3. **KCPL identity:** `docs/BRAND_SYSTEM.md`.
4. **Existing UI:** evidence of current behavior only. It is not proof that the layout, hierarchy or interaction model is good.

### Never invent

Do not invent any of the following to make a mockup look complete:

- Firestore fields or collections
- workflow states or status labels
- permissions or branch access
- backend mutations
- integrations or provider health
- tracking events, GPS positions or ETAs
- document verification or Customs release
- successful pickup, tender, booking, delivery, payment or closeout states
- unread notification counts
- commercial or financial values
- automation that marks business work complete

If the backend does not support an action, omit it or design an explicit unavailable/dependency state.

### Design objective

Design the staff product as professional B2B logistics operating software. The application should make the current record, state, blocker, owner and next permitted action immediately understandable.

Use:

- Inter for interface typography
- KCPL crimson, black and neutral semantic tokens
- consistent Lucide-style outline icons
- quiet working surfaces and readable density
- register-first workspaces
- contextual inspectors for quick record work
- full routes for complex records
- visible loading, refreshing, empty, no-results, error, partial-data, permission-denied and integration-unavailable states
- explicit action hierarchy
- responsive and keyboard-accessible interaction

Do not convert operational screens into decorative dashboards. Summary metrics should filter or explain the working register, not push records below a wall of cards.

---

## 2. System-wide authority and access model

### Staff roles

The server recognizes four roles:

| Role | Main capabilities |
| --- | --- |
| Management | All listed staff capabilities, management analytics, staff administration, commercial overrides, finance and recovery authority |
| Accounts | Commercial visibility/editing, credit, customer documents, customer editing, job costs, Job Files and finance |
| Commercial | Commercial visibility/editing, rate-card management, customer editing, job costs and Job Files |
| Operations | Customer documents, customer editing and Job Files |

The detailed capability flags are:

- `canViewCommercial`
- `canEditCommercial`
- `canOverrideCommercialPolicy`
- `canOverrideFx`
- `canManageRateCards`
- `canManageCredit`
- `canManageCustomerDocuments`
- `canEditCustomer`
- `canArchiveCustomer`
- `canManageStaff`
- `canManageJobCosts`
- `canManageJobFile`
- `canManageFinance`

`staff_profiles` in Firestore is the normal role/branch source of truth. Environment email lists are bootstrap/recovery fallback. An authorized user without a resolved elevated role falls back to the least-privileged Operations role.

### Branch scope

Branch access is enforced server-side and must never be inferred from what a dropdown happens to show.

Configured branches:

- Kathmandu
- Birgunj
- Surkhet
- Nepalgunj
- Raxaul
- Kolkata

A staff profile can have all-branch access or a selected branch set. Records and child work items can have branch-specific authorization.

### Supported currencies

- NPR
- USD
- AUD
- INR
- CNY
- EUR
- GBP
- SGD
- AED
- JPY

Financial reporting keeps currencies separate. Do not design a fake blended grand total unless a real conversion policy is explicitly supplied by the backend.

### Canonical shipment states

| Backend value | UI label |
| --- | --- |
| `booking_confirmed` | Booking confirmed |
| `preparing` | Preparing cargo |
| `in_transit` | In transit |
| `customs_clearance` | Customs clearance |
| `out_for_delivery` | Out for delivery |
| `delivered` | Delivered |
| `exception` | Attention required |

Shipment transitions and closeout gates remain server-authoritative.

### High-level execution chain

The implemented execution spine is:

`Transport Order -> Tender -> Carrier response -> Booking -> Pickup -> Shipment -> Digital Job File`

The Digital Job File then anchors execution evidence across tasks, Customs, freight documents, visibility, delivery/POD, exceptions and job economics.

Do not flatten this chain into one optimistic progress control. Procurement acceptance, booking, pickup, Customs release, POD verification and Job File closeout are distinct authorities.

---

## 3. Navigation and workspace inventory

The sole navigation registry is `app/admin/workflow-navigation.ts`.

### Operate

| Workspace | Route | Access |
| --- | --- | --- |
| Overview | `/admin/command-centre` | Authenticated staff |
| Shipments | `/admin/shipments` | Job File access |
| Pickup Scheduling | `/admin/pickups` | Job File access |
| Freight Documents | `/admin/freight-documents` | Job File access |
| Live Visibility | `/admin/visibility` | Job File access |
| Customs | `/admin/customs` | Job File access |
| Documents | `/admin/documents` | Job File access |
| Delivery & POD | `/admin/delivery` | Job File access |
| Tasks & Alerts | `/admin/alerts` | Authenticated staff, server-scoped |
| Notifications | `/admin/notifications` | Authenticated staff |

### Plan & Sell

| Workspace | Route | Access |
| --- | --- | --- |
| Enquiries | `/admin/enquiries` | Authenticated staff; commercial fields gated |
| Customers | `/admin/crm` | Authenticated staff; sensitive values gated |
| Market Estimate | `/admin/market-estimate` | Commercial visibility |
| Orders & Rate Desk | `/admin/rating` | Commercial visibility |
| Pricing Desk | `/admin/pricing` | Commercial visibility |
| Load Planner | `/admin/consolidation` | Commercial visibility |
| Tender & Booking | `/admin/tenders` | Commercial visibility |

### Network

| Workspace | Route | Access |
| --- | --- | --- |
| Partners & Vendors | `/admin/partners` | Authenticated staff; edit/finance fields gated |
| Carrier Integrations | `/admin/carrier-integrations` | Job File access |
| EDI Gateway | `/admin/edi` | Job File access; outbound tender action additionally gated |

### Finance

| Workspace | Route | Access |
| --- | --- | --- |
| Receivables | `/admin/finance` | Management or Accounts |
| Payables | `/admin/payables` | Management or Accounts |
| Freight Audit & Match-Pay | `/admin/freight-audit` | Management or Accounts |
| Supplier Reconciliation | `/admin/partners/reconciliation` | Management or Accounts |

### Organisation

| Workspace | Route | Access |
| --- | --- | --- |
| Management | `/admin/management` | Management only |
| Migration Hub | `/admin/migration` | Management only |
| Paper Archive | `/admin/migration/archive` | Management only |
| Migration Recovery | `/admin/migration/recovery` | Management plus finance authority |
| People & Branches | `/admin/staff` | Staff-management authority, currently Management |

---

## 4. Core record: Digital Job File

**Primary routes:** `/admin/jobs/:reference` and related job subroutes  
**Permission:** `canManageJobFile` plus server-side branch access  
**Primary sources:** `app/admin/job-file.ts`, `app/admin/job-file.server.ts`, `app/api/admin/jobs/[reference]/route.ts`, `app/admin/workflow-guard.server.ts`

### Data available

A Digital Job File can contain:

- shipment and quote references
- linked CRM customer
- shipment state
- origin, destination and mode
- ETA and current location
- carrier and carrier reference
- primary and handling branches
- assigned staff identity and contact details
- priority: Standard, High or Urgent
- internal reference and internal notes
- operational tasks
- Customs checklist steps
- job costs
- revenue, cost, profit and margin totals by currency when permitted
- workflow readiness and closeout blockers
- audit/activity history in the job experience

### Real Job File actions

The authenticated Job File API supports:

- update primary/handling branches within policy
- assign operational owner
- update priority
- update internal reference and notes
- add a task
- complete/reopen a task through its toggle action
- add a Customs step
- complete/reopen a Customs step through its toggle action
- add job cost when `canManageJobCosts`
- request Job File closeout through workflow guard
- reopen a closed Job File under the server's reopening policy

Closeout can return blockers. A UI must present those blockers rather than pretending the shipment was closed. Management override/reopening paths require reasons where policy requires them.

### Design implication

The Job File is the authoritative execution detail experience. It should expose identity, current state, owner, blockers and next action first, then organize movement, tasks, Customs, documents, delivery/POD, exceptions, economics and audit/history into clear sections. Quick registers should link back with return context.

---

# 5. Operate workspaces

## 5.1 Overview

**Route:** `/admin/command-centre`  
**Purpose:** operational snapshot, attention queue and workflow handoffs

### Real capability

- active shipment counts and operational status summary
- attention-required queue using shared shipment priority/next-action policy
- active shipment register
- critical operational alerts
- recent/new enquiry context when available
- navigation into Shipments, Alerts, Job Files and Enquiries
- manual page refresh of the data snapshot

Overview is active-work focused. It should not imply that rendering the page runs network-wide workflow mutations or marks anything complete.

### Recommended UI architecture

Compact page header -> useful KPI strip -> Attention Required -> Active Shipments -> right-side/secondary alerts and enquiry context. Use real empty/unavailable states when a data source cannot load.

---

## 5.2 Shipments

**Route:** `/admin/shipments`  
**Permission:** `canManageJobFile`  
**Purpose:** shipment register and entry to Digital Job Files

### Real capability

- active and delivered shipment records
- search/filter/sort over real shipment data
- branch, mode, status and attention-oriented views where implemented
- shared priority ordering for exception, overdue, Customs, ownership and urgent work
- open Digital Job File while preserving return context
- shipment status, route, customer, owner, ETA/update context

The shipment register must not advertise a create action unless a real permitted creation path exists in current code.

### Design implication

This should be a dense, calm operational register. Record ID/customer/route/state/owner/timing and next action matter more than decorative cards.

---

## 5.3 Pickup Scheduling

**Route:** `/admin/pickups`  
**Permission:** `canManageJobFile`

### Real workflow

Booked execution can move through pickup control:

1. request a pickup/collection window
2. record shipper/vendor contact and location
3. record carrier/vendor appointment confirmation and provider reference
4. assign driver, phone and vehicle details
5. mark cargo picked up
6. feed the `picked_up` milestone into Live Visibility
7. represent a missed pickup as an operational/carrier exception

### UI requirements

- queue of booked shipments requiring pickup work
- search/filter by shipment/customer/carrier/route/driver and actual backend states
- selected shipment control surface or inspector
- clear differentiation among unscheduled/requested/confirmed/missed/picked-up states exposed by the backend
- honest empty state when no booked movements require pickup
- handoff to Live Visibility and Job File

---

## 5.4 Freight Documents

**Route:** `/admin/freight-documents`  
**Permission:** `canManageJobFile`  
**Purpose:** generate controlled KCPL carriage/execution drafts from a Job File

### Queue capability

- eligible Job Files
- filter All / Missing carriage document / Generated / Awaiting review
- search by shipment, booking, customer, route, carrier and cargo context
- summary: eligible, missing primary, current generated, review pending

### Production capability

The production editor supports real controlled fields including:

- document type from recommended/supported types
- house/internal reference
- shipper
- consignee
- notify party
- cargo description
- marks and numbers
- package type
- freight terms
- place of receipt
- place of delivery
- carrier/master reference
- Incoterm
- special instructions
- customer-safe flag

### Revision/evidence capability

- generate PDF through the authenticated API
- current and superseded revision history
- review status
- filename and SHA fingerprint
- open generated PDF
- send generated result into Document Vault review workflow
- open related Job File

KCPL-generated PDFs are controlled internal/house drafts and must not impersonate carrier-issued master originals.

---

## 5.5 Live Visibility

**Route:** `/admin/visibility`  
**Permission:** `canManageJobFile`  
**Purpose:** normalized movement visibility across carrier/integration/manual sources

### Tracking sources

- manual
- carrier API
- webhook
- EDI 214
- GPS
- counterpart

### Normalized milestones

- Booking confirmed
- Pickup scheduled
- Picked up
- Origin terminal
- Export Customs
- Departed
- Transshipment
- Arrived destination
- Import Customs
- Out for delivery
- Delivery attempted
- Delivered
- Delivery refused
- Tracking exception
- Unknown/general tracking update

### Real capability

- register of accessible shipment feeds
- filters for all active, ETA delayed, stale feeds, Customs and out for delivery
- summary for active, delayed, stale, Customs, out for delivery and delivered today
- search by shipment/customer/route/carrier/location/provider/milestone
- inspect latest position
- inspect normalized event timeline
- open Job File
- record manual fallback event when no live provider integration exists
- refresh current visibility data
- Management-only health sweep for stale-feed exceptions
- links into EDI and Carrier Integrations

Do not fabricate a live feed. A missing/stale provider must look missing/stale.

---

## 5.6 Customs

**Route:** `/admin/customs`  
**Permission:** `canManageJobFile`

### Clearance states

- `not_started`
- `preparing`
- `lodged`
- `held`
- `released`

### Desk states

- Blocked
- In progress
- Awaiting release
- Checklist ready
- Customs released

### Risk levels

- Critical
- Warning
- Normal

### Real capability

- branch-aware Customs work queue
- search by shipment, customer, declaration, Customs/border point, agent or warning
- branch, risk and desk-state filters
- required checklist progress
- required document readiness
- integrity warnings
- complete required Customs steps through Job File authority
- edit explicit clearance record through the Customs editor
- select a registered Customs/clearing partner where available
- record entry/border point, declaration reference, hold reason and release evidence under validation rules

### Important policy

Checklist completion is not Customs release.

For import, export and cross-trade movements the system can require explicit release. A `held` state requires a meaningful hold reason. A `released` state requires a Customs/border point and either a declaration/reference or release-evidence note.

The UI must make the distinction between "checklist ready" and "released" impossible to miss.

---

## 5.7 Documents / Document Vault

**Route:** `/admin/documents`  
**Permission:** `canManageJobFile`

### Document lifecycle visible to UI

- received
- under review
- verified
- rejected
- expired
- superseded
- deleted/tombstoned history

### Real capability

- search by shipment, customer, filename, reviewer, uploader or hash
- filter by effective status, document type and branch
- summary for active, verified, review queue, rejected, expired and history
- inspect document identity, shipment link, receipt/review metadata and control state
- review/update status under role policy
- set customer-safe flag
- add review note
- set expiry date
- delete/tombstone where document policy permits
- preserve metadata/audit history after tombstone
- surface storage-cleanup-pending state if applicable
- open Job File/customer context through real links

Only verified/current evidence should satisfy readiness where downstream workflow policy requires verification.

---

## 5.8 Delivery & POD

**Route:** `/admin/delivery`  
**Permission:** `canManageJobFile`

### Queue states exposed by current delivery model

- ready for delivery
- delivery active
- delivery failed/refused
- delivered with POD pending
- POD verified

### Real capability

- final-mile register
- search/filter final-mile work
- latest attempt and scheduled next delivery context
- recipient context
- POD evidence count/state
- open the authoritative delivery/POD control in the Job File

### Canonical workflow

1. record final-mile attempt
2. capture failed/refused delivery when applicable
3. capture recipient and POD evidence
4. verify POD
5. allow canonical shipment completion only when server workflow gates are satisfied

A carrier status saying "Delivered" must not bypass Customs, POD, exception or closeout policy.

---

## 5.9 Tasks & Alerts

**Route:** `/admin/alerts`  
**Access:** authenticated staff, server-scoped

### Alert states

- open
- acknowledged
- resolved

### Severities

- critical
- warning
- info

### Real capability

- search/filter alert ledger
- active/open/critical/warning/acknowledged/resolved views
- explicit automation evaluation/check action
- acknowledge an alert
- resolve an alert
- navigate to the affected operational record

### Meaning

Acknowledged means reviewed, not fixed. Resolved means the user has marked the alert resolved, but if the underlying condition remains, a later automation evaluation can reopen it.

Do not design acknowledgement as completion of the actual shipment/finance/Customs task.

---

## 5.10 Notifications

**Route:** `/admin/notifications`  
**Access:** authenticated staff

### Real capability

- retained notification history
- automatic refresh every 30 seconds and refresh on window focus
- search by signal/reference/branch/detail
- category filter
- severity filter
- unread/read/resolved filter
- mark one notification read when opened
- mark all read
- navigate to real `action_path` destination when present
- show whether email channel is configured or in-app channel is active

Unread counts must come from backend data. Do not draw a permanent unread dot as decoration.

---

# 6. Plan & Sell workspaces

## 6.1 Enquiries

**Route:** `/admin/enquiries`  
**Access:** authenticated staff; commercial data/actions gated

### Quote workflow states

- New
- Reviewing
- Quoted
- Won
- Lost

### Real capability

- enquiry/quote register with search and state filters
- quote detail
- Overview, Pricing, Shipment and Activity contexts, with Pricing only when commercial data may be viewed
- assign staff
- update permitted workflow status
- link an existing CRM customer
- create a CRM customer from the enquiry when policy allows
- handle CRM match/suggestion cases instead of blindly duplicating a customer
- notes and customer communication history/actions exposed by the enquiry detail
- linked shipment context

A quote cannot be marked Won without the required CRM customer relationship. Commercial values and editing must not leak to roles lacking commercial permissions.

---

## 6.2 Customers / Customer 360

**Route:** `/admin/crm` and customer detail routes  
**Access:** authenticated staff with field/action restrictions

### CRM vocab

**Entity kind:** Company, Individual

**Relationship types:** Customer, Supplier, Carrier, Overseas agent, Customs agent, Partner, Other

**Account states:** Prospect, Active, Dormant, On hold, Blacklisted

**Lead stages:** New lead, Contacted, Qualified, Quote requested, Quote sent, Negotiating, Won, Lost

**Lead sources:** Referral, Website, Existing customer, Walk in, Agent, Staff referral, Social media, Other

**Communication preferences:** Phone, Email, WhatsApp, WeChat, Viber, Other

### Customer 360 data

- legal/trading identity
- website, industry, tax and billing data
- account manager and primary branch
- contacts and addresses
- tags and transport preferences
- internal summary
- notes and activity history
- CRM tasks/follow-ups
- quote counts
- active/completed shipment counts
- commercial profile
- revenue/cost/profit totals when permitted

### Commercial profile

Can include preferred currency, payment terms, credit limit, outstanding balance, pricing notes, markup and preferred carriers.

### Permissions that matter to UI

- all four roles can edit customer records under current capability mapping
- Management can archive a customer
- Management and Accounts can manage credit
- Management, Accounts and Operations can manage customer documents
- commercial/financial values must remain masked or omitted for unauthorized roles

---

## 6.3 Market Estimate

**Route:** `/admin/market-estimate`  
**Permission:** commercial visibility

### Real reference sources

- freight benchmark adapter
- Nepal Rastra Bank forex reference
- Google Routes and Places when configured
- SendGrid quote email capability when configured

### Policy

Market Estimate is advisory. Reference data must not automatically overwrite a customer quote.

The UI should show provider/setup state explicitly so an unavailable integration never looks like an empty but healthy result.

Related handoffs: Rate Desk, Pricing Desk and Load Planner.

---

## 6.4 Orders & Rate Desk

**Route:** `/admin/rating`  
**Permission:** commercial visibility

### Transport order states

- Draft
- Rated
- Rate selected
- Tendering
- Booked
- Cancelled

### Create Transport Order capability

Current order creation accepts:

- branch
- mode
- origin
- destination
- pickup date
- weight in kg
- volume in CBM
- pieces
- container count
- equipment

### Register capability

- search order/customer/route
- filter by active/state, branch and mode
- inspect next procurement action
- open order
- continue to Rate Desk

### Rate Desk capability

- load Partner buy-rate cards
- compare compatible procurement rates to transport orders
- select procurement cost/rate before tendering
- manage rate cards only with `canManageRateCards` (Management or Commercial)
- scope global rate-card actions according to server branch/management policy

Creating a planning order, rating it, selecting procurement, tendering and booking are separate steps.

---

## 6.5 Pricing Desk

**Route:** `/admin/pricing`  
**Permission:** commercial visibility

### Real capability

- load transport orders ready for sell pricing
- load linked customer pricing profile
- resolve pricing rules
- calculate governed sell price
- use same-currency FX or derive NRB midpoint cross-rate
- allow manual FX entry where supported
- apply markup, target/minimum margin, approval threshold, accessorials, fixed markup and discount
- require Management approval when pricing policy says approval is needed
- create customer quote from approved/cleared pricing snapshot
- manage pricing rules for roles with rate-card management capability

### Pricing inputs exposed by current workspace

- sell currency
- FX rate
- markup %
- target margin %
- minimum margin %
- approval-below-margin %
- accessorial cost
- accessorial markup %
- fixed markup
- discount
- quote valid-until date
- customer note

Do not hide margin approval. Do not merge buy cost and customer sell price into one uncontrolled field.

---

## 6.6 Load Planner

**Route:** `/admin/consolidation`  
**Permission:** commercial visibility

### Real capability

- load consolidation loads and transport orders
- plan/manage consolidation loads
- allocate orders to loads through the allocation desk
- represent capacity/stops/master/house planning relationships supported by the existing module
- preparation/editing under `canEditCommercial`
- approval under Management authority

Preparation and approval are distinct. A visual drag/drop plan must not imply an approved allocation unless the server confirms it.

---

## 6.7 Tender & Booking

**Route:** `/admin/tenders`  
**Permission:** commercial visibility

### Tender channels

- manual
- email
- EDI 204

### Tender states

- Sent
- Accepted
- Rejected
- Counter-offer
- Expired
- Cancelled
- Booked

### Real capability

- load orders, tenders and customer context
- reconcile expired tenders
- create/manage tendering under commercial edit authority
- record/consume carrier response states under current server policy
- confirm booking through server authority
- maintain authoritative relationship among tender, order, booking reference and shipment
- show booked-register view with booking, order, route, customer, partner and shipment lineage
- hand off to Pickup Scheduling and Shipments

Current server policy treats Accepted and Counter-offer as bookable states. UI must follow the current policy unless backend policy is changed separately.

Do not visually combine carrier response, booking confirmation and shipment creation into one optimistic action.

---

# 7. Network workspaces

## 7.1 Partners & Vendors

**Route:** `/admin/partners`  
**Access:** authenticated staff with edit/commercial/finance restrictions

### Real capability

- Partner registry for carriers, agents, vendors and global counterparts
- Partner 360 navigation
- search/filter/detail through current workspace
- edit network records under `canEditPartnerNetwork`
- global-edit scope only when policy grants it
- commercial/pricing information only for commercial viewers
- financial information only where Partner finance policy permits
- feed Partner choices into Customs agents, supplier bills, buy rates and integrations
- finance users can hand off to Supplier Reconciliation

Partner identity is reused across operational and financial modules. Do not design separate duplicate supplier/carrier masters when the Partner registry is authoritative for that workflow.

---

## 7.2 Carrier Integrations

**Route:** `/admin/carrier-integrations`  
**Permission:** `canManageJobFile`

### Real capability

- provider integration dashboard
- provider health/status
- shipment-provider sync rows
- live carrier API / DCSA webhook integration context
- integration summary
- conditional commercial information when permitted
- handoffs to Live Visibility, Partners and EDI

An integration or backing store can be unavailable. Design provider health/setup/error states explicitly rather than showing fake green status.

---

## 7.3 EDI Gateway

**Route:** `/admin/edi`  
**Permission:** `canManageJobFile`; queuing outbound 204 additionally requires commercial edit authority

### EDI capability

- X12 204 load tender queueing
- X12 990 carrier responses
- X12 214 tracking events
- transaction history/quarantine
- configured/unconfigured gateway state
- eligible tender selection

A tender is eligible for current 204 queue UI when it is `sent` and channel is `manual` or `edi_204`.

Related workspaces: Tender Desk, Live Visibility and Carrier Integrations.

Do not show a transaction as externally sent merely because a button was clicked. Queue/provider failure must stay visible.

---

# 8. Finance workspaces

## 8.1 Receivables

**Route:** `/admin/finance`  
**Permission:** `canManageFinance` (Management or Accounts)

### Real capability

- customer invoice ledger
- collections and aging context
- imported opening balances clearly separated from invoiced revenue
- multi-currency summaries without fake currency blending
- search/filter receivables
- create invoice draft
- open invoice detail route

### New invoice draft fields

- optional shipment reference
- customer reference when not resolved from shipment
- issue date
- due date
- currency
- amount before tax
- tax rate
- description
- notes

A shipment-linked invoice resolves the customer from the shipment. Backend may return a resolution path instead of silently accepting inconsistent lineage.

Visible invoice states include Draft, Issued, Partially paid, Paid and Overdue according to current finance model/UI.

---

## 8.2 Payables

**Route:** `/admin/payables`  
**Permission:** `canManageFinance`

### Real capability

- supplier bill ledger
- payment aging
- opening payable balances separated from operational job spend
- search/filter payables
- create supplier bill
- open bill detail route

### New supplier bill fields

- optional shipment reference
- registered Partner or unregistered supplier
- supplier name
- supplier bill reference
- KCPL branch
- bill date
- due date
- cost category
- currency
- amount before tax
- tax rate
- description
- notes

Partner selection can default currency/payment terms. Shipment-linked bills inherit shipment branch. Duplicate supplier bill references are guarded.

Real supplier bills can feed Job File cost. Migration opening balances remain ledger-only.

Visible payable states include Draft, Approved, Partially paid, Paid and Overdue according to current payable model/UI.

---

## 8.3 Freight Audit & Match-Pay

**Route:** `/admin/freight-audit`  
**Permission:** `canManageFinance`

### Real capability

- freight-audit queue and summary
- search/focus input
- compare booked procurement against supplier invoice/payable evidence
- surface variance/overcharge exceptions before payment
- Management flag enables higher-authority actions defined by the current workspace/server policy

Design this as evidence-based audit work. Do not invent automatic payment approval or settlement when the server has not authorized it.

---

## 8.4 Supplier Reconciliation

**Route:** `/admin/partners/reconciliation`  
**Permission:** Management or Accounts

### Real capability

- load legacy supplier/payable reconciliation snapshot
- identify supplier records that need linking to canonical Partner identities
- relink eligible legacy supplier bills according to server policy
- retain linkage/audit evidence
- explicit forbidden/unavailable/error states when authority or stores are missing

This is remediation of legacy identity linkage, not creation of a parallel supplier master.

---

# 9. Organisation workspaces

## 9.1 Management

**Route:** `/admin/management`  
**Permission:** Management only

### Time filters

- Today
- 7 days
- Month
- Quarter
- Year
- All time
- custom From/To dates

### Real capability and analytics

- export CSV
- active shipments
- delivered in period
- quote win rate / decision rate
- urgent and exception counts
- Customs blocked shipments
- unassigned shipments
- loss-making jobs
- reporting/data-quality issues
- revenue, recognized job cost, gross profit and margin by currency
- current open receivables/payables by currency
- monthly revenue/cost/profit trends by currency
- branch performance
- customer revenue concentration
- customer profitability
- route economics
- loss-making Job File links
- staff workload, open/overdue tasks and urgent jobs
- runtime-readiness information

Currencies are deliberately not blended into a fake grand total.

---

## 9.2 Migration Hub

**Route:** `/admin/migration`  
**Permission:** Management only

### Implemented staged migration chain

1. Stage 1: Customer master
2. Stage 2: Shipment history
3. Stage 3A: Receivables opening
4. Stage 3B: Payables opening
5. Stage 4A: Batch history/control
6. Stage 4B: Paper Archive
7. Stage 4C: Recovery

### Real capability

- downloadable customer/shipment/receivable/payable templates
- controlled CSV/file intake through dedicated import panels
- preview/validation before import
- batch evidence/history
- duplicate/invalid-row reporting
- Paper Archive handoff
- Recovery handoff

### Current customer import constraints shown by UI

- CSV only
- maximum 250 customer rows
- maximum 2 MB
- required `display_name` and `primary_branch`
- branch must match KCPL branch vocabulary
- duplicate checks include name/email/phone/tax identity signals
- invalid and possible-duplicate rows are not imported automatically
- every confirmed import receives a migration batch ID

Never design a one-click blind bulk import.

---

## 9.3 Paper Archive

**Route:** `/admin/migration/archive`  
**Permission:** Management only

### Purpose

Historical paper evidence, scans and metadata linked to digital records where available.

The archive is evidence, not the active workflow record. Design should emphasize source provenance, metadata, integrity and links to current digital records without suggesting archived paper edits mutate live operational state.

---

## 9.4 Migration Recovery

**Route:** `/admin/migration/recovery`  
**Permission:** Management plus finance authority

### Safety model exposed by current UI/server

- batch-scoped recovery
- dry-run first
- no force-delete mode
- recovery plan expires after 15 minutes
- plan binds to the authorized Management user
- exact confirmation phrase required
- records are rechecked immediately before reversal
- rollback is refused when imported records have been edited, used, paid, progressed or otherwise gained post-migration business history
- Paper Archive evidence is preserved
- permanent recovery evidence remains visible

Design destructive/recovery actions with very explicit scope and blockers. Never make this look like ordinary CRUD delete.

---

## 9.5 People & Branches

**Route:** `/admin/staff`  
**Permission:** `canManageStaff`, currently Management

### Authority split

Firebase Authentication owns credentials. The KCPL staff directory controls application role and branch scope after sign-in. Editing this screen does not change a password.

### Real capability

- list staff profiles
- search/filter by name, email, role or branch
- add/update a staff profile for an existing Firebase Auth email
- display name
- job title
- phone
- role
- branch access: All branches or selected branches
- active/suspended account state

Design role/branch changes as access-control changes, not ordinary profile decoration.

---

# 10. Shared product states Figma must design

Every significant workspace should have appropriate variants for the states below. Do not use one generic empty card for all of them.

| State | Required meaning |
| --- | --- |
| Initial loading | Preserve page anatomy and indicate the relevant region is loading. Do not flash false zero counts. |
| Refreshing | Keep safe existing data visible while making refresh activity clear. |
| Empty dataset | Explain what legitimately belongs in the workspace and the real next action, if any. |
| No search/filter results | Preserve query/filter context and offer reset. |
| Data unavailable | Explain which backend/store/integration is unavailable. Navigation may remain usable. |
| Partial snapshot | State the available scope/limit rather than implying completeness. |
| Permission denied | Explain the required capability without offering a fake active control. |
| Integration setup missing | Show dependency/setup state, not an empty healthy feed. |
| Saving/pending | Prevent duplicate action and retain entered values on failure. |
| Validation error | Place the error near the affected field/action and preserve the draft. |
| Success | Confirm the specific server-confirmed result. |
| Conflict/blocker | Show the authoritative blocker and the permissible resolution path. |
| Closed/history state | Keep audit evidence visible without making historical records look active. |

---

# 11. Cross-workspace relationships to preserve

Figma should design the system as connected workflows, not independent pages.

### Commercial to execution

`Enquiry -> CRM Customer -> Transport Order -> Buy Rate -> Sell Pricing -> Tender -> Booking -> Pickup -> Shipment / Job File`

Not every enquiry must traverse every screen in a single linear wizard. Preserve each server authority while making handoffs obvious.

### Execution control

`Job File -> Tasks + Customs + Freight Documents + Document Vault + Live Visibility + Delivery/POD + Exceptions`

The Job File is the detail anchor. Workspace queues are operational views over related truth.

### Network

`Partner Registry -> Buy Rates / Tender recipient / Customs agent / Supplier Bill / Carrier Integration / EDI`

Use the canonical Partner identity where the backend does.

### Finance

`Shipment / Customer / Partner -> Receivable or Payable -> Freight Audit -> Management analytics`

Opening balances are migration ledger records and must remain visually distinguishable from operational invoices/bills and historical revenue/cost.

### Management and migration

Management analytics read business truth. Migration creates controlled historical/master records through staged imports. Recovery is conservative and evidence-preserving.

---

# 12. Design and implementation constraints

If Figma Make eventually generates code or a handoff to a coding agent, preserve these repository contracts:

- one `OperationsShell`
- one navigation registry: `app/admin/workflow-navigation.ts`
- shared primitives in `app/admin/operations-ui.tsx`
- canonical staff design rules in `app/admin/operations-system.css`
- Inter through the existing typography path
- `useWorkspaceQuery` for shareable register filters/selection/return state where applicable
- shipment queue/next-action display policy from `app/admin/shipments/shipment-queue-policy.ts`
- server-side authorization and branch checks
- current workflow guards for closeout, Customs, delivery/POD, tendering, pricing and finance

Do not create a second design system, duplicated navigation list, fake API, local-only business policy, placeholder success state or insecure client-side permission substitute.

---

# 13. Primary source index

This is the first set of code Figma/coding agents should inspect when a design question needs more precision.

### System

- `AGENTS.md`
- `docs/UI_UX_DESIGN_GUIDE.md`
- `docs/OPERATING_SYSTEM.md`
- `docs/BRAND_SYSTEM.md`
- `app/admin/workflow-navigation.ts`
- `app/admin/staff-permissions.ts`
- `app/admin/staff-directory.server.ts`
- `app/admin/operations-shell.tsx`
- `app/admin/operations-ui.tsx`
- `app/admin/operations-system.css`
- `app/shipment-types.ts`
- `app/admin/workflow-guard.server.ts`

### Execution

- `app/admin/job-file.ts`
- `app/admin/job-file.server.ts`
- `app/api/admin/jobs/[reference]/route.ts`
- `app/admin/jobs/[reference]/`
- `app/admin/shipments/`
- `app/admin/pickups/`
- `app/admin/freight-documents/`
- `app/admin/visibility/`
- `app/admin/customs/`
- `app/admin/documents/`
- `app/admin/delivery/`
- `app/admin/alerts/`
- `app/admin/notifications/`

### Commercial and CRM

- `app/admin/admin-dashboard.tsx`
- `app/admin/admin-data.ts`
- `app/admin/admin-data.server.ts`
- `app/admin/crm/`
- `app/admin/market-estimate/`
- `app/admin/rating/`
- `app/admin/pricing/`
- `app/admin/consolidation/`
- `app/admin/tenders/`

### Network

- `app/admin/partners/`
- `app/admin/carrier-integrations/`
- `app/admin/edi/`

### Finance

- `app/admin/finance/`
- `app/admin/payables/`
- `app/admin/freight-audit/`
- `app/admin/partners/reconciliation/`

### Organisation

- `app/admin/management/`
- `app/admin/migration/`
- `app/admin/staff/`

---

# 14. Copy-paste master prompt for Figma Make

Attach this file together with `docs/UI_UX_DESIGN_GUIDE.md`, `docs/OPERATING_SYSTEM.md` and `docs/BRAND_SYSTEM.md`, then use the prompt below.

> Design the complete KCPL staff operating system from the backend capability map I attached.
>
> Treat `FIGMA_BACKEND_CAPABILITIES.md` and the current backend/server policies as the functional source of truth. Treat the current admin UI only as evidence of behavior, not as the visual source of truth.
>
> Establish the UI/UX for every real capability described in the map. Do not invent backend fields, states, permissions, integrations, mutations, provider data, workflow completion or success responses.
>
> Design one coherent application system across Overview, Shipments, Digital Job Files, Pickup Scheduling, Freight Documents, Live Visibility, Customs, Document Vault, Delivery & POD, Tasks & Alerts, Notifications, Enquiries, Customer 360, Market Estimate, Orders & Rate Desk, Pricing Desk, Load Planner, Tender & Booking, Partners, Carrier Integrations, EDI, Receivables, Payables, Freight Audit, Supplier Reconciliation, Management, Migration, Paper Archive, Recovery and People & Branches.
>
> For each workspace, first identify the primary staff task, the record/state/blocker/owner/next action that must be visible first, and the real actions supported by the backend. Then design the most appropriate register, inspector, form, timeline, queue, dialog or detail page. Do not force every module into the same layout.
>
> Use Inter, KCPL crimson/black/neutrals, consistent modern outline icons, quiet surfaces, readable operational density and a clear action hierarchy. Aim for the clarity and polish of Notion, ChatGPT and Uber without copying their brand or layouts.
>
> Registers are the main working surface. Use summary metrics only when they answer an operational question or apply a useful filter. Use contextual inspectors for quick work and full routes for complex records. Preserve relationships and handoffs between modules.
>
> Include designed variants for loading, refreshing, empty dataset, no search results, error, unavailable backend, partial snapshot, permission denied, integration setup missing, pending/saving, validation failure, conflict/blocker and successful server-confirmed action.
>
> Never turn a missing backend capability into a decorative active button. If something is unsupported or unavailable, show the dependency honestly.
>
> Preserve server authority for permissions, branch scope, shipment state, tender/booking, Customs release, document verification, POD, finance, migration recovery and Job File closeout.
>
> Produce a coherent desktop system first, then responsive tablet/mobile behavior. Keep the persistent KCPL application shell, grouped navigation, command search and notification model consistent across screens.

---

## 15. Maintenance rule

When backend capability changes, update this file in the same PR or immediately after the feature lands. Figma should never be asked to design from an old capability map when a newer server contract exists.
