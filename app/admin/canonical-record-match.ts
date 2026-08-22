import { kcplBranches, type KcplBranch } from "./crm/crm-data.ts";

export type CanonicalRecordCandidate = {
  id: string;
  branch: unknown;
};

export type CanonicalRecordResolution =
  | { kind: "ready"; id: string; branch: KcplBranch }
  | { kind: "missing" }
  | { kind: "ambiguous"; ids: string[] }
  | { kind: "invalid_branch"; id: string };

/**
 * Provider and EDI matching is set-based, never first-match-wins. Duplicate
 * identifiers that point to the same record collapse to one candidate; distinct
 * records are ambiguous even when the first identifier looked unique.
 */
export function resolveCanonicalRecordCandidates(candidates: CanonicalRecordCandidate[]): CanonicalRecordResolution {
  const unique = new Map<string, CanonicalRecordCandidate>();
  for (const candidate of candidates) {
    const id = candidate.id.trim();
    if (id) unique.set(id, { ...candidate, id });
  }
  const records = [...unique.values()];
  if (!records.length) return { kind: "missing" };
  if (records.length !== 1) return { kind: "ambiguous", ids: records.map((record) => record.id).sort() };
  const record = records[0];
  if (!kcplBranches.includes(record.branch as KcplBranch)) return { kind: "invalid_branch", id: record.id };
  return { kind: "ready", id: record.id, branch: record.branch as KcplBranch };
}
