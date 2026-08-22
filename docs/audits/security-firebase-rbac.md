# KCPL Operations System Security, Firebase, Authentication and RBAC Audit

**Audit agent:** Audit Agent 1  
**Repository:** `dirgh8yu/kcpl`  
**Final main baseline checked before report:** `e82fc32fc0cd3981805ddcb8dc003a9f7c5d91c1`  
**Application baseline:** application code was audited from `d0f74ea572f3efea0a454a97a4fd339f12ed7e20`; subsequent commits through `e82fc32` were compared and changed audit documentation only, not application code.  
**Audit mode:** source and repository configuration review only. No production data, production configuration, or application code was changed.  
**Date:** 2026-08-22

## Scope and methodology

This audit focused on authentication, authorization, RBAC, branch isolation, Firestore, Firebase Storage, external secrets, Custom GPT routes, request security, input security, dependency-sensitive code, and security-sensitive server/client boundaries.

The review deliberately did not trust UI hiding or green tests as evidence of authorization. Server routes and the helpers they call were followed as the primary trust boundary because both Firestore and Storage client rules are deny-all and the application performs privileged access through the Firebase Admin SDK.

Severity meanings used here:

- **P0 Critical:** immediate compromise, unauthenticated systemic compromise, or catastrophic data/security failure with a practical path.
- **P1 High:** practical privilege escalation, cross-branch mutation, major trust-boundary failure, or serious financial integrity issue.
- **P2 Medium:** meaningful defense, integrity, abuse, or isolation weakness requiring remediation but with narrower preconditions or impact.
- **P3 Low:** defense-in-depth, information minimization, or availability issue with limited direct impact.

### Finding count

| Severity | Count |
| --- | ---: |
| P0 Critical | 0 |
| P1 High | 5 |
| P2 Medium | 6 |
| P3 Low | 2 |
| **Total** | **13** |

---

# 1. Executive summary

KCPL has several strong security foundations. Firebase client access to Firestore and Storage is denied by rules, Firebase session cookies are verified with revocation checking, session creation requires a recently authenticated Firebase ID token, the admin cookie is `HttpOnly`, `Secure`, and `SameSite=Strict`, and the Custom GPT boundary is intentionally read-only with a dedicated minimum-length secret and timing-safe comparison.

The most serious problems are not basic Firebase exposure. They sit in the application authorization and write-integrity layer above Firebase Admin SDK access.

Five P1 findings require priority attention:

1. `KCPL_ADMIN_EMAILS` can silently convert an existing non-management staff profile into `management` with all-branch access at runtime.
2. `POST /api/admin/edi` accepts an arbitrary tender ID and queues EDI without checking the tender branch against the caller.
3. finance customer-linking code can read or mutate a shipment/customer relationship from another branch before normal invoice branch enforcement occurs.
4. receivable and payable payment recording uses stale reads followed by batches rather than Firestore transactions, allowing concurrent requests to create contradictory ledger and aggregate balances.
5. the same `KCPL_AUTOMATION_SECRET` is accepted by an external pickup integration and the much more privileged internal automation endpoint, collapsing two trust domains into one credential.

There are also medium-severity weaknesses around document state races, POD MIME spoofing, anonymous quote abuse, CSV formula injection, inconsistent webhook secret hardening, and repository branch protection.

No P0 issue was confirmed from source evidence.

---

# 2. P0 findings

**No P0 Critical finding was confirmed.**

No evidence was found of unauthenticated direct Firestore/Storage access, embedded Firebase Admin private keys, an unauthenticated admin-session bypass, or a Custom GPT write primitive.

---

# 3. P1 findings

## SEC-001: Configured admin allowlist overrides authoritative staff role and branch scope

**Severity:** P1 High  
**Confidence:** High

**Affected files**

- `.env.example`
- `app/admin/staff-directory.server.ts`
- `app/admin/staff-permissions.ts`
- downstream consumers of `getStaffContext()`, including CRM, shipments, Job Files, finance, staff administration, and branch-scoped server routes

**Affected endpoints**

Broadly affects authenticated `/admin/*` and `/api/admin/*` surfaces that resolve authorization through `getStaffContext()` and `getStaffCapabilities()`.

**Exact problem**

The configuration contract describes `KCPL_ADMIN_EMAILS` as the `/admin` bootstrap/authorization allowlist while Firestore `staff_profiles` supplies the staff role and branch scope. In `getStaffContext()`, however, an email present in the configured admin list is promoted to a synthetic context with:

- `role: "management"`
- `branch_scope: "all"`
- access to every configured branch

This happens even when an existing Firestore staff profile has a narrower role such as `accounts`, `commercial`, or `operations` and a narrower branch scope.

The no-profile fallback also treats a configured admin as management instead of keeping bootstrap eligibility separate from RBAC role resolution.

**Why it is exploitable or dangerous**

Authorization helpers trust the returned staff context. Management maps to the broadest capabilities and all-branch behavior. This is therefore a server-side privilege escalation, not merely extra navigation in the UI.

Production exploitability depends on the actual contents of `KCPL_ADMIN_EMAILS`, which are not committed to the repository. The defect is still code-evidenced because any allowlisted non-management staff account is deterministically promoted by the current implementation.

**Attack/reproduction scenario**

1. An employee has a valid Firebase account and Firestore profile with role `operations`, branch `Kathmandu`.
2. Their email is also retained in `KCPL_ADMIN_EMAILS` for admin login/bootstrap access.
3. The employee signs in normally.
4. `getStaffContext()` returns management/all-branches rather than the Firestore role/branch.
5. The employee directly calls finance, management, staff, CRM, Job File, or other routes gated by the promoted context.

**Business impact**

Potential full internal privilege escalation across all branches, including financial data/actions, staff administration, commercial data, shipment records, and management-only workflows.

**Evidence from code**

- `.env.example` distinguishes the admin allowlist from Firestore role/branch configuration.
- `app/admin/staff-directory.server.ts` checks configured admin membership while building staff context and replaces narrower role/scope with management/all branches.
- `app/admin/staff-permissions.ts` grants the widest capability set to management.

**Existing test coverage**

