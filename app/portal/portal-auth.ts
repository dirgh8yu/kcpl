import { cookies } from "next/headers";
import { firebaseAdminAuth, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { adminSecurityConfigurationValid } from "../admin/admin-security-config";
import { resolvePortalAccount } from "./portal-accounts.server";
import type { PortalCapabilities, PortalCustomerScope, PortalDenialReason, PortalIdentity, PortalRole } from "./portal-access-policy";
import type { PortalLocale } from "./portal-i18n";

/**
 * The customer portal session is deliberately a different cookie, a different
 * TTL and a different resolver from the staff session. Nothing in this module
 * reads or writes the staff session cookie, so a customer session can never be
 * presented to a staff route and vice versa.
 */
export const PORTAL_SESSION_COOKIE = "kcpl_portal_session";
export const PORTAL_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * Which of an agent's customers they are currently looking at.
 *
 * Deliberately a separate, unsigned cookie rather than something baked into
 * the session: it carries no authority. The allowed set is re-derived from
 * Firestore on every request and this value is intersected with it, so a
 * forged or stale id resolves to the account's primary customer instead of
 * widening anything. Storing it in the session cookie would mean re-minting a
 * Firebase session to switch, for a preference.
 */
export const PORTAL_CUSTOMER_COOKIE = "kcpl_portal_customer";

export type PortalSession = {
  uid: string;
  email: string;
  displayName: string;
  /** The customer this request is scoped to. Every reader takes this. */
  customerId: string;
  customerName: string;
  /** Every customer this login may read, primary first. One entry is the
   * ordinary case; more than one means an agent buying under several records. */
  customers: PortalCustomerScope[];
  role: PortalRole;
  capabilities: PortalCapabilities;
  /** The language this customer reads the portal and their emails in. */
  locale: PortalLocale;
};

export type PortalAccess =
  | { kind: "signed-out" }
  | { kind: "unconfigured" }
  | { kind: "authorized"; session: PortalSession };

export function portalRuntimeConfigured() {
  return firebaseRuntimeConfigured() && adminSecurityConfigurationValid();
}

export async function authorizePortalIdentity(
  identity: PortalIdentity,
  requestedCustomerId: string | null = null,
): Promise<
  | { kind: "authorized"; session: PortalSession }
  | { kind: "denied"; reason: PortalDenialReason }
  | { kind: "unavailable" }
> {
  const decision = await resolvePortalAccount(identity, requestedCustomerId);
  if (decision.kind === "unavailable") return { kind: "unavailable" };
  if (decision.kind === "denied") return { kind: "denied", reason: decision.reason };
  return {
    kind: "authorized",
    session: {
      uid: identity.uid,
      email: identity.email,
      displayName: identity.email.split("@")[0] || "Customer",
      customerId: decision.customerId,
      customerName: decision.customerName,
      customers: decision.customers,
      role: decision.role,
      capabilities: decision.capabilities,
      locale: decision.locale,
    },
  };
}

export async function getPortalAccess(): Promise<PortalAccess> {
  if (!portalRuntimeConfigured()) return { kind: "unconfigured" };

  const cookieStore = await cookies();
  const session = cookieStore.get(PORTAL_SESSION_COOKIE)?.value ?? "";
  if (!session) return { kind: "signed-out" };
  const requestedCustomerId = cookieStore.get(PORTAL_CUSTOMER_COOKIE)?.value ?? null;

  try {
    const decoded = await firebaseAdminAuth().verifySessionCookie(session, true);
    const result = await authorizePortalIdentity({
      uid: decoded.uid,
      email: decoded.email ?? "",
      emailVerified: decoded.email_verified === true,
    }, requestedCustomerId);
    if (result.kind !== "authorized") return { kind: "signed-out" };
    return {
      kind: "authorized",
      session: {
        ...result.session,
        displayName: decoded.name?.trim() || result.session.displayName,
      },
    };
  } catch {
    // A revoked, expired or forged cookie is signed-out, never a partial session.
    return { kind: "signed-out" };
  }
}

export function portalSessionCookie(token: string) {
  return `${PORTAL_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(PORTAL_SESSION_TTL_MS / 1000)}`;
}

export function clearPortalSessionCookie() {
  return `${PORTAL_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function portalCustomerCookie(customerId: string) {
  return `${PORTAL_CUSTOMER_COOKIE}=${encodeURIComponent(customerId)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(PORTAL_SESSION_TTL_MS / 1000)}`;
}

/** Cleared on sign-out with the session, so the next person at the same
 * browser does not inherit an agent's chosen customer. */
export function clearPortalCustomerCookie() {
  return `${PORTAL_CUSTOMER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

/** Customer-facing copy for a denial. Deliberately vague: the reason is logged
 * server-side, but telling an unauthenticated caller which check failed maps
 * out the provisioning state of other people's accounts. */
export function portalDenialMessage(reason: PortalDenialReason) {
  if (reason === "email_unverified") {
    return "Verify your email address from the Firebase verification message, then sign in again.";
  }
  return "This account does not have KCPL portal access. Contact your KCPL account manager.";
}
