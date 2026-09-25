import { checkShipmentBranchAccess } from "../../../../../../../admin/shipment-access.server";
import { addJobTaskFromRequest, closeJobFromRequest, reassignJob } from "../../../../../../../admin/job-file-requests.server";
import { opsJson, opsUnavailable, withStaffSession } from "../../../../../../../admin/ops-mobile-api.server";

/** Add a task, give the job to someone else, or close it: the web Job File's
 * own decisions (job-file-requests.server.ts), after the same branch check. */
export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withStaffSession(request, async ({ user, staff }) => {
    const { reference } = await context.params;
    const access = await checkShipmentBranchAccess(reference, staff);
    if (access.kind === "unavailable") return opsUnavailable();
    if (access.kind === "missing") return opsJson({ ok: false, code: "missing", error: "Shipment not found." }, 404);
    if (access.kind === "forbidden") return opsJson({ ok: false, code: "forbidden", error: "This shipment is outside your branch access." }, 403);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return opsJson({ ok: false, code: "invalid", error: "The action could not be read." }, 400);
    }
    const actor = { name: user.displayName, email: user.email };
    const action = typeof body.action === "string" ? body.action : "";
    const result =
      action === "add_task"
        ? await addJobTaskFromRequest(reference, body, actor, staff)
        : action === "close_job"
          ? await closeJobFromRequest(reference, body, actor, staff)
          : action === "reassign"
            ? await reassignJob(reference, body, user, staff)
            : { status: 400, body: { ok: false, error: "Choose a valid Job File action." } };
    return opsJson(result.body, result.status);
  });
}