`tests/rbac-security.test.mjs` covers permission/policy helpers, but the reviewed coverage does not exercise the integration case of an existing non-management Firestore profile whose email is also in `KCPL_ADMIN_EMAILS`.

**Recommended remediation**

Separate these concepts:

1. eligibility to enter the admin application,
2. one-time bootstrap authority,
3. ongoing staff role and branch authority.

Once a staff profile exists, its role and branch scope should remain authoritative. A bootstrap path should be explicit, narrowly scoped, auditable, and disabled after initial provisioning. If role resolution fails, fail closed rather than inferring management from login allowlist membership.

**Regression tests required:** Yes. Add server/integration tests for every role, narrow branch scopes, all-branch management, configured-admin plus non-management profile, missing profile, disabled profile, and bootstrap lifecycle.

---

## SEC-002: Cross-branch EDI 204 queueing IDOR in admin EDI POST

**Severity:** P1 High  
**Confidence:** High

**Affected files**

- `app/api/admin/edi/route.ts`
- `app/admin/edi/edi-tender.server.ts`

**Affected endpoint**

- `POST /api/admin/edi`

**Exact problem**

The EDI GET path filters tenders using the authenticated staff branch scope. The POST path accepts a caller-supplied `tenderId`, checks authentication, same-origin protection, Job File access, and commercial edit capability, then calls `queueTenderAsEdi204(tenderId, actor)`.

The queue helper loads the tender by ID and validates tender/channel/status/partner conditions, but it does not receive staff context and does not verify that the tender branch belongs to the caller's allowed branch set before writing EDI queue/tender state.

**Why it is exploitable or dangerous**

The UI list can correctly hide another branch's tender while a direct API call still mutates it. This is a classic horizontal authorization failure/IDOR at the server write boundary.

**Attack/reproduction scenario**

1. A Kathmandu commercial user obtains or guesses a Birgunj tender document ID through logs, support information, a copied link, browser history, or another legitimate workflow.
2. They send an otherwise valid same-origin authenticated POST with that `tenderId`.
3. The route passes capability checks because the user is permitted to edit commercial data in their own branch.
4. The server queues the other branch's tender as EDI 204 because no branch ownership check is performed on that object.

**Business impact**

Unauthorized cross-branch tender mutation and creation of outbound EDI work. This can change carrier tender state and create external operational consequences.

**Evidence from code**

- GET in `app/api/admin/edi/route.ts` uses branch filtering.
- POST accepts arbitrary `tenderId` and calls `queueTenderAsEdi204` without staff context.
- `queueTenderAsEdi204` in `edi-tender.server.ts` reads the tender and writes EDI/tender state without caller branch enforcement.

**Existing test coverage**

`tests/edi-x12.test.mjs` validates EDI/X12 behavior but the reviewed test inventory does not demonstrate a direct API test proving that a commercial user cannot queue another branch's tender.

**Recommended remediation**

Pass the authenticated `StaffContext` into the queue operation and enforce tender branch access before any state mutation or queue creation. Keep authorization next to the object being mutated, not only in the UI/list query.

**Regression tests required:** Yes. Include same-branch allow, cross-branch deny, management/all-branch allow, missing branch fail-closed, and direct API bypass attempts.

---

## SEC-003: Finance customer-linking can cross branch boundaries before invoice authorization

**Severity:** P1 High  
**Confidence:** High

**Affected files**

- `app/api/admin/finance/customer-link/route.ts`
- `app/api/admin/finance/invoices/route.ts`
- `app/admin/finance/finance-linking.server.ts`

**Affected endpoints**

- `POST /api/admin/finance/customer-link`
- `POST /api/admin/finance/invoices`

**Exact problem**

The customer-link route authenticates the caller, requires finance capability, and applies same-origin protection, but the shipment reference supplied by the caller is passed into finance-linking helpers without first enforcing the caller's branch access to that shipment.

The linking helpers can load the referenced shipment, resolve a quote/requested CRM customer, create or find CRM records, and set `shipment.customer_id`. They do not take `StaffContext` and therefore cannot enforce the initiating user's branch scope.

The invoice creation path also calls customer resolution before the later invoice creation path performs its normal branch-aware authorization. Side effects can therefore occur before the eventual invoice operation rejects a cross-branch request.

**Why it is exploitable or dangerous**

A permission check that says an accounts user may link customers is not enough. The server must also authorize the specific shipment/customer object. Here, helper side effects can cross the branch boundary before the branch-aware finance operation is reached.

**Attack/reproduction scenario**

1. A Kathmandu accounts user learns a Birgunj shipment reference.
2. They call the customer-link endpoint directly with that reference.
3. The route passes role/capability checks.
4. The helper reads the other branch's shipment and may resolve/create/link CRM customer data.
5. `shipment.customer_id` can be changed even though the caller should not control that branch.

**Business impact**

Cross-branch relationship tampering, leakage of customer linkage information, incorrect invoicing/customer association, and possible creation of duplicate or misplaced CRM data.

**Evidence from code**

`finance-linking.server.ts` exposes shipment/customer resolution and linking helpers that perform Firestore reads/writes but do not accept staff context. The customer-link route invokes them after role checks but without object-level branch authorization. Invoice creation also invokes resolution before later branch enforcement.

**Existing test coverage**

No reviewed test demonstrates a direct cross-branch denial for these customer-linking helper paths or proves that rejected invoice creation leaves no customer-link side effect.

**Recommended remediation**

Require `StaffContext` in all finance-linking functions that touch a shipment or CRM record. Resolve the shipment first, enforce its branch, and only then perform customer lookup/create/link operations. Prefer side-effect-free resolution followed by an authorized atomic commit.

**Regression tests required:** Yes. Include cross-branch direct calls and a test proving failed invoice authorization cannot mutate `shipment.customer_id` or create/link CRM records.

---

## SEC-004: Receivable and payable payments are vulnerable to concurrent stale-read writes

**Severity:** P1 High  
**Confidence:** High

**Affected files**

- `app/admin/finance/finance.server.ts`
- `app/api/admin/finance/invoices/[reference]/payments/route.ts`
- `app/admin/payables/payables.server.ts`
- `app/api/admin/payables/bills/[reference]/payments/route.ts`

