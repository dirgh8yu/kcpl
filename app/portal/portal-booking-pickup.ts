/*
 * The pickup a customer asks for when accepting a quote. A request, not an
 * appointment: operations schedule the pickup once the booking is confirmed
 * (app/admin/pickups), and this only fills in their form. Pure, so the rules
 * are tested directly.
 */

export const bookingPickupWindows = ["morning", "afternoon", "any"] as const;
export type BookingPickupWindow = (typeof bookingPickupWindows)[number];

export type BookingPickupRequest = {
  date: string;
  window: BookingPickupWindow;
  address: string;
  contact_name: string | null;
  contact_phone: string | null;
};

/** The furthest ahead a pickup can be asked for. */
export const BOOKING_PICKUP_MAX_DAYS = 90;

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * The pickup in a booking request, if one was asked for. [today] is Nepal's
 * date (YYYY-MM-DD). No pickup at all is fine (the customer may bring the
 * cargo in); a pickup with a date in the past, too far ahead, or no address
 * is refused with the reason.
 */
export function bookingPickupFromBody(body: Record<string, unknown>, today: string):
  { ok: true; pickup: BookingPickupRequest | null } | { ok: false; error: string } {
  const raw = body.pickup;
  if (raw === undefined || raw === null) return { ok: true, pickup: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "The pickup could not be read." };
  const input = raw as Record<string, unknown>;
  const date = clean(input.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, error: "Choose a pickup date." };
  if (date < today) return { ok: false, error: "The pickup date has passed." };
  const latest = new Date(`${today}T00:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() + BOOKING_PICKUP_MAX_DAYS);
  if (date > latest.toISOString().slice(0, 10)) return { ok: false, error: `Choose a pickup date within ${BOOKING_PICKUP_MAX_DAYS} days.` };
  const window = bookingPickupWindows.includes(input.window as BookingPickupWindow) ? (input.window as BookingPickupWindow) : "any";
  const address = clean(input.address, 300);
  if (address.length < 5) return { ok: false, error: "Enter where the cargo is to be picked up." };
  const phone = clean(input.contact_phone, 30);
  if (phone && !/^\+?[0-9 ()-]{6,30}$/.test(phone)) return { ok: false, error: "Check the contact phone number." };
  return {
    ok: true,
    pickup: { date, window, address, contact_name: clean(input.contact_name, 120) || null, contact_phone: phone || null },
  };
}

/** A pickup as stored on a booking request, read back without the date
 * bounds that applied when it was asked for. */
export function storedBookingPickup(raw: unknown): BookingPickupRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const date = clean(input.date, 10);
  const address = clean(input.address, 300);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || !address) return null;
  return {
    date,
    window: bookingPickupWindows.includes(input.window as BookingPickupWindow) ? (input.window as BookingPickupWindow) : "any",
    address,
    contact_name: clean(input.contact_name, 120) || null,
    contact_phone: clean(input.contact_phone, 30) || null,
  };
}

/** The window as Nepal times (UTC+05:45), in ISO form for the pickup desk. */
export function bookingPickupWindowTimes(pickup: BookingPickupRequest) {
  const [from, to] = pickup.window === "morning" ? ["09:00", "12:00"] : pickup.window === "afternoon" ? ["12:00", "17:00"] : ["09:00", "17:00"];
  const at = (time: string) => new Date(`${pickup.date}T${time}:00+05:45`).toISOString();
  return { start: at(from), end: at(to) };
}

/** One line for the quote's notes and the pickup desk's instructions. */
export function bookingPickupSummary(pickup: BookingPickupRequest) {
  const window = pickup.window === "morning" ? "morning (9-12)" : pickup.window === "afternoon" ? "afternoon (12-5)" : "any time (9-5)";
  const contact = [pickup.contact_name, pickup.contact_phone].filter(Boolean).join(", ");
  return `Pickup asked for ${pickup.date}, ${window}, at ${pickup.address}${contact ? `; contact ${contact}` : ""}.`;
}
