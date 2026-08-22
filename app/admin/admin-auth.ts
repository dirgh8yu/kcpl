import { cookies } from "next/headers";
import { firebaseAdminAuth, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { adminSecurityConfigurationValid } from "./admin-security-config";
import { canBootstrapEmptyStaffDirectory, staffProfileByUid } from "./staff-directory.server";

export const ADMIN_SESSION_COOKIE = "kcpl_admin_session";
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type AdminUser = {
  uid: string;
  displayName: string;
  email: string;
};

export type AdminAccess =
  | { kind: "signed-out" }
  | { kind: "unconfigured" }
  | { kind: "authorized"; user: AdminUser };

function allowedAdminEmails() {
  return new Set(
    (process.env.KCPL_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function firebaseAdminConfigured() {
  return firebaseRuntimeConfigured() && adminSecurityConfigurationValid();
}

export function isAllowedAdminEmail(email: string | undefined | null) {
  if (!email) return false;
  return allowedAdminEmails().has(email.trim().toLowerCase());
}

export async function isAuthorizedAdminUser(uid: string, email: string | undefined | null) {
  if (!email) return false;
  try {
    // Once a persisted profile exists, it is authoritative even when the email is
    // present in KCPL_ADMIN_EMAILS. The environment allowlist is bootstrap-only.
    const profile = await staffProfileByUid(uid, email);
    if (profile) return profile.active;
    if (!isAllowedAdminEmail(email)) return false;
    return await canBootstrapEmptyStaffDirectory(email);
  } catch {
    // Firebase/profile lookup failures must never turn an allowlisted email into a
    // fallback Management principal.
    return false;
  }
}

export async function getAdminAccess(): Promise<AdminAccess> {
  if (!firebaseAdminConfigured()) return { kind: "unconfigured" };

  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? "";
  if (!session) return { kind: "signed-out" };

  try {
    const decoded = await firebaseAdminAuth().verifySessionCookie(session, true);
    if (!await isAuthorizedAdminUser(decoded.uid, decoded.email)) return { kind: "signed-out" };

    return {
      kind: "authorized",
      user: {
        uid: decoded.uid,
        email: decoded.email ?? "",
        displayName: decoded.name?.trim() || decoded.email?.split("@")[0] || "KCPL Staff",
      },
    };
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
