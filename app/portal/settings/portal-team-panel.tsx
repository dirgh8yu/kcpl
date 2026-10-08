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
import { PORTAL_TEAM_MEMBER_LIMIT } from "../portal-access-policy";
import { portalTranslator, type PortalLocale } from "../portal-i18n";
import type { PortalTeamMember } from "../portal-accounts.server";
import { portalDate } from "../portal-format";

export function PortalTeamPanel({
  initialTeam,
  currentEmail,
  locale,
}: {
  initialTeam: PortalTeamMember[];
  currentEmail: string;
  locale: PortalLocale;
}) {
  const t = portalTranslator(locale);
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
    if (!response.ok || !data.ok) throw new Error(data.error || t("team.save_failed"));
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
        setNotice(t("team.invited", { email: email.trim().toLowerCase() }));
      } else {
        setNotice(t("team.link_ready", { email: email.trim().toLowerCase() }));
        setInviteLink(data.link ?? "");
      }
      setEmail("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("team.invite_failed"));
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
      setError(reason instanceof Error ? reason.message : t("team.save_failed"));
    } finally {
      setBusy("");
    }
  }

  return (
    <OpsSurface title={t("team.title")} description={t("team.description")}>
      <div className="portal-exchange">
        {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
        {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
        {inviteLink ? <OpsNotice tone="warning" onDismiss={() => setInviteLink("")}><OpsMono>{inviteLink}</OpsMono></OpsNotice> : null}

        <form onSubmit={invite} className="portal-exchange-free" aria-busy={busy === "invite"}>
          <OpsField
            label={t("team.email_label")}
            hint={atLimit ? t("team.at_limit") : t("team.email_hint")}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("team.email_placeholder")}
              disabled={busy === "invite" || atLimit}
            />
          </OpsField>
          <OpsButton type="submit" variant="primary" size="sm" disabled={busy === "invite" || atLimit}>
            <UserPlus size={14} strokeWidth={1.75} aria-hidden="true"/>
            <span>{busy === "invite" ? t("team.inviting") : t("team.invite")}</span>
          </OpsButton>
        </form>

        {team.length ? (
          <OpsTableWrap>
            <table className="ops-table ops-register-table portal-stack-table">
              <thead>
                <tr>
                  <th>{t("team.col_login")}</th>
                  <th>{t("team.col_access")}</th>
                  <th>{t("team.col_state")}</th>
                  <th>{t("team.col_last_signed_in")}</th>
                  <th><span className="portal-sr-only">{t("team.col_actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => {
                  const isYou = member.email === currentEmail;
                  return (
                    <tr key={member.email}>
                      <td data-cell="primary">
                        <OpsMono>{member.email}</OpsMono>
                        {isYou ? <span className="portal-cell-detail">{t("team.this_is_you")}</span> : null}
                        {member.linked ? <span className="portal-cell-detail">{t("team.linked")}</span> : null}
                      </td>
                      <td data-cell="meta" data-label={t("team.col_access")}>{t(`role.${member.role}`)}</td>
                      <td data-cell="status">
                        <OpsBadge tone={member.active ? "success" : "neutral"} dot>{member.active ? t("team.active") : t("team.disabled")}</OpsBadge>
                      </td>
                      {/* One answer to "have they signed in": the date when it
                          is known, "not yet" when it never happened. */}
                      <td data-cell="meta" data-label={t("team.col_last_signed_in")}>
                        {member.last_sign_in_at ? portalDate(member.last_sign_in_at) : member.bound ? t("common.none") : t("team.never_signed_in")}
                      </td>
                      <td data-cell="action">
                        {member.role === "member" && !isYou && !member.linked ? (
                          <OpsButton
                            size="sm"
                            variant={member.active ? "danger" : "secondary"}
                            disabled={busy === member.email}
                            onClick={() => toggle(member)}
                          >
                            {member.active ? t("team.disable") : t("team.enable")}
                          </OpsButton>
                        ) : isYou ? null : (
                          <span className="portal-cell-detail">{t("team.managed_by_kcpl")}</span>
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
            title={t("team.empty_title")}
            description={t("team.empty_description")}
          />
        )}
      </div>
    </OpsSurface>
  );
}
