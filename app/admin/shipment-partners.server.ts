import { firebaseAdminDb } from "../firebase-admin.server";
import { partnerShipmentAccessFromRecord, partnerShipmentRoles, type PartnerShipmentRole } from "../partner/partner-access-policy";

/*
 * Which partners can see a shipment in the partner portal. Kept on the
 * shipment as a list (who, in what role) and a flat list of ids the partner
 * portal queries by. Removing a partner takes the shipment off their portal
 * at once.
 */

type Actor = { name: string; email: string };

export async function addShipmentPartner(reference: string, input: { partnerId: string; role: string }, actor: Actor) {
  const db = firebaseAdminDb();
  const shipment = db.collection("shipments").doc(reference);
  const partnerId = input.partnerId.trim();
  const role = partnerShipmentRoles.includes(input.role as PartnerShipmentRole) ? input.role as PartnerShipmentRole : "other";
  return db.runTransaction(async (transaction) => {
    const [doc, partner] = await Promise.all([transaction.get(shipment), partnerId ? transaction.get(db.collection("partners").doc(partnerId)) : Promise.resolve(null)]);
    if (!doc.exists) return { kind: "missing" as const };
    if (!partner?.exists) return { kind: "partner_missing" as const };
    if (partner.get("status") === "inactive") return { kind: "partner_inactive" as const };
    const access = partnerShipmentAccessFromRecord(doc.get("partner_access"));
    if (access.some((item) => item.partner_id === partnerId)) return { kind: "already_added" as const };
    const now = new Date().toISOString();
    const name = typeof partner.get("display_name") === "string" ? partner.get("display_name") as string : "Partner";
    const next = [...access, { partner_id: partnerId, partner_name: name, role, added_at: now, added_by: actor.email }];
    transaction.update(shipment, { partner_access: next, partner_access_ids: next.map((item) => item.partner_id), updated_at: now });
    transaction.create(shipment.collection("job_activity").doc(`partner-added-${Date.now()}`), {
      type: "partner_access_added", title: `${name} can see this shipment`, detail: role.replace("_", " "), actor_name: actor.name, actor_email: actor.email, created_at: now,
    });
    return { kind: "added" as const };
  });
}

export async function removeShipmentPartner(reference: string, partnerId: string, actor: Actor) {
  const db = firebaseAdminDb();
  const shipment = db.collection("shipments").doc(reference);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(shipment);
    if (!doc.exists) return { kind: "missing" as const };
    const access = partnerShipmentAccessFromRecord(doc.get("partner_access"));
    const removed = access.find((item) => item.partner_id === partnerId);
    if (!removed) return { kind: "not_added" as const };
    const next = access.filter((item) => item.partner_id !== partnerId);
    const now = new Date().toISOString();
    transaction.update(shipment, { partner_access: next, partner_access_ids: next.map((item) => item.partner_id), updated_at: now });
    transaction.create(shipment.collection("job_activity").doc(`partner-removed-${Date.now()}`), {
      type: "partner_access_removed", title: `${removed.partner_name} no longer sees this shipment`, detail: null, actor_name: actor.name, actor_email: actor.email, created_at: now,
    });
    return { kind: "removed" as const };
  });
}

export async function readShipmentPartners(reference: string) {
  try {
    const doc = await firebaseAdminDb().collection("shipments").doc(reference.trim().toUpperCase()).get();
    return doc.exists ? partnerShipmentAccessFromRecord(doc.get("partner_access")) : [];
  } catch (error) {
    console.error("KCPL shipment partners read failed", error);
    return null;
  }
}
