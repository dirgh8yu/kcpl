import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
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
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#342f2b] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[16px] border border-[#e5ddd6] bg-white p-8"><p className="ops-eyebrow">KCPL Freight Documents</p><h1 className="mt-3 text-[27px] font-[730]">{title}</h1><p className="mt-3 text-[12px] leading-6 text-[#776e67]">{detail}</p><Link href="/admin/shipments" className="ops-button mt-6 inline-flex" data-variant="primary" data-size="md">Shipments</Link></section></main>;
}
