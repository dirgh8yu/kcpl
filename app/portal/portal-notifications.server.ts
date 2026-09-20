import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { sendTransactionalEmail, transactionalEmailConfigured } from "../integrations/sendgrid-email.server";
import { normalizePortalEmail, portalShipmentView } from "./portal-access-policy";
import { listShipmentDocuments } from "../shipment-documents.server";
import {
  portalDocumentReleaseMessage,
  portalMilestoneMessage,
  portalNotificationKey,
  portalNotificationPreferences,
  portalNotifiableDocumentRelease,
  portalNotifiableStatusChange,
} from "./portal-notifications";

/*
 * Customer notification dispatch.
 *
 * This is a scheduled sweep rather than a hook on the writers. Canonical
 * shipment status is set in several places -- the delivery authority, external
 * event promotion, manual delivery control -- and every one of them sits inside
 * the commercial and operational authority the system audit is about. Reading
 * the result on a schedule keeps notification concerns entirely outside that
 * chain: nothing here can fail a booking, delay a settlement or change a state.
 *
 * The cost is latency, bounded by how often the automation endpoint runs, which
 * is the right trade for a customer-facing courtesy.
 */

const ACCOUNT_SCAN_LIMIT = 500;
const SHIPMENT_SCAN_LIMIT = 200;
/** A defensive ceiling: a first run against a large account should not turn
 * into thousands of emails even if the watermark logic is wrong. */
const MAX_EMAILS_PER_SWEEP = 200;

type Account = {
  email: string;
  customerId: string;
  customerName: string;
  preferences: ReturnType<typeof portalNotificationPreferences>;
};

function deliveryId(key: string) {
  return createHash("sha256").update(key).digest("hex").slice(0, 48);
}

function portalUrl(path: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "";
  return origin && path.startsWith("/") ? `${origin}${path}` : path;
}

async function activePortalAccounts(): Promise<Account[]> {
  const snapshot = await firebaseAdminDb().collection("portal_accounts")
    .where("active", "==", true)
    .limit(ACCOUNT_SCAN_LIMIT)
    .get();
  return snapshot.docs.flatMap((document) => {
    const data = document.data() as Record<string, unknown>;
    const email = normalizePortalEmail(data.email) || document.id;
    const customerId = typeof data.customer_id === "string" ? data.customer_id.trim() : "";
    // An unbound account has never proved control of the address. Mailing it
    // shipment movements would leak operational detail to an unverified inbox.
    if (!email || !customerId || !data.uid) return [];
    return [{
      email,
      customerId,
      customerName: typeof data.customer_name === "string" ? data.customer_name : customerId,
      preferences: portalNotificationPreferences(data),
    }];
  });
}

/**
 * Send one milestone email, once.
 *
 * The delivery record is written before the provider call and confirmed after,
 * so a crash between the two leaves a `pending` row rather than a silent
 * re-send on the next sweep.
 */
async function sendOnce(input: { key: string; to: string; subject: string; text: string; html: string; reference: string }) {
  const reference = firebaseAdminDb().collection("portal_email_deliveries").doc(deliveryId(input.key));
  const existing = await reference.get();
  if (existing.exists) return { kind: "already_sent" as const };

  const startedAt = new Date().toISOString();
  try {
    await reference.create({
      status: "pending",
      key: input.key,
      recipient_email: input.to,
      shipment_reference: input.reference,
      subject: input.subject,
      started_at: startedAt,
    });
  } catch {
    // Lost the race against a concurrent sweep; that run owns this message.
    return { kind: "already_sent" as const };
  }

  try {
    const delivery = await sendTransactionalEmail({
      to: input.to,
      subject: `[KCPL] ${input.subject}`,
      text: input.text,
      html: input.html,
      category: "kcpl-portal-shipment",
      customArgs: { notification_key: input.key },
    });
    await reference.set({
      status: "sent",
      sent_at: delivery.acceptedAt,
      provider_message_id: delivery.messageId,
    }, { merge: true });
    return { kind: "sent" as const };
  } catch (error) {
    console.error("KCPL portal notification could not be delivered", error);
    await reference.set({ status: "failed", failed_at: new Date().toISOString() }, { merge: true }).catch(() => undefined);
    return { kind: "failed" as const };
  }
}

