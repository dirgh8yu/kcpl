import type { PartnerTenderView } from "./partner-tenders";

/*
 * What a carrier can see about its own commercial performance. Counts only:
 * no comparison against other carriers, no customer or margin data, and no
 * invented rating. A tender is "on time" only when a recorded response landed
 * before its deadline.
 */

export type PartnerScorecard = {
  tenders: number;
  awaiting: number;
  responded: number;
  accepted: number;
  countered: number;
  rejected: number;
  expired: number;
  on_time: number;
  response_rate: number;
  acceptance_rate: number;
  on_time_rate: number;
};

function rate(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function buildPartnerScorecard(tenders: PartnerTenderView[]): PartnerScorecard {
  let awaiting = 0;
  let responded = 0;
  let accepted = 0;
  let countered = 0;
  let rejected = 0;
  let expired = 0;
  let onTime = 0;

  for (const tender of tenders) {
    if (tender.status === "sent") { awaiting += 1; continue; }
    if (tender.status === "expired" || tender.status === "cancelled") { expired += 1; continue; }
    if (tender.status === "accepted" || tender.status === "countered" || tender.status === "booked" || tender.status === "rejected") {
      responded += 1;
      if (tender.status === "accepted" || tender.status === "booked") accepted += 1;
      if (tender.status === "countered") countered += 1;
      if (tender.status === "rejected") rejected += 1;
      if (tender.responded_at && tender.response_due_at && tender.responded_at <= tender.response_due_at) onTime += 1;
    }
  }

  const decided = accepted + countered + rejected;
  return {
    tenders: tenders.length,
    awaiting,
    responded,
    accepted,
    countered,
    rejected,
    expired,
    on_time: onTime,
    response_rate: rate(responded, responded + awaiting + expired),
    acceptance_rate: rate(accepted, decided),
    on_time_rate: rate(onTime, responded),
  };
}
