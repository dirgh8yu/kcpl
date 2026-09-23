import type { CommandCentreJob } from "./command-centre/command-centre-data";
import { shipmentNextAction } from "./shipments/shipment-queue-policy.ts";

export const OVERVIEW_SECTION_ORDER = [
  "work-queue",
  "today",
  "activity",
  "movement",
  "pulse",
  "workload",
  "finance",
  "notes",
] as const;

export type OverviewSectionId = (typeof OVERVIEW_SECTION_ORDER)[number];

/**
 * Sections that each workspace exposes to the arrangement primitive. The ids
 * are workspace-scoped: a layout never moves between workspaces, so ids only
 * need to be unique inside their own list. Registers use full-width rows
 * (single-column grid), the Overview uses the two-column grid.
 */
export const WORKSPACE_SECTIONS = {
  overview: [...OVERVIEW_SECTION_ORDER],
  shipments: ["rail", "register"],
  customs: ["pulse", "rail", "queue"],
  delivery: ["pulse", "rail", "queue"],
  "freight-documents": ["rail", "queue"],
  pickups: ["rail", "register"],
  alerts: ["rail", "register"],
  finance: ["rail", "register"],
  payables: ["rail", "register"],
} as const satisfies Record<string, readonly string[]>;

export type WorkspaceKey = keyof typeof WORKSPACE_SECTIONS;

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
        order: ["work-queue", "today", "pulse", "movement", "activity", "workload", "notes", "finance"],
        hidden: ["finance"],
      },
    },
    {
      id: "finance",
      label: "Finance",
      description: "Job economics and workload up front",
      layout: {
        order: ["finance", "workload", "work-queue", "today", "activity", "movement", "pulse", "notes"],
        hidden: [],
      },
    },
    {
      id: "manager",
      label: "Manager",
      description: "Every section visible in the standard order",
      layout: { order: [...OVERVIEW_SECTION_ORDER], hidden: [] },
    },
  ],
  shipments: [
    {
      id: "operator",
      label: "Operator",
      description: "Summary rail above the register — the standard desk",
      layout: { order: ["rail", "register"], hidden: [] },
    },
    {
      id: "queue-first",
      label: "Queue first",
      description: "Register on top, summary rail below it",
      layout: { order: ["register", "rail"], hidden: [] },
    },
    {
      id: "lean",
      label: "Lean",
      description: "Register only — the rail is hidden until you need it",
      layout: { order: ["rail", "register"], hidden: ["rail"] },
    },
  ],
  customs: [
    {
      id: "desk",
      label: "Desk",
      description: "Live pulse, customs rail, then the clearance queue",
      layout: { order: ["pulse", "rail", "queue"], hidden: [] },
    },
    {
      id: "queue-first",
      label: "Queue first",
      description: "Clearance queue on top; pulse and rail follow",
      layout: { order: ["queue", "pulse", "rail"], hidden: [] },
    },
    {
      id: "lean",
      label: "Lean",
      description: "Queue only — pulse and rail hidden until needed",
      layout: { order: ["pulse", "rail", "queue"], hidden: ["pulse", "rail"] },
    },
  ],
  delivery: [
    {
      id: "desk",
      label: "Desk",
      description: "Live pulse, delivery rail, then the POD queue",
      layout: { order: ["pulse", "rail", "queue"], hidden: [] },
    },
    {
      id: "queue-first",
      label: "Queue first",
      description: "Delivery queue on top; pulse and rail follow",
      layout: { order: ["queue", "pulse", "rail"], hidden: [] },
    },
    {
      id: "lean",
      label: "Lean",
      description: "Queue only — pulse and rail hidden until needed",
      layout: { order: ["pulse", "rail", "queue"], hidden: ["pulse", "rail"] },
    },
  ],
  "freight-documents": [
    {
      id: "standard",
      label: "Standard",
      description: "Production rail above the document queue",
      layout: { order: ["rail", "queue"], hidden: [] },
    },
    {
      id: "queue-first",
      label: "Queue first",
      description: "Document queue on top, summary rail below",
      layout: { order: ["queue", "rail"], hidden: [] },
    },
    {
      id: "lean",
      label: "Lean",
      description: "Queue only — the rail is hidden until you need it",
      layout: { order: ["rail", "queue"], hidden: ["rail"] },
    },
  ],
  pickups: [
    {
      id: "desk",
      label: "Desk",
      description: "Summary rail above the pickup register — the standard desk",
      layout: { order: ["rail", "register"], hidden: [] },
    },
    {
      id: "queue-first",
      label: "Queue first",
      description: "Pickup register on top, summary rail below it",
      layout: { order: ["register", "rail"], hidden: [] },
    },
    {
      id: "lean",
      label: "Lean",
      description: "Register only — the rail is hidden until you need it",
      layout: { order: ["rail", "register"], hidden: ["rail"] },
    },
  ],
  alerts: [
    {
      id: "desk",
      label: "Desk",
      description: "Alert summary above the queue — the standard desk",
      layout: { order: ["rail", "register"], hidden: [] },
    },
    {
      id: "queue-first",
      label: "Queue first",
      description: "Alert queue on top, summary rail below it",
      layout: { order: ["register", "rail"], hidden: [] },
    },
    {
      id: "lean",
      label: "Lean",
      description: "Queue only — the rail is hidden until you need it",
      layout: { order: ["rail", "register"], hidden: ["rail"] },
    },
  ],
  finance: [
    {
      id: "desk",
      label: "Desk",
      description: "Receivables rail above the ledger — the standard desk",
      layout: { order: ["rail", "register"], hidden: [] },
    },
    {
      id: "queue-first",
      label: "Ledger first",
      description: "Receivables ledger on top, summary rail below it",
      layout: { order: ["register", "rail"], hidden: [] },
    },
    {
      id: "lean",
      label: "Lean",
      description: "Ledger only — the rail is hidden until you need it",
      layout: { order: ["rail", "register"], hidden: ["rail"] },
    },
  ],
  payables: [
    {
      id: "desk",
      label: "Desk",
      description: "Payables rail above the ledger — the standard desk",
      layout: { order: ["rail", "register"], hidden: [] },
    },
    {
      id: "queue-first",
      label: "Ledger first",
      description: "Payables ledger on top, summary rail below it",
      layout: { order: ["register", "rail"], hidden: [] },
    },
    {
      id: "lean",
      label: "Lean",
      description: "Ledger only — the rail is hidden until you need it",
      layout: { order: ["rail", "register"], hidden: ["rail"] },
    },
  ],
};

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

export function countSectionJobs(section: OverviewSectionId, jobs: CommandCentreJob[]): number {
  switch (section) {
    case "work-queue":
      return jobs.filter((job) => Boolean(shipmentNextAction(job))).length;
    case "movement":
      return jobs.filter((job) => job.status === "in_transit" || job.status === "out_for_delivery").length;
    case "pulse":
      return jobs.filter((job) => job.status === "customs_clearance").length;
    case "workload":
      return jobs.length;
    case "today":
    case "activity":
    case "finance":
    case "notes":
      return 0;
  }
}

export function jobPriorityRank(job: CommandCentreJob): number {
  return PRIORITY_RANK[job.priority] ?? 2;
}
