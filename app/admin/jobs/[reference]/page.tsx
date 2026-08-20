import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { getStaffContext } from "../../staff-directory.server";
import { getDigitalJobFile } from "../../job-file.server";
import { JobFileWorkspace } from "./job-file-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Digital Job File | KCPL Operations", robots: { index: false, follow: false } };

export default async function JobFilePage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Digital Job Files are available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  const { reference } = await params;
  const result = await getDigitalJobFile(reference, staff);
  if (result.kind === "unavailable") return <Gate title="Job File unavailable" detail="Firestore is not available for this deployment."/>;
  if (result.kind === "missing") return <Gate title="Shipment not found" detail="This shipment reference does not exist."/>;
  if (result.kind === "forbidden") return <Gate title="Outside your branch access" detail="This shipment is assigned to a KCPL branch outside your staff profile."/>;
  return <>
    <JobFileWorkspace initialJob={result.job} role={staff.permissions.role} canManageBranches={staff.permissions.role === "management"} currentUserName={access.user.displayName} currentUserEmail={access.user.email}/>
    {staff.permissions.canManageJobCosts ? <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-2"><Link href={`/admin/jobs/${encodeURIComponent(result.job.reference)}/profitability`} className="rounded-2xl bg-[#10263f] px-4 py-3 text-[10px] font-black uppercase tracking-[.1em] text-white shadow-lg">Job profitability</Link>{staff.permissions.canManageFinance ? <><Link href={`/admin/finance/new/${encodeURIComponent(result.job.reference)}`} className="rounded-2xl bg-emerald-700 px-4 py-3 text-[10px] font-black uppercase tracking-[.1em] text-white shadow-lg">Create invoice</Link><Link href={`/admin/payables?shipment=${encodeURIComponent(result.job.reference)}`} className="rounded-2xl bg-[#b78a3e] px-4 py-3 text-[10px] font-black uppercase tracking-[.1em] text-white shadow-lg">Add supplier bill</Link></> : null}</div> : null}
  </>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-8 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#b78a3e]">KCPL Digital Job File</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-black/50">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin" className="rounded-xl bg-[#10263f] px-4 py-3 text-sm font-black text-white">Operations</Link><Link href="/admin/crm" className="rounded-xl border border-black/10 px-4 py-3 text-sm font-black">CRM</Link></div></section></main>;
}
