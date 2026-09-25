/*
 * Paying an invoice online through Nepal's gateways: Khalti, eSewa and
 * connectIPS. Pure rules (which gateways are switched on, the amounts, the
 * signatures), tested directly; payments.server.ts does the calls.
 *
 * The rules that matter:
 * - A gateway is offered only when its merchant credentials are configured
 *   and KCPL_PAYMENTS_ENV says whether they are live or test. Nothing is
 *   guessed.
 * - What the browser brings back is never believed. Every payment is looked
 *   up with the gateway, server to server, before a rupee is applied.
 * - A verified payment is applied through accounts' own settlement function,
 *   keyed by the gateway's transaction, so it can never be applied twice.
 */

import { createHmac, createSign, randomBytes } from "node:crypto";

export const paymentGateways = ["khalti", "esewa", "connectips"] as const;
export type PaymentGateway = (typeof paymentGateways)[number];

export const paymentGatewayLabels: Record<PaymentGateway, string> = {
  khalti: "Khalti",
  esewa: "eSewa",
  connectips: "connectIPS",
};

type Env = Record<string, string | undefined>;

export type PaymentsMode = "live" | "test";

export function paymentsMode(env: Env = process.env): PaymentsMode | null {
  const mode = env.KCPL_PAYMENTS_ENV?.trim().toLowerCase();
  return mode === "live" || mode === "test" ? mode : null;
}

/** The gateways with credentials, in the order they are offered. */
export function configuredGateways(env: Env = process.env): PaymentGateway[] {
  if (!paymentsMode(env)) return [];
  const has = (name: string) => Boolean(env[name]?.trim());
  return paymentGateways.filter((gateway) => {
    if (gateway === "khalti") return has("KHALTI_SECRET_KEY");
    if (gateway === "esewa") return has("ESEWA_PRODUCT_CODE") && has("ESEWA_SECRET_KEY");
    return has("CONNECTIPS_MERCHANT_ID") && has("CONNECTIPS_APP_ID") && has("CONNECTIPS_APP_NAME") && has("CONNECTIPS_PASSWORD") && has("CONNECTIPS_PRIVATE_KEY");
  });
}

export function gatewayEndpoints(mode: PaymentsMode) {
  const live = mode === "live";
  return {
    khaltiApi: live ? "https://khalti.com/api/v2/" : "https://dev.khalti.com/api/v2/",
    esewaForm: live ? "https://epay.esewa.com.np/api/epay/main/v2/form" : "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
    esewaStatus: live ? "https://epay.esewa.com.np/api/epay/transaction/status/" : "https://rc.esewa.com.np/api/epay/transaction/status/",
    connectipsForm: live ? "https://login.connectips.com/connectipswebgw/loginpage" : "https://uat.connectips.com/connectipswebgw/loginpage",
    connectipsValidate: live
      ? "https://login.connectips.com/connectipswebws/api/creditor/validatetxn"
      : "https://uat.connectips.com/connectipswebws/api/creditor/validatetxn",
  };
}

/** 20 hex characters: unguessable, and within connectIPS's transaction id limit. */
export function newPaymentIntentId() {
  return randomBytes(10).toString("hex");
}

export function paymentIntentIdValid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{20}$/.test(value);
}

/** Rupees to paisa, exactly: 1040.5 is 104050, never 104049.99…. */
export function toPaisa(rupees: number) {
  return Math.round(rupees * 100);
}

/** eSewa's amount text: rupees with no trailing zeros, as signed. */
export function esewaAmount(paisa: number) {
  const rupees = paisa / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
}

/** eSewa's HMAC-SHA256 over "field=value,…" in signed_field_names order. */
export function esewaSignature(secret: string, fields: Record<string, string>, signedFieldNames: string) {
  const message = signedFieldNames.split(",").map((name) => `${name}=${fields[name] ?? ""}`).join(",");
  return createHmac("sha256", secret).update(message).digest("base64");
}

