import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  decidePortalAccess,
  portalCapabilitiesForRole,
  portalDocumentReleased,
  portalInvoiceView,
  portalInvoiceVisible,
  portalQuoteView,
  portalQuoteVisible,
  portalRoleValue,
  portalShipmentView,
} from "../app/portal/portal-access-policy.ts";

const identity = { uid: "customer-uid", email: "Contact@Customer.com", emailVerified: true };
const account = { email: "contact@customer.com", customer_id: "CUST-1", role: "owner", active: true, uid: null };
const customer = { id: "CUST-1", display_name: "Himalayan Traders", account_status: "active", archived: false };

function decide(overrides = {}) {
  return decidePortalAccess({
    identity,
    account,
    customer,
    staffPrincipal: false,
    ...overrides,
  });
}

/* ------------------------------------------------------------------ *
 * Session authority
 * ------------------------------------------------------------------ */

test("a verified, provisioned customer is granted their own scope and binds the uid once", () => {
  const first = decide();
  assert.equal(first.kind, "allowed");
  assert.equal(first.customerId, "CUST-1");
  assert.equal(first.customerName, "Himalayan Traders");
  assert.equal(first.bindUid, "customer-uid", "first sign-in claims the account");

  const second = decide({ account: { ...account, uid: "customer-uid" } });
  assert.equal(second.kind, "allowed");
  assert.equal(second.bindUid, null, "an already bound account is not rebound");
});

test("an unverified email can never open a portal session", () => {
  // A Firebase password account can be created for any address, so verification
  // is the only proof the signer controls the provisioned address.
  const decision = decide({ identity: { ...identity, emailVerified: false } });
  assert.equal(decision.kind, "denied");
  assert.equal(decision.reason, "email_unverified");
});

test("a staff principal is refused customer authority even with a portal account", () => {
  const decision = decide({ staffPrincipal: true });
  assert.equal(decision.kind, "denied");
  assert.equal(decision.reason, "staff_principal");
});

test("a second Firebase account on the same address cannot inherit the customer", () => {
  const decision = decide({ account: { ...account, uid: "original-uid" } });
  assert.equal(decision.kind, "denied");
  assert.equal(decision.reason, "uid_mismatch");
});

test("missing, disabled and unlinked accounts all fail closed", () => {
  assert.equal(decide({ account: null }).reason, "no_account");
  assert.equal(decide({ account: { ...account, active: false } }).reason, "account_disabled");
  assert.equal(decide({ account: { ...account, customer_id: "  " } }).reason, "account_unlinked");
  assert.equal(decide({ account: { ...account, email: "someone.else@customer.com" } }).reason, "email_mismatch");
});

test("the customer record must exist, match the account and still be tradeable", () => {
  assert.equal(decide({ customer: null }).reason, "customer_missing");
  assert.equal(decide({ customer: { ...customer, id: "CUST-2" } }).reason, "customer_missing");
  assert.equal(decide({ customer: { ...customer, archived: true } }).reason, "customer_archived");
  assert.equal(decide({ customer: { ...customer, account_status: "blacklisted" } }).reason, "customer_blocked");
  // A credit hold must not hide the balance the customer is being chased for.
  assert.equal(decide({ customer: { ...customer, account_status: "on_hold" } }).kind, "allowed");
});

test("portal roles default to the least privileged and gate finance behind ownership", () => {
  assert.equal(portalRoleValue("management"), "member");
  assert.equal(portalRoleValue(undefined), "member");
  assert.equal(portalRoleValue("owner"), "owner");

  const member = portalCapabilitiesForRole("member");
  assert.equal(member.canViewFinance, false);
  assert.equal(member.canSubmitRequests, false);

  const owner = portalCapabilitiesForRole("owner");
  assert.equal(owner.canViewFinance, true);
  assert.equal(owner.canSubmitRequests, true);

  const decision = decide({ account: { ...account, role: "member" } });
  assert.equal(decision.capabilities.canViewFinance, false);
});

/* ------------------------------------------------------------------ *
 * Release rules
 * ------------------------------------------------------------------ */

test("documents are released only when a staff member marked them customer safe", () => {
  assert.equal(portalDocumentReleased({ review_status: "verified" }), false, "absent customer_safe is a no");
  assert.equal(portalDocumentReleased({ customer_safe: false, review_status: "verified" }), false);
  assert.equal(portalDocumentReleased({ customer_safe: true, review_status: "verified" }), true);
  assert.equal(portalDocumentReleased({ customer_safe: true, review_status: "received" }), true);
});

test("withdrawn, replaced, deleted and expired documents are never released", () => {
  for (const review_status of ["rejected", "superseded", "deleted"]) {
    assert.equal(portalDocumentReleased({ customer_safe: true, review_status }), false, review_status);
  }
  assert.equal(portalDocumentReleased({ customer_safe: true, review_status: "verified", deleted_at: "2026-01-01T00:00:00.000Z" }), false);
  const now = new Date("2026-09-19T00:00:00.000Z");
  assert.equal(portalDocumentReleased({ customer_safe: true, review_status: "verified", expires_on: "2026-09-18" }, now), false);
  assert.equal(portalDocumentReleased({ customer_safe: true, review_status: "verified", expires_on: "2026-09-19" }, now), true);
});

test("unissued and withdrawn billing is not shown as a bill", () => {
  assert.equal(portalInvoiceVisible({ status: "draft" }), false);
  assert.equal(portalInvoiceVisible({ status: "void" }), false);
  assert.equal(portalInvoiceVisible({}), false);
  assert.equal(portalInvoiceVisible({ status: "issued" }), true);
  assert.equal(portalInvoiceVisible({ status: "overdue" }), true);
});

