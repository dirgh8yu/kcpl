"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
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
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsInspectorNote, OpsKpiRail, OpsMono, OpsNotice, OpsRailMetric, OpsSurface } from "../../operations-ui";

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
  if (status === "monitoring") return "info" as const;
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
      description="Accountable cases for delay, customs, cargo, carrier and delivery problems. SLA timing and resolution evidence are controlled by the server."
      priority={priority}
      action={<div className="flex flex-wrap gap-1.5"><OpsButton size="xs" variant="ghost" onClick={refresh} disabled={busy}><RefreshCw size={13} strokeWidth={1.75} aria-hidden="true"/>Refresh</OpsButton><OpsButton size="xs" variant="secondary" onClick={() => setShowForm((value) => !value)} aria-expanded={showForm}><Plus size={13} strokeWidth={1.75} aria-hidden="true"/>Open exception</OpsButton></div>}
    >
      <div className="grid gap-3">
        <OpsKpiRail label="Exception summary" className="job-inline-rail">
          <OpsRailMetric label="Open" value={summary.open} tone="warning"/>
          <OpsRailMetric label="Critical" value={summary.critical_open} tone="danger"/>
          <OpsRailMetric label="Overdue SLA" value={summary.overdue_open} tone="danger"/>
          <OpsRailMetric label="Resolved" value={summary.resolved} tone="success"/>
        </OpsKpiRail>

        {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}

        {showForm ? (
          <form onSubmit={createException} className="job-form">
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
              <div className="flex items-end justify-end gap-2"><OpsButton type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</OpsButton><OpsButton type="submit" size="sm" variant="primary" disabled={busy}>{busy ? "Opening…" : "Open exception case"}</OpsButton></div>
            </div>
          </form>
        ) : null}

        {!ordered.length ? <OpsEmptyState title="No exception cases" description="This shipment has no recorded operational incident cases." kind="healthy" compact/> : (
          <div className="job-cases">
            {ordered.map((item) => {
              const overdue = shipmentExceptionIsOverdue(item, nowIso);
              return (
                <article key={item.id} className="job-case" data-exception-status={item.status} data-severity={item.severity}>
                  <div className="job-case-head">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5"><OpsBadge tone={severityTone(item.severity)} dot>{shipmentExceptionSeverityLabels[item.severity]}</OpsBadge><OpsBadge tone={statusTone(item.status)}>{shipmentExceptionStatusLabels[item.status]}</OpsBadge><OpsBadge tone={overdue ? "danger" : "neutral"}>{overdue ? "SLA overdue" : `SLA ${dateTime(item.sla_due_at)}`}</OpsBadge></div>
                      <h3 className="job-case-title">{item.title}</h3>
                      <p className="job-row-detail">{item.detail}</p>
                      {item.operational_impact ? <p className="job-row-detail"><strong>Impact:</strong> {item.operational_impact}</p> : null}
                    </div>
                    <div className="job-case-meta"><OpsMono>{item.id.slice(0, 8).toUpperCase()}</OpsMono><div>{shipmentExceptionCategoryLabels[item.category]} · {item.branch}</div><div>Opened {dateTime(item.opened_at)}</div></div>
                  </div>
                  <div className="job-case-foot">
                    <div className="job-row-meta"><span>Owner <strong>{item.assigned_to_name || item.assigned_to_email || "Unassigned"}</strong></span>{item.resolved_at ? <span>Resolved {dateTime(item.resolved_at)}</span> : null}</div>
                    {item.status !== "resolved" ? <div className="flex flex-wrap gap-1.5">{item.status === "open" ? <OpsButton size="xs" variant="ghost" onClick={() => updateException(item, "monitoring")} disabled={busy}>Monitor</OpsButton> : <OpsButton size="xs" variant="ghost" onClick={() => updateException(item, "open")} disabled={busy}>Return to open</OpsButton>}<OpsButton size="xs" variant="secondary" onClick={() => { setResolutionFor(item.id); setResolution(""); }} disabled={busy}>Resolve</OpsButton></div> : null}
                  </div>
                  {item.resolution ? <div className="mt-2"><OpsInspectorNote tone="success" title="Resolution">{item.resolution}</OpsInspectorNote></div> : null}
                  {resolutionFor === item.id ? <div className="job-form mt-2"><OpsField label="Resolution outcome" hint="At least 12 characters. This is written to the immutable Job File activity trail."><textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows={3} maxLength={5000} placeholder="What was done, what changed, and what is the confirmed outcome?"/></OpsField><div className="mt-2 flex justify-end gap-2"><OpsButton size="sm" variant="ghost" onClick={() => setResolutionFor(null)}>Cancel</OpsButton><OpsButton size="sm" variant="primary" disabled={busy || resolution.trim().length < 12} onClick={() => updateException(item, "resolved", resolution)}>Confirm resolution</OpsButton></div></div> : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </OpsSurface>
  );
}
