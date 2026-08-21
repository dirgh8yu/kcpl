import { getAdminAccess } from "../../../../admin/admin-auth";
import { quoteCurrencies, type QuoteCurrency, quoteStatuses, type QuoteStatus } from "../../../../admin/admin-data";
import { addQuoteNote, getQuoteDetail, updateQuoteAdmin, updateQuoteCommercial } from "../../../../admin/admin-data.server";
import { createCrmCustomerFromQuote } from "../../../../admin/crm/crm-quote-links.server";
import { checkShipmentBranchAccess } from "../../../../admin/shipment-access.server";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";
import { ensureShipmentForWonQuote } from "../../../../shipment-data.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function authorize() {
  const access = await getAdminAccess();
  if (access.kind === "authorized") {
    const staff = await getStaffContext(access.user);
    return { user: access.user, staff };
  }
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  return { response: json({ ok: false, error: "Admin access is not configured." }, 503) };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const moneyPattern = /^\d{1,12}(?:\.\d{1,3})?$/;

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function redactCommercial<T extends NonNullable<Awaited<ReturnType<typeof getQuoteDetail>>>>(quote: T, canViewCommercial: boolean): T {
  if (canViewCommercial) return quote;
  return {
    ...quote,
    quoted_amount: null,
    internal_cost: null,
    customer_quote_note: null,
  };
}

async function linkedShipmentAccessError(
  quote: NonNullable<Awaited<ReturnType<typeof getQuoteDetail>>>,
  staff: Awaited<ReturnType<typeof getStaffContext>>,
) {
  if (!quote.shipment) return null;
  const access = await checkShipmentBranchAccess(quote.shipment.reference, staff);
  if (access.kind === "forbidden") {
    return json({ ok: false, error: "This enquiry has converted to a shipment outside your branch access." }, 403);
  }
  if (access.kind === "unavailable") {
    return json({ ok: false, error: "Shipment branch access could not be verified right now." }, 503);
  }
  return null;
}

