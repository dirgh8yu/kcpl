import Link from "next/link";
import type { DigitalJobFile } from "../../job-file";
import { shipmentStatusLabels } from "../../../shipment-types";

function statusClass(status: DigitalJobFile["status"]) {
  if (status === "delivered") return "bg-[#edf8f2] text-[#18794e]";
  if (status === "exception") return "bg-[#fff0f0] text-[#a83232]";
  if (status === "customs_clearance" || status === "out_for_delivery") return "bg-[#fff7e6] text-[#945b00]";
  if (status === "in_transit" || status === "booking_confirmed") return "bg-[#eef5ff] text-[#2563a6]";
  return "bg-[#f7f7f7] text-[#5b5b5b]";
}

function shortDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${currency} ${value.toLocaleString("en-AU")}`; }
}

export function V4ShipmentDetailOverview({ job }: { job: DigitalJobFile }) {
  const openTasks = job.tasks.filter((task) => !task.completed);
  const requiredCustoms = job.customs_steps.filter((step) => step.required);
  const openCustoms = requiredCustoms.filter((step) => !step.completed);
  const owner = job.assigned_to_name || job.assigned_to_email || "Unassigned";
  const next = openTasks[0];
  const currencies = [...new Set([...Object.keys(job.revenue_totals), ...Object.keys(job.cost_totals)])];
  const firstCurrency = currencies[0];
  const revenue = firstCurrency ? job.revenue_totals[firstCurrency as keyof typeof job.revenue_totals] ?? 0 : 0;
  const cost = firstCurrency ? job.cost_totals[firstCurrency as keyof typeof job.cost_totals] ?? 0 : 0;
  const profit = firstCurrency ? job.profit_totals[firstCurrency as keyof typeof job.profit_totals] ?? revenue - cost : revenue - cost;
  const margin = firstCurrency ? job.margin_percent[firstCurrency as keyof typeof job.margin_percent] : undefined;

  return <main className="bg-[#f6f6f3] px-4 pb-7 pt-4 text-[#141414] sm:px-6 lg:px-7">
    <div className="mx-auto w-full max-w-[1152px]">
      <header className="border-b border-[#e2e2e2] pt-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-[10px]"><h1 className="text-[22px] font-semibold leading-[30px]">{job.origin || "Origin"} → {job.destination || "Destination"}</h1><span className={`rounded-[5px] px-[7px] py-[3px] text-[11px] font-medium leading-[15px] ${statusClass(job.status)}`}>{shipmentStatusLabels[job.status]}</span></div><p className="mt-[22px] text-[13px] leading-[19px] text-[#5b5b5b]">{job.reference} · {job.customer_name || "Customer not linked"} · {job.carrier || "Carrier not set"} · {job.mode || "Mode not set"}{job.carrier_reference ? ` · ${job.carrier_reference}` : ""}</p><p className="mt-1.5 text-[12px] font-medium leading-[17px] text-[#737373]">ETA {shortDate(job.eta)} · Owner {owner} · {job.primary_branch}</p></div>
          <div className="flex gap-2"><Link href={`/admin/delivery?shipment=${encodeURIComponent(job.reference)}`} className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-4 text-[12px] font-semibold">More</Link><Link href={`/admin/notifications?shipment=${encodeURIComponent(job.reference)}`} className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-4 text-[12px] font-semibold text-white">Customer update</Link></div>
        </div>
        <nav className="mt-5 flex h-10 gap-5 overflow-x-auto" aria-label="Shipment record sections">{["Overview","Commercial","Routing","Cargo","Booking","Pickup","Tracking","Customs","Documents","Finance","Activity","Audit"].map((label, index) => <a key={label} href={index === 0 ? "#shipment-overview" : `#${label.toLowerCase()}`} className={`relative flex h-9 shrink-0 items-center text-[12px] font-medium ${index === 0 ? "font-semibold text-[#141414]" : "text-[#5b5b5b]"}`}>{label}{index === 0 ? <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#dc143c]"/> : null}</a>)}</nav>
      </header>

      <div id="shipment-overview" className="grid lg:grid-cols-[minmax(0,1fr)_351px]">
        <div className="min-w-0 pr-0 lg:pr-7">
          <section className="border-b border-[#e2e2e2] py-5"><div className="flex items-center"><h2 className="text-[15px] font-semibold leading-[22px]">Journey</h2><span className="ml-auto text-[11px] font-medium text-[#737373]">Canonical state and external observations stay distinct</span></div><div className="mt-4 flex items-start"><JourneyStop label={job.origin || "Origin"} detail="Shipment origin" active/><JourneyLine/><JourneyStop label={job.current_location || "Current"} detail={job.current_location ? "Current recorded location" : shipmentStatusLabels[job.status]} active={Boolean(job.current_location)}/><JourneyLine/><JourneyStop label={job.destination || "Destination"} detail={`ETA ${shortDate(job.eta)}`}/><JourneyLine/><JourneyStop label="Delivery" detail={job.status === "delivered" ? "Canonical Delivered" : "Not complete"} active={job.status === "delivered"}/></div><div className="mt-3 rounded-[5px] bg-[#f7f7f7] px-[10px] py-2 text-[12px] font-medium leading-[17px] text-[#2563a6]">Carrier observations are evidence only until KCPL canonical completion authority is satisfied.</div></section>

          <section className="border-b border-[#e2e2e2] py-7"><h2 className="text-[15px] font-semibold leading-[22px]">Execution</h2><KeyValue label="Mode" value={job.mode || "Not set"}/><KeyValue label="Current location" value={job.current_location || "Not updated"}/><KeyValue label="Carrier" value={job.carrier || "Not set"}/><KeyValue label="Carrier reference" value={job.carrier_reference || "Not set"}/><KeyValue label="Priority" value={job.priority}/><KeyValue label="Internal reference" value={job.internal_reference || "Not set"}/></section>

          <section className="border-b border-[#e2e2e2] py-7"><div className="flex items-center"><h2 className="text-[15px] font-semibold leading-[22px]">Readiness</h2><span className="ml-auto text-[11px] font-medium text-[#737373]">Completion authority</span></div><KeyValue label="Open tasks" value={openTasks.length ? `${openTasks.length} open` : "Clear"} warning={openTasks.length > 0}/><KeyValue label="Customs" value={openCustoms.length ? `${openCustoms.length} / ${requiredCustoms.length} required open` : requiredCustoms.length ? "Required checklist complete" : "No required checklist"} warning={openCustoms.length > 0}/><KeyValue label="Delivery evidence" value="See Delivery & POD control"/><KeyValue label="Canonical Delivered" value={job.status === "delivered" ? "Complete" : "Not complete"}/><div className="mt-2 rounded-[5px] bg-[#f7f7f7] px-[10px] py-2 text-[12px] leading-[17px] text-[#6b6b6b]">Carrier “delivered” observations cannot promote canonical completion.</div></section>

          {job.can_view_costs ? <section className="py-7"><h2 className="text-[15px] font-semibold leading-[22px]">Commercial & finance</h2>{firstCurrency ? <div className="mt-3 grid gap-4 sm:grid-cols-3"><Metric label="REVENUE" value={money(revenue, firstCurrency)}/><Metric label="COST" value={money(cost, firstCurrency)}/><Metric label="MARGIN" value={`${money(profit, firstCurrency)}${typeof margin === "number" ? ` · ${margin.toFixed(1)}%` : ""}`}/></div> : <p className="mt-3 text-[12px] text-[#737373]">No commercial totals recorded.</p>}</section> : null}
        </div>

        <aside className="min-h-[600px] border-l border-[#e2e2e2] bg-white px-6 py-[22px] lg:rounded-[12px] lg:border lg:border-[#e8e8e8]">
          <div className="flex h-7 items-center"><h2 className="text-[15px] font-semibold leading-[22px]">Context</h2><span className="ml-auto text-[11px] font-medium text-[#737373]">⌘↵</span></div><div className="my-4 flex gap-3 border-l-2 border-[#dc143c] pl-3"><div><p className="text-[11px] font-medium text-[#737373]">NEXT ACTION</p><p className="mt-1 text-[14px] font-semibold">{next?.title || (openCustoms.length ? "Complete customs checklist" : "Review shipment")}</p><p className="mt-1 text-[12px] leading-[17px] text-[#5b5b5b]">{next?.detail || (openCustoms.length ? "Required before completion readiness." : "No overdue task is exposed here.")}</p></div></div><RailBlock label="OWNER" value={owner}/><RailBlock label="DEADLINE" value={next?.due_at ? shortDate(next.due_at) : shortDate(job.eta)}/><RailBlock label="BLOCKER" value={openTasks.length || openCustoms.length ? `${openTasks.length + openCustoms.length} open requirement${openTasks.length + openCustoms.length === 1 ? "" : "s"}` : "None"} warning={openTasks.length + openCustoms.length > 0}/><RailBlock label="RELATED" value={job.quote_reference || "No quote reference"}/><div className="border-t border-[#e2e2e2] pt-[18px]"><Link href={`/admin/documents?shipment=${encodeURIComponent(job.reference)}`} className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-4 text-[12px] font-semibold">Open documents</Link><p className="mt-4 text-[12px] font-semibold">Operational controls</p><div className="mt-2 flex flex-col gap-2 text-[11px] font-medium text-[#5b5b5b]"><Link href={`/admin/pickups?shipment=${encodeURIComponent(job.reference)}`}>Pickup scheduling</Link><Link href={`/admin/visibility?shipment=${encodeURIComponent(job.reference)}`}>Tracking visibility</Link><Link href={`/admin/delivery?shipment=${encodeURIComponent(job.reference)}`}>Delivery & POD</Link></div></div>
        </aside>
      </div>
    </div>
  </main>;
}

