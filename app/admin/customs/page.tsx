import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { listPartnerOptions } from "../partners/partners.server";
import { getStaffContext } from "../staff-directory.server";
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
    isManagement: staff.permissions.role === "management",
  };
  try {
    const [rows, partnerOptions] = await Promise.all([
      listCustomsDeskRows(staff),
      listPartnerOptions(staff),
    ]);
    if (!rows) return <OperationsShell {...shellProps}><Gate title="Customs Control unavailable" detail="Firestore is not available for customs operations in this deployment. Navigation and search remain available." embedded/></OperationsShell>;
    const customsAgents = (partnerOptions ?? [])
      .filter((partner) => partner.types.includes("customs_agent") || partner.types.includes("clearing_partner"))
      .map((partner) => ({ id: partner.id, name: partner.name }));

    return (
      <OperationsShell {...shellProps}>
        <CustomsWorkspace initialRows={rows} customsAgents={customsAgents}/>
      </OperationsShell>
    );
  } catch (error) {
    console.error("Failed to load KCPL Customs Control", error);
    return <OperationsShell {...shellProps}><Gate title="Customs Control could not be loaded" detail="KCPL customs data is temporarily unavailable. Navigation and search remain available while the data service recovers." embedded/></OperationsShell>;
  }
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#514840] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[15px] border border-[#e6ded7] bg-white p-8 shadow-[0_16px_48px_rgba(60,45,34,.06)]"><p className="ops-eyebrow">KCPL Customs Control</p><h1 className="mt-3 text-[28px] font-[730] tracking-[-.04em] text-[#342f2b]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#746b64]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/command-centre" className="ops-button" data-variant="primary" data-size="md">Operations home</Link><Link href="/admin/shipments" className="ops-button" data-variant="secondary" data-size="md">Shipments</Link></div></section></main>;
}