**Affected endpoints**

- invoice payment recording under `/api/admin/finance/invoices/[reference]/payments`
- supplier bill payment recording under `/api/admin/payables/bills/[reference]/payments`

**Exact problem**

Both receivable and payable flows read the current invoice/bill state before the write, validate the payment against that stale balance, calculate next aggregate totals, and then use a Firestore batch to update the aggregate document and create a payment record.

A batch is atomic for the writes it contains, but it does not make a prior read part of an optimistic transaction. There is no transaction re-read or version/update-time precondition protecting the balance invariant.

The payables Freight Audit/payment gate is also evaluated before the payment write rather than inside the same transaction.

**Why it is exploitable or dangerous**

Two concurrent requests can both observe the same balance and both pass validation. Each can create a distinct payment document while the final invoice/bill aggregate is whichever batch update wins last. The payment ledger and aggregate totals can then disagree.

This does not require a malicious user. Browser retries, double-clicks, two accounts staff, webhook retry behavior, or network retry logic can trigger it.

**Attack/reproduction scenario**

1. Invoice balance is 100.
2. Request A and Request B concurrently read balance 100.
3. Each submits/validates a payment of 80.
4. Both create separate payment records for 80.
5. Both write aggregate paid/balance values derived from the same old state.
6. The ledger contains 160 of payments while the invoice aggregate may reflect only 80 paid and 20 outstanding.

The equivalent race exists for payables.

**Business impact**

Financial ledger inconsistency, overpayment/over-receipt risk, incorrect outstanding balances, reconciliation failures, unreliable audit trails, and downstream automation acting on false payment state.

**Evidence from code**

`finance.server.ts` and `payables.server.ts` perform read/validate/calculate first and commit later with `batch`, rather than `runTransaction` or an update-time precondition. Payment records use separate created documents, so concurrent requests can both persist entries.

**Existing test coverage**

The reviewed test suite contains policy tests around related finance/freight-audit behavior but no demonstrated concurrency test that starts two payment writes from the same starting balance and proves the invariant remains correct.

**Recommended remediation**

Use Firestore transactions for payment operations. Re-read the invoice/bill and all payment-gating state inside the transaction, validate the remaining balance there, and write both the immutable payment entry and aggregate state in the same transaction. Add idempotency keys or stable request/payment IDs so retries cannot create duplicate logical payments.

**Regression tests required:** Yes. Add concurrent same-balance tests, duplicate/retry idempotency tests, overpayment tests, and Freight Audit approval state changing during payment.

---

## SEC-005: External pickup integration shares the internal automation super-secret

**Severity:** P1 High  
**Confidence:** High

**Affected files**

- `.env.example`
- `app/api/internal/automation/route.ts`
- `app/api/integrations/pickups/route.ts`

**Affected endpoints**

- `/api/internal/automation`
- `/api/integrations/pickups`

**Exact problem**

The external pickup integration authenticates using the same `KCPL_AUTOMATION_SECRET` that protects the internal automation endpoint.

This means a credential disclosed to, stored by, or used in an external integration is also a credential for the broader internal automation control plane. The two endpoints have different blast radii but no credential isolation.

Both reviewed paths also use direct string equality rather than the timing-safe secret helper used by the Custom GPT boundary.

**Why it is exploitable or dangerous**

The security of the most privileged endpoint becomes equal to the security of every place the shared secret must travel. A pickup provider integration, integration log, support workflow, test environment, or leaked request header can become an internal automation credential.

**Attack/reproduction scenario**

1. The shared pickup bearer secret is exposed through an external integration or its operational environment.
2. An attacker reuses the exact same bearer value against `/api/internal/automation`.
3. The internal endpoint accepts it because the credential is intentionally shared.
4. The attacker gains the broader automation actions available through that endpoint.

**Business impact**

Trust-domain escalation from a narrow external pickup integration into privileged internal automation, potentially affecting operational records, ingestion, and automated actions.

**Evidence from code**

- `.env.example` identifies `KCPL_AUTOMATION_SECRET` as the internal automation shared secret.
- both `app/api/internal/automation/route.ts` and `app/api/integrations/pickups/route.ts` read and accept the same environment variable.

**Existing test coverage**

`tests/pickup-appointments.test.mjs` covers pickup behavior, but no reviewed test establishes credential separation between pickup and internal automation because separation does not exist.

**Recommended remediation**

Use a dedicated pickup-integration secret or, preferably, a provider-specific signed webhook credential. Keep internal scheduler/automation credentials separate and rotate the currently shared value after separation. Centralize minimum entropy and timing-safe validation.

**Regression tests required:** Yes. A pickup credential must be rejected by the internal automation endpoint and vice versa.

---

# 4. P2 findings

## SEC-006: Shipment document state transitions contain TOCTOU races

**Severity:** P2 Medium  
**Confidence:** High

**Affected files**

- `app/api/admin/shipments/[reference]/documents/[id]/route.ts`
- `app/api/admin/shipments/[reference]/documents/route.ts`
- `app/shipment-documents.server.ts`

**Affected endpoints**

Shipment document upload, state transition, supersede, and delete routes under `/api/admin/shipments/[reference]/documents`.

**Exact problem**

Several document invariants are checked using reads that are not coupled transactionally to the subsequent write:

- PATCH reads current state, validates a transition, then later writes without a version precondition.
- DELETE verifies current delete permission and later deletes after another operation can change state.
- duplicate SHA detection occurs before creation while new document IDs are independently generated, so concurrent identical uploads can both pass.
- supersede logic reads old state and later batches replacement state without a transaction protecting the active-version invariant.

**Why it is exploitable or dangerous**

Document verification/evidence state is security-sensitive. A verified record can change between authorization/state validation and mutation. Concurrency can also defeat duplicate and single-active-version assumptions.

**Attack/reproduction scenario**

A delete request validates while a document is still unverified. Another request verifies it. The first request then proceeds using its stale authorization decision. Equivalent concurrent uploads can bypass duplicate-hash detection.

**Business impact**

