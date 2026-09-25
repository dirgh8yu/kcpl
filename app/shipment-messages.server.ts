import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "./firebase-admin.server";
import type { AdminUser } from "./admin/admin-auth";
import { createDirectNotification } from "./admin/notifications/notification-centre.server";
import { checkShipmentBranchAccess } from "./admin/shipment-access.server";
import type { KcplStaffContext } from "./admin/staff-directory.server";
import { mobileDevicesFor, sendMobilePush } from "./mobile-push.server";
import type { PortalSession } from "./portal/portal-auth";
import { portalOwnsShipment } from "./portal/portal-data.server";
import {
  SHIPMENT_MESSAGE_HOURLY_LIMIT,
  shipmentMessageBody,
  shipmentMessagePreview,
  shipmentMessageView,
  staffFirstName,
  type ShipmentMessageSide,
} from "./shipment-messages";

/*
 * The shipment's conversation, shared by every door: the web portal and the
 * KCPL app for the customer, the web Job File and KCPL Ops for staff. Each
 * door adds only its own credential check. Messages live under the shipment
 * (shipments/{ref}/messages); nothing here writes the shipment itself.
 */

type Result = { status: number; body: Record<string, unknown> };

const MESSAGES = "messages";
const refused = (status: number, code: string, error: string): Result => ({ status, body: { ok: false, code, error } });

function thread(reference: string) {
  return firebaseAdminDb().collection("shipments").doc(reference).collection(MESSAGES);
}

async function read(reference: string, viewer: ShipmentMessageSide) {
  const snapshot = await thread(reference).orderBy("created_at", "asc").limitToLast(200).get();
  return snapshot.docs.map((doc) => shipmentMessageView(doc.id, doc.data() as Record<string, unknown>, viewer));
}

async function write(reference: string, message: Record<string, unknown>) {
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  await thread(reference).doc(id).create(message);
  return id;
}

// Customer side ------------------------------------------------------------

export async function customerReadsMessages(session: PortalSession, reference: string): Promise<Result> {
  if (!firebaseRuntimeConfigured()) return refused(503, "unavailable", "Messages are not available just now.");
  const normalized = reference.trim().toUpperCase();
  if (!await portalOwnsShipment(session, normalized)) return refused(404, "missing", "Shipment not found.");
  return { status: 200, body: { ok: true, messages: await read(normalized, "customer") } };
}

/** A customer's message: their own shipment, a limit per hour, and the job
 * owner told at once. Any login that can see the shipment may write. */
export async function customerPostsMessage(session: PortalSession, reference: string, payload: Record<string, unknown>): Promise<Result> {
  if (!firebaseRuntimeConfigured()) return refused(503, "unavailable", "Messages are not available just now.");
  const body = shipmentMessageBody(payload.body);
  if (!body) return refused(400, "invalid", "Write a message first.");
  const normalized = reference.trim().toUpperCase();
  if (!await portalOwnsShipment(session, normalized)) return refused(404, "missing", "Shipment not found.");

  // The newest hundred are enough to count one login's last hour, and need
  // no index beyond the automatic one on created_at.
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const latest = await thread(normalized).orderBy("created_at", "desc").limit(100).get();
  const recent = latest.docs.filter((doc) => doc.get("author_email") === session.email && String(doc.get("created_at")) > since).length;
  if (recent >= SHIPMENT_MESSAGE_HOURLY_LIMIT) return refused(429, "rate_limited", "That's a lot of messages in an hour. Please call your account manager if it's urgent.");

  const now = new Date().toISOString();
  const id = await write(normalized, {
    body,
    author_side: "customer",
    author_name: session.displayName || session.email,
    author_email: session.email,
    customer_id: session.customerId,
    created_at: now,
  });
  await tellJobOwner(normalized, session, body);
  return {
    status: 201,
    body: { ok: true, message: shipmentMessageView(id, { body, author_side: "customer", author_name: session.displayName || session.email, created_at: now }, "customer") },
  };
}

