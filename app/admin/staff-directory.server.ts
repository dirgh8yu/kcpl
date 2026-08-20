import { firebaseAdminAuth, firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "./crm/crm-data";
import {
  kcplStaffRoles,
  staffCapabilitiesForEmail,
  staffCapabilitiesForRole,
  type KcplStaffRole,
} from "./staff-permissions";
import type { KcplStaffContext, KcplStaffProfile, StaffProfileInput } from "./staff-directory";

type StaffUser = { uid: string; email: string; displayName: string };
type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function roleValue(value: unknown, fallback: KcplStaffRole): KcplStaffRole {
  return kcplStaffRoles.includes(value as KcplStaffRole) ? value as KcplStaffRole : fallback;
}

function branchList(value: unknown): KcplBranch[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch));
}

function profileFromData(uid: string, data: Record<string, unknown>, fallbackRole: KcplStaffRole): KcplStaffProfile {
  const scope = data.branch_scope === "selected" ? "selected" : "all";
  return {
    uid,
    email: text(data.email).trim().toLowerCase(),
    display_name: text(data.display_name, text(data.email).split("@")[0] || "KCPL Staff"),
    job_title: nullable(data.job_title),
    phone: nullable(data.phone),
    role: roleValue(data.role, fallbackRole),
    branch_scope: scope,
    branches: branchList(data.branches),
    active: data.active !== false,
    created_at: text(data.created_at),
    updated_at: text(data.updated_at),
    updated_by: nullable(data.updated_by),
  };
}

export async function staffProfileByUid(uid: string, email = "") {
  if (!firebaseRuntimeConfigured()) return null;
  const snapshot = await firebaseAdminDb().collection("staff_profiles").doc(uid).get();
  if (!snapshot.exists) return null;
  return profileFromData(uid, snapshot.data() as Record<string, unknown>, staffCapabilitiesForEmail(email).role);
}

export async function isActiveStaffProfile(uid: string, email: string) {
  const profile = await staffProfileByUid(uid, email);
  return Boolean(profile?.active);
}

export async function getStaffContext(user: StaffUser): Promise<KcplStaffContext> {
  const fallback = staffCapabilitiesForEmail(user.email);
  const profile = await staffProfileByUid(user.uid, user.email);
  const effectiveProfile: KcplStaffProfile = profile ?? {
    uid: user.uid,
    email: user.email.toLowerCase(),
    display_name: user.displayName,
    job_title: null,
    phone: null,
    role: fallback.role,
    branch_scope: "all",
    branches: [...kcplBranches],
    active: true,
    created_at: "",
    updated_at: "",
    updated_by: null,
  };
  const permissions = profile ? staffCapabilitiesForRole(profile.role) : fallback;
  const canAccessAll = effectiveProfile.branch_scope === "all" || effectiveProfile.role === "management";
  return {
    profile: effectiveProfile,
    permissions,
    can_access_all_branches: canAccessAll,
    branches: canAccessAll ? [...kcplBranches] : effectiveProfile.branches,
  };
}

export function staffCanAccessBranch(context: KcplStaffContext, branch: string | null | undefined) {
  if (context.can_access_all_branches) return true;
  if (!branch) return false;
  return context.branches.includes(branch as KcplBranch);
}

export async function listStaffProfiles() {
  if (!firebaseRuntimeConfigured()) return null;
  const snapshot = await firebaseAdminDb().collection("staff_profiles").orderBy("display_name", "asc").limit(500).get();
  return snapshot.docs.map((doc) => profileFromData(doc.id, doc.data() as Record<string, unknown>, "operations"));
}

export async function saveStaffProfile(input: StaffProfileInput, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const email = input.email.trim().toLowerCase();
  let authUser;
  try {
    authUser = await firebaseAdminAuth().getUserByEmail(email);
  } catch {
    return { kind: "missing_auth_user" as const };
  }

  const db = firebaseAdminDb();
  const ref = db.collection("staff_profiles").doc(authUser.uid);
  const previous = await ref.get();
  const now = new Date().toISOString();
  const branches = input.branchScope === "all"
    ? [...kcplBranches]
    : input.branches.filter((branch) => kcplBranches.includes(branch));
  const document = {
    uid: authUser.uid,
    email,
    display_name: input.displayName.trim() || authUser.displayName?.trim() || email.split("@")[0],
    job_title: input.jobTitle.trim() || null,
    phone: input.phone.trim() || null,
    role: input.role,
    branch_scope: input.branchScope,
    branches,
    active: input.active,
    created_at: previous.exists ? text(previous.get("created_at"), now) : now,
    updated_at: now,
    updated_by: actor.email,
  };
  await ref.set(document, { merge: true });
  return { kind: previous.exists ? "updated" as const : "created" as const, profile: profileFromData(authUser.uid, document, input.role) };
}

export async function deactivateStaffProfile(uid: string, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const ref = firebaseAdminDb().collection("staff_profiles").doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  await ref.update({ active: false, updated_at: new Date().toISOString(), updated_by: actor.email });
  return { kind: "updated" as const };
}
