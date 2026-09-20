"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlarmClock } from "lucide-react";
import { OpsBadge, OpsButton, OpsField, OpsNotice, OpsSurface } from "../../operations-ui";
import {
  freeTimeBearerLabels,
  freeTimeBearers,
  freeTimeSummary,
  type FreeTimeStatus,
  type ShipmentFreeTime,
} from "../../../shipment-free-time";

/*
 * Free time on the Job File.
 *
 * The Job File page reads the free-time block server-side and hands it in, so
 * the panel renders with data rather than fetching on mount. Saving goes
 * through its own namespaced route, which writes free-time fields and nothing
 * else -- recording a demurrage clock cannot disturb shipment state.
 */

export type FreeTimePanelData = {
  freeTime: ShipmentFreeTime;
  status: FreeTimeStatus;
};

const stateTones: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  not_set: "neutral",
  running: "success",
  last_day: "warning",
  expired: "danger",
};

export function FreeTimeControl({
  reference,
  initial,
  canEdit,
}: {
  reference: string;
  initial: FreeTimePanelData | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const freeTime = initial?.freeTime ?? null;
  const status = initial?.status ?? null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(reference)}/free-time`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location: form.get("location"),
          days: form.get("days"),
          startedOn: form.get("startedOn"),
          dailyCharge: form.get("dailyCharge"),
          chargeCurrency: form.get("chargeCurrency"),
          bearer: form.get("bearer"),
          note: form.get("note"),
        }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The free-time record could not be saved.");
      setNotice("Free time saved. The customer sees this countdown in their portal.");
      setOpen(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The free-time record could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsSurface
      id="shipment-free-time"
      eyebrow="Demurrage clock"
      title="Free time"
      description="What the carrier or terminal granted. The customer sees this as a countdown."
      priority={status?.state === "expired" ? "danger" : status?.state === "last_day" ? "warning" : "normal"}
      action={canEdit ? <OpsButton variant="secondary" size="sm" onClick={() => setOpen((value) => !value)}>{open ? "Close" : freeTime?.days === null ? "Record" : "Edit"}</OpsButton> : undefined}
    >
      {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

      {freeTime && status ? (
        <div className="portal-exchange">
          <div className="portal-checklist">
            <div className="portal-checklist-main">
              <strong>{freeTimeSummary(freeTime, status)}</strong>
              <span>
                {status.deadline ? `Last free day ${status.deadline}` : "No allowance recorded"}
                {freeTime.daily_charge !== null ? ` · ${freeTime.charge_currency ?? ""} ${freeTime.daily_charge}/day after` : ""}
                {status.projectedCharge !== null ? ` · ${freeTime.charge_currency ?? ""} ${status.projectedCharge} accrued` : ""}
              </span>
            </div>
            <OpsBadge tone={stateTones[status.state] ?? "neutral"} dot>
              {status.state === "not_set" ? "Not recorded" : status.state === "expired" ? "Expired" : status.state === "last_day" ? "Last day" : `${status.daysRemaining} days left`}
            </OpsBadge>
          </div>
          {freeTime.days !== null ? (
            <p className="portal-footnote">
              Charges after expiry: {freeTimeBearerLabels[freeTime.bearer]}
              {freeTime.note ? ` · ${freeTime.note}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {open && canEdit ? (
        <form onSubmit={save} className="portal-form" aria-busy={busy}>
          <div className="portal-form-grid">
            <OpsField label="Location" hint="Where the clock runs, e.g. Kolkata port or Birgunj ICD.">
              <input name="location" defaultValue={freeTime?.location ?? ""} placeholder="Birgunj ICD"/>
            </OpsField>
            <OpsField label="Free days" hint="Leave both this and the start date empty to clear.">
              <input name="days" inputMode="numeric" defaultValue={freeTime?.days ?? ""} placeholder="7"/>
            </OpsField>
            <OpsField label="Clock started" hint="Discharge, gate-in or as agreed.">
              <input name="startedOn" type="date" defaultValue={freeTime?.started_on ?? ""}/>
            </OpsField>
            <OpsField label="Daily charge after expiry">
              <input name="dailyCharge" inputMode="decimal" defaultValue={freeTime?.daily_charge ?? ""} placeholder="45"/>
            </OpsField>
            <OpsField label="Currency">
              <input name="chargeCurrency" maxLength={3} defaultValue={freeTime?.charge_currency ?? ""} placeholder="USD"/>
            </OpsField>
            <OpsField label="Who bears the charge">
              <select name="bearer" defaultValue={freeTime?.bearer ?? "undecided"}>
                {freeTimeBearers.map((bearer) => <option key={bearer} value={bearer}>{freeTimeBearerLabels[bearer]}</option>)}
              </select>
            </OpsField>
          </div>
          <OpsField label="Note" hint="Internal. Not shown to the customer.">
            <textarea name="note" defaultValue={freeTime?.note ?? ""} placeholder="Carrier granted 7 days from discharge; extension requested."/>
          </OpsField>
          <div className="portal-form-actions">
            <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>
              <AlarmClock size={14} strokeWidth={1.75} aria-hidden="true"/>
              <span>{busy ? "Saving…" : "Save free time"}</span>
            </OpsButton>
          </div>
        </form>
      ) : null}
    </OpsSurface>
  );
}
