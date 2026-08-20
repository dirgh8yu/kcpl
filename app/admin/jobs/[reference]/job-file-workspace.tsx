"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  Landmark,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
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
import {
  shipmentDocumentTypeLabels,
  shipmentDocumentTypes,
  type ShipmentDocument,
} from "../../../shipment-document-types";
import { shipmentStatusLabels } from "../../../shipment-types";
import {
  OpsButton,
  OpsEmptyState,
  OpsErrorState,
  OpsMetric,
  OpsMetricStrip,
  OpsPageHeader,
  OpsPanel,
  OpsStatusBadge,
} from "../../operations-ui";

const tabs = ["overview", "tasks", "customs", "documents", "costs"] as const;
type JobTab = (typeof tabs)[number];

function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function dateTimeLabel(value: string | null) {
  if (!value) return "No due date";
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

function priorityTone(priority: JobPriority): "neutral" | "warning" | "danger" {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  return "neutral";
}

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "delivered" || status === "completed") return "success";
  if (status === "cancelled" || status === "failed") return "danger";
  if (status.includes("custom") || status.includes("hold")) return "warning";
  if (status === "draft") return "neutral";
  return "info";
}

export function JobFileWorkspace({
  initialJob,
  role,
  canManageBranches,
  currentUserName,
  currentUserEmail,
}: {
  initialJob: DigitalJobFile;
  role: KcplStaffRole;
  canManageBranches: boolean;
  currentUserName: string;
  currentUserEmail: string;
}) {
  const [job, setJob] = useState(initialJob);
  const [activeTab, setActiveTab] = useState<JobTab>("overview");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [taskOpen, setTaskOpen] = useState(false);
  const [customsOpen, setCustomsOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [draft, setDraft] = useState({
    primaryBranch: job.primary_branch,
    handlingBranches: job.handling_branches,
    assignedToName: job.assigned_to_name ?? "",
    assignedToEmail: job.assigned_to_email ?? "",
    priority: job.priority,
    internalReference: job.internal_reference ?? "",
    internalNotes: job.internal_notes ?? "",
  });
  const [task, setTask] = useState({ title: "", detail: "", branch: job.primary_branch, dueAt: "", assignedToName: currentUserName, assignedToEmail: currentUserEmail });
  const [customs, setCustoms] = useState({ title: "", detail: "", branch: job.primary_branch, required: true });
  const [cost, setCost] = useState({ category: "freight" as JobCostCategory, label: "", vendor: "", amount: "", currency: "NPR" as CrmCurrency, notes: "" });

  const openTasks = useMemo(() => job.tasks.filter((item) => !item.completed), [job.tasks]);
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
      assignedToName: data.job.assigned_to_name ?? "",
      assignedToEmail: data.job.assigned_to_email ?? "",
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
        console.warn("Job documents unavailable", error);
        setNotice("Shipment documents are temporarily unavailable. The Job File itself is unaffected.");
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
      setTask({ title: "", detail: "", branch: job.primary_branch, dueAt: "", assignedToName: currentUserName, assignedToEmail: currentUserEmail });
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

  const tabCounts: Partial<Record<JobTab, number>> = {
    tasks: openTasks.length,
    customs: requiredCustoms.length - completedCustoms,
    documents: documents.length,
    costs: job.can_view_costs ? job.costs.length : undefined,
  };

  return <main>
    <OpsPageHeader
      eyebrow="Digital Job File"
      title={job.reference}
      description={`${job.origin || "Origin"} → ${job.destination || "Destination"}`}
      breadcrumbs={[{ label: "Operations", href: "/admin/shipments" }, { label: "Shipments", href: "/admin/shipments" }, { label: job.reference }]}
      meta={<span>{job.quote_reference} · Updated {dateLabel(job.updated_at)} · {kcplStaffRoleLabels[role]}</span>}
      actions={<><OpsStatusBadge tone={priorityTone(job.priority)}>{jobPriorityLabels[job.priority]} priority</OpsStatusBadge><OpsStatusBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsStatusBadge>{job.customer_id ? <OpsButton href={`/admin/crm/${encodeURIComponent(job.customer_id)}`}>Customer 360</OpsButton> : null}<OpsButton onClick={() => void refresh()}><RefreshCw size={13}/>Refresh</OpsButton></>}
    />

    <div className="ops-page-body ops-stack">
      <OpsMetricStrip columns={6}>
        <OpsMetric label="Primary branch" value={<span className="text-[16px]">{job.primary_branch}</span>} icon={<Landmark size={13}/>}/>
        <OpsMetric label="Open tasks" value={openTasks.length} icon={<ClipboardCheck size={13}/>} tone={openTasks.length ? "warning" : "success"}/>
        <OpsMetric label="Customs" value={`${completedCustoms}/${requiredCustoms.length}`} icon={<ShieldCheck size={13}/>} tone={requiredCustoms.length > completedCustoms ? "warning" : "success"}/>
        <OpsMetric label="Documents" value={documents.length} icon={<FileText size={13}/>}/>
        <OpsMetric label="ETA" value={<span className="text-[14px]">{dateLabel(job.eta)}</span>} icon={<CalendarClock size={13}/>}/>
        <OpsMetric label="Current location" value={<span className="text-[14px]">{job.current_location || "Not updated"}</span>} icon={<MapPin size={13}/>}/>
      </OpsMetricStrip>

      {notice ? <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e3e5e8] bg-white px-3.5 py-2.5 text-[11px] text-[#59616a]"><span>{notice}</span><button type="button" onClick={() => setNotice("")} className="font-semibold text-[#6b75a8]">Dismiss</button></div> : null}

      <div className="ops-panel overflow-visible">
        <nav className="flex overflow-x-auto border-b border-[#eceef0] px-2" aria-label="Job File sections">
          {tabs.map((tab) => {
            if (tab === "costs" && !job.can_view_costs) return null;
            const active = activeTab === tab;
            const count = tabCounts[tab];
            return <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`relative flex h-11 items-center gap-1.5 px-3 text-[11px] font-medium capitalize transition ${active ? "text-[#303a75]" : "text-[#737b84] hover:text-[#333940]"}`}>{tab}{count !== undefined ? <span className={`rounded px-1.5 py-0.5 text-[9px] ${active ? "bg-[#eef0ff] text-[#5367a8]" : "bg-[#f1f2f3] text-[#8c939b]"}`}>{count}</span> : null}{active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-[#5367d9]"/> : null}</button>;
          })}
        </nav>

        <div className="bg-[var(--ops-bg)] p-3 sm:p-4">
          {activeTab === "overview" ? <div className="ops-grid-2">
            <OpsPanel title="Job control" eyebrow="Ownership" description="Internal responsibility, branch handoffs and handling instructions.">
              <form onSubmit={saveSetup} className="grid gap-3 p-4 sm:grid-cols-2">
                <Field label="Primary branch"><select disabled={!canManageBranches} value={draft.primaryBranch} onChange={(event) => setDraft({ ...draft, primaryBranch: event.target.value as KcplBranch })}>{kcplBranches.map((branch) => <option key={branch}>{branch}</option>)}</select></Field>
                <Field label="Priority"><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as JobPriority })}>{jobPriorities.map((priority) => <option key={priority} value={priority}>{jobPriorityLabels[priority]}</option>)}</select></Field>
                <Field label="Assigned staff"><input value={draft.assignedToName} onChange={(event) => setDraft({ ...draft, assignedToName: event.target.value })} placeholder="Staff name"/></Field>
                <Field label="Staff email"><input type="email" value={draft.assignedToEmail} onChange={(event) => setDraft({ ...draft, assignedToEmail: event.target.value })}/></Field>
                <Field label="Internal job reference"><input value={draft.internalReference} onChange={(event) => setDraft({ ...draft, internalReference: event.target.value })} placeholder="Optional internal file/reference"/></Field>
                <Field label="Current handling"><div className="flex h-[34px] items-center rounded-lg border border-[#e1e4e7] bg-[#fafafa] px-3 text-xs text-[#69717a]">{job.current_location || "Location not updated"}</div></Field>
                <div className="sm:col-span-2"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">Handling branches</span><div className="flex flex-wrap gap-1.5">{kcplBranches.map((branch) => canManageBranches ? <button type="button" key={branch} onClick={() => toggleHandlingBranch(branch)} className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium ${draft.handlingBranches.includes(branch) ? "border-[#dce0fa] bg-[#f1f3ff] text-[#4655a0]" : "border-[#e1e4e7] bg-white text-[#737b84]"}`}>{branch}</button> : job.handling_branches.includes(branch) ? <OpsStatusBadge key={branch}>{branch}</OpsStatusBadge> : null)}</div></div>
                <div className="sm:col-span-2"><Field label="Internal operating notes"><textarea rows={5} value={draft.internalNotes} onChange={(event) => setDraft({ ...draft, internalNotes: event.target.value })} placeholder="Private handling instructions, counterpart details, exceptions and handoff context."/></Field></div>
                <div className="sm:col-span-2 flex justify-end"><OpsButton tone="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Job File"}</OpsButton></div>
              </form>
            </OpsPanel>

            <div className="ops-stack">
              <OpsPanel title="Shipment identity" eyebrow="Movement" description="Core record data sourced from the shipment and originating quote.">
                <div className="divide-y divide-[#eceef0] px-4 py-1">
                  <Info label="Customer" value={job.customer_name || "Not linked"}/><Info label="Quote" value={job.quote_reference}/><Info label="Mode" value={job.mode || "Not set"}/><Info label="Carrier" value={job.carrier || "Not assigned"}/><Info label="Carrier reference" value={job.carrier_reference || "Not assigned"}/><Info label="Current location" value={job.current_location || "Not updated"}/>
                </div>
              </OpsPanel>
              <OpsPanel title="Immediate attention" eyebrow="Operational state">
                <div className="divide-y divide-[#eceef0] px-4 py-1">
                  <Attention label="Open tasks" value={openTasks.length ? `${openTasks.length} outstanding` : "Clear"} tone={openTasks.length ? "warning" : "success"}/>
                  <Attention label="Customs checklist" value={requiredCustoms.length ? `${completedCustoms}/${requiredCustoms.length} complete` : "No required steps"} tone={requiredCustoms.length > completedCustoms ? "warning" : "success"}/>
                  <Attention label="Document storage" value={storageAvailable ? `${documents.length} files` : "Unavailable"} tone={storageAvailable ? "neutral" : "warning"}/>
                </div>
              </OpsPanel>
            </div>
          </div> : null}

          {activeTab === "tasks" ? <OpsPanel title="Operational tasks" eyebrow="Work queue" description="Internal task list for this shipment." action={<OpsButton onClick={() => setTaskOpen((value) => !value)}><Plus size={13}/>Add task</OpsButton>}>
            {taskOpen ? <form onSubmit={addTask} className="grid gap-3 border-b border-[#eceef0] bg-[#fcfcfc] p-4 sm:grid-cols-2 xl:grid-cols-4"><Field label="Task"><input required value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })}/></Field><Field label="Branch"><select value={task.branch} onChange={(event) => setTask({ ...task, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></Field><Field label="Due"><input type="datetime-local" value={task.dueAt} onChange={(event) => setTask({ ...task, dueAt: event.target.value })}/></Field><Field label="Assigned to"><input value={task.assignedToName} onChange={(event) => setTask({ ...task, assignedToName: event.target.value })}/></Field><div className="sm:col-span-2 xl:col-span-4"><Field label="Detail"><textarea rows={3} value={task.detail} onChange={(event) => setTask({ ...task, detail: event.target.value })}/></Field></div><div className="sm:col-span-2 xl:col-span-4 flex justify-end gap-2"><OpsButton type="button" onClick={() => setTaskOpen(false)}>Cancel</OpsButton><OpsButton tone="primary" type="submit" disabled={busy}>Create task</OpsButton></div></form> : null}
            {job.tasks.length ? <div className="divide-y divide-[#eceef0]">{job.tasks.map((item) => <TaskRow key={item.id} item={item} busy={busy} onToggle={() => void action({ action: "toggle_task", taskId: item.id, completed: !item.completed })}/>)}</div> : <OpsEmptyState compact title="No operational tasks" detail="Add a task when this shipment needs a specific follow-up or handoff."/>}
          </OpsPanel> : null}

          {activeTab === "customs" ? <OpsPanel title="Customs & clearance" eyebrow="Checklist" description="Required clearance steps across handling branches." action={<OpsButton onClick={() => setCustomsOpen((value) => !value)}><Plus size={13}/>Add step</OpsButton>}>
            {customsOpen ? <form onSubmit={addCustoms} className="grid gap-3 border-b border-[#eceef0] bg-[#fcfcfc] p-4 sm:grid-cols-2"><Field label="Step"><input required value={customs.title} onChange={(event) => setCustoms({ ...customs, title: event.target.value })}/></Field><Field label="Branch"><select value={customs.branch} onChange={(event) => setCustoms({ ...customs, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></Field><div className="sm:col-span-2"><Field label="Detail"><textarea rows={3} value={customs.detail} onChange={(event) => setCustoms({ ...customs, detail: event.target.value })}/></Field></div><label className="flex items-center gap-2 text-[11px] font-medium text-[#606871]"><input type="checkbox" checked={customs.required} onChange={(event) => setCustoms({ ...customs, required: event.target.checked })}/>Required step</label><div className="sm:col-span-2 flex justify-end gap-2"><OpsButton type="button" onClick={() => setCustomsOpen(false)}>Cancel</OpsButton><OpsButton tone="primary" type="submit" disabled={busy}>Add clearance step</OpsButton></div></form> : null}
            {job.customs_steps.length ? <div className="divide-y divide-[#eceef0]">{job.customs_steps.map((item) => <CustomsRow key={item.id} item={item} busy={busy} onToggle={() => void action({ action: "toggle_customs", stepId: item.id, completed: !item.completed })}/>)}</div> : <OpsEmptyState compact title="No customs checklist" detail="Add only the clearance steps that apply to this movement."/>}
          </OpsPanel> : null}

          {activeTab === "documents" ? <OpsPanel title="Shipment documents" eyebrow="Firebase Storage" description="Private operational files linked to this shipment.">
            {!storageAvailable ? <OpsErrorState tone="warning" title="Document storage unavailable" detail="The Job File remains safe and usable. Uploads can resume when Firebase Storage is available."/> : null}
            <form onSubmit={uploadDocument} className="grid gap-3 border-b border-[#eceef0] bg-[#fcfcfc] p-4 sm:grid-cols-[220px_minmax(0,1fr)_auto]"><Field label="Document type"><select name="documentType" defaultValue="other">{shipmentDocumentTypes.map((type) => <option key={type} value={type}>{shipmentDocumentTypeLabels[type]}</option>)}</select></Field><Field label="File"><input required name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"/></Field><div className="flex items-end"><OpsButton tone="primary" type="submit" disabled={documentBusy || !storageAvailable}><Upload size={13}/>{documentBusy ? "Uploading…" : "Upload"}</OpsButton></div></form>
            {documentsLoading ? <div className="p-4 text-[11px] text-[#858c94]">Loading documents…</div> : documents.length ? <div className="divide-y divide-[#eceef0]">{documents.map((document) => <div key={document.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><span className="grid h-8 w-8 place-items-center rounded-lg border border-[#e2e5e8] bg-[#fafafa] text-[#7c8490]"><FileText size={14}/></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-[#30363d]">{document.filename}</p><p className="mt-0.5 text-[10px] text-[#9299a0]">{shipmentDocumentTypeLabels[document.document_type]} · {bytes(document.size_bytes)}</p></div><a href={`/api/admin/shipments/${encodeURIComponent(job.reference)}/documents/${document.id}`} className="ops-button ops-button-secondary"><Download size={12}/>Download</a><OpsButton tone="danger" disabled={documentBusy} onClick={() => void deleteDocument(document)}><Trash2 size={12}/>Delete</OpsButton></div>)}</div> : <OpsEmptyState compact title="No shipment documents" detail="Upload customs, transport, commercial or supporting files when they become available."/>}
          </OpsPanel> : null}

          {activeTab === "costs" && job.can_view_costs ? <OpsPanel title="Job costs" eyebrow="Internal commercial" description="Internal cost trail for this shipment. This data is not exposed to Operations-only users." action={<OpsButton onClick={() => setCostOpen((value) => !value)}><Plus size={13}/>Add cost</OpsButton>}>
            {Object.keys(job.cost_totals).length ? <div className="grid gap-px border-b border-[#eceef0] bg-[#eceef0] sm:grid-cols-2 xl:grid-cols-4">{Object.entries(job.cost_totals).map(([currency, total]) => <div key={currency} className="bg-white px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#858c94]">{currency} costs</p><p className="mt-1 text-lg font-semibold tracking-[-.02em] text-[#24292f]">{money(total ?? 0, currency)}</p></div>)}</div> : null}
            {costOpen ? <form onSubmit={addCost} className="grid gap-3 border-b border-[#eceef0] bg-[#fcfcfc] p-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Category"><select value={cost.category} onChange={(event) => setCost({ ...cost, category: event.target.value as JobCostCategory })}>{jobCostCategories.map((category) => <option key={category} value={category}>{jobCostCategoryLabels[category]}</option>)}</select></Field><Field label="Description"><input required value={cost.label} onChange={(event) => setCost({ ...cost, label: event.target.value })}/></Field><Field label="Vendor"><input value={cost.vendor} onChange={(event) => setCost({ ...cost, vendor: event.target.value })}/></Field><div className="grid grid-cols-[1fr_100px] gap-2"><Field label="Amount"><input required type="number" min="0" step="0.01" value={cost.amount} onChange={(event) => setCost({ ...cost, amount: event.target.value })}/></Field><Field label="Currency"><select value={cost.currency} onChange={(event) => setCost({ ...cost, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field></div><div className="md:col-span-2 xl:col-span-4"><Field label="Notes"><textarea rows={3} value={cost.notes} onChange={(event) => setCost({ ...cost, notes: event.target.value })}/></Field></div><div className="md:col-span-2 xl:col-span-4 flex justify-end gap-2"><OpsButton type="button" onClick={() => setCostOpen(false)}>Cancel</OpsButton><OpsButton tone="primary" type="submit" disabled={busy}>Save cost</OpsButton></div></form> : null}
            {job.costs.length ? <div className="overflow-x-auto"><table className="ops-dense-table min-w-[760px]"><thead><tr><th className="px-4 text-left">Description</th><th className="px-3 text-left">Category</th><th className="px-3 text-left">Vendor</th><th className="px-3 text-left">Source</th><th className="px-4 text-right">Amount</th></tr></thead><tbody>{job.costs.map((item) => <tr key={item.id}><td className="px-4"><strong className="font-medium text-[#343a40]">{item.label}</strong>{item.notes ? <p className="mt-0.5 text-[10px] text-[#9299a0]">{item.notes}</p> : null}</td><td className="px-3">{jobCostCategoryLabels[item.category]}</td><td className="px-3">{item.vendor || "—"}</td><td className="px-3"><OpsStatusBadge>{item.source_type === "payable" ? "Payable" : "Manual"}</OpsStatusBadge></td><td className="px-4 text-right font-medium">{money(item.amount, item.currency)}</td></tr>)}</tbody></table></div> : <OpsEmptyState compact title="No internal costs recorded" detail="Add manual costs here or link supplier bills through Accounts Payable."/>}
          </OpsPanel> : null}
        </div>
      </div>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span>{children}</label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-5 py-3 text-[11px]"><span className="text-[#858c94]">{label}</span><strong className="max-w-[65%] text-right font-medium text-[#414850]">{value}</strong></div>;
}

function Attention({ label, value, tone }: { label: string; value: string; tone: "neutral" | "warning" | "success" }) {
  return <div className="flex items-center justify-between gap-4 py-3 text-[11px]"><span className="text-[#737b84]">{label}</span><OpsStatusBadge tone={tone}>{value}</OpsStatusBadge></div>;
}

function TaskRow({ item, busy, onToggle }: { item: JobTask; busy: boolean; onToggle: () => void }) {
  return <div className={`flex items-start gap-3 px-4 py-3 ${item.completed ? "bg-[#fbfcfb]" : "bg-white"}`}><button type="button" disabled={busy} onClick={onToggle} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${item.completed ? "border-[#bdd7c6] bg-[#edf6f0] text-[#47765b]" : "border-[#d8dce0] bg-white text-transparent hover:border-[#aeb5bd]"}`} aria-label={item.completed ? `Reopen ${item.title}` : `Complete ${item.title}`}><Check size={11}/></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className={`text-xs font-medium ${item.completed ? "text-[#7f878f] line-through" : "text-[#30363d]"}`}>{item.title}</p><OpsStatusBadge>{item.branch}</OpsStatusBadge>{item.completed ? <OpsStatusBadge tone="success">Completed</OpsStatusBadge> : null}</div>{item.detail ? <p className="mt-1 text-[11px] leading-5 text-[#737b84]">{item.detail}</p> : null}<div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#969da4]"><span><CalendarClock size={10} className="mr-1 inline"/>{dateTimeLabel(item.due_at)}</span><span><UserRound size={10} className="mr-1 inline"/>{item.assigned_to_name || "Unassigned"}</span></div></div></div>;
}

function CustomsRow({ item, busy, onToggle }: { item: CustomsStep; busy: boolean; onToggle: () => void }) {
  return <div className="flex items-start gap-3 px-4 py-3"><button type="button" disabled={busy} onClick={onToggle} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${item.completed ? "border-[#bdd7c6] bg-[#edf6f0] text-[#47765b]" : "border-[#d8dce0] bg-white text-transparent hover:border-[#aeb5bd]"}`} aria-label={item.completed ? `Reopen ${item.title}` : `Complete ${item.title}`}><Check size={11}/></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className={`text-xs font-medium ${item.completed ? "text-[#7f878f] line-through" : "text-[#30363d]"}`}>{item.title}</p><OpsStatusBadge>{item.branch}</OpsStatusBadge>{item.required ? <OpsStatusBadge tone={item.completed ? "success" : "warning"}>Required</OpsStatusBadge> : <OpsStatusBadge>Optional</OpsStatusBadge>}</div>{item.detail ? <p className="mt-1 text-[11px] leading-5 text-[#737b84]">{item.detail}</p> : null}<p className="mt-1.5 text-[10px] text-[#969da4]">Created {dateLabel(item.created_at)}{item.completed_at ? ` · Completed ${dateLabel(item.completed_at)}` : ""}</p></div></div>;
}
