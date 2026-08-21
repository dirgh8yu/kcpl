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

function todayInNepal() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
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
  <body style="margin:0;background:#f5f3f0;font-family:Arial,Helvetica,sans-serif;color:#26221f;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3f0;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #ddd8d2;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:22px 26px;background:#df7159;color:#ffffff;">
            <div style="font-size:11px;letter-spacing:.8px;font-weight:700;">Kapileshwor Cargo Pvt. Ltd.</div>
            <div style="margin-top:7px;font-size:24px;font-weight:700;">Freight quotation</div>
            <div style="margin-top:5px;font-size:13px;color:#fff1ec;">${safe.reference}</div>
          </td></tr>
          <tr><td style="padding:26px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${safe.greetingName},</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#625b55;">Thank you for your freight enquiry with KCPL. Please find the commercial summary of our quotation below.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e0db;border-radius:8px;overflow:hidden;">
              <tr><td style="padding:11px 14px;background:#f8f6f3;font-size:11px;color:#77706a;width:34%;border-bottom:1px solid #ebe6e1;">Route</td><td style="padding:11px 14px;font-size:13px;font-weight:700;border-bottom:1px solid #ebe6e1;">${safe.origin} → ${safe.destination}</td></tr>
              <tr><td style="padding:11px 14px;background:#f8f6f3;font-size:11px;color:#77706a;border-bottom:1px solid #ebe6e1;">Mode</td><td style="padding:11px 14px;font-size:13px;font-weight:700;border-bottom:1px solid #ebe6e1;">${safe.mode}</td></tr>
              <tr><td style="padding:11px 14px;background:#f8f6f3;font-size:11px;color:#77706a;border-bottom:1px solid #ebe6e1;">Quoted price</td><td style="padding:11px 14px;font-size:18px;font-weight:800;color:#a95440;border-bottom:1px solid #ebe6e1;">${safe.price}</td></tr>
              <tr><td style="padding:11px 14px;background:#f8f6f3;font-size:11px;color:#77706a;">Valid until</td><td style="padding:11px 14px;font-size:13px;font-weight:700;">${safe.validity}</td></tr>
            </table>
            ${safe.note ? `<div style="margin-top:20px;padding:14px 16px;border-left:3px solid #df7159;background:#fff6f2;font-size:13px;line-height:1.7;color:#5e554f;">${safe.note}</div>` : ""}
            <p style="margin:22px 0 0;font-size:14px;line-height:1.7;color:#625b55;">Please reply to this email if you would like to proceed or if you need any changes to the quotation.</p>
          </td></tr>
          <tr><td style="padding:18px 26px;border-top:1px solid #ebe6e1;background:#faf9f7;font-size:11px;line-height:1.6;color:#817a73;">
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
  if (!quote.quoted_amount?.trim() || Number(quote.quoted_amount) <= 0) return json({ ok: false, error: "Add and save a customer price greater than zero before sending the quote email." }, 400);
  if (quote.valid_until && quote.valid_until < todayInNepal()) {
    return json({ ok: false, error: "This quote has expired. Update the validity date before sending it to the customer." }, 409);
  }
  if (quote.status === "lost") {
    return json({ ok: false, error: "This enquiry is marked Lost. Reopen it before sending another customer quote." }, 409);
  }

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
      communication: recorded.communication,
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