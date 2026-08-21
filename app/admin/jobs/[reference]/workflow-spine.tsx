"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Circle,
  ClipboardCheck,
  FileCheck2,
  Landmark,
  LockKeyhole,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Truck,
  Upload,
  UserRound,
} from "lucide-react";
import type { DigitalJobFile } from "../../job-file";
import { shipmentStatusLabels, type ShipmentStatus } from "../../../shipment-types";
import type { ShipmentWorkflowReadiness } from "../../workflow-guard";
import { StaffAssignmentPicker, type StaffAssignmentValue } from "../../staff-assignment-picker";
import { OpsBadge, OpsButton, OpsField, OpsMono, OpsNotice, OpsProgress, OpsSurface } from "../../operations-ui";

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

function isFailure(message: string) {
  const value = message.toLowerCase();
  return value.includes("could not") || value.includes("blocked") || value.includes("failed") || value.includes("required");
}

type NextAction =
  | { kind: "customer" }
  | { kind: "owner" }
  | { kind: "customs" }
  | { kind: "documents" }
  | { kind: "milestone"; status: ShipmentStatus }
  | { kind: "pod" }
  | { kind: "tasks" }
  | { kind: "close" }
  | { kind: "exception" }
  | { kind: "closed" }
  | { kind: "review" };