Evidence/audit inconsistency, duplicate active versions, stale verification decisions, or deletion/superseding of a record under a state that should no longer permit it.

**Evidence from code**

The route and `shipment-documents.server.ts` perform state reads and later writes/batches without a Firestore transaction or update-time precondition spanning the invariant.

**Existing test coverage**

`tests/document-policy.test.mjs` validates policy decisions, but pure policy tests cannot prove transactional safety under concurrent writes.

**Recommended remediation**

Move state re-read, transition/delete authorization, duplicate lock, and active-version invariant into Firestore transactions. Consider deterministic uniqueness/lock documents for content hashes where appropriate.

**Regression tests required:** Yes. Add race tests for verify-vs-delete, concurrent duplicate uploads, concurrent supersede operations, and stale transition requests.

---

## SEC-007: POD evidence accepts claimed MIME type without validating file bytes

**Severity:** P2 Medium  
**Confidence:** High

**Affected files**

- `app/api/admin/jobs/[reference]/delivery/evidence/route.ts`
- `app/admin/delivery/delivery-control.server.ts`
- `app/admin/delivery/delivery-control.ts`

**Affected endpoint**

POD/delivery evidence upload under `/api/admin/jobs/[reference]/delivery/evidence`.

**Exact problem**

POD evidence validation accepts allowed types using the multipart `File.type` value plus size limits. The bytes are stored with the caller-provided content type. The reviewed POD flow does not perform magic-byte/content-signature validation.

The general shipment-document upload flow already contains stronger byte-signature validation, showing that a safer pattern exists in the same codebase.

**Why it is exploitable or dangerous**

`File.type` is client-controlled metadata. An authenticated uploader can submit arbitrary bytes while declaring `application/pdf`, `image/jpeg`, `image/png`, or `image/webp`.

Storage itself remains private, which limits immediate exposure, but spoofed evidence can later reach browsers, parsers, download workflows, or future document-processing automation under a trusted type label.

**Attack/reproduction scenario**

Submit non-PDF bytes in multipart form data with filename `pod.pdf` and content type `application/pdf`. The current POD validation checks the declared type/size rather than confirming PDF magic bytes.

**Business impact**

Weaker evidence integrity and a foothold for dangerous or malformed content in a trusted delivery-evidence workflow.

**Evidence from code**

`uploadPodEvidence`/POD policy uses `file.type` and `file.size`; no equivalent byte-sniffing step to the shipment-document validator is present in the reviewed path.

**Existing test coverage**

`tests/delivery-pod-policy.test.mjs` covers POD policy but does not establish magic-byte validation of uploaded content.

**Recommended remediation**

Reuse the strong shipment-document byte validation pattern. Require declared MIME, extension where used, and detected signature to agree. Add malware/content scanning if these files later enter automated parsing or third-party systems.

**Regression tests required:** Yes. Include MIME-spoofed PDF/images and malformed/truncated file signatures.

---

## SEC-008: Anonymous quote intake has no repository-level consequential abuse controls

**Severity:** P2 Medium  
**Confidence:** High for repository-level absence; production edge controls unknown

**Affected file**

- `app/api/quotes/route.ts`

**Affected endpoint**

- `POST /api/quotes`

**Exact problem**

The public quote endpoint parses caller JSON and can write a quote plus perform CRM/customer/task-related work. It uses same-origin request filtering, but that helper is not authentication or a bot control. Requests that do not provide `Origin` and do not declare a cross-site `Sec-Fetch-Site` can pass the repository-level origin check.

No application-level rate limiter, abuse token/challenge, idempotency key, or explicit request-body byte cap was identified on this endpoint.

**Why it is exploitable or dangerous**

A script is not constrained by browser-origin behavior and can send requests without browser headers. Repeated requests can create operational/database noise and cost. Oversized JSON can also consume server resources before field-level validation.

Firebase App Hosting or another edge layer may impose platform limits/rate controls, but those are not evidenced by this repository and therefore should be verified separately.

**Attack/reproduction scenario**

Automate repeated POSTs using a non-browser HTTP client with browser-origin headers omitted. Each syntactically valid request reaches quote processing and associated database/business logic.

**Business impact**

Quote/task spam, CRM noise, Firestore write cost, operator distraction, and resource pressure.

**Evidence from code**

`app/api/quotes/route.ts` uses `request.json()` and same-origin filtering before business writes, with no visible app-level rate/idempotency/body-size mechanism.

**Existing test coverage**

No reviewed test demonstrates rate limiting, duplicate suppression, or maximum request-body enforcement for anonymous quote intake.

**Recommended remediation**

Add edge/app rate limiting keyed appropriately, strict body-size limits before parsing, abuse detection/challenge where appropriate, and idempotency/duplicate suppression for consequential work creation.

**Regression tests required:** Yes for body limits and duplicate/idempotency semantics. Rate-limit behavior should also be tested at the deployed boundary.

---

## SEC-009: Management CSV export is vulnerable to spreadsheet formula injection

**Severity:** P2 Medium  
**Confidence:** High

**Affected file**

- `app/api/admin/management/export/route.ts`

**Affected endpoint**

- management CSV export route under `/api/admin/management/export`

**Exact problem**

The CSV escaping helper quotes fields and escapes double quotes, but it does not neutralize spreadsheet formula-leading characters such as `=`, `+`, `-`, or `@` and dangerous leading control characters.

Persisted customer/business/user-entered fields are included in exports.

**Why it is exploitable or dangerous**

CSV escaping prevents structural CSV breakage, not formula interpretation. A stored value beginning with a formula marker can be executed/interpreted by Excel or another spreadsheet tool when management opens the exported file.

**Attack/reproduction scenario**

A user-controllable exported field is stored as a value such as `=HYPERLINK("https://example.invalid","Open")`. Management exports the data and opens it in a spreadsheet application that interprets formulas.

**Business impact**

Phishing, spreadsheet-side data exfiltration, or dangerous formula behavior in a high-trust management workflow depending on client spreadsheet protections.

**Evidence from code**

The route's CSV helper handles quoting but does not add formula-injection neutralization before output.

**Existing test coverage**

