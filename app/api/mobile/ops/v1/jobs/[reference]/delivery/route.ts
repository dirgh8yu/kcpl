import { deliveryControlView, scheduleDeliveryFromRequest, updateDeliveryFromRequest } from "../../../../../../../admin/delivery/delivery-requests.server";
import { opsJson, withStaffSession } from "../../../../../../../admin/ops-mobile-api.server";

/** Delivery Control for a job, from the field: start an attempt and record
 * how it ended. The web's own functions decide; POD is verified at the desk. */
export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withStaffSession(request, async ({ staff }) => {
    const { reference } = await context.params;
    const result = await deliveryControlView(reference, staff);
    return opsJson(result.body, result.status);
  });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withStaffSession(request, async ({ user, staff }) => {
    const { reference } = await context.params;
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return opsJson({ ok: false, code: "invalid", error: "The delivery request could not be read." }, 400);
    }
    const actor = { name: user.displayName, email: user.email };
    const result =
      body.action === "schedule"
        ? await scheduleDeliveryFromRequest(reference, body, actor, staff)
        : body.action === "update_attempt"
          ? await updateDeliveryFromRequest(reference, body, actor, staff)
          : { status: 400, body: { ok: false, error: "Unknown delivery action." } };
    return opsJson(result.body, result.status);
  });
}
