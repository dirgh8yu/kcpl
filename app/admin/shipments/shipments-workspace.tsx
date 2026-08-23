"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import type { CommandCentreData, CommandCentreJob } from "../command-centre/command-centre-data";

const NEPAL_TIME_ZONE = "Asia/Kathmandu";

type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

function statusTone(status: ShipmentStatus): StatusTone {
  if (status === "delivered") return "success";
  if (status === "exception") return "danger";
  if (status === "customs_clearance" || status === "out_for_delivery") return "warning";
  if (status === "in_transit" || status === "booking_confirmed") return "info";
  return "neutral";
}

function statusClasses(status: ShipmentStatus) {
  const tone = statusTone(status);
  if (tone === "success") return "bg-[#edf8f2] text-[#18794e]";
  if (tone === "danger") return "bg-[#fff0f0] text-[#a83232]";
  if (tone === "warning") return "bg-[#fff7e6] text-[#945b00]";
  if (tone === "info") return "bg-[#eef5ff] text-[#2563a6]";
  return "bg-[#f7f7f7] text-[#5b5b5b]";
}

function shortDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: value.length === 10 ? "UTC" : NEPAL_TIME_ZONE }).format(date);
}

function owner(job: CommandCentreJob) {
  return job.assigned_to_name || job.assigned_to_email || "Unassigned";
}

function nextAction(job: CommandCentreJob) {
  if (job.status === "exception") return { title: "Review shipment exception", detail: "Movement is blocked until the exception is resolved." };
  if (job.overdue_tasks > 0) return { title: `Resolve ${job.overdue_tasks} overdue task${job.overdue_tasks === 1 ? "" : "s"}`, detail: "Operational work is past its due time." };
  if (job.required_customs_open > 0) return { title: "Complete customs requirements", detail: `${job.required_customs_open} required customs item${job.required_customs_open === 1 ? " is" : "s are"} still open.` };
  if (!job.assigned_to_name && !job.assigned_to_email) return { title: "Assign shipment owner", detail: "This active movement currently has no operational owner." };
  if (job.open_tasks > 0) return { title: `Complete ${job.open_tasks} open task${job.open_tasks === 1 ? "" : "s"}`, detail: "Open the Job File for the current operational checklist." };
  return { title: "Review shipment record", detail: "No blocking task is exposed in the shipment register." };
}

function route(job: CommandCentreJob) {
  return `${job.origin || "Origin"} → ${job.destination || "Destination"}`;
}