No reviewed security test checks formula-leading CSV cells.

**Recommended remediation**

Use a CSV export function that explicitly neutralizes formula-leading cells and control characters while preserving expected data. Test the chosen behavior with Excel/Sheets-compatible cases.

**Regression tests required:** Yes.

---

## SEC-010: Write-capable shared-secret endpoints have inconsistent minimum-strength and comparison controls

**Severity:** P2 Medium  
**Confidence:** High

**Affected files**

- `app/gpt-action-auth.server.ts` as the stronger reference implementation
- `app/api/internal/automation/route.ts`
- `app/api/integrations/pickups/route.ts`
- `app/api/integrations/edi/route.ts`
- `app/api/integrations/carriers/maersk/route.ts`
- `app/admin/admin-security-config.ts`

**Affected endpoints**

- Custom GPT routes as comparison/control baseline
- internal automation
- pickup integration
- EDI integration
- Maersk integration/webhook

**Exact problem**

Secret validation is inconsistent across trust boundaries:

- Custom GPT has a dedicated helper that refuses a secret shorter than 32 characters and performs a timing-safe comparison.
- EDI/Maersk reviewed paths use timing-safe comparison but do not impose the same hard secret-length floor at the endpoint.
- internal automation/pickup use direct string comparison and do not enforce the same hard floor in the route.
- static bearer schemes generally remain reusable until rotation; freshness/nonce/signature behavior is not centralized.

This finding does not claim that a strong production secret is currently weak. Actual deployed secret values are not repository-visible. It identifies a fail-open configuration characteristic: if a weak value is configured, these write-capable endpoints accept it rather than refusing to start/authenticate.

**Why it is exploitable or dangerous**

Security-sensitive endpoints should not silently accept low-entropy secret configuration when the project already establishes a stronger minimum for GPT. Inconsistent auth code also makes future integrations more likely to diverge.

Exact replay of some carrier/EDI events is partially mitigated by deterministic event IDs/idempotent processing, so this finding is not a claim of universal duplicate-write replay.

**Attack/reproduction scenario**

A short or low-entropy automation/integration secret is accidentally configured. Unlike GPT auth, the endpoint accepts that configuration. Guessing/leak risk is then materially higher, and the stolen bearer can be reused until rotation.

**Business impact**

Increased chance of unauthorized webhook/integration writes under secret misconfiguration and higher long-term credential-management risk.

**Evidence from code**

The differing auth implementations and constraints are visible directly in the named route/helper files.

**Existing test coverage**

No reviewed cross-endpoint security test enforces a common minimum secret length, timing-safe comparison behavior, credential separation, or request freshness policy.

**Recommended remediation**

Centralize external-request authentication primitives. Enforce a hard entropy/length floor, use timing-safe comparisons, use unique per-integration credentials, and use signed timestamp/nonce or provider-native signatures where protocols support them. Keep idempotency checks even when signatures are added.

**Regression tests required:** Yes.

---

## SEC-013: `main` branch is unprotected and has no required status checks

**Severity:** P2 Medium  
**Confidence:** High

**Affected repository control**

- GitHub branch `main`

**Affected deployment/supply-chain surface**

Any build/deployment or production workflow that consumes `main`.

**Exact problem**

The final branch metadata check returned `protected: false` and no required status-check enforcement for `main`.

**Why it is exploitable or dangerous**

Any GitHub identity/token with repository write access can push directly to the production source branch without a branch-protection rule requiring review or security/CI gates. This increases the blast radius of a compromised maintainer account or accidental unsafe commit.

**Attack/reproduction scenario**

A collaborator token is compromised. The attacker directly pushes a credential-stealing or authorization-bypass change to `main`, bypassing pull-request review and required CI because the branch has no protection enforcing either.

**Business impact**

Source supply-chain compromise and potential production compromise if App Hosting/deployment follows `main`.

**Evidence from repository configuration**

GitHub branch metadata checked immediately before report generation showed branch protection disabled and required status checks enforcement off.

**Existing test coverage**

Application tests cannot enforce GitHub branch protection. This requires repository policy/configuration.

**Recommended remediation**

Protect `main`. Require pull requests, at least one appropriate reviewer for security-sensitive changes, required CI/security checks, conversation resolution, and restrict force pushes/deletions. Consider signed commits/tags and CODEOWNERS for authentication, Firebase, secrets, and deployment files.

**Regression tests required:** Not an application regression test. Add repository policy monitoring or an organization/repository security configuration check.

---

# 5. P3 findings

## SEC-011: Authenticated shipment-document list exposes raw Firebase Storage object paths

**Severity:** P3 Low  
**Confidence:** High

**Affected file**

- `app/shipment-documents.server.ts`

**Affected endpoint**

- `GET /api/admin/shipments/[reference]/documents`

**Exact problem**

The shipment document list returns stored document objects that include the internal `storage_path` field, and the route returns those objects to the browser.

**Why it is exploitable or dangerous**

This does not currently grant direct file access because Firebase Storage client rules are deny-all. It is unnecessary disclosure of backend object layout and increases future exposure if Storage policy, signing behavior, logs, or another endpoint changes.

The GPT document DTOs intentionally omit raw storage paths, demonstrating that path minimization is already understood elsewhere.

**Attack/reproduction scenario**

Any authenticated staff member allowed to list a shipment's documents can inspect the API response/browser network panel and learn internal bucket object naming/path conventions.

**Business impact**

Low direct impact today; information disclosure and avoidable coupling of client code to private storage layout.

**Evidence from code**

`listShipmentDocuments` returns the stored document shape including `storage_path`, and the API response does not map it to a safe browser DTO.

**Existing test coverage**

No reviewed response-schema test asserts that private storage paths stay server-only.

**Recommended remediation**

Return a purpose-built response DTO containing only fields the UI needs. Keep object paths entirely server-side.

**Regression tests required:** Yes, simple response-schema test.

---

## SEC-012: Logout is a state-changing GET that can be triggered cross-site

**Severity:** P3 Low  
**Confidence:** High

**Affected file**

- `app/api/admin/session/route.ts`

**Affected endpoint**

