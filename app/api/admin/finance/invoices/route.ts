import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { crmCurrencies, type CrmCurrency } from "../../../../admin/crm/crm-data";
import { resolveInvoiceCustomerFromShipment } from "../../../../admin/finance/finance-linking.server";
import { createFinanceInvoice } from "../../../../admin/finance/finance.server";
import { INVOICE_MAX_LINES, type InvoiceLineInput } from "../../../../admin/finance/finance-data";
import { isTrustedSameOriginRequest } from "../../../../request-security";

/** The invoice's lines; an older single-amount request is one service line. */
function invoiceLinesFromBody(body: Record<string, unknown>): InvoiceLineInput[] {
  if (Array.isArray(body.lines)) {
    return body.lines.slice(0, INVOICE_MAX_LINES + 1).map((raw) => {
      const line = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      return {
        kind: line.kind === "disbursement" ? "disbursement" : "service",
        description: typeof line.description === "string" ? line.description : "",
        quantity: Number(line.quantity ?? 1),
        unitPrice: Number(line.unitPrice),
        taxRate: Number(line.taxRate ?? 0),
      };
    });
  }
  return [{
    kind: "service",
    description: typeof body.description === "string" ? body.description : "",
    quantity: 1,
    unitPrice: Number(body.amount),
    taxRate: Number(body.taxRate ?? 0),
  }];
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return json({ ok: false, error: "Finance access is restricted to Management and Accounts." }, 403);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin finance updates are not accepted." }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The invoice request could not be read." }, 400); }

  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "NPR";
  if (!crmCurrencies.includes(currency as CrmCurrency)) return json({ ok: false, error: "Choose a supported invoice currency." }, 400);

  const shipmentReference = typeof body.shipmentReference === "string" ? body.shipmentReference.trim().toUpperCase() : "";
  let customerId = typeof body.customerId === "string" ? body.customerId.trim().toUpperCase() : "";
  if (customerId && !customerId.startsWith("KCPL-C-")) customerId = "";

  if (shipmentReference) {
    const linked = await resolveInvoiceCustomerFromShipment(shipmentReference);
    if (linked.kind === "unavailable") return json({ ok: false, error: "Finance customer linking is temporarily unavailable." }, 503);
    if (linked.kind === "shipment_missing") return json({ ok: false, error: "Shipment reference was not found." }, 404);
    if (linked.kind === "resolved") {
      customerId = linked.customerId;
    } else if (linked.kind === "unlinked") {
      return json({
        ok: false,
        error: "Confirm the customer record before invoicing this shipment.",
        resolutionPath: `/admin/finance/new/${encodeURIComponent(shipmentReference)}`,
        quoteReference: linked.quoteReference,
        suggestions: linked.suggestions,
      }, 409);
    }
  }

  const result = await createFinanceInvoice({
    customerId,
    shipmentReference,
    issueDate: typeof body.issueDate === "string" ? body.issueDate : "",
    dueDate: typeof body.dueDate === "string" ? body.dueDate : "",
    currency: currency as CrmCurrency,
    lines: invoiceLinesFromBody(body),
    notes: typeof body.notes === "string" ? body.notes : "",
  }, { name: access.user.displayName, email: access.user.email }, staff);

  if (result.kind === "created") return json({ ok: true, reference: result.reference }, 201);
  if (result.kind === "shipment_missing") return json({ ok: false, error: "Shipment reference was not found." }, 404);
  if (result.kind === "customer_missing") return json({ ok: false, error: "Customer not found. Customer references start with KCPL-C-." }, 404);
  if (result.kind === "customer_required") return json({ ok: false, error: "Link the shipment to a customer or enter a KCPL-C customer reference." }, 400);
  if (result.kind === "relationship_mismatch") return json({ ok: false, error: "The shipment, quote and customer must all belong to the same branch." }, 409);
  if (result.kind === "invalid_amount") return json({ ok: false, error: "Enter an invoice amount greater than zero." }, 400);
  if (result.kind === "invalid_tax") return json({ ok: false, error: "Tax rate must be between 0 and 100%." }, 400);
  if (result.kind === "invalid_lines") return json({ ok: false, error: `An invoice needs between 1 and ${INVOICE_MAX_LINES} lines.` }, 400);
  if (result.kind === "forbidden") return json({ ok: false, error: "This record is outside your finance or branch access." }, 403);
  return json({ ok: false, error: "Invoice creation is unavailable." }, 503);
}
