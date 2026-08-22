import { firebaseAdminAuth, firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { resolveStaffAuthority, type StaffDirectoryState } from "./staff-authority-policy";
import { kcplBranches, type KcplBranch } from "./crm/crm-data";
import {
  kcplStaffRoles,
  staffCapabilitiesForRole,
  type KcplStaffRole,
} from "./staff-permissions";
import type { KcplStaffContext, KcplStaffProfile, StaffProfileInput } from "./staff-directory";
export type { KcplStaffContext } from "./staff-directory";

type StaffUser = { uid: string; email: string; displayName: string };
type Actor = { name: string; email: string };

export type StaffIdentitySnapshot = {
  uid?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type ResolvedStaffIdentity = {
  uid: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  role: KcplStaffRole | null;
  branch_scope: "all" | "selected" | null;
  branches: KcplBranch[];
  active: boolean | null;
  resolved_from_directory: boolean;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function roleValue(value: unknown): KcplStaffRole | null {
  return kcplStaffRoles.includes(value as KcplStaffRole) ? value as KcplStaffRole : null;
}

function branchScopeValue(value: unknown): "all" | "selected" | null {
  return value === "all" || value === "selected" ? value : null;
}

function branchList(value: unknown): KcplBranch[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch)))];
}

/**
 * Persisted staff state is the authorization authority once a profile exists.
 * Malformed roles, scopes, branch lists or active flags fail closed instead of
 * inheriting environment-configured authority or organization-wide scope.
 */
function profileFromData(uid: string, data: Record<string, unknown>): KcplStaffProfile | null {
  const role = roleValue(data.role);
  const scope = branchScopeValue(data.branch_scope);
  if (!role || !scope || typeof data.active !== "boolean" || !Array.isArray(data.branches)) return null;
  if (data.branches.some((item) => !kcplBranches.includes(item as KcplBranch))) return null;
  const branches = branchList(data.branches);
  if (scope === "selected" && branches.length === 0) return null;
  const email = text(data.email).trim().toLowerCase();
  if (!email) return null;

  return {
    uid,
    email,
    display_name: text(data.display_name, email.split("@")[0] || "KCPL Staff"),
    job_title: nullable(data.job_title),
    phone: nullable(data.phone),
    role,
    branch_scope: scope,
    branches,
    active: data.active,
    created_at: text(data.created_at),
    updated_at: text(data.updated_at),
    updated_by: nullable(data.updated_by),
  };
}

