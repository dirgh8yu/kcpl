import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  try {
    const staff = await getStaffContext(access.user);
    return json({
      ok: true,
      role: staff.permissions.role,
      capabilities: {
        canViewCommercial: staff.permissions.canViewCommercial,
        canManageJobFile: staff.permissions.canManageJobFile,
        canManageFinance: staff.permissions.canManageFinance,
        canManageStaff: staff.permissions.canManageStaff,
        isManagement: staff.permissions.role === "management",
      },
    });
  } catch (error) {
    console.error("Failed to resolve KCPL navigation capabilities", error);
    return json({ ok: false, error: "Navigation permissions are temporarily unavailable." }, 503);
  }
}
