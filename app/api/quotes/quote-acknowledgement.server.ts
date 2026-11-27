import {
  sendTransactionalEmail,
  transactionalEmailConfigured,
} from "../../integrations/sendgrid-email.server";
import {
  quoteAcknowledgementMessage,
  type QuoteAcknowledgementInput,
} from "./quote-acknowledgement-policy";

export type QuoteAcknowledgementResult =
  | { kind: "sent"; messageId: string | null }
  | { kind: "skipped"; reason: "not_configured" }
  | { kind: "failed" };

/**
 * Sends the acknowledgement that follows a saved quote enquiry.
 *
 * Deliberately best-effort: the enquiry is already stored before this runs, and a
 * mail provider outage must never turn into a lost customer or a failed
 * submission the visitor sees. Failures are logged with the reference so a staff
 * member can send the acknowledgement by hand from the admin quote screen.
 */
export async function sendQuoteAcknowledgement(
  input: QuoteAcknowledgementInput,
  now = new Date(),
): Promise<QuoteAcknowledgementResult> {
  if (!transactionalEmailConfigured()) {
    return { kind: "skipped", reason: "not_configured" };
  }

  const message = quoteAcknowledgementMessage(input, now);

  try {
    const delivered = await sendTransactionalEmail({
      to: input.contactEmail,
      toName: input.contactName,
      subject: message.subject,
      text: message.text,
      html: message.html,
      category: "kcpl-quote-acknowledgement",
      customArgs: {
        quote_reference: input.reference,
        kcpl_message_type: "quote-acknowledgement",
      },
    });
    return { kind: "sent", messageId: delivered.messageId };
  } catch (error) {
    console.error("KCPL quote acknowledgement was not sent", {
      reference: input.reference,
      error,
    });
    return { kind: "failed" };
  }
}
