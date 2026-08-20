import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDb } from "../firebase-admin.server";
import type { QuoteStatus } from "./admin-data";

type QuoteEmailAuditInput = {
  reference: string;
  to: string;
  from: string;
  subject: string;
  provider: string;
  providerMessageId: string | null;
  sentAt: string;
  actorName: string;
  actorEmail: string;
  previousStatus: QuoteStatus;
};

function communicationId(sentAt: string) {
  const safeTime = sentAt.replace(/[^0-9]/g, "").slice(0, 17);
  return `email-${safeTime}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function recordQuoteEmail(input: QuoteEmailAuditInput) {
  const db = firebaseAdminDb();
  const normalized = input.reference.trim().toUpperCase();
  const quoteRef = db.collection("quotes").doc(normalized);
  const quote = await quoteRef.get();
  if (!quote.exists) return { kind: "missing" as const };

  const nextStatus: QuoteStatus = input.previousStatus === "new" || input.previousStatus === "reviewing"
    ? "quoted"
    : input.previousStatus;
  const id = communicationId(input.sentAt);
  const communication = {
    id,
    quote_reference: normalized,
    type: "quote_email",
    channel: "email",
    direction: "outbound",
    to: input.to,
    from: input.from,
    subject: input.subject,
    provider: input.provider,
    provider_message_id: input.providerMessageId,
    status: "accepted",
    sent_at: input.sentAt,
    actor_name: input.actorName,
    actor_email: input.actorEmail,
    created_at: input.sentAt,
  };

  const batch = db.batch();
  batch.set(quoteRef.collection("communications").doc(id), communication);
  batch.update(quoteRef, {
    status: nextStatus,
    last_customer_email_at: input.sentAt,
    last_customer_email_to: input.to,
    last_customer_email_provider: input.provider,
    last_customer_email_provider_message_id: input.providerMessageId,
    email_count: FieldValue.increment(1),
    updated_at: input.sentAt,
  });
  await batch.commit();

  return { kind: "recorded" as const, status: nextStatus, communication };
}
