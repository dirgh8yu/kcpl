import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { getStaffContext } from "../../staff-directory.server";
import { getDigitalJobFile } from "../../job-file.server";
import { OperationsShell } from "../../operations-shell";
import { GoogleRoadRoutePanel } from "../../routes/google-road-route-panel";
import { kcplStaffRoleLabels } from "../../staff-permissions";
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

  const roadOrigin = result.job.current_location || result.job.origin;
  const roleLabel = kcplStaffRoleLabels[staff.permissions.role];
  return (
    <OperationsShell
      userName={access.user.displayName}
      roleLabel={roleLabel}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      {staff.permissions.canManageJobCosts ? <div className="border-b border-[#e5e7ea] bg-[#fafafa] px-4 py-2.5 sm:px-6"><div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-end gap-2"><Link href={`/admin/jobs/${encodeURIComponent(result.job.reference)}/profitability`} className="ops-button ops-button-secondary">Job profitability</Link>{staff.permissions.canManageFinance ? <><Link href={`/admin/finance/new/${encodeURIComponent(result.job.reference)}`} className="ops-button ops-button-primary">Create invoice</Link><Link href={`/admin/payables?shipment=${encodeURIComponent(result.job.reference)}`} className="ops-button ops-button-secondary">Add supplier bill</Link></> : null}</div></div> : null}
      {roadOrigin && result.job.destination ? <div className="ops-page-body pb-0"><GoogleRoadRoutePanel initialOrigin={roadOrigin} initialDestination={result.job.destination} compact/></div> : null}
      <JobFileWorkspace
        initialJob={result.job}
        role={staff.permissions.role}
        canManageBranches={staff.permissions.role === "management"}
        currentUserName={access.user.displayName}
        currentUserEmail={access.user.email}
      />
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]"><section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Digital Job File</p><h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p><div className="mt-6 flex gap-2"><Link href="/admin/shipments" className="ops-button ops-button-primary">Shipments</Link><Link href="/admin/crm" className="ops-button ops-button-secondary">Customers</Link></div></section></main>;
}
