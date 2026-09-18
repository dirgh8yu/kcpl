import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { mockOperationalNote, qaMockDataEnabled } from "../qa-fixtures";

export type OperationalNote = {
  id: string;
  message: string;
  branch: KcplBranch | null;
  created_at: string;
  created_by_name: string;
  created_by_email: string;
};

type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function branchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
}

function noteFromDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): OperationalNote | null {
  const message = text(doc.get("message")).trim();
  const createdAt = text(doc.get("created_at"));
  if (!message || !createdAt) return null;
  return {
    id: doc.id,
    message,
    branch: branchValue(doc.get("branch")),
    created_at: createdAt,
    created_by_name: text(doc.get("created_by_name"), "KCPL Operations"),
    created_by_email: text(doc.get("created_by_email")),
  };
}

function visible(note: OperationalNote, context: KcplStaffContext) {
  if (!note.branch) return true;
  return staffCanAccessBranch(context, note.branch);
}

export async function getLatestOperationalNote(context: KcplStaffContext): Promise<OperationalNote | null> {
  if (qaMockDataEnabled()) return mockOperationalNote(context.branches[0] ?? null);
  if (!firebaseRuntimeConfigured()) return null;
  const snapshot = await firebaseAdminDb().collection("operational_notes").orderBy("created_at", "desc").limit(100).get();
  for (const doc of snapshot.docs) {
    const note = noteFromDoc(doc);
    if (note && visible(note, context)) return note;
  }
  return null;
}

export async function createOperationalNote(
  input: { message: string; branch?: string | null },
  actor: Actor,
  context: KcplStaffContext,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageJobFile) return { kind: "forbidden" as const };
  const message = input.message.trim();
  if (message.length < 3 || message.length > 500) return { kind: "invalid_message" as const };
  const requestedBranch = input.branch?.trim() || "";
  const branch = requestedBranch ? branchValue(requestedBranch) : null;
  if (requestedBranch && !branch) return { kind: "invalid_branch" as const };
  if (branch && !staffCanAccessBranch(context, branch)) return { kind: "forbidden" as const };
  if (!branch && !context.can_access_all_branches) return { kind: "branch_required" as const };

  const now = new Date().toISOString();
  const ref = firebaseAdminDb().collection("operational_notes").doc();
  await ref.create({
    message,
    branch,
    created_at: now,
    created_by_name: actor.name || "KCPL Operations",
    created_by_email: actor.email,
  });
  return {
    kind: "created" as const,
    note: {
      id: ref.id,
      message,
      branch,
      created_at: now,
      created_by_name: actor.name || "KCPL Operations",
      created_by_email: actor.email,
    } satisfies OperationalNote,
  };
}
