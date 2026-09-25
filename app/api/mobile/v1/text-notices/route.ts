import { smsConfigured } from "../../../../integrations/sms.server";
import { whatsappConfigured } from "../../../../integrations/whatsapp.server";
import { getPortalTextNotices, savePortalTextNotices } from "../../../../portal/portal-accounts.server";
import { mobileJson, mobileUnavailable, withMobileSession } from "../../../../portal/portal-mobile-api.server";
import { textNoticeSettingsFromBody } from "../../../../portal/portal-text-notices";

/** The account's SMS / WhatsApp setting, and which channels KCPL offers. */
export async function GET(request: Request) {
  return withMobileSession(request, async (session) => {
    const settings = await getPortalTextNotices(session.email);
    if (!settings) return mobileUnavailable();
    return mobileJson({ ok: true, settings, channels: { sms: smsConfigured(), whatsapp: whatsappConfigured() } });
  });
}

export async function POST(request: Request) {
  return withMobileSession(request, async (session) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return mobileJson({ ok: false, code: "invalid", error: "The change could not be read." }, 400);
    }
    const parsed = textNoticeSettingsFromBody(body ?? {});
    if (!parsed.ok) return mobileJson({ ok: false, code: "invalid", error: parsed.error }, 400);
    const result = await savePortalTextNotices(session.email, parsed.settings);
    if (result.kind === "missing") return mobileJson({ ok: false, code: "missing", error: "This portal account could not be found." }, 404);
    if (result.kind === "unavailable") return mobileUnavailable();
    return mobileJson({ ok: true, settings: parsed.settings });
  });
}
