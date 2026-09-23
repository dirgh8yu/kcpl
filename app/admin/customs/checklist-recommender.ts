// Explicit extension so the policy module stays importable from node:test.
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../../shipment-document-types.ts";

/**
 * Suggested next actions for the customs desk, grounded in what actually
 * shipped. Deterministic and pure: the input is document-type evidence from
 * completed shipments (lane + mode + branch), the output is an ordered
 * checklist with a support count and share for every suggestion. Nothing is
 * invented — with no comparable history the recommender says so.
 */

export type ChecklistEvidence = {
  /** Same normalized lane (origin→destination), lowercased, regardless of status. */
  lane: string;
  mode: string;
  branch: string;
  delivered: boolean;
  documents: ShipmentDocumentType[];
};

export type SuggestedDocument = {
  documentType: ShipmentDocumentType;
  label: string;
  /** How many comparable completed shipments carried this document. */
  support: number;
  /** share = support / comparableCount, so operators can see the strength of the pattern. */
  share: number;
};

export type SuggestedChecklist = {
  /** True only when at least one comparable completed shipment exists. */
  available: boolean;
  comparableCount: number;
  suggestions: SuggestedDocument[];
};

export const minComparableShipments = 3;
export const minComparableModeMatched = 2;
const minShare = 0.4;

export function suggestChecklist(evidence: ChecklistEvidence[], target: { lane: string; mode: string; branch: string }): SuggestedChecklist {
  const targetLane = target.lane.toLowerCase();
  const sameLaneDelivered = evidence.filter((item) => item.lane === targetLane && item.delivered);
  // A thick lane history is trustworthy on its own; a thin one only earns
  // suggestions when every comparable shipment also matches the mode.
  const sameModeDelivered = sameLaneDelivered.filter((item) => item.mode === target.mode);
  const comparable = sameLaneDelivered.length >= minComparableShipments
    ? sameLaneDelivered
    : sameModeDelivered.length >= minComparableModeMatched
      ? sameModeDelivered
      : [];

  if (!comparable.length) {
    return { available: false, comparableCount: sameLaneDelivered.length, suggestions: [] };
  }

  const counts = new Map<ShipmentDocumentType, number>();
  for (const item of comparable) {
    for (const type of item.documents) {
      if (!shipmentDocumentTypeLabels[type]) continue;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  const suggestions = [...counts.entries()]
    .map(([documentType, support]) => ({ documentType, label: shipmentDocumentTypeLabels[documentType], support, share: support / comparable.length }))
    .filter((item) => item.share >= minShare)
    .sort((a, b) => b.share - a.share || a.label.localeCompare(b.label));

  return { available: true, comparableCount: comparable.length, suggestions };
}
