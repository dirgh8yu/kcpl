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
  if (tone === "success") return "border-[#A7CCB7] text-[#18794E]";
  if (tone === "danger") return "border-[#E6A4B0] text-[#A80E2F]";
  if (tone === "warning") return "border-[#D9C293] text-[#72500C]";
  if (tone === "info") return "border-[#A8BDD0] text-[#315D83]";
  return "border-[#D6D6D0] text-[#5B5B57]";
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
  { label: "Shipments", href: "/admin/shipments", active: true },
  { label: "Pickup scheduling", href: "/admin/pickups" },
  { label: "Live visibility", href: "/admin/visibility" },
  { label: "Customs", href: "/admin/customs" },
  { label: "Freight documents", href: "/admin/freight-documents" },
  { label: "Document vault", href: "/admin/documents" },
  { label: "Delivery & POD", href: "/admin/delivery" },
  { label: "Tasks & alerts", href: "/admin/alerts" },
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

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#F6F6F3] px-4 pb-12 pt-8 text-[#101010] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1320px]">
        <header className="grid gap-6 border-b border-[#101010] pb-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-[10px] font-normal uppercase tracking-[0.11em] text-[#DC143C]">Operations · Shipment register</p>
            <h1 className="mt-3 text-[clamp(36px,4vw,52px)] font-normal leading-[1.04] tracking-[-0.04em]">Shipments</h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#5B5B57]">{active} active · {inTransit} in transit · {customs} customs · {delivery} delivery · {exceptions} exceptions</p>
          </div>
          <Link href="/admin/command-centre" className="inline-flex min-h-10 items-center border-b border-[#101010] pb-1 text-[12px] text-[#101010] transition-colors hover:border-[#DC143C] hover:text-[#DC143C]">Operations overview →</Link>
        </header>

        <nav className="flex min-h-[58px] items-center gap-7 overflow-x-auto border-b border-[#D6D6D0]" aria-label="Operations workflow">
          {tabs.map((tab) => (
            <Link key={tab.label} href={tab.href} className={`relative flex h-[58px] shrink-0 items-center text-[12px] ${tab.active ? "font-medium text-[#101010]" : "font-normal text-[#5B5B57] hover:text-[#101010]"}`}>
              {tab.label}
              {tab.active ? <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#DC143C]"/> : null}
            </Link>
          ))}
        </nav>

        <div className="flex min-h-[72px] flex-wrap items-center gap-2 border-b border-[#D6D6D0] py-4">
          <label className="flex h-10 min-w-[250px] flex-1 items-center border border-[#BDBDB6] bg-white px-3 md:max-w-[330px]"><span className="mr-2 text-[12px] text-[#777771]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, AWB, customer…" className="min-w-0 flex-1 bg-transparent text-[12px] font-normal outline-none placeholder:text-[#777771]"/></label>
          <select value={status} onChange={(event) => setStatus(event.target.value as "active" | "all" | ShipmentStatus)} className="h-10 border border-[#BDBDB6] bg-white px-3 text-[12px] font-normal outline-none"><option value="active">Active</option><option value="all">All states</option>{shipmentStatuses.map((item) => <option key={item} value={item}>{shipmentStatusLabels[item]}</option>)}</select>
          <select value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)} className="h-10 border border-[#BDBDB6] bg-white px-3 text-[12px] font-normal outline-none"><option value="all">All branches</option>{data.accessible_branches.filter((item) => kcplBranches.includes(item)).map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={mode} onChange={(event) => setMode(event.target.value)} className="h-10 border border-[#BDBDB6] bg-white px-3 text-[12px] font-normal outline-none"><option value="all">All modes</option>{modes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <button type="button" onClick={() => { setQuery(""); setStatus("active"); setBranch("all"); setMode("all"); }} className="h-10 border border-[#A5A5A0] bg-transparent px-3 text-[12px] font-normal transition-colors hover:border-[#101010] hover:bg-[#EEEEE8]">Reset</button>
          <span className="ml-auto text-[11px] text-[#5B5B57]">{roleLabel} · {filtered.length} shown</span>
        </div>

        <section className="grid min-h-[650px] lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 overflow-x-auto lg:border-r lg:border-[#D6D6D0]">
            <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
              <thead><tr className="h-11 border-b border-[#101010] text-[10px] font-normal uppercase tracking-[0.06em] text-[#5B5B57]"><th className="w-[160px] px-3 font-normal">Shipment</th><th className="w-[130px] px-3 font-normal">Route</th><th className="w-[160px] px-3 font-normal">Customer</th><th className="w-[130px] px-3 font-normal">State</th><th className="w-[90px] px-3 font-normal">ETA</th><th className="w-[110px] px-3 font-normal">Owner</th></tr></thead>
              <tbody>{filtered.length ? filtered.map((job) => {
                const chosen = selected?.reference === job.reference;
                return (
                  <tr key={job.reference} onClick={() => setSelectedReference(job.reference)} onDoubleClick={() => window.location.assign(`/admin/jobs/${encodeURIComponent(job.reference)}`)} className={`group relative h-[54px] cursor-pointer border-b border-[#D6D6D0] text-[12px] transition-colors hover:bg-[#EEEEE8] ${chosen ? "bg-[#EEEEE8]" : ""}`}>
                    <td className="relative px-3 text-[13px] font-medium">{chosen ? <span className="absolute bottom-2 left-0 top-2 w-[2px] bg-[#DC143C]"/> : null}<span className="block truncate">{job.reference}</span></td>
                    <td className="px-3 text-[12px] text-[#5B5B57]"><span className="block truncate">{job.origin || "—"} → {job.destination || "—"}</span></td>
                    <td className="px-3 text-[12px] text-[#5B5B57]"><span className="block truncate">{job.customer_name}</span></td>
                    <td className="px-3"><span className={`inline-flex border px-[7px] py-[3px] text-[10px] font-medium leading-[15px] ${statusClasses(job.status)}`}>{shipmentStatusLabels[job.status]}</span></td>
                    <td className="px-3 text-[12px] text-[#5B5B57]">{shortDate(job.eta)}</td>
                    <td className="px-3 text-[12px] text-[#5B5B57]"><span className="block truncate">{owner(job)}</span></td>
                  </tr>
                );
              }) : <tr><td colSpan={6} className="h-48 px-6 text-center"><p className="text-[14px] font-medium">No shipments match this view</p><p className="mt-2 text-[12px] text-[#777771]">Change the filters or reset the workspace.</p></td></tr>}</tbody>
            </table>
          </div>

          <aside className="min-h-[650px] bg-[#EEEEE8] px-6 py-6">
            {selected ? <ShipmentPeek job={selected}/> : <div className="grid h-full place-items-center text-center"><div><p className="text-[14px] font-medium">No shipment selected</p><p className="mt-2 text-[12px] text-[#777771]">Choose a row to inspect the movement.</p></div></div>}
          </aside>
        </section>
      </div>
    </main>
  );
}

