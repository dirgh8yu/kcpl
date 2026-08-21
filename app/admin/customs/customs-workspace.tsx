"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileWarning, Landmark, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { shipmentStatusLabels } from "../../shipment-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsProgress, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
import type { CustomsDeskRow } from "./customs-data.server";

type RiskFilter = "all" | CustomsDeskRow["risk"];
type StateFilter = "all" | CustomsDeskRow["state"];

function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function riskTone(risk: CustomsDeskRow["risk"]): "danger" | "warning" | "neutral" {
  if (risk === "critical") return "danger";
  if (risk === "warning") return "warning";
  return "neutral";
}

function stateTone(state: CustomsDeskRow["state"]): "danger" | "warning" | "success" | "info" {
  if (state === "blocked") return "danger";
  if (state === "in_progress") return "warning";
  if (state === "ready") return "success";
  return "info";
}

function stateLabel(state: CustomsDeskRow["state"]) {
  if (state === "in_progress") return "In progress";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

function directionLabel(direction: CustomsDeskRow["document_direction"]) {
  if (direction === "cross_trade") return "Cross-trade";
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

export function CustomsWorkspace({ initialRows }: { initialRows: CustomsDeskRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [risk, setRisk] = useState<RiskFilter>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const counts = useMemo(() => ({
    queue: rows.length,
    critical: rows.filter((row) => row.risk === "critical").length,
    blocked: rows.filter((row) => row.state === "blocked").length,
    openSteps: rows.reduce((sum, row) => sum + row.customs_open, 0),
    missingDocs: rows.reduce((sum, row) => sum + row.missing_documents.length, 0),
    ready: rows.filter((row) => row.state === "ready").length,
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
        shipmentStatusLabels[row.status],
        ...row.open_steps.map((step) => `${step.title} ${step.detail ?? ""}`),
        ...row.missing_documents.map((document) => `${document.label} ${document.reason}`),
        ...row.document_advisories,
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [branch, query, risk, rows, state]);

  async function completeStep(row: CustomsDeskRow, stepId: string) {
    setBusy(`${row.reference}:${stepId}`);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(row.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "toggle_customs", stepId, completed: true }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not complete the customs step.");
      setRows((current) => current.map((item) => {
        if (item.reference !== row.reference) return item;
        const nextSteps = item.open_steps.filter((step) => step.id !== stepId);
        const completed = item.customs_completed + 1;
        const nextState: CustomsDeskRow["state"] = nextSteps.length
          ? item.missing_documents.length ? "blocked" : "in_progress"
          : item.missing_documents.length ? "blocked" : "ready";
        return { ...item, open_steps: nextSteps, customs_open: nextSteps.length, customs_completed: completed, state: nextState };
      }));
      setNotice("Customs step completed. Shipment readiness and automated alerts will update from the same Job File record.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not complete the customs step.");
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

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Operations"
        title="Customs Desk"
        description="One live queue for customs clearance, smart document readiness, ETA pressure and branch ownership. Document rules recalculate from mode, lane, cargo text and shipment instructions."
        meta={<><span>{counts.queue} shipments in customs queue</span><span>{counts.openSteps} required steps open</span><span>{counts.missingDocs} smart-required documents missing</span><span>Live Firebase records</span></>}
        actions={<><Link href="/admin/alerts" className="ops-button" data-variant="secondary" data-size="md">Tasks & alerts</Link><OpsButton variant="primary" onClick={() => router.refresh()}><RefreshCw size={13}/>Refresh queue</OpsButton></>}
      />

      <OpsStatStrip>
        <OpsStat label="Queue" value={counts.queue} icon={<ShieldCheck size={13}/>} active={risk === "all" && state === "all"} onClick={() => { setRisk("all"); setState("all"); }}/>
        <OpsStat label="Critical" value={counts.critical} icon={<AlertTriangle size={13}/>} tone={counts.critical ? "danger" : "neutral"} active={risk === "critical"} onClick={() => setRisk(risk === "critical" ? "all" : "critical")}/>
        <OpsStat label="Blocked" value={counts.blocked} icon={<FileWarning size={13}/>} tone={counts.blocked ? "warning" : "neutral"} active={state === "blocked"} onClick={() => setState(state === "blocked" ? "all" : "blocked")}/>
        <OpsStat label="Open steps" value={counts.openSteps} icon={<ClipboardCheck size={13}/>} tone={counts.openSteps ? "warning" : "neutral"}/>
        <OpsStat label="Ready" value={counts.ready} icon={<CheckCircle2 size={13}/>} tone="success" active={state === "ready"} onClick={() => setState(state === "ready" ? "all" : "ready")}/>
      </OpsStatStrip>

      <div className="ops-content ops-stack">
        {notice ? <OpsNotice tone={notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}

        <OpsSurface eyebrow="Clearance queue" title="What customs needs next" description={`${visible.length} shipment${visible.length === 1 ? "" : "s"} match this view. Critical ETA and final-mile blockers stay at the top.`} flush>
          <div className="ops-toolbar">
            <label className="relative min-w-[240px] flex-1"><Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9b9189]"/><input className="ops-input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, lane, document rule, owner…"/></label>
            <select className="ops-select" value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)}><option value="all">All branches</option>{kcplBranches.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select className="ops-select" value={risk} onChange={(event) => setRisk(event.target.value as RiskFilter)}><option value="all">All risk</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="normal">Normal</option></select>
            <select className="ops-select" value={state} onChange={(event) => setState(event.target.value as StateFilter)}><option value="all">All states</option><option value="blocked">Blocked</option><option value="in_progress">In progress</option><option value="ready">Ready</option><option value="clear">Clear</option></select>
            <OpsButton variant="ghost" size="sm" onClick={reset}>Reset</OpsButton>
          </div>

          {visible.length ? <div className="divide-y divide-[#eee7e1]">{visible.map((row) => (
            <article key={row.reference} className="px-4 py-4 sm:px-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_220px_220px_auto] xl:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><OpsBadge tone={riskTone(row.risk)} dot>{row.risk}</OpsBadge><OpsBadge tone={stateTone(row.state)}>{stateLabel(row.state)}</OpsBadge><OpsBadge>{shipmentStatusLabels[row.status]}</OpsBadge><OpsBadge tone="info">{directionLabel(row.document_direction)}</OpsBadge>{row.branch ? <OpsBadge><Landmark size={10}/>{row.branch}</OpsBadge> : null}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-[730] text-[#3e3833]"><OpsMono>{row.reference}</OpsMono></h3><span className="text-[10px] text-[#928880]">{row.origin} → {row.destination} · {row.mode}</span></div>
                  <p className="mt-1 text-[10px] font-semibold text-[#625a53]">{row.customer_name}</p>
                  <p className="mt-1.5 text-[9px] text-[#918880]">{row.assigned_to_name || row.assigned_to_email ? `Owner ${row.assigned_to_name || row.assigned_to_email}` : "No operational owner"}{row.current_location ? ` · ${row.current_location}` : ""}{row.eta ? ` · ETA ${dateLabel(row.eta)}` : " · ETA not set"}</p>
                </div>

                <div className="rounded-[11px] border border-[#e9e2dc] bg-[#faf8f5] p-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-[8px] font-bold uppercase tracking-[.07em] text-[#948a82]">Customs</span><strong className="text-[10px] text-[#514840]">{row.customs_completed}/{row.customs_required}</strong></div>
                  <div className="mt-2"><OpsProgress value={row.customs_completed} max={Math.max(row.customs_required, 1)} tone={row.customs_open ? "warning" : "success"}/></div>
                  <p className="mt-2 text-[8px] text-[#8f857d]">{row.customs_open ? `${row.customs_open} required step${row.customs_open === 1 ? "" : "s"} open` : "Required customs steps complete"}</p>
                </div>

                <div className="rounded-[11px] border border-[#e9e2dc] bg-[#faf8f5] p-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-[8px] font-bold uppercase tracking-[.07em] text-[#948a82]">Smart documents</span><strong className="text-[10px] text-[#514840]">{row.document_present}/{row.document_required}</strong></div>
                  <div className="mt-2"><OpsProgress value={row.document_present} max={Math.max(row.document_required, 1)} tone={row.missing_documents.length ? "warning" : "success"}/></div>
                  <p className="mt-2 text-[8px] leading-4 text-[#8f857d]">{row.missing_documents.length ? `Missing: ${row.missing_documents.map((item) => item.label).join(", ")}` : "Smart-required document pack complete"}</p>
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end"><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="primary" data-size="sm">Open Job File</Link></div>
              </div>

              {row.missing_documents.length ? <div className="mt-3 grid gap-2 md:grid-cols-2">{row.missing_documents.map((document) => <div key={document.type} className="rounded-[10px] border border-[#eadcc8] bg-[#fffaf2] p-3"><div className="flex items-center gap-2"><FileWarning size={11} className="text-[#9c6a30]"/><strong className="text-[9px] text-[#654f35]">{document.label}</strong></div><p className="mt-1.5 text-[8px] leading-4 text-[#8a7359]">{document.reason}</p></div>)}</div> : null}
              {row.document_advisories.length ? <div className="mt-3 rounded-[10px] border border-[#ded8cf] bg-[#faf8f5] p-3"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#8f8176]">Compliance review</p>{row.document_advisories.map((advisory) => <p key={advisory} className="mt-1.5 flex items-start gap-1.5 text-[8px] leading-4 text-[#806a55]"><AlertTriangle size={9} className="mt-0.5 shrink-0"/>{advisory}</p>)}</div> : null}

              {row.open_steps.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">{row.open_steps.map((step) => {
                const isBusy = busy === `${row.reference}:${step.id}`;
                return <div key={step.id} className="flex items-start justify-between gap-3 rounded-[11px] border border-[#eadfd7] bg-[#fffdfa] p-3"><div className="min-w-0"><strong className="text-[10px] text-[#514840]">{step.title}</strong><p className="mt-1 text-[8px] leading-4 text-[#8e847c]">{step.branch}{step.detail ? ` · ${step.detail}` : ""}</p></div><OpsButton variant="secondary" size="sm" disabled={Boolean(busy)} onClick={() => completeStep(row, step.id)}><CheckCircle2 size={11}/>{isBusy ? "Saving…" : "Complete"}</OpsButton></div>;
              })}</div> : <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#d8e2d8] bg-[#f5f9f5] p-3 text-[9px] text-[#617564]"><CheckCircle2 size={12}/>All required customs checklist steps are complete for this shipment.</div>}
            </article>
          ))}</div> : <OpsEmptyState kind="healthy" icon={<ShieldCheck size={18}/>} title="Customs queue is clear" description="No shipments match the current customs filters. When clearance work or smart-required documents need attention, they will appear here automatically." action={<OpsButton variant="secondary" size="sm" onClick={reset}>Reset filters</OpsButton>}/>} 
        </OpsSurface>
      </div>
    </OpsPage>
  );
}
