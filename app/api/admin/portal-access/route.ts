import { getAdminAccess } from "../../../admin/admin-auth";
import { getStaffContext } from "../../../admin/staff-directory.server";
import { isTrustedSameOriginRequest } from "../../../request-security";
import { portalRoleValue } from "../../../portal/portal-access-policy";
import { createPortalInvite } from "../../../portal/portal-invites.server";
import {
  listPortalAccounts,
  savePortalAccount,
  setPortalAccountActive,
} from "../../../portal/portal-accounts.server";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Customer portal access is an access-control surface, so it sits with the
 * same authority that manages staff accounts: Management only. */
async function authorize() {
  const access = await getAdminAccess();
  if (access.kind === "signed-out") return { response: json({ ok: false, error: "Sign in is required." }, 401) };
  if (access.kind !== "authorized") return { response: json({ ok: false, error: "Admin access is not configured." }, 503) };
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageStaff) {
    return { response: json({ ok: false, error: "Only Management can manage customer portal access." }, 403) };
  }
  return { user: access.user, staff };
}

function clean(value: unknown, max = 320) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;

  const result = await listPortalAccounts();
  if (result.kind === "unavailable") return json({ ok: false, error: "Portal account storage is unavailable." }, 503);
  return json({ ok: true, accounts: result.accounts });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin changes are not accepted." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The request could not be read." }, 400);
  }

  const action = clean(body.action, 20) || "save";
  const email = clean(body.email);
  const actor = { name: auth.user.displayName, email: auth.user.email };

  if (action === "activate" || action === "deactivate") {
    const result = await setPortalAccountActive(email, action === "activate", actor);
    if (result.kind === "missing") return json({ ok: false, error: "That portal account was not found." }, 404);
    if (result.kind === "unavailable") return json({ ok: false, error: "Portal account storage is unavailable." }, 503);
    return json({ ok: true });
  }

  if (action === "invite") {
    const customerName = clean(body.customerName, 160) || "your account";
    const invite = await createPortalInvite(email, customerName);
    if (invite.kind === "invalid") return json({ ok: false, error: "Enter a valid email address." }, 400);
    if (invite.kind === "unavailable") return json({ ok: false, error: "The invitation could not be created." }, 503);
    // When no transactional email provider is configured the link is returned
    // once, for a staff member to pass on through their own channel.
    return json({ ok: true, delivered: invite.kind === "sent", link: invite.kind === "link" ? invite.link : null });
  }

  if (action !== "save") return json({ ok: false, error: "Unknown action." }, 400);

  const result = await savePortalAccount({
    email,
    customerId: clean(body.customerId, 120),
    role: portalRoleValue(body.role),
  }, actor);

  if (result.kind === "invalid_email") return json({ ok: false, error: "Enter a valid email address." }, 400);
  if (result.kind === "invalid_customer") return json({ ok: false, error: "Choose an active customer account." }, 400);
  if (result.kind === "staff_email") return json({ ok: false, error: "This address is a KCPL staff account. Staff and customer access cannot be held by the same login." }, 409);
  if (result.kind === "customer_conflict") return json({ ok: false, error: "That address already has portal access to a different customer. Deactivate it first." }, 409);
  if (result.kind === "unavailable") return json({ ok: false, error: "Portal account storage is unavailable." }, 503);
  return json({ ok: true, email: result.email });
}
