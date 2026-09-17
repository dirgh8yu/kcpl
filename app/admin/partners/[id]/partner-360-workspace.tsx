import Link from "next/link";
import {
  BadgeCheck,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  Ship,
  Star,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { payableStatusLabels } from "../../payables/payables-data";
import { shipmentStatusLabels } from "../../../shipment-types";
import { OpsBadge, OpsEmptyState, OpsMono, OpsPage, OpsPageHeader, OpsStat, OpsStatStrip, OpsSurface } from "../../operations-ui";
import { partnerModeLabels, partnerStatusLabels, partnerTypeLabels } from "../partners-data";
import type { Partner360Snapshot, PartnerFinanceSummary } from "../partner-360";

function money(amount: number, currency: string | null) {
  if (!currency) return "Invalid currency";
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(date);
}

function dateOnly(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function operationalDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function daysUntil(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const target = Date.parse(`${value}T00:00:00Z`);
  const today = Date.parse(`${operationalDate()}T00:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(today)) return null;
  return Math.round((target - today) / 86_400_000);
}

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "active" || status === "paid" || status === "delivered") return "success";
  if (status === "on_hold" || status === "partially_paid" || status === "customs_clearance") return "warning";
  if (status === "overdue" || status === "exception") return "danger";
  if (status === "approved" || status === "in_transit" || status === "out_for_delivery") return "info";
  return "neutral";
}

function whatsappHref(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

export function Partner360Workspace({ snapshot, commercialVisible, financialVisible }: {
  snapshot: Partner360Snapshot;
  commercialVisible: boolean;
  financialVisible: boolean;
}) {
  const partner = snapshot.partner;
  const countryCount = new Set([partner.country, ...partner.countries_served].map((item) => item.trim()).filter(Boolean)).size;
  const openBills = snapshot.finance_summaries.reduce((sum, item) => sum + item.open_bill_count, 0);
  const overdueBills = snapshot.finance_summaries.reduce((sum, item) => sum + item.overdue_bill_count, 0);
  const expiryDays = daysUntil(partner.contract_expiry_date);
  const expiryAttention = expiryDays !== null && expiryDays <= 30;

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Partner 360"
      title={partner.display_name}
      description={partner.legal_name || "Operational footprint, relationship context and linked supplier activity in one counterpart record."}
      meta={<>
        <OpsMono>{partner.id}</OpsMono>
        <OpsBadge tone={statusTone(partner.status)} dot>{partnerStatusLabels[partner.status]}</OpsBadge>
        {partner.preferred ? <OpsBadge tone="accent"><Star size={10} fill="currentColor"/>Preferred</OpsBadge> : null}
        {partner.types.slice(0, 4).map((type) => <OpsBadge key={type}>{partnerTypeLabels[type]}</OpsBadge>)}
      </>}
      actions={<>
        <Link href="/admin/partners" className="ops-button" data-variant="secondary" data-size="md">Back to partners</Link>
        {financialVisible ? <Link href={`/admin/payables?partner=${encodeURIComponent(partner.id)}`} className="ops-button" data-variant="primary" data-size="md"><ReceiptText size={12}/>New supplier bill</Link> : null}
      </>}
    />

    <OpsStatStrip>
      <OpsStat label="Linked jobs" value={snapshot.jobs.length} icon={<Ship size={13}/>} />
      <OpsStat label="Services" value={partner.modes.length} icon={<BadgeCheck size={13}/>} />
      <OpsStat label="Countries" value={countryCount} icon={<Globe2 size={13}/>} />
      <OpsStat label="Cities" value={partner.cities_served.length} icon={<MapPin size={13}/>} />
      {financialVisible ? <OpsStat label="Open bills" value={openBills} icon={<WalletCards size={13}/>} tone={openBills ? "warning" : "neutral"}/> : null}
      {financialVisible ? <OpsStat label="Overdue bills" value={overdueBills} icon={<TriangleAlert size={13}/>} tone={overdueBills ? "danger" : "neutral"}/> : null}
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      {financialVisible && snapshot.legacy_name_linked_bill_count > 0 ? <div className="rounded-[var(--app-radius)] border border-[var(--admin-warning-line)] bg-[var(--admin-warning-bg)] px-4 py-3"><div className="flex items-start gap-3"><TriangleAlert size={15} className="mt-0.5 shrink-0 text-[var(--admin-warning)]"/><div><strong className="text-[11px] text-[var(--admin-warning)]">Legacy supplier links need reconciliation</strong><p className="mt-1 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{snapshot.legacy_name_linked_bill_count} non-void bill{snapshot.legacy_name_linked_bill_count === 1 ? "" : "s"} match this partner by name but do not carry its Partner ID. They remain visible to Accounts, but they are not treated as confirmed operational job links.</p></div></div></div> : null}
      {financialVisible && snapshot.finance_integrity_warning_count > 0 ? <div className="rounded-[var(--app-radius)] border border-[var(--admin-danger-line)] bg-[var(--admin-danger-bg)] px-4 py-3"><div className="flex items-start gap-3"><TriangleAlert size={15} className="mt-0.5 shrink-0 text-[var(--admin-danger)]"/><div><strong className="text-[11px] text-[var(--admin-danger)]">Finance data needs repair</strong><p className="mt-1 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{snapshot.finance_integrity_warning_count} branch or currency integrity issue{snapshot.finance_integrity_warning_count === 1 ? "" : "s"} were found in linked payable records. Values with invalid currency are excluded from currency totals.</p></div></div></div> : null}

      <div className="ops-grid-main">
        <div className="ops-stack">
          <OpsSurface eyebrow="Operating footprint" title="Where and how KCPL works with this partner" description="Saved network coverage only. This is not live tracking or a claim of physical presence.">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <Fact label="Base country" value={partner.country}/>
              <Fact label="KCPL owner" value={partner.owner_branch || "Needs owner repair"}/>
              <Fact label="Countries served" value={partner.countries_served.join(", ") || "Not recorded"}/>
              <Fact label="Cities served" value={partner.cities_served.join(", ") || "Not recorded"}/>
              <Fact label="Ports / airports" value={partner.ports_served.join(", ") || "Not recorded"}/>
              <Fact label="Service rating" value={partner.service_rating ? `${partner.service_rating}/5` : "Not rated"}/>
              <Fact label="Updated" value={dateTime(partner.updated_at)}/>
              <Fact label="Last linked activity" value={dateTime(partner.last_activity_at)}/>
            </div>
            <div className="mt-5 border-t border-[var(--admin-line)] pt-4"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.06em] text-[var(--admin-muted)]">Services / modes</p><div className="mt-2 flex flex-wrap gap-1.5">{partner.modes.length ? partner.modes.map((mode) => <OpsBadge key={mode} tone="info">{partnerModeLabels[mode]}</OpsBadge>) : <span className="text-[11px] text-[var(--admin-muted)]">No services selected.</span>}</div></div>
            {partner.tags.length ? <div className="mt-4 border-t border-[var(--admin-line)] pt-4"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.06em] text-[var(--admin-muted)]">Tags</p><div className="mt-2 flex flex-wrap gap-1.5">{partner.tags.map((tag) => <OpsBadge key={tag} tone="accent">{tag}</OpsBadge>)}</div></div> : null}
          </OpsSurface>

          <OpsSurface eyebrow="Operations" title="Jobs linked through supplier bills" description="Only shipments connected through this Partner ID are shown. Name-only legacy bill matches are deliberately excluded from operational job history.">
            {snapshot.jobs.length ? <div className="divide-y divide-[var(--admin-line)]">{snapshot.jobs.slice(0, 20).map((job) => <div key={job.reference} className="grid gap-3 py-4 md:grid-cols-[1fr_1.2fr_.8fr_auto] md:items-center"><div><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="font-semibold text-[var(--admin-ink)] hover:underline"><OpsMono>{job.reference}</OpsMono></Link><p className="mt-1.5 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{job.primary_branch || "Branch needs repair"}{job.handling_branches.length ? ` · ${job.handling_branches.join(", ")}` : ""}</p></div><div><strong className="text-[11px] text-[var(--admin-ink)]">{job.origin || "Origin not recorded"} → {job.destination || "Destination not recorded"}</strong><p className="mt-1.5 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{job.mode || "Mode not recorded"}{job.current_location ? ` · ${job.current_location}` : ""}</p></div><div><span className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">ETA {job.eta ? dateOnly(job.eta) : "not set"}</span><p className="mt-1.5 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Updated {dateTime(job.updated_at)}</p></div><OpsBadge tone={statusTone(job.status)}>{shipmentStatusLabels[job.status]}</OpsBadge></div>)}</div> : <OpsEmptyState icon={<Ship size={18}/>} title="No confirmed linked jobs" description="Operational jobs appear here when a supplier bill carries this Partner ID and the shipment is inside your branch access."/>}
          </OpsSurface>

          <OpsSurface eyebrow="Relationship trail" title="Partner activity" description="Network changes and, for authorised Finance roles, supplier bill lifecycle events.">
            {snapshot.activity.length ? <div className="divide-y divide-[var(--admin-line)]">{snapshot.activity.slice(0, 30).map((item) => <article key={item.id} className="py-3.5"><div className="flex items-start gap-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--admin-crimson)]"/><div className="min-w-0"><strong className="text-[11px] text-[var(--admin-ink)]">{item.title}</strong>{item.detail ? <p className="mt-1.5 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{item.detail}</p> : null}<p className="mt-1.5 text-[length:var(--app-label-size)] text-[var(--admin-faint)]">{dateTime(item.created_at)} NPT{item.actor_name || item.actor_email ? ` · ${item.actor_name || item.actor_email}` : ""}</p></div></div></article>)}</div> : <OpsEmptyState title="No partner activity yet" description="Partner updates and linked financial lifecycle events will build this relationship trail over time."/>}
          </OpsSurface>
        </div>

        <aside className="ops-stack xl:sticky xl:top-[76px]">
          <OpsSurface eyebrow="Relationship" title="Primary contact">
            <div className="space-y-3"><Fact label="Contact" value={partner.primary_contact_name || "Not recorded"}/>{partner.primary_email ? <ContactLink icon={<Mail size={12}/>} href={`mailto:${partner.primary_email}`} label={partner.primary_email}/> : null}{partner.primary_phone ? <ContactLink icon={<Phone size={12}/>} href={`tel:${partner.primary_phone}`} label={partner.primary_phone}/> : null}{partner.whatsapp && whatsappHref(partner.whatsapp) ? <ContactLink icon={<MessageCircle size={12}/>} href={whatsappHref(partner.whatsapp)} label={`WhatsApp · ${partner.whatsapp}`} external/> : null}{partner.website ? <ContactLink icon={<Globe2 size={12}/>} href={partner.website} label="Website" external/> : null}</div>
          </OpsSurface>

          {commercialVisible ? <OpsSurface eyebrow="Commercial" title={`${partner.preferred_currency} relationship`} description="Commercial terms are visible only to authorised KCPL roles."><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><Fact label="Payment terms" value={`${partner.payment_terms_days} days`}/><Fact label="Preferred status" value={partner.preferred ? "Preferred partner" : "Standard partner"}/></div>{partner.commercial_terms ? <p className="mt-4 border-t border-[var(--admin-line)] pt-4 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{partner.commercial_terms}</p> : null}</OpsSurface> : null}

          <OpsSurface eyebrow="Compliance" title="Registration & contract">
            {expiryAttention ? <div className={`mb-4 rounded-[var(--app-radius)] border p-3 ${expiryDays !== null && expiryDays < 0 ? "border-[var(--admin-danger-line)] bg-[var(--admin-danger-bg)]" : "border-[var(--admin-warning-line)] bg-[var(--admin-warning-bg)]"}`}><strong className={`text-[length:var(--app-label-size)] ${expiryDays !== null && expiryDays < 0 ? "text-[var(--admin-danger)]" : "text-[var(--admin-warning)]"}`}>{expiryDays !== null && expiryDays < 0 ? `Contract expired ${Math.abs(expiryDays)} day${Math.abs(expiryDays) === 1 ? "" : "s"} ago` : `Contract expires in ${expiryDays} day${expiryDays === 1 ? "" : "s"}`}</strong></div> : null}
            <div className="grid gap-4"><Fact label="Registration number" value={partner.registration_number || "Not recorded"}/><Fact label="Tax / VAT ID" value={partner.tax_id || "Not recorded"}/><Fact label="Contract reference" value={partner.contract_reference || "Not recorded"}/><Fact label="Contract expiry" value={dateOnly(partner.contract_expiry_date)}/></div>
            {partner.document_url ? <a href={partner.document_url} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 border-t border-[var(--admin-line)] pt-4 text-[length:var(--app-label-size)] font-semibold text-[var(--admin-crimson)] hover:underline"><ExternalLink size={11}/>Open contract / document</a> : null}
          </OpsSurface>

          {partner.internal_notes ? <OpsSurface eyebrow="Internal" title="Partner notes"><p className="whitespace-pre-wrap text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{partner.internal_notes}</p></OpsSurface> : null}
        </aside>
      </div>

      {financialVisible ? <PartnerFinance summaries={snapshot.finance_summaries} bills={snapshot.bills}/> : null}
    </div>
  </OpsPage>;
}

function PartnerFinance({ summaries, bills }: { summaries: PartnerFinanceSummary[]; bills: Partner360Snapshot["bills"] }) {
  return <div className="ops-stack">
    <div><p className="ops-eyebrow">Accounts Payable</p><h2 className="mt-1 text-[18px] font-[720] tracking-[-.025em] text-[var(--admin-ink)]">Supplier exposure</h2><p className="mt-1 max-w-3xl text-[11px] leading-5 text-[var(--admin-muted)]">Each currency stands alone. KCPL does not convert or combine supplier exposure using invented exchange rates.</p></div>
    {summaries.length ? <div className="grid gap-3 xl:grid-cols-2">{summaries.map((summary) => <OpsSurface key={summary.currency} eyebrow={`${summary.currency} supplier account`} title={`${money(summary.outstanding, summary.currency)} outstanding`} description={`${summary.open_bill_count} open · ${summary.overdue_bill_count} overdue`}><div className="grid grid-cols-2 gap-3"><FinanceFact label="Billed" value={money(summary.billed, summary.currency)}/><FinanceFact label="Paid" value={money(summary.paid, summary.currency)}/><FinanceFact label="Outstanding" value={money(summary.outstanding, summary.currency)}/><FinanceFact label="Overdue" value={money(summary.overdue, summary.currency)} danger={summary.overdue > 0}/></div></OpsSurface>)}</div> : <OpsEmptyState icon={<WalletCards size={18}/>} title="No confirmed payable exposure" description="Approved, paid and open supplier bills linked to this Partner ID will appear here by currency."/>}
    <OpsSurface eyebrow="Supplier ledger" title="Bills linked to this partner" description={`${bills.length} visible bills, including explicitly flagged legacy name matches.`} flush>
      {bills.length ? <div className="ops-table-wrap"><table className="ops-table min-w-[1080px]"><thead><tr><th>Bill</th><th>Supplier reference</th><th>Job / branch</th><th>Date / due</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead><tbody>{bills.map((bill) => <tr key={bill.reference}><td><Link href={`/admin/payables/bills/${encodeURIComponent(bill.reference)}`}><OpsMono>{bill.reference}</OpsMono></Link>{bill.legacy_name_link ? <div className="mt-1.5"><OpsBadge tone="warning">Legacy name link</OpsBadge></div> : null}</td><td>{bill.supplier_bill_reference || "Not recorded"}<p className="mt-1.5 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{bill.description}</p></td><td>{bill.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(bill.shipment_reference)}`} className="hover:underline"><OpsMono>{bill.shipment_reference}</OpsMono></Link> : "General payable"}<p className="mt-1.5 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{bill.branch || "Branch needs repair"}</p></td><td>{dateOnly(bill.bill_date)}<p className="mt-1.5 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Due {dateOnly(bill.due_date)}</p></td><td className="font-semibold">{money(bill.total, bill.currency)}</td><td className="font-semibold">{money(bill.balance_due, bill.currency)}</td><td><OpsBadge tone={statusTone(bill.status)}>{payableStatusLabels[bill.status]}</OpsBadge></td></tr>)}</tbody></table></div> : <OpsEmptyState title="No supplier bills" description="Create a supplier bill from this Partner record to establish a confirmed financial link."/>}
    </OpsSurface>
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.06em] text-[var(--admin-muted)]">{label}</p><p className="mt-1.5 text-[11px] leading-5 text-[var(--admin-ink)]">{value}</p></div>; }
function FinanceFact({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className="rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.06em] text-[var(--admin-muted)]">{label}</p><strong className={`mt-1.5 block text-[12px] ${danger ? "text-[var(--admin-danger)]" : "text-[var(--admin-ink)]"}`}>{value}</strong></div>; }
function ContactLink({ icon, href, label, external = false }: { icon: React.ReactNode; href: string; label: string; external?: boolean }) { return <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} className="flex items-center gap-2 text-[11px] text-[var(--admin-muted)] hover:text-[var(--admin-crimson)] hover:underline">{icon}<span className="min-w-0 truncate">{label}</span>{external ? <ExternalLink size={9}/> : null}</a>; }
