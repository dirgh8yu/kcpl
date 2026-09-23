import type { CommandCentreJob, CommandCentreStaffLoad } from "./command-centre-data";

/**
 * Suggested next actions for unassigned shipments: recommend an owner from
 * real workload and real lane experience. Deterministic and pure — the input
 * is per-staff load (from the command-centre register) and per-staff completed
 * lane history (built server-side), the output is an ordered recommendation
 * list with stated evidence. Nothing invented: with no eligible staff the
 * recommender says so, and the operator decides.
 */

export type OwnerCandidateEvidence = {
  /** Completed shipment references on this lane attributed to the staff member. */
  lane_completions: number;
  /** Last completion on this lane, ISO timestamp (null when never). */
  last_lane_completion_at: string | null;
};

export type OwnerRecommendation = {
  name: string;
  email: string;
  /** workload minus lane credit, lower is better; stated so the UI can show its work. */
  score: number;
  active_jobs: number;
  overdue_tasks: number;
  lane_completions: number;
  /** The dominant reason, for the one-line UI. */
  reason: string;
};

export type OwnerSuggestion = {
  available: boolean;
  reason: string | null;
  recommendations: OwnerRecommendation[];
};

export type OwnerSuggestionInputs = {
  job: Pick<CommandCentreJob, "primary_branch" | "handling_branches" | "origin" | "destination" | "mode">;
  candidates: CommandCentreStaffLoad[];
  /** Lane evidence keyed by staff identity (uid, else lowercased email). */
  laneEvidence: Map<string, OwnerCandidateEvidence>;
};

const maxCandidates = 3;

export function suggestOwner(inputs: OwnerSuggestionInputs): OwnerSuggestion {
  const staffKeys = (staff: CommandCentreStaffLoad): string[] => {
    const keys: string[] = [];
    if (staff.uid) keys.push(staff.uid);
    if (staff.email) keys.push(staff.email.toLowerCase());
    return keys;
  };

  const scored = inputs.candidates
    .map((staff) => {
      const evidence = staffKeys(staff).map((key) => inputs.laneEvidence.get(key)).find(Boolean) ?? { lane_completions: 0, last_lane_completion_at: null };
      // Workload pressure: open tasks dominate, urgent load and raw queue
      // breadth add; overdue work is already counted inside open tasks.
      const score = staff.open_tasks + staff.urgent_jobs * 2 + staff.active_jobs * 0.5
        - evidence.lane_completions * 2;
      const reason = evidence.lane_completions > 0
        ? `${evidence.lane_completions} completed on this lane`
        : `${staff.active_jobs} active · ${staff.open_tasks} open task${staff.open_tasks === 1 ? "" : "s"}`;
      return {
        name: staff.name,
        email: staff.email,
        score,
        active_jobs: staff.active_jobs,
        overdue_tasks: staff.overdue_tasks,
        lane_completions: evidence.lane_completions,
        reason,
      };
    })
    .sort((a, b) => a.score - b.score || b.lane_completions - a.lane_completions || a.name.localeCompare(b.name))
    .slice(0, maxCandidates);

  if (!scored.length) {
    return { available: false, reason: "No active staff in your directory matches this workspace.", recommendations: [] };
  }
  return { available: true, reason: null, recommendations: scored };
}

export function laneKey(origin: string, destination: string) {
  return `${origin.toLowerCase()}→${destination.toLowerCase()}`;
}
