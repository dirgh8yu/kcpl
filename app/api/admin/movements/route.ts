import { getAdminAccess } from "../../../admin/admin-auth";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../../../admin/crm/crm-data";
import { getStaffContext, staffCanAccessBranch } from "../../../admin/staff-directory.server";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function branchValue(value: unknown): KcplBranch {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : "Kathmandu";
}

function branchArray(value: unknown, primary: KcplBranch): KcplBranch[] {
  const branches = Array.isArray(value)
    ? value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch))
    : [];
  if (!branches.includes(primary)) branches.unshift(primary);
  return branches;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
}

export async function GET() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!firebaseRuntimeConfigured()) return json({ ok: false, error: "Firebase movement data is unavailable." }, 503);

  const staff = await getStaffContext(access.user);
  const snapshot = await firebaseAdminDb().collection("shipments").orderBy("updated_at", "desc").limit(350).get();
  const movements = snapshot.docs.flatMap((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const primary = branchValue(data.primary_branch);
    const handling = branchArray(data.handling_branches, primary);
    if (!staffCanAccessBranch(staff, primary) && !handling.some((branch) => staffCanAccessBranch(staff, branch))) return [];
    const currentLocation = text(data.current_location);
    if (!currentLocation) return [];
    return [{
      reference: doc.id,
      currentLocation,
      exception: data.status === "exception",
    }];
  });

  return json({ ok: true, movements });
}
