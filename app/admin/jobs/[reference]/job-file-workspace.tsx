"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
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
import { StaffAssignmentPicker } from "../../staff-assignment-picker";
import { shipmentDocumentTypeLabels, shipmentDocumentTypes, type ShipmentDocument } from "../../../shipment-document-types";
import { shipmentStatusLabels, type ShipmentStatus } from "../../../shipment-types";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsProgress, OpsStat, OpsStatStrip, OpsSurface } from "../../operations-ui";

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
  role,
  canManageBranches,
  currentUserName,
  currentUserEmail,
  nowIso,
}: {
  initialJob: DigitalJobFile;
  role: KcplStaffRole;
  canManageBranches: boolean;
  currentUserName: string;
  currentUserEmail: string;
  nowIso: string;
}) {
  const [job, setJob] = useState(initialJob);
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
    const data = await response.json() as { job?: DigitalJobFile; error?: string };
    if (!response.ok || !data.job) throw new Error(data.error || "Could not refresh the Job File.");
    setJob(data.job);
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
      setNotice(`${data.document.filename} uploaded.`);
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
        description={<span className="flex flex-wrap items-center gap-2"><strong className="text-[#5c534c]">{job.customer_name || "Customer not linked"}</strong><span>{job.origin || "Origin"}</span><ArrowRight size={12} className="text-[#c7755d]"/><span>{job.destination || "Destination"}</span></span>}
        meta={<><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge><OpsBadge>{kcplStaffRoleLabels[role]}</OpsBadge><span>Quote <OpsMono>{job.quote_reference}</OpsMono></span><span>Updated {dateTime(job.updated_at)}</span></>}
        actions={<><Link href="/admin/shipments" className="ops-button" data-variant="secondary" data-size="md">Back to shipments</Link><OpsButton variant="secondary" onClick={() => setSetupOpen((current) => !current)}><BriefcaseBusiness size={13}/>{setupOpen ? "Close setup" : "Edit handling"}</OpsButton><OpsButton variant="primary" onClick={() => refresh().catch((error) => setNotice(error instanceof Error ? error.message : "Refresh failed."))}><RefreshCw size={13}/>Refresh</OpsButton></>}
      />

      <OpsStatStrip>
        <OpsStat label="Primary branch" value={job.primary_branch} icon={<Landmark size={13}/>} />
        <OpsStat label="Open tasks" value={openTasks.length} detail={overdueTasks.length ? `${overdueTasks.length} overdue` : "No overdue work"} icon={<ClipboardCheck size={13}/>} tone={overdueTasks.length ? "danger" : "neutral"}/>
        <OpsStat label="Customs" value={`${completedCustoms}/${requiredCustoms.length}`} detail="required steps complete" icon={<ShieldCheck size={13}/>} tone={requiredCustoms.length && completedCustoms < requiredCustoms.length ? "warning" : "success"}/>
        <OpsStat label="Documents" value={documents.length} icon={<FileText size={13}/>} />
        <OpsStat label="ETA" value={dateLabel(job.eta)} icon={<CalendarDays size={13}/>} />
        <OpsStat label="Priority" value={jobPriorityLabels[job.priority]} icon={<BriefcaseBusiness size={13}/>} tone={job.priority === "urgent" ? "danger" : job.priority === "high" ? "warning" : "neutral"}/>
      </OpsStatStrip>

      <div className="ops-content-wide ops-stack">
        {notice ? <OpsNotice tone={notice.toLowerCase().includes("could not") || notice.toLowerCase().includes("failed") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}

        {setupOpen ? <OpsSurface eyebrow="Handling setup" title="Ownership, branches & private instructions" description="Edit the operational spine of this file. Changes stay internal to KCPL.">
          <form onSubmit={saveSetup} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <OpsField label="Primary branch"><select disabled={!canManageBranches} value={draft.primaryBranch} onChange={(event) => setDraft({ ...draft, primaryBranch: event.target.value as KcplBranch })}>{kcplBranches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
            <OpsField label="Priority"><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as JobPriority })}>{jobPriorities.map((priority) => <option key={priority} value={priority}>{jobPriorityLabels[priority]}</option>)}</select></OpsField>
            <OpsField label="Internal reference"><input value={draft.internalReference} onChange={(event) => setDraft({ ...draft, internalReference: event.target.value })} placeholder="Optional internal file/ref"/></OpsField>
            <div className="md:col-span-2"><OpsField label="Assigned staff" hint="Choose from People & branches. Identity and contact details stay synchronized automatically."><StaffAssignmentPicker branch={draft.primaryBranch} value={{ uid: draft.assignedToUid, name: draft.assignedToName, email: draft.assignedToEmail, phone: draft.assignedToPhone }} onChange={(staff) => setDraft((current) => ({ ...current, assignedToUid: staff.uid ?? "", assignedToName: staff.name, assignedToEmail: staff.email, assignedToPhone: staff.phone }))}/></OpsField></div>
            <OpsField label="Current handling"><div className="ops-input flex items-center">{job.current_location || "Location not updated"}</div></OpsField>
            <div className="md:col-span-2 xl:col-span-3"><p className="mb-2 text-[9px] font-bold uppercase tracking-[.09em] text-[#9c928a]">Handling branches</p><div className="flex flex-wrap gap-2">{kcplBranches.map((branch) => <button type="button" key={branch} disabled={!canManageBranches} onClick={() => toggleHandlingBranch(branch)} className="ops-badge disabled:opacity-60" data-tone={draft.handlingBranches.includes(branch) ? "accent" : "neutral"}>{draft.handlingBranches.includes(branch) ? <Check size={10}/> : null}{branch}</button>)}</div></div>
            <OpsField label="Internal operating notes" className="md:col-span-2 xl:col-span-3"><textarea value={draft.internalNotes} onChange={(event) => setDraft({ ...draft, internalNotes: event.target.value })} placeholder="Private handling instructions, counterpart details, exceptions, branch handoff context…"/></OpsField>
            <div className="flex gap-2 md:col-span-2 xl:col-span-3"><OpsButton variant="primary" disabled={busy}>{busy ? "Saving…" : "Save handling"}</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setSetupOpen(false)}>Cancel</OpsButton></div>
          </form>
        </OpsSurface> : null}

        <div className="ops-grid-main">
          <div className="ops-stack">
            <OpsSurface eyebrow="Work queue" title="Operational tasks" description="Every unfinished action for this shipment, kept beside the record it belongs to." action={<OpsButton variant="secondary" size="sm" onClick={() => setTaskOpen((value) => !value)}><Plus size={12}/>{taskOpen ? "Close" : "Add task"}</OpsButton>}>
              {taskOpen ? <form onSubmit={addTask} className="mb-4 grid gap-3 rounded-[14px] border border-[#ebe3dc] bg-[#faf7f4] p-4 sm:grid-cols-2">
                <OpsField label="Task"><input required value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })}/></OpsField>
                <OpsField label="Branch"><select value={task.branch} onChange={(event) => setTask({ ...task, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
                <OpsField label="Due"><input type="datetime-local" value={task.dueAt} onChange={(event) => setTask({ ...task, dueAt: event.target.value })}/></OpsField>
                <div className="sm:col-span-2"><OpsField label="Assigned to" hint="Choose an active staff member. Contact details stay linked to People & branches."><StaffAssignmentPicker branch={task.branch} compact value={{ uid: task.assignedToUid, name: task.assignedToName, email: task.assignedToEmail, phone: task.assignedToPhone }} onChange={(staff) => setTask((current) => ({ ...current, assignedToUid: staff.uid ?? "", assignedToName: staff.name, assignedToEmail: staff.email, assignedToPhone: staff.phone }))}/></OpsField></div>
                <OpsField label="Detail" className="sm:col-span-2"><textarea value={task.detail} onChange={(event) => setTask({ ...task, detail: event.target.value })}/></OpsField>
                <div className="flex gap-2 sm:col-span-2"><OpsButton variant="primary" disabled={busy}>Create task</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setTaskOpen(false)}>Cancel</OpsButton></div>
              </form> : null}
              {job.tasks.length ? <div className="divide-y divide-[#eee7e1]">{job.tasks.map((item) => <TaskRow key={item.id} item={item} busy={busy} nowMs={nowMs} onToggle={() => action({ action: "toggle_task", taskId: item.id, completed: !item.completed })}/>)}</div> : <OpsEmptyState icon={<ClipboardCheck size={18}/>} title="No operational tasks yet" description="Add work here when a shipment needs an owner, a due time or a follow-up."/>}
            </OpsSurface>

            <OpsSurface eyebrow="Clearance workspace" title="Customs & clearance" description="Required steps stay visible until cleared, without turning the job file into a compliance spreadsheet." action={<OpsButton variant="secondary" size="sm" onClick={() => setCustomsOpen((value) => !value)}><Plus size={12}/>{customsOpen ? "Close" : "Add step"}</OpsButton>}>
              {requiredCustoms.length ? <div className="mb-4 rounded-[13px] border border-[#ebe3dc] bg-[#faf7f4] p-3"><div className="flex items-center justify-between gap-3"><span className="text-[9px] font-bold text-[#6c625b]">Required clearance progress</span><span className="text-[9px] font-semibold text-[#928880]">{completedCustoms} of {requiredCustoms.length}</span></div><div className="mt-2"><OpsProgress value={completedCustoms} max={Math.max(requiredCustoms.length, 1)} tone={completedCustoms === requiredCustoms.length ? "success" : "warning"}/></div></div> : null}
              {customsOpen ? <form onSubmit={addCustoms} className="mb-4 grid gap-3 rounded-[14px] border border-[#ebe3dc] bg-[#faf7f4] p-4 sm:grid-cols-2">
                <OpsField label="Clearance step"><input required value={customs.title} onChange={(event) => setCustoms({ ...customs, title: event.target.value })}/></OpsField>
                <OpsField label="Branch"><select value={customs.branch} onChange={(event) => setCustoms({ ...customs, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
                <OpsField label="Detail" className="sm:col-span-2"><textarea value={customs.detail} onChange={(event) => setCustoms({ ...customs, detail: event.target.value })}/></OpsField>
                <label className="flex items-center gap-2 text-[10px] font-semibold text-[#675d56]"><input type="checkbox" checked={customs.required} onChange={(event) => setCustoms({ ...customs, required: event.target.checked })}/> Required before clearance</label>
                <div className="flex gap-2 sm:col-span-2"><OpsButton variant="primary" disabled={busy}>Add clearance step</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setCustomsOpen(false)}>Cancel</OpsButton></div>
              </form> : null}
              {job.customs_steps.length ? <div className="divide-y divide-[#eee7e1]">{job.customs_steps.map((item) => <CustomsRow key={item.id} item={item} busy={busy} onToggle={() => action({ action: "toggle_customs", stepId: item.id, completed: !item.completed })}/>)}</div> : <OpsEmptyState icon={<ShieldCheck size={18}/>} title="No customs checklist yet" description="Add only the clearance steps this movement actually requires."/>}
            </OpsSurface>

            <OpsSurface eyebrow="Private file note" title="Operating context" description="The running context that should follow this movement from branch to branch.">
              {job.internal_notes ? <p className="whitespace-pre-wrap text-[11px] leading-6 text-[#655c54]">{job.internal_notes}</p> : <OpsEmptyState title="No internal operating note" description="Use Edit handling above to add branch handoff context, counterpart instructions or exceptional handling notes."/>}
            </OpsSurface>
          </div>

          <aside className="ops-stack xl:sticky xl:top-[76px]">
            <OpsSurface eyebrow="Shipment identity" title={job.customer_name || "Unlinked customer"} description={`${job.origin || "Origin"} → ${job.destination || "Destination"}`}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Fact icon={<UserRound size={12}/>} label="Customer" value={job.customer_name || "Not linked"}/><Fact label="Quote" value={job.quote_reference} mono/><Fact label="Mode" value={job.mode || "Not set"}/><Fact label="Carrier" value={job.carrier || "Not assigned"}/><Fact label="Carrier ref" value={job.carrier_reference || "Not assigned"} mono/><Fact icon={<MapPin size={12}/>} label="Current location" value={job.current_location || "Not updated"}/><Fact icon={<Landmark size={12}/>} label="Primary branch" value={<Link href={`/admin/branches/${encodeURIComponent(job.primary_branch)}`} className="hover:text-[#a45747] hover:underline">{job.primary_branch}</Link>}/>
                <Fact icon={<UsersRound size={12}/>} label="Owner" value={job.assigned_to_uid ? <Link href={`/admin/workload/${encodeURIComponent(job.assigned_to_uid)}`} className="hover:text-[#a45747] hover:underline">{job.assigned_to_name || job.assigned_to_email || "Assigned staff"}</Link> : job.assigned_to_name || job.assigned_to_email || "Unassigned"}/>
                <Fact icon={<Mail size={11}/>} label="Owner email" value={job.assigned_to_email ? <a href={`mailto:${job.assigned_to_email}`} className="hover:text-[#a45747] hover:underline">{job.assigned_to_email}</a> : "Not set"}/>
                <Fact icon={<Phone size={11}/>} label="Owner phone" value={job.assigned_to_phone ? <a href={`tel:${job.assigned_to_phone}`} className="hover:text-[#a45747] hover:underline">{job.assigned_to_phone}</a> : "Not set"}/>
                <Fact label="Role / title" value={job.assigned_to_job_title || "Not recorded"}/>
                <Fact label="Staff branches" value={job.assigned_to_branches.length ? <span className="flex flex-wrap gap-x-2 gap-y-1">{job.assigned_to_branches.map((branch) => <Link key={branch} href={`/admin/branches/${encodeURIComponent(branch)}`} className="hover:text-[#a45747] hover:underline">{branch}</Link>)}</span> : "Not recorded"}/>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">{job.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(job.customer_id)}`} className="ops-button" data-variant="secondary" data-size="sm">Open Customer 360</Link> : null}{job.assigned_to_uid ? <Link href={`/admin/workload/${encodeURIComponent(job.assigned_to_uid)}`} className="ops-button" data-variant="secondary" data-size="sm">Open staff workload</Link> : null}<Link href={`/admin/jobs/${encodeURIComponent(job.reference)}/profitability`} className="ops-button" data-variant="ghost" data-size="sm">Profitability</Link></div>
            </OpsSurface>

            <OpsSurface eyebrow="Document vault" title="Shipment documents" description="Private Firebase Storage files attached to this movement." action={<span className="text-[9px] font-semibold text-[#938981]">{documents.length} files</span>}>
              {!storageAvailable ? <OpsNotice tone="warning">Firebase Storage is unavailable for this deployment.</OpsNotice> : null}
              <form onSubmit={uploadDocument} className="mt-3 grid gap-3 rounded-[13px] border border-[#ebe3dc] bg-[#faf7f4] p-3">
                <OpsField label="Document type"><select name="documentType" defaultValue="other">{shipmentDocumentTypes.map((type) => <option key={type} value={type}>{shipmentDocumentTypeLabels[type]}</option>)}</select></OpsField>
                <OpsField label="File"><input required name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"/></OpsField>
                <OpsButton variant="primary" size="sm" disabled={documentBusy || !storageAvailable}><Upload size={12}/>{documentBusy ? "Uploading…" : "Upload document"}</OpsButton>
              </form>
              <div className="mt-3 divide-y divide-[#eee7e1]">{documentsLoading ? <p className="py-4 text-[10px] text-[#928880]">Loading documents…</p> : documents.length ? documents.map((document) => <DocumentRow key={document.id} document={document} jobReference={job.reference} documentBusy={documentBusy} onDelete={() => deleteDocument(document)}/>) : <OpsEmptyState icon={<FileText size={17}/>} title="No documents yet" description="Upload AWBs, BLs, invoices, packing lists and clearance documents here."/>}</div>
            </OpsSurface>

            {job.can_view_costs ? <OpsSurface eyebrow="Commercial control" title="Job costs" description="Internal only. Cost data never appears to operations roles without permission." action={<OpsButton variant="secondary" size="sm" onClick={() => setCostOpen((value) => !value)}><Plus size={12}/>{costOpen ? "Close" : "Add cost"}</OpsButton>}>
              {Object.keys(job.cost_totals).length ? <div className="grid grid-cols-2 gap-2">{Object.entries(job.cost_totals).map(([currency, total]) => <div key={currency} className="rounded-[12px] border border-[#ebe3dc] bg-[#faf7f4] p-3"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">{currency} costs</p><p className="mt-1.5 text-[13px] font-[720] text-[#514840]">{money(total ?? 0, currency)}</p>{job.profit_totals[currency as CrmCurrency] !== undefined ? <p className="mt-1 text-[8px] text-[#8d837b]">Profit {money(job.profit_totals[currency as CrmCurrency] ?? 0, currency)}</p> : null}</div>)}</div> : null}
              {costOpen ? <form onSubmit={addCost} className="mt-3 grid gap-3 rounded-[13px] border border-[#ebe3dc] bg-[#faf7f4] p-3"><OpsField label="Category"><select value={cost.category} onChange={(event) => setCost({ ...cost, category: event.target.value as JobCostCategory })}>{jobCostCategories.map((category) => <option key={category} value={category}>{jobCostCategoryLabels[category]}</option>)}</select></OpsField><OpsField label="Description"><input required value={cost.label} onChange={(event) => setCost({ ...cost, label: event.target.value })}/></OpsField><OpsField label="Vendor"><input value={cost.vendor} onChange={(event) => setCost({ ...cost, vendor: event.target.value })}/></OpsField><div className="grid grid-cols-[1fr_.7fr] gap-2"><OpsField label="Amount"><input required type="number" min="0" step="0.01" value={cost.amount} onChange={(event) => setCost({ ...cost, amount: event.target.value })}/></OpsField><OpsField label="Currency"><select value={cost.currency} onChange={(event) => setCost({ ...cost, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></OpsField></div><OpsField label="Notes"><textarea value={cost.notes} onChange={(event) => setCost({ ...cost, notes: event.target.value })}/></OpsField><OpsButton variant="primary" size="sm" disabled={busy}>Save cost</OpsButton></form> : null}
              <div className="mt-3 divide-y divide-[#eee7e1]">{job.costs.length ? job.costs.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-[10px] font-bold text-[#514840]">{item.label}</p><p className="mt-1 text-[8px] text-[#9a9088]">{jobCostCategoryLabels[item.category]}{item.vendor ? ` · ${item.vendor}` : ""}{item.source_reference ? ` · ${item.source_reference}` : ""}</p></div><strong className="shrink-0 text-[10px] text-[#514840]">{money(item.amount, item.currency)}</strong></div>) : <OpsEmptyState icon={<WalletCards size={17}/>} title="No costs recorded" description="Add supplier, freight, customs and handling costs here."/>}</div>
            </OpsSurface> : <OpsSurface eyebrow="Commercial controls" title="Cost data restricted" description="Your role can operate this shipment, but commercial cost data is intentionally withheld from the browser."><div className="flex items-start gap-3 rounded-[13px] bg-[#faf7f4] p-3 text-[#756b63]"><Landmark size={15} className="mt-0.5 shrink-0 text-[#b77861]"/><p className="text-[10px] leading-5">You still have full access to the operational Job File, tasks, customs and documents allowed by your role.</p></div></OpsSurface>}
          </aside>
        </div>
      </div>
    </OpsPage>
  );
}

function Fact({ icon, label, value, mono = false }: { icon?: React.ReactNode; label: string; value: React.ReactNode; mono?: boolean }) {
  return <div><p className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">{icon}{label}</p><div className="mt-1.5 break-words text-[10px] font-semibold text-[#5b524b]">{mono && typeof value === "string" ? <OpsMono>{value}</OpsMono> : value}</div></div>;
}

function TaskRow({ item, busy, nowMs, onToggle }: { item: JobTask; busy: boolean; nowMs: number; onToggle: () => void }) {
  const overdue = !item.completed && Boolean(item.due_at) && new Date(item.due_at!).getTime() < nowMs;
  const assigneeName = item.assigned_to_name || item.assigned_to_email || "Unassigned";
  return <div className="flex items-start gap-3 py-3.5"><button type="button" disabled={busy} onClick={onToggle} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${item.completed ? "border-[#93aa97] bg-[#edf4ee] text-[#637c68]" : overdue ? "border-[#dda9aa] bg-[#fff0f0] text-transparent" : "border-[#dcd3cc] bg-white text-transparent"}`} aria-label={item.completed ? `Reopen ${item.title}` : `Complete ${item.title}`}><Check size={11}/></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className={`text-[10px] ${item.completed ? "text-[#968c84] line-through" : "text-[#514840]"}`}>{item.title}</strong>{overdue ? <OpsBadge tone="danger">Overdue</OpsBadge> : null}<Link href={`/admin/branches/${encodeURIComponent(item.branch)}`}><OpsBadge>{item.branch}</OpsBadge></Link></div>{item.detail ? <p className="mt-1 text-[9px] leading-5 text-[#877d75]">{item.detail}</p> : null}<div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] text-[#9f958d]">{item.assigned_to_uid ? <Link href={`/admin/workload/${encodeURIComponent(item.assigned_to_uid)}`} className="font-semibold hover:text-[#a45747] hover:underline">{assigneeName}</Link> : <span>{assigneeName}</span>}{item.assigned_to_email ? <a href={`mailto:${item.assigned_to_email}`} className="hover:text-[#a45747] hover:underline">{item.assigned_to_email}</a> : null}{item.assigned_to_phone ? <a href={`tel:${item.assigned_to_phone}`} className="hover:text-[#a45747] hover:underline">{item.assigned_to_phone}</a> : null}<span>{item.due_at ? `due ${dateTime(item.due_at)}` : "no due time"}</span></div></div></div>;
}

function CustomsRow({ item, busy, onToggle }: { item: CustomsStep; busy: boolean; onToggle: () => void }) {
  return <div className="flex items-start gap-3 py-3.5"><button type="button" disabled={busy} onClick={onToggle} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border ${item.completed ? "border-[#93aa97] bg-[#edf4ee] text-[#637c68]" : "border-[#dcd3cc] bg-white text-transparent"}`} aria-label={item.completed ? `Reopen ${item.title}` : `Complete ${item.title}`}><Check size={11}/></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className={`text-[10px] ${item.completed ? "text-[#968c84]" : "text-[#514840]"}`}>{item.title}</strong><OpsBadge tone={item.required ? "warning" : "neutral"}>{item.required ? "Required" : "Optional"}</OpsBadge><Link href={`/admin/branches/${encodeURIComponent(item.branch)}`}><OpsBadge>{item.branch}</OpsBadge></Link></div>{item.detail ? <p className="mt-1 text-[9px] leading-5 text-[#877d75]">{item.detail}</p> : null}<p className="mt-1.5 text-[8px] text-[#9f958d]">{item.completed ? `Cleared ${dateTime(item.completed_at)}${item.completed_by ? ` by ${item.completed_by}` : ""}` : `Added ${dateTime(item.created_at)}`}</p></div></div>;
}

function DocumentRow({ document, jobReference, documentBusy, onDelete }: { document: ShipmentDocument; jobReference: string; documentBusy: boolean; onDelete: () => void }) {
  return <div className="flex items-start gap-3 py-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#f4eee9] text-[#9b745f]"><FileText size={14}/></span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-[#514840]">{document.filename}</p><p className="mt-1 text-[8px] text-[#9b9189]">{shipmentDocumentTypeLabels[document.document_type]} · {bytes(document.size_bytes)} · {dateTime(document.uploaded_at)}</p><div className="mt-2 flex flex-wrap gap-1.5"><a href={`/api/admin/shipments/${encodeURIComponent(jobReference)}/documents/${document.id}`} className="ops-button" data-variant="ghost" data-size="sm"><Download size={10}/>Download</a><button type="button" disabled={documentBusy} onClick={onDelete} className="ops-button" data-variant="danger" data-size="sm"><Trash2 size={10}/>Delete</button></div></div></div>;
}
