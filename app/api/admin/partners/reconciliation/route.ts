import { getAdminAccess } from "../../../../admin/admin-auth";
import { reconcileSupplierBillWithSettlementIntegrity } from "../../../../admin/financial-settlement/supplier-reconciliation-settlement.server";
import { getStaffContext } from "../../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return json({ ok: false, error: "Supplier reconciliation is restricted to Management and Accounts." }, 403);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin supplier reconciliation is not accepted." }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "The reconciliation request could not be read." }, 400); }

  const result = await reconcileSupplierBillWithSettlementIntegrity({
    billReference: typeof body.billReference === "string" ? body.billReference : "",
    partnerId: typeof body.partnerId === "string" ? body.partnerId : "",
    expectedSupplierId: typeof body.expectedSupplierId === "string" ? body.expectedSupplierId : null,
    expectedSupplierName: typeof body.expectedSupplierName === "string" ? body.expectedSupplierName : "",
  }, { name: access.user.displayName, email: access.user.email }, staff);

  if (result.kind === "reconciled") return json({ ok: true, partnerId: result.partnerId, partnerName: result.partnerName });
  if (result.kind === "missing_bill") return json({ ok: false, error: "The supplier bill no longer exists." }, 404);
  if (result.kind === "missing_partner") return json({ ok: false, error: "The selected Partner record no longer exists." }, 404);
  if (result.kind === "invalid_bill") return json({ ok: false, error: "The supplier bill reference is invalid." }, 400);
  if (result.kind === "invalid_partner") return json({ ok: false, error: "Choose a valid KCPL Partner record." }, 400);
  if (result.kind === "void_bill") return json({ ok: false, error: "Voided supplier bills are not reconciled from this queue." }, 409);
  if (result.kind === "financially_locked") return json({ ok: false, code: "FINANCIALLY_LOCKED", error: "A supplier bill with recorded payments cannot change supplier identity. Reverse it through the accounting correction process instead." }, 409);
  if (result.kind === "stale") return json({ ok: false, error: "This supplier bill changed after you loaded the page. Refresh and review it again." }, 409);
  if (result.kind === "already_linked") return json({ ok: false, error: "This supplier bill is already linked to that Partner." }, 409);
  if (result.kind === "already_linked_other") return json({ ok: false, error: "This supplier bill is already linked to another valid Partner and cannot be reassigned by reconciliation." }, 409);
  if (result.kind === "duplicate_supplier_bill") return json({ ok: false, error: "Linking this record would create a duplicate supplier bill reference for the selected Partner. Review the existing bills first." }, 409);
  if (result.kind === "forbidden") return json({ ok: false, error: "This supplier bill or Partner is outside your finance or branch access." }, 403);
  return json({ ok: false, error: "Supplier reconciliation storage is unavailable." }, 503);
}
