"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { shipmentStatusLabels } from "../../shipment-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsProgress, OpsSearch, OpsStat, OpsStatStrip, OpsSurface, OpsTableWrap, OpsToolbar } from "../operations-ui";
import type { CustomsAgentOption } from "./customs-clearance";
import { CustomsClearanceEditor } from "./customs-clearance-editor";
import type { CustomsDeskRow } from "./customs-data.server";
import { customsClearanceStatusLabels } from "./customs-policy";

type RiskFilter = "all" | CustomsDeskRow["risk"];
type StateFilter = "all" | CustomsDeskRow["state"];
type Notice = { tone: "success" | "danger"; text: string } | null;

function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Asia/Kathmandu" }).format(date);
}

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function riskTone(risk: CustomsDeskRow["risk"]): "danger" | "warning" | "neutral" {
  if (risk === "critical") return "danger";
  if (risk === "warning") return "warning";
  return "neutral";
}

function stateTone(state: CustomsDeskRow["state"]): "danger" | "warning" | "success" | "info" {
  if (state === "blocked") return "danger";
  if (state === "in_progress" || state === "awaiting_release") return "warning";
  if (state === "released") return "success";
  return "info";
}

function stateLabel(state: CustomsDeskRow["state"]) {
  if (state === "in_progress") return "In progress";
  if (state === "awaiting_release") return "Awaiting release";
  if (state === "released") return "Customs released";
  if (state === "ready") return "Checklist ready";
  return "Blocked";
}

