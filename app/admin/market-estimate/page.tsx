import Link from "next/link";
import { BadgeCheck, Calculator, Handshake, PackageSearch, ShieldCheck } from "lucide-react";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { kcplStaffRoleLabels } from "../staff-permissions";
import { OpsBadge, OpsEmptyState, OpsPage, OpsPageHeader, OpsSurface } from "../operations-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Market Estimate | KCPL Operations", robots: { index: false, follow: false } };

export default async function MarketEstimatePage() {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Use an authorised KCPL staff account to access commercial tools."/>;

  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canViewCommercial) return <Gate title="Commercial access required" detail="Market intelligence tools are available to Management, Accounts and Commercial roles."/>;

  return (
    <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}>
      <OpsPage>
        <OpsPageHeader eyebrow="Commercial" title="Market estimate" description="A controlled workspace for pricing inputs KCPL can trust. External courier-rate calls are disabled until a replacement provider is deliberately vetted." meta={<><OpsBadge tone="accent">{kcplStaffRoleLabels[staff.permissions.role]}</OpsBadge><span>No external rate API connected</span></>} />
        <div className="ops-content ops-stack">
          <OpsSurface eyebrow="Pricing sources" title="Build estimates from verified inputs" description="Use KCPL partner/vendor rates and the enquiry pricing worksheet today. A future live-rate connector can plug into this workspace without changing the rest of the commercial flow.">
            <div className="grid gap-3 md:grid-cols-2">
              <Link href="/admin/partners" className="group rounded-[15px] border border-[#e7dfd8] bg-[#faf7f4] p-5 hover:bg-white">
                <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#f3e7df] text-[#b8654f]"><Handshake size={17}/></span>
                <h2 className="mt-4 text-[13px] font-[720] tracking-[-.02em] text-[#4b423c]">Verified partners & vendors</h2>
                <p className="mt-1.5 text-[9px] leading-5 text-[#8a8078]">Review counterpart coverage, supplier terms, modes and service context before building a customer offer.</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[9px] font-bold text-[#b5654f]">Open network register →</span>
              </Link>
              <Link href="/admin" className="group rounded-[15px] border border-[#e7dfd8] bg-[#faf7f4] p-5 hover:bg-white">
                <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#eef3ef] text-[#6f8874]"><PackageSearch size={17}/></span>
                <h2 className="mt-4 text-[13px] font-[720] tracking-[-.02em] text-[#4b423c]">Enquiry pricing worksheet</h2>
                <p className="mt-1.5 text-[9px] leading-5 text-[#8a8078]">Put customer price, internal cost, profit, margin, currency and validity together in the live quote workflow.</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[9px] font-bold text-[#b5654f]">Open enquiries →</span>
              </Link>
            </div>
          </OpsSurface>

          <OpsSurface eyebrow="Integration policy" title="No synthetic rates" description="KCPL should never present a number as a live market quote unless its source, freshness and scope are known.">
            <div className="grid gap-3 sm:grid-cols-3"><Principle icon={<BadgeCheck size={15}/>} title="Verified source" detail="Only approved providers or internal rate cards."/><Principle icon={<ShieldCheck size={15}/>} title="Private by default" detail="Do not send shipment data to unknown third parties."/><Principle icon={<Calculator size={15}/>} title="Transparent estimate" detail="Separate market input, cost, margin and customer sell."/></div>
          </OpsSurface>
        </div>
      </OpsPage>
    </OperationsShell>
  );
}

function Principle({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="rounded-[13px] border border-[#eae2dc] bg-[#faf7f4] p-4"><span className="text-[#a86b54]">{icon}</span><strong className="mt-3 block text-[10px] text-[#514840]">{title}</strong><p className="mt-1 text-[8px] leading-4 text-[#91877f]">{detail}</p></div>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e7dfd8] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Operations</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><Link href="/admin" className="mt-6 inline-flex rounded-[11px] bg-[#e8755d] px-4 py-2.5 text-[10px] font-bold text-white">Back to enquiries</Link></section></main>;
}
