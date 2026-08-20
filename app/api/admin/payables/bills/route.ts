import { getAdminAccess } from "../../../../admin/admin-auth";
import { crmCurrencies, type CrmCurrency } from "../../../../admin/crm/crm-data";
import { jobCostCategories, type JobCostCategory } from "../../../../admin/job-file";
import { createPayable } from "../../../../admin/payables/payables.server";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return json({ ok: false, error: "Accounts Payable is restricted to Management and Accounts." }, 403);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin payable updates are not accepted." }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The supplier bill request could not be read." }, 400); }

  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "NPR";
  if (!crmCurrencies.includes(currency as CrmCurrency)) return json({ ok: false, error: "Choose a supported bill currency." }, 400);
  const category = typeof body.category === "string" ? body.category : "other";
  if (!jobCostCategories.includes(category as JobCostCategory)) return json({ ok: false, error: "Choose a valid job cost category." }, 400);

  const result = await createPayable({
    supplierId: typeof body.supplierId === "string" ? body.supplierId : "",
    supplierName: typeof body.supplierName === "string" ? body.supplierName : "",
    supplierBillReference: typeof body.supplierBillReference === "string" ? body.supplierBillReference : "",
    shipmentReference: typeof body.shipmentReference === "string" ? body.shipmentReference : "",
    billDate: typeof body.billDate === "string" ? body.billDate : "",
    dueDate: typeof body.dueDate === "string" ? body.dueDate : "",
    currency: currency as CrmCurrency,
    category: category as JobCostCategory,
    description: typeof body.description === "string" ? body.description : "",
    amount: Number(body.amount),
    taxRate: Number(body.taxRate ?? 0),
    notes: typeof body.notes === "string" ? body.notes : "",
  }, { name: access.user.displayName, email: access.user.email }, staff);

  if (result.kind === "created") return json({ ok: true, reference: result.reference }, 201);
  if (result.kind === "shipment_missing") return json({ ok: false, error: "Shipment reference was not found." }, 404);
  if (result.kind === "supplier_missing") return json({ ok: false, error: "Supplier CRM record was not found. Leave the CRM reference blank to use a supplier name only." }, 404);
  if (result.kind === "supplier_required") return json({ ok: false, error: "Enter a supplier/carrier name or CRM reference." }, 400);
  if (result.kind === "invalid_amount") return json({ ok: false, error: "Enter a bill amount greater than zero." }, 400);
  if (result.kind === "invalid_tax") return json({ ok: false, error: "Tax rate must be between 0 and 100%." }, 400);
  if (result.kind === "forbidden") return json({ ok: false, error: "This bill is outside your finance or branch access." }, 403);
  return json({ ok: false, error: "Accounts Payable storage is unavailable." }, 503);
}
