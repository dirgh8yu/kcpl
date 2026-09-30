import type { CommandCentreJob } from "./command-centre/command-centre-data";

export const OVERVIEW_SECTION_ORDER = [
  "work-queue",
  "today",
  "activity",
  "movement",
  "workload",
  "finance",
  "notes",
] as const;

export type OverviewSectionId = (typeof OVERVIEW_SECTION_ORDER)[number];

/**
 * Sections each customisable workspace exposes to the arrangement primitive.
 * Only the Overview is personal: registers (Shipments, Customs, Finance…) show
 * one standard layout, so they have no sections here.
 */
export const WORKSPACE_SECTIONS = {
  overview: [...OVERVIEW_SECTION_ORDER],
} as const satisfies Record<string, readonly string[]>;

export type WorkspaceKey = keyof typeof WORKSPACE_SECTIONS;

export const CUSTOMISABLE_WORKSPACES: readonly WorkspaceKey[] = ["overview"];

export function workspaceCustomisable(workspace: WorkspaceKey) {
  return CUSTOMISABLE_WORKSPACES.includes(workspace);
}

export type ArrangementState = {
  order: string[];
  hidden: string[];
};

export type ArrangementInput = {
  order?: unknown;
  hidden?: unknown;
};

/* ── Personal saved layouts ─────────────────────────────────────────────
 * Staff can save their current arrangement as a named preset alongside the
 * built-ins. Saved layouts live in the same per-staff server document
 * (`saved` map) so they follow the user across devices like everything else
 * in this primitive. Pure helpers here; storage shape lives in the hook/API. */

export const MAX_SAVED_LAYOUTS_PER_WORKSPACE = 6;
export const SAVED_LAYOUT_NAME_MAX = 24;

export type SavedLayout = {
  id: string;
  name: string;
  order: string[];
  hidden: string[];
};

export type SavedLayoutInput = {
  id?: unknown;
  name?: unknown;
  order?: unknown;
  hidden?: unknown;
};

/** Normalises a saved-layouts map payload against a workspace's sections. */
export function normalizeSavedLayouts(
  workspace: WorkspaceKey,
  input: unknown,
): SavedLayout[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const saved: SavedLayout[] = [];
  for (const entry of input) {
    const record = (entry ?? {}) as SavedLayoutInput;
    if (typeof record.id !== "string" || !record.id || seen.has(record.id)) continue;
    if (typeof record.name !== "string") continue;
    const name = record.name.trim().slice(0, SAVED_LAYOUT_NAME_MAX);
    if (!name) continue;
    const layout = normalizeArrangementFor(workspace, { order: record.order, hidden: record.hidden });
    seen.add(record.id);
    saved.push({ id: record.id, name, order: layout.order, hidden: layout.hidden });
  }
  return saved.slice(0, MAX_SAVED_LAYOUTS_PER_WORKSPACE);
}

/** A layout is "saved" when it exactly equals one of the user's saved layouts. */
export function savedLayoutForState(saved: readonly SavedLayout[], state: ArrangementState): SavedLayout | null {
  const orderKey = state.order.join("|");
  const hiddenKey = state.hidden.join("|");
  return saved.find((entry) => entry.order.join("|") === orderKey && entry.hidden.join("|") === hiddenKey) ?? null;
}

export function serializeSavedLayouts(saved: readonly SavedLayout[]): string {
  return JSON.stringify(saved.map((entry) => ({ id: entry.id, name: entry.name, order: entry.order, hidden: entry.hidden })));
}

function workspaceSections(workspace: WorkspaceKey): readonly string[] {
  return WORKSPACE_SECTIONS[workspace];
}

/** Normalises any raw layout payload against a workspace's real section ids. */
export function normalizeArrangementFor(workspace: WorkspaceKey, input: ArrangementInput | null | undefined): ArrangementState {
  const sections = workspaceSections(workspace);
  const sectionSet: ReadonlySet<string> = new Set(sections);
  const rawOrder = Array.isArray(input?.order) ? input.order : [];
  const rawHidden = Array.isArray(input?.hidden) ? input.hidden : [];

  const order: string[] = [];
  for (const id of rawOrder) {
    if (typeof id === "string" && sectionSet.has(id) && !order.includes(id)) order.push(id);
  }
  for (const id of sections) {
    if (!order.includes(id)) order.push(id);
  }

  const hidden: string[] = [];
  for (const id of rawHidden) {
    if (typeof id === "string" && sectionSet.has(id) && order.includes(id) && !hidden.includes(id)) {
      hidden.push(id);
    }
  }

  return { order, hidden };
}

