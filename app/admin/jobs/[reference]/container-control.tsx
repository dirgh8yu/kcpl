"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Container, Plus, Trash2 } from "lucide-react";
import { OpsBadge, OpsButton, OpsField, OpsMono, OpsNotice, OpsSurface } from "../../operations-ui";
import { freeTimeBearerLabels, freeTimeBearers } from "../../../shipment-free-time";
import {
  containerDetention,
  containerSizeTypeLabels,
  containerSizeTypes,
  containerStage,
  containersSummary,
  type ShipmentContainer,
} from "../../../shipment-containers";

/*
 * Containers on the Job File: the boxes, when each left the port, and when
 * its empty went back. Detention runs per container from gate-out, so a
 * shipment of ten boxes shows which ones are costing money.
 */

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(`${value}T00:00:00`));
}

function detentionLine(container: ShipmentContainer, today: string) {
  const status = containerDetention(container, today);
  const stage = containerStage(container);
  if (status.state === "not_set") return { tone: "neutral" as const, badge: stage === "at_port" ? "At the port" : "No detention terms", detail: stage === "at_port" ? "Detention starts when it leaves the port." : "Record the line’s free days to count detention." };
  const charge = status.projectedCharge !== null ? ` · ${container.detention_currency ?? ""} ${status.projectedCharge}`.trimEnd() : "";
  if (stage === "returned") return status.daysOverdue > 0
    ? { tone: "danger" as const, badge: `${status.daysOverdue} day${status.daysOverdue === 1 ? "" : "s"} detention`, detail: `Empty back ${dateLabel(container.empty_returned_on)}, after the last free day ${dateLabel(status.deadline)}${charge}` }
    : { tone: "success" as const, badge: "Returned in time", detail: `Empty back ${dateLabel(container.empty_returned_on)}` };
  if (status.state === "expired") return { tone: "danger" as const, badge: `${status.daysOverdue} day${status.daysOverdue === 1 ? "" : "s"} over`, detail: `Last free day was ${dateLabel(status.deadline)}${charge}, rising daily until the empty is back` };
  if (status.state === "last_day") return { tone: "warning" as const, badge: "Last free day", detail: `Return the empty today to avoid detention` };
  return { tone: status.daysRemaining <= 2 ? "warning" as const : "info" as const, badge: `${status.daysRemaining} day${status.daysRemaining === 1 ? "" : "s"} left`, detail: `Last free day ${dateLabel(status.deadline)}` };
}

async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) {
  const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; added?: string[]; skipped?: number };
  if (!response.ok || !data.ok) throw new Error(data.error || "That didn’t save. Try again.");
  return data;
}

