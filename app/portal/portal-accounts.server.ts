import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { isAllowedAdminEmail } from "../admin/admin-auth";
import { staffProfileByEmail } from "../admin/staff-directory.server";
import {
  portalNotificationPreferences,
  portalNotificationTopics,
  type PortalNotificationPreferences,
} from "./portal-notifications";
import {
  decidePortalTeamChange,
  type PortalTeamAction,
  type PortalTeamDecision,
} from "./portal-access-policy";
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

export type PortalTeamMember = {
  email: string;
  role: PortalRole;
  active: boolean;
  bound: boolean;
  last_sign_in_at: string | null;
  created_at: string;
};

/**
 * The logins on one customer's account.
 *
 * Scoped by `customer_id` at the query, so a customer's team view can only
 * ever be their own -- there is no code path here that returns another
 * customer's accounts, whatever a caller passes.
 */
export async function listPortalTeam(customerId: string): Promise<PortalTeamMember[] | null> {
  if (!firebaseRuntimeConfigured() || !customerId.trim()) return null;
  try {
    const snapshot = await firebaseAdminDb().collection(PORTAL_ACCOUNTS)
      .where("customer_id", "==", customerId.trim())
      .limit(50)
      .get();
    return snapshot.docs
      .map((document) => {
        const data = document.data() as Record<string, unknown>;
        return {
          email: normalizePortalEmail(data.email) || document.id,
          role: portalRoleValue(data.role),
          active: data.active === true,
          bound: Boolean(nullable(data.uid)),
          last_sign_in_at: nullable(data.last_sign_in_at),
          created_at: text(data.created_at),
        };
      })
      .sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email));
  } catch (error) {
    console.error("KCPL portal team listing failed", error);
    return null;
  }
}

/**
 * Apply an account owner's change to their own team.
 *
 * The customer id is the session's, never the request's. The decision itself
 * is `decidePortalTeamChange`, which is pure and tested; this function only
 * gathers the facts it needs and performs the write it allows.
 */
export async function applyPortalTeamChange(input: {
  action: PortalTeamAction;
  customerId: string;
  customerName: string;
  actorRole: PortalRole;
  actorEmail: string;
  targetEmail: string;
}): Promise<
  | { kind: "applied"; email: string }
  | { kind: "denied"; decision: Extract<PortalTeamDecision, { kind: "denied" }> }
  | { kind: "staff_email" }
  | { kind: "unavailable" }
> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  const targetEmail = normalizePortalEmail(input.targetEmail);

  let team: PortalTeamMember[] | null;
  try {
    team = await listPortalTeam(input.customerId);
  } catch {
    return { kind: "unavailable" };
  }
  if (!team) return { kind: "unavailable" };

  const existing = team.find((member) => member.email === targetEmail) ?? null;
  let target: { email: string; customer_id: string; role: PortalRole } | null = existing
    ? { email: existing.email, customer_id: input.customerId, role: existing.role }
    : null;

  // An address already provisioned elsewhere is not on this team, so the
  // listing above cannot see it. Look it up directly so the decision refuses
  // it as another customer's rather than treating it as a free address.
  if (!target && targetEmail) {
    try {
      const snapshot = await firebaseAdminDb().collection(PORTAL_ACCOUNTS).doc(portalAccountKey(targetEmail)).get();
      if (snapshot.exists) {
        const data = snapshot.data() as Record<string, unknown>;
        target = {
          email: normalizePortalEmail(data.email) || snapshot.id,
          customer_id: text(data.customer_id).trim(),
          role: portalRoleValue(data.role),
        };
      }
    } catch (error) {
      console.error("KCPL portal team target lookup failed", error);
      return { kind: "unavailable" };
    }
  }

  const decision = decidePortalTeamChange({
    action: input.action,
    actorRole: input.actorRole,
    actorEmail: input.actorEmail,
    targetEmail,
    customerId: input.customerId,
    target,
    activeMemberCount: team.filter((member) => member.role === "member" && member.active).length,
  });
  if (decision.kind === "denied") return { kind: "denied", decision };

  if (input.action === "invite") {
    // Always a member: an owner cannot mint another owner.
    const saved = await savePortalAccount(
      { email: targetEmail, customerId: input.customerId, role: "member" },
      { name: input.customerName, email: input.actorEmail },
    );
    if (saved.kind === "staff_email") return { kind: "staff_email" };
    if (saved.kind !== "saved") return { kind: "unavailable" };
    return { kind: "applied", email: targetEmail };
  }

  const result = await setPortalAccountActive(targetEmail, input.action === "enable", { email: input.actorEmail });
  if (result.kind !== "saved") return { kind: "unavailable" };
  return { kind: "applied", email: targetEmail };
}

/** A customer's own notification settings, read for their session only. */
export async function getPortalNotificationPreferences(email: string): Promise<PortalNotificationPreferences | null> {
  if (!firebaseRuntimeConfigured()) return null;
  try {
    const snapshot = await firebaseAdminDb().collection(PORTAL_ACCOUNTS).doc(portalAccountKey(email)).get();
    if (!snapshot.exists) return null;
    return portalNotificationPreferences(snapshot.data() as Record<string, unknown>);
  } catch (error) {
    console.error("KCPL portal notification preference read failed", error);
    return null;
  }
}

/**
 * Save a customer's notification settings.
 *
 * Scoped to the signed-in account's own record: the email comes from the
 * session, never from the request body, so one portal user cannot silence
 * another's notifications.
 */
export async function savePortalNotificationPreferences(email: string, preferences: PortalNotificationPreferences) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const key = portalAccountKey(email);
  if (!key) return { kind: "missing" as const };
  try {
    const reference = firebaseAdminDb().collection(PORTAL_ACCOUNTS).doc(key);
    const snapshot = await reference.get();
    if (!snapshot.exists) return { kind: "missing" as const };
    await reference.update({
      notification_preferences: Object.fromEntries(portalNotificationTopics.map((topic) => [topic, preferences[topic] === true])),
      updated_at: new Date().toISOString(),
    });
    return { kind: "saved" as const };
  } catch (error) {
    console.error("KCPL portal notification preference save failed", error);
    return { kind: "unavailable" as const };
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