export function serializeArrangement(state: ArrangementState): string {
  return JSON.stringify({ order: state.order, hidden: state.hidden });
}

export function isDefaultArrangementFor(workspace: WorkspaceKey, state: ArrangementState): boolean {
  const sections = workspaceSections(workspace);
  const orderUnchanged =
    state.order.length === sections.length &&
    state.order.every((id, index) => id === sections[index]);
  return orderUnchanged && state.hidden.length === 0;
}

/** Generic reorder: moves `id` to sit immediately before `target`. */
export function moveSection<T>(order: readonly T[], id: T, target: T): T[] {
  const from = order.indexOf(id);
  const to = order.indexOf(target);
  if (from === -1 || to === -1 || from === to) return order as T[];
  const next = order.slice();
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

export type LayoutPreset = {
  id: string;
  label: string;
  description: string;
  layout: ArrangementState;
};

/**
 * One-click starting points per workspace. Each layout is a complete
 * ArrangementState so applying one is a plain state swap — no special server
 * handling, the same debounced save path as a manual drag persists it.
 */
export const WORKSPACE_PRESETS: Record<WorkspaceKey, readonly LayoutPreset[]> = {
  overview: [
    {
      id: "dispatch",
      label: "Dispatch",
      description: "Queue, Today and live movement first — finance hidden",
      layout: {
        order: ["work-queue", "today", "movement", "activity", "workload", "notes", "finance"],
        hidden: ["finance"],
      },
    },
    {
      id: "finance",
      label: "Finance",
      description: "Job economics and workload up front",
      layout: {
        order: ["finance", "workload", "work-queue", "today", "activity", "movement", "notes"],
        hidden: [],
      },
    },
    {
      id: "sales",
      label: "Sales",
      description: "Queue, today and customer activity first — workload and finance hidden",
      layout: {
        order: ["work-queue", "today", "activity", "movement", "notes", "workload", "finance"],
        hidden: ["workload", "finance"],
      },
    },
    {
      id: "manager",
      label: "Manager",
      description: "Every section visible in the standard order",
      layout: { order: [...OVERVIEW_SECTION_ORDER], hidden: [] },
    },
  ],
};

/**
 * Each role's first Overview until the person arranges their own: Operations
 * lands on the dispatch queue, Accounts on money, Commercial on customers and
 * Management on everything. The person's own saved layout always wins.
 */
export const ROLE_OVERVIEW_PRESET: Record<"management" | "accounts" | "commercial" | "operations", string> = {
  operations: "dispatch",
  accounts: "finance",
  commercial: "sales",
  management: "manager",
};

export function roleOverviewArrangement(role: keyof typeof ROLE_OVERVIEW_PRESET | null | undefined): ArrangementState {
  const preset = WORKSPACE_PRESETS.overview.find((item) => item.id === (role ? ROLE_OVERVIEW_PRESET[role] : "manager"));
  const layout = preset?.layout ?? { order: [...OVERVIEW_SECTION_ORDER], hidden: [] };
  return { order: [...layout.order], hidden: [...layout.hidden] };
}

/** Returns the preset whose layout exactly matches this arrangement, if any. */
export function presetForStateIn(workspace: WorkspaceKey, state: ArrangementState): string | null {
  const orderKey = state.order.join("|");
  const hiddenKey = state.hidden.join("|");
  for (const preset of WORKSPACE_PRESETS[workspace]) {
    if (preset.layout.order.join("|") === orderKey && preset.layout.hidden.join("|") === hiddenKey) {
      return preset.id;
    }
  }
  return null;
}

export function sectionDndId(workspace: WorkspaceKey, id: string): string {
  return `${workspace}-section-${id}`;
}

export function parseSectionDndId(workspace: WorkspaceKey, value: string): string | null {
  const prefix = `${workspace}-section-`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : null;
}

/* ── Overview compat wrappers (existing call sites and tests) ─────────── */

export function normalizeArrangement(input: ArrangementInput | null | undefined): ArrangementState {
  return normalizeArrangementFor("overview", input) as ArrangementState & { order: OverviewSectionId[] };
}

export function isDefaultArrangement(state: ArrangementState): boolean {
  return isDefaultArrangementFor("overview", state);
}

export function presetForState(state: ArrangementState): string | null {
  return presetForStateIn("overview", state);
}

/** Kept for the existing Overview presets consumer. */
export const LAYOUT_PRESETS = WORKSPACE_PRESETS.overview;

/* ── Overview-specific helpers (unchanged) ────────────────────────────── */

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function jobPriorityRank(job: CommandCentreJob): number {
  return PRIORITY_RANK[job.priority] ?? 2;
}
