"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import type { KcplBranch } from "../../crm/crm-data";
import {
  shipmentExceptionCategories,
  shipmentExceptionCategoryLabels,
  shipmentExceptionIsOverdue,
  shipmentExceptionSeverities,
  shipmentExceptionSeverityLabels,
  shipmentExceptionStatusLabels,
  summarizeShipmentExceptions,
  type ShipmentException,
  type ShipmentExceptionCategory,
  type ShipmentExceptionSeverity,
  type ShipmentExceptionStatus,
  type ShipmentExceptionSummary,
} from "../../shipment-exceptions";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsStat, OpsStatStrip, OpsSurface } from "../../operations-ui";

type ApiResponse = {
  ok: boolean;
  error?: string;
  exceptions?: ShipmentException[];
  exception?: ShipmentException;
  summary?: ShipmentExceptionSummary;
  generated_at?: string;
};

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(date);
}

function severityTone(severity: ShipmentExceptionSeverity) {
  if (severity === "critical") return "danger" as const;
  if (severity === "high") return "warning" as const;
  if (severity === "medium") return "info" as const;
  return "neutral" as const;
}

function statusTone(status: ShipmentExceptionStatus) {
  if (status === "resolved") return "success" as const;
  if (status === "monitoring") return "violet" as const;
  return "warning" as const;
}

