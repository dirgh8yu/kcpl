import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { OpsPage } from "../operations-ui";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listFreightAuditQueue } from "./freight-audit.server";
import { FreightAuditWorkspace } from "./freight-audit-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Freight Audit & Match-Pay | KCPL Operations", robots: { index: false, follow: false } };

export default async function FreightAuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Freight Audit is available only to authorised KCPL finance staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageFinance) return <OperationsShell {...shellProps}><Gate embedded title="Freight Audit access restricted" detail="Management or Accounts access is required for Match-Pay controls."/></OperationsShell>;

  let result: Awaited<ReturnType<typeof listFreightAuditQueue>>;
  try { result = await listFreightAuditQueue(staff); }
  catch (error) { console.error("Failed to load KCPL Freight Audit", error); result = { kind: "unavailable" as const }; }

  if (result.kind !== "ready") return <OperationsShell {...shellProps}><Gate embedded title="Freight Audit unavailable" detail="Firebase audit data is temporarily unavailable. Existing supplier bills have not been changed."/></OperationsShell>;
  const { q } = await searchParams;
  return <OperationsShell {...shellProps}><OpsPage><FreightAuditWorkspace initialRows={result.rows} initialSummary={result.summary} isManagement={staff.permissions.role === "management"} initialFocus={q?.trim() ?? ""}/></OpsPage></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Finance · Freight Audit" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/freight-audit", label: "Freight Audit", primary: true }, { href: "/admin/payables", label: "Payables" }, { href: "/admin/finance", label: "Receivables" }]}/>;
}
