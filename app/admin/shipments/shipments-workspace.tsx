"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Columns3,
  MapPin,
  PackageCheck,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import type { CommandCentreData, CommandCentreJob } from "../command-centre/command-centre-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
import { ShipmentOperationsFlow } from "./shipment-operations-flow";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

function dateOnly(value: string | null) {
  if (!value) return "Not set";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" }).format(date);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: NEPAL_TIME_ZONE }).format(date);
}

function dateTime(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: NEPAL_TIME_ZONE }).format(date)} NPT`;
}

function customsBlocking(job: CommandCentreJob, operationalDate: string) {
  if (job.required_customs_open <= 0) return false;
  const etaDate = job.eta?.slice(0, 10) ?? "";
  return job.status === "customs_clearance" || Boolean(etaDate && etaDate <= operationalDate);
}

function attentionScore(job: CommandCentreJob, operationalDate: string) {
  return (job.status === "exception" ? 100 : 0) +
    (job.priority === "urgent" ? 50 : job.priority === "high" ? 20 : 0) +
    job.overdue_tasks * 10 +
    (customsBlocking(job, operationalDate) ? job.required_customs_open * 4 : 0) +
    (!job.assigned_to_name && !job.assigned_to_email ? 3 : 0);
}

type Focus = "active" | "attention" | "customs" | "today" | "unassigned";
type ColumnKey = "status" | "location" | "branch" | "owner" | "eta" | "work";
type SavedView = { id: string; name: string; focus: Focus; status: "all" | ShipmentStatus; branch: "all" | KcplBranch; query: string };

const focuses: Focus[] = ["active", "attention", "customs", "today", "unassigned"];
const defaultColumns: Record<ColumnKey, boolean> = { status: true, location: true, branch: true, owner: true, eta: true, work: true };

function statusTone(status: ShipmentStatus): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "customs_clearance" || status === "preparing") return "warning";
  if (["booking_confirmed", "in_transit", "out_for_delivery"].includes(status)) return "info";
  return "neutral";
}

function journeyMilestones(mode: string) {
  const normalized = mode.toLowerCase();
  const transit = normalized.includes("air") ? "Air transit" : normalized.includes("sea") || normalized.includes("ocean") ? "Ocean transit" : normalized.includes("road") ? "Road transit" : "Transit";
  return ["Booked", "Preparing", transit, "Customs", "Delivery", "Delivered"];
}

function milestonePosition(status: ShipmentStatus) {
  if (status === "exception") return -1;
  const positions: Record<Exclude<ShipmentStatus, "exception">, number> = {
    booking_confirmed: 0,
    preparing: 1,
    in_transit: 2,
    customs_clearance: 3,
    out_for_delivery: 4,
    delivered: 5,
  };
  return positions[status];
}

function readSavedViews(): SavedView[] {
  try {
    const value = JSON.parse(window.localStorage.getItem("kcpl-shipment-views") || "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const focus = focuses.includes(record.focus as Focus) ? record.focus as Focus : "active";
      const status = record.status === "all" || shipmentStatuses.includes(record.status as ShipmentStatus) ? record.status as "all" | ShipmentStatus : "all";
      const branch = record.branch === "all" || kcplBranches.includes(record.branch as KcplBranch) ? record.branch as "all" | KcplBranch : "all";
      const name = typeof record.name === "string" ? record.name.trim().slice(0, 48) : "";
      if (!name) return [];
      return [{ id: typeof record.id === "string" ? record.id : `${Date.now()}`, name, focus, status, branch, query: typeof record.query === "string" ? record.query : "" }];
    }).slice(0, 8);
  } catch {
    return [];
  }
}

function readColumns() {
  try {
    const value = JSON.parse(window.localStorage.getItem("kcpl-shipment-columns") || "null") as Record<string, unknown> | null;
    if (!value || typeof value !== "object") return defaultColumns;
    const next = { ...defaultColumns };
    for (const key of Object.keys(defaultColumns) as ColumnKey[]) if (typeof value[key] === "boolean") next[key] = value[key] as boolean;
    return next;
  } catch {
    return defaultColumns;
  }
}

export function ShipmentsWorkspace({ data, roleLabel }: { data: CommandCentreData; roleLabel: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ShipmentStatus>("all");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [focus, setFocus] = useState<Focus>("active");
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [columns, setColumns] = useState(defaultColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSavedViews(readSavedViews());
      setColumns(readColumns());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.jobs.filter((job) => {
      if (status !== "all" && job.status !== status) return false;
      if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch)) return false;
      if (focus === "attention" && attentionScore(job, data.operational_date) === 0) return false;
      if (focus === "customs" && !customsBlocking(job, data.operational_date)) return false;
      if (focus === "today" && job.eta?.slice(0, 10) !== data.operational_date) return false;
      if (focus === "unassigned" && (job.assigned_to_name || job.assigned_to_email)) return false;
      if (!terms.length) return true;
      const haystack = [job.reference, job.quote_reference, job.customer_id ?? "", job.customer_name, job.origin, job.destination, job.mode, shipmentStatusLabels[job.status], job.status, job.priority, job.current_location ?? "", job.carrier ?? "", job.assigned_to_name ?? "", job.assigned_to_email ?? "", job.primary_branch, ...job.handling_branches].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).sort((a, b) => attentionScore(b, data.operational_date) - attentionScore(a, data.operational_date) || Date.parse(b.updated_at) - Date.parse(a.updated_at));
  }, [branch, data.jobs, data.operational_date, focus, query, status]);

  const selected = selectedReference ? data.jobs.find((job) => job.reference === selectedReference) ?? null : null;
  const attention = data.jobs.filter((job) => attentionScore(job, data.operational_date) > 0).length;
  const customs = data.jobs.filter((job) => customsBlocking(job, data.operational_date)).length;
  const today = data.jobs.filter((job) => job.eta?.slice(0, 10) === data.operational_date).length;
  const unassigned = data.jobs.filter((job) => !job.assigned_to_name && !job.assigned_to_email).length;

  function reset() { setFocus("active"); setStatus("all"); setBranch("all"); setQuery(""); }
  function toggleColumn(key: ColumnKey) { setColumns((current) => { const next = { ...current, [key]: !current[key] }; window.localStorage.setItem("kcpl-shipment-columns", JSON.stringify(next)); return next; }); }
  function saveView() { const name = viewName.trim(); if (!name) return; const next: SavedView[] = [{ id: `${Date.now()}`, name: name.slice(0, 48), focus, status, branch, query }, ...savedViews].slice(0, 8); setSavedViews(next); window.localStorage.setItem("kcpl-shipment-views", JSON.stringify(next)); setViewName(""); setSaveOpen(false); }
  function applyView(view: SavedView) { setFocus(view.focus); setStatus(view.status); setBranch(view.branch); setQuery(view.query); }
  function deleteView(id: string) { const next = savedViews.filter((view) => view.id !== id); setSavedViews(next); window.localStorage.setItem("kcpl-shipment-views", JSON.stringify(next)); }

  const optionalCount = Object.values(columns).filter(Boolean).length;
  const colSpan = 3 + optionalCount;

  return <OpsPage>
    <OpsPageHeader eyebrow="Operations" title="Shipments" description="The live movement register. Scan route, milestone, ownership, ETA and open work, then preview the full operational flow before entering the Digital Job File." meta={<><span>{roleLabel}</span><span>Nepal operational date {dateOnly(data.operational_date)}</span><span>{data.accessible_branches.length} accessible branches</span></>} actions={<><Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md">Operations home</Link><Link href="/admin/alerts" className="ops-button" data-variant="primary" data-size="md"><ShieldAlert size={13}/>Tasks & alerts</Link></>}/>

    <OpsStatStrip>
      <OpsStat label="Active" value={data.jobs.length} icon={<PackageCheck size={13}/>} active={focus === "active"} onClick={() => setFocus("active")}/>
      <OpsStat label="Needs attention" value={attention} icon={<AlertTriangle size={13}/>} tone={attention ? "danger" : "neutral"} active={focus === "attention"} onClick={() => setFocus("attention")}/>
      <OpsStat label="Customs risk" value={customs} detail="At clearance or ETA reached" icon={<ShieldAlert size={13}/>} tone={customs ? "warning" : "neutral"} active={focus === "customs"} onClick={() => setFocus("customs")}/>
      <OpsStat label="ETA today" value={today} icon={<CalendarDays size={13}/>} active={focus === "today"} onClick={() => setFocus("today")}/>
      <OpsStat label="Unassigned" value={unassigned} icon={<UserRound size={13}/>} tone={unassigned ? "warning" : "neutral"} active={focus === "unassigned"} onClick={() => setFocus("unassigned")}/>
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      {savedViews.length ? <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-[10px] font-semibold text-[#8b827b]">Saved views</span>{savedViews.map((view) => <span key={view.id} className="group inline-flex items-center rounded-full border border-[#e1d9d2] bg-white"><button type="button" onClick={() => applyView(view)} className="px-3 py-1.5 text-[10px] font-semibold text-[#625a54]">{view.name}</button><button type="button" onClick={() => deleteView(view.id)} aria-label={`Delete ${view.name}`} className="mr-1 grid h-6 w-6 place-items-center rounded-full text-[#a59b93] opacity-60 transition hover:bg-[#f6efeb] hover:text-[#9c5b4e] group-hover:opacity-100"><X size={11}/></button></span>)}</div> : null}

      <OpsSurface title="Shipment queue" eyebrow="Live work" description={`${filtered.length} of ${data.jobs.length} active shipments shown.`} flush action={<div className="relative flex items-center gap-2"><OpsButton variant="secondary" size="sm" onClick={() => { setSaveOpen((current) => !current); setColumnsOpen(false); }}><Save size={12}/>Save view</OpsButton><OpsButton variant="secondary" size="sm" onClick={() => { setColumnsOpen((current) => !current); setSaveOpen(false); }}><Columns3 size={12}/>Columns</OpsButton>{saveOpen ? <div className="absolute right-24 top-10 z-20 w-64 rounded-[12px] border border-[#e1d8d1] bg-white p-3 shadow-[0_18px_50px_rgba(72,52,39,.14)]"><p className="text-[11px] font-bold text-[#514943]">Save current filters</p><input className="ops-input mt-2" value={viewName} maxLength={48} onChange={(event) => setViewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveView(); }} placeholder="e.g. Birgunj customs"/><div className="mt-2 flex justify-end gap-2"><OpsButton size="sm" variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</OpsButton><OpsButton size="sm" variant="primary" onClick={saveView} disabled={!viewName.trim()}>Save</OpsButton></div></div> : null}{columnsOpen ? <div className="absolute right-0 top-10 z-20 w-56 rounded-[12px] border border-[#e1d8d1] bg-white p-2 shadow-[0_18px_50px_rgba(72,52,39,.14)]"><p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold text-[#8a8179]">Visible columns</p>{(Object.keys(defaultColumns) as ColumnKey[]).map((key) => <button key={key} type="button" onClick={() => toggleColumn(key)} className="flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-[11px] font-semibold capitalize text-[#5f5751] hover:bg-[#faf5f1]"><span className={`grid h-4 w-4 place-items-center rounded border ${columns[key] ? "border-[#e2a792] bg-[#fae9e3] text-[#bd624b]" : "border-[#dcd5cf] text-transparent"}`}><Check size={10}/></span>{key}</button>)}</div> : null}</div>}>
        <div className="ops-toolbar"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, customer, route, mode, carrier or owner"/><select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as "all" | ShipmentStatus)}><option value="all">All active statuses</option>{shipmentStatuses.filter((item) => item !== "delivered").map((item) => <option value={item} key={item}>{shipmentStatusLabels[item]}</option>)}</select><select className="ops-select" value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)}><option value="all">All accessible branches</option>{data.accessible_branches.map((item) => <option value={item} key={item}>{item}</option>)}</select><OpsButton variant="ghost" size="sm" onClick={reset}><SlidersHorizontal size={12}/>Reset</OpsButton></div>
        <div className="ops-table-wrap"><table className="ops-table min-w-[1080px]"><thead><tr><th>Shipment</th><th>Customer & route</th>{columns.status ? <th>Milestone</th> : null}{columns.location ? <th>Current location</th> : null}{columns.branch ? <th>Branch</th> : null}{columns.owner ? <th>Owner</th> : null}{columns.eta ? <th>ETA</th> : null}{columns.work ? <th>Open work</th> : null}<th aria-label="Actions"/></tr></thead><tbody>{filtered.length ? filtered.map((job) => <ShipmentRow key={job.reference} job={job} operationalDate={data.operational_date} columns={columns} onPreview={() => setSelectedReference(job.reference)}/>) : <tr><td colSpan={colSpan}><OpsEmptyState kind="search" compact icon={<PackageCheck size={18}/>} title="No shipments match this view" description="Change the filters, open another saved view or reset the queue. No shipment data has been removed." action={<OpsButton variant="secondary" size="sm" onClick={reset}>Reset queue</OpsButton>}/></td></tr>}</tbody></table></div>
      </OpsSurface>
    </div>

    {selected ? <><button type="button" className="ops-drawer-backdrop" aria-label="Close shipment preview" onClick={() => setSelectedReference(null)}/><aside className="ops-drawer" aria-label={`Shipment preview ${selected.reference}`}><div className="ops-drawer-header"><div className="min-w-0"><p className="ops-eyebrow">Shipment control</p><h2 className="mt-1 truncate text-[20px] font-[730] tracking-[-.035em] text-[#342f2b]">{selected.origin || "Origin not set"} <ArrowRight size={14} className="inline text-[#c47a62]"/> {selected.destination || "Destination not set"}</h2><p className="mt-1 text-[11px] text-[#827970]">{selected.customer_name} · <OpsMono>{selected.reference}</OpsMono></p><p className="mt-1 text-[10px] text-[#978d84]">Updated {dateTime(selected.updated_at)}</p></div><button type="button" onClick={() => setSelectedReference(null)} className="grid h-8 w-8 place-items-center rounded-[9px] text-[#8f857d] hover:bg-[#f5efea]" aria-label="Close preview"><X size={14}/></button></div><div className="ops-drawer-body ops-stack"><div className="flex flex-wrap items-center gap-2"><OpsBadge tone={statusTone(selected.status)} dot>{shipmentStatusLabels[selected.status]}</OpsBadge><OpsBadge tone={attentionScore(selected, data.operational_date) > 0 ? "warning" : "success"}>{attentionScore(selected, data.operational_date) > 0 ? "Action required" : "Operationally clear"}</OpsBadge><OpsBadge tone={selected.priority === "urgent" || selected.priority === "high" ? "warning" : "neutral"}>{selected.priority} priority</OpsBadge></div><ShipmentOperationsFlow job={selected} operationalDate={data.operational_date}/>{selected.handling_branches.length ? <div><p className="text-[10px] font-semibold text-[#8a8179]">Handling branches</p><div className="mt-2 flex flex-wrap gap-1.5">{selected.handling_branches.map((item) => <OpsBadge key={item}>{item}</OpsBadge>)}</div></div> : null}</div></aside></> : null}
  </OpsPage>;
}

function ShipmentRow({ job, operationalDate, columns, onPreview }: { job: CommandCentreJob; operationalDate: string; columns: Record<ColumnKey, boolean>; onPreview: () => void }) {
  const attention = attentionScore(job, operationalDate) > 0;
  const owner = job.assigned_to_name || job.assigned_to_email || "Unassigned";
  const work = job.overdue_tasks > 0 ? `${job.overdue_tasks} overdue` : customsBlocking(job, operationalDate) ? `${job.required_customs_open} customs risk` : job.open_tasks > 0 ? `${job.open_tasks} tasks` : "Clear";
  return <tr><td><div className="flex items-start gap-2.5"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${job.status === "exception" ? "bg-[#b8474f]" : attention ? "bg-[#d19a4b]" : "bg-[#62866b]"}`}/><div><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="text-[11px] font-bold text-[#443b35]"><OpsMono>{job.reference}</OpsMono></Link><p className="mt-1 text-[10px] text-[#938981]">{job.mode || "Freight mode not set"}</p></div></div></td><td><strong className="block max-w-[230px] truncate text-[12px]">{job.customer_name}</strong><p className="mt-1 max-w-[260px] truncate text-[11px] text-[#766d66]">{job.origin || "Origin not set"} → {job.destination || "Destination not set"}</p></td>{columns.status ? <td><div className="grid gap-2"><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge><ShipmentMilestoneRail job={job}/></div></td> : null}{columns.location ? <td><span className="flex max-w-[190px] items-center gap-1.5 truncate text-[11px]"><MapPin size={11} className="shrink-0 text-[#b96a52]"/>{job.current_location || "Not updated"}</span>{job.carrier ? <p className="mt-1 max-w-[180px] truncate text-[10px] text-[#91877f]">{job.carrier}</p> : null}</td> : null}{columns.branch ? <td><strong className="text-[11px]">{job.primary_branch}</strong>{job.handling_branches.length > 1 ? <p className="mt-1 text-[10px] text-[#91877f]">+{job.handling_branches.length - 1} handling</p> : null}</td> : null}{columns.owner ? <td><span className={`text-[11px] ${owner === "Unassigned" ? "font-bold text-[#956526]" : ""}`}>{owner}</span></td> : null}{columns.eta ? <td><span className="text-[11px]">{dateOnly(job.eta)}</span></td> : null}{columns.work ? <td><span className={`inline-flex items-center gap-1.5 text-[11px] ${work === "Clear" ? "text-[#5f7c66]" : job.overdue_tasks ? "font-bold text-[#ad464d]" : "font-semibold text-[#93632e]"}`}><ClipboardList size={11}/>{work}</span></td> : null}<td className="text-right"><div className="flex justify-end gap-1"><OpsButton variant="ghost" size="sm" onClick={onPreview}>Flow</OpsButton><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Open job</Link></div></td></tr>;
}

