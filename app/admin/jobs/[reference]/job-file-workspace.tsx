"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  Landmark,
  LockKeyhole,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { kcplBranches, crmCurrencies, type KcplBranch, type CrmCurrency } from "../../crm/crm-data";
import {
  jobCostCategories,
  jobCostCategoryLabels,
  jobPriorities,
  jobPriorityLabels,
  type CustomsStep,
  type DigitalJobFile,
  type JobCostCategory,
  type JobPriority,
  type JobTask,
} from "../../job-file";
import { kcplStaffRoleLabels, type KcplStaffRole } from "../../staff-permissions";
import type { ShipmentWorkflowReadiness } from "../../workflow-guard";
import { StaffAssignmentPicker } from "../../staff-assignment-picker";
import { shipmentDocumentTypeLabels, shipmentDocumentTypes, type ShipmentDocument } from "../../../shipment-document-types";
import { shipmentStatusLabels, type ShipmentStatus } from "../../../shipment-types";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsKpiCard, OpsKpiStrip, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsProgress, OpsSurface } from "../../operations-ui";
import { FreeTimeControl, type FreeTimePanelData } from "./free-time-control";

function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function dateTime(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusTone(status: ShipmentStatus): "neutral" | "info" | "warning" | "violet" | "success" | "danger" {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "customs_clearance") return "violet";
  if (status === "preparing") return "warning";
  if (status === "booking_confirmed" || status === "in_transit" || status === "out_for_delivery") return "info";
  return "neutral";
}

