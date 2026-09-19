import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { isAllowedAdminEmail } from "../admin/admin-auth";
import { staffProfileByEmail } from "../admin/staff-directory.server";
import {
  decidePortalAccess,
  normalizePortalEmail,
  portalAccountKey,
  portalRoleValue,
  type PortalAccessDecision,
  type PortalAccountRecord,
  type PortalCustomerRecord,
  type PortalIdentity,
  type PortalRole,
} from "./portal-access-policy";

const PORTAL_ACCOUNTS = "portal_accounts";

export type PortalAccountSummary = {
  email: string;
  customer_id: string;
  customer_name: string;
  role: PortalRole;
  active: boolean;
  bound: boolean;
  created_at: string;
  created_by_email: string | null;
  last_sign_in_at: string | null;
  updated_at: string;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function accountRecord(data: Record<string, unknown>): PortalAccountRecord {
  return {
    email: normalizePortalEmail(data.email),
    customer_id: text(data.customer_id).trim(),
    role: portalRoleValue(data.role),
    active: data.active === true,
    uid: nullable(data.uid),
  };
}

function customerRecord(id: string, data: Record<string, unknown>): PortalCustomerRecord {
  return {
    id,
    display_name: text(data.display_name) || text(data.legal_name) || id,
    account_status: text(data.account_status, "active"),
    archived: data.archived === true,
  };
}

/**
 * Resolve a verified Firebase identity into a portal decision.
 *
 * Every lookup here is read-only except the one-time uid binding, which is a
 * compare-and-set: the first sign-in claims the account, and a second Firebase
 * account on the same address is refused rather than inheriting the customer.
 */
export async function resolvePortalAccount(identity: PortalIdentity): Promise<PortalAccessDecision | { kind: "unavailable" }> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const email = normalizePortalEmail(identity.email);
  if (!email) return { kind: "denied" as const, reason: "email_missing" as const };

  const db = firebaseAdminDb();
  let accountSnapshot;
  let staffProfile;
  try {
    [accountSnapshot, staffProfile] = await Promise.all([
      db.collection(PORTAL_ACCOUNTS).doc(portalAccountKey(email)).get(),
      staffProfileByEmail(email),
    ]);
  } catch (error) {
    console.error("KCPL portal account lookup failed", error);
    return { kind: "unavailable" as const };
  }

  const account = accountSnapshot.exists ? accountRecord(accountSnapshot.data() as Record<string, unknown>) : null;
  // An inactive staff profile is not a staff principal, so a former staff
  // member can still be given customer access later. The bootstrap allowlist
  // counts too: KCPL_ADMIN_EMAILS can mint staff authority without a profile.
  const staffPrincipal = Boolean(staffProfile && staffProfile.active !== false) || isAllowedAdminEmail(email);

  let customer: PortalCustomerRecord | null = null;
  if (account?.customer_id) {
    try {
      const snapshot = await db.collection("customers").doc(account.customer_id).get();
      if (snapshot.exists) customer = customerRecord(snapshot.id, snapshot.data() as Record<string, unknown>);
    } catch (error) {
      console.error("KCPL portal customer lookup failed", error);
      return { kind: "unavailable" as const };
    }
  }

  const decision = decidePortalAccess({ identity, account, customer, staffPrincipal });
  if (decision.kind !== "allowed") return decision;

  if (decision.bindUid) {
    const bound = await bindPortalAccountUid(email, decision.bindUid);
    if (!bound) return { kind: "denied" as const, reason: "uid_mismatch" as const };
  }
  return decision;
}

/** Compare-and-set uid binding. Returns false when another uid already holds it. */
async function bindPortalAccountUid(email: string, uid: string) {
  const reference = firebaseAdminDb().collection(PORTAL_ACCOUNTS).doc(portalAccountKey(email));
  try {
    return await firebaseAdminDb().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return false;
      const current = nullable(snapshot.get("uid"));
      if (current && current !== uid) return false;
      if (!current) transaction.update(reference, { uid, bound_at: new Date().toISOString() });
      return true;
    });
  } catch (error) {
    console.error("KCPL portal uid binding failed", error);
    return false;
  }
}

