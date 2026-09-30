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
import { qaMockDataEnabled } from "../../qa-fixtures";
import { shipmentCustomerAccessView } from "../../../portal/portal-access-log.server";
import { CustomerAccessPanel } from "./customer-access-panel";
import { DeliveryPodControl } from "./delivery-pod-control";
import { JobFileWorkspace } from "./job-file-workspace";
import { ShipmentActivityTimeline } from "./shipment-activity-timeline";
import { ShipmentExceptionControl } from "./shipment-exception-control";
import { JobRecord } from "./job-record";
import { getJobStepContext } from "./job-step-context.server";
import { listPartnerOptions } from "../../partners/partners.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipment | KCPL Operations", robots: { index: false, follow: false } };

export default async function JobFilePage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ returnTo?: string | string[]; a?: string | string[]; step?: string | string[] }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Sign in with your KCPL staff account to see shipments."/>;

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
  const { a: requestedActivity, step: requestedStep } = await searchParams;
  // Deep link from the shipments inspector (?a=<activity item id>).
  const activityHighlight = typeof requestedActivity === "string" ? requestedActivity : null;
  const shipmentAccess = await checkShipmentBranchAccess(reference, staff);
  if (shipmentAccess.kind === "unavailable") return shellGate("Shipment can’t be opened right now", "The records service isn’t responding. Try again in a minute.");
  if (shipmentAccess.kind === "missing") return shellGate("Shipment not found", "No shipment has this reference. Check it and search again.");
  if (shipmentAccess.kind === "forbidden") return shellGate("Outside your branch access", "This shipment belongs to a branch you don’t have access to. Ask Management if you need it.");

  const result = await getDigitalJobFile(reference, staff);
  if (result.kind === "unavailable") return shellGate("Shipment can’t be opened right now", "The records service isn’t responding. Try again in a minute.");
  if (result.kind === "missing") return shellGate("Shipment not found", "No shipment has this reference. Check it and search again.");
  if (result.kind === "forbidden") return shellGate("Outside your branch access", "This shipment belongs to a branch you don’t have access to. Ask Management if you need it.");

  const workflowStaff = { ...staff, can_access_all_branches: true };
  const [workflow, activity, exceptionCases, delivery, customerAccess, stepContext, partnerOptions] = await Promise.all([
    getShipmentWorkflowReadiness(result.job.reference, workflowStaff),
    getShipmentActivityTimeline(result.job.reference, staff),
    getShipmentExceptions(result.job.reference, staff),
    getDeliveryControl(result.job.reference, staff),
    qaMockDataEnabled() ? Promise.resolve({ kind: "ready" as const, summaries: [], pending: [], releasedCount: 0 }) : shipmentCustomerAccessView(result.job.reference),
    getJobStepContext(result.job.reference).catch(() => ({ clearance: null, pickupStatus: null, pickup: null })),
    listPartnerOptions(staff).catch(() => null),
  ]);
  if (workflow.kind !== "ready") return shellGate("Shipment can’t be opened right now", "Its progress checks didn’t load. Try again in a minute.");

  const customsAgents = (partnerOptions ?? [])
    .filter((partner) => partner.types.includes("customs_agent") || partner.types.includes("clearing_partner"))
    .map((partner) => ({ id: partner.id, name: partner.name }));
  const exceptionBranches = [...new Set([result.job.primary_branch, ...result.job.handling_branches])]
    .filter((branch) => staffCanAccessBranch(staff, branch));

  return <OperationsShell {...shellProps}>
    <JobRecord
      job={result.job}
      readiness={workflow.readiness}
      clearance={staff.permissions.canManageJobFile ? stepContext.clearance : null}
      customsAgents={customsAgents}
      pickupStatus={stepContext.pickupStatus}
      pickup={stepContext.pickup}
      requestedPanel={typeof requestedStep === "string" ? requestedStep : null}
      openProblems={exceptionCases.kind === "ready" ? exceptionCases.summary.open : 0}
      canManageFinance={staff.permissions.canManageFinance}
      canMessageCustomer={staff.permissions.canManageJobFile}
    >
      <div id="shipment-work" className="job-record-workspace">
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

      <div id="shipment-exceptions" className="job-record-block" data-panel="problems">
        {exceptionCases.kind === "ready" && exceptionBranches.length ? (
          <ShipmentExceptionControl
            reference={result.job.reference}
            branches={exceptionBranches}
            initialExceptions={exceptionCases.exceptions}
            initialSummary={exceptionCases.summary}
            currentUserName={access.user.displayName}
            currentUserEmail={access.user.email}
          />
        ) : <QuietSection eyebrow="Problems" title="Problems can’t be shown" detail="None of this shipment’s branches are in your access."/>}
      </div>

      <div id="shipment-delivery" className="job-record-block" data-panel="delivery proof">
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
        ) : <QuietSection eyebrow="Delivery" title="Delivery details didn’t load" detail="Reload the page to try again."/>}
      </div>

      <div id="shipment-customer-access" className="job-record-block" data-panel="documents">
        {customerAccess.kind === "ready" ? (
          <CustomerAccessPanel
            summaries={customerAccess.summaries}
            pending={customerAccess.pending}
            releasedCount={customerAccess.releasedCount}
          />
        ) : <QuietSection eyebrow="Customer portal" title="Customer document views didn’t load" detail="Reload the page to try again."/>}
      </div>

      <div id="shipment-activity" className="job-record-block" data-panel="history">
        {activity.kind === "ready" ? <ShipmentActivityTimeline initialTimeline={activity.timeline} highlightId={activityHighlight}/> : <QuietSection eyebrow="History" title="History didn’t load" detail="Reload the page to try again."/>}
      </div>
    </JobRecord>
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
    eyebrow="Shipment"
    title={title}
    detail={detail}
    embedded={embedded}
    actions={[
      { href: "/admin/shipments", label: "Shipments", primary: true },
      { href: "/admin/command-centre", label: "Overview" },
    ]}
  />;
}
