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
  Landmark,
  MapPin,
  PackageCheck,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import type { KcplBranch } from "../crm/crm-data";
import type { CommandCentreData, CommandCentreJob } from "../command-centre/command-centre-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";

function dateOnly(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function dateTime(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function attentionScore(job: CommandCentreJob) {
  return (job.status === "exception" ? 100 : 0) +
    (job.priority === "urgent" ? 50 : job.priority === "high" ? 20 : 0) +
    job.overdue_tasks * 10 + job.required_customs_open * 4 +
    (!job.assigned_to_name && !job.assigned_to_email ? 3 : 0);
}

type Focus = "active" | "attention" | "customs" | "today" | "unassigned";
type ColumnKey = "status" | "location" | "branch" | "owner" | "eta" | "work";
type SavedView = { id: string; name: string; focus: Focus; status: "all" | ShipmentStatus; branch: "all" | KcplBranch; query: string };

const defaultColumns: Record<ColumnKey, boolean> = { status: true, location: true, branch: true, owner: true, eta: true, work: true };

function statusTone(status: ShipmentStatus): "neutral" | "info" | "warning" | "violet" | "success" | "danger" {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "customs_clearance") return "violet";
  if (status === "preparing") return "warning";
  if (status === "booking_confirmed" || status === "in_transit" || status === "out_for_delivery") return "info";
  return "neutral";
}

function readSavedViews(): SavedView[] {
  try {
    const value = JSON.parse(window.localStorage.getItem("kcpl-shipment-views") || "[]") as SavedView[];
    return Array.isArray(value) ? value : [];
  } catch { return []; }
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
      try {
        const stored = JSON.parse(window.localStorage.getItem("kcpl-shipment-columns") || "null") as Partial<Record<ColumnKey, boolean>> | null;
        if (stored) setColumns({ ...defaultColumns, ...stored });
      } catch { window.localStorage.removeItem("kcpl-shipment-columns"); }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.jobs.filter((job) => {
      if (status !== "all" && job.status !== status) return false;
      if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch)) return false;
      if (focus === "attention" && attentionScore(job) === 0) return false;
      if (focus === "customs" && job.required_customs_open === 0) return false;
      if (focus === "today" && job.eta?.slice(0, 10) !== data.operational_date) return false;
      if (focus === "unassigned" && (job.assigned_to_name || job.assigned_to_email)) return false;
      if (!needle) return true;
      return [job.reference, job.quote_reference, job.customer_name, job.origin, job.destination, job.current_location ?? "", job.carrier ?? "", job.assigned_to_name ?? "", job.assigned_to_email ?? "", job.primary_branch, ...job.handling_branches].join(" ").toLowerCase().includes(needle);
    }).sort((a, b) => attentionScore(b) - attentionScore(a) || b.updated_at.localeCompare(a.updated_at));
  }, [branch, data.jobs, data.operational_date, focus, query, status]);

  const selected = selectedReference ? data.jobs.find((job) => job.reference === selectedReference) ?? null : null;
  const attention = data.jobs.filter((job) => attentionScore(job) > 0).length;
  const customs = data.jobs.filter((job) => job.required_customs_open > 0).length;
  const today = data.jobs.filter((job) => job.eta?.slice(0, 10) === data.operational_date).length;
  const unassigned = data.jobs.filter((job) => !job.assigned_to_name && !job.assigned_to_email).length;

  function reset() {
    setFocus("active"); setStatus("all"); setBranch("all"); setQuery("");
  }

  function toggleColumn(key: ColumnKey) {
    setColumns((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem("kcpl-shipment-columns", JSON.stringify(next));
      return next;
    });
  }

  function saveView() {
    const name = viewName.trim();
    if (!name) return;
    const next: SavedView[] = [{ id: `${Date.now()}`, name, focus, status, branch, query }, ...savedViews].slice(0, 8);
    setSavedViews(next);
    window.localStorage.setItem("kcpl-shipment-views", JSON.stringify(next));
    setViewName("");
    setSaveOpen(false);
  }

  function applyView(view: SavedView) {
    setFocus(view.focus); setStatus(view.status); setBranch(view.branch); setQuery(view.query);
  }

  function deleteView(id: string) {
    const next = savedViews.filter((view) => view.id !== id);
    setSavedViews(next);
    window.localStorage.setItem("kcpl-shipment-views", JSON.stringify(next));
  }

  const optionalCount = Object.values(columns).filter(Boolean).length;
  const colSpan = 3 + optionalCount;

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Operations"
        title="Shipments"
        description="A working queue for every active movement. Scan what matters, preview context without losing your place, then enter the Digital Job File only when you need the full record."
        meta={<><span>{roleLabel}</span><span>Nepal operational date {dateOnly(data.operational_date)}</span><span>{data.accessible_branches.length} accessible branches</span></>}
        actions={<><Link href="/admin/command-centre" className="ops-button" data-variant="secondary" data-size="md">Operations home</Link><Link href="/admin/alerts" className="ops-button" data-variant="primary" data-size="md"><ShieldAlert size={13}/>Tasks & alerts</Link></>}
      />

      <OpsStatStrip>
        <OpsStat label="Active" value={data.jobs.length} icon={<PackageCheck size={13}/>} active={focus === "active"} onClick={() => setFocus("active")}/>
        <OpsStat label="Needs attention" value={attention} icon={<AlertTriangle size={13}/>} tone={attention ? "danger" : "neutral"} active={focus === "attention"} onClick={() => setFocus("attention")}/>
        <OpsStat label="Customs blockers" value={customs} icon={<ShieldAlert size={13}/>} tone={customs ? "warning" : "neutral"} active={focus === "customs"} onClick={() => setFocus("customs")}/>
        <OpsStat label="Due today" value={today} icon={<CalendarDays size={13}/>} active={focus === "today"} onClick={() => setFocus("today")}/>
        <OpsStat label="Unassigned" value={unassigned} icon={<UserRound size={13}/>} tone={unassigned ? "warning" : "neutral"} active={focus === "unassigned"} onClick={() => setFocus("unassigned")}/>
      </OpsStatStrip>

      <div className="ops-content-wide ops-stack">
        {savedViews.length ? <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-[9px] font-bold uppercase tracking-[.1em] text-[#a0968e]">Saved views</span>{savedViews.map((view) => <span key={view.id} className="group inline-flex items-center rounded-full border border-[#e7dfd8] bg-white"><button type="button" onClick={() => applyView(view)} className="px-3 py-1.5 text-[9px] font-semibold text-[#6c625b]">{view.name}</button><button type="button" onClick={() => deleteView(view.id)} aria-label={`Delete ${view.name}`} className="mr-1 grid h-5 w-5 place-items-center rounded-full text-[#b1a8a0] opacity-0 group-hover:opacity-100 hover:bg-[#f6efeb] hover:text-[#9c5b4e]"><X size={10}/></button></span>)}</div> : null}

        <OpsSurface title="Shipment queue" eyebrow="Live work" description={`${filtered.length} of ${data.jobs.length} active shipments shown.`} flush action={<div className="relative flex items-center gap-2">
          <OpsButton variant="secondary" size="sm" onClick={() => setSaveOpen((current) => !current)}><Save size={12}/>Save view</OpsButton>
          <OpsButton variant="secondary" size="sm" onClick={() => setColumnsOpen((current) => !current)}><Columns3 size={12}/>Columns</OpsButton>
          {saveOpen ? <div className="absolute right-24 top-9 z-20 w-64 rounded-[14px] border border-[#e4dbd4] bg-[#fffdfa] p-3 shadow-[0_18px_50px_rgba(72,52,39,.14)]"><p className="text-[9px] font-bold text-[#655b53]">Save current filters</p><input className="ops-input mt-2" value={viewName} onChange={(event) => setViewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveView(); }} placeholder="e.g. Birgunj customs"/><div className="mt-2 flex justify-end gap-2"><OpsButton size="sm" variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</OpsButton><OpsButton size="sm" variant="primary" onClick={saveView} disabled={!viewName.trim()}>Save</OpsButton></div></div> : null}
          {columnsOpen ? <div className="absolute right-0 top-9 z-20 w-56 rounded-[14px] border border-[#e4dbd4] bg-[#fffdfa] p-2 shadow-[0_18px_50px_rgba(72,52,39,.14)]"><p className="px-2 pb-1.5 pt-1 text-[8px] font-bold uppercase tracking-[.1em] text-[#aaa098]">Visible columns</p>{(Object.keys(defaultColumns) as ColumnKey[]).map((key) => <button key={key} type="button" onClick={() => toggleColumn(key)} className="flex w-full items-center gap-2 rounded-[9px] px-2 py-2 text-left text-[9px] font-semibold capitalize text-[#655b53] hover:bg-[#faf4ef]"><span className={`grid h-4 w-4 place-items-center rounded border ${columns[key] ? "border-[#e2a792] bg-[#fae9e3] text-[#bd624b]" : "border-[#e4ddd6] text-transparent"}`}><Check size={10}/></span>{key}</button>)}</div> : null}
        </div>}>
          <div className="ops-toolbar">
            <OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, route, carrier or owner"/>
            <select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as "all" | ShipmentStatus)}><option value="all">All statuses</option>{shipmentStatuses.filter((item) => item !== "delivered").map((item) => <option value={item} key={item}>{shipmentStatusLabels[item]}</option>)}</select>
            <select className="ops-select" value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)}><option value="all">All branches</option>{data.accessible_branches.map((item) => <option value={item} key={item}>{item}</option>)}</select>
            <OpsButton variant="ghost" size="sm" onClick={reset}><SlidersHorizontal size={12}/>Reset</OpsButton>
          </div>

          <div className="ops-table-wrap">
            <table className="ops-table min-w-[1080px]">
              <thead><tr><th>Shipment</th><th>Customer & route</th>{columns.status ? <th>Status</th> : null}{columns.location ? <th>Current location</th> : null}{columns.branch ? <th>Branch</th> : null}{columns.owner ? <th>Owner</th> : null}{columns.eta ? <th>ETA</th> : null}{columns.work ? <th>Open work</th> : null}<th></th></tr></thead>
              <tbody>{filtered.length ? filtered.map((job) => <ShipmentRow key={job.reference} job={job} columns={columns} onPreview={() => setSelectedReference(job.reference)}/>) : <tr><td colSpan={colSpan}><OpsEmptyState icon={<PackageCheck size={18}/>} title="No shipments in this view" description="Try another saved view or reset the filters. Nothing has been deleted or hidden from the underlying job files."/></td></tr>}</tbody>
            </table>
          </div>
        </OpsSurface>
      </div>

      {selected ? <><button type="button" className="ops-drawer-backdrop" aria-label="Close shipment preview" onClick={() => setSelectedReference(null)}/><aside className="ops-drawer" aria-label={`Shipment preview ${selected.reference}`}>
        <div className="ops-drawer-header"><div><p className="ops-eyebrow">Shipment preview</p><h2 className="mt-1 text-[18px] font-[730] tracking-[-.035em] text-[#3b342f]"><OpsMono>{selected.reference}</OpsMono></h2><p className="mt-1 text-[10px] text-[#948a81]">Updated {dateTime(selected.updated_at)}</p></div><button type="button" onClick={() => setSelectedReference(null)} className="grid h-8 w-8 place-items-center rounded-[10px] text-[#9c928a] hover:bg-[#f5efea]" aria-label="Close preview"><X size={14}/></button></div>
        <div className="ops-drawer-body ops-stack">
          <div className="flex flex-wrap items-center gap-2"><OpsBadge tone={statusTone(selected.status)} dot>{shipmentStatusLabels[selected.status]}</OpsBadge><OpsBadge tone={attentionScore(selected) > 0 ? "danger" : "success"}>{attentionScore(selected) > 0 ? "Needs attention" : "Operationally clear"}</OpsBadge><OpsBadge tone={selected.priority === "urgent" || selected.priority === "high" ? "warning" : "neutral"}>{selected.priority} priority</OpsBadge></div>
          <div><h3 className="text-[20px] font-[730] tracking-[-.035em] text-[#3f3732]">{selected.customer_name}</h3><p className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-[#6d635b]"><span>{selected.origin || "Origin not set"}</span><ArrowRight size={13} className="text-[#c47a62]"/><span>{selected.destination || "Destination not set"}</span></p></div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-y border-[#eee7e1] py-4"><PreviewFact icon={<MapPin size={13}/>} label="Current location" value={selected.current_location || "Not set"}/><PreviewFact icon={<Landmark size={13}/>} label="Primary branch" value={selected.primary_branch}/><PreviewFact icon={<UserRound size={13}/>} label="Owner" value={selected.assigned_to_name || selected.assigned_to_email || "Unassigned"}/><PreviewFact icon={<CalendarDays size={13}/>} label="ETA" value={dateOnly(selected.eta)}/><PreviewFact label="Carrier" value={selected.carrier || "Not set"}/><PreviewFact label="Quote" value={selected.quote_reference || "Not linked"} mono/></div>
          <div className="grid grid-cols-3 gap-2"><DrawerMetric label="Open tasks" value={selected.open_tasks} tone={selected.overdue_tasks ? "danger" : "neutral"}/><DrawerMetric label="Overdue" value={selected.overdue_tasks} tone={selected.overdue_tasks ? "danger" : "neutral"}/><DrawerMetric label="Customs" value={selected.required_customs_open} tone={selected.required_customs_open ? "warning" : "neutral"}/></div>
          {selected.handling_branches.length ? <div><p className="text-[9px] font-bold uppercase tracking-[.09em] text-[#9d938b]">Handling branches</p><div className="mt-2 flex flex-wrap gap-1.5">{selected.handling_branches.map((item) => <OpsBadge key={item}>{item}</OpsBadge>)}</div></div> : null}
          <div className="flex flex-wrap gap-2 pt-1"><Link href={`/admin/jobs/${encodeURIComponent(selected.reference)}`} className="ops-button" data-variant="primary" data-size="md">Open Digital Job File <ArrowRight size={12}/></Link>{selected.customer_id ? <Link href={`/admin/crm/${encodeURIComponent(selected.customer_id)}`} className="ops-button" data-variant="secondary" data-size="md">Customer 360</Link> : null}</div>
        </div>
      </aside></> : null}
    </OpsPage>
  );
}