function modeOptions(jobs: CommandCentreJob[]) {
  return [...new Set(jobs.map((job) => job.mode.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

const tabs = [
  { label: "Orders", href: "/admin/rating" },
  { label: "Tenders", href: "/admin/tenders" },
  { label: "Bookings", href: "/admin/tenders" },
  { label: "Pickups", href: "/admin/pickups" },
  { label: "Shipments", href: "/admin/shipments", active: true },
  { label: "Consolidations", href: "/admin/consolidation" },
];

export function ShipmentsWorkspace({ data, roleLabel }: { data: CommandCentreData; roleLabel: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"active" | "all" | ShipmentStatus>("active");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [mode, setMode] = useState("all");
  const [selectedReference, setSelectedReference] = useState<string | null>(null);

  const modes = useMemo(() => modeOptions(data.jobs), [data.jobs]);
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.jobs.filter((job) => {
      if (status !== "all" && status !== "active" && job.status !== status) return false;
      if (status === "active" && job.status === "delivered") return false;
      if (branch !== "all" && job.primary_branch !== branch && !job.handling_branches.includes(branch)) return false;
      if (mode !== "all" && job.mode !== mode) return false;
      if (!terms.length) return true;
      const haystack = [job.reference, job.quote_reference, job.customer_name, job.origin, job.destination, job.mode, job.carrier ?? "", owner(job), shipmentStatusLabels[job.status]].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  }, [branch, data.jobs, mode, query, status]);

  const selected = (selectedReference ? filtered.find((job) => job.reference === selectedReference) : null) || filtered[0] || null;
  const active = data.jobs.filter((job) => job.status !== "delivered").length;
  const inTransit = data.jobs.filter((job) => job.status === "in_transit").length;
  const customs = data.jobs.filter((job) => job.status === "customs_clearance").length;
  const delivery = data.jobs.filter((job) => job.status === "out_for_delivery").length;
  const exceptions = data.jobs.filter((job) => job.status === "exception").length;

  return <main className="min-h-[calc(100vh-54px)] bg-[#f6f6f3] px-4 pb-10 pt-6 text-[#141414] sm:px-6 lg:px-7">
    <div className="mx-auto w-full max-w-[1152px]">
      <header className="flex min-h-[60px] flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-[22px] font-semibold leading-[30px]">Shipments</h1><p className="mt-[3px] text-[13px] leading-[19px] text-[#5b5b5b]">{active} active · {inTransit} in transit · {customs} customs · {delivery} delivery · {exceptions} exceptions</p></div>
        <Link href="/admin/rating" className="inline-flex h-8 items-center justify-center rounded-[6px] bg-[#dc143c] px-4 text-[12px] font-semibold leading-[17px] text-white hover:bg-[#c81035]">New order</Link>
      </header>

      <nav className="flex h-11 items-center gap-5 overflow-x-auto border-b border-[#e2e2e2]" aria-label="Operations workflow">
        {tabs.map((tab) => <Link key={tab.label} href={tab.href} className={`relative flex h-10 shrink-0 items-center justify-center px-2 text-[13px] font-medium leading-[19px] ${tab.active ? "text-[#141414]" : "text-[#5b5b5b] hover:text-[#141414]"}`}>{tab.label}{tab.active ? <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#dc143c]"/> : null}</Link>)}
      </nav>

      <div className="flex min-h-[58px] flex-wrap items-center gap-2 border-b border-[#e2e2e2] py-3">
        <label className="flex h-8 min-w-[260px] flex-1 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 md:max-w-[300px]"><span className="mr-2 text-[12px] text-[#737373]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, AWB, customer…" className="min-w-0 flex-1 bg-transparent text-[12px] font-medium outline-none placeholder:text-[#737373]"/></label>
        <select value={status} onChange={(event) => setStatus(event.target.value as "active" | "all" | ShipmentStatus)} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold outline-none"><option value="active">Active</option><option value="all">All states</option>{shipmentStatuses.map((item) => <option key={item} value={item}>{shipmentStatusLabels[item]}</option>)}</select>
        <select value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold outline-none"><option value="all">All branches</option>{data.accessible_branches.filter((item) => kcplBranches.includes(item)).map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={mode} onChange={(event) => setMode(event.target.value)} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold outline-none"><option value="all">All modes</option>{modes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <button type="button" onClick={() => { setQuery(""); setStatus("active"); setBranch("all"); setMode("all"); }} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Reset</button>
        <span className="ml-auto text-[12px] font-medium text-[#5b5b5b]">{roleLabel} · {filtered.length} shown</span>
      </div>

      <section className="grid min-h-[650px] lg:grid-cols-[minmax(0,800px)_351px]">
        <div className="min-w-0 overflow-x-auto lg:border-r lg:border-[#e2e2e2]">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
            <thead><tr className="h-9 border-b border-[#e2e2e2] text-[11px] font-medium text-[#737373]"><th className="w-[160px] px-3 font-medium">SHIPMENT</th><th className="w-[120px] px-3 font-medium">ROUTE</th><th className="w-[160px] px-3 font-medium">CUSTOMER</th><th className="w-[120px] px-3 font-medium">STATE</th><th className="w-[90px] px-3 font-medium">ETA</th><th className="w-[110px] px-3 font-medium">OWNER</th></tr></thead>
            <tbody>{filtered.length ? filtered.map((job) => {
              const chosen = selected?.reference === job.reference;
              return <tr key={job.reference} onClick={() => setSelectedReference(job.reference)} onDoubleClick={() => window.location.assign(`/admin/jobs/${encodeURIComponent(job.reference)}`)} className={`group relative h-12 cursor-pointer border-b border-[#e2e2e2] text-[12px] transition hover:bg-[#fbfbf9] ${chosen ? "bg-[#fbfbf9]" : ""}`}>
                <td className="relative px-3 text-[13px] font-medium">{chosen ? <span className="absolute bottom-1.5 left-1 top-1.5 w-0.5 rounded-[2px] bg-[#dc143c]"/> : null}<span className="block truncate">{job.reference}</span></td>
                <td className="px-3 text-[13px] text-[#5b5b5b]"><span className="block truncate">{job.origin || "—"} → {job.destination || "—"}</span></td>
                <td className="px-3 text-[13px] text-[#5b5b5b]"><span className="block truncate">{job.customer_name}</span></td>
                <td className="px-3"><span className={`inline-flex rounded-[5px] px-[7px] py-[3px] text-[11px] font-medium leading-[15px] ${statusClasses(job.status)}`}>{shipmentStatusLabels[job.status]}</span></td>
                <td className="px-3 text-[12px] font-medium text-[#5b5b5b]">{shortDate(job.eta)}</td>
                <td className="px-3 text-[12px] font-medium text-[#5b5b5b]"><span className="block truncate">{owner(job)}</span></td>
              </tr>;
            }) : <tr><td colSpan={6} className="h-48 px-6 text-center"><p className="text-[14px] font-semibold">No shipments match this view</p><p className="mt-1 text-[12px] text-[#737373]">Change the filters or reset the workspace.</p></td></tr>}</tbody>
          </table>
        </div>

        <aside className="min-h-[650px] bg-[#fdfdfd] px-6 py-5 shadow-[0_6px_18px_rgba(0,0,0,.02)]">
          {selected ? <ShipmentPeek job={selected}/> : <div className="grid h-full place-items-center text-center"><div><p className="text-[14px] font-semibold">No shipment selected</p><p className="mt-1 text-[12px] text-[#737373]">Choose a row to inspect the movement.</p></div></div>}
        </aside>
      </section>
    </div>
  </main>;
}

function ShipmentPeek({ job }: { job: CommandCentreJob }) {
  const action = nextAction(job);
  const customs = job.required_customs_open > 0 ? `${job.required_customs_open} open` : "No blockers";
  const exception = job.status === "exception" ? "Open" : "None";
  return <div className="flex h-full flex-col">
    <div className="min-h-[102px]"><p className="text-[11px] font-medium leading-[15px] text-[#737373]">{job.reference}</p><h2 className="mt-1 text-[18px] font-semibold leading-[26px]">{route(job)}</h2><p className="mt-1 truncate text-[12px] font-medium leading-[17px] text-[#5b5b5b]">{job.customer_name} · {job.carrier || "Carrier not set"} · {job.mode || "Mode not set"}</p><span className={`mt-2 inline-flex rounded-[5px] px-[7px] py-[3px] text-[11px] font-medium leading-[15px] ${statusClasses(job.status)}`}>{shipmentStatusLabels[job.status]}</span></div>
    <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium leading-[15px] text-[#737373]">NEXT ACTION</p><p className="mt-1 text-[13px] font-medium leading-[19px]">{action.title}</p><p className="mt-1 text-[12px] font-medium leading-[17px] text-[#5b5b5b]">{action.detail}</p></div>
    <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium leading-[15px] text-[#737373]">ROUTE</p><p className="mt-2 text-[13px] font-medium leading-[19px]">{job.origin || "Origin"} → {job.current_location ? `${job.current_location} → ` : ""}{job.destination || "Destination"}</p>{job.current_location ? <p className="mt-1 text-[12px] font-medium leading-[17px] text-[#5b5b5b]">Current · {job.current_location}</p> : null}<p className="mt-1 text-[12px] font-medium leading-[17px] text-[#5b5b5b]">ETA · {shortDate(job.eta)}</p></div>
    <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium leading-[15px] text-[#737373]">READINESS</p><PeekRow label="Open work" value={job.open_tasks ? `${job.open_tasks} tasks` : "Clear"}/><PeekRow label="Customs" value={customs} warning={job.required_customs_open > 0}/><PeekRow label="POD" value="See delivery control"/><PeekRow label="Exception" value={exception} warning={exception === "Open"}/><PeekRow label="Owner" value={owner(job)}/></div>
    <div className="mt-auto border-t border-[#e2e2e2] pt-[18px]"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex h-8 w-full items-center justify-center rounded-[8px] bg-[#dc143c] text-[12px] font-semibold leading-[17px] text-white hover:bg-[#c81035]">Open shipment ↗</Link><p className="mt-2 text-[11px] font-medium leading-[15px] text-[#737373]">Double-click a row to open directly</p></div>
  </div>;
}

function PeekRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="mt-3 flex items-start gap-3 text-[12px] font-medium leading-[17px]"><span className="text-[#5b5b5b]">{label}</span><span className={`ml-auto text-right font-semibold ${warning ? "text-[#945b00]" : "text-[#141414]"}`}>{value}</span></div>;
}