/** The person who owns the job hears about it in KCPL Ops and the web
 * notification centre. An unassigned job has nobody to tell; the thread on
 * the Job File is the backstop. */
async function tellJobOwner(reference: string, session: PortalSession, body: string) {
  try {
    const shipment = await firebaseAdminDb().collection("shipments").doc(reference).get();
    const targetEmail = typeof shipment.get("job_assigned_to_email") === "string" ? String(shipment.get("job_assigned_to_email")) : "";
    if (!targetEmail.trim()) return;
    await createDirectNotification({
      targetEmail,
      targetName: typeof shipment.get("job_assigned_to_name") === "string" ? String(shipment.get("job_assigned_to_name")) : null,
      category: "shipments",
      severity: "info",
      title: `${session.customerName} wrote about ${reference}`,
      detail: shipmentMessagePreview(body),
      actionPath: `/admin/jobs/${encodeURIComponent(reference)}#messages`,
      parentReference: reference,
      sourceType: "operational",
      sourceId: `message:${reference}`,
    });
  } catch (error) {
    console.error("KCPL message notification failed", error);
  }
}

// Staff side -----------------------------------------------------------------

async function staffCanSee(reference: string, staff: KcplStaffContext): Promise<Result | null> {
  const access = await checkShipmentBranchAccess(reference, staff);
  if (access.kind === "unavailable") return refused(503, "unavailable", "Messages are not available just now.");
  if (access.kind === "missing") return refused(404, "missing", "Shipment not found.");
  if (access.kind === "forbidden") return refused(403, "forbidden", "This shipment is outside your branch access.");
  return null;
}

export async function staffReadsMessages(reference: string, staff: KcplStaffContext): Promise<Result> {
  const normalized = reference.trim().toUpperCase();
  const denied = await staffCanSee(normalized, staff);
  if (denied) return denied;
  return { status: 200, body: { ok: true, messages: await read(normalized, "kcpl") } };
}

/** A reply from KCPL: within the staff member's branches, and every login on
 * the customer's account that has the app is told. */
export async function staffPostsMessage(reference: string, payload: Record<string, unknown>, user: AdminUser, staff: KcplStaffContext): Promise<Result> {
  const body = shipmentMessageBody(payload.body);
  if (!body) return refused(400, "invalid", "Write a message first.");
  const normalized = reference.trim().toUpperCase();
  const denied = await staffCanSee(normalized, staff);
  if (denied) return denied;
  const now = new Date().toISOString();
  const id = await write(normalized, {
    body,
    author_side: "kcpl",
    author_name: user.displayName || user.email,
    author_email: user.email,
    created_at: now,
  });
  await tellCustomer(normalized, user, body);
  return {
    status: 201,
    body: { ok: true, message: shipmentMessageView(id, { body, author_side: "kcpl", author_name: user.displayName, created_at: now }, "kcpl") },
  };
}

async function tellCustomer(reference: string, user: AdminUser, body: string) {
  try {
    const db = firebaseAdminDb();
    const shipment = await db.collection("shipments").doc(reference).get();
    const customerId = typeof shipment.get("customer_id") === "string" ? String(shipment.get("customer_id")) : "";
    if (!customerId) return;
    const accounts = await db.collection("portal_accounts").where("customer_id", "==", customerId).where("active", "==", true).limit(50).get();
    for (const account of accounts.docs) {
      const email = typeof account.get("email") === "string" ? String(account.get("email")) : account.id;
      const devices = await mobileDevicesFor("customer", email);
      if (!devices.length) continue;
      await sendMobilePush(devices, {
        title: `KCPL · ${staffFirstName(user.displayName || "KCPL")} on ${reference}`,
        body: shipmentMessagePreview(body),
        target: { kind: "shipment", reference },
        tag: `message:${reference}`,
      });
    }
  } catch (error) {
    console.error("KCPL message push failed", error);
  }
}