function ShipmentRow({ job, columns, onPreview }: { job: CommandCentreJob; columns: Record<ColumnKey, boolean>; onPreview: () => void }) {
  const attention = attentionScore(job) > 0;
  const owner = job.assigned_to_name || job.assigned_to_email || "Unassigned";
  const work = job.overdue_tasks > 0 ? `${job.overdue_tasks} overdue` : job.required_customs_open > 0 ? `${job.required_customs_open} customs` : job.open_tasks > 0 ? `${job.open_tasks} tasks` : "Clear";
  return <tr>
    <td><div className="flex items-center gap-2.5"><span className={`h-2 w-2 shrink-0 rounded-full ${attention ? "bg-[#c45e60]" : "bg-[#7c987f]"}`}/><div><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="font-bold text-[#443b35]"><OpsMono>{job.reference}</OpsMono></Link><p className="mt-1 text-[8px] text-[#a19890]">Quote <OpsMono>{job.quote_reference || "—"}</OpsMono></p></div></div></td>
    <td><strong className="block max-w-[230px] truncate">{job.customer_name}</strong><p className="mt-1 max-w-[250px] truncate text-[9px] text-[#8f857d]">{job.origin || "Origin?"} → {job.destination || "Destination?"}</p></td>
    {columns.status ? <td><OpsBadge tone={statusTone(job.status)} dot>{shipmentStatusLabels[job.status]}</OpsBadge></td> : null}
    {columns.location ? <td><span className="flex max-w-[190px] items-center gap-1.5 truncate"><MapPin size={11} className="shrink-0 text-[#c2745b]"/>{job.current_location || "Not set"}</span>{job.carrier ? <p className="mt-1 max-w-[180px] truncate text-[8px] text-[#9e958d]">{job.carrier}</p> : null}</td> : null}
    {columns.branch ? <td><strong>{job.primary_branch}</strong>{job.handling_branches.length > 1 ? <p className="mt-1 text-[8px] text-[#9e958d]">+{job.handling_branches.length - 1} handling</p> : null}</td> : null}
    {columns.owner ? <td><span className={owner === "Unassigned" ? "font-bold text-[#b65355]" : ""}>{owner}</span></td> : null}
    {columns.eta ? <td>{dateOnly(job.eta)}</td> : null}
    {columns.work ? <td><span className={`inline-flex items-center gap-1.5 ${work === "Clear" ? "text-[#66806b]" : attention ? "font-bold text-[#b65355]" : "text-[#9a682f]"}`}><ClipboardList size={11}/>{work}</span></td> : null}
    <td className="text-right"><OpsButton variant="ghost" size="sm" onClick={onPreview}>Preview <ArrowRight size={11}/></OpsButton></td>
  </tr>;
}

function PreviewFact({ icon, label, value, mono = false }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return <div><p className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[.08em] text-[#9d938b]">{icon}{label}</p><p className="mt-1.5 break-words text-[10px] font-semibold text-[#5e554e]">{mono ? <OpsMono>{value}</OpsMono> : value}</p></div>;
}

function DrawerMetric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "warning" | "danger" }) {
  return <div className="rounded-[12px] border border-[#eae3dd] bg-[#faf7f4] p-3"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#9c928a]">{label}</p><strong className={`mt-1 block text-[18px] tracking-[-.03em] ${tone === "danger" ? "text-[#b65355]" : tone === "warning" ? "text-[#9a682f]" : "text-[#4f4640]"}`}>{value}</strong></div>;
}