function directionLabel(direction: CustomsDeskRow["document_direction"]) {
  if (direction === "cross_trade") return "Cross-trade";
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

export function CustomsWorkspace({ initialRows, customsAgents }: { initialRows: CustomsDeskRow[]; customsAgents: CustomsAgentOption[] }) {
  const router = useRouter();
  const rows = initialRows;
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [risk, setRisk] = useState<RiskFilter>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [selectedReference, setSelectedReference] = useState<string | null>(rows[0]?.reference ?? null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const counts = useMemo(() => ({
    queue: rows.length,
    critical: rows.filter((row) => row.risk === "critical").length,
    blocked: rows.filter((row) => row.state === "blocked").length,
    openSteps: rows.reduce((sum, row) => sum + row.customs_open, 0),
    missingDocs: rows.reduce((sum, row) => sum + row.missing_documents.length, 0),
    integrity: rows.reduce((sum, row) => sum + row.customs_integrity_warnings.length, 0),
    awaitingRelease: rows.filter((row) => row.state === "awaiting_release").length,
    released: rows.filter((row) => row.state === "released").length,
  }), [rows]);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (branch !== "all" && !row.handling_branches.includes(branch)) return false;
      if (risk !== "all" && row.risk !== risk) return false;
      if (state !== "all" && row.state !== state) return false;
      if (!terms.length) return true;
      const haystack = [
        row.reference,
        row.quote_reference,
        row.customer_name,
        row.origin,
        row.destination,
        row.mode,
        row.document_direction,
        row.branch ?? "",
        row.assigned_to_name ?? "",
        row.assigned_to_email ?? "",
        row.current_location ?? "",
        row.clearance.status,
        row.clearance.entry_point ?? "",
        row.clearance.declaration_reference ?? "",
        row.clearance.agent_name ?? "",
        row.clearance.hold_reason ?? "",
        row.clearance.release_evidence ?? "",
        shipmentStatusLabels[row.status],
        ...row.open_steps.map((step) => `${step.title} ${step.detail ?? ""}`),
        ...row.missing_documents.map((document) => `${document.label} ${document.reason}`),
        ...row.document_advisories,
        ...row.customs_integrity_warnings,
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [branch, query, risk, rows, state]);

  const selected = rows.find((row) => row.reference === selectedReference) ?? visible[0] ?? null;

  async function completeStep(row: CustomsDeskRow, stepId: string) {
    setBusy(`${row.reference}:${stepId}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(row.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "toggle_customs", stepId, completed: true }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not complete the customs step.");
      setNotice({ tone: "success", text: "Customs step completed. The queue is refreshing from the Job File so branch work, documents and release status remain authoritative." });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Could not complete the customs step." });
    } finally {
      setBusy("");
    }
  }

  function reset() {
    setQuery("");
    setBranch("all");
    setRisk("all");
    setState("all");
  }

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Operations · Border control"
      title="Customs"
      description="A branch-aware clearance desk for required customs work, document readiness and explicit release evidence. Checklist completion never substitutes for an actual Customs release."
      meta={<><span>{counts.openSteps} required steps open</span><span>{counts.missingDocs} required documents missing</span>{counts.integrity ? <span>{counts.integrity} integrity warning{counts.integrity === 1 ? "" : "s"}</span> : null}</>}
      actions={<><Link href="/admin/alerts" className="ops-button" data-variant="secondary">Tasks & Alerts</Link><OpsButton variant="primary" onClick={() => router.refresh()}><RefreshCw size={14}/>Refresh</OpsButton></>}
    />

    <OpsStatStrip>
      <OpsStat label="Queue" value={counts.queue} active={risk === "all" && state === "all"} onClick={() => { setRisk("all"); setState("all"); }}/>
      <OpsStat label="Critical" value={counts.critical} tone={counts.critical ? "danger" : "neutral"} active={risk === "critical"} onClick={() => setRisk(risk === "critical" ? "all" : "critical")}/>
      <OpsStat label="Blocked" value={counts.blocked} tone={counts.blocked ? "danger" : "neutral"} active={state === "blocked"} onClick={() => setState(state === "blocked" ? "all" : "blocked")}/>
      <OpsStat label="Awaiting release" value={counts.awaitingRelease} tone={counts.awaitingRelease ? "warning" : "neutral"} active={state === "awaiting_release"} onClick={() => setState(state === "awaiting_release" ? "all" : "awaiting_release")}/>
      <OpsStat label="Released" value={counts.released} tone="success" active={state === "released"} onClick={() => setState(state === "released" ? "all" : "released")}/>
    </OpsStatStrip>

    <div className="ops-content-wide grid gap-4">
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}

      <OpsToolbar>
        <OpsSearch className="flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, declaration, agent or warning"/>
        <select className="ops-select" value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)} aria-label="Filter by branch"><option value="all">All branches</option>{kcplBranches.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select className="ops-select" value={risk} onChange={(event) => setRisk(event.target.value as RiskFilter)} aria-label="Filter by Customs risk"><option value="all">All risk</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="normal">Normal</option></select>
        <select className="ops-select" value={state} onChange={(event) => setState(event.target.value as StateFilter)} aria-label="Filter by Customs state"><option value="all">All states</option><option value="blocked">Blocked</option><option value="in_progress">In progress</option><option value="awaiting_release">Awaiting release</option><option value="ready">Checklist ready</option><option value="released">Customs released</option></select>
        <OpsButton variant="secondary" onClick={reset}>Reset</OpsButton>
      </OpsToolbar>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <OpsSurface className="lg:col-span-2" title="Clearance queue" description={`${visible.length} of ${rows.length} accessible shipments shown.`} flush>
          {visible.length ? <OpsTableWrap>
            <table className="ops-table">
              <thead><tr><th>Shipment</th><th>Customer / route</th><th>Desk state</th><th>Checklist</th><th>Documents</th><th>Release</th><th>Action</th></tr></thead>
              <tbody>{visible.map((row) => {
                const isSelected = selected?.reference === row.reference;
                return <tr key={row.reference} data-selected={isSelected ? "true" : undefined}>
                  <td><button type="button" onClick={() => setSelectedReference(row.reference)} className="text-left font-semibold hover:text-[var(--admin-crimson)]"><OpsMono>{row.reference}</OpsMono></button><span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.branch || "Branch repair needed"}</span></td>
                  <td><strong className="block">{row.customer_name}</strong><span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.origin} → {row.destination} · {row.mode}</span></td>
                  <td><div className="flex flex-wrap gap-1"><OpsBadge tone={riskTone(row.risk)}>{row.risk}</OpsBadge><OpsBadge tone={stateTone(row.state)}>{stateLabel(row.state)}</OpsBadge></div></td>
                  <td><span className="block">{row.customs_completed} / {row.customs_required}</span><OpsProgress value={row.customs_completed} max={Math.max(1, row.customs_required)} tone={row.customs_open ? "warning" : "success"} label={`Customs checklist ${row.customs_completed} of ${row.customs_required}`}/><span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.customs_open ? `${row.customs_open} required open` : "Complete"}</span></td>
                  <td><span className="block">{row.document_present} / {row.document_required}</span><span className="mt-1 block text-xs text-[var(--admin-faint)]">{row.missing_documents.length ? `${row.missing_documents.length} missing` : "Complete"}</span></td>
                  <td><OpsBadge tone={row.clearance.status === "released" ? "success" : row.clearance.status === "held" ? "danger" : "warning"}>{customsClearanceStatusLabels[row.clearance.status]}</OpsBadge>{row.clearance.declaration_reference ? <span className="mt-1 block text-xs text-[var(--admin-faint)]"><OpsMono>{row.clearance.declaration_reference}</OpsMono></span> : null}</td>
                  <td><div className="flex justify-end gap-2"><OpsButton size="sm" variant={row.risk === "critical" ? "primary" : "secondary"} onClick={() => setSelectedReference(row.reference)}>Inspect</OpsButton><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="ghost" data-size="sm">Job File</Link></div></td>
                </tr>;
              })}</tbody>
            </table>
          </OpsTableWrap> : <div className="p-5"><OpsEmptyState kind="search" icon={<ShieldCheck size={18}/>} title="No Customs work matches this view" description="Reset the filters to check the full accessible clearance queue." action={<OpsButton size="sm" variant="secondary" onClick={reset}>Reset filters</OpsButton>}/></div>}
        </OpsSurface>

        <OpsSurface
          eyebrow="Selected clearance"
          title={selected ? selected.reference : "No shipment selected"}
          description={selected ? `${selected.customer_name} · ${selected.origin} → ${selected.destination}` : "Select a shipment to inspect its Customs authority and evidence."}
          priority={selected?.state === "blocked" ? "danger" : selected?.state === "awaiting_release" ? "warning" : selected?.state === "released" ? "success" : "normal"}
        >
          {selected ? <div className="grid gap-5">
            <div className="flex flex-wrap gap-2"><OpsBadge tone={riskTone(selected.risk)}>{selected.risk} risk</OpsBadge><OpsBadge tone={stateTone(selected.state)}>{stateLabel(selected.state)}</OpsBadge><OpsBadge>{shipmentStatusLabels[selected.status]}</OpsBadge><OpsBadge tone="info">{directionLabel(selected.document_direction)}</OpsBadge></div>

            <dl className="grid gap-3 text-sm">
              <div><dt className="text-xs text-[var(--admin-faint)]">Owner / branch</dt><dd className="mt-1 font-medium">{selected.assigned_to_name || selected.assigned_to_email || "No operational owner"} · {selected.branch || "Branch repair needed"}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Current location / ETA</dt><dd className="mt-1 font-medium">{selected.current_location || "Not recorded"} · {dateLabel(selected.eta)}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Clearance authority</dt><dd className="mt-1 font-medium">{customsClearanceStatusLabels[selected.clearance.status]}</dd><dd className="text-xs text-[var(--admin-muted)]">{selected.clearance.entry_point || "Border point not recorded"}{selected.clearance.agent_name ? ` · ${selected.clearance.agent_name}` : ""}</dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Declaration / reference</dt><dd className="mt-1 font-medium"><OpsMono>{selected.clearance.declaration_reference || "Not recorded"}</OpsMono></dd></div>
              <div><dt className="text-xs text-[var(--admin-faint)]">Last clearance update</dt><dd className="mt-1 font-medium">{dateTime(selected.clearance.updated_at)}</dd></div>
            </dl>

            {selected.state === "awaiting_release" || selected.state === "ready" ? <OpsNotice tone="warning"><strong>Checklist ready does not mean Customs released.</strong> Release remains a separate authority and must be supported by the required declaration/reference or release evidence.</OpsNotice> : null}
            {selected.clearance.status === "held" ? <OpsNotice tone="danger"><strong>Customs hold:</strong> {selected.clearance.hold_reason || "No hold reason recorded."}</OpsNotice> : null}
            {selected.clearance.status === "released" ? <OpsNotice tone="success"><strong>Customs released.</strong> {selected.clearance.release_evidence || selected.clearance.declaration_reference || "Release evidence recorded."}</OpsNotice> : null}

            {selected.customs_integrity_warnings.length ? <div><h3>Integrity warnings</h3><ul className="mt-2 grid gap-2 text-sm text-[var(--admin-muted)]">{selected.customs_integrity_warnings.map((item) => <li key={item} className="flex gap-2"><AlertTriangle size={14} className="mt-1 shrink-0"/>{item}</li>)}</ul></div> : null}

            {selected.missing_documents.length ? <div><h3>Missing documents</h3><ul className="mt-2 grid gap-2 text-sm text-[var(--admin-muted)]">{selected.missing_documents.map((document) => <li key={document.type}><strong className="text-[var(--admin-ink)]">{document.label}</strong><span className="block text-xs">{document.reason}</span></li>)}</ul></div> : null}

            <div><div className="flex items-center justify-between gap-3"><h3>Required checklist</h3><span className="text-xs text-[var(--admin-faint)]">{selected.customs_completed} / {selected.customs_required} complete</span></div>{selected.open_steps.length ? <div className="mt-2 grid gap-2">{selected.open_steps.map((step) => <div key={step.id} className="flex items-start justify-between gap-3 border-t border-[var(--admin-line)] pt-3"><div><strong className="text-sm">{step.title}</strong><p className="mt-1 text-xs text-[var(--admin-muted)]">{step.detail || `${step.branch} responsibility`}</p></div><OpsButton size="sm" variant="secondary" disabled={busy === `${selected.reference}:${step.id}`} onClick={() => completeStep(selected, step.id)}><CheckCircle2 size={13}/>{busy === `${selected.reference}:${step.id}` ? "Saving…" : "Complete"}</OpsButton></div>)}</div> : <p className="mt-2 text-sm text-[var(--admin-muted)]">No required checklist steps remain open.</p>}</div>

            <div className="border-t border-[var(--admin-line)] pt-4"><CustomsClearanceEditor row={selected} agents={customsAgents}/></div>
            <Link href={`/admin/jobs/${encodeURIComponent(selected.reference)}`} className="ops-button" data-variant="secondary">Open full Job File</Link>
          </div> : <OpsEmptyState compact title="No shipment selected" description="Choose a row from the clearance queue."/>}
        </OpsSurface>
      </div>
    </div>
  </OpsPage>;
}
