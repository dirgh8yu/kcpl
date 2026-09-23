/**
 * Sidebar group collapse memory. Remembers which navigation groups the user
 * manually collapsed/expanded on THIS device (launcher state, not
 * session-critical — same rationale as palette-recents), so a peeked group
 * stays open across reloads.
 *
 * Stored as a flat array of collapsed group names. `null` means "no stored
 * preference" — the shell then falls back to its context-first derivation
 * (only the active workspace's group open). Navigation between groups
 * re-derives the arrangement; only manual toggles are persisted.
 */

const STORAGE_KEY = "kcpl.admin.sidebar.collapsedGroups";
const MAX_GROUPS = 10;

/** Minimal storage surface the shell needs (tests inject fakes). */
type GroupStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Returns the remembered collapsed groups, or null when nothing is stored. */
export function readManualCollapses(storage: GroupStorage = window.localStorage): string[] | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const groups: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string" || !item || groups.includes(item)) continue;
      groups.push(item);
      if (groups.length >= MAX_GROUPS) break;
    }
    return groups;
  } catch {
    return null;
  }
}

export function writeManualCollapses(groups: readonly string[], storage: GroupStorage = window.localStorage): void {
  const unique = groups.filter((group, index) => typeof group === "string" && group && groups.indexOf(group) === index).slice(0, MAX_GROUPS);
  try { storage.setItem(STORAGE_KEY, JSON.stringify(unique)); } catch { /* private mode / quota — best-effort */ }
}

export function clearManualCollapses(storage: GroupStorage = window.localStorage): void {
  try { storage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
}
