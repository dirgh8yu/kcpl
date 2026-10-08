import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { backupFreshnessCheck } from "../../../ops-monitoring.server";
import { productionRuntimeReadiness } from "../../../production-readiness";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);

  const staff = await getStaffContext(access.user);
  if (staff.profile.role !== "management") {
    return json({ ok: false, error: "Management access is required." }, 403);
  }

  // When the last backup ran is the one check that needs the database.
  const runtime = productionRuntimeReadiness();
  const checks = [...runtime.checks, await backupFreshnessCheck()];
  const summary = {
    ready: checks.filter((item) => item.status === "ready").length,
    warnings: checks.filter((item) => item.status === "warning").length,
    blocked: checks.filter((item) => item.status === "blocked").length,
  };
  return json({
    ok: true,
    readiness: { checks, summary, overall: summary.blocked ? "blocked" : summary.warnings ? "warning" : "ready" },
  });
}
