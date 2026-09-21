import "./job-file-premium.css";
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
import { readShipmentFreeTime } from "../../../shipment-free-time.server";
import { shipmentCustomerAccessView } from "../../../portal/portal-access-log.server";
import { CustomerAccessPanel } from "./customer-access-panel";
import { DeliveryPodControl } from "./delivery-pod-control";
import { JobFileWorkspace } from "./job-file-workspace";
import { ShipmentActivityTimeline } from "./shipment-activity-timeline";
import { ShipmentExceptionControl } from "./shipment-exception-control";
import { V4ShipmentDetailOverview } from "./v4-shipment-detail-overview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipment Detail | KCPL Operations", robots: { index: false, follow: false } };

export default async function JobFilePage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ returnTo?: string | string[]; a?: string | string[] }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Digital Job Files are available only to authorised KCPL staff."/>;

  const staff = await getStaffContext(access.user);
  // Every gate past this point has a staff context, so it can keep the
  // navigation shell. Losing the sidebar on a backend hiccup strands the user
  // on a dead end with no way out but the browser's back button.
  const shellProps = {
    userName: access.user.displayName,
    canManageStaff: staff.permissions.canManageStaff,
    canManageFinance: staff.permissions.canManageFinance,
    canViewCommercial: staff.permissions.canViewCommercial,
    canManageJobFile: staff.permissions.canManageJobFile,
    isManagement: staff.permissions.role === "management",
  };
  const shellGate = (title: string, detail: string) => (
    <OperationsShell {...shellProps}><Gate title={title} detail={detail} embedded/></OperationsShell>
  );
  const { reference } = await params;
  const { a: requestedActivity } = await searchParams;
  // Deep link from the shipments inspector (?a=<activity item id>).
  const activityHighlight = typeof requestedActivity === "string" ? requestedActivity : null;
  const shipmentAccess = await checkShipmentBranchAccess(reference, staff);
  if (shipmentAccess.kind === "unavailable") return shellGate("Job File unavailable", "Firestore is not available for this deployment.");
  if (shipmentAccess.kind === "missing") return shellGate("Shipment not found", "This shipment reference does not exist.");
  if (shipmentAccess.kind === "forbidden") return shellGate("Outside your branch access", "This shipment is outside the branches assigned to your KCPL staff profile.");

  const result = await getDigitalJobFile(reference, staff);
  if (result.kind === "unavailable") return shellGate("Job File unavailable", "Firestore is not available for this deployment.");
  if (result.kind === "missing") return shellGate("Shipment not found", "This shipment reference does not exist.");
  if (result.kind === "forbidden") return shellGate("Outside your branch access", "This shipment is outside the branches assigned to your KCPL staff profile.");

  const workflowStaff = { ...staff, can_access_all_branches: true };
  const [workflow, activity, exceptionCases, delivery, customerAccess] = await Promise.all([
    getShipmentWorkflowReadiness(result.job.reference, workflowStaff),
    getShipmentActivityTimeline(result.job.reference, staff),
    getShipmentExceptions(result.job.reference, staff),
    getDeliveryControl(result.job.reference, staff),
    shipmentCustomerAccessView(result.job.reference),
  ]);
  if (workflow.kind !== "ready") return shellGate("Workflow unavailable", "The controlled workflow state could not be loaded for this shipment.");

  const exceptionBranches = [...new Set([result.job.primary_branch, ...result.job.handling_branches])]
    .filter((branch) => staffCanAccessBranch(staff, branch));

  return <OperationsShell {...shellProps}>
    <V4ShipmentDetailOverview job={result.job} readiness={workflow.readiness}>
      <div id="shipment-work" className="shipment-detail-anchor job-record-workspace">
        <JobFileWorkspace
          initialJob={result.job}
          initialReadiness={workflow.readiness}
          role={staff.permissions.role}
          canManageBranches={staff.permissions.role === "management"}
          canOverride={staff.permissions.role === "management"}
          currentUserName={access.user.displayName}
          currentUserEmail={access.user.email}
          nowIso={new Date().toISOString()}
          freeTime={await readShipmentFreeTime(result.job.reference)}
          canManageJobFile={staff.permissions.canManageJobFile}
        />
      </div>

      <div id="shipment-exceptions" className="shipment-detail-anchor job-record-block">
        {exceptionCases.kind === "ready" && exceptionBranches.length ? (
          <ShipmentExceptionControl
            reference={result.job.reference}
            branches={exceptionBranches}
            initialExceptions={exceptionCases.exceptions}
            initialSummary={exceptionCases.summary}
            currentUserName={access.user.displayName}
            currentUserEmail={access.user.email}
          />
        ) : <QuietSection eyebrow="Exceptions" title="Exception register unavailable" detail="No exception register is available for the branches in your current access scope."/>}
      </div>

      <div id="shipment-delivery" className="shipment-detail-anchor job-record-block">
        {delivery.kind === "ready" ? (
          <DeliveryPodControl
            reference={result.job.reference}
            initialAttempts={delivery.attempts}
            initialEvidence={delivery.evidence}
            initialPodStatus={delivery.pod_status}
            initialShipmentStatus={delivery.shipment_status}
            initialExternalObservedMilestone={delivery.external_observed_milestone}
            initialExternalObservedAt={delivery.external_observed_at}
            initialExternalObservedProvider={delivery.external_observed_provider}
            canReview={staff.permissions.canManageCustomerDocuments}
          />
        ) : <QuietSection eyebrow="Delivery" title="Delivery control unavailable" detail="Delivery and POD state could not be loaded for this shipment."/>}
      </div>

      <div id="shipment-customer-access" className="shipment-detail-anchor job-record-block">
        {customerAccess.kind === "ready" ? (
          <CustomerAccessPanel
            summaries={customerAccess.summaries}
            pending={customerAccess.pending}
            releasedCount={customerAccess.releasedCount}
          />
        ) : <QuietSection eyebrow="Customer portal" title="Document access unavailable" detail="The customer document access log could not be loaded for this shipment."/>}
      </div>

      <div id="shipment-activity" className="shipment-detail-anchor job-record-block">
        {activity.kind === "ready" ? <ShipmentActivityTimeline initialTimeline={activity.timeline} highlightId={activityHighlight}/> : <QuietSection eyebrow="Activity" title="Activity unavailable" detail="The shipment activity timeline could not be loaded."/>}
      </div>
    </V4ShipmentDetailOverview>
  </OperationsShell>;
}

// Compact unavailable state: a title and one sentence, then stop.
function QuietSection({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <section className="ops-surface job-quiet-section" aria-label={eyebrow}>
    <h2>{title}</h2>
    <p>{detail}</p>
  </section>;
}

function Gate({ title, detail, embedded = false }: { title: string; detail: string; embedded?: boolean }) {
  return <V4WorkspaceGate
    eyebrow="KCPL Digital Job File"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/shipments", label: "Shipments", primary: true },
      { href: "/admin/command-centre", label: "Operations Overview" },
    ]}
  />;
}
