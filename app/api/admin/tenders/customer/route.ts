import { getAdminAccess } from "../../../../admin/admin-auth";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { linkTmsOrderCustomer } from "../../../../admin/tenders/tms-order-customer.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
function clean(value: unknown, max = 240) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return json({ ok: false, error: "Commercial access is required." }, 403);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin order updates are not accepted." }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return json({ ok: false, error: "The request could not be read." }, 400); }
  const result = await linkTmsOrderCustomer(
    clean(body.orderId, 120),
    clean(body.customerId, 120),
    { name: access.user.displayName, email: access.user.email },
    staff,
  );
  if (result.kind === "unavailable") return json({ ok: false, error: "Order storage is unavailable." }, 503);
  if (result.kind === "forbidden") return json({ ok: false, error: "This customer or order is outside your permitted branch scope." }, 403);
  if (result.kind === "missing_order") return json({ ok: false, error: "Transport order not found." }, 404);
  if (result.kind === "missing_customer") return json({ ok: false, error: "Customer not found." }, 404);
  if (result.kind === "invalid_branch") return json({ ok: false, error: "Order or customer branch data is invalid." }, 409);
  if (result.kind === "locked") return json({ ok: false, error: "Customer cannot be changed after tendering has started." }, 409);
  return json({ ok: true, customerId: result.customerId, customerName: result.customerName });
}
