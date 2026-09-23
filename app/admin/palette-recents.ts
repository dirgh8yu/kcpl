/**
 * Recent items for the ⌘K command palette. A launcher convenience stored per
 * device (NOT session-critical state — feature-gating anchors live server-side
 * by design), so localStorage is the right home: the palette must render
 * instantly with zero network round-trips.
 *
 * Entries are deduped by href, most-recent-first, capped at 8, and every
 * stored payload is validated on read so a stale or corrupted entry can never
 * render as a broken row.
 */

const STORAGE_KEY = "kcpl.admin.palette.recents";
const MAX_RECENTS = 8;

/** Minimal storage surface the palette needs (tests inject fakes). */
type RecentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type RecentKind = "workspace" | "action" | "shipment" | "customer" | "quote" | "order" | "tender" | "partner" | "payable";

export type PaletteRecent = {
  title: string;
  subtitle: string;
  href: string;
  kind: RecentKind;
  /** Workspace id when the entry belongs to a navigable workspace ("shipments", …). */
  workspaceId?: string;
  savedAt: number;
};

export function readRecents(storage: RecentStorage = window.localStorage): PaletteRecent[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const recents: PaletteRecent[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Partial<PaletteRecent>;
      if (typeof entry.href !== "string" || !entry.href.startsWith("/admin")) continue;
      if (typeof entry.title !== "string" || !entry.title) continue;
      if (typeof entry.kind !== "string") continue;
      if (seen.has(entry.href)) continue;
      seen.add(entry.href);
      recents.push({
        title: entry.title.slice(0, 120),
        subtitle: typeof entry.subtitle === "string" ? entry.subtitle.slice(0, 160) : "",
        href: entry.href,
        kind: entry.kind as RecentKind,
        workspaceId: typeof entry.workspaceId === "string" ? entry.workspaceId : undefined,
        savedAt: typeof entry.savedAt === "number" ? entry.savedAt : 0,
      });
      if (recents.length >= MAX_RECENTS) break;
    }
    return recents;
  } catch {
    return [];
  }
}

export function pushRecent(entry: Omit<PaletteRecent, "savedAt">, storage: RecentStorage = window.localStorage): PaletteRecent[] {
  const stamped: PaletteRecent = { ...entry, savedAt: Date.now() };
  const next = [stamped, ...readRecents(storage).filter((item) => item.href !== stamped.href)].slice(0, MAX_RECENTS);
  try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode / quota — recents are best-effort */ }
  return next;
}

export function removeRecent(href: string, storage: RecentStorage = window.localStorage): PaletteRecent[] {
  const next = readRecents(storage).filter((item) => item.href !== href);
  try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* best-effort */ }
  return next;
}

export function clearRecents(storage: RecentStorage = window.localStorage): void {
  try { storage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
}
