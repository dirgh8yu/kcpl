import Link from "next/link";
import { getAdminAccess } from "../admin-auth";
import { getStaffContext } from "../staff-directory.server";
import { buildManagementAnalytics, resolveManagementRange } from "./management.server";
import { ManagementWorkspace } from "./management-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Executive Dashboard | KCPL", robots: { index: false, follow: false } };

type SearchParams = Record<string, string | string[] | undefined>;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ManagementPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in to KCPL Operations." detail="Executive analytics are available only to authorised KCPL management."/>;
  const staff = await getStaffContext(access.user);
  if (staff.permissions.role !== "management") return <Gate title="Management access required." detail="Executive performance, profitability and company-wide financial analytics are restricted to the Management role."/>;

  const params = await searchParams;
  const range = resolveManagementRange(param(params.range), param(params.from), param(params.to));
  const analytics = await buildManagementAnalytics(range);
  if (!analytics) return <Gate title="Analytics are unavailable." detail="The Firebase reporting backend is unavailable for this deployment."/>;
  return <ManagementWorkspace analytics={analytics}/>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b78a3e]">KCPL Management Intelligence</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-black/50">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin" className="rounded-xl bg-[#10263f] px-4 py-3 text-sm font-black text-white">Operations</Link><Link href="/admin/command-centre" className="rounded-xl border border-black/10 px-4 py-3 text-sm font-black">Command Centre</Link></div></section></main>;
}