function ShipmentMilestoneRail({ job }: { job: CommandCentreJob }) {
  const milestones = journeyMilestones(job.mode);
  const position = milestonePosition(job.status);
  if (job.status === "exception") return <span className="text-[10px] font-semibold text-[#ad464d]">Exception · open the Job File for context</span>;
  return <div className="flex min-w-[220px] items-start gap-0" aria-label={`${shipmentStatusLabels[job.status]} shipment milestone`} title="Milestones reflect KCPL shipment status, not inferred document or carrier events.">{milestones.map((label, index) => <div key={label} className="flex min-w-0 flex-1 flex-col items-center"><div className="flex w-full items-center"><span className={`h-px flex-1 ${index <= position ? "bg-[#6f8fa7]" : "bg-[#ded8d2]"}`}/><span className={`h-2 w-2 shrink-0 rounded-full border ${index < position ? "border-[#6f8fa7] bg-[#6f8fa7]" : index === position ? "border-[#3f7295] bg-white ring-2 ring-[#dce8ef]" : "border-[#d8d1ca] bg-white"}`}/><span className={`h-px flex-1 ${index < position ? "bg-[#6f8fa7]" : "bg-[#ded8d2]"}`}/></div><span className={`mt-1 max-w-[54px] truncate text-[8px] ${index === position ? "font-bold text-[#436d89]" : "text-[#9b928a]"}`}>{label}</span></div>)}</div>;
}