function configuredAdminEmails() {
  return new Set(
    (process.env.KCPL_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isConfiguredAdmin(email: string) {
  return configuredAdminEmails().has(email.trim().toLowerCase());
}

async function staffDirectoryState(): Promise<StaffDirectoryState> {
  if (!firebaseRuntimeConfigured()) return "unavailable";
  try {
    const snapshot = await firebaseAdminDb().collection("staff_profiles").limit(1).get();
    return snapshot.empty ? "empty" : "nonempty";
  } catch {
    return "unavailable";
  }
}

/**
 * KCPL_ADMIN_EMAILS is a bootstrap mechanism only. It may establish the first
 * Management account while Firestore positively confirms the directory is empty.
 * A lookup failure is not equivalent to an empty directory.
 */
export async function canBootstrapEmptyStaffDirectory(email: string) {
  const decision = resolveStaffAuthority({
    profile: { exists: false },
    configuredBootstrap: isConfiguredAdmin(email),
    directoryState: await staffDirectoryState(),
  });
  return decision.kind === "bootstrap";
}

export async function staffProfileByUid(uid: string, _email = "") {
  if (!firebaseRuntimeConfigured() || !uid.trim()) return null;
  const snapshot = await firebaseAdminDb().collection("staff_profiles").doc(uid.trim()).get();
  if (!snapshot.exists) return null;
  return profileFromData(uid.trim(), snapshot.data() as Record<string, unknown>);
}

export async function staffProfileByEmail(email: string) {
  if (!firebaseRuntimeConfigured()) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const snapshot = await firebaseAdminDb().collection("staff_profiles").where("email", "==", normalized).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return profileFromData(doc.id, doc.data() as Record<string, unknown>);
}

export function resolveStaffIdentityFromProfiles(
  snapshot: StaffIdentitySnapshot,
  profiles: KcplStaffProfile[],
): ResolvedStaffIdentity {
  const uid = snapshot.uid?.trim() || "";
  const email = snapshot.email?.trim().toLowerCase() || "";
  const name = snapshot.name?.trim() || "";
  let profile = uid ? profiles.find((item) => item.uid === uid) : undefined;
  if (!profile && email) profile = profiles.find((item) => item.email.toLowerCase() === email);
  if (!profile && name) {
    const matches = profiles.filter((item) => item.display_name.trim().toLowerCase() === name.toLowerCase());
    if (matches.length === 1) profile = matches[0];
  }

  if (profile) {
    return {
      uid: profile.uid,
      name: profile.display_name,
      email: profile.email,
      phone: profile.phone,
      job_title: profile.job_title,
      role: profile.role,
      branch_scope: profile.branch_scope,
      branches: profile.branches,
      active: profile.active,
      resolved_from_directory: true,
    };
  }

  return {
    uid: uid || null,
    name: name || null,
    email: email || null,
    phone: snapshot.phone?.trim() || null,
    job_title: null,
    role: null,
    branch_scope: null,
    branches: [],
    active: null,
    resolved_from_directory: false,
  };
}

export async function resolveStaffIdentity(snapshot: StaffIdentitySnapshot) {
  if (!firebaseRuntimeConfigured()) return resolveStaffIdentityFromProfiles(snapshot, []);
  const uid = snapshot.uid?.trim() || "";
  const email = snapshot.email?.trim().toLowerCase() || "";
  const direct = uid ? await staffProfileByUid(uid, email) : email ? await staffProfileByEmail(email) : null;
  return resolveStaffIdentityFromProfiles(snapshot, direct ? [direct] : []);
}

export async function isActiveStaffProfile(uid: string, email: string) {
  const profile = await staffProfileByUid(uid, email);
  return Boolean(profile?.active);
}

export async function getStaffContext(user: StaffUser): Promise<KcplStaffContext> {
  if (!firebaseRuntimeConfigured()) throw new Error("Staff directory is unavailable");
  const uid = user.uid.trim();
  if (!uid) throw new Error("Staff profile is required");

  let snapshot: FirebaseFirestore.DocumentSnapshot;
  try {
    snapshot = await firebaseAdminDb().collection("staff_profiles").doc(uid).get();
  } catch {
    throw new Error("Staff directory is unavailable");
  }

  if (snapshot.exists) {
    const raw = snapshot.data() as Record<string, unknown>;
    const decision = resolveStaffAuthority({
      profile: {
        exists: true,
        active: raw.active,
        role: raw.role,
        branchScope: raw.branch_scope,
        branches: raw.branches,
      },
      configuredBootstrap: isConfiguredAdmin(user.email),
      directoryState: "nonempty",
    });
    if (decision.kind !== "profile") throw new Error("Staff profile is not authorized");
    const profile = profileFromData(uid, raw);
    if (!profile) throw new Error("Staff profile is not authorized");
    const permissions = staffCapabilitiesForRole(decision.role);
    // KCPL policy: a valid persisted Management role is intentionally organization-wide.
    // Management does not bypass malformed record branches; branch helpers still fail closed.
    const canAccessAll = decision.role === "management" || decision.branchScope === "all";
    return {
      profile,
      permissions,
      can_access_all_branches: canAccessAll,
      branches: canAccessAll ? [...kcplBranches] : decision.branches,
    };
  }

  const decision = resolveStaffAuthority({
    profile: { exists: false },
    configuredBootstrap: isConfiguredAdmin(user.email),
    directoryState: await staffDirectoryState(),
  });
  if (decision.kind !== "bootstrap") {
    if (decision.kind === "denied" && decision.reason === "directory_unavailable") {
      throw new Error("Staff directory is unavailable");
    }
    throw new Error("Staff profile is required");
  }

  const bootstrapProfile: KcplStaffProfile = {
    uid,
    email: user.email.toLowerCase(),
    display_name: user.displayName,
    job_title: null,
    phone: null,
    role: decision.role,
    branch_scope: decision.branchScope,
    branches: decision.branches,
    active: true,
    created_at: "",
    updated_at: "",
    updated_by: null,
  };
  return {
    profile: bootstrapProfile,
    permissions: staffCapabilitiesForRole(decision.role),
    can_access_all_branches: true,
    branches: decision.branches,
  };
}

export function staffCanAccessBranch(context: KcplStaffContext, branch: string | null | undefined) {
  if (!branch || !kcplBranches.includes(branch as KcplBranch)) return false;
  return context.can_access_all_branches || context.branches.includes(branch as KcplBranch);
}

export async function listStaffProfiles() {
  if (!firebaseRuntimeConfigured()) return null;
  const snapshot = await firebaseAdminDb().collection("staff_profiles").orderBy("display_name", "asc").limit(500).get();
  return snapshot.docs
    .map((doc) => profileFromData(doc.id, doc.data() as Record<string, unknown>))
    .filter((profile): profile is KcplStaffProfile => profile !== null);
}

async function matchingAssignmentRefs(
  base: FirebaseFirestore.Query,
  uidField: string,
  emailField: string,
  uid: string,
  emails: string[],
) {
  const snapshots = await Promise.all([
    base.where(uidField, "==", uid).limit(5000).get(),
    ...emails.map((email) => base.where(emailField, "==", email).limit(5000).get()),
  ]);
  const refs = new Map<string, FirebaseFirestore.DocumentReference>();
  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) refs.set(doc.ref.path, doc.ref);
  }
  return [...refs.values()];
}

async function updateAssignmentRefs(refs: FirebaseFirestore.DocumentReference[], update: Record<string, unknown>) {
  const db = firebaseAdminDb();
  for (let offset = 0; offset < refs.length; offset += 400) {
    const batch = db.batch();
    for (const ref of refs.slice(offset, offset + 400)) batch.update(ref, update);
    await batch.commit();
  }
  return refs.length;
}

export async function synchronizeStaffIdentityAssignments(profile: KcplStaffProfile, previousEmail = "") {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const, updated: 0 };
  const db = firebaseAdminDb();
  const emails = [...new Set([profile.email, previousEmail].map((value) => value.trim().toLowerCase()).filter(Boolean))];
  const identity = {
    uid: profile.uid,
    name: profile.display_name,
    email: profile.email,
    phone: profile.phone,
  };

  const [quotes, shipments, jobTasks, customers, crmTasks] = await Promise.all([
    matchingAssignmentRefs(db.collection("quotes"), "assigned_to_uid", "assigned_to_email", profile.uid, emails),
    matchingAssignmentRefs(db.collection("shipments"), "job_assigned_to_uid", "job_assigned_to_email", profile.uid, emails),
    matchingAssignmentRefs(db.collectionGroup("job_tasks"), "assigned_to_uid", "assigned_to_email", profile.uid, emails),
    matchingAssignmentRefs(db.collection("customers"), "account_manager_uid", "account_manager_email", profile.uid, emails),
    matchingAssignmentRefs(db.collectionGroup("tasks"), "assigned_to_uid", "assigned_to_email", profile.uid, emails),
  ]);

  const counts = await Promise.all([
    updateAssignmentRefs(quotes, {
      assigned_to_uid: identity.uid,
      assigned_to: identity.name || identity.email,
      assigned_to_name: identity.name,
      assigned_to_email: identity.email,
      assigned_to_phone: identity.phone,
    }),
    updateAssignmentRefs(shipments, {
      job_assigned_to_uid: identity.uid,
      job_assigned_to_name: identity.name,
      job_assigned_to_email: identity.email,
      job_assigned_to_phone: identity.phone,
    }),
    updateAssignmentRefs(jobTasks, {
      assigned_to_uid: identity.uid,
      assigned_to_name: identity.name,
      assigned_to_email: identity.email,
      assigned_to_phone: identity.phone,
    }),
    updateAssignmentRefs(customers, {
      account_manager_uid: identity.uid,
      account_manager_name: identity.name,
      account_manager_email: identity.email,
      account_manager_phone: identity.phone,
    }),
    updateAssignmentRefs(crmTasks, {
      assigned_to_uid: identity.uid,
      assigned_to_name: identity.name,
      assigned_to_email: identity.email,
      assigned_to_phone: identity.phone,
    }),
  ]);

  return { kind: "updated" as const, updated: counts.reduce((sum, count) => sum + count, 0) };
}

