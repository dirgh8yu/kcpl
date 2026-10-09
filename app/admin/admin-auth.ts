import { cookies } from "next/headers";
import { firebaseAdminAuth, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { adminSecurityConfigurationValid } from "./admin-security-config";
import { qaAuthBypassEnabled, qaAuthBypassIdentity } from "./qa-auth-bypass";
import { canBootstrapEmptyStaffDirectory, staffProfileByUid } from "./staff-directory.server";
import { bearerToken } from "../bearer-token";
import { twoStepRequiredForRole } from "./two-step-policy";
import { twoStepStatus } from "./two-step.server";

export const ADMIN_SESSION_COOKIE = "kcpl_admin_session";
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/** A browser trusted for 30 days after the second step. */
export const ADMIN_TRUSTED_DEVICE_COOKIE = "kcpl_admin_device";
/** The Ops app's equivalent of the trusted-browser cookie. */
export const TWO_STEP_DEVICE_HEADER = "x-kcpl-two-step";

export type AdminUser = {
  uid: string;
  displayName: string;
  email: string;
};

export type AdminAccess =
  | { kind: "signed-out" }
  | { kind: "unconfigured" }
  /** Password accepted; the role needs a second step that this session hasn't passed. Nothing is open to it yet. */
  | { kind: "two-step"; step: "enrol" | "verify"; pending: AdminUser }
  | { kind: "authorized"; user: AdminUser };

function allowedAdminEmails() {
  return new Set(
    (process.env.KCPL_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function previewQaAccess(): AdminAccess | null {
  if (!qaAuthBypassEnabled()) return null;
  return { kind: "authorized", user: qaAuthBypassIdentity() };
}

export function firebaseAdminConfigured() {
  return firebaseRuntimeConfigured() && adminSecurityConfigurationValid();
}

export function isAllowedAdminEmail(email: string | undefined | null) {
  if (!email) return false;
  return allowedAdminEmails().has(email.trim().toLowerCase());
}

/** The staff member's role when they may sign in, or null. */
async function authorizedAdminRole(uid: string, email: string | undefined | null) {
  if (!email) return null;
  try {
    // Once a persisted profile exists, it is authoritative even when the email is
    // present in KCPL_ADMIN_EMAILS. The environment allowlist is bootstrap-only.
    const profile = await staffProfileByUid(uid, email);
    if (profile) return profile.active ? profile.role : null;
    if (!isAllowedAdminEmail(email)) return null;
    // The bootstrap account is Management's.
    return await canBootstrapEmptyStaffDirectory(email) ? "management" : null;
  } catch {
    // Firebase/profile lookup failures must never turn an allowlisted email into a
    // fallback Management principal.
    return null;
  }
}

export async function isAuthorizedAdminUser(uid: string, email: string | undefined | null) {
  return await authorizedAdminRole(uid, email) !== null;
}

/**
 * Management and Accounts issue credit notes and approve refunds, so a
 * password alone doesn't open the app to them: the session or device must
 * also have passed the second step. Any failure reading it keeps them out.
 */
async function withTwoStep(user: AdminUser, role: string, sessionToken: string | null, deviceToken: string | null): Promise<AdminAccess> {
  if (!twoStepRequiredForRole(role)) return { kind: "authorized", user };
  try {
    const status = await twoStepStatus(user.uid, sessionToken, deviceToken);
    return status === "verified" ? { kind: "authorized", user } : { kind: "two-step", step: status, pending: user };
  } catch (error) {
    console.error("KCPL two-step check failed", error);
    return { kind: "signed-out" };
  }
}

export async function getAdminAccess(): Promise<AdminAccess> {
  const previewAccess = previewQaAccess();
  if (previewAccess) return previewAccess;

  if (!firebaseAdminConfigured()) return { kind: "unconfigured" };

  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? "";
  if (!session) return { kind: "signed-out" };

  try {
    const decoded = await firebaseAdminAuth().verifySessionCookie(session, true);
    const role = await authorizedAdminRole(decoded.uid, decoded.email);
    if (!role) return { kind: "signed-out" };
    const user = {
      uid: decoded.uid,
      email: decoded.email ?? "",
      displayName: decoded.name?.trim() || decoded.email?.split("@")[0] || "KCPL Staff",
    };
    return await withTwoStep(user, role, session, cookieStore.get(ADMIN_TRUSTED_DEVICE_COOKIE)?.value || null);
  } catch {
    return { kind: "signed-out" };
  }
}

/**
 * The staff app's counterpart to `getAdminAccess`. It presents a Firebase ID
 * token as `Authorization: Bearer` because a phone app cannot hold the
 * HttpOnly session cookie. Only how the credential arrives differs. The token
 * is verified with revocation checked, and the same `isAuthorizedAdminUser`
 * decides, so an inactive or removed staff profile is refused exactly as it is
 * on the web. Branch scope and role come from `getStaffContext` in the route,
 * as they do for every admin route.
 */
export async function getAdminAccessFromBearer(request: Request): Promise<AdminAccess> {
  // Mirrors the cookie path, fenced the same way; see qa-auth-bypass.ts.
  const previewAccess = previewQaAccess();
  if (previewAccess) return previewAccess;

  if (!firebaseAdminConfigured()) return { kind: "unconfigured" };

  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return { kind: "signed-out" };

  try {
    // `true` checks revocation: disabling a staff login in Firebase locks the
    // app out on its next request, not when the token's hour runs out.
    const decoded = await firebaseAdminAuth().verifyIdToken(token, true);
    const role = await authorizedAdminRole(decoded.uid, decoded.email);
    if (!role) return { kind: "signed-out" };
    const user = {
      uid: decoded.uid,
      email: decoded.email ?? "",
      displayName: decoded.name?.trim() || decoded.email?.split("@")[0] || "KCPL Staff",
    };
    // The app holds a device token from its own second step instead of a cookie.
    return await withTwoStep(user, role, null, request.headers.get(TWO_STEP_DEVICE_HEADER)?.trim() || null);
  } catch {
    return { kind: "signed-out" };
  }
}

export function adminSessionCookie(token: string) {
  return `${ADMIN_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}`;
}

export function clearAdminSessionCookie() {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function trustedDeviceCookie(token: string, maxAgeMs: number) {
  return `${ADMIN_TRUSTED_DEVICE_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}`;
}
