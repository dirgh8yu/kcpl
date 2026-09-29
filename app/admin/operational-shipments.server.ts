import { cache } from "react";
import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { shipmentStatuses } from "../shipment-types";
import { mapWithConcurrency, readAllDocuments } from "./firestore-scan";
import { openShipmentStatuses, RECENT_DELIVERED_WINDOW } from "./operational-shipments";

/*
 * The shipments an operational screen works from: every open job, however
 * many there are, plus the most recently delivered ones.
 *
 * Screens used to read `shipments.limit(2000)`, which Firestore answers in
 * reference order, oldest first. Past 2,000 jobs the Command Centre, the
 * Shipments register and the Delivery board would have shown old delivered
 * work and missed today's. Open jobs are read completely here. Delivered
 * history is a window of the newest, because a delivered job needs attention
 * for days, not years, and every older one is still a search away.
 *
 * Every query below runs on indexes Firestore keeps automatically, or on the
 * one composite index already declared (status + updated_at desc), so nothing
 * here needs an index deployment.
 */

export { openShipmentStatuses, RECENT_DELIVERED_WINDOW };

export type OperationalShipments = {
  docs: QueryDocumentSnapshot[];
  /** Every open job was read. False only if the scan backstop stopped it. */
  openComplete: boolean;
  /** Delivered jobs beyond the window exist and are not in `docs`. */
  deliveredWindowFull: boolean;
};

export function loadOperationalShipments(db: Firestore, options: { includeDelivered: boolean }): Promise<OperationalShipments> {
  return loadOperationalShipmentsOnce(db, options.includeDelivered);
}

// One read per request: a page that shows the Delivery board and the pulse
// strip (both built from these shipments) reads them once, not twice.
const loadOperationalShipmentsOnce = cache(async (db: Firestore, includeDelivered: boolean): Promise<OperationalShipments> => {
  // Each query is one chain so scripts/firestore-index-audit.mjs can see it.
  const [open, unrecognised, delivered] = await Promise.all([
    // Large pages: each page is a round trip, and open jobs are few enough to fetch in one or two.
    readAllDocuments(db.collection("shipments").where("status", "in", openShipmentStatuses), { pageSize: 2000 }),
    // A status outside the list (legacy or imported) was treated as open by
    // every screen before; keep it visible rather than let it vanish.
    readAllDocuments(db.collection("shipments").where("status", "not-in", [...shipmentStatuses]), { pageSize: 2000 }),
    includeDelivered
      ? db.collection("shipments").where("status", "==", "delivered").orderBy("updated_at", "desc").limit(RECENT_DELIVERED_WINDOW).get()
      : Promise.resolve(null),
  ]);
  return {
    docs: [...open.docs, ...unrecognised.docs, ...(delivered?.docs ?? [])],
    openComplete: open.complete && unrecognised.complete,
    deliveredWindowFull: (delivered?.size ?? 0) >= RECENT_DELIVERED_WINDOW,
  };
});

/**
 * One subcollection (job_tasks, customs_steps…) for each of [shipmentIds],
 * read per shipment. A collection-group scan reads every task ever written,
 * oldest shipments first; this reads only the jobs on screen.
 */
export async function loadShipmentChildren(db: Firestore, shipmentIds: readonly string[], collection: string, perShipmentLimit = 1000) {
  const snapshots = await mapWithConcurrency(shipmentIds, 100, (id) => db.collection("shipments").doc(id).collection(collection).limit(perShipmentLimit).get());
  return snapshots.flatMap((snapshot) => snapshot.docs);
}

/** The documents of [collection] with these ids, read directly: no scan, no cap. */
export async function loadDocumentsById(db: Firestore, collection: string, ids: readonly string[]) {
  // An id with a slash is not a document id; doc() would throw and fail the page.
  const unique = [...new Set(ids.filter((id) => id && !id.includes("/")))];
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += 300) chunks.push(unique.slice(index, index + 300));
  const results = await mapWithConcurrency(chunks, 4, (chunk) => db.getAll(...chunk.map((id) => db.collection(collection).doc(id))));
  return results.flat().filter((snapshot) => snapshot.exists);
}
