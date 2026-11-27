// The customer's first contact after an enquiry should not depend on a person
// remembering to write it. This module owns the wording and the reply-by
// promise so both can be tested without a mail provider, and so the email and
// the tracker agree on what KCPL has committed to.

const modeLabels: Record<string, string> = {
  air: "Air freight",
  sea: "Sea freight",
  road: "Road freight",
  unsure: "Mode to be confirmed",
};

// Everything a quote needs that the customer may already hold. Ordered the way a
// shipment file is assembled: goods, then movement, then permissions.
export const quoteAcknowledgementChecklist = [
  "Commercial invoice, or a proforma if the goods are not shipped yet",
  "Packing list with the number of packages, dimensions and weights per package",
  "HS code, or a clear description of the goods and what they are used for",
  "Incoterm (EXW, FOB, CIF, DAP, DDU, DDP) and who is responsible for each leg",
  "Cargo ready date, and the date you need it at destination",
  "Delivery address in Nepal, with any site access limits (narrow road, no forklift, limited receiving hours)",
  "For regulated cargo: import licence, duty-exemption letter, or permit number",
  "For project or oversize cargo: drawings or dimensions, lifting points, and whether a route survey is needed",
] as const;

export const KCPL_PUBLIC_CONTACT = {
  phone: "+977-1-4987510",
  email: "admin@kapileshworcargo.com.np",
  address: "Pragatipath Finance Complex, 2nd Floor, Mhepi Road, Sorakhutte, Kathmandu",
  hours: "Sunday to Friday, 9am to 5:30pm, Nepal time",
} as const;

export type QuoteAcknowledgementInput = {
  reference: string;
  contactName: string;
  contactEmail: string;
  origin: string;
  destination: string;
  mode: string;
  cargoType: string;
};

export function quoteModeLabel(mode: string) {
  const key = mode.trim().toLowerCase();
  return modeLabels[key] || mode.trim() || "Mode to be confirmed";
}

function nepalWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "Asia/Kathmandu",
  }).format(date);
}

// KCPL works Sunday to Friday, so Saturday is the only weekly closed day. An
// enquiry that lands on Friday is answered on Sunday, not Saturday.
export function replyByDate(now: Date) {
  const next = new Date(now.getTime());
  for (let added = 0; added < 8; added += 1) {
    next.setTime(next.getTime() + 24 * 60 * 60 * 1000);
    if (nepalWeekday(next) !== "Saturday") break;
  }
  return next;
}

export function formatReplyBy(now: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kathmandu",
  }).format(replyByDate(now));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function greetingName(name: string) {
  const first = name.trim().split(/\s+/)[0];
  return first || "there";
}

export function quoteAcknowledgementMessage(input: QuoteAcknowledgementInput, now = new Date()) {
  const replyBy = formatReplyBy(now);
  const greeting = greetingName(input.contactName);
  const route = `${input.origin} → ${input.destination}`;
  const cargo = input.cargoType.trim() || "freight";
  const mode = quoteModeLabel(input.mode);
  const subject = `Quote ${input.reference} received — ${input.origin} to ${input.destination}`;

  const textLines = [
    `Dear ${greeting},`,
    "",
    `Thank you — we have your enquiry. Your reference is ${input.reference}: ${cargo} from ${input.origin} to ${input.destination} by ${mode.toLowerCase()}.`,
    "",
    "What happens next",
    `We will send you the route, the equipment and the price for this cargo by ${replyBy}. If anything below changes before then, reply to this email with the reference and we will adjust before quoting.`,
    "",
    "What helps us quote accurately",
    "If you already have these, send them with your reply. If you do not, we will work with what you have and confirm the assumptions in the quote.",
    "",
    ...quoteAcknowledgementChecklist.map((item) => `  [ ] ${item}`),
    "",
    "If any of this is not available yet, that is normal. Tell us what you do not have and we will say what it changes.",
    "",
    "Contact",
    `Reply to this email and it reaches the team handling your enquiry, or call ${KCPL_PUBLIC_CONTACT.phone}.`,
    "",
    "Regards,",
    "Kapileshwor Cargo Pvt. Ltd.",
    KCPL_PUBLIC_CONTACT.address,
    `${KCPL_PUBLIC_CONTACT.phone} · ${KCPL_PUBLIC_CONTACT.email} · kapileshworcargo.com.np`,
    "",
    KCPL_PUBLIC_CONTACT.hours,
  ];

  const safe = {
    greeting: escapeHtml(greeting),
    reference: escapeHtml(input.reference),
    origin: escapeHtml(input.origin),
    destination: escapeHtml(input.destination),
    mode: escapeHtml(mode),
    cargo: escapeHtml(cargo),
    replyBy: escapeHtml(replyBy),
    phone: escapeHtml(KCPL_PUBLIC_CONTACT.phone),
    email: escapeHtml(KCPL_PUBLIC_CONTACT.email),
    address: escapeHtml(KCPL_PUBLIC_CONTACT.address),
    hours: escapeHtml(KCPL_PUBLIC_CONTACT.hours),
  };

  const checklistHtml = quoteAcknowledgementChecklist
    .map(
      (item) =>
        `<tr><td style="padding:6px 10px 6px 0;font-size:15px;color:#df7159;vertical-align:top;">☐</td><td style="padding:6px 0;font-size:13px;line-height:1.6;color:#4f4843;">${escapeHtml(item)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f5f3f0;font-family:Arial,Helvetica,sans-serif;color:#26221f;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3f0;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #ddd8d2;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:22px 26px;background:#df7159;color:#ffffff;">
            <div style="font-size:11px;letter-spacing:.8px;font-weight:700;">Kapileshwor Cargo Pvt. Ltd.</div>
            <div style="margin-top:7px;font-size:24px;font-weight:700;">We have your enquiry</div>
            <div style="margin-top:5px;font-size:13px;color:#fff1ec;">${safe.reference} · ${safe.origin} → ${safe.destination}</div>
          </td></tr>
          <tr><td style="padding:26px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${safe.greeting},</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#625b55;">Thank you — we have your enquiry: <strong>${safe.cargo}</strong> from ${safe.origin} to ${safe.destination} by ${safe.mode}. We will send the route, the equipment and the price for this cargo by <strong>${safe.replyBy}</strong>. If anything changes before then, reply with the reference and we will adjust before quoting.</p>
            <div style="padding:16px 18px;background:#f8f6f3;border:1px solid #e5e0db;border-radius:8px;">
              <div style="font-size:12px;font-weight:700;letter-spacing:.4px;color:#77706a;margin-bottom:8px;">WHAT HELPS US QUOTE ACCURATELY</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${checklistHtml}</table>
            </div>
            <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#625b55;">If any of this is not available yet, that is normal. Tell us what you do not have and we will say what it changes.</p>
            <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#625b55;">Reply to this email and it reaches the team handling your enquiry, or call <a href="tel:${safe.phone.replace(/[^+0-9]/g, "")}" style="color:#a95440;">${safe.phone}</a>.</p>
          </td></tr>
          <tr><td style="padding:18px 26px;border-top:1px solid #ebe6e1;background:#faf9f7;font-size:11px;line-height:1.6;color:#817a73;">
            Kapileshwor Cargo Pvt. Ltd.<br>${safe.address}<br>${safe.phone} · ${safe.email}<br>${safe.hours}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text: textLines.join("\n"), html, replyBy, route };
}
