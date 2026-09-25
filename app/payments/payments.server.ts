import { createDirectNotification } from "../admin/notifications/notification-centre.server";
import { kcplBranches } from "../admin/crm/crm-data";
import { recordReceivablePaymentWithSettlementIntegrity } from "../admin/financial-settlement/receivables-settlement.server";
import type { KcplStaffContext } from "../admin/staff-directory.server";
import { staffCapabilitiesForRole } from "../admin/staff-permissions";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import type { PortalSession } from "../portal/portal-auth";
import { portalOwnsInvoice } from "../portal/portal-data.server";
import {
  configuredGateways,
  connectipsDate,
  connectipsSign,
  connectipsTokenMessage,
  connectipsValidationMessage,
  esewaAmount,
  esewaResponse,
  esewaSignature,
  gatewayEndpoints,
  invoicePayableOnline,
  newPaymentIntentId,
  paymentGatewayLabels,
  paymentIdempotencyKey,
  paymentIntentIdValid,
  paymentsMode,
  toPaisa,
  type PaymentGateway,
} from "./payment-gateways";

const INTENTS = "payment_intents";

type Result = { status: number; body: Record<string, unknown> };

export type PaymentIntent = {
  id: string;
  invoice_reference: string;
  customer_id: string;
  email: string;
  gateway: PaymentGateway;
  amount_paisa: number;
  status: "created" | "started" | "paid" | "failed" | "needs_review";
  gateway_reference: string | null;
  created_at: string;
  updated_at: string;
  message: string | null;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

async function loadIntent(id: string): Promise<PaymentIntent | null> {
  if (!paymentIntentIdValid(id) || !firebaseRuntimeConfigured()) return null;
  const snapshot = await firebaseAdminDb().collection(INTENTS).doc(id).get();
  return snapshot.exists ? ({ id: snapshot.id, ...(snapshot.data() as Omit<PaymentIntent, "id">) }) : null;
}

async function markIntent(id: string, update: Partial<PaymentIntent>) {
  await firebaseAdminDb().collection(INTENTS).doc(id).update({ ...update, updated_at: new Date().toISOString() });
}

/** The gateways offered for an invoice the customer can see, or none. */
export async function paymentOptionsFor(session: PortalSession, invoiceReference: string) {
  const gateways = configuredGateways();
  if (!gateways.length || !firebaseRuntimeConfigured()) return [];
  const normalized = invoiceReference.trim().toUpperCase();
  if (!await portalOwnsInvoice(session, normalized)) return [];
  const invoice = await firebaseAdminDb().collection("invoices").doc(normalized).get();
  return invoice.exists && invoicePayableOnline(invoice.data() as Record<string, unknown>) ? gateways : [];
}

/**
 * Starts paying the invoice's whole balance through [gateway]. Returns a URL
 * on KCPL's own site that hands over to the gateway, so the phone never
 * holds a merchant secret or builds a signature.
 */
export async function createPaymentIntent(session: PortalSession, invoiceReference: string, gateway: string, origin: string): Promise<Result> {
  const gateways = configuredGateways();
  if (!gateways.includes(gateway as PaymentGateway)) {
    return { status: 400, body: { ok: false, code: "invalid", error: "That way of paying is not available." } };
  }
  const normalized = invoiceReference.trim().toUpperCase();
  // Finance access is part of ownership: a login without it owns no invoice.
  if (!await portalOwnsInvoice(session, normalized)) return { status: 404, body: { ok: false, code: "missing", error: "Invoice not found." } };
  const invoice = await firebaseAdminDb().collection("invoices").doc(normalized).get();
  const data = invoice.data() as Record<string, unknown> | undefined;
  if (!data || !invoicePayableOnline(data)) {
    return { status: 409, body: { ok: false, code: "conflict", error: "This invoice can't be paid online. Only rupee invoices with a balance can." } };
  }
  const id = newPaymentIntentId();
  const now = new Date().toISOString();
  await firebaseAdminDb().collection(INTENTS).doc(id).create({
    invoice_reference: normalized,
    customer_id: session.customerId,
    email: session.email,
    gateway,
    amount_paisa: toPaisa(Number(data.balance_due)),
    status: "created",
    gateway_reference: null,
    created_at: now,
    updated_at: now,
    message: null,
  });
  return { status: 201, body: { ok: true, intent: id, url: `${origin}/pay/${id}` } };
}

export async function paymentIntentStatus(session: PortalSession, id: string): Promise<Result> {
  const intent = await loadIntent(id);
  if (!intent || intent.customer_id !== session.customerId) return { status: 404, body: { ok: false, code: "missing", error: "Payment not found." } };
  return {
    status: 200,
    body: { ok: true, payment: { id: intent.id, invoice: intent.invoice_reference, gateway: intent.gateway, amount: intent.amount_paisa / 100, status: intent.status, message: intent.message } },
  };
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** A page that posts itself to the gateway: eSewa and connectIPS take a form. */
function autoPost(action: string, fields: Record<string, string>, label: string) {
  const inputs = Object.entries(fields).map(([name, value]) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`).join("");
  return new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Paying with ${escape(label)}</title>` +
      `<style>body{font:17px -apple-system,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f2f2f7;color:#111}` +
      `@media(prefers-color-scheme:dark){body{background:#000;color:#f5f5f7}}button{font:inherit;padding:12px 20px;border:0;border-radius:12px;background:#dc143c;color:#fff}</style></head>` +
      `<body><form id="pay" method="post" action="${escape(action)}">${inputs}<p>Opening ${escape(label)}…</p><noscript><button>Continue to ${escape(label)}</button></noscript></form>` +
      `<script>document.getElementById("pay").submit()</script></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

/** Hands the browser to the gateway for this payment. */
export async function startPayment(id: string, origin: string): Promise<Response> {
  const intent = await loadIntent(id);
  const mode = paymentsMode();
  if (!intent || !mode || intent.status !== "created") return Response.redirect(`${origin}/pay/${id}/done`, 303);
  const endpoints = gatewayEndpoints(mode);
  const invoice = intent.invoice_reference;

  if (intent.gateway === "khalti") {
    const response = await fetch(`${endpoints.khaltiApi}epayment/initiate/`, {
      method: "POST",
      headers: { authorization: `Key ${env("KHALTI_SECRET_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({
        return_url: `${origin}/api/payments/khalti/return`,
        website_url: origin,
        amount: intent.amount_paisa,
        purchase_order_id: intent.id,
        purchase_order_name: `KCPL invoice ${invoice}`,
        customer_info: { email: intent.email },
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { pidx?: string; payment_url?: string };
    if (!response.ok || !body.payment_url || !body.pidx) {
      await markIntent(id, { status: "failed", message: "Khalti could not start the payment." });
      return Response.redirect(`${origin}/pay/${id}/done`, 303);
    }
    await markIntent(id, { status: "started", gateway_reference: body.pidx });
    return Response.redirect(body.payment_url, 303);
  }

  if (intent.gateway === "esewa") {
    const fields: Record<string, string> = {
      amount: esewaAmount(intent.amount_paisa),
      tax_amount: "0",
      total_amount: esewaAmount(intent.amount_paisa),
      transaction_uuid: intent.id,
      product_code: env("ESEWA_PRODUCT_CODE"),
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: `${origin}/api/payments/esewa/return`,
      failure_url: `${origin}/api/payments/esewa/return?failed=${intent.id}`,
      signed_field_names: "total_amount,transaction_uuid,product_code",
    };
    fields.signature = esewaSignature(env("ESEWA_SECRET_KEY"), fields, fields.signed_field_names);
    await markIntent(id, { status: "started" });
    return autoPost(endpoints.esewaForm, fields, "eSewa");
  }

  const txn = {
    merchantId: env("CONNECTIPS_MERCHANT_ID"),
    appId: env("CONNECTIPS_APP_ID"),
    appName: env("CONNECTIPS_APP_NAME"),
    txnId: intent.id,
    txnDate: connectipsDate(),
    txnAmount: intent.amount_paisa,
    referenceId: invoice.slice(0, 20),
    remarks: "KCPL invoice",
    particulars: invoice.slice(0, 20),
  };
  await markIntent(id, { status: "started" });
  return autoPost(endpoints.connectipsForm, {
    MERCHANTID: txn.merchantId,
    APPID: txn.appId,
    APPNAME: txn.appName,
    TXNID: txn.txnId,
    TXNDATE: txn.txnDate,
    TXNCRNCY: "NPR",
    TXNAMT: String(txn.txnAmount),
    REFERENCEID: txn.referenceId,
    REMARKS: txn.remarks,
    PARTICULARS: txn.particulars,
    TOKEN: connectipsSign(connectipsTokenMessage(txn), env("CONNECTIPS_PRIVATE_KEY")),
  }, "connectIPS");
}

/**
 * Applies a verified payment through accounts' own settlement function, as a
 * system actor with finance authority across branches, and keyed by the
 * gateway's transaction so a second report of it settles nothing.
 */
async function settle(intent: PaymentIntent, transactionId: string, paidPaisa: number) {
  if (paidPaisa !== intent.amount_paisa) {
    await markIntent(intent.id, { status: "needs_review", gateway_reference: transactionId, message: "The amount paid differs from the balance. KCPL accounts will match it." });
    await tellAccounts(intent, transactionId, paidPaisa, "The amount paid differs from the invoice balance at the time of payment.");
    return;
  }
  const label = paymentGatewayLabels[intent.gateway];
  const result = await recordReceivablePaymentWithSettlementIntegrity(
    intent.invoice_reference,
    {
      amount: paidPaisa / 100,
      paymentDate: "",
      method: intent.gateway === "connectips" ? "bank_transfer" : "wallet",
      reference: `${label} ${transactionId}`,
      notes: `Paid online by ${intent.email} through ${label}, verified with ${label}.`,
      currency: "NPR",
      idempotencyKey: paymentIdempotencyKey(intent.gateway, transactionId),
    },
    { name: `Online payment (${label})`, email: "payments@kcpl.system" },
    gatewaySettlementContext(),
  );
  if (result.kind === "updated" || result.kind === "idempotent") {
    await markIntent(intent.id, { status: "paid", gateway_reference: transactionId, message: null });
    return;
  }
  // The money moved but the invoice could not take it as it stands (paid in
  // the meantime, changed). It is never lost: accounts are told to match it.
  await markIntent(intent.id, { status: "needs_review", gateway_reference: transactionId, message: "Payment received. KCPL accounts will apply it to the invoice." });
  await tellAccounts(intent, transactionId, paidPaisa, `Automatic settlement was refused (${result.kind}).`);
}

/** Accounts' authority for a payment the gateway has verified: finance
 * access in every branch, and nothing else. */
export function gatewaySettlementContext(): KcplStaffContext {
  const now = new Date().toISOString();
  return {
    profile: {
      uid: "payment-gateway",
      email: "payments@kcpl.system",
      display_name: "Online payment",
      job_title: null,
      phone: null,
      role: "accounts",
      branch_scope: "all",
      branches: [...kcplBranches],
      active: true,
      created_at: now,
      updated_at: now,
      updated_by: null,
    },
    permissions: staffCapabilitiesForRole("accounts"),
    can_access_all_branches: true,
    branches: [...kcplBranches],
  };
}

async function tellAccounts(intent: PaymentIntent, transactionId: string, paidPaisa: number, why: string) {
  try {
    const invoice = await firebaseAdminDb().collection("invoices").doc(intent.invoice_reference).get();
    const targetEmail = typeof invoice.get("created_by_email") === "string" ? (invoice.get("created_by_email") as string) : "";
    if (!targetEmail.trim()) return;
    await createDirectNotification({
      targetEmail,
      category: "finance",
      severity: "warning",
      title: `Online payment to match: ${intent.invoice_reference}`,
      detail: `NPR ${(paidPaisa / 100).toFixed(2)} paid through ${paymentGatewayLabels[intent.gateway]} (${transactionId}). ${why}`,
      actionPath: `/admin/finance/invoices/${encodeURIComponent(intent.invoice_reference)}`,
      parentReference: intent.invoice_reference,
      sourceType: "operational",
      sourceId: intent.invoice_reference,
    });
  } catch (error) {
    console.error("KCPL payment review notification failed", error);
  }
}

/** Khalti's return: looked up with Khalti before anything is believed. */
export async function completeKhalti(url: URL): Promise<string | null> {
  const id = url.searchParams.get("purchase_order_id") ?? "";
  const intent = await loadIntent(id);
  const mode = paymentsMode();
  if (!intent || intent.gateway !== "khalti" || !mode || !intent.gateway_reference) return paymentIntentIdValid(id) ? id : null;
  if (intent.status === "paid" || intent.status === "needs_review") return id;
  const response = await fetch(`${gatewayEndpoints(mode).khaltiApi}epayment/lookup/`, {
    method: "POST",
    headers: { authorization: `Key ${env("KHALTI_SECRET_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({ pidx: intent.gateway_reference }),
  });
  const body = (await response.json().catch(() => ({}))) as { status?: string; total_amount?: number; transaction_id?: string };
  if (response.ok && body.status === "Completed" && body.transaction_id) {
    await settle(intent, body.transaction_id, Number(body.total_amount));
  } else if (body.status && body.status !== "Pending" && body.status !== "Initiated") {
    await markIntent(id, { status: "failed", message: `Khalti reports the payment as ${body.status.toLowerCase()}.` });
  }
  return id;
}

/** eSewa's return: the signed response checked, then the status confirmed
 * with eSewa. */
export async function completeEsewa(url: URL): Promise<string | null> {
  const failed = url.searchParams.get("failed");
  if (failed) {
    const intent = await loadIntent(failed);
    if (intent && intent.status === "started") await markIntent(failed, { status: "failed", message: "The payment was not completed in eSewa." });
    return paymentIntentIdValid(failed) ? failed : null;
  }
  const response = esewaResponse(url.searchParams.get("data"), env("ESEWA_SECRET_KEY"));
  const id = response?.transaction_uuid ?? "";
  const intent = await loadIntent(id);
  const mode = paymentsMode();
  if (!response || !intent || intent.gateway !== "esewa" || !mode) return paymentIntentIdValid(id) ? id : null;
  if (intent.status === "paid" || intent.status === "needs_review") return id;
  const status = new URL(gatewayEndpoints(mode).esewaStatus);
  status.searchParams.set("product_code", env("ESEWA_PRODUCT_CODE"));
  status.searchParams.set("total_amount", esewaAmount(intent.amount_paisa));
  status.searchParams.set("transaction_uuid", intent.id);
  const checked = (await fetch(status).then((r) => r.json()).catch(() => ({}))) as { status?: string; ref_id?: string; total_amount?: number | string };
  if (checked.status === "COMPLETE" && checked.ref_id) {
    await settle(intent, checked.ref_id, toPaisa(Number(checked.total_amount)));
  } else if (checked.status && !["PENDING", "AMBIGUOUS"].includes(checked.status)) {
    await markIntent(id, { status: "failed", message: "eSewa reports the payment as not completed." });
  }
  return id;
}

/** connectIPS's return: validated with NCHL, signed with KCPL's key. */
export async function completeConnectips(url: URL): Promise<string | null> {
  const id = url.searchParams.get("TXNID") ?? "";
  const intent = await loadIntent(id);
  const mode = paymentsMode();
  if (!intent || intent.gateway !== "connectips" || !mode) return paymentIntentIdValid(id) ? id : null;
  if (intent.status === "paid" || intent.status === "needs_review") return id;
  const fields = { merchantId: env("CONNECTIPS_MERCHANT_ID"), appId: env("CONNECTIPS_APP_ID"), referenceId: intent.id, txnAmount: intent.amount_paisa };
  const response = await fetch(gatewayEndpoints(mode).connectipsValidate, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${fields.appId}:${env("CONNECTIPS_PASSWORD")}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ ...fields, token: connectipsSign(connectipsValidationMessage(fields), env("CONNECTIPS_PRIVATE_KEY")) }),
  });
  const body = (await response.json().catch(() => ({}))) as { status?: string; statusDesc?: string };
  if (response.ok && body.status === "SUCCESS") {
    await settle(intent, `CIPS-${intent.id}`, intent.amount_paisa);
  } else if (body.status === "FAILED" || body.status === "ERROR") {
    await markIntent(id, { status: "failed", message: body.statusDesc || "connectIPS reports the payment as not completed." });
  }
  return id;
}

export async function paymentDonePage(id: string) {
  const intent = await loadIntent(id);
  const paid = intent?.status === "paid";
  const review = intent?.status === "needs_review";
  const title = !intent ? "Payment not found" : paid || review ? "Payment received" : intent.status === "failed" ? "Payment not completed" : "Checking the payment";
  const body = !intent
    ? "This payment link is not valid. Open the invoice in the KCPL app to try again."
    : paid
    ? `NPR ${((intent?.amount_paisa ?? 0) / 100).toFixed(2)} was applied to ${intent?.invoice_reference}.`
    : review
      ? intent?.message ?? "KCPL accounts will apply it to the invoice."
      : intent?.message ?? "If you paid, KCPL will confirm it shortly.";
  return new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)}</title>` +
      `<style>body{font:17px -apple-system,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box;background:#f2f2f7;color:#111;text-align:center}` +
      `@media(prefers-color-scheme:dark){body{background:#000;color:#f5f5f7}}h1{font-size:24px;margin:0 0 8px}p{color:#6e6e73;margin:0 0 24px}` +
      `a{display:inline-block;padding:12px 22px;border-radius:12px;background:#dc143c;color:#fff;text-decoration:none;font-weight:600}</style></head>` +
      `<body><main><h1>${escape(title)}</h1><p>${escape(body)}</p><a href="${intent ? `kcpl://payment/${escape(id)}` : "kcpl://"}">Back to KCPL</a></main></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
