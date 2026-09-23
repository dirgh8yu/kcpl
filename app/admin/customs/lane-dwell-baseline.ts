// Explicit extension so the policy module stays importable from node:test.
import { shipmentStatusLabels, type ShipmentStatus } from "../../shipment-types.ts";

/**
 * Lane dwell baselines for the customs desk, learned from what actually
 * shipped. Pure and deterministic: reconstruct entry→release dwell from the
 * shipment `events` stream (status labels written by updateShipment), take the
 * percentile, and warn when a live clearance outlasts it. Nothing invented —
 * with no comparable history the baseline says so.
 */

export type DwellEvidenceItem = {
  lane: string;
  /** Status-label title strings exactly as written into the events stream. */
  titles: { title: string; at: string }[];
};

export type LaneDwellBaseline = {
  /** True only when the lane has enough completed clearances to trust. */
  available: boolean;
  lane: string;
  /** Number of completed clearances the percentile is drawn from. */
  sample: number;
  /** Median clearance dwell in hours. */
  medianHours: number | null;
  /** The slow-but-normal bound: clearances outlasting this are outliers. */
  p75Hours: number | null;
};

export type DwellWarning = {
  active: boolean;
  /** Hours the shipment has been in clearance so far. */
  elapsedHours: number | null;
  /** The lane's slow-but-normal bound being compared against. */
  p75Hours: number | null;
  sample: number;
  message: string | null;
};

/** Statuses that count as having entered customs clearance. */
const entryStatuses: ShipmentStatus[] = ["customs_clearance"];
/** Statuses that prove the customs phase is over for that shipment. */
const exitStatuses: ShipmentStatus[] = ["out_for_delivery", "delivered"];

export const minDwellSamples = 3;

export function laneDwellBaseline(evidence: DwellEvidenceItem[], targetLane: string): LaneDwellBaseline {
  const lane = targetLane.toLowerCase();
  const dwellHours: number[] = [];
  for (const item of evidence) {
    if (item.lane.toLowerCase() !== lane) continue;
    const dwell = clearanceDwellHours(item.titles);
    if (dwell !== null) dwellHours.push(dwell);
  }
  if (dwellHours.length < minDwellSamples) {
    return { available: false, lane, sample: dwellHours.length, medianHours: null, p75Hours: null };
  }
  const sorted = [...dwellHours].sort((a, b) => a - b);
  return {
    available: true,
    lane,
    sample: sorted.length,
    medianHours: percentile(sorted, 0.5),
    p75Hours: percentile(sorted, 0.75),
  };
}

export function dwellWarning(inputs: {
  baseline: LaneDwellBaseline;
  /** How long the shipment has been in customs clearance so far (hours), null when not in clearance. */
  elapsedHours: number | null;
}): DwellWarning {
  const { baseline, elapsedHours } = inputs;
  if (!baseline.available || baseline.p75Hours === null || elapsedHours === null) {
    return { active: false, elapsedHours, p75Hours: baseline.p75Hours, sample: baseline.sample, message: null };
  }
  if (elapsedHours <= baseline.p75Hours) {
    return { active: false, elapsedHours, p75Hours: baseline.p75Hours, sample: baseline.sample, message: null };
  }
  return {
    active: true,
    elapsedHours,
    p75Hours: baseline.p75Hours,
    sample: baseline.sample,
    message: `In clearance ${describeHours(elapsedHours)} — the lane's slow-but-normal is ${describeHours(baseline.p75Hours)} (from ${baseline.sample} completed clearances).`,
  };
}

/**
 * Reconstruct one clearance dwell from an events stream: first entry into
 * customs → first exit status after it. Returns null when the stream never
 * completed the phase (censored data must not pollute the percentile).
 */
export function clearanceDwellHours(titles: { title: string; at: string }[]): number | null {
  let enteredAt: number | null = null;
  for (const item of titles) {
    const at = Date.parse(item.at);
    if (!Number.isFinite(at)) continue;
    if (enteredAt === null) {
      if (entryStatuses.some((status) => shipmentStatusLabels[status] === item.title)) enteredAt = at;
    } else if (exitStatuses.some((status) => shipmentStatusLabels[status] === item.title)) {
      return Math.max(0, (at - enteredAt) / 3_600_000);
    }
  }
  return null;
}

function percentile(sorted: number[], fraction: number) {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return round1(sorted[lower]);
  return round1(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function describeHours(hours: number) {
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const rest = Math.round(hours - days * 24);
    return rest ? `${days}d ${rest}h` : `${days} day${days === 1 ? "" : "s"}`;
  }
  return `${Math.round(hours)}h`;
}
