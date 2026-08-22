import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { getStaffContext, staffCanAccessBranch } from "../../staff-directory.server";
import { checkShipmentBranchAccess } from "../../shipment-access.server";
import { getDigitalJobFile } from "../../job-file.server";
import { getShipmentWorkflowReadiness } from "../../workflow-guard.server";
import { getShipmentActivityTimeline } from "../../shipment-activity.server";
import { getShipmentExceptions } from "../../shipment-exceptions.server";
import { getDeliveryControl } from "../../delivery/delivery-control.server";
import { OperationsShell } from "../../operations-shell";
import { DeliveryPodControl } from "./delivery-pod-control";
import { JobFileWorkspace } from "./job-file-workspace";
import { ShipmentActivityTimeline } from "./shipment-activity-timeline";
import { ShipmentExceptionControl } from "./shipment-exception-control";
import { SmartDocumentIntelligence } from "./smart-document-intelligence";
import { WorkflowSpine } from "./workflow-spine";

export const dynamic = "force-dynamic";
export const metadata = { title: "Digital Job File | KCPL Operations", robots: { index: false, follow: false } };

export default async function JobFilePage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Digital Job Files are available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  const { reference } = await params;
  const shipmentAccess = await checkShipmentBranchAccess(reference, staff);
  if (shipmentAccess.kind === "unavailable") return <Gate title="Job File unavailable" detail="Firestore is not available for this deployment."/>;
  if (shipmentAccess.kind === "missing") return <Gate title="Shipment not found" detail="This shipment reference does not exist."/>;
  if (shipmentAccess.kind === "forbidden") return <Gate title="Outside your branch access" detail="This shipment is outside the branches assigned to your KCPL staff profile."/>;

  const result = await getDigitalJobFile(reference, staff);
  if (result.kind === "unavailable") return <Gate title="Job File unavailable" detail="Firestore is not available for this deployment."/>;
  if (result.kind === "missing") return <Gate title="Shipment not found" detail="This shipment reference does not exist."/>;
  if (result.kind === "forbidden") return <Gate title="Outside your branch access" detail="This shipment is outside the branches assigned to your KCPL staff profile."/>;

  const workflowStaff = { ...staff, can_access_all_branches: true };
  const [workflow, activity, exceptionCases, delivery] = await Promise.all([
    getShipmentWorkflowReadiness(result.job.reference, workflowStaff),
    getShipmentActivityTimeline(result.job.reference, staff),
    getShipmentExceptions(result.job.reference, staff),
    getDeliveryControl(result.job.reference, staff),
  ]);
  if (workflow.kind !== "ready") return <Gate title="Workflow unavailable" detail="The controlled workflow state could not be loaded for this shipment."/>;

  const exceptionBranches = [...new Set([result.job.primary_branch, ...result.job.handling_branches])]
    .filter((branch) => staffCanAccessBranch(staff, branch));

  return (
    <OperationsShell
      userName={access.user.displayName}
      canManageStaff={staff.permissions.canManageStaff}
      canManageFinance={staff.permissions.canManageFinance}
      isManagement={staff.permissions.role === "management"}
    >
      <WorkflowSpine initialWorkflow={workflow.readiness} initialJob={result.job} canOverride={staff.permissions.role === "management"}/>
      <SmartDocumentIntelligence initialWorkflow={workflow.readiness}/>
      {exceptionCases.kind === "ready" && exceptionBranches.length ? (
        <ShipmentExceptionControl
          reference={result.job.reference}
          branches={exceptionBranches}
          initialExceptions={exceptionCases.exceptions}
          initialSummary={exceptionCases.summary}
          currentUserName={access.user.displayName}
          currentUserEmail={access.user.email}
        />
      ) : null}
      {delivery.kind === "ready" ? (
        <DeliveryPodControl
          reference={result.job.reference}
          initialAttempts={delivery.attempts}
          initialEvidence={delivery.evidence}
          initialPodStatus={delivery.pod_status}
          canReview={staff.permissions.canManageCustomerDocuments}
        />
      ) : null}
      <JobFileWorkspace
        initialJob={result.job}
        role={staff.permissions.role}
        canManageBranches={staff.permissions.role === "management"}
        currentUserName={access.user.displayName}
        currentUserEmail={access.user.email}
        nowIso={new Date().toISOString()}
      />
      {activity.kind === "ready" ? <ShipmentActivityTimeline initialTimeline={activity.timeline}/> : null}
      {staff.permissions.canManageJobCosts ? (
        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
          <Link href={`/admin/jobs/${encodeURIComponent(result.job.reference)}/profitability`} className="ops-button shadow-[0_8px_28px_rgba(54,43,34,.10)]" data-variant="secondary" data-size="sm">Job profitability</Link>
          {staff.permissions.canManageFinance ? (
            <>
              <Link href={`/admin/finance/new/${encodeURIComponent(result.job.reference)}`} className="ops-button shadow-[0_8px_28px_rgba(54,43,34,.10)]" data-variant="primary" data-size="sm">Create invoice</Link>
              <Link href={`/admin/payables?shipment=${encodeURIComponent(result.job.reference)}`} className="ops-button border-[#ead5b1] bg-[#fff8ec] text-[#8d5d22] shadow-[0_8px_28px_rgba(54,43,34,.08)]" data-variant="secondary" data-size="sm">Add supplier bill</Link>
            </>
          ) : null}
        </div>
      ) : null}
    </OperationsShell>
  );
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#514840]"><section className="w-full max-w-xl rounded-[15px] border border-[#e6ded7] bg-white p-8 shadow-[0_16px_48px_rgba(60,45,34,.06)]"><p className="ops-eyebrow">KCPL Digital Job File</p><h1 className="mt-3 text-[28px] font-[730] tracking-[-.04em] text-[#342f2b]">{title}</h1><p className="mt-3 text-[13px] leading-6 text-[#746b64]">{detail}</p><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/shipments" className="ops-button" data-variant="primary" data-size="md">Shipments</Link><Link href="/admin" className="ops-button" data-variant="secondary" data-size="md">Operations</Link></div></section></main>;
}