export function JobFileWorkspace({
  initialJob,
  initialReadiness,
  returnTo,
  role,
  canManageBranches,
  canOverride,
  currentUserName,
  currentUserEmail,
  nowIso,
  freeTime,
  canManageJobFile,
}: {
  initialJob: DigitalJobFile;
  initialReadiness: ShipmentWorkflowReadiness;
  returnTo: string;
  role: KcplStaffRole;
  canManageBranches: boolean;
  canOverride: boolean;
  currentUserName: string;
  currentUserEmail: string;
  nowIso: string;
  freeTime: FreeTimePanelData | null;
  canManageJobFile: boolean;
}) {
  const [job, setJob] = useState(initialJob);
  const [workflow, setWorkflow] = useState(initialReadiness);
  const [closeReason, setCloseReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [taskOpen, setTaskOpen] = useState(false);
  const [customsOpen, setCustomsOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [draft, setDraft] = useState({
    primaryBranch: job.primary_branch,
    handlingBranches: job.handling_branches,
    assignedToUid: job.assigned_to_uid ?? "",
    assignedToName: job.assigned_to_name ?? "",
    assignedToEmail: job.assigned_to_email ?? "",
    assignedToPhone: job.assigned_to_phone ?? "",
    priority: job.priority,
    internalReference: job.internal_reference ?? "",
    internalNotes: job.internal_notes ?? "",
  });
  const [task, setTask] = useState({ title: "", detail: "", branch: job.primary_branch, dueAt: "", assignedToUid: "", assignedToName: currentUserName, assignedToEmail: currentUserEmail, assignedToPhone: "" });
  const [customs, setCustoms] = useState({ title: "", detail: "", branch: job.primary_branch, required: true });
  const [cost, setCost] = useState({ category: "freight" as JobCostCategory, label: "", vendor: "", amount: "", currency: "NPR" as CrmCurrency, notes: "" });

  const nowMs = Date.parse(nowIso);
  const openTasks = useMemo(() => job.tasks.filter((item) => !item.completed), [job.tasks]);
  const overdueTasks = useMemo(() => openTasks.filter((item) => item.due_at && new Date(item.due_at).getTime() < nowMs), [nowMs, openTasks]);
  const requiredCustoms = useMemo(() => job.customs_steps.filter((item) => item.required), [job.customs_steps]);
  const completedCustoms = requiredCustoms.filter((item) => item.completed).length;

  async function refresh() {
    const response = await fetch(`/api/admin/jobs/${encodeURIComponent(job.reference)}`, { cache: "no-store" });
    const data = await response.json() as { job?: DigitalJobFile; workflow?: ShipmentWorkflowReadiness; error?: string };
    if (!response.ok || !data.job) throw new Error(data.error || "Could not refresh the Job File.");
    setJob(data.job);
    if (data.workflow) setWorkflow(data.workflow);
    setDraft({
      primaryBranch: data.job.primary_branch,
      handlingBranches: data.job.handling_branches,
      assignedToUid: data.job.assigned_to_uid ?? "",
      assignedToName: data.job.assigned_to_name ?? "",
      assignedToEmail: data.job.assigned_to_email ?? "",
      assignedToPhone: data.job.assigned_to_phone ?? "",
      priority: data.job.priority,
      internalReference: data.job.internal_reference ?? "",
      internalNotes: data.job.internal_notes ?? "",
    });
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/shipments/${encodeURIComponent(job.reference)}/documents`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { documents?: ShipmentDocument[]; storageAvailable?: boolean; error?: string };
        if (!response.ok || !data.documents) throw new Error(data.error || "Could not load job documents.");
        setDocuments(data.documents);
        setStorageAvailable(data.storageAvailable !== false);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNotice(error instanceof Error ? error.message : "Could not load job documents.");
      })
      .finally(() => setDocumentsLoading(false));
    return () => controller.abort();
  }, [job.reference]);

  async function saveSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(job.reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the Job File.");
      await refresh();
      setSetupOpen(false);
      setNotice("Digital Job File updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the Job File.");
    } finally { setBusy(false); }
  }

  async function action(body: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(job.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "The Job File action could not be saved.");
      await refresh();
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Job File action could not be saved.");
      return false;
    } finally { setBusy(false); }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await action({ action: "add_task", ...task })) {
      setTask({ title: "", detail: "", branch: job.primary_branch, dueAt: "", assignedToUid: "", assignedToName: currentUserName, assignedToEmail: currentUserEmail, assignedToPhone: "" });
      setTaskOpen(false);
      setNotice("Operational task added.");
    }
  }

  async function addCustoms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await action({ action: "add_customs", ...customs })) {
      setCustoms({ title: "", detail: "", branch: job.primary_branch, required: true });
      setCustomsOpen(false);
      setNotice("Customs step added.");
    }
  }

  async function addCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await action({ action: "add_cost", ...cost, amount: Number(cost.amount) })) {
      setCost({ category: "freight", label: "", vendor: "", amount: "", currency: "NPR", notes: "" });
      setCostOpen(false);
      setNotice("Job cost added.");
    }
  }

  // Closeout completes the operational lifecycle. The API re-checks customs, required
  // documents, POD and open tasks, so the panel only ever reflects the real guard result.
  async function closeJob(overrideReason = "") {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(job.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "close_job", overrideReason }),
      });
      const data = await response.json() as { workflow?: ShipmentWorkflowReadiness; overrideUsed?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "The Job File could not be closed.");
      await refresh();
      setCloseReason("");
      setNotice(data.overrideUsed ? "Job closed with a recorded management override." : "Operational closeout complete. Job File locked as closed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Job File could not be closed.");
    } finally { setBusy(false); }
  }

  async function reopenJob() {
    const reason = closeReason.trim();
    if (reason.length < 8) {
      setNotice("Add a reopening reason of at least 8 characters. Management reasons are audited.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(job.reference)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reopen_job", reason }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The Job File could not be reopened.");
      await refresh();
      setCloseReason("");
      setNotice("Job File reopened and returned to active operations.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Job File could not be reopened.");
    } finally { setBusy(false); }
  }

  function toggleHandlingBranch(branch: KcplBranch) {
    if (!canManageBranches) return;
    setDraft((current) => ({
      ...current,
      handlingBranches: current.handlingBranches.includes(branch)
        ? current.handlingBranches.filter((item) => item !== branch)
        : [...current.handlingBranches, branch],
    }));
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setDocumentBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(job.reference)}/documents`, { method: "POST", body: new FormData(form) });
      const data = await response.json() as { document?: ShipmentDocument; error?: string };
      if (!response.ok || !data.document) throw new Error(data.error || "Could not upload the document.");
      setDocuments((current) => [data.document!, ...current]);
      form.reset();
      setNotice(`${data.document.filename} uploaded. Review is required before it counts toward controlled readiness.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not upload the document."); }
    finally { setDocumentBusy(false); }
  }

  async function deleteDocument(document: ShipmentDocument) {
    if (!window.confirm(`Delete ${document.filename}?`)) return;
    setDocumentBusy(true);
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(job.reference)}/documents/${document.id}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete the document.");
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setNotice(`${document.filename} deleted.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete the document."); }
    finally { setDocumentBusy(false); }
  }

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Digital Job File"
        title={<OpsMono>{job.reference}</OpsMono>}
        description={<span className="flex flex-wrap items-center gap-2"><strong className="text-[var(--admin-ink)]">{job.customer_name || "Customer not linked"}</strong><span>{job.origin || "Origin"}</span><ArrowRight size={12} className="text-[var(--admin-crimson)]"/><span>{job.destination || "Destination"}</span></span>}
        meta={<><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge><OpsBadge>{kcplStaffRoleLabels[role]}</OpsBadge><span>Quote <OpsMono>{job.quote_reference}</OpsMono></span><span>Updated {dateTime(job.updated_at)}</span></>}
        actions={<><Link href={returnTo} className="ops-button" data-variant="secondary" data-size="md">Back to shipments</Link><OpsButton variant="secondary" onClick={() => setSetupOpen((current) => !current)}><BriefcaseBusiness size={13}/>{setupOpen ? "Close setup" : "Edit handling"}</OpsButton><OpsButton variant="primary" onClick={() => refresh().catch((error) => setNotice(error instanceof Error ? error.message : "Refresh failed."))}><RefreshCw size={13}/>Refresh</OpsButton></>}
      />

      <OpsKpiStrip>
        <OpsKpiCard label="Primary branch" value={job.primary_branch} icon={<Landmark size={18} strokeWidth={1.9} aria-hidden="true"/>} />
        <OpsKpiCard label="Open tasks" value={openTasks.length} detail={overdueTasks.length ? `${overdueTasks.length} overdue` : "No overdue work"} icon={<ClipboardCheck size={18} strokeWidth={1.9} aria-hidden="true"/>} tone={overdueTasks.length ? "danger" : "neutral"}/>
        <OpsKpiCard label="Customs" value={`${completedCustoms}/${requiredCustoms.length}`} detail="required steps complete" icon={<ShieldCheck size={18} strokeWidth={1.9} aria-hidden="true"/>} tone={requiredCustoms.length && completedCustoms < requiredCustoms.length ? "warning" : "success"}/>
        <OpsKpiCard label="Documents" value={documents.length} icon={<FileText size={18} strokeWidth={1.9} aria-hidden="true"/>} />
        <OpsKpiCard label="ETA" value={dateLabel(job.eta)} icon={<CalendarDays size={18} strokeWidth={1.9} aria-hidden="true"/>} />
        <OpsKpiCard label="Priority" value={jobPriorityLabels[job.priority]} icon={<BriefcaseBusiness size={18} strokeWidth={1.9} aria-hidden="true"/>} tone={job.priority === "urgent" ? "danger" : job.priority === "high" ? "warning" : "neutral"}/>
      </OpsKpiStrip>

      <div className="ops-content-wide ops-stack">
        {notice ? <OpsNotice tone={notice.toLowerCase().includes("could not") || notice.toLowerCase().includes("failed") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}

        {setupOpen ? <OpsSurface eyebrow="Handling setup" title="Ownership, branches & private instructions" description="Edit the operational spine of this file. Changes stay internal to KCPL.">
          <form onSubmit={saveSetup} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <OpsField label="Primary branch"><select disabled={!canManageBranches} value={draft.primaryBranch} onChange={(event) => setDraft({ ...draft, primaryBranch: event.target.value as KcplBranch })}>{kcplBranches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
            <OpsField label="Priority"><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as JobPriority })}>{jobPriorities.map((priority) => <option key={priority} value={priority}>{jobPriorityLabels[priority]}</option>)}</select></OpsField>
            <OpsField label="Internal reference"><input value={draft.internalReference} onChange={(event) => setDraft({ ...draft, internalReference: event.target.value })} placeholder="Optional internal file/ref"/></OpsField>
            <div className="md:col-span-2"><OpsField label="Assigned staff" hint="Choose from People & branches. Identity and contact details stay synchronized automatically."><StaffAssignmentPicker branch={draft.primaryBranch} value={{ uid: draft.assignedToUid, name: draft.assignedToName, email: draft.assignedToEmail, phone: draft.assignedToPhone }} onChange={(staff) => setDraft((current) => ({ ...current, assignedToUid: staff.uid ?? "", assignedToName: staff.name, assignedToEmail: staff.email, assignedToPhone: staff.phone }))}/></OpsField></div>
            <OpsField label="Current handling"><div className="ops-input flex items-center">{job.current_location || "Location not updated"}</div></OpsField>
            <div className="md:col-span-2 xl:col-span-3"><p className="mb-2 text-[length:var(--app-label-size)] font-bold uppercase tracking-[.09em] text-[var(--admin-muted)]">Handling branches</p><div className="flex flex-wrap gap-2">{kcplBranches.map((branch) => <button type="button" key={branch} disabled={!canManageBranches} onClick={() => toggleHandlingBranch(branch)} className="ops-badge disabled:opacity-60" data-tone={draft.handlingBranches.includes(branch) ? "accent" : "neutral"}>{draft.handlingBranches.includes(branch) ? <Check size={10}/> : null}{branch}</button>)}</div></div>
            <OpsField label="Internal operating notes" className="md:col-span-2 xl:col-span-3"><textarea value={draft.internalNotes} onChange={(event) => setDraft({ ...draft, internalNotes: event.target.value })} placeholder="Private handling instructions, counterpart details, exceptions, branch handoff context…"/></OpsField>
            <div className="flex gap-2 md:col-span-2 xl:col-span-3"><OpsButton type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save handling"}</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setSetupOpen(false)}>Cancel</OpsButton></div>
          </form>
        </OpsSurface> : null}

        <div className="ops-grid-main">
          <div className="ops-stack">
            <OpsSurface id="shipment-closeout" eyebrow="Controlled closeout" title="Operational closeout" description="Customs, required documents, POD and open tasks are re-checked before closeout. Closing locks the operational lifecycle and keeps the record for finance, audit and the customer." action={workflow.job_closed
              ? (canOverride ? <OpsButton variant="secondary" size="sm" disabled={busy} onClick={reopenJob}><RotateCcw size={12}/>{busy ? "Reopening…" : "Reopen job"}</OpsButton> : null)
              : <OpsButton variant="primary" size="sm" disabled={busy || (!workflow.can_close && !canOverride)} onClick={() => closeJob(workflow.can_close ? "" : closeReason)}><PackageCheck size={12}/>{busy ? "Closing…" : workflow.can_close ? "Close job" : "Close with override"}</OpsButton>}>
              {workflow.job_closed ? <div className="flex items-start gap-2.5 rounded-[var(--app-radius)] border border-[var(--admin-success-line)] bg-[var(--admin-success-bg)] p-3 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-success)]"><LockKeyhole size={13} className="mt-0.5 shrink-0"/><span>Closed{workflow.job_closed_at ? ` ${dateTime(workflow.job_closed_at)}` : ""}{workflow.job_closed_by_name ? ` by ${workflow.job_closed_by_name}` : ""}. The shipment, documents, customs controls and audit trail remain available as the permanent record.{canOverride ? " Management can reopen with an audited reason." : " Only Management can reopen a closed job."}</span></div>
                : workflow.close_blockers.length ? <div className="grid gap-2">{workflow.close_blockers.map((blocker) => <div key={blocker} className="flex items-start gap-2 rounded-[var(--app-radius)] border border-[var(--admin-danger-line)] bg-[var(--admin-danger-bg)] p-2.5 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-danger)]"><AlertTriangle size={11} className="mt-0.5 shrink-0"/><span>{blocker}</span></div>)}{canOverride ? <OpsField label="Management override reason" hint="Recorded against the closeout in the shipment activity trail. Minimum 8 characters."><textarea value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="Why is this job being closed before every control is satisfied?"/></OpsField> : <p className="text-[length:var(--app-label-size)] text-[var(--admin-faint)]">Only Management can override a blocked closeout.</p>}</div>
                  : <div className="flex items-start gap-2 rounded-[var(--app-radius)] border border-[var(--admin-success-line)] bg-[var(--admin-success-bg)] p-3 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-success)]"><PackageCheck size={12} className="mt-0.5 shrink-0"/><span>All operational closeout controls are satisfied. This job is ready to close.</span></div>}
              {!workflow.job_closed && workflow.warnings.length ? <div className="mt-3 space-y-1">{workflow.warnings.map((warning) => <p key={warning} className="text-[length:var(--app-label-size)] leading-4 text-[var(--admin-faint)]">• {warning}</p>)}</div> : null}
            </OpsSurface>

            <OpsSurface id="shipment-tasks" eyebrow="Work queue" title="Operational tasks" description="Every unfinished action for this shipment, kept beside the record it belongs to." action={<OpsButton variant="secondary" size="sm" onClick={() => setTaskOpen((value) => !value)}><Plus size={12}/>{taskOpen ? "Close" : "Add task"}</OpsButton>}>
              {taskOpen ? <form onSubmit={addTask} className="mb-4 grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4 sm:grid-cols-2">
                <OpsField label="Task"><input required value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })}/></OpsField>
                <OpsField label="Branch"><select value={task.branch} onChange={(event) => setTask({ ...task, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
                <OpsField label="Due"><input type="datetime-local" value={task.dueAt} onChange={(event) => setTask({ ...task, dueAt: event.target.value })}/></OpsField>
                <div className="sm:col-span-2"><OpsField label="Assigned to" hint="Choose an active staff member. Contact details stay linked to People & branches."><StaffAssignmentPicker branch={task.branch} compact value={{ uid: task.assignedToUid, name: task.assignedToName, email: task.assignedToEmail, phone: task.assignedToPhone }} onChange={(staff) => setTask((current) => ({ ...current, assignedToUid: staff.uid ?? "", assignedToName: staff.name, assignedToEmail: staff.email, assignedToPhone: staff.phone }))}/></OpsField></div>
                <OpsField label="Detail" className="sm:col-span-2"><textarea value={task.detail} onChange={(event) => setTask({ ...task, detail: event.target.value })}/></OpsField>
                <div className="flex gap-2 sm:col-span-2"><OpsButton type="submit" variant="primary" disabled={busy}>Create task</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setTaskOpen(false)}>Cancel</OpsButton></div>
              </form> : null}
              {job.tasks.length ? <div className="divide-y divide-[var(--admin-line)]">{job.tasks.map((item) => <TaskRow key={item.id} item={item} busy={busy} nowMs={nowMs} onToggle={() => action({ action: "toggle_task", taskId: item.id, completed: !item.completed })}/>)}</div> : <OpsEmptyState icon={<ClipboardCheck size={18}/>} title="No operational tasks yet" description="Add work here when a shipment needs an owner, a due time or a follow-up."/>}
            </OpsSurface>

            <OpsSurface id="shipment-customs" eyebrow="Clearance workspace" title="Customs & clearance" description="Required steps stay visible until cleared, without turning the job file into a compliance spreadsheet." action={<OpsButton variant="secondary" size="sm" onClick={() => setCustomsOpen((value) => !value)}><Plus size={12}/>{customsOpen ? "Close" : "Add step"}</OpsButton>}>
              {requiredCustoms.length ? <div className="mb-4 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3"><div className="flex items-center justify-between gap-3"><span className="text-[length:var(--app-label-size)] font-bold text-[var(--admin-muted)]">Required clearance progress</span><span className="text-[length:var(--app-label-size)] font-semibold text-[var(--admin-faint)]">{completedCustoms} of {requiredCustoms.length}</span></div><div className="mt-2"><OpsProgress value={completedCustoms} max={Math.max(requiredCustoms.length, 1)} tone={completedCustoms === requiredCustoms.length ? "success" : "warning"}/></div></div> : null}
              {customsOpen ? <form onSubmit={addCustoms} className="mb-4 grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4 sm:grid-cols-2">
                <OpsField label="Clearance step"><input required value={customs.title} onChange={(event) => setCustoms({ ...customs, title: event.target.value })}/></OpsField>
                <OpsField label="Branch"><select value={customs.branch} onChange={(event) => setCustoms({ ...customs, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
                <OpsField label="Detail" className="sm:col-span-2"><textarea value={customs.detail} onChange={(event) => setCustoms({ ...customs, detail: event.target.value })}/></OpsField>
                <label className="flex items-center gap-2 text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]"><input type="checkbox" checked={customs.required} onChange={(event) => setCustoms({ ...customs, required: event.target.checked })}/> Required before clearance</label>
                <div className="flex gap-2 sm:col-span-2"><OpsButton type="submit" variant="primary" disabled={busy}>Add clearance step</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setCustomsOpen(false)}>Cancel</OpsButton></div>
              </form> : null}
              {job.customs_steps.length ? <div className="divide-y divide-[var(--admin-line)]">{job.customs_steps.map((item) => <CustomsRow key={item.id} item={item} busy={busy} onToggle={() => action({ action: "toggle_customs", stepId: item.id, completed: !item.completed })}/>)}</div> : <OpsEmptyState icon={<ShieldCheck size={18}/>} title="No customs checklist yet" description="Add only the clearance steps this movement actually requires."/>}
            </OpsSurface>

            <OpsSurface eyebrow="Private file note" title="Operating context" description="The running context that should follow this movement from branch to branch.">
              {job.internal_notes ? <p className="whitespace-pre-wrap text-[11px] leading-6 text-[var(--admin-ink)]">{job.internal_notes}</p> : <OpsEmptyState title="No internal operating note" description="Use Edit handling above to add branch handoff context, counterpart instructions or exceptional handling notes."/>}
            </OpsSurface>
          </div>

          <aside className="ops-stack xl:sticky xl:top-[76px]">
            <FreeTimeControl reference={job.reference} initial={freeTime} canEdit={canManageJobFile}/>
            <OpsSurface id="shipment-movement" eyebrow="Shipment identity" title={job.customer_name || "Unlinked customer"} description={`${job.origin || "Origin"} → ${job.destination || "Destination"}`}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Fact icon={<UserRound size={12}/>} label="Customer" value={job.customer_name || "Not linked"}/><Fact label="Quote" value={job.quote_reference} mono/><Fact label="Mode" value={job.mode || "Not set"}/><Fact label="Carrier" value={job.carrier || "Not assigned"}/><Fact label="Carrier ref" value={job.carrier_reference || "Not assigned"} mono/><Fact icon={<MapPin size={12}/>} label="Current location" value={job.current_location || "Not updated"}/><Fact icon={<Landmark size={12}/>} label="Primary branch" value={<Link href={`/admin/branches/${encodeURIComponent(job.primary_branch)}`} className="hover:text-[var(--admin-crimson)] hover:underline">{job.primary_branch}</Link>}/>
                <Fact icon={<UsersRound size={12}/>} label="Owner" value={job.assigned_to_uid ? <Link href={`/admin/workload/${encodeURIComponent(job.assigned_to_uid)}`} className="hover:text-[var(--admin-crimson)] hover:underline">{job.assigned_to_name || job.assigned_to_email || "Assigned staff"}</Link> : job.assigned_to_name || job.assigned_to_email || "Unassigned"}/>
                <Fact icon={<Mail size={11}/>} label="Owner email" value={job.assigned_to_email ? <a href={`mailto:${job.assigned_to_email}`} className="hover:text-[var(--admin-crimson)] hover:underline">{job.assigned_to_email}</a> : "Not set"}/>
                <Fact icon={<Phone size={11}/>} label="Owner phone" value={job.assigned_to_phone ? <a href={`tel:${job.assigned_to_phone}`} className="hover:text-[var(--admin-crimson)] hover:underline">{job.assigned_to_phone}</a> : "Not set"}/>
                <Fact label="Role / title" value={job.assigned_to_job_title || "Not recorded"}/>
                <Fact label="Staff branches" value={job.assigned_to_branches.length ? <span className="flex flex-wrap gap-x-2 gap-y-1">{job.assigned_to_branches.map((branch) => <Link key={branch} href={`/admin/branches/${encodeURIComponent(branch)}`} className="hover:text-[var(--admin-crimson)] hover:underline">{branch}</Link>)}</span> : "Not recorded"}/>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">{job.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(job.customer_id)}`} className="ops-button" data-variant="secondary" data-size="sm">Open Customer 360</Link> : null}{job.assigned_to_uid ? <Link href={`/admin/workload/${encodeURIComponent(job.assigned_to_uid)}`} className="ops-button" data-variant="secondary" data-size="sm">Open staff workload</Link> : null}<Link href={`/admin/jobs/${encodeURIComponent(job.reference)}/profitability`} className="ops-button" data-variant="ghost" data-size="sm">Profitability</Link></div>
            </OpsSurface>

            <OpsSurface id="shipment-documents" eyebrow="Document vault" title="Shipment documents" description="Files are Received on upload. Only verified, unexpired evidence satisfies controlled readiness." action={<Link href={`/admin/documents?q=${encodeURIComponent(job.reference)}`} className="ops-button" data-variant="ghost" data-size="sm">Open Document Vault</Link>}>
              {!storageAvailable ? <OpsNotice tone="warning">Firebase Storage is unavailable for this deployment.</OpsNotice> : null}
              <form onSubmit={uploadDocument} className="mt-3 grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3">
                <OpsField label="Document type"><select name="documentType" defaultValue="other">{shipmentDocumentTypes.map((type) => <option key={type} value={type}>{shipmentDocumentTypeLabels[type]}</option>)}</select></OpsField>
                <OpsField label="File"><input required name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"/></OpsField>
                <OpsButton type="submit" variant="primary" size="sm" disabled={documentBusy || !storageAvailable}><Upload size={12}/>{documentBusy ? "Uploading…" : "Upload document"}</OpsButton>
              </form>
              <div className="mt-3 divide-y divide-[var(--admin-line)]">{documentsLoading ? <p className="py-4 text-[length:var(--app-label-size)] text-[var(--admin-faint)]">Loading documents…</p> : documents.length ? documents.map((document) => <DocumentRow key={document.id} document={document} jobReference={job.reference} documentBusy={documentBusy} role={role} currentUserEmail={currentUserEmail} onDelete={() => deleteDocument(document)}/>) : <OpsEmptyState icon={<FileText size={17}/>} title="No documents yet" description="Upload AWBs, BLs, invoices, packing lists and clearance documents here."/>}</div>
            </OpsSurface>

            {job.can_view_costs ? <OpsSurface id="shipment-commercial" eyebrow="Commercial control" title="Job costs" description="Internal only. Cost data never appears to operations roles without permission." action={<OpsButton variant="secondary" size="sm" onClick={() => setCostOpen((value) => !value)}><Plus size={12}/>{costOpen ? "Close" : "Add cost"}</OpsButton>}>
              {Object.keys(job.cost_totals).length ? <div className="grid grid-cols-2 gap-2">{Object.entries(job.cost_totals).map(([currency, total]) => <div key={currency} className="rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.08em] text-[var(--admin-muted)]">{currency} costs</p><p className="mt-1.5 text-[13px] font-[720] text-[var(--admin-ink)]">{money(total ?? 0, currency)}</p>{job.profit_totals[currency as CrmCurrency] !== undefined ? <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Profit {money(job.profit_totals[currency as CrmCurrency] ?? 0, currency)}</p> : null}</div>)}</div> : null}
              {costOpen ? <form onSubmit={addCost} className="mt-3 grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3"><OpsField label="Category"><select value={cost.category} onChange={(event) => setCost({ ...cost, category: event.target.value as JobCostCategory })}>{jobCostCategories.map((category) => <option key={category} value={category}>{jobCostCategoryLabels[category]}</option>)}</select></OpsField><OpsField label="Description"><input required value={cost.label} onChange={(event) => setCost({ ...cost, label: event.target.value })}/></OpsField><OpsField label="Vendor"><input value={cost.vendor} onChange={(event) => setCost({ ...cost, vendor: event.target.value })}/></OpsField><div className="grid grid-cols-[1fr_.7fr] gap-2"><OpsField label="Amount"><input required type="number" min="0" step="0.01" value={cost.amount} onChange={(event) => setCost({ ...cost, amount: event.target.value })}/></OpsField><OpsField label="Currency"><select value={cost.currency} onChange={(event) => setCost({ ...cost, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></OpsField></div><OpsField label="Notes"><textarea value={cost.notes} onChange={(event) => setCost({ ...cost, notes: event.target.value })}/></OpsField><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Save cost</OpsButton></form> : null}
              <div className="mt-3 divide-y divide-[var(--admin-line)]">{job.costs.length ? job.costs.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-[length:var(--app-label-size)] font-bold text-[var(--admin-ink)]">{item.label}</p><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-faint)]">{jobCostCategoryLabels[item.category]}{item.vendor ? ` · ${item.vendor}` : ""}{item.source_reference ? ` · ${item.source_reference}` : ""}</p></div><strong className="shrink-0 text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{money(item.amount, item.currency)}</strong></div>) : <OpsEmptyState icon={<WalletCards size={17}/>} title="No costs recorded" description="Add supplier, freight, customs and handling costs here."/>}</div>
            </OpsSurface> : <OpsSurface id="shipment-commercial" eyebrow="Commercial controls" title="Cost data restricted" description="Your role can operate this shipment, but commercial cost data is intentionally withheld from the browser."><div className="flex items-start gap-3 rounded-[var(--app-radius)] bg-[var(--admin-surface-muted)] p-3 text-[var(--admin-muted)]"><Landmark size={15} className="mt-0.5 shrink-0 text-[var(--admin-crimson)]"/><p className="text-[length:var(--app-label-size)] leading-5">You still have full access to the operational Job File, tasks, customs and documents allowed by your role.</p></div></OpsSurface>}
          </aside>
        </div>
      </div>
    </OpsPage>
  );
}

function Fact({ icon, label, value, mono = false }: { icon?: React.ReactNode; label: string; value: React.ReactNode; mono?: boolean }) {
  return <div><p className="flex items-center gap-1.5 text-[length:var(--app-label-size)] font-bold uppercase tracking-[.08em] text-[var(--admin-muted)]">{icon}{label}</p><div className="mt-1.5 break-words text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]">{mono && typeof value === "string" ? <OpsMono>{value}</OpsMono> : value}</div></div>;
}

function TaskRow({ item, busy, nowMs, onToggle }: { item: JobTask; busy: boolean; nowMs: number; onToggle: () => void }) {
  const overdue = !item.completed && Boolean(item.due_at) && new Date(item.due_at!).getTime() < nowMs;
  const assigneeName = item.assigned_to_name || item.assigned_to_email || "Unassigned";
  return <div className="flex items-start gap-3 py-3.5"><button type="button" disabled={busy} onClick={onToggle} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${item.completed ? "border-[var(--admin-success-line)] bg-[var(--admin-success-bg)] text-[var(--admin-success)]" : overdue ? "border-[var(--admin-danger-line)] bg-[var(--admin-danger-bg)] text-transparent" : "border-[var(--admin-line)] bg-white text-transparent"}`} aria-label={item.completed ? `Reopen ${item.title}` : `Complete ${item.title}`}><Check size={11}/></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className={`text-[length:var(--app-label-size)] ${item.completed ? "text-[var(--admin-faint)] line-through" : "text-[var(--admin-ink)]"}`}>{item.title}</strong>{overdue ? <OpsBadge tone="danger">Overdue</OpsBadge> : null}<Link href={`/admin/branches/${encodeURIComponent(item.branch)}`}><OpsBadge>{item.branch}</OpsBadge></Link></div>{item.detail ? <p className="mt-1 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{item.detail}</p> : null}<div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--app-label-size)] text-[var(--admin-faint)]">{item.assigned_to_uid ? <Link href={`/admin/workload/${encodeURIComponent(item.assigned_to_uid)}`} className="font-semibold hover:text-[var(--admin-crimson)] hover:underline">{assigneeName}</Link> : <span>{assigneeName}</span>}{item.assigned_to_email ? <a href={`mailto:${item.assigned_to_email}`} className="hover:text-[var(--admin-crimson)] hover:underline">{item.assigned_to_email}</a> : null}{item.assigned_to_phone ? <a href={`tel:${item.assigned_to_phone}`} className="hover:text-[var(--admin-crimson)] hover:underline">{item.assigned_to_phone}</a> : null}<span>{item.due_at ? `due ${dateTime(item.due_at)}` : "no due time"}</span></div></div></div>;
}

function CustomsRow({ item, busy, onToggle }: { item: CustomsStep; busy: boolean; onToggle: () => void }) {
  return <div className="flex items-start gap-3 py-3.5"><button type="button" disabled={busy} onClick={onToggle} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[var(--app-radius)] border ${item.completed ? "border-[var(--admin-success-line)] bg-[var(--admin-success-bg)] text-[var(--admin-success)]" : "border-[var(--admin-line)] bg-white text-transparent"}`} aria-label={item.completed ? `Reopen ${item.title}` : `Complete ${item.title}`}><Check size={11}/></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className={`text-[length:var(--app-label-size)] ${item.completed ? "text-[var(--admin-faint)]" : "text-[var(--admin-ink)]"}`}>{item.title}</strong><OpsBadge tone={item.required ? "warning" : "neutral"}>{item.required ? "Required" : "Optional"}</OpsBadge><Link href={`/admin/branches/${encodeURIComponent(item.branch)}`}><OpsBadge>{item.branch}</OpsBadge></Link></div>{item.detail ? <p className="mt-1 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{item.detail}</p> : null}<p className="mt-1.5 text-[length:var(--app-label-size)] text-[var(--admin-faint)]">{item.completed ? `Cleared ${dateTime(item.completed_at)}${item.completed_by ? ` by ${item.completed_by}` : ""}` : `Added ${dateTime(item.created_at)}`}</p></div></div>;
}

function DocumentRow({ document, jobReference, documentBusy, role, currentUserEmail, onDelete }: { document: ShipmentDocument; jobReference: string; documentBusy: boolean; role: KcplStaffRole; currentUserEmail: string; onDelete: () => void }) {
  const status = document.review_status ?? "received";
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const expired = status === "verified" && Boolean(document.expires_on && document.expires_on < today);
  const controlLabel = expired ? "Expired" : status.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());
  const controlTone: "neutral" | "warning" | "success" | "danger" = expired || status === "rejected" ? "danger" : status === "verified" ? "success" : status === "received" || status === "under_review" ? "warning" : "neutral";
  const canDelete = role === "management" || (role === "operations" && status === "received" && currentUserEmail.trim().toLowerCase() === (document.uploaded_by_email ?? "").trim().toLowerCase());
  return <div className="flex items-start gap-3 py-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--app-radius)] bg-[var(--admin-accent-bg)] text-[var(--admin-crimson)]"><FileText size={14}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><p className="min-w-0 truncate text-[length:var(--app-label-size)] font-bold text-[var(--admin-ink)]">{document.filename}</p><OpsBadge tone={controlTone}>{controlLabel}</OpsBadge></div><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{shipmentDocumentTypeLabels[document.document_type]} · {bytes(document.size_bytes)} · {dateTime(document.uploaded_at)}{document.expires_on ? ` · expires ${dateLabel(document.expires_on)}` : ""}</p><div className="mt-2 flex flex-wrap gap-1.5"><a href={`/api/admin/shipments/${encodeURIComponent(jobReference)}/documents/${document.id}`} className="ops-button" data-variant="ghost" data-size="sm"><Download size={10}/>Download</a>  <Link href={`/admin/documents?q=${encodeURIComponent(jobReference)}`} className="ops-button" data-variant="secondary" data-size="sm">Review in Vault</Link>{canDelete ? <button type="button" disabled={documentBusy} onClick={onDelete} className="ops-button" data-variant="danger" data-size="sm"><Trash2 size={10}/>Delete</button> : null}</div></div></div>;
}