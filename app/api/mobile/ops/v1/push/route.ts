import { mobilePushPlatform, mobilePushToken } from "../../../../../mobile-push-policy";
import { deleteMobileDevice, saveMobileDevice } from "../../../../../mobile-push.server";
import { opsJson, withStaffSession } from "../../../../../admin/ops-mobile-api.server";

/** Registers this phone for staff push. What is sent is decided when a
 * notification is created for this person (notification-centre.server.ts). */

async function readDevice(request: Request) {
  try {
    const body = (await request.json()) as { token?: unknown; platform?: unknown };
    return { token: mobilePushToken(body.token), platform: mobilePushPlatform(body.platform) };
  } catch {
    return { token: null, platform: null };
  }
}

export async function POST(request: Request) {
  return withStaffSession(request, async ({ user, staff }) => {
    const { token, platform } = await readDevice(request);
    if (!token || !platform) return opsJson({ ok: false, code: "invalid", error: "A device token and platform are required." }, 400);
    const result = await saveMobileDevice({ audience: "staff", email: user.email, uid: staff.profile.uid, token, platform });
    if (result.kind !== "saved") return opsJson({ ok: false, code: "unavailable", error: "Notifications are unavailable." }, 503);
    return opsJson({ ok: true });
  });
}

export async function DELETE(request: Request) {
  return withStaffSession(request, async ({ user }) => {
    const { token } = await readDevice(request);
    if (!token) return opsJson({ ok: false, code: "invalid", error: "A device token is required." }, 400);
    await deleteMobileDevice("staff", user.email, token);
    return opsJson({ ok: true });
  });
}
