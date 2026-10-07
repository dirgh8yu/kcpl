import type { WorkspaceHubId } from "./workflow-navigation";

/** A section the person can open, and the letter that follows "g" to get there. */
export type ShortcutHub = { id: WorkspaceHubId; label: string; href: string; key?: string };

/** After "g": the day-to-day sections. Reports and Settings stay a click away. */
export const GO_KEYS: Partial<Record<WorkspaceHubId, string>> = {
  overview: "o",
  inbox: "i",
  shipments: "s",
  sales: "e",
  customers: "c",
  partners: "p",
  finance: "f",
};

/** How long "g" waits for its letter. */
export const GO_WINDOW_MS = 1500;

export type ShortcutAction =
  | { kind: "none"; pendingGo: number }
  | { kind: "go"; href: string; pendingGo: number }
  | { kind: "search" | "help" | "next" | "previous" | "new" | "sidebar"; pendingGo: number };

/** The sections this person can open, each with its "g" letter when it has one. */
export function shortcutHubs(hubs: Array<{ id: WorkspaceHubId; label: string; href: string }>): ShortcutHub[] {
  return hubs.map((hub) => ({ ...hub, key: GO_KEYS[hub.id] }));
}

/**
 * What a key press means, given when "g" was last pressed. Pure, so the
 * rules are tested without a browser: "g" then a letter goes to a section
 * the person can see, and nothing else.
 */
export function shortcutAction(key: string, pendingGo: number, now: number, hubs: ShortcutHub[]): ShortcutAction {
  if (pendingGo && now - pendingGo <= GO_WINDOW_MS) {
    const hub = hubs.find((item) => item.key && item.key === key.toLowerCase());
    return hub ? { kind: "go", href: hub.href, pendingGo: 0 } : { kind: "none", pendingGo: 0 };
  }
  switch (key) {
    case "g": return { kind: "none", pendingGo: now };
    case "/": return { kind: "search", pendingGo: 0 };
    case "?": return { kind: "help", pendingGo: 0 };
    case "j": return { kind: "next", pendingGo: 0 };
    case "k": return { kind: "previous", pendingGo: 0 };
    case "n": return { kind: "new", pendingGo: 0 };
    case "[": return { kind: "sidebar", pendingGo: 0 };
    default: return { kind: "none", pendingGo: 0 };
  }
}
