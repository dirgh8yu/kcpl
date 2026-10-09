import { firebaseAdminDb, firebaseRuntimeConfigured } from "./firebase-admin.server";
import { nepalOperationalDate } from "./invoice-effective-status";
import { freeTimeBearers, type FreeTimeBearer } from "./shipment-free-time";
import {
  containerDatesInOrder,
  containerFromRecord,
  containerNumberValid,
  containerSizeTypes,
  normalizeContainerNumber,
  parseContainerNumbers,
  type ContainerSizeType,
  type ShipmentContainer,
} from "./shipment-containers";

/*
 * Containers live under the shipment (shipments/{ref}/containers), keyed by
 * container number, so the same box can't be entered twice on a shipment.
 * Only container fields are written here; nothing about the shipment's own
 * status moves when a container's dates are recorded.
 */

type Actor = { name: string; email: string };
const MAX_CONTAINERS = 200;

function day(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { value: null as string | null };
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`)) ? { value: text } : { error: true as const };
}
function money(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return { value: null as number | null };
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= max ? { value: Math.round(parsed * 100) / 100 } : { error: true as const };
}
function clean(value: unknown, max = 120) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export async function readShipmentContainers(reference: string): Promise<ShipmentContainer[] | null> {
  if (!firebaseRuntimeConfigured() || !reference.trim()) return null;
  try {
    const snapshot = await firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase()).collection("containers").limit(MAX_CONTAINERS).get();
    return snapshot.docs.map((doc) => containerFromRecord(doc.id, doc.data() as Record<string, unknown>)).sort((a, b) => a.number.localeCompare(b.number));
  } catch (error) {
    console.error("KCPL containers read failed", error);
    return null;
  }
}

/** The detention terms and dates as entered, checked; null fields clear. */
export function containerFieldsFromInput(input: Record<string, unknown>, today = nepalOperationalDate()) {
  const gatedOut = day(input.gatedOutOn);
  const delivered = day(input.deliveredOn);
  const returned = day(input.emptyReturnedOn);
  if ("error" in gatedOut || "error" in delivered || "error" in returned) return { error: "Enter dates as YYYY-MM-DD." };
  for (const date of [gatedOut.value, delivered.value, returned.value]) if (date && date > today) return { error: "A container date can’t be in the future." };
  const freeDays = money(input.freeDays, 365);
  const rate = money(input.dailyRate, 100_000);
  if ("error" in freeDays || (freeDays.value !== null && !Number.isInteger(freeDays.value))) return { error: "Free days must be a whole number from 0 to 365." };
  if ("error" in rate) return { error: "Enter the daily detention charge as a number." };
  const dates = { gated_out_on: gatedOut.value, delivered_on: delivered.value, empty_returned_on: returned.value };
  if (!containerDatesInOrder(dates)) return { error: "The dates must run in order: out of the port, delivered, empty returned. An empty can’t be returned before it left." };
  const sizeInput = clean(input.sizeType, 4).toUpperCase();
  const bearerInput = clean(input.bearer, 20);
  return {
    fields: {
      ...dates,
      size_type: containerSizeTypes.includes(sizeInput as ContainerSizeType) ? sizeInput : "40HC",
      seal_number: clean(input.sealNumber, 40) || null,
      return_depot: clean(input.returnDepot) || null,
      detention_free_days: freeDays.value,
      detention_daily_rate: rate.value,
      detention_currency: clean(input.currency, 3).toUpperCase() || null,
      detention_bearer: freeTimeBearers.includes(bearerInput as FreeTimeBearer) ? bearerInput : "undecided",
      note: clean(input.note, 300) || null,
    },
  };
}

/** Add one or more containers with the same size and detention terms. Numbers already on the shipment are skipped. */
export async function addShipmentContainers(reference: string, input: Record<string, unknown>, actor: Actor) {
  const parsed = parseContainerNumbers(input.numbers);
  if (parsed.invalid.length) return { kind: "invalid_numbers" as const, invalid: parsed.invalid };
  if (!parsed.valid.length) return { kind: "numbers_required" as const };
  const checked = containerFieldsFromInput({ ...input, gatedOutOn: "", deliveredOn: "", emptyReturnedOn: "" });
  if ("error" in checked) return { kind: "invalid" as const, error: checked.error ?? "" };
  const db = firebaseAdminDb();
  const shipment = db.collection("shipments").doc(reference);
  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(shipment.collection("containers").limit(MAX_CONTAINERS + 1));
    const have = new Set(existing.docs.map((doc) => doc.id));
    const fresh = parsed.valid.filter((number) => !have.has(number));
    if (have.size + fresh.length > MAX_CONTAINERS) return { kind: "too_many" as const };
    const now = new Date().toISOString();
    for (const number of fresh) {
      transaction.create(shipment.collection("containers").doc(number), { number, ...checked.fields, created_at: now, created_by: actor.email, updated_at: now, updated_by: actor.email });
    }
    if (fresh.length) {
      transaction.create(shipment.collection("job_activity").doc(`containers-${Date.now()}`), {
        type: "containers_added", title: fresh.length === 1 ? `Container ${fresh[0]} added` : `${fresh.length} containers added`,
        detail: fresh.slice(0, 6).join(", ") + (fresh.length > 6 ? "…" : ""), actor_name: actor.name, actor_email: actor.email, created_at: now,
      });
      transaction.update(shipment, { updated_at: now });
    }
    return { kind: "added" as const, added: fresh, skipped: parsed.valid.length - fresh.length };
  });
}

/** Update one container's dates and terms; optionally give every container on the shipment the same detention terms. */
export async function updateShipmentContainer(reference: string, id: string, input: Record<string, unknown>, actor: Actor) {
  const number = normalizeContainerNumber(id);
  if (!containerNumberValid(number)) return { kind: "missing" as const };
  const checked = containerFieldsFromInput(input);
  if ("error" in checked) return { kind: "invalid" as const, error: checked.error ?? "" };
  const db = firebaseAdminDb();
  const shipment = db.collection("shipments").doc(reference);
  const ref = shipment.collection("containers").doc(number);
  return db.runTransaction(async (transaction) => {
    const [doc, all] = await Promise.all([transaction.get(ref), input.applyTermsToAll === true ? transaction.get(shipment.collection("containers").limit(MAX_CONTAINERS)) : Promise.resolve(null)]);
    if (!doc.exists) return { kind: "missing" as const };
    const before = containerFromRecord(doc.id, doc.data() as Record<string, unknown>);
    const now = new Date().toISOString();
    transaction.update(ref, { ...checked.fields, updated_at: now, updated_by: actor.email });
    const terms = { detention_free_days: checked.fields.detention_free_days, detention_daily_rate: checked.fields.detention_daily_rate, detention_currency: checked.fields.detention_currency, detention_bearer: checked.fields.detention_bearer, return_depot: checked.fields.return_depot };
    for (const other of all?.docs ?? []) if (other.id !== number) transaction.update(other.ref, { ...terms, updated_at: now, updated_by: actor.email });
    const changes = [
      !before.gated_out_on && checked.fields.gated_out_on ? `out of the port ${checked.fields.gated_out_on}` : "",
      !before.delivered_on && checked.fields.delivered_on ? `delivered ${checked.fields.delivered_on}` : "",
      !before.empty_returned_on && checked.fields.empty_returned_on ? `empty returned ${checked.fields.empty_returned_on}` : "",
    ].filter(Boolean);
    transaction.create(shipment.collection("job_activity").doc(`container-${number}-${Date.now()}`), {
      type: "container_updated", title: `Container ${number} updated`, detail: changes.join(" · ") || (all ? "Detention terms applied to every container" : null),
      actor_name: actor.name, actor_email: actor.email, created_at: now,
    });
    transaction.update(shipment, { updated_at: now });
    return { kind: "updated" as const };
  });
}

export async function removeShipmentContainer(reference: string, id: string, actor: Actor) {
  const number = normalizeContainerNumber(id);
  const db = firebaseAdminDb();
  const shipment = db.collection("shipments").doc(reference);
  const ref = shipment.collection("containers").doc(number);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists) return { kind: "missing" as const };
    // A box that has left the port carries a detention record someone may be billed on.
    if (doc.get("gated_out_on")) return { kind: "has_movement" as const };
    const now = new Date().toISOString();
    transaction.delete(ref);
    transaction.create(shipment.collection("job_activity").doc(`container-${number}-removed-${Date.now()}`), {
      type: "container_removed", title: `Container ${number} removed`, detail: null, actor_name: actor.name, actor_email: actor.email, created_at: now,
    });
    return { kind: "removed" as const };
  });
}
