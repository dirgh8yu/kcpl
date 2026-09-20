import { getPortalAccess } from "../../../portal/portal-auth";
import { applyPortalTeamChange, listPortalTeam } from "../../../portal/portal-accounts.server";
import { createPortalInvite } from "../../../portal/portal-invites.server";
import { portalTeamActions, portalTeamDenialMessages, type PortalTeamAction } from "../../../portal/portal-access-policy";
import { isTrustedSameOriginRequest } from "../../../request-security";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/*
 * Customer-managed team logins.
 *
 * An account owner adding a colleague is the phone call to KCPL this route
 * exists to remove. Everything that decides *whether* a change is allowed is
 * `decidePortalTeamChange`, a pure function with its own tests; this route
 * supplies the session facts and nothing else. In particular the customer id
 * is always the session's, so there is no request field through which an owner
 * could reach another customer's logins.
 */

export async function GET() {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (access.session.role !== "owner") {
    return json({ ok: false, error: portalTeamDenialMessages.not_owner }, 403);
  }

  const team = await listPortalTeam(access.session.customerId);
  if (!team) return json({ ok: false, error: "Team logins could not be loaded." }, 503);
  return json({ ok: true, team });
}

export async function POST(request: Request) {
  const access = await getPortalAccess();
  if (access.kind === "unconfigured") return json({ ok: false, error: "The customer portal is not configured." }, 503);
  if (access.kind === "signed-out") return json({ ok: false, error: "Sign in is required." }, 401);
  if (!isTrustedSameOriginRequest(request)) return json({ ok: false, error: "Cross-origin changes are not accepted." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "The change could not be read." }, 400);
  }

  const action = String(body.action ?? "").trim();
  if (!portalTeamActions.includes(action as PortalTeamAction)) {
    return json({ ok: false, error: "Unknown action." }, 400);
  }

  const result = await applyPortalTeamChange({
    action: action as PortalTeamAction,
    customerId: access.session.customerId,
    customerName: access.session.customerName,
    actorRole: access.session.role,
    actorEmail: access.session.email,
    targetEmail: String(body.email ?? ""),
  });

  if (result.kind === "denied") {
    const status = result.decision.reason === "not_owner" ? 403 : result.decision.reason === "limit_reached" ? 409 : 400;
    return json({ ok: false, error: portalTeamDenialMessages[result.decision.reason] }, status);
  }
  if (result.kind === "staff_email") {
    return json({ ok: false, error: "That address is a KCPL staff account and cannot be given customer access." }, 409);
  }
  if (result.kind === "unavailable") {
    return json({ ok: false, error: "The change could not be saved. Please try again." }, 503);
  }

  if (action !== "invite") return json({ ok: true, email: result.email });

  // The account record grants scope; the invite is what lets the person prove
  // the address is theirs. A failed invite leaves a provisioned but unusable
  // login rather than a usable one, so it is reported rather than swallowed.
  const invite = await createPortalInvite(result.email, access.session.customerName);
  if (invite.kind === "invalid" || invite.kind === "unavailable") {
    return json({
      ok: true,
      email: result.email,
      delivered: false,
      warning: "The login was created, but the invitation could not be sent. Ask your KCPL account manager to resend it.",
    });
  }
  // When no mail provider is configured the link is returned once, for the
  // account owner to pass on through their own channel.
  return json({
    ok: true,
    email: result.email,
    delivered: invite.kind === "sent",
    link: invite.kind === "link" ? invite.link : null,
  });
}