async function loadAccessibleQuote(reference: string, staff: Awaited<ReturnType<typeof getStaffContext>>) {
  const quote = await getQuoteDetail(reference);
  if (quote === undefined) return { response: json({ ok: false, error: "Quote storage is unavailable." }, 503) };
  if (!quote) return { response: json({ ok: false, error: "Quote not found." }, 404) };
  const accessError = await linkedShipmentAccessError(quote, staff);
  if (accessError) return { response: accessError };
  return { quote };
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;

  const { reference } = await context.params;
  try {
    const loaded = await loadAccessibleQuote(reference, auth.staff);
    if ("response" in loaded) return loaded.response;
    return json({ ok: true, quote: redactCommercial(loaded.quote, auth.staff.permissions.canViewCommercial) });
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
  const loaded = await loadAccessibleQuote(reference, auth.staff);
  if ("response" in loaded) return loaded.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The update could not be read." }, 400);
  }

  if (body.action === "commercial") {
    if (!auth.staff.permissions.canEditCommercial) {
      return json({ ok: false, error: "Your KCPL staff role does not allow commercial pricing changes." }, 403);
    }

    const currency = clean(body.currency).toUpperCase();
    const quotedAmount = clean(body.quotedAmount);
    const internalCost = clean(body.internalCost);
    const validUntil = clean(body.validUntil);
    const customerNote = clean(body.customerNote);

    if (!quoteCurrencies.includes(currency as QuoteCurrency)) {
      return json({ ok: false, error: "Choose a supported quote currency." }, 400);
    }
    if (quotedAmount && (!moneyPattern.test(quotedAmount) || Number(quotedAmount) <= 0)) {
      return json({ ok: false, error: "Customer price must be greater than zero and use up to 3 decimal places." }, 400);
    }
    if (internalCost && (!moneyPattern.test(internalCost) || Number(internalCost) < 0)) {
      return json({ ok: false, error: "Internal cost must be zero or greater and use up to 3 decimal places." }, 400);
    }
    if (validUntil && !validCalendarDate(validUntil)) {
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
  const assignedToName = clean(body.assignedToName || body.assignedTo).slice(0, 160);
  const assignedToEmail = clean(body.assignedToEmail).toLowerCase().slice(0, 240);
  const assignedToPhone = clean(body.assignedToPhone).slice(0, 80);
  if (!quoteStatuses.includes(status as QuoteStatus)) return json({ ok: false, error: "Choose a valid quote status." }, 400);
  if (assignedToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignedToEmail)) return json({ ok: false, error: "Choose a staff member with a valid email address." }, 400);

  const result = await updateQuoteAdmin(reference, status as QuoteStatus, {
    name: assignedToName,
    email: assignedToEmail,
    phone: assignedToPhone,
  }, auth.staff.permissions.canEditCommercial);
  if (result.kind === "unavailable") return json({ ok: false, error: "Quote storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Quote not found." }, 404);
  if (result.kind === "commercial-required") {
    return json({ ok: false, error: "Commercial access is required to move an enquiry into or out of Quoted, Won or Lost.", code: "COMMERCIAL_REQUIRED" }, 403);
  }
  if (result.kind === "won-locked") {
    return json({ ok: false, error: "A Won quote cannot be moved backwards. Continue the accepted movement from its Shipment or Digital Job File.", code: "WON_LOCKED" }, 409);
  }
  if (result.kind === "customer-required") {
    return json({ ok: false, error: "Confirm or create the CRM customer before marking this quote Won.", code: "CUSTOMER_REQUIRED" }, 409);
  }

  let shipment = null;
  let shipmentWarning: string | null = null;
  if (status === "won") {
    try {
      const shipmentResult = await ensureShipmentForWonQuote(reference, auth.user.displayName, auth.user.email);
      if (shipmentResult.kind === "created" || shipmentResult.kind === "ready") {
        shipment = shipmentResult.shipment;
        if (shipment) {
          const shipmentAccess = await checkShipmentBranchAccess(shipment.reference, auth.staff);
          if (shipmentAccess.kind === "forbidden") {
            return json({ ok: false, error: "The accepted enquiry created a shipment outside your branch access. A manager must continue this movement." }, 403);
          }
          if (shipmentAccess.kind === "unavailable") shipmentWarning = "Shipment branch access could not be verified right now.";
        }
      }
      if (shipmentResult.kind === "unavailable") shipmentWarning = "Shipment storage is temporarily unavailable.";
      if (shipmentResult.kind === "customer-required" || shipmentResult.kind === "customer-missing") {
        return json({ ok: false, error: "A valid CRM customer is required before shipment creation.", code: "CUSTOMER_REQUIRED" }, 409);
      }
    } catch (error) {
      console.error("Failed to create KCPL shipment from won quote", reference, error);
      shipmentWarning = "The quote was saved as Won, but its shipment could not be initialized yet. Reload the enquiry and retry before continuing operations.";
    }
  }

  return json({
    ok: true,
    status,
    assignedTo: assignedToName || assignedToEmail || "",
    assignedToName,
    assignedToEmail,
    assignedToPhone,
    shipment,
    shipmentWarning,
  });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin updates are not accepted." }, 403);

  const { reference } = await context.params;
  const loaded = await loadAccessibleQuote(reference, auth.staff);
  if ("response" in loaded) return loaded.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The request could not be read." }, 400);
  }

  if (body.action === "create_customer") {
    if (!auth.staff.permissions.canEditCustomer) {
      return json({ ok: false, error: "Your KCPL staff role does not allow customer creation." }, 403);
    }
    try {
      const customerBranch = auth.staff.can_access_all_branches ? "Kathmandu" : auth.staff.branches[0];
      if (!customerBranch) return json({ ok: false, error: "Your staff profile has no KCPL branch available for this customer." }, 403);
      const result = await createCrmCustomerFromQuote(reference, { name: auth.user.displayName, email: auth.user.email }, customerBranch);
      if (result.kind === "unavailable") return json({ ok: false, error: "CRM storage is unavailable." }, 503);
      if (result.kind === "missing_quote") return json({ ok: false, error: "Quote not found." }, 404);
      if (result.kind === "duplicates") return json({ ok: false, error: "Possible CRM matches already exist. Confirm one of them instead of creating a duplicate.", code: "CRM_MATCHES_EXIST", matches: result.matches }, 409);
      if (result.kind === "already_linked") return json({ ok: true, customerId: result.customerId });
      if (result.kind === "created_and_linked") return json({ ok: true, customerId: result.customer.id, customer: result.customer }, 201);
      return json({ ok: false, error: "The customer could not be created from this enquiry." }, 500);
    } catch (error) {
      console.error("Failed to create CRM customer from quote", reference, error);
      return json({ ok: false, error: "The CRM customer could not be created." }, 500);
    }
  }

  const note = clean(body.note);
  if (!note) return json({ ok: false, error: "Write a note before saving." }, 400);
  if (note.length > 3000) return json({ ok: false, error: "Notes must be 3000 characters or fewer." }, 400);

  const result = await addQuoteNote(reference, note, auth.user.displayName, auth.user.email);
  if (result.kind === "unavailable") return json({ ok: false, error: "Quote storage is unavailable." }, 503);
  if (result.kind === "missing") return json({ ok: false, error: "Quote not found." }, 404);
  return json({ ok: true, note: result.note }, 201);
}