export function ShipmentExceptionControl({
  reference,
  branches,
  initialExceptions,
  initialSummary,
  currentUserName,
  currentUserEmail,
}: {
  reference: string;
  branches: KcplBranch[];
  initialExceptions: ShipmentException[];
  initialSummary: ShipmentExceptionSummary;
  currentUserName: string;
  currentUserEmail: string;
}) {
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [summary, setSummary] = useState(initialSummary);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);
  const [resolutionFor, setResolutionFor] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [category, setCategory] = useState<ShipmentExceptionCategory>("delay");
  const [severity, setSeverity] = useState<ShipmentExceptionSeverity>("medium");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [impact, setImpact] = useState("");
  const [branch, setBranch] = useState<KcplBranch>(branches[0]);
  const [ownerName, setOwnerName] = useState(currentUserName);
  const [ownerEmail, setOwnerEmail] = useState(currentUserEmail);
  const nowIso = new Date().toISOString();

  const ordered = useMemo(() => [...exceptions].sort((a, b) => {
    if (a.status === "resolved" && b.status !== "resolved") return 1;
    if (a.status !== "resolved" && b.status === "resolved") return -1;
    const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    if (rank[a.severity] !== rank[b.severity]) return rank[b.severity] - rank[a.severity];
    return b.opened_at.localeCompare(a.opened_at);
  }), [exceptions]);

  async function refresh() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(reference)}/exceptions`, { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.exceptions) throw new Error(data.error || "Exception cases could not be refreshed.");
      setExceptions(data.exceptions);
      setSummary(data.summary ?? summarizeShipmentExceptions(data.exceptions, new Date().toISOString()));
      setNotice({ tone: "success", text: "Exception cases refreshed." });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Exception cases could not be refreshed." });
    } finally {
      setBusy(false);
    }
  }

  async function createException(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(reference)}/exceptions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, severity, title, detail, operationalImpact: impact, branch, assignedToName: ownerName, assignedToEmail: ownerEmail }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.exception) throw new Error(data.error || "Exception case could not be created.");
      const next = [data.exception, ...exceptions];
      setExceptions(next);
      setSummary(summarizeShipmentExceptions(next, new Date().toISOString()));
      setTitle("");
      setDetail("");
      setImpact("");
      setSeverity("medium");
      setCategory("delay");
      setShowForm(false);
      setNotice({ tone: "success", text: "Exception case opened and added to the Job File audit trail." });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Exception case could not be created." });
    } finally {
      setBusy(false);
    }
  }

  async function updateException(item: ShipmentException, status: ShipmentExceptionStatus, resolutionText = "") {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(reference)}/exceptions`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exceptionId: item.id,
          status,
          assignedToName: item.assigned_to_name ?? "",
          assignedToEmail: item.assigned_to_email ?? "",
          resolution: resolutionText,
        }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.exception) throw new Error(data.error || "Exception case could not be updated.");
      const next = exceptions.map((existing) => existing.id === item.id ? data.exception! : existing);
      setExceptions(next);
      setSummary(summarizeShipmentExceptions(next, new Date().toISOString()));
      setResolutionFor(null);
      setResolution("");
      setNotice({ tone: "success", text: status === "resolved" ? "Exception resolved with outcome recorded." : "Exception state updated." });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Exception case could not be updated." });
    } finally {
      setBusy(false);
    }
  }

  const priority = summary.critical_open > 0 ? "danger" : summary.high_open > 0 || summary.overdue_open > 0 ? "warning" : "normal";

  return (
    <OpsSurface
      eyebrow="Exception control"
      title="Shipment exceptions & incidents"
      description="Create accountable cases for delay, customs, cargo, carrier and delivery problems. SLA timing and resolution evidence are controlled by the server."
      priority={priority}
      action={<div className="flex flex-wrap gap-2"><OpsButton size="sm" onClick={refresh} disabled={busy}><RefreshCw size={13}/> Refresh</OpsButton><OpsButton size="sm" variant="primary" onClick={() => setShowForm((value) => !value)}><Plus size={13}/> Open exception</OpsButton></div>}
    >
      <div className="space-y-4">
        <OpsStatStrip>
          <OpsStat label="Open" value={summary.open} tone={summary.open ? "warning" : "neutral"} icon={<AlertTriangle size={13}/>}/>
          <OpsStat label="Critical" value={summary.critical_open} tone={summary.critical_open ? "danger" : "neutral"} icon={<ShieldAlert size={13}/>}/>
          <OpsStat label="Overdue SLA" value={summary.overdue_open} tone={summary.overdue_open ? "danger" : "neutral"} icon={<Clock3 size={13}/>}/>
          <OpsStat label="Resolved" value={summary.resolved} tone="success" icon={<CheckCircle2 size={13}/>}/>
        </OpsStatStrip>

        {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}

        {showForm ? (
          <form onSubmit={createException} className="rounded-[13px] border border-[#eadfd5] bg-[#fffaf5] p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <OpsField label="Category"><select value={category} onChange={(event) => setCategory(event.target.value as ShipmentExceptionCategory)}>{shipmentExceptionCategories.map((value) => <option key={value} value={value}>{shipmentExceptionCategoryLabels[value]}</option>)}</select></OpsField>
              <OpsField label="Severity" hint={severity === "critical" ? "2-hour SLA" : severity === "high" ? "6-hour SLA" : severity === "medium" ? "24-hour SLA" : "72-hour SLA"}><select value={severity} onChange={(event) => setSeverity(event.target.value as ShipmentExceptionSeverity)}>{shipmentExceptionSeverities.map((value) => <option key={value} value={value}>{shipmentExceptionSeverityLabels[value]}</option>)}</select></OpsField>
              <OpsField label="Owning branch"><select value={branch} onChange={(event) => setBranch(event.target.value as KcplBranch)}>{branches.map((value) => <option key={value} value={value}>{value}</option>)}</select></OpsField>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <OpsField label="Case title"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} placeholder="e.g. Container missed transshipment connection" required/></OpsField>
              <OpsField label="Owner email"><input value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} maxLength={240} type="email" placeholder="staff@kcpl"/></OpsField>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <OpsField label="What happened?"><textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={5000} rows={4} placeholder="Record the known facts, not assumptions." required/></OpsField>
              <OpsField label="Operational impact"><textarea value={impact} onChange={(event) => setImpact(event.target.value)} maxLength={3000} rows={4} placeholder="Customer impact, delay, cost exposure, customs risk, next movement…"/></OpsField>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <OpsField label="Owner name"><input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} maxLength={160}/></OpsField>
              <div className="flex items-end justify-end gap-2"><OpsButton type="button" onClick={() => setShowForm(false)}>Cancel</OpsButton><OpsButton type="submit" variant="primary" disabled={busy}>{busy ? "Opening…" : "Open exception case"}</OpsButton></div>
            </div>
          </form>
        ) : null}

        {!ordered.length ? <OpsEmptyState icon={<CheckCircle2 size={18}/>} title="No exception cases" description="This shipment has no recorded operational incident cases." kind="healthy" compact/> : (
          <div className="space-y-2">
            {ordered.map((item) => {
              const overdue = shipmentExceptionIsOverdue(item, nowIso);
              return (
                <article key={item.id} className="rounded-[13px] border border-[#e8e0d9] bg-white p-4" data-exception-status={item.status}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><OpsBadge tone={severityTone(item.severity)} dot>{shipmentExceptionSeverityLabels[item.severity]}</OpsBadge><OpsBadge tone={statusTone(item.status)}>{shipmentExceptionStatusLabels[item.status]}</OpsBadge><OpsBadge tone={overdue ? "danger" : "neutral"}>{overdue ? "SLA overdue" : `SLA ${dateTime(item.sla_due_at)}`}</OpsBadge></div>
                      <h3 className="mt-2 text-[14px] font-[720] tracking-[-.02em] text-[#3d3631]">{item.title}</h3>
                      <p className="mt-1 text-[11px] leading-5 text-[#746b64]">{item.detail}</p>
                      {item.operational_impact ? <p className="mt-2 rounded-[9px] bg-[#faf7f3] px-3 py-2 text-[10px] leading-5 text-[#6d625a]"><strong>Impact:</strong> {item.operational_impact}</p> : null}
                    </div>
                    <div className="text-right text-[9px] leading-5 text-[#8b8179]"><OpsMono>{item.id.slice(0, 8).toUpperCase()}</OpsMono><div>{shipmentExceptionCategoryLabels[item.category]} · {item.branch}</div><div>Opened {dateTime(item.opened_at)}</div></div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#eee7e1] pt-3">
                    <div className="text-[10px] text-[#7d736c]">Owner: <strong className="text-[#514841]">{item.assigned_to_name || item.assigned_to_email || "Unassigned"}</strong>{item.resolved_at ? ` · Resolved ${dateTime(item.resolved_at)}` : ""}</div>
                    {item.status !== "resolved" ? <div className="flex flex-wrap gap-2">{item.status === "open" ? <OpsButton size="sm" onClick={() => updateException(item, "monitoring")} disabled={busy}>Monitor</OpsButton> : <OpsButton size="sm" onClick={() => updateException(item, "open")} disabled={busy}>Return to open</OpsButton>}<OpsButton size="sm" variant="primary" onClick={() => { setResolutionFor(item.id); setResolution(""); }} disabled={busy}>Resolve</OpsButton></div> : null}
                  </div>
                  {item.resolution ? <div className="mt-3 rounded-[9px] border border-[#dfeadd] bg-[#f7fbf5] px-3 py-2 text-[10px] leading-5 text-[#4f684c]"><strong>Resolution:</strong> {item.resolution}</div> : null}
                  {resolutionFor === item.id ? <div className="mt-3 rounded-[10px] border border-[#e6ddd5] bg-[#fffcf9] p-3"><OpsField label="Resolution outcome" hint="At least 12 characters. This is written to the immutable Job File activity trail."><textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows={3} maxLength={5000} placeholder="What was done, what changed, and what is the confirmed outcome?"/></OpsField><div className="mt-2 flex justify-end gap-2"><OpsButton size="sm" onClick={() => setResolutionFor(null)}>Cancel</OpsButton><OpsButton size="sm" variant="primary" disabled={busy || resolution.trim().length < 12} onClick={() => updateException(item, "resolved", resolution)}>Confirm resolution</OpsButton></div></div> : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </OpsSurface>
  );
}