function JourneyStop({ label, detail, active = false }: { label: string; detail: string; active?: boolean }) { return <div className="min-w-0 flex-1 text-center"><span className={`mx-auto block h-2.5 w-2.5 rounded-full ${active ? "bg-[#18794e]" : "bg-[#cfcfcf]"}`}/><p className="mt-1.5 truncate text-[13px] font-medium">{label}</p><p className={`mt-1 truncate text-[11px] font-medium ${active ? "text-[#18794e]" : "text-[#737373]"}`}>{detail}</p></div>; }
function JourneyLine() { return <div className="mt-1 h-px w-[60px] shrink-0 bg-[#e2e2e2] sm:w-[90px]"/>; }
function KeyValue({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className="mt-2 flex min-h-7 items-center text-[12px] font-medium"><span className="w-[160px] shrink-0 text-[#737373]">{label}</span><span className={`min-w-0 flex-1 text-[13px] ${warning ? "text-[#945b00]" : "text-[#141414]"}`}>{value}</span></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-medium text-[#737373]">{label}</p><p className="mt-1 text-[13px] font-medium">{value}</p></div>; }
function RailBlock({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className="border-t border-[#e2e2e2] py-[14px]"><p className="text-[11px] font-medium text-[#737373]">{label}</p><p className={`mt-1 text-[13px] font-medium ${warning ? "text-[#945b00]" : "text-[#141414]"}`}>{value}</p></div>; }