export async function ensureStaffAssignmentUidMigration(profiles?: KcplStaffProfile[]) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const, migrated: 0 };
  const db = firebaseAdminDb();
  const markerRef = db.collection("system_migrations").doc("staff_assignment_identity_v1");
  const marker = await markerRef.get();
  if (marker.exists && marker.get("completed") === true) return { kind: "ready" as const, migrated: 0 };

  const directory = profiles ?? await listStaffProfiles();
  if (!directory) return { kind: "unavailable" as const, migrated: 0 };
  let migrated = 0;
  for (const profile of directory) {
    const result = await synchronizeStaffIdentityAssignments(profile, profile.email);
    migrated += result.updated;
  }
  await markerRef.set({ completed: true, completed_at: new Date().toISOString(), migrated_records: migrated }, { merge: true });
  return { kind: "completed" as const, migrated };
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
  const previousEmail = previous.exists ? text(previous.get("email")).trim().toLowerCase() : "";
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
  const profile = profileFromData(authUser.uid, document);
  if (!profile) throw new Error("Saved staff profile failed runtime authorization validation");
  try {
    await synchronizeStaffIdentityAssignments(profile, previousEmail);
  } catch (error) {
    console.error("KCPL staff identity synchronization failed", profile.uid, error);
  }
  return { kind: previous.exists ? "updated" as const : "created" as const, profile };
}

export async function deactivateStaffProfile(uid: string, actor: Actor) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const ref = firebaseAdminDb().collection("staff_profiles").doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  await ref.update({ active: false, updated_at: new Date().toISOString(), updated_by: actor.email });
  return { kind: "updated" as const };
}
