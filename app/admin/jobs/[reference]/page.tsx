import Link from "next/link";
import { getAdminAccess } from "../../admin-auth";
import { getDeliveryControl } from "../../delivery/delivery-control.server";
import { getDigitalJobFile } from "../../job-file.server";
import { OperationsShell } from "../../operations-shell";
import { getShipmentActivityTimeline } from "../../shipment-activity.server";
import { getShipmentExceptions } from "../../shipment-exceptions.server";
import { checkShipmentBranchAccess } from "../../shipment-access.server";
import { getStaffContext, staffCanAccessBranch } from "../../staff-directory.server";
import { V4WorkspaceGate } from "../../v4-workspace-gate";
import { getShipmentWorkflowReadiness } from "../../workflow-guard.server";
import { DeliveryPodControl } from "./delivery-pod-control";
import { JobFileWorkspace } from "./job-file-workspace";
import { ShipmentActivityTimeline } from "./shipment-activity-timeline";
import { ShipmentExceptionControl } from "./shipment-exception-control";
import { SmartDocumentIntelligence } from "./smart-document-intelligence";
import { V4ShipmentDetailOverview } from "./v4-shipment-detail-overview";
import { WorkflowSpine } from "./workflow-spine";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipment Detail | KCPL Operations", robots: { index: false, follow: false } };

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

  return <OperationsShell
    userName={access.user.displayName}
    canManageStaff={staff.permissions.canManageStaff}
    canManageFinance={staff.permissions.canManageFinance}
    canViewCommercial={staff.permissions.canViewCommercial}
    canManageJobFile={staff.permissions.canManageJobFile}
    isManagement={staff.permissions.role === "management"}
  >
    <V4ShipmentDetailOverview job={result.job}/>

    <section id="operational-controls" className="border-t border-[#e2e2e2] bg-[#f6f6f3] pb-20 pt-2">
      <div className="ops-content-wide pt-4"><div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#e2e2e2] bg-white px-4 py-3"><div><p className="text-[11px] font-medium text-[#737373]">DEEP OPERATIONS</p><p className="mt-1 text-[13px] font-semibold text-[#141414]">Workflow, documents, exceptions, delivery evidence and Digital Job File controls</p></div><div className="flex flex-wrap gap-2"><Link href={`/admin/pickups?shipment=${encodeURIComponent(result.job.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Pickup</Link><Link href={`/admin/freight-documents?shipment=${encodeURIComponent(result.job.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Documents</Link><Link href={`/admin/visibility?shipment=${encodeURIComponent(result.job.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Tracking</Link><Link href={`/admin/delivery?shipment=${encodeURIComponent(result.job.reference)}`} className="ops-button" data-variant="primary" data-size="sm">Delivery & POD</Link></div></div></div>
      <WorkflowSpine initialWorkflow={workflow.readiness} initialJob={result.job} canOverride={staff.permissions.role === "management"}/>
      <SmartDocumentIntelligence initialWorkflow={workflow.readiness}/>
      {exceptionCases.kind === "ready" && exceptionBranches.length ? <ShipmentExceptionControl reference={result.job.reference} branches={exceptionBranches} initialExceptions={exceptionCases.exceptions} initialSummary={exceptionCases.summary} currentUserName={access.user.displayName} currentUserEmail={access.user.email}/> : null}
      {delivery.kind === "ready" ? <DeliveryPodControl reference={result.job.reference} initialAttempts={delivery.attempts} initialEvidence={delivery.evidence} initialPodStatus={delivery.pod_status} initialShipmentStatus={delivery.shipment_status} initialExternalObservedMilestone={delivery.external_observed_milestone} initialExternalObservedAt={delivery.external_observed_at} initialExternalObservedProvider={delivery.external_observed_provider} canReview={staff.permissions.canManageCustomerDocuments}/> : null}
      <JobFileWorkspace initialJob={result.job} role={staff.permissions.role} canManageBranches={staff.permissions.role === "management"} currentUserName={access.user.displayName} currentUserEmail={access.user.email} nowIso={new Date().toISOString()}/>
      {activity.kind === "ready" ? <ShipmentActivityTimeline initialTimeline={activity.timeline}/> : null}
    </section>

    {staff.permissions.canManageJobCosts ? <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2"><Link href={`/admin/jobs/${encodeURIComponent(result.job.reference)}/profitability`} className="ops-button" data-variant="secondary" data-size="sm">Job profitability</Link>{staff.permissions.canManageFinance ? <><Link href={`/admin/finance/new/${encodeURIComponent(result.job.reference)}`} className="ops-button" data-variant="primary" data-size="sm">Create invoice</Link><Link href={`/admin/payables?shipment=${encodeURIComponent(result.job.reference)}`} className="ops-button border-[#ead9ae] bg-[#fffaf0] text-[#945b00]" data-variant="secondary" data-size="sm">Add supplier bill</Link></> : null}</div> : null}
  </OperationsShell>;
}

function Gate({ title, detail }: { title: string; detail: string }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Digital Job File"
    title={title}
    detail={detail}
    actions={[
      { href: "/admin/shipments", label: "Shipments", primary: true },
      { href: "/admin/command-centre", label: "Operations Overview" },
    ]}
  />;
}
