import type { CommandCentreJob } from "./command-centre-data";
// Explicit extension so the policy module stays importable from node:test.
import { shipmentNextAction } from "../shipments/shipment-queue-policy.ts";

/**
 * Presentation-only ranking for the Overview work queue. Canonical workflow
 * guards still authorize every mutation; this orders what the operator sees
 * first. Every input is grounded in a real record:
 *
 * - severity: the existing next-action rank ladder (exception > overdue >
 *   customs > unassigned > priority), unchanged.
 * - receivable exposure: the customer's live unpaid finance balance (any
 *   currency), read from the invoices collection by the server. Cross-currency
 *   totals are deliberately avoided — exposure tiers, not converted sums.
 * - SLA stress: an ETA already behind the operational date, or bearing down
 *   on it, raises the multiplier.
 * - dwell: days since the last recorded activity on the shipment.
 *
 * Unknown data (no customer, no invoices, no ETA, no activity) contributes
 * neutral multipliers, never invented money or dates. Multipliers scale the
 * severity ladder, so heavy evidence can promote a row one or two steps —
 * that promotion is the ranking's purpose — while severity settles every tie
 * when the evidence is equal.
 */

export type WorkQueueImpactTier = "critical" | "high" | "moderate" | "monitor";

export type ReceivableExposure = {
  /** Unpaid balance per currency for this customer, already filtered to non-draft/void invoices. */
  balances: Record<string, number>;
};

export type WorkQueueImpact = {
  score: number;
  tier: WorkQueueImpactTier;
  /** Sorted worst-first; the table shows the leading factor's badge. */
  factors: { label: string; weight: number }[];
};

export type WorkQueueImpactInputs = {
  job: CommandCentreJob;
  exposure: ReceivableExposure | null;
  /** Operational date (Asia/Kathmandu) as YYYY-MM-DD. */
  operationalDate: string;
  now: Date;
};

const exposureTiers = [
  { limit: 50_000, weight: 1 },
  { limit: 250_000, weight: 1.15 },
  { limit: 1_000_000, weight: 1.3 },
  { limit: Number.POSITIVE_INFINITY, weight: 1.45 },
] as const;

export function receivableExposureWeight(exposure: ReceivableExposure | null): { weight: number; label: string } {
  const largest = Math.max(0, ...Object.values(exposure?.balances ?? {}).map((value) => (Number.isFinite(value) ? value : 0)));
  if (largest <= 0) return { weight: 1, label: "No open receivable" };
  const tier = exposureTiers.find((entry) => largest < entry.limit) ?? exposureTiers[exposureTiers.length - 1];
  return { weight: tier.weight, label: `${compactMoney(largest)} receivable` };
}

function compactMoney(value: number) {
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trim(value / 1_000)}K`;
  return String(Math.round(value));
}

function trim(value: number) {
  return String(Math.round(value * 10) / 10).replace(/\.0$/, "");
}

export function slaStress(inputs: { eta: string | null; operationalDate: string }): { weight: number; label: string } {
  const etaDay = inputs.eta?.slice(0, 10);
  if (!etaDay) return { weight: 1, label: "No ETA committed" };
  const etaMs = Date.parse(`${etaDay}T00:00:00Z`);
  const todayMs = Date.parse(`${inputs.operationalDate}T00:00:00Z`);
  if (!Number.isFinite(etaMs) || !Number.isFinite(todayMs)) return { weight: 1, label: "No ETA committed" };
  const days = Math.round((etaMs - todayMs) / 86_400_000);
  if (days < 0) return { weight: 1.4, label: `ETA ${-days}d past` };
  if (days === 0) return { weight: 1.3, label: "ETA today" };
  if (days <= 2) return { weight: 1.15, label: `ETA ${days}d out` };
  return { weight: 1, label: `ETA ${days}d out` };
}

export function dwellStress(inputs: { latestActivityAt: string | null; now: Date }): { weight: number; label: string } {
  const stampMs = inputs.latestActivityAt ? Date.parse(inputs.latestActivityAt) : Number.NaN;
  // A shipment with no recorded activity is treated as maximally stale: silence
  // in the timeline is not freshness.
  const days = Number.isFinite(stampMs) ? Math.floor((inputs.now.getTime() - stampMs) / 86_400_000) : 30;
  if (days >= 7) return { weight: 1.2, label: `Silent ${days}d` };
  if (days >= 3) return { weight: 1.1, label: `Silent ${days}d` };
  return { weight: 1, label: `Active ${days === 0 ? "today" : `${days}d ago`}` };
}

export function workQueueImpact(inputs: WorkQueueInputs): WorkQueueImpact {
  const severity = shipmentNextAction(inputs.job).rank;
  if (severity <= 0) return { score: 0, tier: "monitor", factors: [] };

  const exposure = receivableExposureWeight(inputs.exposure);
  const sla = slaStress({ eta: inputs.job.eta, operationalDate: inputs.operationalDate });
  const dwell = dwellStress({ latestActivityAt: inputs.job.latest_activity_at, now: inputs.now });
  const factors = [exposure, sla, dwell].sort((a, b) => b.weight - a.weight);
  const score = severity * exposure.weight * sla.weight * dwell.weight;

  return {
    score,
    tier: score >= 1_000 ? "critical" : score >= 500 ? "high" : score >= 250 ? "moderate" : "monitor",
    factors,
  };
}

type WorkQueueInputs = WorkQueueImpactInputs;

export function compareWorkQueueImpact(a: CommandCentreJob, b: CommandCentreJob, context: {
  exposureByCustomer: Map<string, ReceivableExposure>;
  operationalDate: string;
  now: Date;
}) {
  const aImpact = workQueueImpact({ job: a, exposure: a.customer_id ? context.exposureByCustomer.get(a.customer_id) ?? null : null, operationalDate: context.operationalDate, now: context.now });
  const bImpact = workQueueImpact({ job: b, exposure: b.customer_id ? context.exposureByCustomer.get(b.customer_id) ?? null : null, operationalDate: context.operationalDate, now: context.now });
  return bImpact.score - aImpact.score ||
    shipmentNextAction(b).rank - shipmentNextAction(a).rank ||
    a.reference.localeCompare(b.reference);
}
