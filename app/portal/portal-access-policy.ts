/*
 * Customer portal access policy.
 *
 * Pure decisions only: no Firebase, no cookies, no I/O. Every rule about what a
 * signed-in customer may see lives here so it can be unit-tested without a
 * runtime, and so no route can implement "almost" the same rule.
 *
 * Three invariants this module exists to hold:
 *
 *   1. A portal principal is not a staff principal. Customer sessions carry
 *      their own cookie, their own account record and their own capability set.
 *      An email that is an active staff account is refused a portal session
 *      outright rather than holding both kinds of authority at once -- the
 *      authority-composition weakness the v2 system audit is about.
 *   2. The customer scope comes from the verified session, never from the
 *      request. Every reader takes a resolved customer id as an argument.
 *   3. Projections are allowlists, not deletions. The view builders below copy
 *      named fields out of a raw record, so an internal economic field that is
 *      added to a staff document later cannot reach a customer payload by
 *      default. `internal_cost`, job costs, margin and staff notes have no
 *      route to the portal through these functions.
 */

export const portalRoles = ["owner", "member"] as const;
export type PortalRole = (typeof portalRoles)[number];

export type PortalCapabilities = {
  role: PortalRole;
  /** Invoices, statements and outstanding balances. */
  canViewFinance: boolean;
  /** Raising new freight requests and booking requests against a quote. */
  canSubmitRequests: boolean;
};

export const portalRoleLabels: Record<PortalRole, string> = {
  owner: "Account owner",
  member: "Team member",
};

/** Unknown/absent roles resolve to the least-privileged role, never the widest. */
export function portalRoleValue(value: unknown): PortalRole {
  return portalRoles.includes(value as PortalRole) ? value as PortalRole : "member";
}

export function portalCapabilitiesForRole(role: PortalRole): PortalCapabilities {
  const owner = role === "owner";
  return { role, canViewFinance: owner, canSubmitRequests: owner };
}

export type PortalIdentity = {
  uid: string;
  email: string;
  /** Firebase `email_verified`. A password account can be created for any
   * address, so an unverified email is not proof of control of it. */
  emailVerified: boolean;
};

export type PortalAccountRecord = {
  email: string;
  customer_id: string;
  role: PortalRole;
  active: boolean;
  /** Bound on first successful sign-in; a later mismatch is a takeover attempt. */
  uid: string | null;
};

export type PortalCustomerRecord = {
  id: string;
  display_name: string;
  account_status: string;
  archived: boolean;
};

export const portalDenialReasons = [
  "email_missing",
  "email_unverified",
  "no_account",
  "account_disabled",
  "account_unlinked",
  "email_mismatch",
  "uid_mismatch",
  "staff_principal",
  "customer_missing",
  "customer_archived",
  "customer_blocked",
] as const;
export type PortalDenialReason = (typeof portalDenialReasons)[number];

export type PortalAccessDecision =
  | {
      kind: "allowed";
      customerId: string;
      customerName: string;
      role: PortalRole;
      capabilities: PortalCapabilities;
      /** Set when this sign-in is the one that binds the account to a Firebase uid. */
      bindUid: string | null;
    }
  | { kind: "denied"; reason: PortalDenialReason };

export function normalizePortalEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Firestore document id for a portal account. Lowercased email, so a single
 * address can never hold two accounts that disagree about its customer. */
export function portalAccountKey(email: unknown) {
  return normalizePortalEmail(email);
}

/** Customers KCPL has stopped trading with keep no portal access. A credit hold
 * (`on_hold`) deliberately does not block reading: that is when a customer most
 * needs to see their own outstanding balance. */
const blockedAccountStatuses = new Set(["blacklisted"]);

