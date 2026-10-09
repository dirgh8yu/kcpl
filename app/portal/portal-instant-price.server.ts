import { firebaseAdminDb } from "../firebase-admin.server";
import { nepalOperationalDate } from "../invoice-effective-status";
import type { PortalSession } from "./portal-auth";
import { createPortalEnquiry } from "./portal-requests.server";
import { instantPrice, priceCardUsable, priceNeedsQuantity, type PortalPriceCard, type PortalPriceUnit } from "./portal-instant-price";

/*
 * The customer's agreed prices, read from their rate cards in the CRM, and a
 * booking request raised at one of them. The price is worked out again here
 * from the card on file, never taken from the browser.
 */

const units: PortalPriceUnit[] = ["flat", "per_kg", "per_cbm", "per_tonne", "per_container", "per_shipment"];
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function num(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }

function cardFromDoc(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = (doc.data() ?? {}) as Record<string, unknown>;
  return {
    id: doc.id,
    origin: text(data.origin), destination: text(data.destination), mode: text(data.mode) || "road",
    service: text(data.service) || null, currency: text(data.currency) || "NPR",
    sell_rate: num(data.sell_rate) ?? 0, unit: units.includes(data.unit as PortalPriceUnit) ? data.unit as PortalPriceUnit : "flat",
    minimum_charge: num(data.minimum_charge), valid_from: text(data.valid_from) || null, valid_until: text(data.valid_until) || null,
    active: data.active === true,
  };
}

/** Only what a customer may see of a card. */
function publicCard(card: ReturnType<typeof cardFromDoc>): PortalPriceCard {
  return { id: card.id, origin: card.origin, destination: card.destination, mode: card.mode, service: card.service, currency: card.currency, sell_rate: card.sell_rate, unit: card.unit, minimum_charge: card.minimum_charge, valid_until: card.valid_until };
}

export async function listPortalPrices(session: PortalSession): Promise<PortalPriceCard[]> {
  const today = nepalOperationalDate();
  const snapshot = await firebaseAdminDb().collection("customers").doc(session.customerId).collection("rate_cards").where("active", "==", true).limit(200).get();
  return snapshot.docs.map(cardFromDoc).filter((card) => priceCardUsable(card, today)).map(publicCard)
    .sort((a, b) => a.origin.localeCompare(b.origin) || a.destination.localeCompare(b.destination));
}

/** "Book at this price": a request to KCPL carrying the lane, the quantity and the agreed price. */
export async function bookAtInstantPrice(session: PortalSession, input: { rateCardId: string; quantity: unknown; timing: string; requirements: string }, source: "customer_portal" | "customer_app") {
  const doc = await firebaseAdminDb().collection("customers").doc(session.customerId).collection("rate_cards").doc(input.rateCardId).get();
  if (!doc.exists) return { kind: "missing" as const };
  const card = cardFromDoc(doc);
  if (!priceCardUsable(card, nepalOperationalDate())) return { kind: "expired" as const };
  const price = instantPrice(card, input.quantity);
  if (price === null) return { kind: "invalid_quantity" as const };
  const quantity = priceNeedsQuantity(card.unit) ? Number(input.quantity) : null;
  const unitWord: Record<PortalPriceUnit, string> = { flat: "flat", per_kg: "kg", per_cbm: "CBM", per_tonne: "tonnes", per_container: "containers", per_shipment: "per shipment" };
  const priceLine = `Agreed price from the portal: ${card.currency} ${price.toFixed(2)}${quantity !== null ? ` for ${quantity} ${unitWord[card.unit]} at ${card.currency} ${card.sell_rate} each` : ""}${card.minimum_charge ? ` (minimum ${card.currency} ${card.minimum_charge})` : ""}, rate card ${card.id}.`;
  const reference = await createPortalEnquiry(session, {
    origin: card.origin, destination: card.destination, mode: ["air", "sea", "road"].includes(card.mode) ? card.mode : "unsure",
    cargoType: card.service ?? "", weight: card.unit === "per_kg" || card.unit === "per_tonne" ? String(quantity ?? "") : "", weightUnit: card.unit === "per_tonne" ? "tonnes" : "kg",
    timing: input.timing.trim().slice(0, 200), requirements: [priceLine, input.requirements.trim().slice(0, 1500)].filter(Boolean).join("\n\n"),
  }, source);
  await firebaseAdminDb().collection("quotes").doc(reference).update({
    instant_price: { rate_card_id: card.id, currency: card.currency, amount: price, quantity, unit: card.unit, sell_rate: card.sell_rate, minimum_charge: card.minimum_charge },
  });
  return { kind: "created" as const, reference, price, currency: card.currency };
}