function ShipmentPeek({ job }: { job: CommandCentreJob }) {
  const action = nextAction(job);
  const customs = job.required_customs_open > 0 ? `${job.required_customs_open} open` : "No blockers";
  const exception = job.status === "exception" ? "Open" : "None";
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-[112px]"><p className="text-[10px] font-normal uppercase tracking-[0.07em] text-[#777771]">{job.reference}</p><h2 className="mt-2 text-[24px] font-normal leading-[1.15] tracking-[-0.035em]">{route(job)}</h2><p className="mt-2 truncate text-[12px] leading-[18px] text-[#5B5B57]">{job.customer_name} · {job.carrier || "Carrier not set"} · {job.mode || "Mode not set"}</p><span className={`mt-3 inline-flex border px-[7px] py-[3px] text-[10px] font-medium leading-[15px] ${statusClasses(job.status)}`}>{shipmentStatusLabels[job.status]}</span></div>
      <div className="border-t border-[#BEBEB7] py-5"><p className="text-[10px] font-normal uppercase tracking-[0.07em] text-[#777771]">Next action</p><p className="mt-2 text-[13px] font-medium leading-[19px]">{action.title}</p><p className="mt-1 text-[12px] leading-[18px] text-[#5B5B57]">{action.detail}</p></div>
      <div className="border-t border-[#BEBEB7] py-5"><p className="text-[10px] font-normal uppercase tracking-[0.07em] text-[#777771]">Route</p><p className="mt-2 text-[13px] font-medium leading-[19px]">{job.origin || "Origin"} → {job.current_location ? `${job.current_location} → ` : ""}{job.destination || "Destination"}</p>{job.current_location ? <p className="mt-1 text-[12px] leading-[18px] text-[#5B5B57]">Current · {job.current_location}</p> : null}<p className="mt-1 text-[12px] leading-[18px] text-[#5B5B57]">ETA · {shortDate(job.eta)}</p></div>
      <div className="border-t border-[#BEBEB7] py-5"><p className="text-[10px] font-normal uppercase tracking-[0.07em] text-[#777771]">Readiness</p><PeekRow label="Open work" value={job.open_tasks ? `${job.open_tasks} tasks` : "Clear"}/><PeekRow label="Customs" value={customs} warning={job.required_customs_open > 0}/><PeekRow label="POD" value="See delivery control"/><PeekRow label="Exception" value={exception} warning={exception === "Open"}/><PeekRow label="Owner" value={owner(job)}/></div>
      <div className="mt-auto border-t border-[#BEBEB7] pt-5"><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="flex min-h-11 w-full items-center justify-center border border-[#DC143C] bg-[#DC143C] px-4 text-[12px] font-medium text-white transition-colors hover:border-[#B61032] hover:bg-[#B61032]">Open shipment →</Link><p className="mt-3 text-[10px] leading-[15px] text-[#777771]">Double-click a row to open directly</p></div>
    </div>
  );
}

function PeekRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="mt-3 flex items-start gap-3 text-[12px] leading-[17px]"><span className="text-[#5B5B57]">{label}</span><span className={`ml-auto text-right font-medium ${warning ? "text-[#72500C]" : "text-[#101010]"}`}>{value}</span></div>;
}
