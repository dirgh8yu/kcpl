"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Circle, FileCheck2, Landmark, LockKeyhole, RefreshCw, RotateCcw } from "lucide-react";
import type { ShipmentWorkflowReadiness } from "../../workflow-guard";
import { OpsBadge, OpsButton, OpsMono, OpsNotice, OpsProgress, OpsSurface } from "../../operations-ui";

function stageIcon(state: ShipmentWorkflowReadiness["stages"][number]["state"]) {
  if (state === "complete") return <Check size={11}/>;
  if (state === "blocked") return <AlertTriangle size={11}/>;
  return <Circle size={9}/>;
}

function stageTone(state: ShipmentWorkflowReadiness["stages"][number]["state"]) {
  if (state === "complete") return "border-[#cddbcf] bg-[#f2f7f2] text-[#5d7562]";
  if (state === "blocked") return "border-[#edc8c4] bg-[#fff5f3] text-[#a9504d]";
  if (state === "current") return "border-[#e7c7b9] bg-[#fff7f2] text-[#a95d48]";
  return "border-[#e9e2dc] bg-[#faf8f5] text-[#91877f]";
}

export function WorkflowSpine({ initialWorkflow, canOverride }: { initialWorkflow: ShipmentWorkflowReadiness; canOverride: boolean }) {
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/jobs/${encodeURIComponent(workflow.reference)}`, { cache: "no-store" });
    const data = await response.json() as { workflow?: ShipmentWorkflowReadiness; error?: string };
    if (!response.ok || !data.workflow) throw new Error(data.error || "Could not refresh workflow readiness.");
    setWorkflow(data.workflow);
  }, [workflow.reference]);

  useEffect(() => {
    const timer = window.setInterval(() => refresh().catch(() => undefined), 15000);
    const onFocus = () => refresh().catch(() => undefined);
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  async function closeJob(overrideReason = "") {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(workflow.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "close_job", overrideReason }),
      });
      const data = await response.json() as { workflow?: ShipmentWorkflowReadiness; error?: string; blockers?: string[]; canOverride?: boolean };
      if (!response.ok) throw Object.assign(new Error(data.error || "The Job File could not be closed."), { data });
      if (data.workflow) setWorkflow(data.workflow);
      setNotice(overrideReason ? "Job closed with a recorded management override." : "Operational closeout complete. Job File locked as closed.");
    } catch (error) {
      const payload = (error as Error & { data?: { blockers?: string[]; canOverride?: boolean } }).data;
      if (payload?.canOverride && canOverride) {
        const reason = window.prompt(`Closeout is blocked:\n\n${(payload.blockers ?? []).join("\n")}\n\nManagement override reason:`)?.trim() ?? "";
        if (reason.length >= 8) { setBusy(false); await closeJob(reason); return; }
      }
      setNotice(error instanceof Error ? error.message : "The Job File could not be closed.");
    } finally { setBusy(false); }
  }

  async function reopenJob() {
    const reason = window.prompt("Why is this closed Job File being reopened? This reason will be audited.")?.trim() ?? "";
    if (reason.length < 8) { setNotice("Add a meaningful reopening reason of at least 8 characters."); return; }
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(workflow.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reopen_job", reason }),
      });
      const data = await response.json() as { workflow?: ShipmentWorkflowReadiness; error?: string };
      if (!response.ok) throw new Error(data.error || "The Job File could not be reopened.");
      if (data.workflow) setWorkflow(data.workflow);
      setNotice("Job File reopened and returned to active operations.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "The Job File could not be reopened."); }
    finally { setBusy(false); }
  }

  const requiredDocs = workflow.documents.filter((item) => item.required);
  const presentDocs = requiredDocs.filter((item) => item.present).length;
  const stagePercent = Math.round((workflow.stages.filter((stage) => stage.state === "complete").length / workflow.stages.length) * 100);

  return <div className="ops-content-wide pt-5">
    <OpsSurface
      eyebrow="Controlled lifecycle"
      title="Enquiry → Quote → Shipment → Closeout"
      description="The shipment stays the single operational record. Gates prevent accidental stage skipping; Management overrides require a written audit reason."
      action={<div className="flex flex-wrap gap-2"><OpsButton variant="secondary" size="sm" disabled={busy} onClick={() => refresh().catch((error) => setNotice(error instanceof Error ? error.message : "Refresh failed."))}><RefreshCw size={11}/>Refresh</OpsButton>{workflow.job_closed ? canOverride ? <OpsButton variant="secondary" size="sm" disabled={busy} onClick={reopenJob}><RotateCcw size={11}/>Reopen job</OpsButton> : null : <OpsButton variant="primary" size="sm" disabled={busy} onClick={() => closeJob()}><LockKeyhole size={11}/>{workflow.can_close ? "Close job" : canOverride ? "Close / override" : "Close job"}</OpsButton>}</div>}
    >
      {notice ? <div className="mb-4"><OpsNotice tone={notice.toLowerCase().includes("could not") || notice.toLowerCase().includes("blocked") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[820px] items-start">
          {workflow.stages.map((stage, index) => <div key={stage.id} className="relative min-w-0 flex-1 px-1">
            {index < workflow.stages.length - 1 ? <span className={`absolute left-[calc(50%+13px)] right-[calc(-50%+13px)] top-[13px] h-[2px] ${stage.state === "complete" ? "bg-[#a9c7b2]" : "bg-[#ddd8d2]"}`} aria-hidden="true"/> : null}
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className={`inline-flex h-[27px] w-[27px] items-center justify-center rounded-full border bg-white ${stageTone(stage.state)}`}>{stageIcon(stage.state)}</span>
              <span className="mt-2 text-[10px] font-bold text-[#49433e]">{stage.label}</span>
              <span className="mt-1 max-w-[120px] text-[8px] leading-4 text-[#817a73]">{stage.detail}</span>
            </div>
          </div>)}
        </div>
      </div>
      <div className="mt-4"><OpsProgress value={stagePercent}/></div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[13px] border border-[#e9e2dc] bg-[#faf8f5] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="ops-eyebrow">Operational readiness</p><h3 className="mt-1 text-[12px] font-bold text-[#514840]">Gate health</h3></div><div className="flex gap-2"><OpsBadge tone={workflow.customs_ready ? "success" : "warning"}>{workflow.customs_completed}/{workflow.customs_required} customs</OpsBadge><OpsBadge tone={workflow.document_pack_ready ? "success" : "warning"}>{presentDocs}/{requiredDocs.length} docs</OpsBadge><OpsBadge tone={workflow.open_tasks ? "warning" : "success"}>{workflow.open_tasks} open tasks</OpsBadge></div></div>
          {workflow.close_blockers.length ? <div className="mt-4 grid gap-2">{workflow.close_blockers.map((blocker) => <div key={blocker} className="flex items-start gap-2 rounded-[10px] border border-[#efd4cf] bg-[#fff7f5] p-2.5 text-[9px] leading-4 text-[#92524c]"><AlertTriangle size={11} className="mt-0.5 shrink-0"/><span>{blocker}</span></div>)}</div> : <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[#d6e1d6] bg-[#f4f8f4] p-3 text-[9px] leading-4 text-[#607563]"><FileCheck2 size={12} className="mt-0.5 shrink-0"/><span>All operational closeout controls are satisfied. This job is ready to close.</span></div>}
          {workflow.warnings.length ? <div className="mt-3 space-y-1">{workflow.warnings.map((warning) => <p key={warning} className="text-[8px] leading-4 text-[#8e837b]">• {warning}</p>)}</div> : null}
        </div>

        <div className="rounded-[13px] border border-[#e9e2dc] bg-[#fffdfa] p-4">
          <div className="flex items-center gap-2"><Landmark size={13} className="text-[#b46d57]"/><div><p className="ops-eyebrow">Finance lane</p><h3 className="mt-1 text-[12px] font-bold text-[#514840]">Parallel, not a cargo blocker</h3></div></div>
          <div className="mt-4 grid grid-cols-3 gap-2"><Metric label="Invoices" value={workflow.invoice_count}/><Metric label="Issued" value={workflow.issued_invoice_count}/><Metric label="Paid" value={workflow.paid_invoice_count}/></div>
          <p className="mt-3 text-[8px] leading-4 text-[#8d837b]">{workflow.billing_ready ? "Customer billing has been issued and remains traceable to this shipment." : "Operations may continue, but Accounts should create/issue the customer invoice when commercially appropriate."}</p>
          {workflow.customer_id ? <p className="mt-2 text-[8px] text-[#9a9088]">Customer <OpsMono>{workflow.customer_id}</OpsMono></p> : null}
        </div>
      </div>
    </OpsSurface>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[10px] border border-[#ece5df] bg-[#faf8f5] p-2.5"><p className="text-[7px] font-bold uppercase tracking-[.07em] text-[#9b9189]">{label}</p><p className="mt-1 text-[13px] font-bold text-[#514840]">{value}</p></div>;
}
