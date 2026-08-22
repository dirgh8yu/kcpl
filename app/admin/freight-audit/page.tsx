import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { OperationsShell } from "../operations-shell";
import { getStaffContext } from "../staff-directory.server";
import { listFreightAuditQueue } from "./freight-audit.server";
import { FreightAuditWorkspace } from "./freight-audit-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Freight Audit & Match-Pay | KCPL Operations", robots: { index: false, follow: false } };

export default async function FreightAuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Freight Audit is available only to authorised KCPL finance staff."/>;
  const staff = await getStaffContext(access.user);
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  if (!staff.permissions.canManageFinance) return <OperationsShell {...shellProps}><Gate embedded title="Freight Audit access restricted" detail="Management or Accounts access is required for Match-Pay controls."/></OperationsShell>;

  let result: Awaited<ReturnType<typeof listFreightAuditQueue>>;
  try { result = await listFreightAuditQueue(staff); }
  catch (error) { console.error("Failed to load KCPL Freight Audit", error); result = { kind: "unavailable" as const }; }

  if (result.kind !== "ready") return <OperationsShell {...shellProps}><Gate embedded title="Freight Audit unavailable" detail="Firebase audit data is temporarily unavailable. Existing supplier bills have not been changed."/></OperationsShell>;
  const { q } = await searchParams;
  return <OperationsShell {...shellProps}><FreightAuditWorkspace initialRows={result.rows} initialSummary={result.summary} isManagement={staff.permissions.role === "management"} initialFocus={q?.trim() ?? ""}/></OperationsShell>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <main className={`grid place-items-center bg-[#f8f6f3] p-6 text-[#514840] ${embedded ? "min-h-[calc(100vh-58px)]" : "min-h-screen"}`}><section className="w-full max-w-xl rounded-[15px] border border-[#e5ddd6] bg-white p-8 shadow-[0_16px_48px_rgba(60,45,34,.06)]"><p className="ops-eyebrow">KCPL Freight Audit</p><h1 className="mt-3 text-[28px] font-[730] tracking-[-.04em] text-[#342f2b]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#746b64]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/payables" className="ops-button" data-variant="primary" data-size="md">Accounts Payable</Link><Link href="/admin" className="ops-button" data-variant="secondary" data-size="md">Operations</Link></div></section></main>;
}