- `GET /api/admin/session?next=...` logout behavior

**Exact problem**

The GET handler clears the admin session cookie and redirects. It does not require same-origin validation because logout is implemented as a GET navigation.

The `next` parameter is constrained through a safe local-path helper, so no open redirect was found.

**Why it is exploitable or dangerous**

Cross-site content can trigger a navigation/request that logs an authenticated user out. The Strict cookie does not prevent a server response from clearing a cookie on a top-level request to the KCPL origin.

**Attack/reproduction scenario**

An attacker causes a user to navigate to the KCPL logout GET endpoint. The user's KCPL session is cleared without an explicit same-origin POST action.

**Business impact**

Availability/annoyance and forced reauthentication. No privilege gain was identified.

**Evidence from code**

The GET route mutates session state by expiring the cookie. `safeNextPath` correctly blocks external redirect destinations.

**Existing test coverage**

No reviewed security test checks that state-changing session actions require POST/same-origin protection.

**Recommended remediation**

Use a POST logout action protected by the same same-origin/CSRF policy as other state-changing admin operations. Keep GET non-mutating.

**Regression tests required:** Yes.

---

# 6. Cross-module security concerns

## 6.1 The Admin SDK makes application authorization the real database firewall

`firestore.rules` and `storage.rules` deny client access, which is strong, but server code uses privileged Firebase Admin access and therefore bypasses those rules. Every server helper that accepts an object ID must enforce role plus branch/object authorization itself. SEC-002 and SEC-003 show how a single helper that omits `StaffContext` can bypass otherwise good UI/query filtering.

Recommendation: treat `StaffContext` as mandatory input to every server function that reads or mutates branch-owned data unless the function is explicitly system-only. Add lint/code-review conventions around unscoped Admin SDK reads.

## 6.2 Capability checks and object-scope checks must remain separate

Several routes correctly ask both questions:

- may this role perform this class of action?
- may this user perform it on this specific branch/object?

Security failures occur where only the first question is answered. Maintain explicit helpers for both and test direct API calls, not only filtered lists.

## 6.3 Firestore batches are being used where transactions are required

Batches provide atomic writes, not atomic read-check-write invariants. Payment and document workflows both contain security/business invariants that can change between read and write. Any workflow containing `read -> validate state -> batch/write` should be reviewed for concurrency.

## 6.4 External credentials need trust-domain isolation

GPT is a good reference: dedicated secret, hard minimum length, timing-safe compare, read-only route contract. Pickup/internal automation do not preserve equivalent isolation. Each provider or privileged machine actor should have its own credential, scope, rotation path, logs, and replay/idempotency strategy.

## 6.5 Production security depends on controls not represented in this repository

The repository cannot prove:

- actual Firebase Auth provider settings and authorized domains,
- actual secret entropy/rotation status,
- Google Cloud IAM/service-account permissions,
- App Hosting ingress/rate limits,
- Storage bucket IAM/public-access prevention outside Firebase rules,
- audit-log retention/alerting,
- Firebase App Check use where relevant,
- MFA requirements for management/accounts staff,
- deployed Firestore indexes and whether console-created indexes drift from source.

These need deployment/configuration audit, not assumptions from source.

---

# 7. Missing security tests

High-value missing or insufficiently evidenced tests include:

1. **Configured admin vs Firestore role integration:** configured admin email with `operations`, `commercial`, and `accounts` profiles must not become management/all-branch.
2. **Cross-branch endpoint matrix:** direct calls for each role against same-branch and foreign-branch IDs across every `/api/admin/*` object endpoint.
3. **EDI tender POST IDOR:** foreign branch `tenderId` must be denied before any queue/tender write.
4. **Finance customer-link IDOR:** foreign shipment/customer references must be denied with zero side effects.
5. **Payment concurrency:** two simultaneous receivable/payable payment requests from one starting balance must preserve ledger/aggregate invariants.
6. **Payment idempotency:** retried identical logical payments must not create duplicates.
7. **Document races:** verify/delete, verify/supersede, and concurrent duplicate uploads.
8. **POD content verification:** valid declared MIME with invalid bytes must be rejected.
9. **External secret policy:** minimum secret strength, timing-safe helper use, per-integration credential separation, malformed auth, and replay/freshness behavior.
10. **Anonymous quote abuse controls:** body-size, duplicate/idempotency, and deployed rate-limit tests.
11. **CSV formula injection:** formula-leading/control-leading cells must export inertly.
12. **Response minimization:** API DTOs must not expose `storage_path`, provider credentials, raw EDI payloads, or other server-only fields.
13. **Session lifecycle:** revoked Firebase session, disabled user, stale `auth_time`, cookie expiry, logout method/CSRF, and staff-profile removal while a cookie remains valid.
14. **Bootstrap lifecycle:** first-user bootstrap can occur only under documented conditions and cannot silently reactivate after profiles are removed/misread.
15. **Fail-closed Firestore errors:** profile lookup/query failures should never widen role or branch scope.
16. **Webhook/event idempotency under concurrency:** two simultaneous copies of the same provider event should result in one logical event/effect.
17. **Security-header/deployed-host tests:** verify CSP, frame restrictions, referrer policy, HSTS, and MIME sniffing behavior at the production edge if those are expected controls.

The existing tests inspected include policy/unit coverage such as `tests/rbac-security.test.mjs`, `tests/document-policy.test.mjs`, `tests/delivery-pod-policy.test.mjs`, `tests/edi-x12.test.mjs`, `tests/carrier-integrations.test.mjs`, `tests/pickup-appointments.test.mjs`, `tests/freight-audit-policy.test.mjs`, and `tests/production-readiness.test.mjs`. These are useful, but green policy tests do not replace route-level and concurrent Firestore integration tests.

---

# 8. Top 10 remediation priorities