export function decidePortalAccess({
  identity,
  account,
  customer,
  staffPrincipal,
}: {
  identity: PortalIdentity;
  account: PortalAccountRecord | null;
  customer: PortalCustomerRecord | null;
  staffPrincipal: boolean;
}): PortalAccessDecision {
  const email = normalizePortalEmail(identity.email);
  if (!email) return { kind: "denied", reason: "email_missing" };
  if (!identity.emailVerified) return { kind: "denied", reason: "email_unverified" };
  // Checked before the account lookup: a staff address must not become a
  // customer principal even if someone provisions a portal account for it.
  if (staffPrincipal) return { kind: "denied", reason: "staff_principal" };
  if (!account) return { kind: "denied", reason: "no_account" };
  if (normalizePortalEmail(account.email) !== email) return { kind: "denied", reason: "email_mismatch" };
  if (!account.active) return { kind: "denied", reason: "account_disabled" };

  const customerId = typeof account.customer_id === "string" ? account.customer_id.trim() : "";
  if (!customerId) return { kind: "denied", reason: "account_unlinked" };

  // First sign-in binds the uid. After that the binding is authoritative, so a
  // recreated Firebase account on the same address cannot inherit the customer.
  const boundUid = typeof account.uid === "string" && account.uid.trim() ? account.uid.trim() : null;
  if (boundUid && boundUid !== identity.uid) return { kind: "denied", reason: "uid_mismatch" };

  if (!customer || customer.id !== customerId) return { kind: "denied", reason: "customer_missing" };
  if (customer.archived) return { kind: "denied", reason: "customer_archived" };
  if (blockedAccountStatuses.has(customer.account_status)) return { kind: "denied", reason: "customer_blocked" };

  const role = portalRoleValue(account.role);
  return {
    kind: "allowed",
    customerId,
    customerName: customer.display_name || "KCPL customer",
    role,
    capabilities: portalCapabilitiesForRole(role),
    bindUid: boundUid ? null : identity.uid,
  };
}

/* ------------------------------------------------------------------ *
 * Release rules
 * ------------------------------------------------------------------ */

/** Document states that are never released, whatever `customer_safe` says. */
const withheldDocumentStatuses = new Set(["rejected", "superseded", "deleted"]);

/**
 * A document reaches the customer only when a staff member has explicitly
 * marked it customer-safe AND it is not withdrawn, replaced or expired.
 * Default-deny: an absent `customer_safe` is a no.
 */
export function portalDocumentReleased(document: Record<string, unknown>, now = new Date()) {
  if (document.customer_safe !== true) return false;
  if (document.deleted_at) return false;
  const status = typeof document.review_status === "string" ? document.review_status : "";
  if (withheldDocumentStatuses.has(status)) return false;
  const expires = typeof document.expires_on === "string" ? document.expires_on.trim() : "";
  if (expires) {
    const expiry = new Date(`${expires}T23:59:59.999Z`);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) return false;
  }
  return true;
}

/** Drafts are unissued working state and voids are withdrawn. Neither is a bill. */
export function portalInvoiceVisible(invoice: Record<string, unknown>) {
  const status = typeof invoice.status === "string" ? invoice.status : "";
  return status !== "draft" && status !== "void" && status !== "";
}

/** A quote reaches the customer only once it has been priced and issued. */
export function portalQuoteVisible(quote: Record<string, unknown>) {
  const status = typeof quote.status === "string" ? quote.status : "";
  if (status === "lost" || status === "cancelled") return false;
  const amount = typeof quote.quoted_amount === "number" ? quote.quoted_amount : null;
  return amount !== null && Number.isFinite(amount);
}

const activeShipmentStatuses = new Set([
  "booking_confirmed",
  "preparing",
  "in_transit",
  "customs_clearance",
  "out_for_delivery",
  "exception",
]);

export function portalShipmentActive(status: unknown) {
  return typeof status === "string" && activeShipmentStatuses.has(status);
}

