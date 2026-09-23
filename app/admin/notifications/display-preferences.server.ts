import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { defaultDisplayPreferences, displayDensities, displayMotions, type DisplayPreferences } from "./display-preferences";

/** Firestore store for the per-staff display preferences (account panel's
 * Display tab). Mirrors staff_notification_settings: unconfigured runtime
 * falls back to defaults, an unconfigured save reports unavailable, and every
 * write merges so a partial document never wipes the other field. */

function prefsFromData(data: Record<string, unknown> | undefined): DisplayPreferences {
  const defaults = defaultDisplayPreferences();
  if (!data) return defaults;
  const rawDensity = typeof data.density === "string" ? data.density : "";
  const rawMotion = typeof data.motion === "string" ? data.motion : "";
  return {
    density: displayDensities.includes(rawDensity as DisplayPreferences["density"])
      ? rawDensity as DisplayPreferences["density"]
      : defaults.density,
    motion: displayMotions.includes(rawMotion as DisplayPreferences["motion"])
      ? rawMotion as DisplayPreferences["motion"]
      : defaults.motion,
  };
}

export async function getDisplayPreferences(uid: string): Promise<DisplayPreferences> {
  if (!firebaseRuntimeConfigured()) return defaultDisplayPreferences();
  const snapshot = await firebaseAdminDb().collection("staff_display_settings").doc(uid).get();
  return prefsFromData(snapshot.exists ? snapshot.data() as Record<string, unknown> : undefined);
}

export async function saveDisplayPreferences(uid: string, preferences: DisplayPreferences) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  await firebaseAdminDb().collection("staff_display_settings").doc(uid).set({
    density: preferences.density,
    motion: preferences.motion,
    updated_at: new Date().toISOString(),
  }, { merge: true });
  return { kind: "updated" as const, preferences };
}

/** Clears the stored doc so the operator is back to the never-customised
 * state. Firestore deletes are idempotent on missing docs, and every reader
 * falls back to defaults on an absent document. */
export async function clearDisplayPreferences(uid: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  await firebaseAdminDb().collection("staff_display_settings").doc(uid).delete();
  return { kind: "updated" as const };
}
