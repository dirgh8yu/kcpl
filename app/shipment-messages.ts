/*
 * A conversation on a shipment between the customer and KCPL. Pure rules,
 * tested directly; shipment-messages.server.ts stores and delivers.
 *
 * A message is a record on the shipment, not a change to it: nothing said in
 * the thread moves a status, a document or a charge. Both sides see the same
 * thread. A customer sees KCPL staff by first name only, and never staff
 * email addresses.
 */

export const SHIPMENT_MESSAGE_MAX = 2000;

/** Messages one login may send to one shipment in an hour. */
export const SHIPMENT_MESSAGE_HOURLY_LIMIT = 30;

export type ShipmentMessageSide = "customer" | "kcpl";

export type ShipmentMessageView = {
  id: string;
  from: ShipmentMessageSide;
  author: string;
  body: string;
  created_at: string;
};

/** The text of a message, or null when there is nothing to send. */
export function shipmentMessageBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Collapse runs of blank lines; keep the line breaks a person typed.
  const body = value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!body) return null;
  return body.slice(0, SHIPMENT_MESSAGE_MAX);
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

/** "Anil" from "Anil Karki": how KCPL staff appear to a customer. */
export function staffFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "KCPL";
}

/**
 * What either side is shown. For a customer, staff are "KCPL · Anil"; for
 * staff, the customer's login is shown by name. No email reaches the wire.
 */
export function shipmentMessageView(id: string, data: Record<string, unknown>, viewer: ShipmentMessageSide): ShipmentMessageView {
  const from: ShipmentMessageSide = data.author_side === "kcpl" ? "kcpl" : "customer";
  const name = text(data.author_name).trim();
  const author = from === "kcpl"
    ? viewer === "customer" ? `KCPL · ${staffFirstName(name)}` : name || "KCPL"
    : name || "Customer";
  return { id, from, author, body: text(data.body), created_at: text(data.created_at) };
}

/** The first line of a message, short enough for a notification. */
export function shipmentMessagePreview(body: string, max = 140) {
  const line = body.split("\n").find((part) => part.trim()) ?? "";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
