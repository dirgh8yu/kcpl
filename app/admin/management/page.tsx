import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { staffCapabilitiesForEmail, type StaffCapabilities } from "../staff-permissions";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { buildManagementAnalytics, resolveManagementRange } from "./management.server";
import { ManagementWorkspace } from "./management-workspace";
import { RuntimeReadinessPanel } from "./runtime-readiness-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Executive Dashboard | KCPL", robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;
type StaffResult =
  | { kind: "ready"; staff: Awaited<ReturnType<typeof getStaffContext>> }
  | { kind: "error"; permissions: StaffCapabilities };

function param(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

async function resolveStaff(user: { uid: string; email: string; displayName: string }): Promise<StaffResult> {
  try { return { kind: "ready", staff: await getStaffContext(user) }; }
  catch (error) { console.error("Failed to resolve KCPL staff context for Management", error); return { kind: "error", permissions: staffCapabilitiesForEmail(user.email) }; }
}

async function loadAnalytics(range: ReturnType<typeof resolveManagementRange>) {
  try { const analytics = await buildManagementAnalytics(range); return analytics ? { kind: "ready" as const, analytics } : { kind: "unavailable" as const }; }
  catch (error) { console.error("Failed to load KCPL Management analytics", error); return { kind: "error" as const }; }
}

export default async function ManagementPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Executive analytics are available only to authorised KCPL management."/>;

  const staffResult = await resolveStaff(access.user);
  if (staffResult.kind === "error") {
    const permissions = staffResult.permissions;
    return <OperationsShell userName={access.user.displayName} canManageStaff={permissions.canManageStaff} canManageFinance={permissions.canManageFinance} canViewCommercial={permissions.canViewCommercial} canManageJobFile={permissions.canManageJobFile} isManagement={permissions.role === "management"}><Gate embedded title="Management analytics could not be loaded" detail="KCPL reporting data is temporarily unavailable. Navigation and search remain available while the data service recovers."/></OperationsShell>;
  }

  const staff = staffResult.staff;
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (staff.permissions.role !== "management") return <OperationsShell {...shellProps}><Gate embedded title="Management access required" detail="Executive performance, profitability and company-wide financial analytics are restricted to the Management role."/></OperationsShell>;

  const params = await searchParams;
  const range = resolveManagementRange(param(params.range), param(params.from), param(params.to));
  const result = await loadAnalytics(range);
  if (result.kind !== "ready") return <OperationsShell {...shellProps}><Gate embedded title={result.kind === "error" ? "Management analytics could not be loaded" : "Analytics are unavailable"} detail="The Firebase reporting backend is temporarily unavailable. Navigation and search remain available."/></OperationsShell>;

  return <OperationsShell {...shellProps}><ManagementWorkspace analytics={result.analytics}/><RuntimeReadinessPanel/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Organisation · Management" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/management", label: "Management", primary: true }, { href: "/admin/migration", label: "Migration Hub" }, { href: "/admin/staff", label: "People & Branches" }]}/>;
}
