"use client";

import Link from "next/link";
import { freightModeLabel } from "../../freight-mode";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, ListTodo, ShieldCheck,
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
import { staffCapabilitiesForRole, type KcplStaffRole } from "../../staff-permissions";
import { workflowBlockerFix, type ShipmentWorkflowReadiness } from "../../workflow-guard";
import { openJobPanel } from "./job-record";
import { StaffAssignmentPicker } from "../../staff-assignment-picker";
import { shipmentDocumentTypeLabels, shipmentDocumentTypes, type ShipmentDocument } from "../../../shipment-document-types";
import { OpsBadge, OpsButton, OpsEmptyState, OpsFact, OpsFacts, OpsField, OpsFileDrop, OpsInspectorNote, OpsMono, OpsNotice, OpsPage, OpsProgress, OpsSkeleton, OpsSurface } from "../../operations-ui";
import { FreeTimeControl, type FreeTimePanelData } from "./free-time-control";
import { ContainerControl } from "./container-control";
import { DepositControl } from "./deposit-control";
import { DocumentReadingsControl } from "./document-readings-control";
import { PartnerAccessControl } from "./partner-access-control";
import type { PartnerShipmentAccess } from "../../../partner/partner-access-policy";
import type { StoredReading } from "../../document-reading.server";
import type { ShipmentContainer } from "../../../shipment-containers";
import type { ContainerDeposit } from "../../../container-deposits";
import { ShipmentThread } from "../../../shipment-thread";
import { canDeleteShipmentDocument, canReviewShipmentDocuments, canVerifyOwnShipmentDocument } from "../../../shipment-document-policy";

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
  containers,
  deposits,
  today,
  readings,
  readingConfigured,
  shipmentPartners,
  partnerOptions,
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
  /** Null where the containers couldn't be read; air shipments don't show the panel. */
  containers: ShipmentContainer[] | null;
  /** Deposits paid to the line for this shipment's containers; null where they couldn't be read. */
  deposits: ContainerDeposit[] | null;
  today: string;
  readings: StoredReading[];
  readingConfigured: boolean;
  shipmentPartners: PartnerShipmentAccess[] | null;
  partnerOptions: Array<{ id: string; name: string }>;
  canManageJobFile: boolean;
}) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [workflow, setWorkflow] = useState(initialReadiness);
  // A step elsewhere on the page (status, customs release, delivery) refreshes
  // the server props; take them when they change instead of keeping stale copies.
  const [seen, setSeen] = useState({ initialJob, initialReadiness });
  if (seen.initialJob !== initialJob || seen.initialReadiness !== initialReadiness) {
    setSeen({ initialJob, initialReadiness });
    setJob(initialJob);
    setWorkflow(initialReadiness);
  }
  const [closeReason, setCloseReason] = useState("");
  // The audited reason box appears only when Management chooses to override
  // or reopen; it used to sit open on every job that was not ready to close.
  const [reasonOpen, setReasonOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  // A failed document load belongs to the Documents step, not every step.
  const [documentsError, setDocumentsError] = useState("");
  const [documentBusy, setDocumentBusy] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [taskOpen, setTaskOpen] = useState(false);
  const [customsOpen, setCustomsOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  // Accounts enter the supplier bill for a hand-typed cost; the bill then replaces it.
  const canBillCosts = staffCapabilitiesForRole(role).canManageFinance;
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
  // (e.g. "2 tasks are still open" twice); show each advisory only when it says
  // something the blocker checklist does not. Task-count advisories match on
  // the count itself so wording differences cannot resurrect the duplicate.
  const taskCountPhrase = (text: string) => text.match(/(\d+)\s+(?:operational )?tasks?\b/i)?.[1] ?? null;
  const closeoutWarnings = useMemo(() => workflow.warnings.filter((warning) => {
    if (workflow.close_blockers.some((blocker) => blocker.includes(warning))) return false;
    // The invoice is said once, as the thing to do before closing.
    if (/invoice/i.test(warning) && workflow.close_blockers.some((blocker) => /invoice/i.test(blocker))) return false;
    const warnTasks = taskCountPhrase(warning);
    return !(warnTasks && workflow.close_blockers.some((blocker) => taskCountPhrase(blocker) === warnTasks));
  }), [workflow.warnings, workflow.close_blockers]);

  async function refresh() {
    const response = await fetch(`/api/admin/jobs/${encodeURIComponent(job.reference)}`, { cache: "no-store" });
    const data = await response.json() as { job?: DigitalJobFile; workflow?: ShipmentWorkflowReadiness; error?: string };
    if (!response.ok || !data.job) throw new Error(data.error || "The page couldn’t update. Reload to see the latest.");
    setJob(data.job);
    if (data.workflow) setWorkflow(data.workflow);
    // The step list above is server-rendered; bring it up to date too.
    router.refresh();
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
        if (!response.ok || !data.documents) throw new Error(data.error || "Documents didn’t load. Reload the page to try again.");
        setDocuments(data.documents);
        setStorageAvailable(data.storageAvailable !== false);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDocumentsError(error instanceof Error ? error.message : "Documents didn’t load. Reload the page to try again.");
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
      setNotice("Saved.");
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
      setNotice("Task added.");
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
      setNotice("Cost added.");
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
      setReasonOpen(false);
      setNotice(data.overrideUsed ? "Job closed. Your reason was saved to the history." : "Job closed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Job File could not be closed.");
    } finally { setBusy(false); }
  }

  async function reopenJob() {
    const reason = closeReason.trim();
    if (reason.length < 8) {
      setNotice("Give a reason of at least 8 characters.");
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
      setReasonOpen(false);
      setNotice("Job reopened.");
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
      setNotice(`${data.document.filename} uploaded. Someone needs to check it before it counts.`);
      await refresh().catch(() => undefined);
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
      await refresh().catch(() => undefined);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete the document."); }
    finally { setDocumentBusy(false); }
  }

  // Check or reject in place; the Documents page stays for bulk review.
  async function reviewDocument(document: ShipmentDocument, status: "verified" | "rejected", reviewNote: string) {
    setDocumentBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(job.reference)}/documents/${document.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, reviewNote, expiresOn: document.expires_on ?? "", customerSafe: document.customer_safe === true }),
      });
      const data = await response.json().catch(() => ({})) as { document?: ShipmentDocument; error?: string };
      if (!response.ok || !data.document) throw new Error(data.error || "The check couldn’t be saved. Try again.");
      setDocuments((current) => current.map((item) => item.id === document.id ? data.document! : item));
      setNotice(status === "verified" ? `${document.filename} checked.` : `${document.filename} rejected. The reason is on the document.`);
      await refresh().catch(() => undefined);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The check couldn’t be saved. Try again.");
      return false;
    } finally { setDocumentBusy(false); }
  }

  const setupToggle = <OpsButton variant="secondary" size="xs" onClick={() => setSetupOpen((current) => !current)} aria-expanded={setupOpen}><BriefcaseBusiness size={13} strokeWidth={1.75} aria-hidden="true"/>{setupOpen ? "Close" : "Edit owner & notes"}</OpsButton>;

  // Each surface belongs to one step (data-panel); the record shows only the
  // open step's surfaces, so the page reads one job stage at a time.
  return (
    <OpsPage className="job-workspace">
      {notice ? <OpsNotice tone={noticeTone(notice)} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}

      {setupOpen ? <div data-panel="booking"><OpsSurface title="Owner & notes" action={<OpsButton variant="ghost" size="xs" onClick={() => setSetupOpen(false)}>Close</OpsButton>}>
        <form onSubmit={saveSetup} className="job-form job-form-grid">
          <OpsField label="Main branch"><select disabled={!canManageBranches} value={draft.primaryBranch} onChange={(event) => setDraft({ ...draft, primaryBranch: event.target.value as KcplBranch })}>{kcplBranches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
          <OpsField label="Priority"><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as JobPriority })}>{jobPriorities.map((priority) => <option key={priority} value={priority}>{jobPriorityLabels[priority]}</option>)}</select></OpsField>
          <OpsField label="Our file number"><input value={draft.internalReference} onChange={(event) => setDraft({ ...draft, internalReference: event.target.value })} placeholder="Optional"/></OpsField>
          <OpsField label="Owner" hint="The person responsible for this shipment." className="job-form-span-2"><StaffAssignmentPicker branch={draft.primaryBranch} value={{ uid: draft.assignedToUid, name: draft.assignedToName, email: draft.assignedToEmail, phone: draft.assignedToPhone }} onChange={(staff) => setDraft((current) => ({ ...current, assignedToUid: staff.uid ?? "", assignedToName: staff.name, assignedToEmail: staff.email, assignedToPhone: staff.phone }))}/></OpsField>
          <div className="job-form-span-all" role="group" aria-label="Branches working on this shipment">
            <span className="ops-filter-menu-label">Branches working on it</span>
            <div className="ops-filter-choices mt-1.5">{kcplBranches.map((branch) => <button type="button" key={branch} disabled={!canManageBranches} onClick={() => toggleHandlingBranch(branch)} className="ops-filter-choice" data-active={draft.handlingBranches.includes(branch) || undefined} aria-pressed={draft.handlingBranches.includes(branch)}>{branch}</button>)}</div>
          </div>
          <OpsField label="Staff notes" className="job-form-span-all"><textarea value={draft.internalNotes} onChange={(event) => setDraft({ ...draft, internalNotes: event.target.value })} placeholder="Handover notes, agent contacts, special handling…"/></OpsField>
          <div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Saving…" : "Save"}</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setSetupOpen(false)}>Cancel</OpsButton></div>
        </form>
      </OpsSurface></div> : null}

      <div className="ops-stack job-workspace-main">
        <div data-panel="booking">
          <OpsSurface id="shipment-movement" title={job.customer_name || "No customer linked"} description={`${job.origin || "Origin"} → ${job.destination || "Destination"}`} action={setupToggle}>
            {!job.customer_id ? <OpsInspectorNote tone="warning" title="Link a customer first">The shipment can’t move on until it belongs to a customer. Link one on the enquiry.<div className="mt-2"><Link href={`/admin/enquiries?enquiry=${encodeURIComponent(job.quote_reference)}`} className="ops-button" data-variant="primary" data-size="xs">Open the enquiry</Link></div></OpsInspectorNote> : null}
            <OpsFacts columns={2}>
              <OpsFact label="Customer">{job.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(job.customer_id)}`}>{job.customer_name || job.customer_id}</Link> : "Not linked"}</OpsFact>
              <OpsFact label="Quote"><OpsMono>{job.quote_reference}</OpsMono></OpsFact>
              <OpsFact label="Mode">{job.mode ? freightModeLabel(job.mode) : "Not set"}</OpsFact>
              <OpsFact label="Carrier" warning={!job.carrier}>{job.carrier || "Not chosen"}{job.carrier_reference ? <> · <OpsMono>{job.carrier_reference}</OpsMono></> : null}</OpsFact>
              <OpsFact label="Owner" warning={!job.assigned_to_uid && !job.assigned_to_name && !job.assigned_to_email}>{job.assigned_to_uid ? <Link href={`/admin/workload/${encodeURIComponent(job.assigned_to_uid)}`}>{job.assigned_to_name || job.assigned_to_email || "Assigned"}</Link> : job.assigned_to_name || job.assigned_to_email || "Nobody yet"}</OpsFact>
              <OpsFact label="Owner contact">{job.assigned_to_phone ? <a href={`tel:${job.assigned_to_phone}`}>{job.assigned_to_phone}</a> : job.assigned_to_email ? <a href={`mailto:${job.assigned_to_email}`}>{job.assigned_to_email}</a> : "Not set"}</OpsFact>
              <OpsFact label="Main branch"><Link href={`/admin/branches/${encodeURIComponent(job.primary_branch)}`}>{job.primary_branch}</Link></OpsFact>
              <OpsFact label="Priority">{jobPriorityLabels[job.priority]}</OpsFact>
            </OpsFacts>
            {job.internal_notes ? <div id="shipment-context" className="mt-3"><p className="ops-filter-menu-label">Staff notes</p><p className="job-note">{job.internal_notes}</p></div> : null}
          </OpsSurface>
        </div>

        <div data-panel="customs">
          <OpsSurface id="shipment-customs" title="Customs checklist" description={requiredCustoms.length ? `${completedCustoms} of ${requiredCustoms.length} required steps done.` : undefined} action={<OpsButton variant="secondary" size="xs" onClick={() => setCustomsOpen((value) => !value)} aria-expanded={customsOpen}><Plus size={13} strokeWidth={1.75} aria-hidden="true"/>{customsOpen ? "Close" : "Add step"}</OpsButton>}>
            {requiredCustoms.length ? <div className="job-progress"><OpsProgress value={completedCustoms} max={Math.max(requiredCustoms.length, 1)} tone={completedCustoms === requiredCustoms.length ? "success" : "warning"} label="Customs checklist progress"/></div> : null}
            {customsOpen ? <form onSubmit={addCustoms} className="job-form job-form-grid job-form-grid-2">
              <OpsField label="Step"><input required value={customs.title} onChange={(event) => setCustoms({ ...customs, title: event.target.value })}/></OpsField>
              <OpsField label="Branch"><select value={customs.branch} onChange={(event) => setCustoms({ ...customs, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
              <OpsField label="Detail" className="job-form-span-all"><textarea value={customs.detail} onChange={(event) => setCustoms({ ...customs, detail: event.target.value })}/></OpsField>
              <label className="job-form-check job-form-span-all"><input type="checkbox" checked={customs.required} onChange={(event) => setCustoms({ ...customs, required: event.target.checked })}/> Must be done before release</label>
              <div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Add step</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setCustomsOpen(false)}>Cancel</OpsButton></div>
            </form> : null}
            {job.customs_steps.length ? <ul className="job-rows">{job.customs_steps.map((item) => <CustomsRow key={item.id} item={item} busy={busy} onToggle={() => action({ action: "toggle_customs", stepId: item.id, completed: !item.completed })}/>)}</ul> : <OpsEmptyState icon={<ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true"/>} compact title="No customs steps yet" description="Add the steps customs needs for this shipment."/>}
          </OpsSurface>
        </div>

        <div data-panel="documents">
          <OpsSurface id="shipment-documents" title="Documents" action={<Link href={`/admin/documents?q=${encodeURIComponent(job.reference)}`} className="ops-button" data-variant="ghost" data-size="xs">All documents</Link>}>
            {workflow.documents.some((item) => item.required && !item.present && item.document_type !== "proof_of_delivery") ? <ul className="job-checklist" aria-label="Documents still needed">{workflow.documents.filter((item) => item.required && !item.present && item.document_type !== "proof_of_delivery").map((item) => <li key={item.document_type}><AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true"/><span>{item.label}{item.uploaded_count > 0 ? " — uploaded, needs checking" : " — not uploaded"}</span></li>)}</ul> : null}
            {documentsError ? <div className="mb-3"><OpsNotice tone="warning">{documentsError}</OpsNotice></div> : null}
            {!storageAvailable ? <div className="mb-3"><OpsNotice tone="warning">File uploads aren’t working right now. Try again later.</OpsNotice></div> : null}
            <form onSubmit={uploadDocument} className="job-form job-upload">
              <OpsField label="Type"><select name="documentType" defaultValue={workflow.documents.find((item) => item.required && !item.present && item.uploaded_count === 0 && item.document_type !== "proof_of_delivery")?.document_type ?? "other"}>{shipmentDocumentTypes.map((type) => <option key={type} value={type}>{shipmentDocumentTypeLabels[type]}</option>)}</select></OpsField>
              <OpsFileDrop name="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" prompt="Choose a file" hint="PDF, image, Word, Excel, CSV or TXT"/>
              <OpsButton type="submit" variant="secondary" size="sm" disabled={documentBusy || !storageAvailable}><Upload size={14} strokeWidth={1.75} aria-hidden="true"/>{documentBusy ? "Uploading…" : "Upload"}</OpsButton>
            </form>
            {documentsLoading ? <OpsSkeleton lines={2} label="Loading documents" className="mt-3"/> : documents.length ? <ul className="job-rows mt-2">{documents.map((document) => <DocumentRow key={document.id} document={document} jobReference={job.reference} documentBusy={documentBusy} role={role} currentUserEmail={currentUserEmail} onDelete={() => deleteDocument(document)} onReview={(status, note) => reviewDocument(document, status, note)}/>)}</ul> : <OpsEmptyState icon={<FileText size={16} strokeWidth={1.75} aria-hidden="true"/>} compact title="No documents yet" description="Upload the AWB or BL, invoice, packing list and customs papers here."/>}
            {!documentsLoading ? <DocumentReadingsControl reference={job.reference} documents={documents} readings={readings} configured={readingConfigured} canEdit={canManageJobFile}/> : null}
          </OpsSurface>
        </div>

        <div data-panel="booking"><PartnerAccessControl reference={job.reference} partners={shipmentPartners} options={partnerOptions} canEdit={canManageJobFile}/></div>
        <div data-panel="transit" id="shipment-free-time"><FreeTimeControl reference={job.reference} initial={freeTime} canEdit={canManageJobFile}/></div>
        {job.mode !== "air" ? <div data-panel="transit"><ContainerControl reference={job.reference} initial={containers} canEdit={canManageJobFile} today={today}/></div> : null}
        {job.mode !== "air" ? <div data-panel="transit"><DepositControl reference={job.reference} deposits={deposits} containers={containers ?? []} canEdit={canManageJobFile} canFinance={canBillCosts} isManagement={role === "management"} today={today} defaultLine={job.carrier}/></div> : null}

        <div data-panel="tasks">
          <OpsSurface id="shipment-tasks" title="Tasks" description={overdueTasks.length ? <span className="job-overdue">{overdueTasks.length} overdue</span> : undefined} action={<OpsButton variant="secondary" size="xs" onClick={() => setTaskOpen((value) => !value)} aria-expanded={taskOpen}><Plus size={13} strokeWidth={1.75} aria-hidden="true"/>{taskOpen ? "Close" : "Add task"}</OpsButton>}>
            {taskOpen ? <form onSubmit={addTask} className="job-form job-form-grid job-form-grid-2">
              <OpsField label="Task"><input required value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })}/></OpsField>
              <OpsField label="Branch"><select value={task.branch} onChange={(event) => setTask({ ...task, branch: event.target.value as KcplBranch })}>{job.handling_branches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
              <OpsField label="Due"><input type="datetime-local" value={task.dueAt} onChange={(event) => setTask({ ...task, dueAt: event.target.value })}/></OpsField>
              <OpsField label="For" className="job-form-span-all"><StaffAssignmentPicker branch={task.branch} value={{ uid: task.assignedToUid, name: task.assignedToName, email: task.assignedToEmail, phone: task.assignedToPhone }} onChange={(staff) => setTask((current) => ({ ...current, assignedToUid: staff.uid ?? "", assignedToName: staff.name, assignedToEmail: staff.email, assignedToPhone: staff.phone }))}/></OpsField>
              <OpsField label="Detail" className="job-form-span-all"><textarea value={task.detail} onChange={(event) => setTask({ ...task, detail: event.target.value })}/></OpsField>
              <div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Add task</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setTaskOpen(false)}>Cancel</OpsButton></div>
            </form> : null}
            {job.tasks.length ? <ul className="job-rows">{job.tasks.map((item) => <TaskRow key={item.id} item={item} busy={busy} nowMs={nowMs} onToggle={() => action({ action: "toggle_task", taskId: item.id, completed: !item.completed })}/>)}</ul> : <OpsEmptyState icon={<ListTodo size={16} strokeWidth={1.75} aria-hidden="true"/>} compact title="No tasks" description="Add one when something needs an owner or a due time."/>}
          </OpsSurface>
        </div>

        {canManageJobFile ? <div data-panel="messages" id="shipment-messages">
          <ShipmentThread
            endpoint={`/api/admin/jobs/${encodeURIComponent(job.reference)}/messages`}
            viewer="kcpl"
            labels={{
              title: "Messages with the customer",
              placeholder: "Reply to the customer",
              send: "Send",
              sending: "Sending…",
              failed: "The message wasn’t sent. Try again.",
              loadFailed: "Messages didn’t load. Reload the page to try again.",
            }}
          />
        </div> : null}

        {job.can_view_costs ? <div data-panel="costs">
          <OpsSurface id="shipment-commercial" title="Costs" action={<OpsButton variant="secondary" size="xs" onClick={() => setCostOpen((value) => !value)} aria-expanded={costOpen}><Plus size={13} strokeWidth={1.75} aria-hidden="true"/>{costOpen ? "Close" : "Add cost"}</OpsButton>}>
            {costOpen ? <form onSubmit={addCost} className="job-form job-form-grid job-form-grid-2 mt-3"><OpsField label="Category"><select value={cost.category} onChange={(event) => setCost({ ...cost, category: event.target.value as JobCostCategory })}>{jobCostCategories.map((category) => <option key={category} value={category}>{jobCostCategoryLabels[category]}</option>)}</select></OpsField><OpsField label="Description"><input required value={cost.label} onChange={(event) => setCost({ ...cost, label: event.target.value })}/></OpsField><OpsField label="Supplier"><input value={cost.vendor} onChange={(event) => setCost({ ...cost, vendor: event.target.value })}/></OpsField><div className="job-form-money"><OpsField label="Amount before VAT"><input required type="number" min="0" step="0.01" value={cost.amount} onChange={(event) => setCost({ ...cost, amount: event.target.value })}/></OpsField><OpsField label="Currency"><select value={cost.currency} onChange={(event) => setCost({ ...cost, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></OpsField></div><OpsField label="Notes" className="job-form-span-all"><textarea value={cost.notes} onChange={(event) => setCost({ ...cost, notes: event.target.value })}/></OpsField><div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Save cost</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setCostOpen(false)}>Cancel</OpsButton></div></form> : null}
            {job.costs.length ? <ul className="job-rows mt-2">{job.costs.map((item) => <li key={item.id} className="job-row" data-done={item.superseded_by_payable ? true : undefined}><div className="job-row-main"><span className="job-row-title">{item.label}</span><span className="job-row-meta">{jobCostCategoryLabels[item.category]}{item.vendor ? ` · ${item.vendor}` : ""}{item.source_reference ? ` · ${item.source_reference}` : ""}{item.superseded_by_payable ? <> · Replaced by supplier bill <Link href={`/admin/payables/bills/${encodeURIComponent(item.superseded_by_payable)}`}>{item.superseded_by_payable}</Link>, not counted</> : null}{canBillCosts && item.source_type === "manual" && !item.locked && !item.superseded_by_payable ? <Link href={`/admin/payables?shipment=${encodeURIComponent(job.reference)}&replaces=${encodeURIComponent(item.id)}`}>Enter its supplier bill</Link> : null}</span></div><strong className="job-row-amount">{money(item.amount, item.currency)}</strong></li>)}</ul> : <OpsEmptyState icon={<Receipt size={16} strokeWidth={1.75} aria-hidden="true"/>} compact title="No costs yet" description="Add freight, customs, transport and handling costs here."/>}
          </OpsSurface>
        </div> : null}

        <div data-panel="close">
          <OpsSurface id="shipment-closeout" title="Close the job" description="Closing locks the shipment. It stays available to accounts, audit and the customer." action={workflow.job_closed
            ? (canOverride && !reasonOpen ? <OpsButton variant="secondary" size="xs" disabled={busy} onClick={() => setReasonOpen(true)}><RotateCcw size={13} strokeWidth={1.75} aria-hidden="true"/>Reopen…</OpsButton> : null)
            : workflow.can_close
              ? <OpsButton variant="primary" size="xs" disabled={busy} onClick={() => closeJob("")}><PackageCheck size={13} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Closing…" : "Close job"}</OpsButton>
              : null}>
            {workflow.job_closed ? <OpsInspectorNote tone="success" icon={<LockKeyhole size={14} strokeWidth={1.75} aria-hidden="true"/>} title={`Closed${workflow.job_closed_at ? ` ${dateTime(workflow.job_closed_at)}` : ""}${workflow.job_closed_by_name ? ` by ${workflow.job_closed_by_name}` : ""}`}>Everything stays on record.{canOverride ? " Management can reopen it with a reason." : " Only Management can reopen it."}</OpsInspectorNote>
              : workflow.close_blockers.length ? <>
                <p className="ops-inspector-hint">Still to do before closing:</p>
                <ul className="job-checklist" aria-label="Still to do before closing">{workflow.close_blockers.map((blocker) => {
                  const fix = workflowBlockerFix(blocker);
                  return <li key={blocker}><AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true"/><span>{blocker}</span>{fix ? <button type="button" className="workflow-blockers-fix" onClick={() => openJobPanel(fix.step)}>{fix.label}</button> : null}</li>;
                })}</ul>
                {canOverride ? (reasonOpen ? <div className="job-closeout-override"><OpsField label="Reason for closing anyway" hint="Saved to the shipment history. At least 8 characters."><textarea autoComplete="off" value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="Why must this close before the list above is done?"/></OpsField><div className="job-form-actions"><OpsButton variant="primary" size="sm" disabled={busy || closeReason.trim().length < 8} onClick={() => closeJob(closeReason)}>{busy ? "Closing…" : "Close anyway"}</OpsButton><OpsButton variant="ghost" size="sm" disabled={busy} onClick={() => { setReasonOpen(false); setCloseReason(""); }}>Cancel</OpsButton></div></div> : <button type="button" className="workflow-blockers-link mt-2" disabled={busy} onClick={() => setReasonOpen(true)}>Close anyway (management)…</button>) : null}
              </>
                : <OpsInspectorNote tone="success" icon={<PackageCheck size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Ready to close">Everything is done.</OpsInspectorNote>}
            {workflow.job_closed && canOverride && reasonOpen ? <div className="job-closeout-override"><OpsField label="Reason for reopening" hint="Saved to the shipment history. At least 8 characters."><textarea autoComplete="off" value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="Why does this job need reopening?"/></OpsField><div className="job-form-actions"><OpsButton variant="primary" size="sm" disabled={busy || closeReason.trim().length < 8} onClick={reopenJob}>{busy ? "Reopening…" : "Reopen job"}</OpsButton><OpsButton variant="ghost" size="sm" disabled={busy} onClick={() => { setReasonOpen(false); setCloseReason(""); }}>Cancel</OpsButton></div></div> : null}
            {!workflow.job_closed && closeoutWarnings.length ? <ul className="job-advisories">{closeoutWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          </OpsSurface>
        </div>
      </div>
    </OpsPage>
  );
}

function noticeTone(notice: string): "danger" | "warning" | "success" {
  const text = notice.toLowerCase();
  if (text.includes("could not") || text.includes("couldn’t") || text.includes("failed") || text.includes("try again")) return "danger";
  if (text.includes("unavailable") || text.includes("aren’t working")) return "warning";
  return "success";
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

function DocumentRow({ document, jobReference, documentBusy, role, currentUserEmail, onDelete, onReview }: { document: ShipmentDocument; jobReference: string; documentBusy: boolean; role: KcplStaffRole; currentUserEmail: string; onDelete: () => void; onReview: (status: "verified" | "rejected", note: string) => Promise<boolean> }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const status = document.review_status ?? "received";
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const expired = status === "verified" && Boolean(document.expires_on && document.expires_on < today);
  const controlLabel = expired ? "Expired" : status === "verified" ? "Checked" : status === "rejected" ? "Rejected" : "Needs checking";
  const controlTone: "neutral" | "warning" | "success" | "danger" = expired || status === "rejected" ? "danger" : status === "verified" ? "success" : "warning";
  const canDelete = canDeleteShipmentDocument({ role, actorEmail: currentUserEmail, uploadedByEmail: document.uploaded_by_email, status });
  const reviewable = canReviewShipmentDocuments(role) && (status === "received" || status === "under_review");
  // Someone other than the uploader checks a file, unless they are Management.
  const canCheck = reviewable && canVerifyOwnShipmentDocument({ role, actorEmail: currentUserEmail, uploadedByEmail: document.uploaded_by_email });
  return <li className="job-row">
    <FileText size={15} strokeWidth={1.75} className="job-row-icon" aria-hidden="true"/>
    <div className="job-row-main">
      <div className="job-row-head"><span className="job-row-title" title={document.filename}>{document.filename}</span><OpsBadge tone={controlTone}>{controlLabel}</OpsBadge></div>
      <div className="job-row-meta"><span>{shipmentDocumentTypeLabels[document.document_type]}</span>{document.uploaded_by_source === "partner" ? <span>From {document.uploaded_by} (partner)</span> : document.uploaded_by_source === "customer_portal" ? <span>From the customer</span> : null}<span>{bytes(document.size_bytes)}</span><span>{dateTime(document.uploaded_at)}</span>{document.expires_on ? <span>Expires {dateLabel(document.expires_on)}</span> : null}{reviewable && !canCheck ? <span>Someone else needs to check your upload</span> : null}</div>
      {rejecting ? <div className="job-row-reject">
        <OpsField label="Why is it rejected?"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Wrong consignee name"/></OpsField>
        <div className="job-form-actions"><OpsButton variant="danger" size="xs" disabled={documentBusy || reason.trim().length < 4} onClick={async () => { if (await onReview("rejected", reason.trim())) { setRejecting(false); setReason(""); } }}>Reject</OpsButton><OpsButton variant="ghost" size="xs" onClick={() => { setRejecting(false); setReason(""); }}>Cancel</OpsButton></div>
      </div> : null}
    </div>
    <div className="job-row-actions">
      {canCheck && !rejecting ? <><OpsButton variant="primary" size="xs" disabled={documentBusy} onClick={() => void onReview("verified", "")}><Check size={13} strokeWidth={1.75} aria-hidden="true"/>Mark checked</OpsButton><OpsButton variant="ghost" size="xs" disabled={documentBusy} onClick={() => setRejecting(true)}>Reject…</OpsButton></> : null}
      <a href={`/api/admin/shipments/${encodeURIComponent(jobReference)}/documents/${document.id}`} className="ops-button" data-variant="ghost" data-size="xs" aria-label={`Download ${document.filename}`}><Download size={13} strokeWidth={1.75} aria-hidden="true"/>Download</a>
      {canDelete ? <button type="button" disabled={documentBusy} onClick={onDelete} className="ops-button" data-variant="ghost" data-size="xs" aria-label={`Delete ${document.filename}`}><Trash2 size={13} strokeWidth={1.75} aria-hidden="true"/></button> : null}
    </div>
  </li>;
}
