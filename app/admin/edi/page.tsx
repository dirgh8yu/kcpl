import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listTmsTenders } from "../tenders/tms-tendering.server";
import { listEdiGatewayDashboard } from "./edi-gateway.server";
import { EdiWorkspace } from "./edi-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "EDI Gateway | KCPL Operations", robots: { index: false, follow: false } };

export default async function EdiGatewayPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="The KCPL EDI Gateway is available only to authorised staff."/>;
  const staff = await getStaffContext(access.user);
  const shell = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shell}><Gate title="EDI access restricted" detail="Your role does not include shipment execution access." embedded/></OperationsShell>;

  let dashboard: Awaited<ReturnType<typeof listEdiGatewayDashboard>>;
  let tenders: Awaited<ReturnType<typeof listTmsTenders>>;
  try {
    [dashboard, tenders] = await Promise.all([listEdiGatewayDashboard(staff), listTmsTenders(staff)]);
  } catch (error) {
    console.error("Failed to load KCPL EDI Gateway", error);
    return <OperationsShell {...shell}><Gate title="EDI Gateway temporarily unavailable" detail="EDI transaction data could not be loaded. No tender or shipment records have been changed." embedded/></OperationsShell>;
  }
  if (dashboard.kind !== "ready" || tenders.kind !== "ready") return <OperationsShell {...shell}><Gate title="EDI Gateway unavailable" detail="Firebase EDI storage is unavailable for this deployment." embedded/></OperationsShell>;
  const eligible = tenders.tenders.filter((tender) => tender.status === "sent" && (tender.channel === "manual" || tender.channel === "edi_204"));
  return <OperationsShell {...shell}><EdiWorkspace initialRows={dashboard.rows} initialSummary={dashboard.summary} initialConfigured={dashboard.configured} initialEligibleTenders={eligible} canQueue204={staff.permissions.canEditCommercial}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#514840] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[15px] border border-[#e5ddd6] bg-white p-8 shadow-[0_16px_48px_rgba(60,45,34,.06)]"><p className="ops-eyebrow">KCPL Freight EDI</p><h1 className="mt-3 text-[28px] font-[730] tracking-[-.04em] text-[#342f2b]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#746b64]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/tenders" className="ops-button" data-variant="primary" data-size="md">Tender Desk</Link><Link href="/admin/visibility" className="ops-button" data-variant="secondary" data-size="md">Live Visibility</Link></div></section></main>;
}
