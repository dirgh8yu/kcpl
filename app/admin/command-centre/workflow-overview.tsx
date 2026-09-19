import Link from "next/link";
import { Activity, ArrowRight, Boxes, CalendarClock, FileText, Handshake, ListChecks, PackageCheck } from "lucide-react";
import type { WorkflowOverview } from "./workflow-overview.server";

function Signal({ label, value, danger = false, warning = false }: { label: string; value: number; danger?: boolean; warning?: boolean }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[length:var(--app-label-size)] font-bold ${danger && value > 0 ? "border-[var(--admin-danger-line)] bg-[var(--admin-danger-bg)] text-[var(--admin-danger)]" : warning && value > 0 ? "border-[var(--admin-warning-line)] bg-[var(--admin-warning-bg)] text-[var(--admin-warning)]" : "border-[var(--admin-line)] bg-white text-[var(--admin-muted)]"}`}><strong>{value}</strong>{label}</span>;
}

function FlowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-white px-2.5 py-1.5 text-[length:var(--app-label-size)] font-bold text-[var(--admin-ink)] hover:border-[var(--admin-accent-line)] hover:text-[var(--admin-crimson)]">{children}</Link>;
}

export function WorkflowOverviewStrip({ overview }: { overview: WorkflowOverview }) {
  const hasSignals = Boolean(overview.planning || overview.tendering || overview.pickup || overview.documents || overview.visibility || overview.delivery || overview.finance);
  if (!hasSignals) return null;

  return <section className="ops-content-wide pt-5">
    <div className="overflow-hidden rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] shadow-[0_8px_28px_rgba(54,43,34,.04)]">
      <div className="border-b border-[var(--admin-line)] px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="ops-eyebrow">End-to-end workflow</p><h2 className="mt-1 text-[15px] font-[740] tracking-[-.02em] text-[var(--admin-ink)]">One operating pipeline</h2><p className="mt-1 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">Move work forward from enquiry to procurement, pickup, freight documents, execution, delivery and Match-Pay without hunting for the next workspace.</p></div><Link href="/admin/alerts" className="ops-button" data-variant="secondary" data-size="sm">Open blockers</Link></div>
        <div className="ops-scroll-x mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          <FlowLink href="/admin">Enquiry</FlowLink><ArrowRight size={10} className="shrink-0 text-[var(--admin-muted)]"/>
          <FlowLink href="/admin/rating">Order & rate</FlowLink><ArrowRight size={10} className="shrink-0 text-[var(--admin-muted)]"/>
          <FlowLink href="/admin/pricing">Price</FlowLink><ArrowRight size={10} className="shrink-0 text-[var(--admin-muted)]"/>
          <FlowLink href="/admin/consolidation">Load</FlowLink><ArrowRight size={10} className="shrink-0 text-[var(--admin-muted)]"/>
          <FlowLink href="/admin/tenders">Tender / book</FlowLink><ArrowRight size={10} className="shrink-0 text-[var(--admin-muted)]"/>
          <FlowLink href="/admin/pickups">Pickup</FlowLink><ArrowRight size={10} className="shrink-0 text-[var(--admin-muted)]"/>
          <FlowLink href="/admin/freight-documents">Documents</FlowLink><ArrowRight size={10} className="shrink-0 text-[var(--admin-muted)]"/>
          <FlowLink href="/admin/shipments">Shipment</FlowLink><ArrowRight size={10} className="shrink-0 text-[var(--admin-muted)]"/>
          <FlowLink href="/admin/visibility">Track</FlowLink><ArrowRight size={10} className="shrink-0 text-[var(--admin-muted)]"/>
          <FlowLink href="/admin/delivery">Deliver / POD</FlowLink><ArrowRight size={10} className="shrink-0 text-[var(--admin-muted)]"/>
          <FlowLink href="/admin/freight-audit">Audit / pay</FlowLink>
        </div>
      </div>

      <div className="grid divide-y divide-[var(--admin-line)] md:grid-cols-2 xl:grid-cols-7 xl:divide-x xl:divide-y-0">
        {overview.planning ? <Link href="/admin/rating" className="group p-4 hover:bg-[var(--admin-surface-soft)]"><div className="flex items-center gap-2 text-[var(--admin-crimson)]"><Boxes size={14}/><span className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.08em]">Planning</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="need rate" value={overview.planning.needs_rate_or_selection} warning/><Signal label="selected" value={overview.planning.selected_for_procurement}/></div><p className="mt-3 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Orders waiting to become a controlled procurement decision.</p></Link> : null}
        {overview.tendering ? <Link href="/admin/tenders" className="group p-4 hover:bg-[var(--admin-surface-soft)]"><div className="flex items-center gap-2 text-[var(--admin-crimson)]"><Handshake size={14}/><span className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.08em]">Tendering</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="active" value={overview.tendering.active} warning/><Signal label="ready to book" value={overview.tendering.accepted_or_countered}/></div><p className="mt-3 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Carrier responses and accepted commercials requiring booking action.</p></Link> : null}
        {overview.pickup ? <Link href="/admin/pickups" className="group p-4 hover:bg-[var(--admin-surface-soft)]"><div className="flex items-center gap-2 text-[var(--admin-crimson)]"><CalendarClock size={14}/><span className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.08em]">Pickup</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="unscheduled" value={overview.pickup.unscheduled} warning/><Signal label="missed" value={overview.pickup.missed} danger/><Signal label="confirmed" value={overview.pickup.confirmed}/></div><p className="mt-3 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Booked cargo waiting for collection windows, confirmation or recovery.</p></Link> : null}
        {overview.documents ? <Link href="/admin/freight-documents" className="group p-4 hover:bg-[var(--admin-surface-soft)]"><div className="flex items-center gap-2 text-[var(--admin-crimson)]"><FileText size={14}/><span className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.08em]">Documents</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="carriage missing" value={overview.documents.missing_primary} danger/><Signal label="review" value={overview.documents.review_pending} warning/><Signal label="generated" value={overview.documents.generated_current}/></div><p className="mt-3 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Generate and review BL, AWB, consignment, manifest and execution documents.</p></Link> : null}
        {overview.visibility ? <Link href="/admin/visibility" className="group p-4 hover:bg-[var(--admin-surface-soft)]"><div className="flex items-center gap-2 text-[var(--admin-crimson)]"><Activity size={14}/><span className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.08em]">Visibility</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="delayed" value={overview.visibility.delayed} danger/><Signal label="stale" value={overview.visibility.stale} danger/><Signal label="customs" value={overview.visibility.customs}/></div><p className="mt-3 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Live cargo movement and feeds that need operator attention.</p></Link> : null}
        {overview.delivery ? <Link href="/admin/delivery" className="group p-4 hover:bg-[var(--admin-surface-soft)]"><div className="flex items-center gap-2 text-[var(--admin-crimson)]"><PackageCheck size={14}/><span className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.08em]">Delivery</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="failed" value={overview.delivery.failed_or_refused} danger/><Signal label="POD pending" value={overview.delivery.pod_pending} warning/><Signal label="active" value={overview.delivery.active}/></div><p className="mt-3 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Final-mile failures and delivered jobs waiting for defensible proof.</p></Link> : null}
        {overview.finance ? <Link href="/admin/freight-audit" className="group p-4 hover:bg-[var(--admin-surface-soft)]"><div className="flex items-center gap-2 text-[var(--admin-crimson)]"><ListChecks size={14}/><span className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.08em]">Match-Pay</span></div><div className="mt-3 flex flex-wrap gap-1.5"><Signal label="blocked" value={overview.finance.payment_blocked} danger/><Signal label="review" value={overview.finance.review_required} warning/><Signal label="disputed" value={overview.finance.disputed} danger/></div><p className="mt-3 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">Supplier bills blocked until booked procurement and invoice agree.</p></Link> : null}
      </div>
    </div>
  </section>;
}