/** The response eSewa brings back, decoded, with its signature checked. */
export function esewaResponse(data: string | null, secret: string) {
  if (!data) return null;
  let decoded: Record<string, unknown>;
  try {
    decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
  const fields = Object.fromEntries(Object.entries(decoded).map(([key, value]) => [key, String(value ?? "")]));
  const names = fields.signed_field_names ?? "";
  if (!names || !fields.signature) return null;
  if (esewaSignature(secret, fields, names) !== fields.signature) return null;
  return fields;
}

/** "25-09-2026", as connectIPS wants the date. */
export function connectipsDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

export function connectipsTokenMessage(fields: {
  merchantId: string;
  appId: string;
  appName: string;
  txnId: string;
  txnDate: string;
  txnAmount: number;
  referenceId: string;
  remarks: string;
  particulars: string;
}) {
  return [
    `MERCHANTID=${fields.merchantId}`,
    `APPID=${fields.appId}`,
    `APPNAME=${fields.appName}`,
    `TXNID=${fields.txnId}`,
    `TXNDATE=${fields.txnDate}`,
    "TXNCRNCY=NPR",
    `TXNAMT=${fields.txnAmount}`,
    `REFERENCEID=${fields.referenceId}`,
    `REMARKS=${fields.remarks}`,
    `PARTICULARS=${fields.particulars}`,
    "TOKEN=TOKEN",
  ].join(",");
}

export function connectipsValidationMessage(fields: { merchantId: string; appId: string; referenceId: string; txnAmount: number }) {
  return `MERCHANTID=${fields.merchantId},APPID=${fields.appId},REFERENCEID=${fields.referenceId},TXNAMT=${fields.txnAmount}`;
}

/** RSA-SHA256 with the creditor key NCHL issued, base64. */
export function connectipsSign(message: string, privateKeyPem: string) {
  return createSign("RSA-SHA256").update(message).sign(privateKeyPem.replace(/\\n/g, "\n"), "base64");
}

/** Only an NPR invoice with something owed can be paid online: the gateways
 * move rupees, and the whole balance is what is paid. */
/** An issued invoice with money still owed on it, in any currency. */
export function invoiceOwes(invoice: Record<string, unknown>) {
  const balance = typeof invoice.balance_due === "number" ? invoice.balance_due : Number(invoice.balance_due);
  return (
    Number.isFinite(balance)
    && balance > 0
    && ["issued", "partially_paid", "overdue"].includes(String(invoice.status))
    && (invoice.record_type === undefined || invoice.record_type === "invoice")
  );
}

/** A rupee invoice with a balance: paid online and applied at once. */
export function invoicePayableOnline(invoice: Record<string, unknown>) {
  return invoice.currency === "NPR" && invoiceOwes(invoice);
}

/** The gateways' smallest payment (Khalti's floor), in rupees. */
export const MIN_ONLINE_PAYMENT_NPR = 10;

export type OnlinePaymentAmount =
  | { ok: true; invoiceAmount: number; nprPaisa: number; whole: boolean }
  | { ok: false; error: string };

/**
 * What the customer pays, in rupees, for [requested] of the invoice's
 * balance (the whole balance when not given). [nprPerUnit] is 1 for a rupee
 * invoice, otherwise the NRB selling rate for its currency. Never more than
 * is owed; never less than the gateways take.
 */
export function onlinePaymentAmount(invoice: Record<string, unknown>, requested: unknown, nprPerUnit: number): OnlinePaymentAmount {
  const balance = Math.round(Number(invoice.balance_due) * 100) / 100;
  if (!invoiceOwes(invoice) || !Number.isFinite(balance)) return { ok: false, error: "Nothing is owed on this invoice." };
  if (!Number.isFinite(nprPerUnit) || nprPerUnit <= 0) return { ok: false, error: "There is no rate to pay this invoice in rupees today." };
  let amount = balance;
  if (requested !== undefined && requested !== null && requested !== "") {
    const value = typeof requested === "number" ? requested : Number(requested);
    if (!Number.isFinite(value) || value <= 0) return { ok: false, error: "Enter an amount to pay." };
    amount = Math.round(value * 100) / 100;
    if (amount > balance) return { ok: false, error: "That is more than is owed on this invoice." };
  }
  const nprPaisa = Math.round(amount * nprPerUnit * 100);
  if (nprPaisa < MIN_ONLINE_PAYMENT_NPR * 100) return { ok: false, error: `The smallest online payment is NPR ${MIN_ONLINE_PAYMENT_NPR}.` };
  return { ok: true, invoiceAmount: amount, nprPaisa, whole: amount === balance };
}

/** One settlement per gateway transaction, however often it is reported. */
export function paymentIdempotencyKey(gateway: PaymentGateway, transactionId: string) {
  return `${gateway}:${transactionId}`;
}
