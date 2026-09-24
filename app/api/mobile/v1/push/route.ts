import { mobilePushPlatform, mobilePushToken } from "../../../../mobile-push-policy";
import { deleteMobileDevice, saveMobileDevice } from "../../../../mobile-push.server";
import { mobileJson, withMobileSession } from "../../../../portal/portal-mobile-api.server";

/*
 * Registers this phone for push, for the signed-in customer login. The row
 * carries the login's email and uid only: which shipments a push is about is
 * decided at send time by the portal's own notification sweep, never here.
 */

async function readDevice(request: Request) {
  try {
    const body = (await request.json()) as { token?: unknown; platform?: unknown };
    return { token: mobilePushToken(body.token), platform: mobilePushPlatform(body.platform) };
  } catch {
    return { token: null, platform: null };
  }
}

export async function POST(request: Request) {
  return withMobileSession(request, async (session) => {
    const { token, platform } = await readDevice(request);
    if (!token || !platform) return mobileJson({ ok: false, code: "invalid", error: "A device token and platform are required." }, 400);
    const result = await saveMobileDevice({ audience: "customer", email: session.email, uid: session.uid, token, platform });
    if (result.kind !== "saved") return mobileJson({ ok: false, code: "unavailable", error: "Notifications are unavailable." }, 503);
    return mobileJson({ ok: true });
  });
}

export async function DELETE(request: Request) {
  return withMobileSession(request, async (session) => {
    const { token } = await readDevice(request);
    if (!token) return mobileJson({ ok: false, code: "invalid", error: "A device token is required." }, 400);
    await deleteMobileDevice("customer", session.email, token);
    return mobileJson({ ok: true });
  });
}