export function WorkflowSpine({ initialWorkflow, initialJob, canOverride }: { initialWorkflow: ShipmentWorkflowReadiness; initialJob: DigitalJobFile; canOverride: boolean }) {
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [job, setJob] = useState(initialJob);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [owner, setOwner] = useState<StaffAssignmentValue>({
    name: initialJob.assigned_to_name ?? "",
    email: initialJob.assigned_to_email ?? "",
    phone: initialJob.assigned_to_phone ?? "",
  });

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/jobs/${encodeURIComponent(workflow.reference)}`, { cache: "no-store" });
    const data = await response.json() as { workflow?: ShipmentWorkflowReadiness; job?: DigitalJobFile; error?: string };
    if (!response.ok || !data.workflow || !data.job) throw new Error(data.error || "Could not refresh workflow readiness.");
    setWorkflow(data.workflow);
    setJob(data.job);
    setOwner({
      name: data.job.assigned_to_name ?? "",
      email: data.job.assigned_to_email ?? "",
      phone: data.job.assigned_to_phone ?? "",
    });
    return data;
  }, [workflow.reference]);

  useEffect(() => {
    const timer = window.setInterval(() => refresh().catch(() => undefined), 5000);
    const onFocus = () => refresh().catch(() => undefined);
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  async function closeJob(overrideReason = "") {
    setBusy("close"); setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(workflow.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "close_job", overrideReason }),
      });
      const data = await response.json() as { workflow?: ShipmentWorkflowReadiness; error?: string; blockers?: string[]; canOverride?: boolean };
      if (!response.ok) throw Object.assign(new Error(data.error || "The Job File could not be closed."), { data });
      await refresh();
      setNotice(overrideReason ? "Job closed with a recorded management override." : "Operational closeout complete. Job File locked as closed.");
    } catch (error) {
      const payload = (error as Error & { data?: { blockers?: string[]; canOverride?: boolean } }).data;
      if (payload?.canOverride && canOverride) {
        const reason = window.prompt(`Closeout is blocked:\n\n${(payload.blockers ?? []).join("\n")}\n\nManagement override reason:`)?.trim() ?? "";
        if (reason.length >= 8) { setBusy(""); await closeJob(reason); return; }
      }
      setNotice(error instanceof Error ? error.message : "The Job File could not be closed.");
    } finally { setBusy(""); }
  }

  async function reopenJob() {
    const reason = window.prompt("Why is this closed Job File being reopened? This reason will be audited.")?.trim() ?? "";
    if (reason.length < 8) { setNotice("Add a meaningful reopening reason of at least 8 characters."); return; }
    setBusy("reopen"); setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(workflow.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reopen_job", reason }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The Job File could not be reopened.");
      await refresh();
      setNotice("Job File reopened and returned to active operations.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "The Job File could not be reopened."); }
    finally { setBusy(""); }
  }

  async function saveOwner() {
    setBusy("owner"); setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(workflow.reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          primaryBranch: job.primary_branch,
          handlingBranches: job.handling_branches,
          assignedToName: owner.name,
          assignedToEmail: owner.email,
          assignedToPhone: owner.phone,
          priority: job.priority,
          internalReference: job.internal_reference ?? "",
          internalNotes: job.internal_notes ?? "",
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not assign the shipment owner.");
      await refresh();
      setNotice(owner.name || owner.email ? `Shipment ownership assigned to ${owner.name || owner.email}.` : "Shipment owner cleared.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not assign the shipment owner."); }
    finally { setBusy(""); }
  }

  async function completeCustoms(stepId: string, title: string) {
    setBusy(`customs:${stepId}`); setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(workflow.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "toggle_customs", stepId, completed: true }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not complete the customs step.");
      await refresh();
      setNotice(`${title} marked complete.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not complete the customs step."); }
    finally { setBusy(""); }
  }

  async function completeTask(taskId: string, title: string) {
    setBusy(`task:${taskId}`); setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(workflow.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "toggle_task", taskId, completed: true }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not complete the task.");
      await refresh();
      setNotice(`${title} completed.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not complete the task."); }
    finally { setBusy(""); }
  }

  async function uploadRequiredDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const type = String(formData.get("documentType") || "document");
    setBusy("document"); setNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(workflow.reference)}/documents`, { method: "POST", body: formData });
      const data = await response.json() as { document?: { filename: string }; error?: string };
      if (!response.ok || !data.document) throw new Error(data.error || "Could not upload the required document.");
      form.reset();
      await refresh();
      setNotice(`${data.document.filename} uploaded to ${type.replaceAll("_", " ")}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not upload the required document."); }
    finally { setBusy(""); }
  }

  async function advanceShipment(nextStatus: ShipmentStatus, overrideReason = "") {
    setBusy("milestone"); setNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(workflow.reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          eta: job.eta ?? "",
          currentLocation: job.current_location ?? "",
          carrier: job.carrier ?? "",
          carrierReference: job.carrier_reference ?? "",
          customerNote: "",
          overrideReason,
        }),
      });
      const data = await response.json() as { error?: string; blockers?: string[]; canOverride?: boolean; overrideUsed?: boolean };
      if (!response.ok) {
        if (response.status === 409 && data.canOverride && canOverride) {
          const reason = window.prompt(`Workflow guard blocked this milestone:\n\n${(data.blockers ?? [data.error ?? "Controlled milestone not ready."]).join("\n")}\n\nManagement override reason:`)?.trim() ?? "";
          if (reason.length >= 8) { setBusy(""); await advanceShipment(nextStatus, reason); return; }
        }
        throw new Error(data.error || "Could not advance the shipment milestone.");
      }
      await refresh();
      setNotice(data.overrideUsed ? `${shipmentStatusLabels[nextStatus]} recorded with a management override.` : `Shipment advanced to ${shipmentStatusLabels[nextStatus]}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not advance the shipment milestone."); }
    finally { setBusy(""); }
  }

  const requiredDocs = workflow.documents.filter((item) => item.required);
  const presentDocs = requiredDocs.filter((item) => item.present).length;
  const operationalMissingDocs = workflow.documents.filter((item) => item.required && item.document_type !== "proof_of_delivery" && !item.present);
  const openCustoms = job.customs_steps.filter((item) => item.required && !item.completed);
  const openTasks = job.tasks.filter((item) => !item.completed);
  const stagePercent = Math.round((workflow.stages.filter((stage) => stage.state === "complete").length / workflow.stages.length) * 100);

  const nextAction = useMemo<NextAction>(() => {
    if (workflow.job_closed) return { kind: "closed" };
    if (!workflow.customer_linked) return { kind: "customer" };
    if (!workflow.assigned_owner) return { kind: "owner" };
    if (workflow.status === "booking_confirmed") return { kind: "milestone", status: "preparing" };
    if (!workflow.customs_ready) return { kind: "customs" };
    if (!workflow.document_pack_ready) return { kind: "documents" };
    if (workflow.status === "preparing") return { kind: "milestone", status: "in_transit" };
    if (workflow.status === "in_transit" || workflow.status === "customs_clearance") return { kind: "milestone", status: "out_for_delivery" };
    if (workflow.status === "out_for_delivery") return { kind: "milestone", status: "delivered" };
    if (workflow.status === "exception") return { kind: "exception" };
    if (workflow.status === "delivered" && !workflow.proof_of_delivery_present) return { kind: "pod" };
    if (workflow.status === "delivered" && workflow.open_tasks > 0) return { kind: "tasks" };
    if (workflow.can_close) return { kind: "close" };
    return { kind: "review" };
  }, [workflow]);

  return <div className="ops-content-wide pt-5">
    <OpsSurface
      eyebrow="Controlled lifecycle"
      title="One shipment, one continuous operation"
      description="Ownership, customs, documents, movement milestones and closeout now work from the same control spine. The detailed Job File remains below for deeper handling."
      action={<div className="flex flex-wrap gap-2"><OpsButton variant="secondary" size="sm" disabled={Boolean(busy)} onClick={() => refresh().catch((error) => setNotice(error instanceof Error ? error.message : "Refresh failed."))}><RefreshCw size={11}/>Refresh</OpsButton>{workflow.job_closed ? canOverride ? <OpsButton variant="secondary" size="sm" disabled={Boolean(busy)} onClick={reopenJob}><RotateCcw size={11}/>Reopen job</OpsButton> : null : <OpsButton variant="primary" size="sm" disabled={Boolean(busy)} onClick={() => closeJob()}><LockKeyhole size={11}/>{workflow.can_close ? "Close job" : canOverride ? "Close / override" : "Close job"}</OpsButton>}</div>}
    >
      {notice ? <div className="mb-4"><OpsNotice tone={isFailure(notice) ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}

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

      <div className="mt-5 rounded-[14px] border border-[#e7d9d0] bg-[#fff9f5] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="ops-eyebrow">Next operational action</p><h3 className="mt-1 text-[14px] font-[740] text-[#473f39]">{nextActionTitle(nextAction, workflow)}</h3><p className="mt-1 max-w-3xl text-[9px] leading-5 text-[#81766e]">{nextActionDetail(nextAction, workflow)}</p></div>
          <div className="flex flex-wrap gap-2"><OpsBadge tone="info"><Truck size={10}/>{shipmentStatusLabels[workflow.status]}</OpsBadge><OpsBadge tone={workflow.assigned_owner ? "success" : "warning"}><UserRound size={10}/>{workflow.assigned_owner ? (job.assigned_to_name || job.assigned_to_email || "Owned") : "Unassigned"}</OpsBadge></div>
        </div>

        <div className="mt-4">
          {nextAction.kind === "owner" ? <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]"><StaffAssignmentPicker branch={job.primary_branch} value={owner} onChange={setOwner}/><OpsButton variant="primary" disabled={Boolean(busy) || (!owner.name && !owner.email)} onClick={saveOwner}><UserRound size={12}/>{busy === "owner" ? "Assigning…" : "Assign owner"}</OpsButton></div> : null}

          {nextAction.kind === "customs" ? <div className="grid gap-2">{openCustoms.slice(0, 4).map((step) => <div key={step.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-[#eadfd7] bg-white p-3"><div><strong className="text-[10px] text-[#514840]">{step.title}</strong><p className="mt-1 text-[8px] text-[#928880]">{step.branch}{step.detail ? ` · ${step.detail}` : ""}</p></div><OpsButton variant="secondary" size="sm" disabled={Boolean(busy)} onClick={() => completeCustoms(step.id, step.title)}><ShieldCheck size={11}/>{busy === `customs:${step.id}` ? "Saving…" : "Mark complete"}</OpsButton></div>)}</div> : null}

          {nextAction.kind === "documents" || nextAction.kind === "pod" ? <form onSubmit={uploadRequiredDocument} className="grid gap-3 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)_auto]">
            <OpsField label="Required document"><select name="documentType" defaultValue={nextAction.kind === "pod" ? "proof_of_delivery" : operationalMissingDocs[0]?.document_type}>{nextAction.kind === "pod" ? <option value="proof_of_delivery">Proof of Delivery</option> : operationalMissingDocs.map((item) => <option key={item.document_type} value={item.document_type}>{item.label}</option>)}</select></OpsField>
            <OpsField label="File"><input required name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"/></OpsField>
            <div className="self-end"><OpsButton variant="primary" disabled={Boolean(busy)}><Upload size={11}/>{busy === "document" ? "Uploading…" : nextAction.kind === "pod" ? "Upload POD" : "Upload document"}</OpsButton></div>
          </form> : null}

          {nextAction.kind === "milestone" ? <div className="flex flex-wrap items-center gap-3"><OpsButton variant="primary" disabled={Boolean(busy)} onClick={() => advanceShipment(nextAction.status)}><ArrowRight size={12}/>{busy === "milestone" ? "Updating…" : `Move to ${shipmentStatusLabels[nextAction.status]}`}</OpsButton><span className="text-[8px] text-[#928880]">Current location, ETA and carrier are preserved from this Job File.</span></div> : null}

          {nextAction.kind === "tasks" ? <div className="grid gap-2">{openTasks.slice(0, 4).map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-[#eadfd7] bg-white p-3"><div><strong className="text-[10px] text-[#514840]">{task.title}</strong><p className="mt-1 text-[8px] text-[#928880]">{task.branch}{task.assigned_to_name || task.assigned_to_email ? ` · ${task.assigned_to_name || task.assigned_to_email}` : " · Unassigned"}</p></div><OpsButton variant="secondary" size="sm" disabled={Boolean(busy)} onClick={() => completeTask(task.id, task.title)}><ClipboardCheck size={11}/>{busy === `task:${task.id}` ? "Saving…" : "Complete"}</OpsButton></div>)}{openTasks.length > 4 ? <p className="text-[8px] text-[#928880]">+ {openTasks.length - 4} more open tasks in the detailed Job File below.</p> : null}</div> : null}

          {nextAction.kind === "close" ? <OpsButton variant="primary" disabled={Boolean(busy)} onClick={() => closeJob()}><PackageCheck size={12}/>{busy === "close" ? "Closing…" : "Close operational job"}</OpsButton> : null}

          {nextAction.kind === "customer" ? <div className="flex items-start gap-2 rounded-[11px] border border-[#efd4cf] bg-white p-3 text-[9px] leading-5 text-[#92524c]"><AlertTriangle size={12} className="mt-0.5 shrink-0"/><span>Return to the linked enquiry or Customer 360 and confirm the CRM customer. Controlled final-mile milestones remain blocked until ownership is established.</span></div> : null}
          {nextAction.kind === "exception" ? <div className="flex items-start gap-2 rounded-[11px] border border-[#efd4cf] bg-white p-3 text-[9px] leading-5 text-[#92524c]"><AlertTriangle size={12} className="mt-0.5 shrink-0"/><span>This shipment is in Exception. Resolve the operational issue, then use the Shipment workspace to return it to the appropriate movement stage.</span></div> : null}
          {nextAction.kind === "closed" ? <div className="flex items-start gap-2 rounded-[11px] border border-[#d6e1d6] bg-white p-3 text-[9px] leading-5 text-[#607563]"><LockKeyhole size={12} className="mt-0.5 shrink-0"/><span>This operational job is closed. Its shipment, documents, customs controls and audit trail remain available as the permanent record.</span></div> : null}
          {nextAction.kind === "review" ? <div className="flex items-start gap-2 rounded-[11px] border border-[#eadfd7] bg-white p-3 text-[9px] leading-5 text-[#776d65]"><AlertTriangle size={12} className="mt-0.5 shrink-0"/><span>Review the remaining closeout controls below. The workflow is not yet ready for an automatic next milestone.</span></div> : null}
        </div>
      </div>

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

function nextActionTitle(action: NextAction, workflow: ShipmentWorkflowReadiness) {
  if (action.kind === "customer") return "Confirm the CRM customer";
  if (action.kind === "owner") return "Assign an operational owner";
  if (action.kind === "customs") return "Clear the next required customs step";
  if (action.kind === "documents") return "Complete the operational document pack";
  if (action.kind === "milestone") return `Advance movement to ${shipmentStatusLabels[action.status]}`;
  if (action.kind === "pod") return "Capture Proof of Delivery";
  if (action.kind === "tasks") return `Finish ${workflow.open_tasks} remaining operational task${workflow.open_tasks === 1 ? "" : "s"}`;
  if (action.kind === "close") return "Close the operational job";
  if (action.kind === "exception") return "Resolve the shipment exception";
  if (action.kind === "closed") return "Operational lifecycle complete";
  return "Review remaining controls";
}

function nextActionDetail(action: NextAction, workflow: ShipmentWorkflowReadiness) {
  if (action.kind === "customer") return "Customer ownership is the first controlled relationship gate for this shipment.";
  if (action.kind === "owner") return "Choose a staff member from People & branches. Their name, email and phone are carried into the Job File.";
  if (action.kind === "customs") return `${workflow.customs_required - workflow.customs_completed} required customs step${workflow.customs_required - workflow.customs_completed === 1 ? " remains" : "s remain"}. Complete them here without leaving the shipment.`;
  if (action.kind === "documents") return "Upload the missing required document directly into the shipment vault. Readiness refreshes automatically.";
  if (action.kind === "milestone") return "The workflow guard checks the movement transition before saving it. Management overrides remain audited.";
  if (action.kind === "pod") return "Delivery is recorded. POD is the evidence gate required before operational closeout.";
  if (action.kind === "tasks") return "Close the remaining work items before locking the Job File.";
  if (action.kind === "close") return "Customs, required documents, POD and operational tasks are complete.";
  if (action.kind === "exception") return "Exception is intentionally not auto-advanced because the correct recovery stage depends on the real-world issue.";
  if (action.kind === "closed") return "The shipment record is locked for operations but retained for audit, finance and customer history.";
  return "One or more controls need review before the workflow can recommend the next move.";
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[10px] border border-[#ece5df] bg-[#faf8f5] p-2.5"><p className="text-[7px] font-bold uppercase tracking-[.07em] text-[#9b9189]">{label}</p><p className="mt-1 text-[13px] font-bold text-[#514840]">{value}</p></div>;
}
