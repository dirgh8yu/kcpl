"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  Landmark,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
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
import {
  shipmentDocumentTypeLabels,
  shipmentDocumentTypes,
  type ShipmentDocument,
} from "../../../shipment-document-types";
import { shipmentStatusLabels } from "../../../shipment-types";

function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
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

  return <main className="min-h-screen bg-[#f4f1e9] text-[#10263f]">
    <header className="bg-[#0b1724] px-5 py-6 text-white lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4"><Link href="/admin" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/65 hover:bg-white/10"><ArrowLeft size={16}/></Link><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#d4ad62]">KCPL Digital Job File</p><h1 className="mt-1 text-2xl font-black tracking-[-.035em]">{job.reference}</h1><p className="mt-1 text-xs text-white/45">{job.origin || "Origin"} → {job.destination || "Destination"} · {job.quote_reference}</p></div></div>
          <div className="flex flex-wrap gap-2"><span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[.1em] text-white/65">{kcplStaffRoleLabels[role]}</span><span className="rounded-full bg-[#d4ad62] px-3 py-2 text-[9px] font-black uppercase tracking-[.1em] text-[#10263f]">{shipmentStatusLabels[job.status]}</span></div>
        </div>
      </div>
    </header>

    <section className="border-b border-black/10 bg-[#10263f] px-5 pb-5 text-white lg:px-8">
      <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Metric label="Primary branch" value={job.primary_branch} icon={<Landmark size={14}/>}/>
        <Metric label="Open tasks" value={String(openTasks.length)} icon={<ClipboardCheck size={14}/>}/>
        <Metric label="Customs" value={`${completedCustoms}/${requiredCustoms.length}`} icon={<ShieldCheck size={14}/>}/>
        <Metric label="Documents" value={String(documents.length)} icon={<FileText size={14}/>}/>
        <Metric label="ETA" value={dateLabel(job.eta)} icon={<MapPin size={14}/>}/>
        <Metric label="Priority" value={jobPriorityLabels[job.priority]} icon={<BriefcaseBusiness size={14}/>} accent={job.priority !== "standard"}/>
      </div>
    </section>

    <div className="mx-auto max-w-[1600px] p-5 lg:p-8">
      {notice ? <div className="mb-5 flex items-center justify-between rounded-2xl border border-[#d4ad62]/30 bg-[#fff8e8] px-4 py-3 text-sm font-bold text-[#6d5427]"><span>{notice}</span><button type="button" onClick={() => refresh().catch(() => undefined)}><RefreshCw size={14}/></button></div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-6">
          <Panel title="Job control" detail="Internal ownership, branch handoffs and handling instructions." icon={<BriefcaseBusiness size={17}/> }>
            <form onSubmit={saveSetup} className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary branch"><select disabled={!canManageBranches} className="job-input disabled:opacity-60" value={draft.primaryBranch} onChange={(event) => setDraft({ ...draft, primaryBranch: event.target.value as KcplBranch })}>{kcplBranches.map((branch) => <option key={branch}>{branch}</option>)}</select></Field>
              <Field label="Priority"><select className="job-input" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as JobPriority })}>{jobPriorities.map((priority) => <option key={priority} value={priority}>{jobPriorityLabels[priority]}</option>)}</select></Field>
              <Field label="Assigned staff"><input className="job-input" value={draft.assignedToName} onChange={(event) => setDraft({ ...draft, assignedToName: event.target.value })} placeholder="Staff name"/></Field>
              <Field label="Staff email"><input type="email" className="job-input" value={draft.assignedToEmail} onChange={(event) => setDraft({ ...draft, assignedToEmail: event.target.value })}/></Field>
              <Field label="Internal job reference"><input className="job-input" value={draft.internalReference} onChange={(event) => setDraft({ ...draft, internalReference: event.target.value })} placeholder="Optional internal file/ref"/></Field>
              <Field label="Current handling"><div className="job-input bg-[#faf9f5]">{job.current_location || "Location not updated"}</div></Field>
              {canManageBranches ? <div className="sm:col-span-2"><p className="mb-2 text-[9px] font-black uppercase tracking-[.13em] text-black/40">Handling branches</p><div className="flex flex-wrap gap-2">{kcplBranches.map((branch) => <button type="button" key={branch} onClick={() => toggleHandlingBranch(branch)} className={`rounded-full border px-3 py-2 text-[10px] font-black ${draft.handlingBranches.includes(branch) ? "border-[#10263f] bg-[#10263f] text-white" : "border-black/10 bg-[#faf9f5] text-black/45"}`}>{branch}</button>)}</div></div> : <div className="sm:col-span-2 flex flex-wrap gap-2">{job.handling_branches.map((branch) => <span key={branch} className="rounded-full bg-[#f4f1e9] px-3 py-2 text-[10px] font-black">{branch}</span>)}</div>}
              <div className="sm:col-span-2"><Field label="Internal operating notes"><textarea className="job-input min-h-28 resize-y" value={draft.internalNotes} onChange={(event) => setDraft({ ...draft, internalNotes: event.target.value })} placeholder="Private handling instructions, counterpart details, exceptions, branch handoff context…"/></Field></div>
              <div className="sm:col-span-2"><button disabled={busy} className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Saving…" : "Save Job File"}</button></div>
            </form>
          </Panel>

          <Panel title="Operational tasks" detail="Internal work queue for this shipment." icon={<ClipboardCheck size={17}/>} action="Add task" onAction={() => setTaskOpen((value) => !value)}>
            {taskOpen ? <form onSubmit={addTask} className="mb-5 grid gap-3 rounded-2xl bg-[#faf9f5] p-4 sm:grid-cols-2"><Field label="Task"><input required className="job-input" value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })}/></Field><Field label="Branch"><select className="job-input" value={task.branch} onChange={(event) => setTask({ ...task, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></Field><Field label="Due"><input type="datetime-local" className="job-input" value={task.dueAt} onChange={(event) => setTask({ ...task, dueAt: event.target.value })}/></Field><Field label="Assigned to"><input className="job-input" value={task.assignedToName} onChange={(event) => setTask({ ...task, assignedToName: event.target.value })}/></Field><div className="sm:col-span-2"><Field label="Detail"><textarea className="job-input min-h-20" value={task.detail} onChange={(event) => setTask({ ...task, detail: event.target.value })}/></Field></div><div className="sm:col-span-2 flex gap-2"><button disabled={busy} className="rounded-xl bg-[#10263f] px-4 py-2.5 text-xs font-black text-white">Create task</button><button type="button" onClick={() => setTaskOpen(false)} className="rounded-xl border border-black/10 px-4 py-2.5 text-xs font-black">Cancel</button></div></form> : null}
            <div className="space-y-3">{job.tasks.length ? job.tasks.map((item) => <TaskRow key={item.id} item={item} busy={busy} onToggle={() => action({ action: "toggle_task", taskId: item.id, completed: !item.completed })}/>) : <Empty text="No operational tasks yet."/>}</div>
          </Panel>

          <Panel title="Customs & clearance" detail="Track required clearance steps across branches." icon={<ShieldCheck size={17}/>} action="Add step" onAction={() => setCustomsOpen((value) => !value)}>
            {customsOpen ? <form onSubmit={addCustoms} className="mb-5 grid gap-3 rounded-2xl bg-[#faf9f5] p-4 sm:grid-cols-2"><Field label="Step"><input required className="job-input" value={customs.title} onChange={(event) => setCustoms({ ...customs, title: event.target.value })}/></Field><Field label="Branch"><select className="job-input" value={customs.branch} onChange={(event) => setCustoms({ ...customs, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></Field><div className="sm:col-span-2"><Field label="Detail"><textarea className="job-input min-h-20" value={customs.detail} onChange={(event) => setCustoms({ ...customs, detail: event.target.value })}/></Field></div><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={customs.required} onChange={(event) => setCustoms({ ...customs, required: event.target.checked })}/> Required step</label><div className="sm:col-span-2 flex gap-2"><button disabled={busy} className="rounded-xl bg-[#10263f] px-4 py-2.5 text-xs font-black text-white">Add clearance step</button><button type="button" onClick={() => setCustomsOpen(false)} className="rounded-xl border border-black/10 px-4 py-2.5 text-xs font-black">Cancel</button></div></form> : null}
            <div className="space-y-3">{job.customs_steps.length ? job.customs_steps.map((item) => <CustomsRow key={item.id} item={item} busy={busy} onToggle={() => action({ action: "toggle_customs", stepId: item.id, completed: !item.completed })}/>) : <Empty text="No customs checklist yet."/>}</div>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Job identity" detail="The operational spine of this movement." icon={<UsersRound size={17}/> }>
            <Info label="Customer" value={job.customer_name || "Not linked"}/><Info label="Quote" value={job.quote_reference}/><Info label="Mode" value={job.mode || "Not set"}/><Info label="Carrier" value={job.carrier || "Not assigned"}/><Info label="Carrier ref" value={job.carrier_reference || "Not assigned"}/><Info label="Current location" value={job.current_location || "Not updated"}/>{job.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(job.customer_id)}`} className="mt-4 block rounded-xl border border-black/10 px-4 py-3 text-center text-xs font-black">Open Customer 360</Link> : null}
          </Panel>

          <Panel title="Shipment documents" detail="Private Firebase Storage files for this job." icon={<FileText size={17}/> }>
            {!storageAvailable ? <div className="mb-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Firebase Storage is unavailable for this deployment.</div> : null}
            <form onSubmit={uploadDocument} className="space-y-3 rounded-2xl bg-[#faf9f5] p-4"><Field label="Document type"><select name="documentType" defaultValue="other" className="job-input">{shipmentDocumentTypes.map((type) => <option key={type} value={type}>{shipmentDocumentTypeLabels[type]}</option>)}</select></Field><Field label="File"><input required name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" className="job-input"/></Field><button disabled={documentBusy || !storageAvailable} className="flex items-center gap-2 rounded-xl bg-[#b78a3e] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Upload size={13}/>{documentBusy ? "Uploading…" : "Upload document"}</button></form>
            <div className="mt-4 space-y-2">{documentsLoading ? <p className="text-xs text-black/40">Loading documents…</p> : documents.length ? documents.map((document) => <div key={document.id} className="rounded-xl border border-black/10 p-3"><p className="truncate text-xs font-black">{document.filename}</p><p className="mt-1 text-[9px] text-black/40">{shipmentDocumentTypeLabels[document.document_type]} · {bytes(document.size_bytes)}</p><div className="mt-2 flex gap-2"><a href={`/api/admin/shipments/${encodeURIComponent(job.reference)}/documents/${document.id}`} className="flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-[9px] font-black"><Download size={10}/>Download</a><button type="button" disabled={documentBusy} onClick={() => deleteDocument(document)} className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[9px] font-black text-rose-700"><Trash2 size={10}/>Delete</button></div></div>) : <Empty text="No shipment documents yet."/>}</div>
          </Panel>

          {job.can_view_costs ? <Panel title="Job costs" detail="Internal only. Hidden from Operations users." icon={<WalletCards size={17}/>} action="Add cost" onAction={() => setCostOpen((value) => !value)}>
            {Object.keys(job.cost_totals).length ? <div className="mb-4 grid grid-cols-2 gap-2">{Object.entries(job.cost_totals).map(([currency, total]) => <div key={currency} className="rounded-xl bg-[#10263f] p-3 text-white"><p className="text-[8px] font-black uppercase tracking-[.1em] text-white/40">{currency} costs</p><p className="mt-1 text-sm font-black text-[#e0bd79]">{money(total ?? 0, currency)}</p></div>)}</div> : null}
            {costOpen ? <form onSubmit={addCost} className="mb-4 space-y-3 rounded-2xl bg-[#faf9f5] p-4"><Field label="Category"><select className="job-input" value={cost.category} onChange={(event) => setCost({ ...cost, category: event.target.value as JobCostCategory })}>{jobCostCategories.map((category) => <option key={category} value={category}>{jobCostCategoryLabels[category]}</option>)}</select></Field><Field label="Description"><input required className="job-input" value={cost.label} onChange={(event) => setCost({ ...cost, label: event.target.value })}/></Field><Field label="Vendor"><input className="job-input" value={cost.vendor} onChange={(event) => setCost({ ...cost, vendor: event.target.value })}/></Field><div className="grid grid-cols-[1fr_.7fr] gap-2"><Field label="Amount"><input required type="number" min="0" step="0.01" className="job-input" value={cost.amount} onChange={(event) => setCost({ ...cost, amount: event.target.value })}/></Field><Field label="Currency"><select className="job-input" value={cost.currency} onChange={(event) => setCost({ ...cost, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field></div><Field label="Notes"><textarea className="job-input min-h-16" value={cost.notes} onChange={(event) => setCost({ ...cost, notes: event.target.value })}/></Field><button disabled={busy} className="rounded-xl bg-[#10263f] px-4 py-2.5 text-xs font-black text-white">Save cost</button></form> : null}
            <div className="space-y-2">{job.costs.length ? job.costs.map((item) => <div key={item.id} className="rounded-xl border border-black/10 p-3"><div className="flex justify-between gap-3"><div><p className="text-xs font-black">{item.label}</p><p className="mt-1 text-[9px] text-black/40">{jobCostCategoryLabels[item.category]}{item.vendor ? ` · ${item.vendor}` : ""}</p></div><strong className="text-xs">{money(item.amount, item.currency)}</strong></div></div>) : <Empty text="No internal costs recorded."/>}</div>
          </Panel> : <section className="rounded-[26px] border border-black/10 bg-[#10263f] p-6 text-white"><div className="flex items-center gap-3"><Landmark size={18} className="text-[#d4ad62]"/><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#d4ad62]">Commercial controls</p><h3 className="mt-1 text-sm font-black">Job costs restricted</h3></div></div><p className="mt-3 text-xs leading-5 text-white/50">Your role can operate this shipment, but cost data is withheld from the browser.</p></section>}
        </aside>
      </div>
    </div>
    <style jsx global>{`.job-input{width:100%;border:1px solid rgba(0,0,0,.1);border-radius:12px;background:#faf9f5;padding:10px 12px;font-size:13px;outline:none;color:#10263f}.job-input:focus{border-color:#b78a3e}`}</style>
  </main>;
}

function Panel({ title, detail, icon, children, action, onAction }: { title: string; detail: string; icon: React.ReactNode; children: React.ReactNode; action?: string; onAction?: () => void }) {
  return <section className="rounded-[26px] border border-black/10 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="rounded-xl bg-[#10263f]/7 p-2.5 text-[#10263f]">{icon}</span><div><h2 className="text-base font-black">{title}</h2><p className="mt-1 text-xs leading-5 text-black/45">{detail}</p></div></div>{action && onAction ? <button type="button" onClick={onAction} className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-[#faf9f5] px-3 py-2 text-[10px] font-black"><Plus size={12}/>{action}</button> : null}</div><div className="mt-5">{children}</div></section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.12em] text-black/40">{label}</span>{children}</label>; }
function Metric({ label, value, icon, accent = false }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) { return <div className={`rounded-2xl border p-4 ${accent ? "border-[#d4ad62]/40 bg-[#d4ad62]/10" : "border-white/10 bg-white/[.035]"}`}><div className="flex items-center gap-2 text-white/40">{icon}<span className="text-[8px] font-black uppercase tracking-[.12em]">{label}</span></div><p className={`mt-2 truncate text-sm font-black ${accent ? "text-[#e0bd79]" : "text-white"}`}>{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-black/10 py-3 text-xs"><span className="text-black/40">{label}</span><strong className="max-w-[65%] text-right">{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-black/15 bg-[#faf9f5] p-4 text-xs text-black/40">{text}</div>; }
function TaskRow({ item, busy, onToggle }: { item: JobTask; busy: boolean; onToggle: () => void }) { return <div className={`rounded-2xl border p-4 ${item.completed ? "border-black/5 bg-black/[.025] opacity-60" : "border-black/10"}`}><div className="flex items-start gap-3"><button type="button" disabled={busy} onClick={onToggle} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${item.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/20"}`}>{item.completed ? <Check size={12}/> : null}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><strong className={item.completed ? "text-sm line-through" : "text-sm"}>{item.title}</strong><span className="rounded-full bg-[#f4f1e9] px-2 py-1 text-[8px] font-black">{item.branch}</span></div>{item.detail ? <p className="mt-1 text-xs leading-5 text-black/50">{item.detail}</p> : null}<p className="mt-2 text-[9px] font-bold text-black/35">{item.assigned_to_name || "Unassigned"} · {item.due_at ? `Due ${dateLabel(item.due_at)}` : "No due date"}</p></div></div></div>; }
function CustomsRow({ item, busy, onToggle }: { item: CustomsStep; busy: boolean; onToggle: () => void }) { return <div className={`rounded-2xl border p-4 ${item.completed ? "border-emerald-200 bg-emerald-50/40" : "border-black/10"}`}><div className="flex items-start gap-3"><button type="button" disabled={busy} onClick={onToggle} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${item.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/20"}`}>{item.completed ? <Check size={12}/> : null}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{item.title}</strong><div className="flex gap-1"><span className="rounded-full bg-[#f4f1e9] px-2 py-1 text-[8px] font-black">{item.branch}</span>{item.required ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-black text-amber-700">Required</span> : null}</div></div>{item.detail ? <p className="mt-1 text-xs leading-5 text-black/50">{item.detail}</p> : null}</div></div></div>; }
