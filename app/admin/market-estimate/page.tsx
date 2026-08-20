import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { ForexReferencePanel } from "../forex/forex-reference-panel";
import { OperationsShell } from "../operations-shell";
import { OpsButton, OpsInfoLine, OpsPageHeader } from "../operations-ui";
import { GoogleRoadRoutePanel } from "../routes/google-road-route-panel";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reference Tools | KCPL Operations", robots: { index: false, follow: false } };

export default async function MarketEstimatePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required." detail="Use an authorised KCPL staff account to access commercial tools."/>;

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return <Gate title="Commercial access required." detail="Reference tools are available to Management, Accounts and Commercial roles."/>;
  const roleLabel = kcplStaffRoleLabels[staff.permissions.role];

  return (
    <OperationsShell
      userName={access.user.displayName}
      roleLabel={roleLabel}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <main>
        <OpsPageHeader
          eyebrow="Commercial"
          title="Reference Tools"
          description="Contextual external references for pricing and road planning. These tools never overwrite KCPL records or become a customer quote without staff action."
          breadcrumbs={[{ label: "Commercial", href: "/admin" }, { label: "Reference Tools" }]}
          meta={roleLabel}
          actions={<OpsButton href="/admin">Enquiry desk</OpsButton>}
        />
        <div className="ops-page-body ops-stack">
          <OpsInfoLine>External providers are treated as reference sources only. If a provider is unavailable, existing KCPL data and workflows remain fully usable.</OpsInfoLine>
          <ForexReferencePanel compact/>
          <GoogleRoadRoutePanel initialOrigin="Kolkata, India" initialDestination="Kathmandu, Nepal" compact/>
        </div>
      </main>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]"><section className="w-full max-w-xl rounded-xl border border-[#e3e5e8] bg-white p-8"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Operations</p><h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p><Link href="/admin" className="mt-5 inline-flex min-h-8 items-center rounded-lg bg-[#283a77] px-3 text-xs font-semibold text-white">Back to enquiries</Link></section></main>;
}
