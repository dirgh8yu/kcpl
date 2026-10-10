import { getDigitalJobFile } from "../../../../../../admin/job-file.server";
import { checkShipmentBranchAccess } from "../../../../../../admin/shipment-access.server";
import { listOpsFieldNotes } from "../../../../../../admin/ops-field.server";
import { readShipmentContainers } from "../../../../../../shipment-containers.server";
import { getShipmentWorkflowReadiness } from "../../../../../../admin/workflow-guard.server";
import { opsJson, opsUnavailable, withStaffSession } from "../../../../../../admin/ops-mobile-api.server";
import { getJobStepContext } from "../../../../../../admin/jobs/[reference]/job-step-context.server";
import { buildJobSteps, currentJobStep } from "../../../../../../admin/jobs/[reference]/job-steps";

/** A Job File, with the same guards as the web Job File route: branch access
 * first, and costs only for roles that manage them (getDigitalJobFile). */
export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withStaffSession(request, async ({ staff }) => {
    const { reference } = await context.params;
    const access = await checkShipmentBranchAccess(reference, staff);
    if (access.kind === "unavailable") return opsUnavailable();
    if (access.kind === "missing") return opsJson({ ok: false, code: "missing", error: "Shipment not found." }, 404);
    if (access.kind === "forbidden") return opsJson({ ok: false, code: "forbidden", error: "This shipment is outside your branch access." }, 403);

    // Readiness uses the same widened context the web route gives it: it
    // reads across branches to judge closeout, after access was decided above.
    const [result, workflow, fieldNotes, stepContext, containers] = await Promise.all([
      getDigitalJobFile(reference, staff),
      getShipmentWorkflowReadiness(reference, { ...staff, can_access_all_branches: true }),
      listOpsFieldNotes(reference),
      getJobStepContext(reference).catch(() => ({ clearance: null, pickupStatus: null, pickup: null })),
      readShipmentContainers(reference).catch(() => null),
    ]);
    if (result.kind === "missing") return opsJson({ ok: false, code: "missing", error: "Shipment not found." }, 404);
    if (result.kind === "forbidden") return opsJson({ ok: false, code: "forbidden", error: "This shipment is outside your branch access." }, 403);
    if (result.kind !== "ready") return opsUnavailable();
    // The same "what's next" the web Job File opens on, so the app and the
    // web never disagree about what a job is waiting for.
    const step = workflow.kind === "ready" ? currentJobStep(buildJobSteps({
      status: result.job.status,
      customerName: result.job.customer_name,
      currentLocation: result.job.current_location,
      readiness: workflow.readiness,
      pickupStatus: stepContext.pickupStatus,
      customsHoldReason: stepContext.clearance?.hold_reason ?? null,
    })) : null;
    return opsJson({ ok: true, job: result.job, workflow: workflow.kind === "ready" ? workflow.readiness : null, step, fieldNotes, containers: containers ?? [] });
  });
}