export async function recordPortalSignIn(email: string) {
  if (!firebaseRuntimeConfigured()) return;
  try {
    await firebaseAdminDb().collection(PORTAL_ACCOUNTS).doc(portalAccountKey(email))
      .update({ last_sign_in_at: new Date().toISOString() });
  } catch {
    // Sign-in telemetry must never fail an otherwise valid session.
  }
}

/* ------------------------------------------------------------------ *
 * Staff-side provisioning
 * ------------------------------------------------------------------ */

function summary(id: string, data: Record<string, unknown>): PortalAccountSummary {
  return {
    email: normalizePortalEmail(data.email) || id,
    customer_id: text(data.customer_id),
    customer_name: text(data.customer_name),
    role: portalRoleValue(data.role),
    active: data.active === true,
    bound: Boolean(nullable(data.uid)),
    created_at: text(data.created_at),
    created_by_email: nullable(data.created_by_email),
    last_sign_in_at: nullable(data.last_sign_in_at),
    updated_at: text(data.updated_at),
  };
}

export async function listPortalAccounts(limit = 200) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  try {
    const snapshot = await firebaseAdminDb().collection(PORTAL_ACCOUNTS).limit(limit).get();
    const accounts = snapshot.docs
      .map((document) => summary(document.id, document.data() as Record<string, unknown>))
      .sort((a, b) => a.customer_name.localeCompare(b.customer_name) || a.email.localeCompare(b.email));
    return { kind: "ready" as const, accounts };
  } catch (error) {
    console.error("KCPL portal account listing failed", error);
    return { kind: "unavailable" as const };
  }
}

export type PortalAccountInput = {
  email: string;
  customerId: string;
  role: PortalRole;
};

export async function savePortalAccount(input: PortalAccountInput, actor: { name: string; email: string }) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const email = normalizePortalEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { kind: "invalid_email" as const };
  const customerId = input.customerId.trim();
  if (!customerId) return { kind: "invalid_customer" as const };

  const db = firebaseAdminDb();
  try {
    const [customer, staffProfile] = await Promise.all([
      db.collection("customers").doc(customerId).get(),
      staffProfileByEmail(email),
    ]);
    if (!customer.exists || customer.get("archived") === true) return { kind: "invalid_customer" as const };
    // Refused at provisioning time as well as at sign-in: a staff address must
    // never hold customer authority, and saying so here is the clearer error.
    if ((staffProfile && staffProfile.active !== false) || isAllowedAdminEmail(email)) return { kind: "staff_email" as const };

    const now = new Date().toISOString();
    const reference = db.collection(PORTAL_ACCOUNTS).doc(portalAccountKey(email));
    const existing = await reference.get();
    if (existing.exists && text(existing.get("customer_id")) !== customerId) {
      // Reassigning an address to a different customer would silently hand the
      // bound Firebase account a new data scope.
      return { kind: "customer_conflict" as const, currentCustomerId: text(existing.get("customer_id")) };
    }

    await reference.set({
      email,
      customer_id: customerId,
      customer_name: text(customer.get("display_name"), customerId),
      role: portalRoleValue(input.role),
      active: true,
      uid: existing.exists ? nullable(existing.get("uid")) : null,
      created_at: existing.exists ? text(existing.get("created_at"), now) : now,
      created_by_name: existing.exists ? text(existing.get("created_by_name"), actor.name) : actor.name,
      created_by_email: existing.exists ? text(existing.get("created_by_email"), actor.email) : actor.email,
      last_sign_in_at: existing.exists ? nullable(existing.get("last_sign_in_at")) : null,
      updated_at: now,
      updated_by_email: actor.email,
    });
    return { kind: "saved" as const, email };
  } catch (error) {
    console.error("KCPL portal account save failed", error);
    return { kind: "unavailable" as const };
  }
}

export async function setPortalAccountActive(email: string, active: boolean, actor: { email: string }) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const key = portalAccountKey(email);
  if (!key) return { kind: "missing" as const };
  try {
    const reference = firebaseAdminDb().collection(PORTAL_ACCOUNTS).doc(key);
    const snapshot = await reference.get();
    if (!snapshot.exists) return { kind: "missing" as const };
    await reference.update({ active, updated_at: new Date().toISOString(), updated_by_email: actor.email });
    return { kind: "saved" as const };
  } catch (error) {
    console.error("KCPL portal account status change failed", error);
    return { kind: "unavailable" as const };
  }
}
