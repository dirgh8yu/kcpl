"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Circle, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage } from "../operations-ui";
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

function directionLabel(direction: CustomsDeskRow["document_direction"]) {
  if (direction === "cross_trade") return "Cross-trade";
  return direction.charAt(0).toUpperCase() + direction.slice(1);
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

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: "var(--app-control-height)",
    padding: "0 12px",
    border: `1px solid ${active ? "var(--admin-crimson)" : "var(--admin-line)"}`,
    borderRadius: "var(--app-radius)",
    background: active ? "var(--admin-crimson)" : "var(--admin-surface)",
    color: active ? "white" : "var(--admin-muted)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  };
}

const selectStyle: React.CSSProperties = {
  minHeight: "var(--app-control-height)",
  padding: "0 30px 0 10px",
  border: "1px solid var(--admin-line)",
  borderRadius: "var(--app-radius)",
  background: "var(--admin-surface)",
  color: "var(--admin-ink)",
  font: "inherit",
  fontSize: 13,
};

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--admin-muted)" }}>{label}</div><div style={{ marginTop: 2, fontSize: 13 }}>{value}</div></div>;
}

function Inspector({
  row,
  agents,
  busy,
  onClose,
  onCompleteStep,
}: {
  row: CustomsDeskRow;
  agents: CustomsAgentOption[];
  busy: string;
  onClose: () => void;
  onCompleteStep: (row: CustomsDeskRow, stepId: string) => Promise<void>;
}) {
  const checklistReady = row.state === "ready";
  const released = row.state === "released";
  const held = row.clearance.status === "held";

  return <aside className="customs-clearance-inspector" style={{ flexShrink: 0, border: "1px solid var(--admin-line)", borderRadius: "var(--app-surface-radius)", background: "var(--admin-surface)" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: 16, borderBottom: "1px solid var(--admin-line)" }}>
      <div style={{ minWidth: 0 }}>
        <OpsMono>{row.reference}</OpsMono>
        <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600 }}>{row.customer_name}</div>
        <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--admin-muted)" }}>{row.branch || "Branch repair needed"} · {row.mode} · {row.assigned_to_name || row.assigned_to_email || "Unassigned"}</div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close clearance inspector" style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: 0, borderRadius: "var(--app-radius)", background: "transparent", color: "var(--admin-muted)", cursor: "pointer" }}><X size={16}/></button>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--admin-line)", background: "var(--admin-surface-muted)" }}>
      <StateCell label="Clearance state"><OpsBadge tone={row.clearance.status === "released" ? "success" : row.clearance.status === "held" ? "danger" : row.clearance.status === "not_started" ? "neutral" : "warning"}>{customsClearanceStatusLabels[row.clearance.status]}</OpsBadge></StateCell>
      <StateCell label="Desk state"><OpsBadge tone={stateTone(row.state)}>{stateLabel(row.state)}</OpsBadge></StateCell>
      <StateCell label="Risk"><OpsBadge tone={riskTone(row.risk)}>{row.risk === "critical" ? "Critical risk" : row.risk === "warning" ? "Warning" : "Normal"}</OpsBadge></StateCell>
    </div>

    {checklistReady && !released ? <AuthorityNotice tone="warning" title="Checklist complete — not yet released" detail="All checklist steps are complete, but Customs has not officially released this shipment. Release evidence remains authoritative."/> : null}
    {released ? <AuthorityNotice tone="success" title="Customs released" detail={`Official release confirmed${row.clearance.declaration_reference ? ` · ${row.clearance.declaration_reference}` : ""}${row.clearance.entry_point ? ` · ${row.clearance.entry_point}` : ""}.`}/> : null}
    {held ? <AuthorityNotice tone="danger" title="Customs hold" detail={row.clearance.hold_reason || "A Customs hold is recorded. Resolve the authority requirement before movement continues."}/> : null}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 11, padding: 16, borderBottom: "1px solid var(--admin-line)" }}>
      <Detail label="Direction" value={directionLabel(row.document_direction)}/>
      <Detail label="Current location" value={row.current_location || "Not recorded"}/>
      <Detail label="ETA" value={dateLabel(row.eta)}/>
      <Detail label="Border point" value={row.clearance.entry_point || "Not recorded"}/>
      <Detail label="Declaration / reference" value={row.clearance.declaration_reference || "Not recorded"}/>
      <Detail label="Agent" value={row.clearance.agent_name || "Not recorded"}/>
      <Detail label="Last clearance update" value={dateTime(row.clearance.updated_at)}/>
      <Detail label="Quote reference" value={row.quote_reference || "Not recorded"}/>
    </div>

    {row.customs_integrity_warnings.length ? <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--admin-line)" }}><div style={{ marginBottom: 8, fontSize: 11.5, fontWeight: 600, color: "var(--admin-danger)", textTransform: "uppercase", letterSpacing: ".07em" }}>Integrity warnings</div><div style={{ display: "grid", gap: 6 }}>{row.customs_integrity_warnings.map((item) => <div key={item} style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12.5, color: "var(--admin-danger)" }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }}/><span>{item}</span></div>)}</div></div> : null}

    <div style={{ padding: 16, borderBottom: "1px solid var(--admin-line)" }}>
      <div style={{ marginBottom: 10, fontSize: 11.5, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>Clearance checklist</div>
      {row.open_steps.length ? row.open_steps.map((step) => <div key={step.id} style={{ display: "flex", gap: 10, paddingBottom: 12 }}>
        <Circle size={16} style={{ flexShrink: 0, marginTop: 2, color: "var(--admin-line-strong)" }}/>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>{step.title}</div>
          {step.detail ? <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--admin-muted)" }}>{step.detail}</div> : null}
          <div style={{ marginTop: 7 }}><OpsButton size="sm" variant="secondary" disabled={busy === `${row.reference}:${step.id}`} onClick={() => void onCompleteStep(row, step.id)}>{busy === `${row.reference}:${step.id}` ? "Saving…" : "Mark complete"}</OpsButton></div>
        </div>
      </div>) : <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--admin-success)", fontSize: 13 }}><CheckCircle2 size={15}/>Required checklist is complete.</div>}
    </div>

    <div style={{ padding: 16, borderBottom: "1px solid var(--admin-line)" }}>
      <div style={{ marginBottom: 10, fontSize: 11.5, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>Document readiness</div>
      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{row.document_present} of {row.document_required} required documents ready</div>
      {row.missing_documents.length ? <div style={{ marginTop: 8, display: "grid", gap: 6 }}>{row.missing_documents.map((item) => <div key={item.type} style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12.5, color: "var(--admin-warning)" }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }}/><span>{item.label} · {item.reason}</span></div>)}</div> : <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--admin-success)" }}>Required documents are ready.</div>}
      {row.document_advisories.length ? <div style={{ marginTop: 8, display: "grid", gap: 4 }}>{row.document_advisories.map((item) => <div key={item} style={{ fontSize: 12, color: "var(--admin-muted)" }}>{item}</div>)}</div> : null}
    </div>

    <div style={{ padding: 16, borderBottom: "1px solid var(--admin-line)" }}>
      <CustomsClearanceEditor row={row} agents={agents}/>
    </div>
    <div style={{ padding: 16 }}><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="secondary">Open full Job File</Link></div>
  </aside>;
}

