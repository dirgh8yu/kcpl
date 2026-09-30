import { getAdminAccess } from "../../admin-auth";
import { OperationsShell } from "../../operations-shell";
import { getStaffContext } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { getPartner360Snapshot } from "../partner-360.server";
import { mockPartner360Snapshot, qaMockDataEnabled } from "../../qa-fixtures";
import { Partner360Workspace } from "./partner-360-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner 360 | KCPL Operations", robots: { index: false, follow: false } };

export default async function Partner360Page({ params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations" detail="Partner 360 is available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  const { id } = await params;
  const partnerId = decodeURIComponent(id).trim().toUpperCase();
  if (!/^KCPL-P-[A-Z0-9-]+$/.test(partnerId)) return <OperationsShell {...shellProps}><Gate embedded title="Partner reference is invalid" detail="The requested Partner 360 record does not use a valid KCPL partner reference."/></OperationsShell>;

  let result;
  try {
    const mock = qaMockDataEnabled() ? mockPartner360Snapshot(partnerId, staff) : undefined;
    result = mock === undefined ? await getPartner360Snapshot(partnerId, staff) : mock ? { kind: "ready" as const, snapshot: mock } : { kind: "missing" as const };
  }
  catch (error) {
    console.error("Failed to load KCPL Partner 360", partnerId, error);
    return <OperationsShell {...shellProps}><Gate embedded title="Partner didn’t load" detail="Something went wrong fetching it. Try again in a minute; the menu and search still work."/></OperationsShell>;
  }

  if (result.kind === "unavailable") return <OperationsShell {...shellProps}><Gate embedded title="Partners didn’t load" detail="The records service isn’t responding. Try again in a minute; the menu and search still work."/></OperationsShell>;
  if (result.kind === "missing") return <OperationsShell {...shellProps}><Gate embedded title="Partner not found" detail="This partner or vendor record does not exist."/></OperationsShell>;
  if (result.kind === "forbidden") return <OperationsShell {...shellProps}><Gate embedded title="Partner access restricted" detail="This partner belongs to a KCPL branch outside your assigned access."/></OperationsShell>;

  return <OperationsShell {...shellProps} detailLabel={result.snapshot.partner.display_name}><Partner360Workspace snapshot={result.snapshot} commercialVisible={staff.permissions.canViewCommercial} financialVisible={staff.permissions.canManageFinance}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate eyebrow="KCPL Network · Partner 360" title={title} detail={detail} embedded={embedded} actions={[{ href: "/admin/partners", label: "Partners", primary: true }, { href: "/admin/carrier-integrations", label: "Carrier connections" }]}/>;
}
