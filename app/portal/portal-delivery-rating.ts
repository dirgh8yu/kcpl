/*
 * "How did this delivery go?" Pure rules, tested directly; the store and
 * alerts are in portal-delivery-rating.server.ts.
 *
 * One question, asked once a shipment is delivered, answered once per login.
 * A low score is a complaint and goes to the desk that owns the job; a good
 * one is thanked, and offered KCPL's review page when KCPL has set one. A
 * rating is feedback about the service, never a change to the shipment.
 */

export const DELIVERY_RATING_COMPLAINT_AT = 3;

export type DeliveryRatingInput = { score: number; comment: string };

export function deliveryRatingFromBody(body: Record<string, unknown>): DeliveryRatingInput | null {
  const score = typeof body.score === "number" ? body.score : Number(body.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) return null;
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : "";
  return { score, comment };
}

/** A score of three or less goes to the desk as a complaint. */
export function deliveryRatingIsComplaint(score: number) {
  return score <= DELIVERY_RATING_COMPLAINT_AT;
}

/** A shipment can be rated once it is delivered. */
export function deliveryRatable(status: string) {
  return status === "delivered";
}

/** KCPL's public review page, when one is set and it is a web address. */
export function deliveryReviewUrl(env: Record<string, string | undefined> = process.env) {
  const value = env.KCPL_REVIEW_URL?.trim() ?? "";
  return /^https:\/\/[^\s]+$/.test(value) ? value : null;
}
