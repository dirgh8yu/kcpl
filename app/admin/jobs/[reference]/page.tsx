import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { getStaffContext } from "../../staff-directory.server";
import { getDigitalJobFile } from "../../job-file.server";
import { OperationsShell } from "../../operations-shell";
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
  return (
    <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff}>
      <JobFileWorkspace initialJob={result.job} role={staff.permissions.role} canManageBranches={staff.permissions.role === "management"} currentUserName={access.user.displayName} currentUserEmail={access.user.email}/>
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f5f6f7] p-6 text-[#10263f]"><section className="w-full max-w-xl rounded-xl border border-[#dfe3e8] bg-white p-8"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a6c36]">KCPL Digital Job File</p><h1 className="mt-3 text-2xl font-bold">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68747f]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/shipments" className="rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-bold text-white">Shipments</Link><Link href="/admin" className="rounded-lg border border-[#dfe3e8] px-4 py-2.5 text-xs font-bold">Enquiries</Link></div></section></main>;
}
