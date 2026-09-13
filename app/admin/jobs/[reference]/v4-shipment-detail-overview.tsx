import Link from "next/link";
import type { DigitalJobFile } from "../../job-file";
import { shipmentStatusLabels } from "../../../shipment-types";

function statusClass(status: DigitalJobFile["status"]) {
  if (status === "delivered") return "border-[#A7CCB7] text-[#18794E]";
  if (status === "exception") return "border-[#E6A4B0] text-[#A80E2F]";
  if (status === "customs_clearance" || status === "out_for_delivery") return "border-[#D9C293] text-[#72500C]";
  if (status === "in_transit" || status === "booking_confirmed") return "border-[#A8BDD0] text-[#315D83]";
  return "border-[#D6D6D0] text-[#5B5B57]";
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

  return <main className="bg-[#F6F6F3] px-4 pb-8 pt-8 text-[#101010] sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-[1320px]">
      <header className="border-b border-[#101010] pb-0">
        <div className="grid gap-7 pb-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0">
            <p className="text-[10px] font-normal uppercase tracking-[0.11em] text-[#DC143C]">Digital job file · {job.reference}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-[clamp(34px,4vw,50px)] font-normal leading-[1.04] tracking-[-0.04em]">{job.origin || "Origin"} → {job.destination || "Destination"}</h1>
              <span className={`inline-flex border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.04em] ${statusClass(job.status)}`}>{shipmentStatusLabels[job.status]}</span>
            </div>
            <p className="mt-4 max-w-3xl text-[13px] leading-6 text-[#5B5B57]">{job.customer_name || "Customer not linked"} · {job.carrier || "Carrier not set"} · {job.mode || "Mode not set"}{job.carrier_reference ? ` · ${job.carrier_reference}` : ""}</p>
            <p className="mt-1 text-[11px] leading-5 text-[#777771]">ETA {shortDate(job.eta)} · Owner {owner} · {job.primary_branch}</p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Link href={`/admin/delivery?shipment=${encodeURIComponent(job.reference)}`} className="inline-flex min-h-10 items-center border border-[#A5A5A0] px-4 text-[12px] font-medium transition-colors hover:border-[#101010] hover:bg-[#EEEEE8]">Delivery & POD</Link>
            <Link href={`/admin/notifications?shipment=${encodeURIComponent(job.reference)}`} className="inline-flex min-h-10 items-center border border-[#DC143C] bg-[#DC143C] px-4 text-[12px] font-medium text-white transition-colors hover:border-[#B61032] hover:bg-[#B61032]">Customer update</Link>
          </div>
        </div>
        <nav className="flex h-12 gap-6 overflow-x-auto" aria-label="Shipment record sections">{["Overview","Commercial","Routing","Cargo","Booking","Pickup","Tracking","Customs","Documents","Finance","Activity","Audit"].map((label, index) => <a key={label} href={index === 0 ? "#shipment-overview" : `#${label.toLowerCase()}`} className={`relative flex h-full shrink-0 items-center text-[11px] ${index === 0 ? "font-medium text-[#101010]" : "font-normal text-[#5B5B57] hover:text-[#101010]"}`}>{label}{index === 0 ? <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#DC143C]"/> : null}</a>)}</nav>
      </header>

      <div id="shipment-overview" className="grid lg:grid-cols-[minmax(0,1fr)_350px]">
        <div className="min-w-0 lg:pr-9">
          <section className="border-b border-[#D6D6D0] py-8">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.09em] text-[#DC143C]">01 · Movement</p><h2 className="mt-2 text-[24px] font-normal tracking-[-0.035em]">Journey</h2></div><span className="text-[11px] text-[#777771]">Canonical state and external observations stay distinct</span></div>
            <div className="mt-7 flex items-start"><JourneyStop label={job.origin || "Origin"} detail="Shipment origin" active/><JourneyLine/><JourneyStop label={job.current_location || "Current"} detail={job.current_location ? "Current recorded location" : shipmentStatusLabels[job.status]} active={Boolean(job.current_location)}/><JourneyLine/><JourneyStop label={job.destination || "Destination"} detail={`ETA ${shortDate(job.eta)}`}/><JourneyLine/><JourneyStop label="Delivery" detail={job.status === "delivered" ? "Canonical delivered" : "Not complete"} active={job.status === "delivered"}/></div>
            <div className="mt-5 border-l-2 border-[#315D83] bg-[#EEEEE8] px-4 py-3 text-[12px] leading-5 text-[#315D83]">Carrier observations are evidence only until KCPL canonical completion authority is satisfied.</div>
          </section>

          <section className="border-b border-[#D6D6D0] py-8"><p className="text-[10px] uppercase tracking-[0.09em] text-[#DC143C]">02 · Execution</p><h2 className="mt-2 text-[24px] font-normal tracking-[-0.035em]">Shipment facts</h2><div className="mt-5 border-t border-[#101010]"><KeyValue label="Mode" value={job.mode || "Not set"}/><KeyValue label="Current location" value={job.current_location || "Not updated"}/><KeyValue label="Carrier" value={job.carrier || "Not set"}/><KeyValue label="Carrier reference" value={job.carrier_reference || "Not set"}/><KeyValue label="Priority" value={job.priority}/><KeyValue label="Internal reference" value={job.internal_reference || "Not set"}/></div></section>

          <section className="border-b border-[#D6D6D0] py-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.09em] text-[#DC143C]">03 · Control</p><h2 className="mt-2 text-[24px] font-normal tracking-[-0.035em]">Readiness</h2></div><span className="text-[11px] text-[#777771]">Completion authority</span></div><div className="mt-5 border-t border-[#101010]"><KeyValue label="Open tasks" value={openTasks.length ? `${openTasks.length} open` : "Clear"} warning={openTasks.length > 0}/><KeyValue label="Customs" value={openCustoms.length ? `${openCustoms.length} / ${requiredCustoms.length} required open` : requiredCustoms.length ? "Required checklist complete" : "No required checklist"} warning={openCustoms.length > 0}/><KeyValue label="Delivery evidence" value="See Delivery & POD control"/><KeyValue label="Canonical delivered" value={job.status === "delivered" ? "Complete" : "Not complete"}/></div><div className="mt-4 border-l-2 border-[#D6D6D0] bg-[#EEEEE8] px-4 py-3 text-[12px] leading-5 text-[#5B5B57]">A carrier-delivered observation cannot promote canonical completion by itself.</div></section>

          {job.can_view_costs ? <section className="py-8"><p className="text-[10px] uppercase tracking-[0.09em] text-[#DC143C]">04 · Commercial</p><h2 className="mt-2 text-[24px] font-normal tracking-[-0.035em]">Commercial & finance</h2>{firstCurrency ? <div className="mt-5 grid border-y border-[#101010] sm:grid-cols-3"><Metric label="Revenue" value={money(revenue, firstCurrency)}/><Metric label="Cost" value={money(cost, firstCurrency)}/><Metric label="Margin" value={`${money(profit, firstCurrency)}${typeof margin === "number" ? ` · ${margin.toFixed(1)}%` : ""}`}/></div> : <p className="mt-4 text-[12px] text-[#777771]">No commercial totals recorded.</p>}</section> : null}
        </div>

        <aside className="min-h-[620px] border-t border-[#D6D6D0] bg-[#EEEEE8] px-6 py-8 lg:border-l lg:border-t-0 lg:px-7">
          <p className="text-[10px] uppercase tracking-[0.09em] text-[#DC143C]">Shipment context</p><h2 className="mt-2 text-[24px] font-normal tracking-[-0.035em]">What happens next</h2>
          <div className="my-6 border-l-2 border-[#DC143C] pl-4"><p className="text-[10px] uppercase tracking-[0.07em] text-[#777771]">Next action</p><p className="mt-2 text-[14px] font-medium leading-5">{next?.title || (openCustoms.length ? "Complete customs checklist" : "Review shipment")}</p><p className="mt-1 text-[12px] leading-5 text-[#5B5B57]">{next?.detail || (openCustoms.length ? "Required before completion readiness." : "No overdue task is exposed here.")}</p></div>
          <RailBlock label="Owner" value={owner}/><RailBlock label="Deadline" value={next?.due_at ? shortDate(next.due_at) : shortDate(job.eta)}/><RailBlock label="Blocker" value={openTasks.length || openCustoms.length ? `${openTasks.length + openCustoms.length} open requirement${openTasks.length + openCustoms.length === 1 ? "" : "s"}` : "None"} warning={openTasks.length + openCustoms.length > 0}/><RailBlock label="Related" value={job.quote_reference || "No quote reference"}/>
          <div className="border-t border-[#BEBEB7] pt-5"><Link href={`/admin/documents?shipment=${encodeURIComponent(job.reference)}`} className="inline-flex min-h-10 items-center border-b border-[#101010] text-[12px] font-medium hover:border-[#DC143C] hover:text-[#DC143C]">Open documents →</Link><p className="mt-6 text-[10px] uppercase tracking-[0.07em] text-[#777771]">Operational controls</p><div className="mt-3 flex flex-col gap-3 text-[12px] text-[#5B5B57]"><Link className="hover:text-[#DC143C]" href={`/admin/pickups?shipment=${encodeURIComponent(job.reference)}`}>Pickup scheduling</Link><Link className="hover:text-[#DC143C]" href={`/admin/visibility?shipment=${encodeURIComponent(job.reference)}`}>Tracking visibility</Link><Link className="hover:text-[#DC143C]" href={`/admin/delivery?shipment=${encodeURIComponent(job.reference)}`}>Delivery & POD</Link></div></div>
        </aside>
      </div>
    </div>
  </main>;
}

function JourneyStop({ label, detail, active = false }: { label: string; detail: string; active?: boolean }) { return <div className="min-w-0 flex-1 text-center"><span className={`mx-auto block h-2.5 w-2.5 border ${active ? "border-[#18794E] bg-[#18794E]" : "border-[#BEBEB7] bg-[#F6F6F3]"}`}/><p className="mt-2 truncate text-[12px] font-medium">{label}</p><p className={`mt-1 truncate text-[10px] ${active ? "text-[#18794E]" : "text-[#777771]"}`}>{detail}</p></div>; }
function JourneyLine() { return <div className="mt-[5px] h-px w-[48px] shrink-0 bg-[#BEBEB7] sm:w-[80px]"/>; }
function KeyValue({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className="grid min-h-11 grid-cols-[150px_minmax(0,1fr)] items-center gap-4 border-b border-[#D6D6D0] text-[12px]"><span className="text-[#777771]">{label}</span><span className={`${warning ? "text-[#72500C]" : "text-[#101010]"}`}>{value}</span></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-h-28 border-b border-[#D6D6D0] px-0 py-5 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0"><p className="text-[10px] uppercase tracking-[0.07em] text-[#777771]">{label}</p><p className="mt-3 text-[20px] font-normal tracking-[-0.03em]">{value}</p></div>; }
function RailBlock({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className="border-t border-[#BEBEB7] py-4"><p className="text-[10px] uppercase tracking-[0.07em] text-[#777771]">{label}</p><p className={`mt-1 text-[12px] font-medium ${warning ? "text-[#72500C]" : "text-[#101010]"}`}>{value}</p></div>; }
