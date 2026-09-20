"use client";

import { useState } from "react";
import { BellRing, Mail, ShieldCheck } from "lucide-react";
import {
  OpsDetailGrid,
  OpsDetailItem,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsSurface,
} from "../../admin/operations-ui";
import {
  portalNotificationTopicHints,
  portalNotificationTopicLabels,
  portalNotificationTopics,
  type PortalNotificationPreferences,
} from "../portal-notifications";
import { portalRoleLabels, type PortalRole } from "../portal-access-policy";
import type { PortalTeamMember } from "../portal-accounts.server";
import { PortalTeamPanel } from "./portal-team-panel";

export function PortalSettingsWorkspace({
  email,
  customerName,
  role,
  initialPreferences,
  emailConfigured,
  team,
}: {
  email: string;
  customerName: string;
  role: PortalRole;
  initialPreferences: PortalNotificationPreferences;
  emailConfigured: boolean;
  /** Null for anyone who is not an account owner. */
  team: PortalTeamMember[] | null;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function save(next: PortalNotificationPreferences) {
    const previous = preferences;
    setPreferences(next);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/portal/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The change could not be saved.");
      setNotice("Your notification settings have been saved.");
    } catch (reason) {
      // Put the switch back where it was: a toggle that stays flipped after a
      // failed save is a lie about what KCPL will send.
      setPreferences(previous);
      setError(reason instanceof Error ? reason.message : "The change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Kapileshwor Cargo"
        title="Account settings"
        description="Choose what KCPL emails you about, and manage the logins on this account."
      />
      <div className="ops-content">
        <div className="ops-stack portal-stack">
          {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
          {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

          {!emailConfigured ? (
            <OpsNotice tone="warning">
              KCPL has not finished setting up outgoing email, so notifications are not being sent yet. Your choices here are saved and will apply once it is switched on.
            </OpsNotice>
          ) : null}

          <OpsSurface
            eyebrow="Email"
            title="What we send you"
            description="Milestones are sent as they happen, not as a digest."
          >
            <ul className="portal-toggle-list">
              {portalNotificationTopics.map((topic) => (
                <li key={topic}>
                  <span className="portal-toggle-main">
                    <strong>{portalNotificationTopicLabels[topic]}</strong>
                    <span>{portalNotificationTopicHints[topic]}</span>
                  </span>
                  <label className="portal-toggle" htmlFor={`topic-${topic}`}>
                    <input
                      id={`topic-${topic}`}
                      type="checkbox"
                      checked={preferences[topic]}
                      disabled={busy}
                      onChange={(event) => void save({ ...preferences, [topic]: event.target.checked })}
                    />
                    <span>{preferences[topic] ? "On" : "Off"}</span>
                  </label>
                </li>
              ))}
            </ul>
          </OpsSurface>

          {team ? <PortalTeamPanel initialTeam={team} currentEmail={email}/> : null}

          <OpsSurface eyebrow="Account" title="Your login">
            <OpsDetailGrid columns={3}>
              <OpsDetailItem label="Signed in as">{email}</OpsDetailItem>
              <OpsDetailItem label="Account">{customerName}</OpsDetailItem>
              <OpsDetailItem label="Access level">{portalRoleLabels[role]}</OpsDetailItem>
            </OpsDetailGrid>
            <p className="portal-footnote">
              <ShieldCheck size={14} aria-hidden="true"/> Your KCPL account manager provisions and removes portal logins. Contact them to add a
              colleague or change what this login can see.
            </p>
          </OpsSurface>

          <p className="portal-footnote">
            <Mail size={14} aria-hidden="true"/> Notification emails come from KCPL and always link back to this portal.
            <BellRing size={14} aria-hidden="true"/> Turning a topic off stops future emails; it does not hide anything from the portal itself.
          </p>
        </div>
      </div>
    </OpsPage>
  );
}