function StateCell({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</div>{children}</div>;
}

function AuthorityNotice({ tone, title, detail }: { tone: "warning" | "success" | "danger"; title: string; detail: string }) {
  const fg = tone === "success" ? "var(--admin-success)" : tone === "danger" ? "var(--admin-danger)" : "var(--admin-warning)";
  const bg = tone === "success" ? "var(--admin-success-bg)" : tone === "danger" ? "var(--admin-danger-bg)" : "var(--admin-warning-bg)";
  return <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--admin-line)", borderLeft: `4px solid ${fg}`, background: bg }}><div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><AlertTriangle size={15} style={{ color: fg, flexShrink: 0, marginTop: 2 }}/><div><div style={{ color: fg, fontSize: 13.5, fontWeight: 700 }}>{title}</div><div style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.45 }}>{detail}</div></div></div></div>;
}

export function CustomsWorkspace({ initialRows, customsAgents }: { initialRows: CustomsDeskRow[]; customsAgents: CustomsAgentOption[] }) {
  const router = useRouter();
  const rows = initialRows;
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [risk, setRisk] = useState<RiskFilter>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const blockedCount = useMemo(() => rows.filter((row) => row.state === "blocked").length, [rows]);
  const heldCount = useMemo(() => rows.filter((row) => row.clearance.status === "held").length, [rows]);
  const branches = useMemo(() => kcplBranches.filter((item) => rows.some((row) => row.handling_branches.includes(item))), [rows]);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (branch !== "all" && !row.handling_branches.includes(branch)) return false;
      if (risk !== "all" && row.risk !== risk) return false;
      if (state !== "all" && row.state !== state) return false;
      if (!terms.length) return true;
      const haystack = [row.reference, row.quote_reference, row.customer_name, row.origin, row.destination, row.mode, row.document_direction, row.branch ?? "", row.assigned_to_name ?? "", row.assigned_to_email ?? "", row.current_location ?? "", row.clearance.status, row.clearance.entry_point ?? "", row.clearance.declaration_reference ?? "", row.clearance.agent_name ?? "", row.clearance.hold_reason ?? "", row.clearance.release_evidence ?? "", ...row.open_steps.map((step) => `${step.title} ${step.detail ?? ""}`), ...row.missing_documents.map((document) => `${document.label} ${document.reason}`), ...row.document_advisories, ...row.customs_integrity_warnings].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [branch, query, risk, rows, state]);

  const selected = selectedReference ? rows.find((row) => row.reference === selectedReference) ?? null : null;

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
      setNotice({ tone: "success", text: "Customs step completed. The queue is refreshing from the Digital Job File." });
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

  function setStateFilter(nextState: StateFilter) {
    setState(nextState);
    setSelectedReference(null);
  }

  const filtersActive = Boolean(query.trim()) || branch !== "all" || risk !== "all" || state !== "all";

  return <OpsPage className="customs-clearance-register">
    <div className="customs-clearance-page">
      <header className="customs-clearance-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: "32px", letterSpacing: "-.02em" }}>Customs Clearance</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--admin-muted)" }}>Branch-aware clearance desk — {rows.length} shipments · {blockedCount} blocked · {heldCount} held</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href="/admin/alerts" className="ops-button" data-variant="secondary" data-size="sm">Tasks & Alerts</Link>
          <OpsButton variant="secondary" size="sm" onClick={() => router.refresh()}><RefreshCw size={13}/>Refresh</OpsButton>
        </div>
      </header>

      {blockedCount > 0 ? <div style={{ marginBottom: 16 }}><OpsNotice tone="danger"><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><AlertTriangle size={15}/><strong>{blockedCount} shipment{blockedCount === 1 ? "" : "s"} blocked</strong> · resolve missing documents, checklist dependencies or authority holds.</span></OpsNotice></div> : null}
      {notice ? <div style={{ marginBottom: 16 }}><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

      <div className="customs-clearance-workspace">
        <div className="customs-clearance-queue">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, height: "var(--app-control-height)", padding: "0 12px", maxWidth: 300, flex: "1 1 260px", border: "1px solid var(--admin-line)", borderRadius: "var(--app-radius)", background: "var(--admin-surface)" }}>
              <Search size={14} style={{ color: "var(--admin-muted)" }}/>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, declaration, agent…" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: "var(--admin-ink)", font: "inherit", fontSize: 13.5 }}/>
              {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search" style={{ width: 24, height: 24, display: "grid", placeItems: "center", border: 0, background: "transparent", color: "var(--admin-muted)", cursor: "pointer" }}><X size={12}/></button> : null}
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Branch filter">
              <button type="button" style={chipStyle(branch === "all")} aria-pressed={branch === "all"} onClick={() => setBranch("all")}>All branches</button>
              {branches.map((item) => <button key={item} type="button" style={chipStyle(branch === item)} aria-pressed={branch === item} onClick={() => setBranch(item)}>{item}</button>)}
            </div>
            <select value={risk} onChange={(event) => setRisk(event.target.value as RiskFilter)} aria-label="Filter by Customs risk" style={selectStyle}><option value="all">All risk</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="normal">Normal</option></select>
            <select value={state} onChange={(event) => setStateFilter(event.target.value as StateFilter)} aria-label="Filter by Customs state" style={selectStyle}><option value="all">All states</option><option value="blocked">Blocked</option><option value="in_progress">In progress</option><option value="awaiting_release">Awaiting release</option><option value="ready">Checklist ready</option><option value="released">Customs released</option></select>
            {filtersActive ? <OpsButton size="sm" variant="ghost" onClick={reset}>Reset</OpsButton> : null}
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--admin-muted)", whiteSpace: "nowrap" }}>{visible.length} entries</span>
          </div>

          <div style={{ border: "1px solid var(--admin-line)", borderRadius: "var(--app-surface-radius)", overflow: "hidden", background: "var(--admin-surface)" }}>
            {visible.length ? <div style={{ overflowX: "auto" }}><table className="ops-table" style={{ minWidth: 1080 }}><thead><tr><th>Shipment</th><th>Branch · Mode</th><th>Border point</th><th>Clearance</th><th>Desk state</th><th>Risk</th><th>Checklist</th><th>Owner</th><th>Action</th></tr></thead><tbody>{visible.map((row) => {
              const selectedRow = selectedReference === row.reference;
              const progress = row.customs_required > 0 ? row.customs_completed / row.customs_required : 0;
              return <tr key={row.reference} data-selected={selectedRow ? "true" : undefined} tabIndex={0} onClick={() => setSelectedReference(row.reference)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedReference(row.reference); }} style={{ cursor: "pointer" }}>
                <td><div style={{ fontWeight: 500 }}><OpsMono>{row.reference}</OpsMono></div><div style={{ marginTop: 2, fontSize: 12, color: "var(--admin-muted)" }}>{row.customer_name}</div></td>
                <td>{row.branch || "Branch repair needed"} · {row.mode}</td>
                <td style={{ color: "var(--admin-muted)" }}>{row.clearance.entry_point || "—"}</td>
                <td><OpsBadge tone={row.clearance.status === "released" ? "success" : row.clearance.status === "held" ? "danger" : row.clearance.status === "not_started" ? "neutral" : "warning"}>{customsClearanceStatusLabels[row.clearance.status]}</OpsBadge></td>
                <td><OpsBadge tone={stateTone(row.state)}>{stateLabel(row.state)}</OpsBadge></td>
                <td><OpsBadge tone={riskTone(row.risk)}>{row.risk === "critical" ? "Critical risk" : row.risk === "warning" ? "Warning" : "Normal"}</OpsBadge></td>
                <td><div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 120 }}><div style={{ flex: 1, height: 4, overflow: "hidden", borderRadius: 2, background: "var(--admin-line)" }}><div style={{ width: `${Math.round(progress * 100)}%`, height: "100%", background: progress === 1 ? "var(--admin-success)" : "var(--admin-crimson)" }}/></div><span style={{ fontSize: 12, color: "var(--admin-muted)", whiteSpace: "nowrap" }}>{row.customs_completed}/{row.customs_required}</span></div></td>
                <td>{row.assigned_to_name || row.assigned_to_email || <span style={{ color: "var(--admin-danger)", fontSize: 12 }}>Unassigned</span>}</td>
                <td><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="ghost" data-size="sm" onClick={(event) => event.stopPropagation()}>Job File</Link></td>
              </tr>;
            })}</tbody></table></div> : <OpsEmptyState kind="search" icon={<ShieldAlert size={18}/>} title={filtersActive ? "No results" : "No customs entries"} description={filtersActive ? "Try changing or resetting the current filters." : "No shipments are currently in Customs clearance."} action={filtersActive ? <OpsButton size="sm" variant="secondary" onClick={reset}>Reset filters</OpsButton> : undefined}/>} 
          </div>
        </div>

        {selected ? <Inspector row={selected} agents={customsAgents} busy={busy} onClose={() => setSelectedReference(null)} onCompleteStep={completeStep}/> : null}
      </div>
    </div>
  </OpsPage>;
}