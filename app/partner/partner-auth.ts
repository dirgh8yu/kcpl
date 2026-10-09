import { cookies } from "next/headers";
import { firebaseAdminAuth, firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { adminSecurityConfigurationValid } from "../admin/admin-security-config";
import { decidePartnerAccount, normalizePartnerEmail } from "./partner-access-policy";

/**
 * The partner portal session: its own cookie and resolver, separate from the
 * staff and customer sessions, so a partner session can never be presented
 * to a staff or customer route and the other way round.
 */
export const PARTNER_SESSION_COOKIE = "kcpl_partner_session";
export const PARTNER_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const PARTNER_ACCOUNTS = "partner_accounts";

export type PartnerSession = { uid: string; email: string; displayName: string; partnerId: string; partnerName: string };
export type PartnerAccess = { kind: "signed-out" } | { kind: "unconfigured" } | { kind: "authorized"; session: PartnerSession };

export function partnerRuntimeConfigured() {
  return firebaseRuntimeConfigured() && adminSecurityConfigurationValid();
}

/** Decide a verified Firebase identity against its partner account; binds the account to the first sign-in that uses it. */
export async function authorizePartnerIdentity(identity: { uid: string; email: string; emailVerified: boolean; name?: string }, bind = false) {
  const email = normalizePartnerEmail(identity.email);
  if (!email) return { kind: "denied" as const, reason: "no_account" as const };
  const db = firebaseAdminDb();
  const account = await db.collection(PARTNER_ACCOUNTS).doc(email).get();
  const partnerId = typeof account.get("partner_id") === "string" ? account.get("partner_id") as string : "";
  const partner = partnerId ? await db.collection("partners").doc(partnerId).get() : null;
  const decision = decidePartnerAccount(
    { uid: identity.uid, email, emailVerified: identity.emailVerified },
    { exists: account.exists, active: account.get("active"), uid: account.get("uid"), partner_id: partnerId, partner_name: account.get("partner_name") },
    { exists: Boolean(partner?.exists), status: partner?.get("status") },
  );
  if (decision.kind === "denied") return decision;
  if (bind) {
    const now = new Date().toISOString();
    await account.ref.update({ ...(decision.bindUid ? { uid: identity.uid } : {}), last_sign_in_at: now }).catch(() => undefined);
  }
  return {
    kind: "authorized" as const,
    session: {
      uid: identity.uid,
      email,
      displayName: identity.name?.trim() || (typeof account.get("name") === "string" && account.get("name")) || email.split("@")[0],
      partnerId: decision.partnerId,
      partnerName: typeof partner?.get("display_name") === "string" ? partner.get("display_name") as string : decision.partnerName,
    },
  };
}

export async function getPartnerAccess(): Promise<PartnerAccess> {
  if (!partnerRuntimeConfigured()) return { kind: "unconfigured" };
  const session = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? "";
  if (!session) return { kind: "signed-out" };
  try {
    const decoded = await firebaseAdminAuth().verifySessionCookie(session, true);
    const result = await authorizePartnerIdentity({ uid: decoded.uid, email: decoded.email ?? "", emailVerified: decoded.email_verified === true, name: decoded.name });
    return result.kind === "authorized" ? result : { kind: "signed-out" };
  } catch {
    return { kind: "signed-out" };
  }
}

export function partnerSessionCookie(token: string) {
  return `${PARTNER_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(PARTNER_SESSION_TTL_MS / 1000)}`;
}

export function clearPartnerSessionCookie() {
  return `${PARTNER_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
