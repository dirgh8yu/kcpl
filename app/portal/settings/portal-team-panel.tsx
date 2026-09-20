"use client";

import { useState, type FormEvent } from "react";
import { UserPlus, Users2 } from "lucide-react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsField,
  OpsMono,
  OpsNotice,
  OpsSurface,
  OpsTableWrap,
} from "../../admin/operations-ui";
import { PORTAL_TEAM_MEMBER_LIMIT, portalRoleLabels } from "../portal-access-policy";
import type { PortalTeamMember } from "../portal-accounts.server";
import { portalDate } from "../portal-format";

export function PortalTeamPanel({
  initialTeam,
  currentEmail,
}: {
  initialTeam: PortalTeamMember[];
  currentEmail: string;
}) {
  const [team, setTeam] = useState(initialTeam);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  const activeMembers = team.filter((member) => member.role === "member" && member.active).length;
  const atLimit = activeMembers >= PORTAL_TEAM_MEMBER_LIMIT;

  async function refresh() {
    const response = await fetch("/api/portal/team", { cache: "no-store" });
    const data = await response.json() as { ok?: boolean; team?: PortalTeamMember[] };
    if (data.ok && data.team) setTeam(data.team);
  }

  async function send(action: string, targetEmail: string) {
    const response = await fetch("/api/portal/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, email: targetEmail }),
    });
    const data = await response.json() as {
      ok?: boolean; error?: string; delivered?: boolean; link?: string | null; warning?: string;
    };
    if (!response.ok || !data.ok) throw new Error(data.error || "The change could not be saved.");
    return data;
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("invite");
    setError("");
    setNotice("");
    setInviteLink("");
    try {
      const data = await send("invite", email);
      if (data.warning) {
        setNotice(data.warning);
      } else if (data.delivered) {
        setNotice(`An invitation has been emailed to ${email.trim().toLowerCase()}.`);
      } else {
        setNotice(`Send this one-time link to ${email.trim().toLowerCase()} so they can set a password.`);
        setInviteLink(data.link ?? "");
      }
      setEmail("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The invitation could not be sent.");
    } finally {
      setBusy("");
    }
  }

  async function toggle(member: PortalTeamMember) {
    if (busy) return;
    setBusy(member.email);
    setError("");
    setNotice("");
    setInviteLink("");
    try {
      await send(member.active ? "disable" : "enable", member.email);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The change could not be saved.");
    } finally {
      setBusy("");
    }
  }

  return (
    <OpsSurface
      eyebrow="Access"
      title="Your team"
      description={`Give a colleague their own login to this account. Team members see shipments and documents; invoices and new requests stay with account owners. Up to ${PORTAL_TEAM_MEMBER_LIMIT} team logins.`}
    >
      <div className="portal-exchange">
        {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
        {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
        {inviteLink ? <OpsNotice tone="warning" onDismiss={() => setInviteLink("")}><OpsMono>{inviteLink}</OpsMono></OpsNotice> : null}

        <form onSubmit={invite} className="portal-exchange-free" aria-busy={busy === "invite"}>
          <OpsField
            label="Colleague's email"
            hint={atLimit ? "This account has reached its team login limit." : "They will be emailed a link to set their own password."}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="colleague@company.com"
              disabled={busy === "invite" || atLimit}
            />
          </OpsField>
          <OpsButton type="submit" variant="primary" size="sm" disabled={busy === "invite" || atLimit}>
            <UserPlus size={14} strokeWidth={1.75} aria-hidden="true"/>
            <span>{busy === "invite" ? "Inviting…" : "Invite"}</span>
          </OpsButton>
        </form>

        {team.length ? (
          <OpsTableWrap>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Login</th>
                  <th>Access</th>
                  <th>State</th>
                  <th>Last signed in</th>
                  <th><span className="portal-sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => {
                  const isYou = member.email === currentEmail;
                  return (
                    <tr key={member.email}>
                      <td>
                        <OpsMono>{member.email}</OpsMono>
                        {isYou ? <span className="portal-cell-detail">This is you</span> : null}
                      </td>
                      <td>{portalRoleLabels[member.role]}</td>
                      <td>
                        <OpsBadge tone={member.active ? "success" : "neutral"} dot>{member.active ? "Active" : "Disabled"}</OpsBadge>
                        <span className="portal-cell-detail">{member.bound ? "Signed in before" : "Not signed in yet"}</span>
                      </td>
                      <td>{member.last_sign_in_at ? portalDate(member.last_sign_in_at) : "—"}</td>
                      <td>
                        {member.role === "member" && !isYou ? (
                          <OpsButton
                            size="sm"
                            variant={member.active ? "danger" : "secondary"}
                            disabled={busy === member.email}
                            onClick={() => toggle(member)}
                          >
                            {member.active ? "Disable" : "Enable"}
                          </OpsButton>
                        ) : (
                          <span className="portal-cell-detail">Managed by KCPL</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </OpsTableWrap>
        ) : (
          <OpsEmptyState
            compact
            kind="setup"
            icon={<Users2 size={18}/>}
            title="No other logins yet"
            description="Invite a colleague above so they can track shipments without going through you."
          />
        )}
      </div>
    </OpsSurface>
  );
}
