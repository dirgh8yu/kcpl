import type { PortalSession } from "./portal-auth";
import { applyPortalTeamChange, listPortalTeam } from "./portal-accounts.server";
import { createPortalInvite } from "./portal-invites.server";
import { portalTeamActions, portalTeamDenialMessages, type PortalTeamAction } from "./portal-access-policy";
import { portalWriteRefused, type PortalWriteResult } from "./portal-intake";

/*
 * Customer-managed team logins, from the web portal or the KCPL app.
 *
 * An account owner adding a colleague is the phone call to KCPL this exists to
 * remove. Everything that decides *whether* a change is allowed is
 * `decidePortalTeamChange`, a pure function with its own tests; this module
 * supplies the session facts and nothing else. In particular the customer id
 * is always the session's, so there is no request field through which an owner
 * could reach another customer's logins.
 */

export async function portalTeamView(session: PortalSession): Promise<PortalWriteResult> {
  if (session.role !== "owner") return portalWriteRefused(403, "forbidden", portalTeamDenialMessages.not_owner);
  const team = await listPortalTeam(session.customerId);
  if (!team) return portalWriteRefused(503, "unavailable", "Team logins could not be loaded.");
  return { status: 200, body: { ok: true, team } };
}

export async function changePortalTeam(session: PortalSession, body: Record<string, unknown>): Promise<PortalWriteResult> {
  const action = String(body.action ?? "").trim();
  if (!portalTeamActions.includes(action as PortalTeamAction)) return portalWriteRefused(400, "invalid", "Unknown action.");

  const result = await applyPortalTeamChange({
    action: action as PortalTeamAction,
    customerId: session.customerId,
    customerName: session.customerName,
    actorRole: session.role,
    actorEmail: session.email,
    targetEmail: String(body.email ?? ""),
  });

  if (result.kind === "denied") {
    const reason = result.decision.reason;
    const status = reason === "not_owner" ? 403 : reason === "limit_reached" ? 409 : 400;
    const code = reason === "not_owner" ? "forbidden" : reason === "limit_reached" ? "conflict" : "invalid";
    return portalWriteRefused(status, code, portalTeamDenialMessages[reason], { reason });
  }
  if (result.kind === "staff_email") {
    return portalWriteRefused(409, "conflict", "That address is a KCPL staff account and cannot be given customer access.");
  }
  if (result.kind === "unavailable") return portalWriteRefused(503, "unavailable", "The change could not be saved. Please try again.");

  if (action !== "invite") return { status: 200, body: { ok: true, email: result.email } };

  // The account record grants scope; the invite is what lets the person prove
  // the address is theirs. A failed invite leaves a provisioned but unusable
  // login rather than a usable one, so it is reported rather than swallowed.
  const invite = await createPortalInvite(result.email, session.customerName);
  if (invite.kind === "invalid" || invite.kind === "unavailable") {
    return {
      status: 200,
      body: {
        ok: true,
        email: result.email,
        delivered: false,
        warning: "The login was created, but the invitation could not be sent. Ask your KCPL account manager to resend it.",
      },
    };
  }
  // When no mail provider is configured the link is returned once, for the
  // account owner to pass on through their own channel.
  return {
    status: 200,
    body: { ok: true, email: result.email, delivered: invite.kind === "sent", link: invite.kind === "link" ? invite.link : null },
  };
}
