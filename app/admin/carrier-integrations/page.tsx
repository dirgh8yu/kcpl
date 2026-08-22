import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listCarrierIntegrationDashboard } from "./carrier-integrations.server";
import { CarrierIntegrationsWorkspace } from "./carrier-integrations-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Carrier Integrations | KCPL Operations", robots: { index: false, follow: false } };

export default async function CarrierIntegrationsPage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Carrier integrations are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const shell = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageJobFile) return <OperationsShell {...shell}><Gate title="Carrier integration access restricted" detail="Your role does not include shipment execution access." embedded/></OperationsShell>;

  let result: Awaited<ReturnType<typeof listCarrierIntegrationDashboard>> | null = null;
  try {
    result = await listCarrierIntegrationDashboard(staff);
  } catch (error) {
    console.error("Failed to load carrier integration workspace", error);
  }

  if (!result) return <OperationsShell {...shell}><Gate title="Carrier integrations temporarily unavailable" detail="Provider status could not be loaded. Navigation remains available and no shipment records have been changed." embedded/></OperationsShell>;
  if (result.kind !== "ready") return <OperationsShell {...shell}><Gate title="Carrier integrations unavailable" detail="Firebase carrier integration storage is not available for this deployment." embedded/></OperationsShell>;
  return <OperationsShell {...shell}><CarrierIntegrationsWorkspace initialProviders={result.providers} initialRows={result.rows} initialSummary={result.summary} canViewCommercial={staff.permissions.canViewCommercial}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#514840] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[15px] border border-[#e5ddd6] bg-white p-8 shadow-[0_16px_48px_rgba(60,45,34,.06)]"><p className="ops-eyebrow">KCPL Carrier Network</p><h1 className="mt-3 text-[28px] font-[730] tracking-[-.04em] text-[#342f2b]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#746b64]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/visibility" className="ops-button" data-variant="primary" data-size="md">Live visibility</Link><Link href="/admin/partners" className="ops-button" data-variant="secondary" data-size="md">Partners</Link></div></section></main>;
}
