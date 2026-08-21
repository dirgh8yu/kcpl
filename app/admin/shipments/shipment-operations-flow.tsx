"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  ClipboardList,
  FileCheck2,
  Landmark,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import type { DigitalJobFile } from "../job-file";
import type { ShipmentWorkflowReadiness, WorkflowStageState } from "../workflow-guard";
import type { CommandCentreJob } from "../command-centre/command-centre-data";
import { shipmentStatusLabels } from "../../shipment-types";
import { OpsBadge, OpsButton, OpsMono } from "../operations-ui";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

type Snapshot = {
  workflow: ShipmentWorkflowReadiness;
  job: DigitalJobFile;
};

type ActionTone = "success" | "warning" | "danger" | "info";

type NextAction = {
  title: string;
  detail: string;
  tone: ActionTone;
};

function dateOnly(value: string | null) {
  if (!value) return "Not set";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" }).format(date);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: NEPAL_TIME_ZONE }).format(date);
}

function stageClass(state: WorkflowStageState) {
  if (state === "complete") return "border-[#b9cfbd] bg-[#eef6ef] text-[#5e7763]";
  if (state === "current") return "border-[#e0aa96] bg-[#fff4ee] text-[#ad604b]";
  if (state === "blocked") return "border-[#e4ada9] bg-[#fff1ef] text-[#ad4d50]";
  return "border-[#dfd8d2] bg-white text-[#9a9088]";
}

function stageLineClass(state: WorkflowStageState) {
  return state === "complete" ? "bg-[#a9c7b2]" : "bg-[#ddd7d1]";
}

function stageIcon(state: WorkflowStageState) {
  if (state === "complete") return <Check size={10}/>;
  if (state === "blocked") return <AlertTriangle size={10}/>;
  return <Circle size={8}/>;
}

function nextAction(workflow: ShipmentWorkflowReadiness, job: DigitalJobFile): NextAction {
  if (workflow.job_closed) return { title: "Operational lifecycle complete", detail: "The Job File is closed and retained as the permanent operational record.", tone: "success" };
  if (workflow.status === "exception") return { title: "Resolve the shipment exception", detail: "The movement is intentionally paused until staff choose the correct recovery stage.", tone: "danger" };
  if (!workflow.customer_linked) return { title: "Confirm the CRM customer", detail: "Customer ownership must be established before controlled final-mile progression.", tone: "warning" };
  if (!workflow.assigned_owner) return { title: "Assign an operational owner", detail: "No staff member currently owns this movement. Assign one in the Digital Job File.", tone: "warning" };
  if (!workflow.customs_ready) {
    const open = Math.max(0, workflow.customs_required - workflow.customs_completed);
    return { title: "Complete customs work", detail: `${open} required customs step${open === 1 ? " remains" : "s remain"} open before the cargo can clear its controlled gate.`, tone: "warning" };
  }
  if (!workflow.document_pack_ready) {
    const missing = workflow.documents.filter((item) => item.required && item.document_type !== "proof_of_delivery" && !item.present).map((item) => item.label);
    return { title: "Complete the document pack", detail: missing.length ? `Missing: ${missing.join(", ")}.` : "One or more required shipment documents are missing.", tone: "warning" };
  }
  if (workflow.status === "out_for_delivery" && !workflow.proof_of_delivery_present) return { title: "Final mile active", detail: "Delivery is in progress. Capture Proof of Delivery immediately after handover.", tone: "info" };
  if (workflow.status === "delivered" && !workflow.proof_of_delivery_present) return { title: "Upload Proof of Delivery", detail: "Delivery is recorded but POD is still required before operational closeout.", tone: "warning" };
  if (workflow.open_tasks > 0) return { title: "Finish remaining operational work", detail: `${workflow.open_tasks} open task${workflow.open_tasks === 1 ? " remains" : "s remain"} on this shipment.`, tone: "warning" };
  if (workflow.can_close) return { title: "Ready for operational closeout", detail: "Customs, documents, POD and operational tasks are complete.", tone: "success" };
  return { title: `Continue from ${shipmentStatusLabels[job.status]}`, detail: "The movement is operationally clear. Advance the next milestone from the Digital Job File when the real-world event occurs.", tone: "success" };
}

function actionToneClass(tone: ActionTone) {
  if (tone === "danger") return "border-[#efcbc8] bg-[#fff4f2] text-[#9f4d4f]";
  if (tone === "warning") return "border-[#ead7b7] bg-[#fff9ef] text-[#7c6032]";
  if (tone === "info") return "border-[#cddce7] bg-[#f3f8fb] text-[#4f7187]";
  return "border-[#ceddce] bg-[#f3f8f3] text-[#5c7460]";
}

