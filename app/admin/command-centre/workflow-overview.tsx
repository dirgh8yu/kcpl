import Link from "next/link";
import { Activity, ArrowRight, Boxes, Handshake, ListChecks, PackageCheck } from "lucide-react";
import type { WorkflowOverview } from "./workflow-overview.server";

function Signal({ label, value, danger = false, warning = false }: { label: string; value: number; danger?: boolean; warning?: boolean }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold ${danger && value > 0 ? "border-[#edc8c4] bg-[#fff4f2] text-[#a6534d]" : warning && value > 0 ? "border-[#eadcc2] bg-[#fffaf0] text-[#8d6b38]" : "border-[#e5ded8] bg-white text-[#756c65]"}`}><strong>{value}</strong>{label}</span>;
}

function FlowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="rounded-[8px] border border-[#e6dfd9] bg-white px-2.5 py-1.5 text-[9px] font-bold text-[#5e5650] hover:border-[#d5c8bf] hover:text-[#a85f4b]">{children}</Link>;
}

export function WorkflowOverviewStrip({ overview }: { overview: WorkflowOverview }) {
  const hasSignals = Boolean(overview.planning || overview.tendering || overview.visibility || overview.delivery || overview.finance);
  if (!hasSignals) return null;

  return <section className="ops-content-wide pt-5">
    <div className="overflow-hidden rounded-[15px] border border-[#ded8d2] bg-[#fffdfa] shadow-[0_8px_28px_rgba(54,43,34,.04)]">
      <div className="border-b border-[#e9e3dd] px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="ops-eyebrow">End-to-end workflow</p><h2 className="mt-1 text-[15px] font-[740] tracking-[-.02em] text-[#443d38]">One operating pipeline</h2><p className="mt-1 text-[9px] leading-5 text-[#867c74]">Move work forward from enquiry to procurement, execution, delivery and Match-Pay without hunting for the next workspace.</p></div><Link href="/admin/alerts" className="ops-button" data-variant="secondary" data-size="sm">Open blockers</Link></div>
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          <FlowLink href="/admin">Enquiry</FlowLink><ArrowRight size={10} className="shrink-0 text-[#aaa099]"/>
          <FlowLink href="/admin/rating">Order & rate</FlowLink><ArrowRight size={10} className="shrink-0 text-[#aaa099]"/>
          <FlowLink href="/admin/pricing">Price</FlowLink><ArrowRight size={10} className="shrink-0 text-[#aaa099]"/>
          <FlowLink href="/admin/consolidation">Load</FlowLink><ArrowRight size={10} className="shrink-0 text-[#aaa099]"/>
          <FlowLink href="/admin/tenders">Tender</FlowLink><ArrowRight size={10} className="shrink-0 text-[#aaa099]"/>
          <FlowLink href="/admin/shipments">Shipment</FlowLink><ArrowRight size={10} className="shrink-0 text-[#aaa099]"/>
          <FlowLink href="/admin/visibility">Track</FlowLink><ArrowRight size={10} className="shrink-0 text-[#aaa099]"/>
          <FlowLink href="/admin/delivery">Deliver / POD</FlowLink><ArrowRight size={10} className="shrink-0 text-[#aaa099]"/>
          <FlowLink href="/admin/freight-audit">Audit / pay</FlowLink>
        </div>
      </div>

      <div className="grid divide-y divide-[#ece6e0] lg:grid-cols-5 lg:divide-x lg:divide-y-0">
        {overview.planning ? <Link href="/admin/rating" className="group p-4 hover:bg-[#fcf9f6]"><div className="flex items-center gap-2 text-[#b45f4b]"><Boxes size={14}/><span className="text-[9px] font-bold uppercase tracking-[.08em]">Planning</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="need rate" value={overview.planning.needs_rate_or_selection} warning/><Signal label="selected" value={overview.planning.selected_for_procurement}/></div><p className="mt-3 text-[9px] leading-4 text-[#8b8179]">Orders waiting to become a controlled procurement decision.</p></Link> : null}
        {overview.tendering ? <Link href="/admin/tenders" className="group p-4 hover:bg-[#fcf9f6]"><div className="flex items-center gap-2 text-[#b45f4b]"><Handshake size={14}/><span className="text-[9px] font-bold uppercase tracking-[.08em]">Tendering</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="active" value={overview.tendering.active} warning/><Signal label="ready to book" value={overview.tendering.accepted_or_countered}/></div><p className="mt-3 text-[9px] leading-4 text-[#8b8179]">Carrier responses and accepted commercials requiring booking action.</p></Link> : null}
        {overview.visibility ? <Link href="/admin/visibility" className="group p-4 hover:bg-[#fcf9f6]"><div className="flex items-center gap-2 text-[#b45f4b]"><Activity size={14}/><span className="text-[9px] font-bold uppercase tracking-[.08em]">Visibility</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="delayed" value={overview.visibility.delayed} danger/><Signal label="stale" value={overview.visibility.stale} danger/><Signal label="customs" value={overview.visibility.customs}/></div><p className="mt-3 text-[9px] leading-4 text-[#8b8179]">Live cargo movement and feeds that need operator attention.</p></Link> : null}
        {overview.delivery ? <Link href="/admin/delivery" className="group p-4 hover:bg-[#fcf9f6]"><div className="flex items-center gap-2 text-[#b45f4b]"><PackageCheck size={14}/><span className="text-[9px] font-bold uppercase tracking-[.08em]">Delivery</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="failed" value={overview.delivery.failed_or_refused} danger/><Signal label="POD pending" value={overview.delivery.pod_pending} warning/><Signal label="active" value={overview.delivery.active}/></div><p className="mt-3 text-[9px] leading-4 text-[#8b8179]">Final-mile failures and delivered jobs waiting for defensible proof.</p></Link> : null}
        {overview.finance ? <Link href="/admin/freight-audit" className="group p-4 hover:bg-[#fcf9f6]"><div className="flex items-center gap-2 text-[#b45f4b]"><ListChecks size={14}/><span className="text-[9px] font-bold uppercase tracking-[.08em]">Match-Pay</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="blocked" value={overview.finance.payment_blocked} danger/><Signal label="review" value={overview.finance.review_required} warning/><Signal label="disputed" value={overview.finance.disputed} danger/></div><p className="mt-3 text-[9px] leading-4 text-[#8b8179]">Supplier bills blocked until booked procurement and invoice agree.</p></Link> : null}
      </div>
    </div>
  </section>;
}
