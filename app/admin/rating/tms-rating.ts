import type { CrmCurrency, KcplBranch } from "../crm/crm-data";

export const tmsModes = ["air", "sea", "road", "rail", "courier", "multimodal"] as const;
export type TmsMode = (typeof tmsModes)[number];

export const tmsRateUnits = ["flat", "per_kg", "per_cbm", "per_tonne", "per_container", "per_piece", "per_shipment"] as const;
export type TmsRateUnit = (typeof tmsRateUnits)[number];

export const tmsRateUnitLabels: Record<TmsRateUnit, string> = {
  flat: "Flat",
  per_kg: "Per kg",
  per_cbm: "Per CBM",
  per_tonne: "Per tonne",
  per_container: "Per container",
  per_piece: "Per piece",
  per_shipment: "Per shipment",
};

export type TmsOrderStatus = "draft" | "rated" | "selected" | "tendering" | "booked" | "cancelled";

export type TmsOrder = {
  id: string;
  branch: KcplBranch;
  customer_id: string | null;
  customer_name: string | null;
  origin: string;
  destination: string;
  mode: TmsMode;
  pickup_date: string | null;
  delivery_date: string | null;
  weight_kg: number;
  volume_cbm: number;
  pieces: number;
  container_count: number;
  equipment: string | null;
  temperature_requirement: string | null;
  carrier_requirement: string | null;
  notes: string | null;
  status: TmsOrderStatus;
  selected_rate_card_id: string | null;
  selected_partner_id: string | null;
  selected_cost: number | null;
  selected_currency: CrmCurrency | null;
  consolidation_load_id?: string | null;
  consolidation_reference?: string | null;
  is_consolidation_master?: boolean;
  procurement_locked_by_load?: boolean;
  created_at: string;
  created_by_name: string;
  created_by_email: string;
  updated_at: string;
};

export type PartnerBuyRateCard = {
  id: string;
  partner_id: string;
  partner_name: string;
  branch: KcplBranch | "Global";
  origin: string;
  destination: string;
  mode: TmsMode;
  service: string | null;
  equipment: string | null;
  currency: CrmCurrency;
  rate: number;
  unit: TmsRateUnit;
  minimum_charge: number | null;
  fuel_surcharge_percent: number;
  accessorial_flat: number;
  transit_days_min: number | null;
  transit_days_max: number | null;
  valid_from: string | null;
  valid_until: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RatingResult = {
  rate_card_id: string;
  partner_id: string;
  partner_name: string;
  mode: TmsMode;
  service: string | null;
  equipment: string | null;
  currency: CrmCurrency;
  unit: TmsRateUnit;
  quantity: number;
  linehaul: number;
  fuel_surcharge: number;
  accessorials: number;
  total_cost: number;
  minimum_applied: boolean;
  transit_days_min: number | null;
  transit_days_max: number | null;
};

function key(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function rateLocationMatches(pattern: string, actual: string) {
  const wanted = key(pattern);
  const value = key(actual);
  if (!wanted || wanted === "*" || wanted === "any") return true;
  return wanted === value;
}

export function rateCardIsValidOn(card: Pick<PartnerBuyRateCard, "active" | "valid_from" | "valid_until">, dateIso: string) {
  if (!card.active) return false;
  const day = dateIso.slice(0, 10);
  if (card.valid_from && card.valid_from > day) return false;
  if (card.valid_until && card.valid_until < day) return false;
  return true;
}

export function ratingQuantity(order: Pick<TmsOrder, "weight_kg" | "volume_cbm" | "pieces" | "container_count">, unit: TmsRateUnit) {
  if (unit === "per_kg") return Math.max(0, order.weight_kg);
  if (unit === "per_cbm") return Math.max(0, order.volume_cbm);
  if (unit === "per_tonne") return Math.max(0, order.weight_kg) / 1000;
  if (unit === "per_container") return Math.max(0, order.container_count);
  if (unit === "per_piece") return Math.max(0, order.pieces);
  return 1;
}

export function calculateRating(order: TmsOrder, card: PartnerBuyRateCard): RatingResult | null {
  if (order.mode !== card.mode && card.mode !== "multimodal") return null;
  if (!rateLocationMatches(card.origin, order.origin) || !rateLocationMatches(card.destination, order.destination)) return null;
  if (order.equipment && card.equipment && key(order.equipment) !== key(card.equipment)) return null;
  if (!rateCardIsValidOn(card, order.pickup_date || new Date().toISOString())) return null;

  const quantity = ratingQuantity(order, card.unit);
  if (quantity <= 0 && !["flat", "per_shipment"].includes(card.unit)) return null;
  const rawLinehaul = card.rate * quantity;
  const linehaul = Math.max(rawLinehaul, card.minimum_charge ?? 0);
  const fuel = linehaul * Math.max(0, card.fuel_surcharge_percent) / 100;
  const accessorials = Math.max(0, card.accessorial_flat);
  return {
    rate_card_id: card.id,
    partner_id: card.partner_id,
    partner_name: card.partner_name,
    mode: card.mode,
    service: card.service,
    equipment: card.equipment,
    currency: card.currency,
    unit: card.unit,
    quantity,
    linehaul,
    fuel_surcharge: fuel,
    accessorials,
    total_cost: linehaul + fuel + accessorials,
    minimum_applied: linehaul > rawLinehaul,
    transit_days_min: card.transit_days_min,
    transit_days_max: card.transit_days_max,
  };
}

export function rateOrder(order: TmsOrder, cards: PartnerBuyRateCard[]) {
  return cards
    .map((card) => calculateRating(order, card))
    .filter((result): result is RatingResult => Boolean(result))
    .sort((a, b) => a.currency.localeCompare(b.currency) || a.total_cost - b.total_cost || a.partner_name.localeCompare(b.partner_name));
}