1. **Remove `KCPL_ADMIN_EMAILS` role/scope escalation.** Make staff profile RBAC authoritative after explicit bootstrap.
2. **Fix `POST /api/admin/edi` object authorization.** Require branch authorization on the specific tender before queueing.
3. **Close finance-linking cross-branch side effects.** Require staff context and branch authorization before shipment/CRM resolution or mutation.
4. **Make receivable/payable payment writes transactional and idempotent.** This protects financial integrity even from accidental concurrency.
5. **Split pickup and internal automation credentials immediately.** Rotate the shared secret after separation.
6. **Move document state/duplicate/supersede invariants into Firestore transactions.** Protect evidence lifecycle from TOCTOU races.
7. **Validate POD file bytes, not claimed MIME.** Reuse the stronger shipment-document validator.
8. **Standardize external request authentication.** Unique strong secrets/signatures, timing-safe compare, freshness, idempotency, and auditable rotation.
9. **Protect GitHub `main`.** Require PR review and CI/security gates to reduce source/deployment supply-chain risk.
10. **Add a server-side cross-branch authorization test matrix and public-endpoint abuse controls.** Include quote rate/body/idempotency controls and CSV output hardening.

---

# 9. Files and endpoints reviewed

The following security-sensitive areas were directly inspected during this pass. This is not a claim that every line of every route in the repository received equal depth.

## Authentication and RBAC

