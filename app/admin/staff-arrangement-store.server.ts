import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { ArrangementState, SavedLayout, WorkspaceKey } from "@/app/admin/operations-arrangeable";
import { normalizeArrangementFor, normalizeSavedLayouts } from "@/app/admin/operations-arrangeable";
import { firebaseAdminDb } from "@/app/firebase-admin.server";

const COLLECTION = "staff_layouts";

function docFor(staffId: string, workspace: WorkspaceKey): FirebaseFirestore.DocumentReference {
  const db = (firebaseAdminDb() as Firestore) ?? getFirestore();
  return db.collection(COLLECTION).doc(`${staffId}:${workspace}`);
}

/** Legacy single-workspace doc id (the Overview before it was namespaced). */
const LEGACY_DOC_SUFFIX = "";

export type StaffArrangementDocument = {
  arrangement: ArrangementState;
  saved: SavedLayout[];
};

export async function readStaffArrangement(staffId: string, workspace: WorkspaceKey): Promise<StaffArrangementDocument> {
  try {
    const db = (firebaseAdminDb() as Firestore) ?? getFirestore();
    let snapshot = await docFor(staffId, workspace).get();
    if (!snapshot.exists && workspace === "overview") {
      // Back-compat: layouts saved before workspaces were namespaced live in
      // the unprefixed document; read it rather than resetting the user.
      snapshot = await db.collection(COLLECTION).doc(`${staffId}${LEGACY_DOC_SUFFIX}`).get();
    }
    if (!snapshot.exists) {
      return { arrangement: normalizeArrangementFor(workspace, null), saved: [] };
    }
    const data = snapshot.data() ?? {};
    return {
      arrangement: normalizeArrangementFor(workspace, data),
      saved: normalizeSavedLayouts(workspace, data.saved),
    };
  } catch (error) {
    console.error("Failed to read staff arrangement", error);
    return { arrangement: normalizeArrangementFor(workspace, null), saved: [] };
  }
}

export async function writeStaffArrangement(
  staffId: string,
  workspace: WorkspaceKey,
  state: ArrangementState,
  saved?: SavedLayout[],
): Promise<{ arrangement: ArrangementState; saved: SavedLayout[] }> {
  const normalized = normalizeArrangementFor(workspace, state);
  const normalizedSaved = normalizeSavedLayouts(workspace, saved ?? []);
  try {
    await docFor(staffId, workspace).set(
      {
        order: normalized.order,
        hidden: normalized.hidden,
        saved: normalizedSaved.map((entry) => ({ id: entry.id, name: entry.name, order: entry.order, hidden: entry.hidden })),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Failed to write staff arrangement", error);
    throw error;
  }
  return { arrangement: normalized, saved: normalizedSaved };
}
