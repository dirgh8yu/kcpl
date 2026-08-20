import { cookies } from "next/headers";
import { firebaseAdminAuth } from "../firebase-admin.server";

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
  return Boolean(
    (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
    allowedAdminEmails().size,
  );
}

export function isAllowedAdminEmail(email: string | undefined | null) {
  if (!email) return false;
  return allowedAdminEmails().has(email.trim().toLowerCase());
}

export async function getAdminAccess(): Promise<AdminAccess> {
  if (!firebaseAdminConfigured()) return { kind: "unconfigured" };

  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? "";
  if (!session) return { kind: "signed-out" };

  try {
    const decoded = await firebaseAdminAuth().verifySessionCookie(session, true);
    if (!isAllowedAdminEmail(decoded.email)) return { kind: "signed-out" };

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