- `app/admin/admin-auth.ts`
- `app/api/admin/session/route.ts`
- `app/admin/admin-login.tsx`
- `app/firebase-client.ts`
- `app/firebase-admin.server.ts`
- `app/admin/admin-security-config.ts`
- `app/admin/staff-directory.server.ts`
- `app/admin/staff-permissions.ts`
- `app/admin/branch-access-policy.ts`
- `app/admin/shipment-access.server.ts`
- `app/admin/quote-access.server.ts`
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/api/admin/staff/route.ts`
- `tests/rbac-security.test.mjs`

## Request security

- `app/request-security.ts`
- same-origin use in multiple admin mutation routes
- session creation/deletion request behavior
- public quote request path
- integration bearer authentication paths

## CRM

- `app/api/admin/crm/crm-api.ts`
- `app/admin/crm/crm-access.server.ts`
- `app/api/admin/crm/customers/route.ts`
- `app/api/admin/crm/customers/[id]/route.ts`
- CRM customer branch creation/read/update/archive enforcement
- finance-to-CRM linking path

## Shipment and Job File

- `app/api/admin/jobs/[reference]/route.ts`
- `app/admin/job-file.server.ts`
- `app/admin/jobs/[reference]/page.tsx`
- `app/api/admin/shipments/[reference]/documents/route.ts`
- `app/api/admin/shipments/[reference]/documents/[id]/route.ts`
- `app/shipment-document-policy.ts`
- `app/shipment-documents.server.ts`

## Delivery/POD

- `app/api/admin/jobs/[reference]/delivery/evidence/route.ts`
- `app/admin/delivery/delivery-control.server.ts`
- `app/admin/delivery/delivery-control.ts`
- `tests/delivery-pod-policy.test.mjs`

## Finance and payables

- `app/api/admin/finance/invoices/route.ts`
- `app/api/admin/finance/invoices/[reference]/route.ts`
- `app/api/admin/finance/invoices/[reference]/payments/route.ts`
- `app/api/admin/finance/customer-link/route.ts`
- `app/admin/finance/finance.server.ts`
- `app/admin/finance/finance-linking.server.ts`
- `app/api/admin/payables/bills/[reference]/payments/route.ts`
- `app/admin/payables/payables.server.ts`

## EDI and carrier integrations

- `app/api/admin/edi/route.ts`
- `app/admin/edi/edi-gateway.server.ts`
- `app/admin/edi/edi-tender.server.ts`
- `app/api/integrations/edi/route.ts`
- `app/api/integrations/carriers/maersk/route.ts`
- `app/admin/carrier-integrations/carrier-integrations.server.ts`
- `app/api/admin/carrier-integrations/route.ts`
- `tests/edi-x12.test.mjs`
- `tests/carrier-integrations.test.mjs`

## Other admin and public routes sampled

- `app/api/admin/alerts/route.ts`
- `app/api/admin/consolidation/route.ts`
- `app/api/admin/customs/[reference]/route.ts`
- `app/api/admin/management/export/route.ts`
- `app/api/quotes/route.ts`
- `app/api/integrations/pickups/route.ts`
- `app/api/internal/automation/route.ts`

## Custom GPT

- `app/gpt-action-auth.server.ts`
- `public/kcpl-gpt-action.yaml`
- `app/api/gpt/search/route.ts`
- `app/api/gpt/jobs/[reference]/route.ts`
- `app/api/gpt/edi/route.ts`
- `app/api/gpt/freight-documents/route.ts`
- `app/api/gpt/freight-audit/route.ts`
- `app/api/gpt/carrier-integrations/route.ts`

## Firebase/config/secrets/dependencies

- `firestore.rules`
- `storage.rules`
- `firebase.json`
- `.env.example`
- `apphosting.yaml`
- `next.config.ts`
- `package.json`
- `package-lock.json`
- repository `main` branch protection metadata

---

# Areas reviewed where no meaningful issue was found

These are positive observations, not guarantees beyond the reviewed code.

## Firebase Authentication/session handling

- Firebase ID tokens are verified server-side when creating a session.
- revocation checking is enabled when verifying ID tokens/session cookies.
- session creation enforces a recent `auth_time`.
- admin session cookie is `HttpOnly`, `Secure`, and `SameSite=Strict`.
- Firebase client auth uses in-memory persistence for the bootstrap/login client flow.
- no embedded Firebase Admin private key was found in the reviewed source; Admin SDK initialization uses application/default credentials.

## Firestore and Storage client access

- `firestore.rules` denies client reads and writes.
- `storage.rules` denies client reads and writes.
- this prevents browser Firebase SDK calls from becoming a parallel RBAC bypass, assuming the deployed rules match source.

## Standard shipment document download path

- document access is proxied through authenticated server logic rather than giving the browser general Storage access.
- the reviewed path checks shipment/branch access before serving the file.

## POD signed URLs

- reviewed POD signed URLs are short-lived, approximately five minutes.
- the signed URL generation path is reached after branch-aware delivery/job access checks.

## Custom GPT

- GPT auth has a dedicated `KCPL_GPT_ACTION_SECRET` with a 32-character minimum and timing-safe comparison.
- GPT responses use no-store behavior in the reviewed auth/route pattern.
- the published GPT action schema exposes GET/read-only operations.
- reviewed GPT endpoints did not provide a write operation.
- reviewed job/document DTOs do not expose signed download URLs or raw Storage paths.
- reviewed EDI GPT output exposes normalized metadata rather than raw EDI payloads.
- reviewed carrier GPT output does not expose provider credential/config secret material.

The Freight Audit GPT route intentionally exposes financial/audit fields that are documented by the GPT action contract. Because intended product scope cannot be inferred beyond that contract, this audit does not label that exposure a vulnerability. Product owners should still explicitly confirm that the shared GPT secret is authorized to access those financial fields.

## CRM core customer routes

- CRM customer creation checks the requested primary branch against staff access.
- direct customer GET/PATCH/DELETE uses `checkCrmCustomerAccess` and denies customers outside staff branch scope.
- commercial and credit fields have additional capability checks in the reviewed customer route.

## Open redirect/XSS checks sampled

- the reviewed session `next` redirect uses a safe local-path validator; no open redirect was found there.
- no `dangerouslySetInnerHTML` security sink was identified in the code search performed during this pass.

## Carrier outbound request construction sampled

- the reviewed Maersk outbound integration uses configured/fixed provider endpoints rather than an arbitrary user-supplied fetch URL; no direct SSRF primitive was confirmed in that path.

## Exact duplicate EDI/carrier events

- reviewed event ingestion uses deterministic identifiers/idempotent patterns in important carrier/EDI paths, which reduces exact replay duplication. This does not remove the need for request authentication/freshness and concurrency tests.

## Dependency sampled

- `fast-xml-parser` is locked at `5.3.6`; the older advisory range through `5.3.3` is therefore not applicable to the committed lock version.
- no dependency vulnerability is reported here without a confirmed vulnerable committed version/advisory match.

---

# 10. Areas that need another audit pass

This pass found high-impact issues but did not exhaust every deploy-time and every route-level path. A continuation audit should resume in this order:

1. **Exhaustive `/api/admin/*` matrix:** enumerate every route from the current tree and record auth, capability, branch/object check, same-origin protection, input cap, and mutation helper for every HTTP method. The current pass deeply reviewed representative/high-risk routes but not every method in every nested CRM, customs, consolidation, tracking, partner, task, quote, and document subroute.
2. **Exhaustive `/admin/*` server component matrix:** confirm every server-rendered page performs server-side access checks and never relies solely on sidebar/navigation hiding.
3. **Nested CRM child routes:** addresses, contacts, documents, notes, quote-links, rate-cards, and tasks should each be verified for parent-customer branch authorization on every mutation. Core customer routes were checked and are sound in this respect.
4. **All finance/payable mutation helpers:** search systematically for every `read -> validate -> batch/write` invariant, not only payments and customer linking.
5. **All document/evidence collections:** repeat the transaction/immutability analysis for Customs, freight audit evidence, CRM documents, and any generated/exported documents.
6. **Webhook concurrency/replay:** run simultaneous duplicate EDI, Maersk, pickup, and automation requests against an emulator/staging Firestore instance and verify one logical effect.
7. **Runtime Firebase Auth settings:** confirm Email Enumeration Protection, MFA expectations, disabled-user behavior, authorized domains, password policy, sign-in quotas, and session revocation operational procedures in Firebase Console/Identity Platform.
8. **Runtime Google Cloud IAM:** audit App Hosting runtime service account permissions, Secret Manager access, Firestore IAM, Storage IAM/public-access prevention, and least privilege. Admin SDK use makes service-account compromise high impact.
9. **Actual production secrets:** verify length/entropy, separate environment scopes, rotation age, access logs, and whether old credentials have been revoked. Source cannot reveal these safely.
10. **Deployed CORS/security headers/ingress:** validate production responses for CSP, HSTS, frame protection, MIME sniffing, CORS, cache behavior, request-size limits, and rate limiting. `next.config.ts` alone is not proof of the edge response.
11. **Firestore index/config drift:** `firebase.json` points to rules but no committed `firestore.indexes.json` was found. Inventory console-created indexes and commit/manage required indexes so query behavior and deployments are reproducible. Review any future collection-group indexes specifically for branch-leak assumptions.
12. **Dependency advisory scan:** run a current lockfile-aware vulnerability scan (`npm audit` or equivalent plus GitHub Dependabot/security alerts) in a networked build environment, then manually triage security-sensitive dependencies. This source-only pass did not claim a complete live advisory scan.
13. **Account enumeration:** verify actual Firebase project settings and observable login error behavior from the deployed app. Client code alone cannot establish whether Email Enumeration Protection is enabled.
14. **Logging/telemetry:** inspect production logging sinks for Authorization headers, webhook bodies, provider responses, signed URLs, customer PII, raw EDI, and secrets. Source console logging was sampled but logging middleware/infrastructure needs runtime review.
15. **Backup/export access:** confirm Firestore exports, Storage backups, audit evidence retention, and disaster-recovery copies inherit equivalent access restrictions.
16. **GitHub security controls:** after branch protection is added, inspect repository secrets, Actions token permissions, environment protection rules, deploy approvals, Dependabot, secret scanning, and CODEOWNERS.

## CONTINUATION

If the next audit session has limited time, resume specifically at **nested CRM child routes**, then perform an automated/manual inventory of **every remaining `/api/admin/*` HTTP method** with columns for authentication, capability, branch/object authorization, same-origin/CSRF, body limits, transaction/idempotency, and tests. After source coverage is complete, move to **Firebase/GCP deployed configuration and IAM**, because those controls cannot be proven from this repository alone.

---

# Final security posture statement

KCPL is not starting from an exposed Firebase posture. The deny-all client rules, revoked-session validation, short-lived/private file patterns, and read-only GPT design are good foundations. The priority is to make the privileged server layer equally strict: never let login/bootstrap configuration become RBAC, never mutate an object without authorizing that exact object's branch, and use Firestore transactions wherever correctness depends on state that was just read.