test("a quote reaches the customer only once it carries a price", () => {
  assert.equal(portalQuoteVisible({ status: "new", quoted_amount: null }), false);
  assert.equal(portalQuoteVisible({ status: "lost", quoted_amount: 1200 }), false);
  assert.equal(portalQuoteVisible({ status: "quoted", quoted_amount: 1200 }), true);
});

/* ------------------------------------------------------------------ *
 * Projections are allowlists
 * ------------------------------------------------------------------ */

test("the shipment projection drops procurement cost and commercial lineage", () => {
  const view = portalShipmentView("KCPL-S-1", {
    status: "in_transit",
    origin: "Kolkata",
    destination: "Birgunj",
    procurement_cost: 84000,
    procurement_currency: "NPR",
    commercial_snapshot: { pricing: { sell_amount: 100000, converted_buy_cost: 84000 } },
    commercial_version_id: "cv-1",
    internal_job_notes: "Margin is thin on this lane",
    job_assigned_to_email: "ops@kcpl.test",
  });
  for (const leaked of ["procurement_cost", "procurement_currency", "commercial_snapshot", "commercial_version_id", "internal_job_notes", "job_assigned_to_email"]) {
    assert.equal(leaked in view, false, `${leaked} must not reach a customer`);
  }
  assert.equal(view.origin, "Kolkata");
});

test("the quote projection never carries internal cost", () => {
  const view = portalQuoteView({
    reference: "KCPL-Q-1",
    quoted_amount: 1200,
    quote_currency: "USD",
    internal_cost: 940,
    crm_matches: [{ id: "CUST-9" }],
  });
  assert.equal("internal_cost" in view, false);
  assert.equal("crm_matches" in view, false);
  assert.equal(view.quoted_amount, 1200);
});

test("the invoice projection exposes billing, not margin", () => {
  const view = portalInvoiceView({
    reference: "KCPL-I-1",
    status: "issued",
    currency: "NPR",
    total: 100000,
    amount_paid: 25000,
    balance_due: 75000,
    job_cost_total: 84000,
    notes: "Chase through the branch manager",
    created_by_email: "accounts@kcpl.test",
    line_items: [{ id: "l1", description: "Ocean freight", quantity: 1, unit_price: 100000, total: 100000, cost: 84000 }],
  });
  for (const leaked of ["job_cost_total", "notes", "created_by_email"]) {
    assert.equal(leaked in view, false, `${leaked} must not reach a customer`);
  }
  assert.equal("cost" in view.line_items[0], false);
  assert.equal(view.balance_due, 75000);
});

/* ------------------------------------------------------------------ *
 * Route wiring
 * ------------------------------------------------------------------ */

const repo = (path) => new URL(`../${path}`, import.meta.url);

test("portal readers scope every query by the session customer", async () => {
  const source = await readFile(repo("app/portal/portal-data.server.ts"), "utf8");

  const scoped = [...source.matchAll(/where\("(customer_id|portal_customer_id)", "==", ([^)]+)\)/g)];
  assert.ok(scoped.length >= 4, "expected the shipment, invoice and quote readers to be scoped");
  for (const [, , value] of scoped) {
    assert.match(value.trim(), /^(session\.customerId|customerId)$/, "scope must come from the session, never from a caller");
  }

  // The one helper that takes a raw customer id is private, and every call site
  // hands it the session's own scope.
  assert.doesNotMatch(source, /export (async )?function loadCustomerShipments/);
  for (const [, argument] of source.matchAll(/loadCustomerShipments\(([^)]*)\)/g)) {
    if (argument.includes(":")) continue; // the declaration itself
    assert.equal(argument.trim(), "session.customerId");
  }

  // Every exported reader is handed the resolved session, not a customer id.
  for (const [, name, parameters] of source.matchAll(/export async function (\w+)\(([^)]*)\)/g)) {
    assert.match(parameters, /session: PortalSession/, `${name} must take the resolved session`);
  }
});

test("the customer document download checks ownership and release before reading bytes", async () => {
  const source = await readFile(repo("app/api/portal/documents/[reference]/[id]/route.ts"), "utf8");
  const ownership = source.indexOf("portalOwnsShipment");
  const release = source.indexOf("portalDocumentReleased");
  const bytes = source.indexOf("getShipmentDocumentFile");
  assert.ok(ownership > 0 && release > ownership, "release is checked after ownership");
  assert.ok(bytes > release, "no bytes are fetched until both gates pass");
  assert.match(source, /getPortalAccess\(\)/);
});

test("a customer request never writes staff-owned commercial authority", async () => {
  const source = await readFile(repo("app/api/portal/requests/route.ts"), "utf8");
  assert.match(source, /customer_id: null/, "CRM linkage stays a staff decision");
  assert.match(source, /portal_customer_id: session\.customerId/);
  assert.doesNotMatch(source, /quoted_amount: [^n]/, "the portal cannot price its own request");
  assert.doesNotMatch(source, /status: "won"/);
});

test("the portal session is a separate cookie from the staff session", async () => {
  const source = await readFile(repo("app/portal/portal-auth.ts"), "utf8");
  assert.match(source, /PORTAL_SESSION_COOKIE = "kcpl_portal_session"/);
  assert.doesNotMatch(source, /kcpl_admin_session|ADMIN_SESSION_COOKIE/);
  assert.match(source, /HttpOnly; Secure; SameSite=Strict/);
  assert.match(source, /email_verified === true/);
});

test("portal account management is gated on the staff authority that manages staff", async () => {
  const source = await readFile(repo("app/api/admin/portal-access/route.ts"), "utf8");
  assert.match(source, /permissions\.canManageStaff/);
  assert.match(source, /isTrustedSameOriginRequest/);
});
