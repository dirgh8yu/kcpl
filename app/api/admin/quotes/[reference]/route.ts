import { getAdminAccess } from "../../../../admin/admin-auth";
import { quoteCurrencies, QuoteCurrency, quoteStatuses, QuoteStatus } from "../../../../admin/admin-data";
import { addQuoteNote, getQuoteDetail, updateQuoteAdmin, updateQuoteCommercial } from "../../../../admin/admin-data.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";
import { ensureShipmentForWonQuote } from "../../../../shipment-data.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind === "authorized") return { user: access.user };
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  return { response: json({ ok: false, error: "Admin access is not configured." }, 503) };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const moneyPattern = /^\d{1,12}(?:\.\d{1,3})?$/;

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;

  const { reference } = await context.params;
  try {
    const quote = await getQuoteDetail(reference);
    if (quote === undefined) return json({ ok: false, error: "Quote storage is unavailable." }, 503);
    if (!quote) return json({ ok: false, error: "Quote not found." }, 404);
    return json({ ok: true, quote });
  } catch (error) {
    console.error("Failed to load KCPL quote detail", reference, error);
    return json({ ok: false, error: "The enquiry could not be loaded. Please refresh and try again." }, 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin updates are not accepted." }, 403);

  const { reference } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The update could not be read." }, 400);
  }

  if (body.action === "commercial") {
    const currency = clean(body.currency).toUpperCase();
    const quotedAmount = clean(body.quotedAmount);
    const internalCost = clean(body.internalCost);
    const validUntil = clean(body.validUntil);
    const customerNote = clean(body.customerNote);

    if (!quoteCurrencies.includes(currency as QuoteCurrency)) {
      return json({ ok: false, error: "Choose a supported quote currency." }, 400);
    }
    if (quotedAmount && !moneyPattern.test(quotedAmount)) {
      return json({ ok: false, error: "Quoted price must be a valid positive amount with up to 3 decimal places." }, 400);
    }
    if (internalCost && !moneyPattern.test(internalCost)) {
      return json({ ok: false, error: "Internal cost must be a valid positive amount with up to 3 decimal places." }, 400);
    }
    if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) {
      return json({ ok: false, error: "Choose a valid quote expiry date." }, 400);
    }
    if (customerNote.length > 4000) {
      return json({ ok: false, error: "Customer quote note must be 4000 characters or fewer." }, 400);
    }

    const result = await updateQuoteCommercial(reference, {
      currency: currency as QuoteCurrency,
      quotedAmount,
      internalCost,
      validUntil,
      customerNote,
    });
    if (result.kind === "unavailable") return json({ ok: false, error: "Quote storage is unavailable." }, 503);
    if (result.kind === "missing") return json({ ok: false, error: "Quote not found." }, 404);

    return json({
      ok: true,
      commercial: { currency, quotedAmount, internalCost, validUntil, customerNote },
    });
  }

  const status = clean(body.status);
  const assignedTo = clean(body.assignedTo);
  if (!quoteStatuses.includes(status as QuoteStatus)) return json({ ok: false, error: "Choose a valid quote status." }, 400);
  if (assignedTo.length > 120) return json({ ok: false, error: "Assignee must be 120 characters or fewer." }, 400);

  const result = await updateQuoteAdmin(reference, status as QuoteStatus, assignedTo);
  if (result.kind === "unavailable") return json({ ok: false, error: "Quote storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Quote not found." }, 404);

  let shipment = null;
  let shipmentWarning: string | null = null;
  if (status === "won") {
    try {
      const shipmentResult = await ensureShipmentForWonQuote(reference, auth.user.displayName, auth.user.email);
      if (shipmentResult.kind === "created" || shipmentResult.kind === "ready") shipment = shipmentResult.shipment;
      if (shipmentResult.kind === "unavailable") shipmentWarning = "Shipment storage is temporarily unavailable.";
    } catch (error) {
      console.error("Failed to create KCPL shipment from won quote", reference, error);
      shipmentWarning = "The quote was saved as Won, but the shipment record could not be initialized yet.";
    }
  }

  return json({ ok: true, status, assignedTo, shipment, shipmentWarning });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin updates are not accepted." }, 403);

  const { reference } = await context.params;
  let body: { note?: unknown };
  try {
    body = await request.json() as { note?: unknown };
  } catch {
    return json({ ok: false, error: "The note could not be read." }, 400);
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note) return json({ ok: false, error: "Write a note before saving." }, 400);
  if (note.length > 3000) return json({ ok: false, error: "Notes must be 3000 characters or fewer." }, 400);

  const result = await addQuoteNote(reference, note, auth.user.displayName, auth.user.email);
  if (result.kind === "unavailable") return json({ ok: false, error: "Quote storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Quote not found." }, 404);
  return json({ ok: true, note: result.note }, 201);
}
