import { opsJson, withStaffSession } from "../../../../../../../admin/ops-mobile-api.server";
import { staffPostsMessage, staffReadsMessages } from "../../../../../../../shipment-messages.server";

/** The customer conversation on a job, from KCPL Ops: the web Job File's own
 * rules (shipment-messages.server.ts), branch access included. */
export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withStaffSession(request, async ({ staff }) => {
    const { reference } = await context.params;
    const result = await staffReadsMessages(reference, staff);
    return opsJson(result.body, result.status);
  });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withStaffSession(request, async ({ user, staff }) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return opsJson({ ok: false, code: "invalid", error: "The message could not be read." }, 400);
    }
    const { reference } = await context.params;
    const result = await staffPostsMessage(reference, body ?? {}, user, staff);
    return opsJson(result.body, result.status);
  });
}