export function ContainerControl({ reference, initial, canEdit, today }: { reference: string; initial: ShipmentContainer[] | null; canEdit: boolean; today: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const containers = initial ?? [];
  const summary = containersSummary(containers, today);
  const base = `/api/admin/jobs/${encodeURIComponent(reference)}/containers`;
  const terms = containers.find((item) => item.detention_free_days !== null) ?? null;

  async function run(action: () => Promise<string>) {
    setBusy(true); setNotice(null);
    try { setNotice({ text: await action(), tone: "success" }); router.refresh(); return true; }
    catch (error) { setNotice({ text: error instanceof Error ? error.message : "That didn’t save. Try again.", tone: "danger" }); return false; }
    finally { setBusy(false); }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const ok = await run(async () => {
      const data = await send(base, "POST", form);
      const added = data.added?.length ?? 0;
      return `${added} container${added === 1 ? "" : "s"} added${data.skipped ? `, ${data.skipped} already on this shipment` : ""}.`;
    });
    if (ok) setAdding(false);
  }

  async function save(event: FormEvent<HTMLFormElement>, container: ShipmentContainer) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { ...Object.fromEntries(form), applyTermsToAll: form.get("applyTermsToAll") === "on" };
    const ok = await run(async () => { await send(`${base}/${encodeURIComponent(container.id)}`, "PATCH", body); return `${container.number} saved.`; });
    if (ok) setEditing(null);
  }

  async function remove(container: ShipmentContainer) {
    if (!window.confirm(`Remove ${container.number} from this shipment?`)) return;
    await run(async () => { await send(`${base}/${encodeURIComponent(container.id)}`, "DELETE"); return `${container.number} removed.`; });
  }

  const description = containers.length
    ? [`${summary.total} container${summary.total === 1 ? "" : "s"}`, summary.out ? `${summary.out} out, empty not back` : "", summary.returned ? `${summary.returned} returned` : ""].filter(Boolean).join(" · ")
    : undefined;

  return (
    <OpsSurface
      id="shipment-containers"
      title="Containers"
      description={description}
      priority={summary.overdue ? "danger" : summary.dueSoon ? "warning" : "normal"}
      action={canEdit ? <OpsButton variant="secondary" size="xs" onClick={() => setAdding((value) => !value)} aria-expanded={adding}><Plus size={13} strokeWidth={1.75} aria-hidden="true"/>{adding ? "Close" : "Add"}</OpsButton> : undefined}
    >
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
      {summary.overdue ? <OpsNotice tone="danger">{summary.overdue} container{summary.overdue === 1 ? " is" : "s are"} past detention free time{summary.charges.length ? `: ${summary.charges.map((item) => `${item.currency} ${item.total}`).join(" + ")} so far` : ""}. Get the empties back to the depot.</OpsNotice> : null}

      {adding && canEdit ? <form onSubmit={add} className="portal-form" aria-busy={busy}>
        <OpsField label="Container numbers" hint="One per line, as on the bill of lading. The check digit is checked.">
          <textarea name="numbers" required rows={3} placeholder={"MSKU9070323\nTGHU1234567"} autoCapitalize="characters" spellCheck={false}/>
        </OpsField>
        <div className="portal-form-grid">
          <OpsField label="Size and type"><select name="sizeType" defaultValue="40HC">{containerSizeTypes.map((type) => <option key={type} value={type}>{containerSizeTypeLabels[type]}</option>)}</select></OpsField>
          <OpsField label="Detention free days" hint="Given by the line from gate-out"><input name="freeDays" inputMode="numeric" defaultValue={terms?.detention_free_days ?? ""} placeholder="14"/></OpsField>
          <OpsField label="Charge per day after"><input name="dailyRate" inputMode="decimal" defaultValue={terms?.detention_daily_rate ?? ""} placeholder="40"/></OpsField>
          <OpsField label="Currency"><input name="currency" maxLength={3} defaultValue={terms?.detention_currency ?? "USD"} placeholder="USD"/></OpsField>
          <OpsField label="Empty return depot"><input name="returnDepot" defaultValue={terms?.return_depot ?? ""} placeholder="Birgunj ICD empty yard"/></OpsField>
          <OpsField label="Who bears detention"><select name="bearer" defaultValue={terms?.detention_bearer ?? "customer"}>{freeTimeBearers.map((bearer) => <option key={bearer} value={bearer}>{freeTimeBearerLabels[bearer]}</option>)}</select></OpsField>
        </div>
        <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}><Container size={14} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Adding…" : "Add containers"}</OpsButton></div>
      </form> : null}

      {containers.length ? <ul className="job-container-list">
        {containers.map((container) => {
          const line = detentionLine(container, today);
          const open = editing === container.id;
          return <li key={container.id} className="job-container">
            <div className="job-container-head">
              <div className="min-w-0">
                <p className="job-container-number"><OpsMono>{container.number}</OpsMono> <span>{containerSizeTypeLabels[container.size_type]}{container.seal_number ? ` · seal ${container.seal_number}` : ""}</span></p>
                <p className="job-container-dates">Out {dateLabel(container.gated_out_on)} · Delivered {dateLabel(container.delivered_on)} · Empty back {dateLabel(container.empty_returned_on)}</p>
                <p className="job-container-dates">{line.detail}</p>
              </div>
              <div className="job-container-actions">
                <OpsBadge tone={line.tone} dot>{line.badge}</OpsBadge>
                {canEdit ? <OpsButton variant="ghost" size="xs" onClick={() => setEditing(open ? null : container.id)} aria-expanded={open}>{open ? "Close" : "Update"}</OpsButton> : null}
              </div>
            </div>
            {open && canEdit ? <form onSubmit={(event) => save(event, container)} className="portal-form" aria-busy={busy}>
              <div className="portal-form-grid">
                <OpsField label="Left the port full"><input type="date" name="gatedOutOn" max={today} defaultValue={container.gated_out_on ?? ""}/></OpsField>
                <OpsField label="Delivered"><input type="date" name="deliveredOn" max={today} defaultValue={container.delivered_on ?? ""}/></OpsField>
                <OpsField label="Empty returned"><input type="date" name="emptyReturnedOn" max={today} defaultValue={container.empty_returned_on ?? ""}/></OpsField>
                <OpsField label="Size and type"><select name="sizeType" defaultValue={container.size_type}>{containerSizeTypes.map((type) => <option key={type} value={type}>{containerSizeTypeLabels[type]}</option>)}</select></OpsField>
                <OpsField label="Seal number"><input name="sealNumber" defaultValue={container.seal_number ?? ""}/></OpsField>
                <OpsField label="Empty return depot"><input name="returnDepot" defaultValue={container.return_depot ?? ""}/></OpsField>
                <OpsField label="Detention free days"><input name="freeDays" inputMode="numeric" defaultValue={container.detention_free_days ?? ""}/></OpsField>
                <OpsField label="Charge per day after"><input name="dailyRate" inputMode="decimal" defaultValue={container.detention_daily_rate ?? ""}/></OpsField>
                <OpsField label="Currency"><input name="currency" maxLength={3} defaultValue={container.detention_currency ?? ""}/></OpsField>
                <OpsField label="Who bears detention"><select name="bearer" defaultValue={container.detention_bearer}>{freeTimeBearers.map((bearer) => <option key={bearer} value={bearer}>{freeTimeBearerLabels[bearer]}</option>)}</select></OpsField>
              </div>
              <OpsField label="Note" hint="Internal"><input name="note" maxLength={300} defaultValue={container.note ?? ""}/></OpsField>
              {containers.length > 1 ? <label className="job-container-all"><input type="checkbox" name="applyTermsToAll"/>Use these detention terms and depot for every container on this shipment</label> : null}
              <div className="portal-form-actions">
                {!container.gated_out_on ? <OpsButton type="button" variant="ghost" size="sm" disabled={busy} onClick={() => remove(container)}><Trash2 size={13} aria-hidden="true"/>Remove</OpsButton> : null}
                <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Saving…" : "Save"}</OpsButton>
              </div>
            </form> : null}
          </li>;
        })}
      </ul> : <p className="portal-footnote m-0">No containers recorded{canEdit ? ". Add them from the bill of lading to track the empties and detention." : "."}</p>}
    </OpsSurface>
  );
}