export async function dispatchPortalNotifications() {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!transactionalEmailConfigured()) return { kind: "not_configured" as const, sent: 0 };

  const db = firebaseAdminDb();
  let accounts: Account[];
  try {
    accounts = await activePortalAccounts();
  } catch (error) {
    console.error("KCPL portal notification account scan failed", error);
    return { kind: "unavailable" as const };
  }
  if (!accounts.length) return { kind: "completed" as const, sent: 0, watched: 0 };

  const byCustomer = new Map<string, Account[]>();
  for (const account of accounts) {
    byCustomer.set(account.customerId, [...(byCustomer.get(account.customerId) ?? []), account]);
  }

  let sent = 0;
  let watched = 0;

  for (const [customerId, customerAccounts] of byCustomer) {
    const subscribers = customerAccounts.filter((account) => account.preferences.shipment_updates);
    let shipments;
    try {
      shipments = await db.collection("shipments").where("customer_id", "==", customerId).limit(SHIPMENT_SCAN_LIMIT).get();
    } catch (error) {
      console.error("KCPL portal notification shipment scan failed", { customerId, error });
      continue;
    }

    const documentSubscribers = customerAccounts.filter((account) => account.preferences.documents);

    for (const document of shipments.docs) {
      const shipment = portalShipmentView(document.id, document.data() as Record<string, unknown>);
      const stateRef = db.collection("portal_notification_state").doc(document.id);
      const state = await stateRef.get();
      const previous = state.exists && typeof state.get("last_status") === "string" ? state.get("last_status") as string : null;
      const lastSeenUpdatedAt = state.exists && typeof state.get("last_seen_updated_at") === "string"
        ? state.get("last_seen_updated_at") as string
        : null;
      // Null until this shipment has been under notification once. Everything
      // released before that moment is back catalogue, not news.
      const documentsBaseline = state.exists && typeof state.get("documents_baseline_at") === "string"
        ? state.get("documents_baseline_at") as string
        : null;
      watched += 1;

      const now = new Date().toISOString();
      const stateUpdate: Record<string, string> = { customer_id: customerId, last_seen_at: now };
      if (previous !== shipment.status) stateUpdate.last_status = shipment.status;
      if (lastSeenUpdatedAt !== shipment.updated_at) stateUpdate.last_seen_updated_at = shipment.updated_at;
      if (!documentsBaseline) stateUpdate.documents_baseline_at = now;

      if (portalNotifiableStatusChange(previous, shipment.status)) {
        for (const account of subscribers) {
          if (sent >= MAX_EMAILS_PER_SWEEP) break;
          const message = portalMilestoneMessage({
            reference: shipment.reference,
            status: shipment.status,
            mode: shipment.mode,
            origin: shipment.origin,
            destination: shipment.destination,
            eta: shipment.eta,
            currentLocation: shipment.current_location,
            customerName: account.customerName,
            portalUrl: portalUrl(`/portal/shipments/${encodeURIComponent(shipment.reference)}`),
          });
          const result = await sendOnce({
            key: portalNotificationKey({
              topic: "shipment_updates",
              reference: shipment.reference,
              fact: shipment.status,
              recipient: account.email,
            }),
            to: account.email,
            subject: message.subject,
            text: message.text,
            html: message.html,
            reference: shipment.reference,
          });
          if (result.kind === "sent") sent += 1;
        }
      }

      // Documents live in a subcollection, so checking them costs a read per
      // shipment. Releasing a document touches the shipment's `updated_at`, so
      // an unchanged timestamp means nothing can have been released since the
      // last sweep and the read is skipped entirely. A shipment being seen for
      // the first time has no baseline yet, so it is recorded and left alone.
      const worthChecking = documentsBaseline
        && documentSubscribers.length > 0
        && lastSeenUpdatedAt !== shipment.updated_at
        && sent < MAX_EMAILS_PER_SWEEP;

      if (worthChecking) {
        const listing = await listShipmentDocuments(shipment.reference);
        const released = listing.kind === "ready"
          ? listing.documents
              .map((entry) => entry as unknown as Record<string, unknown>)
              .filter((entry) => portalNotifiableDocumentRelease({ document: entry, baseline: documentsBaseline }))
          : [];

        for (const entry of released) {
          for (const account of documentSubscribers) {
            if (sent >= MAX_EMAILS_PER_SWEEP) break;
            const message = portalDocumentReleaseMessage({
              reference: shipment.reference,
              documentType: String(entry.document_type ?? "other"),
              filename: String(entry.filename ?? "Document"),
              origin: shipment.origin,
              destination: shipment.destination,
              customerName: account.customerName,
              portalUrl: portalUrl(`/portal/shipments/${encodeURIComponent(shipment.reference)}#documents`),
            });
            const result = await sendOnce({
              // Keyed by document id, so a later re-review of the same document
              // never mails the customer about it twice.
              key: portalNotificationKey({
                topic: "documents",
                reference: shipment.reference,
                fact: `document-${String(entry.id ?? "")}`,
                recipient: account.email,
              }),
              to: account.email,
              subject: message.subject,
              text: message.text,
              html: message.html,
              reference: shipment.reference,
            });
            if (result.kind === "sent") sent += 1;
          }
        }
      }

      await stateRef.set(stateUpdate, { merge: true });
    }
  }

  return { kind: "completed" as const, sent, watched };
}
