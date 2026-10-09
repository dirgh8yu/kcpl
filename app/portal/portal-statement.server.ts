import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { sendTransactionalEmail, transactionalEmailConfigured } from "../integrations/sendgrid-email.server";
import type { PortalSession } from "./portal-auth";
import { nepalOperationalDate } from "../invoice-effective-status";
import { portalInvoiceView, portalInvoiceVisible } from "./portal-access-policy";
import { buildStatement, type Statement, type StatementPayment, type StatementRefund } from "./portal-statement";
import { invoiceLedgerKind } from "../admin/finance/refund-policy";
import { renderStatementPdf } from "./portal-statement-pdf";
import { readAllDocuments } from "../admin/firestore-scan";

/*
 * Statements of account. Customers with finance access fetch their own
 * (portal and app); accounts send one from the CRM to the customer's owners.
 * Read-only against the ledger: invoices and their payments are read, the
 * only write is the log of a statement sent.
 */


async function statementFor(customerId: string, asOf = nepalOperationalDate()): Promise<Statement> {
  const db = firebaseAdminDb();
  // The whole ledger: a statement that drops invoices past a cap is wrong.
  const snapshot = await readAllDocuments(db.collection("invoices").where("customer_id", "==", customerId));
  const invoices = snapshot.docs
    .map((doc) => ({ ...(doc.data() as Record<string, unknown>), reference: doc.id }))
    .filter(portalInvoiceVisible)
    .map((record) => portalInvoiceView(record, asOf));
  // Payments are read only where something was received. Money moved into
  // or out of the customer's credit isn't money received, so only payments
  // count; refunds are listed on their own.
  const paid = snapshot.docs.filter((doc) => Number(doc.get("amount_paid") ?? 0) > 0 || Number(doc.get("moved_to_credit_total") ?? 0) > 0);
  const payments: StatementPayment[] = (await Promise.all(paid.map(async (doc) => {
    const rows = await doc.ref.collection("payments").limit(100).get();
    const invoice = [doc.get("tax_invoice_number"), doc.get("external_invoice_number")].find((value) => typeof value === "string" && value) as string | undefined ?? doc.id;
    return rows.docs.filter((row: FirebaseFirestore.QueryDocumentSnapshot) => invoiceLedgerKind(row.get("kind")) === "payment").map((row: FirebaseFirestore.QueryDocumentSnapshot): StatementPayment => ({
      invoice,
      date: String(row.get("payment_date") || row.get("created_at") || "").slice(0, 10),
      amount: Number(row.get("amount") ?? 0),
      currency: String(row.get("currency") ?? doc.get("currency") ?? "NPR"),
      method: String(row.get("method") ?? ""),
      reference: typeof row.get("reference") === "string" ? String(row.get("reference")) : null,
    }));
  }))).flat();
  const [refundRows, creditRows] = await Promise.all([
    db.collection("customer_refunds").where("customer_id", "==", customerId).where("status", "==", "paid").get(),
    db.collection("customer_credits").where("customer_id", "==", customerId).where("status", "==", "open").get(),
  ]);
  const refunds: StatementRefund[] = refundRows.docs.map((row: FirebaseFirestore.QueryDocumentSnapshot) => ({
    number: String(row.get("number") ?? "Refund"),
    date: String(row.get("paid_on") ?? "").slice(0, 10),
    amount: Number(row.get("amount") ?? 0),
    currency: String(row.get("currency") ?? "NPR"),
    method: String(row.get("method") ?? ""),
    reference: typeof row.get("payment_reference") === "string" ? String(row.get("payment_reference")) : null,
  }));
  const credits = creditRows.docs.map((row: FirebaseFirestore.QueryDocumentSnapshot) => ({
    currency: String(row.get("currency") ?? "NPR"),
    amount: Number(row.get("available") ?? 0) + Number(row.get("reserved") ?? 0),
  }));
  return buildStatement({ invoices, payments, refunds, credits, asOf });
}

function filename(customer: string, asOf: string) {
  const slug = customer.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "customer";
  return `KCPL-statement-${slug}-${asOf}.pdf`;
}

function generatedAt() {
  return new Date().toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " NPT";
}

export type StatementFile = { kind: "ready"; bytes: Buffer; filename: string } | { kind: "forbidden" } | { kind: "unavailable" };

/** The signed-in customer's own statement. Finance access only, as for invoices. */
export async function portalStatementPdf(session: PortalSession): Promise<StatementFile> {
  if (!session.capabilities.canViewFinance) return { kind: "forbidden" };
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const statement = await statementFor(session.customerId);
    return { kind: "ready", bytes: renderStatementPdf(statement, session.customerName, generatedAt()), filename: filename(session.customerName, statement.asOf) };
  } catch (error) {
    console.error("KCPL portal statement failed", error);
    return { kind: "unavailable" };
  }
}

async function customerName(customerId: string) {
  const customer = await firebaseAdminDb().collection("customers").doc(customerId).get();
  const name = customer.exists ? customer.get("display_name") ?? customer.get("name") : null;
  return typeof name === "string" && name.trim() ? name.trim() : customerId;
}

/** For accounts: the same statement, to look at before sending. */
export async function staffStatementPdf(customerId: string): Promise<StatementFile> {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  const name = await customerName(customerId);
  const statement = await statementFor(customerId);
  return { kind: "ready", bytes: renderStatementPdf(statement, name, generatedAt()), filename: filename(name, statement.asOf) };
}

/**
 * Emails the statement to the customer's portal owners (the logins that see
 * invoices), as a PDF attachment. Refused when email isn't configured or
 * the customer has no one to send it to.
 */
export async function sendStatement(customerId: string, actor: { name: string; email: string }) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!transactionalEmailConfigured()) return { kind: "email_unconfigured" as const };
  const db = firebaseAdminDb();
  const owners = await db.collection("portal_accounts")
    .where("customer_id", "==", customerId)
    .where("active", "==", true)
    .limit(50)
    .get();
  const recipients = owners.docs
    .filter((doc) => doc.get("role") === "owner")
    .map((doc) => String(doc.get("email") ?? doc.id).trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (!recipients.length) return { kind: "no_recipients" as const };
  const name = await customerName(customerId);
  const statement = await statementFor(customerId);
  const pdf = renderStatementPdf(statement, name, generatedAt());
  const file = filename(name, statement.asOf);
  const owed = statement.currencies.filter((c) => c.outstanding > 0).map((c) => `${c.currency} ${c.outstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  const text = [
    `Dear ${name},`,
    "",
    `Your statement of account from KCPL as of ${statement.asOf} is attached.`,
    owed.length ? `Owed now: ${owed.join(", ")}.` : "Nothing is owed on your account.",
    "",
    "You can also download it any time from the KCPL app or your customer portal (Invoices).",
    "",
    `Sent by ${actor.name} on behalf of KCPL accounts.`,
  ].join("\n");
  const html = text.split("\n").map((line) => (line ? `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px">${line.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p>` : "")).join("");
  const sent: string[] = [];
  for (const to of recipients) {
    await sendTransactionalEmail({
      to,
      subject: `KCPL statement of account · ${statement.asOf}`,
      text,
      html,
      category: "kcpl-statement",
      attachments: [{ filename: file, content: pdf, type: "application/pdf" }],
    });
    sent.push(to);
  }
  await db.collection("customers").doc(customerId).collection("statement_sends").add({
    as_of: statement.asOf,
    recipients: sent,
    sent_by_name: actor.name,
    sent_by_email: actor.email,
    sent_at: new Date().toISOString(),
  });
  return { kind: "sent" as const, recipients: sent };
}
