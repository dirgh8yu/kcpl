import { getAdminAccess } from "../../../../admin/admin-auth";
import { confirmInvoiceCustomerForShipment, createInvoiceCustomerFromShipmentQuote } from "../../../../admin/finance/finance-linking.server";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

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
  catch { return json({ ok: false, error: "The customer link request could not be read." }, 400); }

  const shipmentReference = typeof body.shipmentReference === "string" ? body.shipmentReference.trim().toUpperCase() : "";
  const action = typeof body.action === "string" ? body.action : "confirm";
  if (!shipmentReference) return json({ ok: false, error: "Choose a shipment." }, 400);

  const actor = { name: access.user.displayName, email: access.user.email };

  if (action === "create_from_quote") {
    const result = await createInvoiceCustomerFromShipmentQuote(shipmentReference, actor);
    if (result.kind === "created_and_linked" || result.kind === "linked") {
      return json({ ok: true, customerId: result.customerId, customerName: "customerName" in result ? result.customerName : undefined });
    }
    if (result.kind === "possible_duplicate") {
      return json({ ok: false, code: "possible_duplicate", error: "A similar CRM customer already exists. Confirm the existing customer instead.", suggestions: result.suggestions }, 409);
    }
    if (result.kind === "shipment_missing") return json({ ok: false, error: "Shipment not found." }, 404);
    if (result.kind === "quote_missing") return json({ ok: false, error: "The originating quote could not be found for this shipment." }, 404);
    if (result.kind === "unavailable") return json({ ok: false, error: "CRM customer creation is temporarily unavailable." }, 503);
    return json({ ok: false, error: "A CRM customer could not be created from this quote." }, 400);
  }

  const customerId = typeof body.customerId === "string" ? body.customerId.trim().toUpperCase() : "";
  if (!customerId) return json({ ok: false, error: "Choose a CRM customer." }, 400);

  const result = await confirmInvoiceCustomerForShipment(shipmentReference, customerId, actor);
  if (result.kind === "linked") return json({ ok: true, customerId: result.customerId });
  if (result.kind === "already_linked") return json({ ok: false, error: `This shipment is already linked to ${result.customerId}.` }, 409);
  if (result.kind === "missing_customer") return json({ ok: false, error: "CRM customer not found. Check the KCPL-C reference." }, 404);
  if (result.kind === "shipment_missing") return json({ ok: false, error: "Shipment not found." }, 404);
  if (result.kind === "quote_missing") return json({ ok: false, error: "The originating quote could not be found for this shipment." }, 404);
  if (result.kind === "unavailable") return json({ ok: false, error: "CRM linking is temporarily unavailable." }, 503);
  return json({ ok: false, error: "The customer could not be linked." }, 400);
}
