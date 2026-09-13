"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { shipmentStatusLabels } from "../../shipment-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsMono, OpsNotice, OpsPage, OpsProgress } from "../operations-ui";
import type { CustomsAgentOption } from "./customs-clearance";
import { CustomsClearanceEditor } from "./customs-clearance-editor";
import type { CustomsDeskRow } from "./customs-data.server";

type RiskFilter = "all" | CustomsDeskRow["risk"];
type StateFilter = "all" | CustomsDeskRow["state"];
type Notice = { tone: "success" | "danger"; text: string } | null;

function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Asia/Kathmandu" }).format(date);
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
      const haystack = [row.reference, row.quote_reference, row.customer_name, row.origin, row.destination, row.mode, row.document_direction, row.branch ?? "", row.assigned_to_name ?? "", row.assigned_to_email ?? "", row.current_location ?? "", row.clearance.status, row.clearance.entry_point ?? "", row.clearance.declaration_reference ?? "", row.clearance.agent_name ?? "", row.clearance.hold_reason ?? "", row.clearance.release_evidence ?? "", shipmentStatusLabels[row.status], ...row.open_steps.map((step) => `${step.title} ${step.detail ?? ""}`), ...row.missing_documents.map((document) => `${document.label} ${document.reason}`), ...row.document_advisories, ...row.customs_integrity_warnings].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [branch, query, risk, rows, state]);

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
      setNotice({ tone: "success", text: "Customs step completed. The queue is refreshing from the Job File so cross-branch work, documents and release status remain accurate." });
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

  const metrics: Array<{ label: string; value: number; active: boolean; onClick: () => void; alert?: boolean }> = [
    { label: "Queue", value: counts.queue, active: risk === "all" && state === "all", onClick: () => { setRisk("all"); setState("all"); } },
    { label: "Critical", value: counts.critical, active: risk === "critical", onClick: () => setRisk(risk === "critical" ? "all" : "critical"), alert: counts.critical > 0 },
    { label: "Blocked", value: counts.blocked, active: state === "blocked", onClick: () => setState(state === "blocked" ? "all" : "blocked"), alert: counts.blocked > 0 },
    { label: "Awaiting release", value: counts.awaitingRelease, active: state === "awaiting_release", onClick: () => setState(state === "awaiting_release" ? "all" : "awaiting_release"), alert: counts.awaitingRelease > 0 },
    { label: "Released", value: counts.released, active: state === "released", onClick: () => setState(state === "released" ? "all" : "released") },
  ];

  return <OpsPage>
    <main className="min-h-[calc(100vh-64px)] bg-[#F6F6F3] text-[#101010]">
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-14 pt-8 sm:px-6 lg:px-8">
        <header className="grid gap-6 border-b border-[#101010] pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-[10px] font-normal uppercase tracking-[0.11em] text-[#DC143C]">Operations · Border control</p>
            <h1 className="mt-3 text-[clamp(36px,4vw,52px)] font-normal leading-[1.04] tracking-[-0.04em]">Customs</h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-[#5B5B57]">A branch-aware clearance desk for required customs work, document readiness and explicit release evidence. Checklist completion never substitutes for an actual Customs release.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2"><Link href="/admin/alerts" className="inline-flex h-10 items-center border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8]">Tasks & alerts</Link><button type="button" onClick={() => router.refresh()} className="inline-flex h-10 items-center gap-2 border border-[#DC143C] bg-[#DC143C] px-4 text-[12px] font-medium text-white hover:border-[#B61032] hover:bg-[#B61032]"><RefreshCw size={13}/>Refresh data</button></div>
        </header>

        <section className="grid border-b border-[#D6D6D0] sm:grid-cols-5" aria-label="Customs status summary">
          {metrics.map((item, index) => <button key={item.label} type="button" onClick={item.onClick} className={`min-h-[106px] border-b border-[#D6D6D0] px-4 py-5 text-left transition-colors hover:bg-[#EEEEE8] sm:border-b-0 ${index < metrics.length - 1 ? "sm:border-r sm:border-[#D6D6D0]" : ""} ${item.active ? "bg-[#EEEEE8]" : ""}`}><span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.07em] text-[#5B5B57]"><span>{item.label}</span>{item.active ? <span className="h-2 w-2 bg-[#DC143C]"/> : null}</span><strong className={`mt-4 block text-[31px] font-normal leading-none tracking-[-0.045em] ${item.alert ? "text-[#DC143C]" : "text-[#101010]"}`}>{item.value}</strong></button>)}
        </section>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-b border-[#D6D6D0] pb-4 text-[11px] text-[#5B5B57]"><span>{counts.openSteps} required steps open</span><span>{counts.missingDocs} required documents missing</span>{counts.integrity ? <span className="text-[#A80E2F]">{counts.integrity} data integrity warning{counts.integrity === 1 ? "" : "s"}</span> : null}</div>
        {notice ? <div className="mt-5"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

        <section className="mt-6 border-y border-[#D6D6D0]">
          <div className="flex flex-col gap-2 border-b border-[#101010] py-4 lg:flex-row lg:items-center">
            <label className="relative min-w-[260px] flex-1"><Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#777771]"/><input className="h-10 w-full border border-[#BDBDB6] bg-white pl-9 pr-3 text-[12px] outline-none placeholder:text-[#8A8A84]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, declaration, customs point, agent or warning"/></label>
            <select className="h-10 border border-[#BDBDB6] bg-white px-3 text-[12px]" value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)}><option value="all">All branches</option>{kcplBranches.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select className="h-10 border border-[#BDBDB6] bg-white px-3 text-[12px]" value={risk} onChange={(event) => setRisk(event.target.value as RiskFilter)}><option value="all">All risk</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="normal">Normal</option></select>
            <select className="h-10 border border-[#BDBDB6] bg-white px-3 text-[12px]" value={state} onChange={(event) => setState(event.target.value as StateFilter)}><option value="all">All states</option><option value="blocked">Blocked</option><option value="in_progress">In progress</option><option value="awaiting_release">Awaiting release</option><option value="ready">Checklist ready</option><option value="released">Customs released</option></select>
            <button type="button" onClick={reset} className="h-10 border border-[#A5A5A0] px-3 text-[12px] hover:border-[#101010] hover:bg-[#EEEEE8]">Reset</button>
            <span className="text-[11px] text-[#5B5B57]">{visible.length} shown</span>
          </div>

          {!visible.length ? <div className="grid min-h-[360px] place-items-center px-8 text-center"><div><ShieldCheck size={20} className="mx-auto text-[#777771]"/><p className="mt-4 text-[15px] font-medium">No customs work matches this view</p><p className="mt-2 text-[12px] leading-5 text-[#777771]">Reset the filters to check the full accessible clearance queue.</p><button type="button" onClick={reset} className="mt-4 border-b border-[#101010] pb-0.5 text-[11px] hover:border-[#DC143C] hover:text-[#DC143C]">Reset filters</button></div></div> : <div>{visible.map((row) => (
            <article key={row.reference} className="border-b border-[#D6D6D0] last:border-b-0">
              <div className="grid gap-5 px-0 py-5 lg:grid-cols-[minmax(0,1.25fr)_190px_190px_auto] lg:items-start">
                <div className="min-w-0 px-4 sm:px-0">
                  <div className="flex flex-wrap items-center gap-2"><OpsBadge tone={riskTone(row.risk)}>{row.risk}</OpsBadge><OpsBadge tone={stateTone(row.state)}>{stateLabel(row.state)}</OpsBadge><OpsBadge>{shipmentStatusLabels[row.status]}</OpsBadge><OpsBadge tone="info">{directionLabel(row.document_direction)}</OpsBadge></div>
                  <div className="mt-3 flex flex-wrap items-center gap-2"><OpsMono>{row.reference}</OpsMono><span className="text-[11px] text-[#5B5B57]">{row.origin} → {row.destination} · {row.mode}</span></div>
                  <p className="mt-1 text-[12px] font-medium">{row.customer_name}</p>
                  <p className="mt-2 text-[10px] leading-5 text-[#777771]">{row.assigned_to_name || row.assigned_to_email ? `Owner · ${row.assigned_to_name || row.assigned_to_email}` : "No operational owner"}{row.branch ? ` · ${row.branch}` : " · Branch repair needed"}{row.current_location ? ` · ${row.current_location}` : ""}{row.eta ? ` · ETA ${dateLabel(row.eta)}` : " · ETA not set"}</p>
                </div>

                <Readiness label="Checklist" current={row.customs_completed} total={row.customs_required} warning={row.customs_open > 0} detail={row.customs_open ? `${row.customs_open} required open` : "Complete"}/>
                <Readiness label="Documents" current={row.document_present} total={row.document_required} warning={row.missing_documents.length > 0} detail={row.missing_documents.length ? `${row.missing_documents.length} missing` : "Complete"}/>
                <div className="px-4 text-left lg:px-0 lg:text-right"><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`} className="inline-flex h-9 items-center border-b border-[#101010] text-[11px] hover:border-[#DC143C] hover:text-[#DC143C]">Open Job File →</Link></div>
              </div>

              <div className="border-t border-[#D6D6D0] bg-[#EEEEE8] px-4 py-5 sm:px-5">
                <CustomsClearanceEditor row={row} agents={customsAgents}/>

                {row.customs_integrity_warnings.length ? <AlertBlock title="Data integrity blocker" tone="danger" items={row.customs_integrity_warnings}/> : null}
                {row.missing_documents.length ? <div className="mt-4 border-t border-[#CFCFC8] pt-4"><p className="text-[10px] font-medium uppercase tracking-[0.07em] text-[#72500C]">Required documents missing</p><div className="mt-2 grid gap-2 md:grid-cols-2">{row.missing_documents.map((document) => <div key={document.type} className="border-l-2 border-[#D9C293] pl-3"><strong className="text-[11px] font-medium">{document.label}</strong><p className="mt-1 text-[10px] leading-5 text-[#777771]">{document.reason}</p></div>)}</div></div> : null}
                {row.document_advisories.length ? <AlertBlock title="Compliance review" tone="warning" items={row.document_advisories}/> : null}

                <div className="mt-4 border-t border-[#CFCFC8] pt-4">
                  <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3"><span className="pt-0.5 text-[10px] font-medium text-[#DC143C]">NEXT</span><div><h3 className="text-[13px] font-medium">Customs work queue</h3><p className="mt-1 text-[10px] leading-5 text-[#777771]">Complete only the steps owned by your branch. Release remains a separate control.</p></div></div>
                  {row.open_steps.length ? <div className="mt-3 border-t border-[#CFCFC8]">{row.open_steps.map((step) => {
                    const isBusy = busy === `${row.reference}:${step.id}`;
                    return <div key={step.id} className="flex items-start justify-between gap-4 border-b border-[#CFCFC8] py-3"><div className="min-w-0"><strong className="text-[11px] font-medium">{step.title}</strong><p className="mt-1 text-[10px] leading-5 text-[#777771]">{step.branch}{step.detail ? ` · ${step.detail}` : ""}</p></div><OpsButton variant="secondary" size="sm" disabled={Boolean(busy)} onClick={() => completeStep(row, step.id)}><CheckCircle2 size={11}/>{isBusy ? "Saving…" : "Complete"}</OpsButton></div>;
                  })}</div> : row.customs_other_branch_open ? <p className="mt-3 border-l-2 border-[#D9C293] pl-3 text-[10px] leading-5 text-[#72500C]">No open customs steps belong to your branch. Other branch work must finish before this shipment is ready.</p> : row.customs_open ? <p className="mt-3 border-l-2 border-[#E6A4B0] pl-3 text-[10px] leading-5 text-[#A80E2F]">Open customs work exists but cannot be actioned until its branch assignment is repaired.</p> : <p className="mt-3 border-l-2 border-[#A7CCB7] pl-3 text-[10px] leading-5 text-[#18794E]">All required customs checklist steps are complete. International jobs still require an explicit Customs release record before final-mile progression.</p>}
                </div>
              </div>
            </article>
          ))}</div>}
        </section>
      </div>
    </main>
  </OpsPage>;
}

function Readiness({ label, current, total, warning, detail }: { label: string; current: number; total: number; warning: boolean; detail: string }) {
  return <div className="px-4 sm:px-0"><div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-[0.06em] text-[#777771]">{label}</span><strong className="text-[11px] font-medium">{current}/{total}</strong></div><div className="mt-2"><OpsProgress value={current} max={Math.max(total, 1)} tone={warning ? "warning" : "success"}/></div><p className={`mt-2 text-[10px] ${warning ? "text-[#72500C]" : "text-[#777771]"}`}>{detail}</p></div>;
}

function AlertBlock({ title, tone, items }: { title: string; tone: "danger" | "warning"; items: string[] }) {
  return <div className="mt-4 border-t border-[#CFCFC8] pt-4"><p className={`text-[10px] font-medium uppercase tracking-[0.07em] ${tone === "danger" ? "text-[#A80E2F]" : "text-[#72500C]"}`}>{title}</p>{items.map((item) => <p key={item} className="mt-2 flex items-start gap-2 text-[10px] leading-5 text-[#666660]"><AlertTriangle size={11} className="mt-1 shrink-0"/>{item}</p>)}</div>;
}
