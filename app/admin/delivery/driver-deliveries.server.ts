import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import type { KcplStaffContext } from "../staff-directory.server";
import { listDeliveryWorkspace } from "./delivery-control.server";

/*
 * Driver mode's list: today's deliveries in the caller's branches, read only.
 * Recording one goes through the job's own delivery route and Delivery
 * Control; nothing here writes.
 */

type Actor = { name: string; email: string };

export type DriverDelivery = {
  reference: string;
  customer_name: string;
  destination: string;
  /** Where to go: the attempt's own address when one was given, else the
   * shipment's destination. */
  address: string;
  status: string;
  attempt_id: string | null;
  attempt_status: string | null;
  attempt_number: number;
  scheduled_for: string | null;
  driver_name: string | null;
  /** Taken by, scheduled by, or owned by the person asking. */
  mine: boolean;
};

/** "2026-09-25" in Nepal. */
function nepalDay(iso: string) {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time + (5 * 60 + 45) * 60_000).toISOString().slice(0, 10) : "";
}

/**
 * Today's deliveries for driver mode, read only: attempts under way, and
 * shipments due out today, in the caller's branches. The branch scope is
 * Delivery Control's own (listDeliveryWorkspace); nothing here decides access.
 */
export async function deliveriesForToday(staff: KcplStaffContext, me: Actor, now = new Date()): Promise<{ deliveries: DriverDelivery[]; day: string } | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const workspace = await listDeliveryWorkspace(staff);
  if (workspace.kind !== "ready") return null;
  const today = nepalDay(now.toISOString());
  const rows = workspace.rows.filter((row) =>
    row.delivery_state === "delivery_active"
    || (row.delivery_state === "not_started" && (row.status === "out_for_delivery" || (row.next_delivery_at !== null && nepalDay(row.next_delivery_at) === today))),
  ).slice(0, 60);
  if (!rows.length) return { deliveries: [], day: today };

  const db = firebaseAdminDb();
  const shipments = await db.getAll(...rows.map((row) => db.collection("shipments").doc(row.reference)));
  const attemptRefs = shipments.map((doc) => {
    const id = typeof doc.get("delivery_last_attempt_id") === "string" ? String(doc.get("delivery_last_attempt_id")) : "";
    return id ? doc.ref.collection("delivery_attempts").doc(id) : null;
  });
  const wanted = attemptRefs.filter((ref): ref is NonNullable<typeof ref> => ref !== null);
  const attempts = wanted.length ? await db.getAll(...wanted) : [];
  const attemptById = new Map(attempts.filter((doc) => doc.exists).map((doc) => [doc.ref.path, doc.data() as Record<string, unknown>]));
  const email = me.email.trim().toLowerCase();
  const name = me.name.trim().toLowerCase();

  const deliveries = rows.map((row, index) => {
    const shipment = shipments[index];
    const attemptRef = attemptRefs[index];
    const attempt = attemptRef ? attemptById.get(attemptRef.path) ?? null : null;
    const open = attempt && (attempt.status === "scheduled" || attempt.status === "out_for_delivery");
    const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
    const driver = open ? text(attempt?.driver_name) : null;
    const mine = Boolean(
      (open && (text(attempt?.created_by_email)?.toLowerCase() === email || (driver !== null && driver.toLowerCase() === name)))
      || text(shipment.get("job_assigned_to_email"))?.toLowerCase() === email,
    );
    return {
      reference: row.reference,
      customer_name: row.customer_name,
      destination: row.destination,
      address: (open ? text(attempt?.location) : null) ?? row.destination,
      status: row.status,
      attempt_id: open && attemptRef ? attemptRef.id : null,
      attempt_status: open ? String(attempt?.status) : null,
      attempt_number: row.attempt_count,
      scheduled_for: open ? text(attempt?.scheduled_for) : row.next_delivery_at,
      driver_name: driver,
      mine,
    } satisfies DriverDelivery;
  });
  deliveries.sort((a, b) => Number(b.mine) - Number(a.mine) || (a.scheduled_for ?? "9").localeCompare(b.scheduled_for ?? "9"));
  return { deliveries, day: today };
}
