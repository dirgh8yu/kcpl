/*
 * Instant prices: a customer's agreed sell rates, priced for the quantity
 * they type. Only the sell side ever leaves the server; the cost rate on a
 * rate card is KCPL's and never part of this. Pure, so the portal, the app
 * and the booking route compute the same figure.
 */

export type PortalPriceUnit = "flat" | "per_kg" | "per_cbm" | "per_tonne" | "per_container" | "per_shipment";

export type PortalPriceCard = {
  id: string;
  origin: string;
  destination: string;
  mode: string;
  service: string | null;
  currency: string;
  sell_rate: number;
  unit: PortalPriceUnit;
  minimum_charge: number | null;
  valid_until: string | null;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Whether a quantity is asked for: a flat or per-shipment rate is the price as it stands. */
export function priceNeedsQuantity(unit: PortalPriceUnit) {
  return unit !== "flat" && unit !== "per_shipment";
}

/** A rate card a customer may price from today: active, started and not expired. */
export function priceCardUsable(card: { active: boolean; valid_from: string | null; valid_until: string | null; sell_rate: number }, today: string) {
  if (!card.active || !(card.sell_rate > 0)) return false;
  if (card.valid_from && card.valid_from > today) return false;
  if (card.valid_until && card.valid_until < today) return false;
  return true;
}

/** The price for a quantity: rate × quantity, never under the minimum charge. Null when the quantity isn't usable. */
export function instantPrice(card: Pick<PortalPriceCard, "sell_rate" | "unit" | "minimum_charge">, quantity: unknown) {
  if (!priceNeedsQuantity(card.unit)) return round(Math.max(card.sell_rate, card.minimum_charge ?? 0));
  const amount = typeof quantity === "number" ? quantity : Number(quantity);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null;
  if (card.unit === "per_container" && !Number.isInteger(amount)) return null;
  return round(Math.max(card.sell_rate * amount, card.minimum_charge ?? 0));
}
