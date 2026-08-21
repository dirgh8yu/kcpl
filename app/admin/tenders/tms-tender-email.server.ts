import { firebaseAdminDb } from "../../firebase-admin.server";
import { sendTransactionalEmail, transactionalEmailConfigured } from "../../integrations/sendgrid-email.server";
import type { TmsTender } from "./tms-tendering";

type Actor = { name: string; email: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date);
}

export async function sendTmsTenderEmail(tender: TmsTender, actor: Actor) {
  if (!transactionalEmailConfigured()) return { kind: "not_configured" as const };
  if (!tender.recipient_email) return { kind: "recipient_required" as const };
  const service = tender.service ? `Service: ${tender.service}\n` : "";
  const equipment = tender.equipment ? `Equipment: ${tender.equipment}\n` : "";
  const pickup = tender.pickup_date ? `Pickup date: ${tender.pickup_date}\n` : "";
  const text = [
    `Dear ${tender.recipient_name || tender.partner_name},`,
    "",
    "Kapileshwor Cargo Pvt. Ltd. (KCPL) is tendering the following movement for your confirmation.",
    "",
    `Tender reference: ${tender.tender_reference}`,
    `Route: ${tender.origin} → ${tender.destination}`,
    `Mode: ${tender.mode}`,
    service.trimEnd(),
    equipment.trimEnd(),
    pickup.trimEnd(),
    `Tendered amount: ${tender.currency} ${tender.offered_cost.toFixed(2)}`,
    `Response due: ${dateTime(tender.response_due_at)} NPT`,
    "",
    "Please reply confirming ACCEPTED, REJECTED, or provide a COUNTER-OFFER with amount/currency and any conditions.",
    "",
    "Regards,",
    actor.name || "KCPL Operations",
    "Kapileshwor Cargo Pvt. Ltd. (KCPL)",
  ].filter(Boolean).join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;color:#342f2b"><p style="font-size:12px;color:#b65f4c;font-weight:700">KCPL Tender Desk</p><h2 style="font-size:20px">Transport tender ${escapeHtml(tender.tender_reference)}</h2><p>Dear ${escapeHtml(tender.recipient_name || tender.partner_name)},</p><p>KCPL is tendering the following movement for your confirmation.</p><table style="border-collapse:collapse;width:100%;font-size:13px"><tr><td style="padding:7px 0;color:#777">Route</td><td style="padding:7px 0;font-weight:700">${escapeHtml(tender.origin)} → ${escapeHtml(tender.destination)}</td></tr><tr><td style="padding:7px 0;color:#777">Mode</td><td style="padding:7px 0">${escapeHtml(tender.mode)}</td></tr>${tender.service ? `<tr><td style="padding:7px 0;color:#777">Service</td><td style="padding:7px 0">${escapeHtml(tender.service)}</td></tr>` : ""}${tender.equipment ? `<tr><td style="padding:7px 0;color:#777">Equipment</td><td style="padding:7px 0">${escapeHtml(tender.equipment)}</td></tr>` : ""}<tr><td style="padding:7px 0;color:#777">Tendered amount</td><td style="padding:7px 0;font-weight:700">${escapeHtml(tender.currency)} ${tender.offered_cost.toFixed(2)}</td></tr><tr><td style="padding:7px 0;color:#777">Response due</td><td style="padding:7px 0">${escapeHtml(dateTime(tender.response_due_at))} NPT</td></tr></table><p style="margin-top:18px">Please reply with <strong>ACCEPTED</strong>, <strong>REJECTED</strong>, or a <strong>COUNTER-OFFER</strong> including amount, currency and conditions.</p><p>Regards,<br/>${escapeHtml(actor.name || "KCPL Operations")}<br/>Kapileshwor Cargo Pvt. Ltd. (KCPL)</p></div>`;

  try {
    const delivery = await sendTransactionalEmail({
      to: tender.recipient_email,
      toName: tender.recipient_name || tender.partner_name,
      subject: `KCPL Tender ${tender.tender_reference}: ${tender.origin} to ${tender.destination}`,
      text,
      html,
      category: "kcpl-tender",
      customArgs: { tender_reference: tender.tender_reference, order_id: tender.order_id },
    });
    await firebaseAdminDb().collection("transport_tenders").doc(tender.id).update({
      delivery_status: "sent",
      delivery_provider: delivery.provider,
      delivery_message_id: delivery.messageId,
      delivered_at: delivery.acceptedAt,
      updated_at: delivery.acceptedAt,
    });
    return { kind: "sent" as const, messageId: delivery.messageId };
  } catch (error) {
    const now = new Date().toISOString();
    await firebaseAdminDb().collection("transport_tenders").doc(tender.id).update({
      delivery_status: "failed",
      delivery_error: error instanceof Error ? error.message.slice(0, 800) : "Tender email delivery failed.",
      updated_at: now,
    }).catch(() => undefined);
    return { kind: "failed" as const, error: error instanceof Error ? error.message : "Tender email delivery failed." };
  }
}
