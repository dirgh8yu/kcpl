"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  Download,
  FileText,
  LockKeyhole,
  PackageCheck,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
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
import { type KcplStaffRole } from "../../staff-permissions";
import type { ShipmentWorkflowReadiness } from "../../workflow-guard";
import { StaffAssignmentPicker } from "../../staff-assignment-picker";
import { shipmentDocumentTypeLabels, shipmentDocumentTypes, type ShipmentDocument } from "../../../shipment-document-types";
import { OpsBadge, OpsButton, OpsEmptyState, OpsFact, OpsFacts, OpsField, OpsInspectorNote, OpsMono, OpsNotice, OpsPage, OpsProgress, OpsSurface } from "../../operations-ui";
import { FreeTimeControl, type FreeTimePanelData } from "./free-time-control";
import { ShipmentThread } from "../../../shipment-thread";

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

export function JobFileWorkspace({
  initialJob,
  initialReadiness,
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
  // Advisories often restate a closeout blocker already listed above them
  // (e.g. "2 operational tasks still open" vs the blocker "2 operational tasks
  // remain open"); show each advisory only when it says something the blocker
  // checklist does not. Task-count advisories match on the count itself so
  // wording differences cannot resurrect the duplicate.
  const taskCountPhrase = (text: string) => text.match(/(\d+)\s+operational task/i)?.[1] ?? null;
  const closeoutWarnings = useMemo(() => workflow.warnings.filter((warning) => {
    if (workflow.close_blockers.some((blocker) => blocker.includes(warning))) return false;
    const warnTasks = taskCountPhrase(warning);
    return !(warnTasks && workflow.close_blockers.some((blocker) => taskCountPhrase(blocker) === warnTasks));
  }), [workflow.warnings, workflow.close_blockers]);

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

  const setupToggle = <OpsButton variant="secondary" size="xs" onClick={() => setSetupOpen((current) => !current)} aria-expanded={setupOpen}><BriefcaseBusiness size={13} strokeWidth={1.75} aria-hidden="true"/>{setupOpen ? "Close setup" : "Edit handling"}</OpsButton>;

  return (
    <OpsPage className="job-workspace">
      {notice ? <OpsNotice tone={notice.toLowerCase().includes("could not") || notice.toLowerCase().includes("failed") ? "danger" : notice.toLowerCase().includes("unavailable") ? "warning" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}

      {setupOpen ? <OpsSurface title="Handling setup" description="Ownership, branches and private instructions. Changes stay internal to KCPL." action={<OpsButton variant="ghost" size="xs" onClick={() => setSetupOpen(false)}>Close</OpsButton>}>
        <form onSubmit={saveSetup} className="job-form job-form-grid">
          <OpsField label="Primary branch"><select disabled={!canManageBranches} value={draft.primaryBranch} onChange={(event) => setDraft({ ...draft, primaryBranch: event.target.value as KcplBranch })}>{kcplBranches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
          <OpsField label="Priority"><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as JobPriority })}>{jobPriorities.map((priority) => <option key={priority} value={priority}>{jobPriorityLabels[priority]}</option>)}</select></OpsField>
          <OpsField label="Internal reference"><input value={draft.internalReference} onChange={(event) => setDraft({ ...draft, internalReference: event.target.value })} placeholder="Optional internal file/ref"/></OpsField>
          <OpsField label="Assigned staff" hint="Choose from People & branches. Identity and contact details stay synchronized automatically." className="job-form-span-2"><StaffAssignmentPicker branch={draft.primaryBranch} value={{ uid: draft.assignedToUid, name: draft.assignedToName, email: draft.assignedToEmail, phone: draft.assignedToPhone }} onChange={(staff) => setDraft((current) => ({ ...current, assignedToUid: staff.uid ?? "", assignedToName: staff.name, assignedToEmail: staff.email, assignedToPhone: staff.phone }))}/></OpsField>
          <OpsField label="Current handling"><div className="ops-input job-form-static">{job.current_location || "Location not updated"}</div></OpsField>
          <div className="job-form-span-all" role="group" aria-label="Handling branches">
            <span className="ops-filter-menu-label">Handling branches</span>
            <div className="ops-filter-choices mt-1.5">{kcplBranches.map((branch) => <button type="button" key={branch} disabled={!canManageBranches} onClick={() => toggleHandlingBranch(branch)} className="ops-filter-choice" data-active={draft.handlingBranches.includes(branch) || undefined} aria-pressed={draft.handlingBranches.includes(branch)}>{branch}</button>)}</div>
          </div>
          <OpsField label="Internal operating notes" className="job-form-span-all"><textarea value={draft.internalNotes} onChange={(event) => setDraft({ ...draft, internalNotes: event.target.value })} placeholder="Private handling instructions, counterpart details, exceptions, branch handoff context…"/></OpsField>
          <div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Saving…" : "Save handling"}</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setSetupOpen(false)}>Cancel</OpsButton></div>
        </form>
      </OpsSurface> : null}

      <div className="ops-grid-main job-workspace-grid">
        <div className="ops-stack job-workspace-main">
          <OpsSurface id="shipment-closeout" title="Operational closeout" description="Customs, required documents, POD and open tasks are re-checked before closeout. Closing locks the operational lifecycle and keeps the record for finance, audit and the customer." action={workflow.job_closed
            ? (canOverride ? <OpsButton variant="secondary" size="xs" disabled={busy} onClick={reopenJob}><RotateCcw size={13} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Reopening…" : "Reopen job"}</OpsButton> : null)
            : <OpsButton variant={workflow.can_close ? "primary" : "secondary"} size="xs" disabled={busy || (!workflow.can_close && !canOverride)} onClick={() => closeJob(workflow.can_close ? "" : closeReason)}><PackageCheck size={13} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Closing…" : workflow.can_close ? "Close job" : "Close with override"}</OpsButton>}>
            {workflow.job_closed ? <OpsInspectorNote tone="success" icon={<LockKeyhole size={14} strokeWidth={1.75} aria-hidden="true"/>} title={`Closed${workflow.job_closed_at ? ` ${dateTime(workflow.job_closed_at)}` : ""}${workflow.job_closed_by_name ? ` by ${workflow.job_closed_by_name}` : ""}`}>The shipment, documents, customs controls and audit trail remain available as the permanent record.{canOverride ? " Management can reopen with an audited reason." : " Only Management can reopen a closed job."}</OpsInspectorNote>
              : workflow.close_blockers.length ? <>
                <ul className="job-checklist" aria-label="Closeout blockers">{workflow.close_blockers.map((blocker) => <li key={blocker}><AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true"/><span>{blocker}</span></li>)}</ul>
                {canOverride ? <div className="job-closeout-override"><OpsField label="Management override reason" hint="Recorded against the closeout in the shipment activity trail. Minimum 8 characters."><textarea value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="Why is this job being closed before every control is satisfied?"/></OpsField></div> : <p className="ops-inspector-hint mt-2">Only Management can override a blocked closeout.</p>}
              </>
                : <OpsInspectorNote tone="success" icon={<PackageCheck size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Ready to close">All operational closeout controls are satisfied.</OpsInspectorNote>}
            {workflow.job_closed && canOverride ? <div className="job-closeout-override"><OpsField label="Reopening reason" hint="Management reasons are audited. Minimum 8 characters."><textarea value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="Why is this job being reopened?"/></OpsField></div> : null}
            {!workflow.job_closed && closeoutWarnings.length ? <ul className="job-advisories">{closeoutWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          </OpsSurface>

          <OpsSurface id="shipment-tasks" title="Operational tasks" description={openTasks.length ? <><strong>{openTasks.length} open</strong>{overdueTasks.length ? <> · <span className="job-overdue">{overdueTasks.length} overdue</span></> : null} · every unfinished action for this shipment.</> : "Every unfinished action for this shipment, kept beside the record it belongs to."} action={<OpsButton variant="secondary" size="xs" onClick={() => setTaskOpen((value) => !value)} aria-expanded={taskOpen}><Plus size={13} strokeWidth={1.75} aria-hidden="true"/>{taskOpen ? "Close" : "Add task"}</OpsButton>}>
            {taskOpen ? <form onSubmit={addTask} className="job-form job-form-grid job-form-grid-2">
              <OpsField label="Task"><input required value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })}/></OpsField>
              <OpsField label="Branch"><select value={task.branch} onChange={(event) => setTask({ ...task, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
              <OpsField label="Due"><input type="datetime-local" value={task.dueAt} onChange={(event) => setTask({ ...task, dueAt: event.target.value })}/></OpsField>
              <OpsField label="Assigned to" hint="Choose an active staff member. Contact details stay linked to People & branches." className="job-form-span-all"><StaffAssignmentPicker branch={task.branch} compact value={{ uid: task.assignedToUid, name: task.assignedToName, email: task.assignedToEmail, phone: task.assignedToPhone }} onChange={(staff) => setTask((current) => ({ ...current, assignedToUid: staff.uid ?? "", assignedToName: staff.name, assignedToEmail: staff.email, assignedToPhone: staff.phone }))}/></OpsField>
              <OpsField label="Detail" className="job-form-span-all"><textarea value={task.detail} onChange={(event) => setTask({ ...task, detail: event.target.value })}/></OpsField>
              <div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Create task</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setTaskOpen(false)}>Cancel</OpsButton></div>
            </form> : null}
            {job.tasks.length ? <ul className="job-rows">{job.tasks.map((item) => <TaskRow key={item.id} item={item} busy={busy} nowMs={nowMs} onToggle={() => action({ action: "toggle_task", taskId: item.id, completed: !item.completed })}/>)}</ul> : <OpsEmptyState compact title="No operational tasks yet" description="Add work here when a shipment needs an owner, a due time or a follow-up."/>}
          </OpsSurface>

          <OpsSurface id="shipment-customs" title="Customs & clearance" description="Required steps stay visible until cleared." action={<OpsButton variant="secondary" size="xs" onClick={() => setCustomsOpen((value) => !value)} aria-expanded={customsOpen}><Plus size={13} strokeWidth={1.75} aria-hidden="true"/>{customsOpen ? "Close" : "Add step"}</OpsButton>}>
            {requiredCustoms.length ? <div className="job-progress"><span>Required clearance</span><OpsProgress value={completedCustoms} max={Math.max(requiredCustoms.length, 1)} tone={completedCustoms === requiredCustoms.length ? "success" : "warning"} label="Required clearance progress"/><strong>{completedCustoms} of {requiredCustoms.length}</strong></div> : null}
            {customsOpen ? <form onSubmit={addCustoms} className="job-form job-form-grid job-form-grid-2">
              <OpsField label="Clearance step"><input required value={customs.title} onChange={(event) => setCustoms({ ...customs, title: event.target.value })}/></OpsField>
              <OpsField label="Branch"><select value={customs.branch} onChange={(event) => setCustoms({ ...customs, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
              <OpsField label="Detail" className="job-form-span-all"><textarea value={customs.detail} onChange={(event) => setCustoms({ ...customs, detail: event.target.value })}/></OpsField>
              <label className="job-form-check job-form-span-all"><input type="checkbox" checked={customs.required} onChange={(event) => setCustoms({ ...customs, required: event.target.checked })}/> Required before clearance</label>
              <div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Add clearance step</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setCustomsOpen(false)}>Cancel</OpsButton></div>
            </form> : null}
            {job.customs_steps.length ? <ul className="job-rows">{job.customs_steps.map((item) => <CustomsRow key={item.id} item={item} busy={busy} onToggle={() => action({ action: "toggle_customs", stepId: item.id, completed: !item.completed })}/>)}</ul> : <OpsEmptyState compact title="No customs checklist yet" description="Add only the clearance steps this movement actually requires."/>}
          </OpsSurface>

          <OpsSurface id="shipment-context" title="Operating context" description="Private file note that follows this movement from branch to branch." action={setupToggle}>
            {job.internal_notes ? <p className="job-note">{job.internal_notes}</p> : <OpsEmptyState compact title="No internal operating note" description="Use Edit handling to add branch handoff context, counterpart instructions or exceptional handling notes."/>}
          </OpsSurface>
        </div>

        <div className="ops-stack job-workspace-side">
          <div id="shipment-free-time"><FreeTimeControl reference={job.reference} initial={freeTime} canEdit={canManageJobFile}/></div>
          {canManageJobFile ? (
            <ShipmentThread
              endpoint={`/api/admin/jobs/${encodeURIComponent(job.reference)}/messages`}
              viewer="kcpl"
              labels={{
                eyebrow: "Customer",
                title: "Messages with the customer",
                description: "The customer writes from the portal or the KCPL app, and sees your first name on replies.",
                placeholder: "Reply to the customer",
                send: "Send",
                sending: "Sending…",
                empty: "No messages yet",
                emptyDescription: "When the customer asks about this shipment, it appears here and in KCPL Ops.",
                failed: "The message was not sent. Try again.",
                loadFailed: "Messages could not be loaded.",
              }}
            />
          ) : null}
          <OpsSurface id="shipment-movement" title={job.customer_name || "Unlinked customer"} description={`${job.origin || "Origin"} → ${job.destination || "Destination"}`}>
            <OpsFacts columns={2}>
              <OpsFact label="Customer">{job.customer_name || "Not linked"}</OpsFact>
              <OpsFact label="Quote"><OpsMono>{job.quote_reference}</OpsMono></OpsFact>
              <OpsFact label="Mode">{job.mode || "Not set"}</OpsFact>
              <OpsFact label="Carrier" warning={!job.carrier}>{job.carrier || "Not assigned"}</OpsFact>
              <OpsFact label="Carrier ref">{job.carrier_reference ? <OpsMono>{job.carrier_reference}</OpsMono> : "Not assigned"}</OpsFact>
              <OpsFact label="Location">{job.current_location || "Not updated"}</OpsFact>
              <OpsFact label="Primary branch"><Link href={`/admin/branches/${encodeURIComponent(job.primary_branch)}`}>{job.primary_branch}</Link></OpsFact>
              <OpsFact label="Owner" warning={!job.assigned_to_uid && !job.assigned_to_name && !job.assigned_to_email}>{job.assigned_to_uid ? <Link href={`/admin/workload/${encodeURIComponent(job.assigned_to_uid)}`}>{job.assigned_to_name || job.assigned_to_email || "Assigned staff"}</Link> : job.assigned_to_name || job.assigned_to_email || "Unassigned"}</OpsFact>
              <OpsFact label="Owner email">{job.assigned_to_email ? <a href={`mailto:${job.assigned_to_email}`}>{job.assigned_to_email}</a> : "Not set"}</OpsFact>
              <OpsFact label="Owner phone">{job.assigned_to_phone ? <a href={`tel:${job.assigned_to_phone}`}>{job.assigned_to_phone}</a> : "Not set"}</OpsFact>
              <OpsFact label="Role / title">{job.assigned_to_job_title || "Not recorded"}</OpsFact>
              <OpsFact label="Staff branches">{job.assigned_to_branches.length ? <span className="job-inline-links">{job.assigned_to_branches.map((branch) => <Link key={branch} href={`/admin/branches/${encodeURIComponent(branch)}`}>{branch}</Link>)}</span> : "Not recorded"}</OpsFact>
            </OpsFacts>
            <div className="ops-inspector-actions mt-3">{job.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(job.customer_id)}`} className="ops-button" data-variant="secondary" data-size="xs">Customer 360</Link> : null}{job.assigned_to_uid ? <Link href={`/admin/workload/${encodeURIComponent(job.assigned_to_uid)}`} className="ops-button" data-variant="secondary" data-size="xs">Staff workload</Link> : null}<Link href={`/admin/jobs/${encodeURIComponent(job.reference)}/profitability`} className="ops-button" data-variant="ghost" data-size="xs">Profitability</Link></div>
          </OpsSurface>

          <OpsSurface id="shipment-documents" title="Shipment documents" description="Files are Received on upload. Only verified, unexpired evidence satisfies controlled readiness." action={<Link href={`/admin/documents?q=${encodeURIComponent(job.reference)}`} className="ops-button" data-variant="ghost" data-size="xs">Open Document Vault</Link>}>
            {!storageAvailable ? <div className="mb-3"><OpsNotice tone="warning">Firebase Storage is unavailable for this deployment.</OpsNotice></div> : null}
            <form onSubmit={uploadDocument} className="job-form job-upload">
              <OpsField label="Document type"><select name="documentType" defaultValue="other">{shipmentDocumentTypes.map((type) => <option key={type} value={type}>{shipmentDocumentTypeLabels[type]}</option>)}</select></OpsField>
              <OpsField label="File"><input required name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"/></OpsField>
              <OpsButton type="submit" variant="secondary" size="sm" disabled={documentBusy || !storageAvailable}><Upload size={14} strokeWidth={1.75} aria-hidden="true"/>{documentBusy ? "Uploading…" : "Upload"}</OpsButton>
            </form>
            {documentsLoading ? <p className="ops-inspector-hint mt-3">Loading documents…</p> : documents.length ? <ul className="job-rows mt-2">{documents.map((document) => <DocumentRow key={document.id} document={document} jobReference={job.reference} documentBusy={documentBusy} role={role} currentUserEmail={currentUserEmail} onDelete={() => deleteDocument(document)}/>)}</ul> : <OpsEmptyState compact title="No documents yet" description="Upload AWBs, BLs, invoices, packing lists and clearance documents here."/>}
          </OpsSurface>

          {job.can_view_costs ? <OpsSurface id="shipment-commercial" title="Job costs" description="Internal only. Cost data never appears to operations roles without permission." action={<OpsButton variant="secondary" size="xs" onClick={() => setCostOpen((value) => !value)} aria-expanded={costOpen}><Plus size={13} strokeWidth={1.75} aria-hidden="true"/>{costOpen ? "Close" : "Add cost"}</OpsButton>}>
            {Object.keys(job.cost_totals).length ? <dl className="job-stat-row">{Object.entries(job.cost_totals).map(([currency, total]) => <div key={currency}><dt>{currency} costs</dt><dd>{money(total ?? 0, currency)}</dd>{job.profit_totals[currency as CrmCurrency] !== undefined ? <dd className="job-stat-note">Profit {money(job.profit_totals[currency as CrmCurrency] ?? 0, currency)}</dd> : null}</div>)}</dl> : null}
            {costOpen ? <form onSubmit={addCost} className="job-form job-form-grid job-form-grid-2 mt-3"><OpsField label="Category"><select value={cost.category} onChange={(event) => setCost({ ...cost, category: event.target.value as JobCostCategory })}>{jobCostCategories.map((category) => <option key={category} value={category}>{jobCostCategoryLabels[category]}</option>)}</select></OpsField><OpsField label="Description"><input required value={cost.label} onChange={(event) => setCost({ ...cost, label: event.target.value })}/></OpsField><OpsField label="Vendor"><input value={cost.vendor} onChange={(event) => setCost({ ...cost, vendor: event.target.value })}/></OpsField><div className="job-form-money"><OpsField label="Amount"><input required type="number" min="0" step="0.01" value={cost.amount} onChange={(event) => setCost({ ...cost, amount: event.target.value })}/></OpsField><OpsField label="Currency"><select value={cost.currency} onChange={(event) => setCost({ ...cost, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></OpsField></div><OpsField label="Notes" className="job-form-span-all"><textarea value={cost.notes} onChange={(event) => setCost({ ...cost, notes: event.target.value })}/></OpsField><div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Save cost</OpsButton></div></form> : null}
            {job.costs.length ? <ul className="job-rows mt-2">{job.costs.map((item) => <li key={item.id} className="job-row"><div className="job-row-main"><span className="job-row-title">{item.label}</span><span className="job-row-meta">{jobCostCategoryLabels[item.category]}{item.vendor ? ` · ${item.vendor}` : ""}{item.source_reference ? ` · ${item.source_reference}` : ""}</span></div><strong className="job-row-amount">{money(item.amount, item.currency)}</strong></li>)}</ul> : <OpsEmptyState compact title="No costs recorded" description="Add supplier, freight, customs and handling costs here."/>}
          </OpsSurface> : <OpsSurface id="shipment-commercial" title="Cost data restricted" description="Your role can operate this shipment, but commercial cost data is intentionally withheld from the browser."><OpsInspectorNote tone="neutral" title="Operational access unchanged">You still have full access to the operational Job File, tasks, customs and documents allowed by your role.</OpsInspectorNote></OpsSurface>}
        </div>
      </div>
    </OpsPage>
  );
}

function TaskRow({ item, busy, nowMs, onToggle }: { item: JobTask; busy: boolean; nowMs: number; onToggle: () => void }) {
  const overdue = !item.completed && Boolean(item.due_at) && new Date(item.due_at!).getTime() < nowMs;
  const assigneeName = item.assigned_to_name || item.assigned_to_email || "Unassigned";
  return <li className="job-row" data-done={item.completed || undefined} data-overdue={overdue || undefined}>
    <button type="button" disabled={busy} onClick={onToggle} className="job-check" data-shape="round" aria-pressed={item.completed} aria-label={item.completed ? `Reopen ${item.title}` : `Complete ${item.title}`}><Check size={11} strokeWidth={2} aria-hidden="true"/></button>
    <div className="job-row-main">
      <div className="job-row-head"><span className="job-row-title">{item.title}</span>{overdue ? <OpsBadge tone="danger">Overdue</OpsBadge> : null}<Link href={`/admin/branches/${encodeURIComponent(item.branch)}`} className="job-row-tag">{item.branch}</Link></div>
      {item.detail ? <p className="job-row-detail">{item.detail}</p> : null}
      <div className="job-row-meta">{item.assigned_to_uid ? <Link href={`/admin/workload/${encodeURIComponent(item.assigned_to_uid)}`}>{assigneeName}</Link> : <span>{assigneeName}</span>}{item.assigned_to_email ? <a href={`mailto:${item.assigned_to_email}`}>{item.assigned_to_email}</a> : null}{item.assigned_to_phone ? <a href={`tel:${item.assigned_to_phone}`}>{item.assigned_to_phone}</a> : null}<span data-overdue={overdue || undefined}>{item.due_at ? `Due ${dateTime(item.due_at)}` : "No due time"}</span></div>
    </div>
  </li>;
}

function CustomsRow({ item, busy, onToggle }: { item: CustomsStep; busy: boolean; onToggle: () => void }) {
  return <li className="job-row" data-done={item.completed || undefined}>
    <button type="button" disabled={busy} onClick={onToggle} className="job-check" aria-pressed={item.completed} aria-label={item.completed ? `Reopen ${item.title}` : `Complete ${item.title}`}><Check size={11} strokeWidth={2} aria-hidden="true"/></button>
    <div className="job-row-main">
      <div className="job-row-head"><span className="job-row-title">{item.title}</span><OpsBadge tone={item.required && !item.completed ? "warning" : "neutral"}>{item.required ? "Required" : "Optional"}</OpsBadge><Link href={`/admin/branches/${encodeURIComponent(item.branch)}`} className="job-row-tag">{item.branch}</Link></div>
      {item.detail ? <p className="job-row-detail">{item.detail}</p> : null}
      <div className="job-row-meta"><span>{item.completed ? `Cleared ${dateTime(item.completed_at)}${item.completed_by ? ` by ${item.completed_by}` : ""}` : `Added ${dateTime(item.created_at)}`}</span></div>
    </div>
  </li>;
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
  return <li className="job-row">
    <FileText size={15} strokeWidth={1.75} className="job-row-icon" aria-hidden="true"/>
    <div className="job-row-main">
      <div className="job-row-head"><span className="job-row-title" title={document.filename}>{document.filename}</span><OpsBadge tone={controlTone}>{controlLabel}</OpsBadge></div>
      <div className="job-row-meta"><span>{shipmentDocumentTypeLabels[document.document_type]}</span><span>{bytes(document.size_bytes)}</span><span>{dateTime(document.uploaded_at)}</span>{document.expires_on ? <span>Expires {dateLabel(document.expires_on)}</span> : null}</div>
    </div>
    <div className="job-row-actions">
      <a href={`/api/admin/shipments/${encodeURIComponent(jobReference)}/documents/${document.id}`} className="ops-button" data-variant="ghost" data-size="xs" aria-label={`Download ${document.filename}`}><Download size={13} strokeWidth={1.75} aria-hidden="true"/>Download</a>
      <Link href={`/admin/documents?q=${encodeURIComponent(jobReference)}`} className="ops-button" data-variant="ghost" data-size="xs">Review</Link>
      {canDelete ? <button type="button" disabled={documentBusy} onClick={onDelete} className="ops-button" data-variant="danger" data-size="xs" aria-label={`Delete ${document.filename}`}><Trash2 size={13} strokeWidth={1.75} aria-hidden="true"/>Delete</button> : null}
    </div>
  </li>;
}
