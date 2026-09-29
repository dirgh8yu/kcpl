import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { listPartnerOptions } from "../partners/partners.server";
import { getStaffContext } from "../staff-directory.server";
import { V4WorkspaceGate } from "../v4-workspace-gate";
import { listCustomsDeskRows } from "./customs-data.server";
import { CustomsWorkspace } from "./customs-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customs Control | KCPL Operations", robots: { index: false, follow: false } };

export default async function CustomsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Customs Control is available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  let rows: Awaited<ReturnType<typeof listCustomsDeskRows>>;
  let partnerOptions: Awaited<ReturnType<typeof listPartnerOptions>>;
  try {
    [rows, partnerOptions] = await Promise.all([
      listCustomsDeskRows(staff),
      listPartnerOptions(staff),
    ]);
  } catch (error) {
    console.error("Failed to load KCPL Customs Control", error);
    return <OperationsShell {...shellProps}><Gate title="Customs Control could not be loaded" detail="KCPL customs data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }

  if (!rows) return <OperationsShell {...shellProps}><Gate title="Customs Control unavailable" detail="Firestore is not available for customs operations in this deployment. Navigation and search remain available." embedded/></OperationsShell>;
  const customsAgents = (partnerOptions ?? [])
    .filter((partner) => partner.types.includes("customs_agent") || partner.types.includes("clearing_partner"))
    .map((partner) => ({ id: partner.id, name: partner.name }));

  return (
    <OperationsShell {...shellProps}>
      <CustomsWorkspace initialRows={rows} customsAgents={customsAgents}/>
    </OperationsShell>
  );
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Customs Control"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/command-centre", label: "Operations Overview", primary: true },
      { href: "/admin/shipments", label: "Shipments" },
    ]}
  />;
}
