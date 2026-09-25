import { sendSms, smsConfigured } from "../integrations/sms.server";
import { sendWhatsappTemplate, whatsappConfigured } from "../integrations/whatsapp.server";
import { storedTextNotice, textNoticeSms, type TextNoticeSettings } from "./portal-text-notices";
import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { sendTransactionalEmail, transactionalEmailConfigured } from "../integrations/sendgrid-email.server";
import { normalizePortalEmail, portalDocumentChecklist, portalOutstandingUploads, portalShipmentView } from "./portal-access-policy";
import { listShipmentDocuments } from "../shipment-documents.server";
import { portalLocaleValue, portalText, type PortalLocale } from "./portal-i18n";
import { portalStatusLabel } from "./portal-format";
import {
  portalPushConfigured,
  portalPushSubscriptionsByEmail,
  sendPortalPush,
  type PortalPushSubscription,
} from "./portal-push.server";
import { mobileDevicesFor, refreshLiveActivities, sendMobilePush, type MobileDevice } from "../mobile-push.server";
import { customerPushTarget, liveActivityState } from "../mobile-push-policy";
import { freeTimeReminderThreshold, freeTimeStatus, shipmentFreeTimeFromRecord } from "../shipment-free-time";
import {
  portalDocumentReleaseMessage,
  portalDocumentRequestFact,
  portalDocumentRequestMessage,
  portalFreeTimeMessage,
  portalInvoiceMessage,
  portalInvoiceReminder,
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
/** How often an active shipment's document checklist is re-read when
 * nothing on the shipment itself has changed. */
const DOCUMENT_REQUEST_RECHECK_MS = 6 * 60 * 60 * 1000;
const MAX_EMAILS_PER_SWEEP = 200;

type Account = {
  email: string;
  customerId: string;
  customerName: string;
  preferences: ReturnType<typeof portalNotificationPreferences>;
  /** Only an owner sees invoices, so only an owner is reminded of them. */
  owner: boolean;
  /** SMS or WhatsApp, when the customer asked for it. */
  textNotice: TextNoticeSettings;
  /** Each recipient is written to in their own language, which is why the
   * preference lives on the account: this sweep has no browser to ask. */
  locale: PortalLocale;
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
      locale: portalLocaleValue(data.locale),
      preferences: portalNotificationPreferences(data),
      owner: data.role === "owner",
      textNotice: storedTextNotice(data),
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
/**
 * Push the same fact to the account's registered browsers.
 *
 * Push is a transport, not a second policy: this is only reached for a
 * message the notification rules already decided to send, under the same
 * deterministic key. The key is claimed once per fact per recipient, so a
 * customer with a phone and a laptop gets one notification on each rather
 * than the same fact twice on both.
 *
 * Nothing here can fail a sweep. A dead endpoint is dropped by the delivery
 * module and every other failure is logged and stepped over, because an
 * undelivered push must not cost the email that carries the same news.
 */
async function pushOnce(input: {
  key: string;
  account: Account;
  subject: string;
  text: string;
  url: string;
  subscriptions: Map<string, PortalPushSubscription[]>;
  /** The account's app installs, looked up once per recipient per sweep. */
  mobileDevices: Map<string, Promise<MobileDevice[]>>;
}) {
  // SMS or WhatsApp rides on the same fact, for a customer who asked for it.
  await textOnce(input.key, input.account, input.subject, input.text);
  const targets = portalPushConfigured() ? input.subscriptions.get(input.account.email) ?? [] : [];
  let devices = input.mobileDevices.get(input.account.email);
  if (!devices) {
    devices = mobileDevicesFor("customer", input.account.email);
    input.mobileDevices.set(input.account.email, devices);
  }
  const phones = await devices;
  if (!targets.length && !phones.length) return;

  const reference = firebaseAdminDb().collection("portal_push_deliveries").doc(deliveryId(input.key));
  try {
    // create() rather than set(): losing the race means another sweep owns
    // this fact, exactly as it does for email.
    await reference.create({
      key: input.key,
      recipient_email: input.account.email,
      started_at: new Date().toISOString(),
    });
  } catch {
    return;
  }

  // The first line of the email body is the sentence a person reads on a lock
  // screen; the rest is the detail table, which has no place there.
  const body = input.text.split("\n")[0] ?? "";
  for (const target of targets) {
    await sendPortalPush(target, {
      title: input.subject,
      body,
      url: input.url,
      // The delivery key, so the same fact arriving twice replaces the first
      // notification rather than stacking a duplicate.
      tag: input.key,
      lang: input.account.locale,
    });
  }
  // The app gets the same fact under the same claim: one notification per
  // device, and a tap opens the shipment it is about.
  const target = customerPushTarget(input.url);
  await sendMobilePush(phones, {
    title: input.subject,
    body,
    target,
    tag: input.key,
  });
  // The shipment on their lock screen, if they follow it there, moves too.
  if (target.kind === "shipment" && target.reference) {
    const locale = input.account.locale;
    await refreshLiveActivities(input.account.email, target.reference, (shipment) =>
      liveActivityState(
        shipment,
        (status) => portalStatusLabel(status, locale),
        (date) => portalText(locale, "overview.col_eta") + " " + date,
      ));
  }
}

/**
 * The fact as one SMS or WhatsApp message, once. Claimed under its own
 * collection, so it is independent of email and push; a provider failure is
 * logged and never costs the other channels.
 */
async function textOnce(key: string, account: Account, subject: string, text: string) {
  const notice = account.textNotice;
  if (notice.channel === "none" || !notice.phone) return;
  if (notice.channel === "sms" ? !smsConfigured() : !whatsappConfigured()) return;
  const reference = firebaseAdminDb().collection("portal_text_deliveries").doc(deliveryId(`${key}|${notice.channel}`));
  try {
    await reference.create({ key, channel: notice.channel, recipient_email: account.email, started_at: new Date().toISOString() });
  } catch {
    return;
  }
  const line = text.split("\n")[0] ?? "";
  try {
    if (notice.channel === "sms") await sendSms(notice.phone, textNoticeSms(subject, line));
    else await sendWhatsappTemplate(notice.phone, subject, line, account.locale === "ne" ? "ne" : "en");
    // "accepted": the provider took the message; handset delivery is theirs to report.
    await reference.update({ status: "accepted", accepted_at: new Date().toISOString() });
  } catch (error) {
    await reference.update({ status: "failed", error: error instanceof Error ? error.message.slice(0, 300) : "failed" }).catch(() => undefined);
    console.error("KCPL text notice failed", { channel: notice.channel, error });
  }
}

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

  // One read for the whole sweep rather than one per recipient: a customer
  // with three browsers still costs nothing extra per shipment.
  const pushSubscriptions = portalPushConfigured()
    ? await portalPushSubscriptionsByEmail()
    : new Map<string, PortalPushSubscription[]>();
  const mobileDevices = new Map<string, Promise<MobileDevice[]>>();

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

    const freeTimeSubscribers = customerAccounts.filter((account) => account.preferences.free_time);
    const today = new Date().toISOString().slice(0, 10);

    for (const document of shipments.docs) {
      const record = document.data() as Record<string, unknown>;
      const shipment = portalShipmentView(document.id, record);
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
      const requestsCheckedAt = state.exists && typeof state.get("requests_checked_at") === "string"
        ? state.get("requests_checked_at") as string
        : null;
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
          }, account.locale);
          const key = portalNotificationKey({
            topic: "shipment_updates",
            reference: shipment.reference,
            fact: shipment.status,
            recipient: account.email,
          });
          const result = await sendOnce({
            key,
            to: account.email,
            subject: message.subject,
            text: message.text,
            html: message.html,
            reference: shipment.reference,
          });
          if (result.kind === "sent") sent += 1;
          await pushOnce({
            key,
            account,
            subject: message.subject,
            text: message.text,
            url: portalUrl(`/portal/shipments/${encodeURIComponent(shipment.reference)}`),
            subscriptions: pushSubscriptions,
            mobileDevices,
          });
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
            }, account.locale);
            // Keyed by document id, so a later re-review of the same document
            // never notifies the customer about it twice.
            const key = portalNotificationKey({
              topic: "documents",
              reference: shipment.reference,
              fact: `document-${String(entry.id ?? "")}`,
              recipient: account.email,
            });
            const result = await sendOnce({
              key,
              to: account.email,
              subject: message.subject,
              text: message.text,
              html: message.html,
              reference: shipment.reference,
            });
            if (result.kind === "sent") sent += 1;
            await pushOnce({
              key,
              account,
              subject: message.subject,
              text: message.text,
              url: portalUrl(`/portal/shipments/${encodeURIComponent(shipment.reference)}#documents`),
              subscriptions: pushSubscriptions,
              mobileDevices,
            });
          }
        }
      }

      // What KCPL is waiting on from the customer. A requirement or a rejected
      // copy doesn't always touch the shipment, so an active shipment is also
      // looked at every few hours; otherwise only when it changed.
      const requestsDue = documentsBaseline
        && documentSubscribers.length > 0
        && shipment.status !== "delivered"
        && sent < MAX_EMAILS_PER_SWEEP
        && (lastSeenUpdatedAt !== shipment.updated_at || !requestsCheckedAt || Date.parse(requestsCheckedAt) < Date.now() - DOCUMENT_REQUEST_RECHECK_MS);
      if (requestsDue) {
        stateUpdate.requests_checked_at = now;
        const [listing, requirementSnapshot] = await Promise.all([
          listShipmentDocuments(shipment.reference),
          db.collection("shipments").doc(shipment.reference).collection("document_requirements").limit(100).get(),
        ]);
        const documents = listing.kind === "ready" ? listing.documents.map((entry) => entry as unknown as Record<string, unknown>) : [];
        const requirements = requirementSnapshot.docs.map((entry) => entry.data() as Record<string, unknown>);
        for (const row of portalOutstandingUploads(portalDocumentChecklist({ requirements, documents }))) {
          const fact = portalDocumentRequestFact({
            documentType: row.document_type,
            state: row.state,
            requirement: requirements.find((entry) => entry.document_type === row.document_type),
            documents,
            baseline: documentsBaseline,
          });
          if (!fact) continue;
          // The app opens the send sheet for this document from the push.
          const url = portalUrl(`/portal/shipments/${encodeURIComponent(shipment.reference)}?send=${encodeURIComponent(row.document_type)}#documents`);
          for (const account of documentSubscribers) {
            if (sent >= MAX_EMAILS_PER_SWEEP) break;
            const message = portalDocumentRequestMessage({
              reference: shipment.reference,
              documentType: row.document_type,
              resend: row.state === "resend",
              origin: shipment.origin,
              destination: shipment.destination,
              customerName: account.customerName,
              portalUrl: url,
            }, account.locale);
            const key = portalNotificationKey({ topic: "documents", reference: shipment.reference, fact, recipient: account.email });
            const result = await sendOnce({ key, to: account.email, subject: message.subject, text: message.text, html: message.html, reference: shipment.reference });
            if (result.kind === "sent") sent += 1;
            await pushOnce({ key, account, subject: message.subject, text: message.text, url, subscriptions: pushSubscriptions, mobileDevices });
          }
        }
      }

      // Free time rides on the shipment document already read, so the warning
      // costs nothing extra. Only the thresholds are notified, and each is its
      // own delivery key, so a sweep running hourly still sends once per step.
      if (shipment.status !== "delivered" && freeTimeSubscribers.length > 0) {
        const freeTime = shipmentFreeTimeFromRecord(record);
        const status = freeTimeStatus(freeTime, today);
        const threshold = freeTimeReminderThreshold(status);
        if (threshold !== null) {
          for (const account of freeTimeSubscribers) {
            if (sent >= MAX_EMAILS_PER_SWEEP) break;
            const message = portalFreeTimeMessage({
              reference: shipment.reference,
              origin: shipment.origin,
              destination: shipment.destination,
              location: freeTime.location,
              daysRemaining: status.daysRemaining,
              deadline: status.deadline,
              customerName: account.customerName,
              portalUrl: portalUrl(`/portal/shipments/${encodeURIComponent(shipment.reference)}`),
            }, account.locale);
            const key = portalNotificationKey({
              topic: "free_time",
              reference: shipment.reference,
              fact: `free-time-${threshold}-${status.deadline ?? ""}`,
              recipient: account.email,
            });
            const result = await sendOnce({
              key,
              to: account.email,
              subject: message.subject,
              text: message.text,
              html: message.html,
              reference: shipment.reference,
            });
            if (result.kind === "sent") sent += 1;
            await pushOnce({
              key,
              account,
              subject: message.subject,
              text: message.text,
              url: portalUrl(`/portal/shipments/${encodeURIComponent(shipment.reference)}`),
              subscriptions: pushSubscriptions,
              mobileDevices,
            });
          }
        }
      }

      await stateRef.set(stateUpdate, { merge: true });
    }

    // Invoices due soon or just overdue, to owners who want them. The keys
    // carry the due date, so a re-dated invoice is reminded afresh.
    const invoiceSubscribers = customerAccounts.filter((account) => account.owner && account.preferences.invoices);
    if (invoiceSubscribers.length && sent < MAX_EMAILS_PER_SWEEP) {
      let invoices;
      try {
        invoices = await db.collection("invoices").where("customer_id", "==", customerId).limit(SHIPMENT_SCAN_LIMIT).get();
      } catch (error) {
        console.error("KCPL portal invoice reminder scan failed", { customerId, error });
        invoices = null;
      }
      for (const invoice of invoices?.docs ?? []) {
        const data = invoice.data() as Record<string, unknown>;
        const reminder = portalInvoiceReminder(data, today);
        if (!reminder) continue;
        const url = portalUrl(`/portal/invoices/${encodeURIComponent(invoice.id)}`);
        for (const account of invoiceSubscribers) {
          if (sent >= MAX_EMAILS_PER_SWEEP) break;
          const message = portalInvoiceMessage({
            reference: invoice.id,
            reminder,
            balance: Number(data.balance_due),
            currency: String(data.currency ?? "NPR"),
            customerName: account.customerName,
            portalUrl: url,
          }, account.locale);
          const key = portalNotificationKey({
            topic: "invoices",
            reference: invoice.id,
            fact: `invoice-${reminder.fact}-${reminder.dueDate}`,
            recipient: account.email,
          });
          const result = await sendOnce({ key, to: account.email, subject: message.subject, text: message.text, html: message.html, reference: invoice.id });
          if (result.kind === "sent") sent += 1;
          await pushOnce({ key, account, subject: message.subject, text: message.text, url, subscriptions: pushSubscriptions, mobileDevices });
        }
      }
    }
  }

  return { kind: "completed" as const, sent, watched };
}