function gateTone(ok: boolean, danger = false) {
  if (ok) return "border-[#d2dfd3] bg-[#f5f9f5]";
  return danger ? "border-[#efcfcc] bg-[#fff6f4]" : "border-[#eadcc8] bg-[#fffaf2]";
}

export function ShipmentOperationsFlow({ job: fallbackJob, operationalDate }: { job: CommandCentreJob; operationalDate: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading((current) => current || !snapshot);
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(fallbackJob.reference)}`, { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; workflow?: ShipmentWorkflowReadiness; job?: DigitalJobFile; error?: string };
      if (!response.ok || !payload.workflow || !payload.job) throw new Error(payload.error || "Live shipment readiness could not be loaded.");
      setSnapshot({ workflow: payload.workflow, job: payload.job });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Live shipment readiness could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [fallbackJob.reference, snapshot]);

  useEffect(() => {
    let active = true;
    const load = async () => { if (active) await refresh(); };
    void load();
    const timer = window.setInterval(() => { if (active) void refresh(); }, 15_000);
    const onFocus = () => { if (active) void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const workflow = snapshot?.workflow ?? null;
  const liveJob = snapshot?.job ?? null;
  const action = useMemo(() => workflow && liveJob ? nextAction(workflow, liveJob) : null, [liveJob, workflow]);
  const operationalRequiredDocs = workflow?.documents.filter((item) => item.required && item.document_type !== "proof_of_delivery") ?? [];
  const presentOperationalDocs = operationalRequiredDocs.filter((item) => item.present).length;
  const customsOpen = workflow ? Math.max(0, workflow.customs_required - workflow.customs_completed) : fallbackJob.required_customs_open;
  const etaDate = (liveJob?.eta ?? fallbackJob.eta)?.slice(0, 10) ?? "";
  const etaUrgent = Boolean(etaDate && etaDate <= operationalDate && (liveJob?.status ?? fallbackJob.status) !== "delivered");
  const owner = liveJob?.assigned_to_name || liveJob?.assigned_to_email || fallbackJob.assigned_to_name || fallbackJob.assigned_to_email || "Unassigned";
  const location = liveJob?.current_location || fallbackJob.current_location || "Not updated";
  const branch = liveJob?.primary_branch || fallbackJob.primary_branch;
  const openTasks = workflow?.open_tasks ?? fallbackJob.open_tasks;

  if (!workflow || !liveJob) {
    return <section className="rounded-[13px] border border-[#e7dfd8] bg-[#faf8f5] p-4">
      <div className="flex items-center justify-between gap-3"><div><p className="ops-eyebrow">Operations flow</p><h3 className="mt-1 text-[12px] font-bold text-[#514840]">{loading ? "Loading live readiness…" : "Live readiness unavailable"}</h3></div><OpsButton variant="ghost" size="sm" disabled={loading} onClick={() => void refresh()}><RefreshCw size={11}/>{loading ? "Loading" : "Retry"}</OpsButton></div>
      <div className="mt-3 grid grid-cols-3 gap-2"><FallbackGate label="Tasks" value={`${fallbackJob.open_tasks} open`}/><FallbackGate label="Customs" value={`${fallbackJob.required_customs_open} open`}/><FallbackGate label="ETA" value={dateOnly(fallbackJob.eta)}/></div>
      {error ? <p className="mt-3 text-[9px] leading-4 text-[#9d5150]">{error} Existing shipment data remains visible and unchanged.</p> : null}
    </section>;
  }

  return <section className="rounded-[14px] border border-[#e5ddd6] bg-[#fffdfa] p-4 shadow-[0_8px_28px_rgba(70,52,40,.035)]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="ops-eyebrow">Live operations flow</p><h3 className="mt-1 text-[13px] font-[740] text-[#49413b]">One shipment, one control strip</h3><p className="mt-1 text-[9px] leading-4 text-[#8b8179]">Movement, ownership, customs, documents, tasks and billing readiness share one live view.</p></div>
      <div className="flex items-center gap-2"><OpsBadge tone={workflow.blockers.length || liveJob.status === "exception" ? "warning" : "success"}>{workflow.blockers.length || liveJob.status === "exception" ? "Action required" : "Operationally clear"}</OpsBadge><OpsButton variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw size={11}/>{loading ? "Refreshing" : "Refresh"}</OpsButton></div>
    </div>

    <div className="mt-4 overflow-x-auto pb-1">
      <div className="flex min-w-[670px] items-start">
        {workflow.stages.map((stage, index) => <div key={stage.id} className="relative min-w-0 flex-1 px-1">
          {index < workflow.stages.length - 1 ? <span className={`absolute left-[calc(50%+12px)] right-[calc(-50%+12px)] top-[12px] h-px ${stageLineClass(stage.state)}`} aria-hidden="true"/> : null}
          <div className="relative z-10 flex flex-col items-center text-center"><span className={`grid h-6 w-6 place-items-center rounded-full border ${stageClass(stage.state)}`}>{stageIcon(stage.state)}</span><span className={`mt-1.5 text-[8px] font-bold ${stage.state === "current" || stage.state === "blocked" ? "text-[#5d514a]" : "text-[#8d837b]"}`}>{stage.label}</span></div>
        </div>)}
      </div>
    </div>

    {action ? <div className={`mt-4 rounded-[11px] border p-3 ${actionToneClass(action.tone)}`}><div className="flex items-start gap-2.5"><AlertTriangle size={12} className="mt-0.5 shrink-0"/><div><strong className="block text-[10px]">{action.title}</strong><p className="mt-1 text-[8px] leading-4 opacity-90">{action.detail}</p></div></div></div> : null}

    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Gate icon={<UserRound size={11}/>} label="Owner" value={owner} ok={workflow.assigned_owner}/>
      <Gate icon={<ShieldCheck size={11}/>} label="Customs" value={`${workflow.customs_completed}/${workflow.customs_required} complete`} ok={workflow.customs_ready} danger={customsOpen > 0 && (liveJob.status === "customs_clearance" || etaUrgent)}/>
      <Gate icon={<FileCheck2 size={11}/>} label="Documents" value={`${presentOperationalDocs}/${operationalRequiredDocs.length} ready`} ok={workflow.document_pack_ready}/>
      <Gate icon={<ClipboardList size={11}/>} label="Tasks" value={openTasks ? `${openTasks} open` : "Clear"} ok={openTasks === 0}/>
      <Gate icon={<CalendarDays size={11}/>} label="ETA" value={dateOnly(liveJob.eta)} ok={!etaUrgent} danger={etaUrgent}/>
      <Gate icon={<WalletCards size={11}/>} label="Billing" value={workflow.billing_ready ? `${workflow.issued_invoice_count} issued` : `${workflow.invoice_count} invoice${workflow.invoice_count === 1 ? "" : "s"}`} ok={workflow.billing_ready}/>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-[#eee7e1] pt-4">
      <FlowFact icon={<MapPin size={11}/>} label="Current location" value={location}/>
      <FlowFact icon={<Landmark size={11}/>} label="Primary branch" value={branch}/>
      <FlowFact label="Shipment status" value={shipmentStatusLabels[liveJob.status]}/>
      <FlowFact label="Reference" value={liveJob.reference} mono/>
    </div>

    {workflow.close_blockers.length && liveJob.status === "delivered" ? <div className="mt-4"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#9a7065]">Closeout blockers</p><div className="mt-2 space-y-1.5">{workflow.close_blockers.slice(0, 3).map((blocker) => <p key={blocker} className="flex items-start gap-1.5 text-[8px] leading-4 text-[#8f5b55]"><AlertTriangle size={9} className="mt-0.5 shrink-0"/>{blocker}</p>)}</div></div> : null}

    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eee7e1] pt-4">
      <Link href={`/admin/jobs/${encodeURIComponent(liveJob.reference)}`} className="ops-button" data-variant="primary" data-size="sm">Resolve in Job File <ArrowRight size={11}/></Link>
      {!workflow.customs_ready ? <Link href="/admin/customs" className="ops-button" data-variant="secondary" data-size="sm">Customs Desk</Link> : null}
      {workflow.open_tasks > 0 ? <Link href="/admin/alerts" className="ops-button" data-variant="secondary" data-size="sm">Tasks & alerts</Link> : null}
      {liveJob.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(liveJob.customer_id)}`} className="ops-button" data-variant="ghost" data-size="sm">Customer 360</Link> : null}
    </div>
  </section>;
}

function Gate({ icon, label, value, ok, danger = false }: { icon: React.ReactNode; label: string; value: string; ok: boolean; danger?: boolean }) {
  return <div className={`rounded-[10px] border p-2.5 ${gateTone(ok, danger)}`}><p className="flex items-center gap-1.5 text-[8px] font-semibold text-[#8b8179]">{icon}{label}</p><p className={`mt-1.5 line-clamp-2 text-[9px] font-bold ${ok ? "text-[#526b57]" : danger ? "text-[#a34f4f]" : "text-[#806334]"}`}>{value}</p></div>;
}

function FallbackGate({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[9px] border border-[#e7dfd8] bg-white p-2.5"><p className="text-[8px] font-semibold text-[#938981]">{label}</p><p className="mt-1 text-[9px] font-bold text-[#5c534d]">{value}</p></div>;
}

function FlowFact({ icon, label, value, mono = false }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return <div><p className="flex items-center gap-1.5 text-[8px] font-semibold text-[#938981]">{icon}{label}</p><p className="mt-1 break-words text-[9px] font-bold text-[#5c534d]">{mono ? <OpsMono>{value}</OpsMono> : value}</p></div>;
}
