import { getAdminAccess } from "../../../../../admin/admin-auth";
import { getQuoteDetail } from "../../../../../admin/admin-data.server";
import { recordQuoteEmail } from "../../../../../admin/quote-communications.server";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import { EmailConfigurationError, EmailDeliveryError, sendTransactionalEmail } from "../../../../../integrations/sendgrid-email.server";
import { isTrustedSameOriginRequest } from "../../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function modeLabel(mode: string) {
  return ({ air: "Air freight", sea: "Sea freight", road: "Road freight", unsure: "Mode to be confirmed" } as Record<string, string>)[mode] || mode;
}

function money(amount: string, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency} ${amount}`;
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 3 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-AU")}`;
  }
}

function dateOnly(value: string | null) {
  if (!value) return "As discussed";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function quoteMessage(quote: NonNullable<Awaited<ReturnType<typeof getQuoteDetail>>>) {
  const price = money(quote.quoted_amount || "", quote.quote_currency);
  const validity = dateOnly(quote.valid_until);
  const greetingName = quote.contact_name.trim().split(/\s+/)[0] || quote.contact_name;
  const subject = `KCPL Freight Quote ${quote.reference}: ${quote.origin} to ${quote.destination}`;
  const note = quote.customer_quote_note?.trim() || "";

  const textLines = [
    `Dear ${greetingName},`,
    "",
    "Thank you for your freight enquiry with Kapileshwor Cargo Pvt. Ltd. (KCPL).",
    "",
    `Quote reference: ${quote.reference}`,
    `Route: ${quote.origin} → ${quote.destination}`,
    `Mode: ${modeLabel(quote.mode)}`,
    `Quoted price: ${price}`,
    `Valid until: ${validity}`,
  ];
  if (note) textLines.push("", note);
  textLines.push(
    "",
    "Please reply to this email if you would like to proceed or if you need any changes to the quotation.",
    "",
    "Regards,",
    "Kapileshwor Cargo Pvt. Ltd. (KCPL)",
    "Kathmandu, Nepal",
  );

  const safe = {
    greetingName: escapeHtml(greetingName),
    reference: escapeHtml(quote.reference),
    origin: escapeHtml(quote.origin),
    destination: escapeHtml(quote.destination),
    mode: escapeHtml(modeLabel(quote.mode)),
    price: escapeHtml(price),
    validity: escapeHtml(validity),
    note: escapeHtml(note).replaceAll("\n", "<br>"),
  };

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f3f5f6;font-family:Arial,Helvetica,sans-serif;color:#10263f;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f6;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #dfe3e8;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:22px 26px;background:#10263f;color:#ffffff;">
            <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#d7b66f;font-weight:700;">Kapileshwor Cargo Pvt. Ltd.</div>
            <div style="margin-top:7px;font-size:24px;font-weight:700;">Freight quotation</div>
            <div style="margin-top:5px;font-size:13px;color:#c8d1da;">${safe.reference}</div>
          </td></tr>
          <tr><td style="padding:26px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${safe.greetingName},</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#52606d;">Thank you for your freight enquiry with KCPL. Please find the commercial summary of our quotation below.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e2e6e9;border-radius:8px;overflow:hidden;">
              <tr><td style="padding:11px 14px;background:#f8f9fa;font-size:11px;color:#7a858f;width:34%;border-bottom:1px solid #e7eaed;">Route</td><td style="padding:11px 14px;font-size:13px;font-weight:700;border-bottom:1px solid #e7eaed;">${safe.origin} → ${safe.destination}</td></tr>
              <tr><td style="padding:11px 14px;background:#f8f9fa;font-size:11px;color:#7a858f;border-bottom:1px solid #e7eaed;">Mode</td><td style="padding:11px 14px;font-size:13px;font-weight:700;border-bottom:1px solid #e7eaed;">${safe.mode}</td></tr>
              <tr><td style="padding:11px 14px;background:#f8f9fa;font-size:11px;color:#7a858f;border-bottom:1px solid #e7eaed;">Quoted price</td><td style="padding:11px 14px;font-size:18px;font-weight:800;color:#8a672e;border-bottom:1px solid #e7eaed;">${safe.price}</td></tr>
              <tr><td style="padding:11px 14px;background:#f8f9fa;font-size:11px;color:#7a858f;">Valid until</td><td style="padding:11px 14px;font-size:13px;font-weight:700;">${safe.validity}</td></tr>
            </table>
            ${safe.note ? `<div style="margin-top:20px;padding:14px 16px;border-left:3px solid #b78a3e;background:#fffaf0;font-size:13px;line-height:1.7;color:#5c5548;">${safe.note}</div>` : ""}
            <p style="margin:22px 0 0;font-size:14px;line-height:1.7;color:#52606d;">Please reply to this email if you would like to proceed or if you need any changes to the quotation.</p>
          </td></tr>
          <tr><td style="padding:18px 26px;border-top:1px solid #e7eaed;background:#fbfbfa;font-size:11px;line-height:1.6;color:#7c8790;">
            Kapileshwor Cargo Pvt. Ltd. (KCPL)<br>Kathmandu, Nepal
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text: textLines.join("\n"), html };
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin email requests are not accepted." }, 403);

  const access = await getAdminAccess();
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.kind !== "authorized") return json({ ok: false, error: "Admin access is not configured." }, 503);

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canEditCommercial) return json({ ok: false, error: "Commercial edit access is required to send customer quotes." }, 403);

  const { reference } = await context.params;
  const quote = await getQuoteDetail(reference);
  if (quote === undefined) return json({ ok: false, error: "Quote storage is unavailable." }, 503);
  if (!quote) return json({ ok: false, error: "Quote not found." }, 404);
  if (!quote.contact_email.trim()) return json({ ok: false, error: "This enquiry does not have a customer email address." }, 400);
  if (!quote.quoted_amount?.trim()) return json({ ok: false, error: "Add and save a quoted price before sending the customer email." }, 400);

  const message = quoteMessage(quote);
  try {
    const delivered = await sendTransactionalEmail({
      to: quote.contact_email,
      toName: quote.contact_name,
      subject: message.subject,
      text: message.text,
      html: message.html,
      category: "kcpl-quote",
      customArgs: { quote_reference: quote.reference, kcpl_message_type: "quote" },
    });

    const recorded = await recordQuoteEmail({
      reference: quote.reference,
      to: delivered.to,
      from: delivered.from,
      subject: message.subject,
      provider: delivered.provider,
      providerMessageId: delivered.messageId,
      sentAt: delivered.acceptedAt,
      actorName: access.user.displayName,
      actorEmail: access.user.email,
      previousStatus: quote.status,
    });
    if (recorded.kind === "missing") {
      return json({ ok: false, error: "The email was accepted by SendGrid, but the quote audit record could not be saved because the quote no longer exists." }, 409);
    }

    return json({
      ok: true,
      to: delivered.to,
      sentAt: delivered.acceptedAt,
      messageId: delivered.messageId,
      status: recorded.status,
    });
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      console.error("KCPL transactional email is not configured", error);
      return json({ ok: false, error: "Transactional email is not configured yet. Add the SendGrid API key and verified KCPL sender in Firebase." }, 503);
    }
    if (error instanceof EmailDeliveryError) {
      console.error("SendGrid quote delivery failed", quote.reference, error);
      return json({ ok: false, error: "SendGrid could not accept this quote email. Check the sender verification/API key and try again." }, 502);
    }
    console.error("Unexpected quote email failure", quote.reference, error);
    return json({ ok: false, error: "The customer email could not be sent. Please try again." }, 500);
  }
}
