import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listFreightDocumentWorkspace } from "./freight-documents.server";
import { FreightDocumentsWorkspace } from "./freight-documents-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Freight Documents | KCPL Operations", robots: { index: false, follow: false } };

export default async function FreightDocumentsPage({ searchParams }: { searchParams: Promise<{ shipment?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="KCPL Freight Documents are available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = { userName: access.user.displayName, canManageStaff: staff.permissions.canManageStaff, canManageFinance: staff.permissions.canManageFinance, isManagement: staff.permissions.role === "management", canViewCommercial: staff.permissions.canViewCommercial, canManageJobFile: staff.permissions.canManageJobFile };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shellProps}><Gate title="Job File access required" detail="Freight documents are controlled Job File records." embedded/></OperationsShell>;
  let result: Awaited<ReturnType<typeof listFreightDocumentWorkspace>>;
  try { result = await listFreightDocumentWorkspace(staff); }
  catch (error) {
    console.error("Failed to load KCPL Freight Documents", error);
    return <OperationsShell {...shellProps}><Gate title="Freight Documents could not be loaded" detail="Navigation remains available while Firebase recovers." embedded/></OperationsShell>;
  }
  if (result.kind !== "ready") return <OperationsShell {...shellProps}><Gate title="Freight Documents unavailable" detail="Firebase document storage is unavailable." embedded/></OperationsShell>;
  const { shipment } = await searchParams;
  const focus = shipment?.trim().toUpperCase() ?? "";
  const rows = focus ? [...result.rows].sort((a, b) => Number(b.reference === focus) - Number(a.reference === focus)) : result.rows;
  return <OperationsShell {...shellProps}><FreightDocumentsWorkspace initialRows={rows} initialSummary={result.summary} initialShipment={focus}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Freight Documents"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/shipments", label: "Shipments", primary: true },
      { href: "/admin/documents", label: "Document Vault" },
    ]}
  />;
}