/* ------------------------------------------------------------------ *
 * Projections -- allowlists, not deletions
 * ------------------------------------------------------------------ */

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function money(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type PortalShipmentView = {
  reference: string;
  status: string;
  mode: string;
  origin: string;
  destination: string;
  eta: string | null;
  current_location: string | null;
  carrier: string | null;
  carrier_reference: string | null;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
};

export function portalShipmentView(reference: string, data: Record<string, unknown>): PortalShipmentView {
  return {
    reference,
    status: text(data.status, "booking_confirmed"),
    mode: text(data.mode, "unsure"),
    origin: text(data.origin),
    destination: text(data.destination),
    eta: nullableText(data.eta),
    current_location: nullableText(data.current_location),
    carrier: nullableText(data.carrier),
    carrier_reference: nullableText(data.carrier_reference),
    customer_note: nullableText(data.customer_note),
    created_at: text(data.created_at),
    updated_at: text(data.updated_at),
  };
}

export type PortalShipmentEventView = {
  id: string;
  title: string;
  location: string | null;
  details: string | null;
  event_time: string;
};

export function portalShipmentEventView(event: Record<string, unknown>, fallbackId: string): PortalShipmentEventView {
  return {
    id: String(event.id ?? fallbackId),
    title: text(event.title, "Shipment update"),
    location: nullableText(event.location),
    details: nullableText(event.details),
    event_time: text(event.event_time),
  };
}

export type PortalDocumentView = {
  id: string;
  shipment_reference: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  document_type: string;
  uploaded_at: string;
};

export function portalDocumentView(document: Record<string, unknown>, shipmentReference: string): PortalDocumentView {
  return {
    id: String(document.id ?? ""),
    shipment_reference: shipmentReference,
    filename: text(document.filename, "Document"),
    content_type: text(document.content_type, "application/octet-stream"),
    size_bytes: money(document.size_bytes),
    document_type: text(document.document_type, "other"),
    uploaded_at: text(document.uploaded_at),
  };
}

export type PortalInvoiceLineView = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export type PortalInvoiceView = {
  reference: string;
  record_type: string;
  status: string;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  shipment_reference: string | null;
  external_invoice_number: string | null;
  line_items: PortalInvoiceLineView[];
};

export function portalInvoiceView(data: Record<string, unknown>): PortalInvoiceView {
  const lines = Array.isArray(data.line_items) ? data.line_items as Array<Record<string, unknown>> : [];
  return {
    reference: text(data.reference),
    record_type: text(data.record_type, "invoice"),
    status: text(data.status, "issued"),
    issue_date: text(data.issue_date),
    due_date: text(data.due_date),
    currency: text(data.currency, "NPR"),
    subtotal: money(data.subtotal),
    tax_total: money(data.tax_total),
    total: money(data.total),
    amount_paid: money(data.amount_paid),
    balance_due: money(data.balance_due),
    shipment_reference: nullableText(data.shipment_reference),
    external_invoice_number: nullableText(data.external_invoice_number),
    line_items: lines.map((line, index) => ({
      id: String(line.id ?? index),
      description: text(line.description, "Charge"),
      quantity: money(line.quantity),
      unit_price: money(line.unit_price),
      total: money(line.total),
    })),
  };
}

export type PortalQuoteView = {
  reference: string;
  status: string;
  created_at: string;
  origin: string;
  destination: string;
  mode: string;
  cargo_type: string | null;
  weight: string | null;
  weight_unit: string | null;
  quoted_amount: number | null;
  quote_currency: string;
  valid_until: string | null;
  customer_quote_note: string | null;
  shipment_reference: string | null;
};

export function portalQuoteView(data: Record<string, unknown>): PortalQuoteView {
  const amount = typeof data.quoted_amount === "number" && Number.isFinite(data.quoted_amount) ? data.quoted_amount : null;
  return {
    reference: text(data.reference),
    status: text(data.status, "new"),
    created_at: text(data.created_at),
    origin: text(data.origin),
    destination: text(data.destination),
    mode: text(data.mode, "unsure"),
    cargo_type: nullableText(data.cargo_type),
    weight: nullableText(data.weight),
    weight_unit: nullableText(data.weight_unit),
    quoted_amount: amount,
    quote_currency: text(data.quote_currency, "USD"),
    valid_until: nullableText(data.valid_until),
    customer_quote_note: nullableText(data.customer_quote_note),
    shipment_reference: nullableText(data.shipment_reference),
  };
}
