import { mobileJson, withMobileSession } from "../../../../../../portal/portal-mobile-api.server";
import { customerPostsMessage, customerReadsMessages } from "../../../../../../shipment-messages.server";

/** The shipment's conversation with KCPL, from the KCPL app: the same rules
 * as the web portal's (shipment-messages.server.ts). */
export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    const { reference } = await context.params;
    const result = await customerReadsMessages(session, reference);
    return mobileJson(result.body, result.status);
  });
}

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }) {
  return withMobileSession(request, async (session) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return mobileJson({ ok: false, code: "invalid", error: "The message could not be read." }, 400);
    }
    const { reference } = await context.params;
    const result = await customerPostsMessage(session, reference, body ?? {});
    return mobileJson(result.body, result.status);
  });
}
