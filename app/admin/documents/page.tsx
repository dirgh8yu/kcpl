import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listDocumentVault } from "./documents-data.server";
import { DocumentsWorkspace } from "./documents-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents", robots: { index: false, follow: false } };

export default async function DocumentsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Documents are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate title="Documents can’t be shown right now" detail="Shipment document access is not available for this staff role." embedded/></OperationsShell>;

  let dashboard: Awaited<ReturnType<typeof listDocumentVault>>;
  try {
    dashboard = await listDocumentVault(staff);
  } catch (error) {
    console.error("Failed to load KCPL documents", error);
    return <OperationsShell {...shellProps}><Gate title="Documents didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;
  }

  if (!dashboard) return <OperationsShell {...shellProps}><Gate title="Documents can’t be shown right now" detail="The records service isn’t responding. Try again in a minute; the menu and search still work." embedded/></OperationsShell>;

  return (
    <OperationsShell {...shellProps}>
      <DocumentsWorkspace dashboard={dashboard} role={staff.permissions.role} currentUserEmail={access.user.email}/>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="Documents"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[{ href: "/admin/command-centre", label: "Overview", primary: true }]}
  />;
}
