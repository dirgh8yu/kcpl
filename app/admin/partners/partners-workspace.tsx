"use client";

import { Building2, FileText, Mail, MapPin, Pencil, Phone, Plus, Search, Star, TriangleAlert } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { crmCurrencies, kcplBranches, type CrmCurrency } from "../crm/crm-data";
import {
  partnerModeLabels,
  partnerModes,
  partnerStatusLabels,
  partnerStatuses,
  partnerTypeLabels,
  partnerTypes,
  type PartnerDashboard,
  type PartnerMode,
  type PartnerOwnerBranch,
  type PartnerRecord,
  type PartnerStatus,
  type PartnerType,
} from "./partners-data";
import { OpsButton, OpsEmptyState, OpsFilterBar, OpsMetric, OpsMetricStrip, OpsPageHeader, OpsPanel, OpsStatusBadge, OpsTableFrame } from "../operations-ui";

type PartnerForm = {
  id: string; displayName: string; legalName: string; types: PartnerType[]; modes: PartnerMode[]; status: PartnerStatus; preferred: boolean;
  country: string; ownerBranch: PartnerOwnerBranch; citiesServed: string; countriesServed: string; portsServed: string;
  primaryContactName: string; primaryEmail: string; primaryPhone: string; whatsapp: string; website: string;
  preferredCurrency: CrmCurrency; paymentTermsDays: string; serviceRating: string; registrationNumber: string; taxId: string;
  contractReference: string; contractExpiryDate: string; documentUrl: string; commercialTerms: string; internalNotes: string; tags: string;
};

function blank(): PartnerForm {
  return { id: "", displayName: "", legalName: "", types: ["overseas_counterpart"], modes: [], status: "active", preferred: false, country: "Nepal", ownerBranch: "Global", citiesServed: "", countriesServed: "", portsServed: "", primaryContactName: "", primaryEmail: "", primaryPhone: "", whatsapp: "", website: "", preferredCurrency: "USD", paymentTermsDays: "30", serviceRating: "", registrationNumber: "", taxId: "", contractReference: "", contractExpiryDate: "", documentUrl: "", commercialTerms: "", internalNotes: "", tags: "" };
}

function fromPartner(p: PartnerRecord): PartnerForm {
  return { id: p.id, displayName: p.display_name, legalName: p.legal_name ?? "", types: p.types, modes: p.modes, status: p.status, preferred: p.preferred, country: p.country, ownerBranch: p.owner_branch, citiesServed: p.cities_served.join(", "), countriesServed: p.countries_served.join(", "), portsServed: p.ports_served.join(", "), primaryContactName: p.primary_contact_name ?? "", primaryEmail: p.primary_email ?? "", primaryPhone: p.primary_phone ?? "", whatsapp: p.whatsapp ?? "", website: p.website ?? "", preferredCurrency: p.preferred_currency, paymentTermsDays: String(p.payment_terms_days), serviceRating: p.service_rating ? String(p.service_rating) : "", registrationNumber: p.registration_number ?? "", taxId: p.tax_id ?? "", contractReference: p.contract_reference ?? "", contractExpiryDate: p.contract_expiry_date ?? "", documentUrl: p.document_url ?? "", commercialTerms: p.commercial_terms ?? "", internalNotes: p.internal_notes ?? "", tags: p.tags.join(", ") };
}

function csv(value: string) { return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]; }
function money(amount: number, currency: string) { try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount.toLocaleString("en-AU")}`; } }
function dateLabel(value: string | null) { if (!value) return "No activity"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
function statusTone(status: PartnerStatus): "neutral" | "success" | "warning" { return status === "active" ? "success" : status === "on_hold" ? "warning" : "neutral"; }

export function PartnersWorkspace({ dashboard, canEdit }: { dashboard: PartnerDashboard; canEdit: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PartnerType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PartnerStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PartnerForm>(blank());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dashboard.partners.filter((p) => {
      if (typeFilter !== "all" && !p.types.includes(typeFilter)) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!needle) return true;
      return [p.id, p.display_name, p.legal_name ?? "", p.country, p.owner_branch, p.primary_contact_name ?? "", p.primary_email ?? "", p.ports_served.join(" "), p.countries_served.join(" "), p.tags.join(" ")].join(" ").toLowerCase().includes(needle);
    });
  }, [dashboard.partners, query, typeFilter, statusFilter]);

  function startCreate() { setForm(blank()); setNotice(""); setFormOpen(true); }
  function startEdit(p: PartnerRecord) { setForm(fromPartner(p)); setNotice(""); setFormOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function toggleType(value: PartnerType) { setForm((current) => ({ ...current, types: current.types.includes(value) ? current.types.filter((item) => item !== value) : [...current.types, value] })); }
  function toggleMode(value: PartnerMode) { setForm((current) => ({ ...current, modes: current.modes.includes(value) ? current.modes.filter((item) => item !== value) : [...current.modes, value] })); }

  async function savePartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const payload = { ...form, citiesServed: csv(form.citiesServed), countriesServed: csv(form.countriesServed), portsServed: csv(form.portsServed), tags: csv(form.tags), paymentTermsDays: Number(form.paymentTermsDays || 0), serviceRating: form.serviceRating ? Number(form.serviceRating) : null };
    try {
      const response = await fetch(form.id ? `/api/admin/partners/${encodeURIComponent(form.id)}` : "/api/admin/partners", { method: form.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Partner record could not be saved.");
      setNotice(form.id ? "Partner record updated." : "Partner added to the KCPL network.");
      setForm(blank());
      setFormOpen(false);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Partner record could not be saved.");
    } finally { setBusy(false); }
  }

  return <main>
    <OpsPageHeader eyebrow="Network" title="Partners & Vendors" description="Counterparts, carriers, agents, transporters, warehouses and suppliers in one operational register tied to supplier exposure." breadcrumbs={[{ label: "Commercial" }, { label: "Partners" }]} actions={canEdit ? <OpsButton tone="primary" onClick={startCreate}><Plus size={13}/>New partner</OpsButton> : <OpsStatusBadge>Read-only access</OpsStatusBadge>}/>

    <div className="ops-page-body ops-stack">
      <OpsMetricStrip columns={5}>
        <OpsMetric label="Active network" value={dashboard.active_count} icon={<Building2 size={13}/>} tone="success"/>
        <OpsMetric label="Preferred" value={dashboard.preferred_count} icon={<Star size={13}/>}/>
        <OpsMetric label="Countries" value={dashboard.country_count} icon={<MapPin size={13}/>}/>
        <OpsMetric label="Unlinked supplier bills" value={dashboard.unlinked_supplier_bills} icon={<TriangleAlert size={13}/>} tone={dashboard.unlinked_supplier_bills ? "warning" : "success"}/>
        <OpsMetric label="Partner records" value={dashboard.partners.length}/>
      </OpsMetricStrip>

      {notice ? <div className="rounded-lg border border-[#e2e5e8] bg-white px-3.5 py-2.5 text-[11px] text-[#59616a]">{notice}</div> : null}

      {formOpen && canEdit ? <PartnerEditor form={form} setForm={setForm} toggleType={toggleType} toggleMode={toggleMode} busy={busy} onSubmit={savePartner} onCancel={() => setFormOpen(false)}/> : null}

      {dashboard.open_payables.length ? <OpsPanel title="Open AP linked to partner records" eyebrow="Working capital" description="Current supplier exposure already linked to a partner/vendor record."><div className="flex flex-wrap gap-2 p-4">{dashboard.open_payables.map((item) => <div key={item.currency} className="rounded-lg border border-[#e2e5e8] bg-[#fafafa] px-3 py-2"><p className="text-[9px] text-[#8c939b]">{item.currency}</p><p className="mt-0.5 text-xs font-semibold text-[#414850]">{money(item.amount, item.currency)}</p></div>)}</div></OpsPanel> : null}

      <OpsTableFrame toolbar={<OpsFilterBar count={<span>{filtered.length} of {dashboard.partners.length}</span>} reset={query || typeFilter !== "all" || statusFilter !== "all" ? <button type="button" onClick={() => { setQuery(""); setTypeFilter("all"); setStatusFilter("all"); }} className="font-medium text-[#5367a8]">Clear filters</button> : null}><label className="ops-search-field"><Search size={13} className="text-[#8b9299]"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search network, location or contact"/></label><label className="ops-filter-control"><span className="text-[10px]">Type</span><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | PartnerType)}><option value="all">All</option>{partnerTypes.map((t) => <option key={t} value={t}>{partnerTypeLabels[t]}</option>)}</select></label><label className="ops-filter-control"><span className="text-[10px]">Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | PartnerStatus)}><option value="all">All</option>{partnerStatuses.map((s) => <option key={s} value={s}>{partnerStatusLabels[s]}</option>)}</select></label></OpsFilterBar>} footer={<span>Supplier/AP exposure is derived from the existing Payables ledger. It is not a duplicate financial ledger.</span>}>
        {filtered.length ? <table className="ops-dense-table min-w-[1200px]"><thead><tr><th className="px-4 text-left">Partner</th><th className="px-3 text-left">Coverage</th><th className="px-3 text-left">Contact</th><th className="px-3 text-left">Commercial</th><th className="px-3 text-left">AP exposure</th><th className="px-3 text-left">Activity</th><th className="px-3 text-left">Status</th><th className="px-4"></th></tr></thead><tbody>{filtered.map((p) => <tr key={p.id} className="align-top"><td className="px-4"><div className="flex items-start gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#e2e5e8] bg-[#fafafa] text-[#7b838c]"><Building2 size={12}/></span><div className="min-w-0"><div className="flex items-center gap-1.5"><strong className="max-w-[210px] truncate font-medium text-[#30363d]">{p.display_name}</strong>{p.preferred ? <Star size={11} className="fill-[#8b78bd] text-[#8b78bd]"/> : null}</div><p className="mt-0.5 text-[9px] text-[#989fa6]">{p.id}</p><div className="mt-1.5 flex max-w-[240px] flex-wrap gap-1">{p.types.slice(0,3).map((t) => <OpsStatusBadge key={t}>{partnerTypeLabels[t]}</OpsStatusBadge>)}</div></div></div></td><td className="px-3"><p className="flex items-center gap-1.5 font-medium"><MapPin size={11}/>{p.country}</p><p className="mt-1 max-w-[210px] text-[9px] leading-4 text-[#858c94]">{p.ports_served.length ? p.ports_served.slice(0,4).join(" · ") : p.countries_served.length ? p.countries_served.slice(0,4).join(" · ") : "Coverage not recorded"}</p><p className="mt-1 text-[9px] text-[#6c75a6]">Owner: {p.owner_branch}</p></td><td className="px-3"><p className="font-medium">{p.primary_contact_name || "No contact"}</p>{p.primary_email ? <p className="mt-1 flex items-center gap-1 text-[9px]"><Mail size={9}/>{p.primary_email}</p> : null}{p.primary_phone ? <p className="mt-1 flex items-center gap-1 text-[9px]"><Phone size={9}/>{p.primary_phone}</p> : null}</td><td className="px-3"><p className="font-medium">{p.preferred_currency} · {p.payment_terms_days}d</p><p className="mt-1 text-[9px] text-[#858c94]">{p.service_rating ? `${p.service_rating}/5 service rating` : "Not rated"}</p>{p.contract_reference ? <p className="mt-1 flex items-center gap-1 text-[9px]"><FileText size={9}/>{p.contract_reference}</p> : null}</td><td className="px-3">{p.payable_open.length ? p.payable_open.map((item) => <p key={item.currency} className="font-medium">{money(item.amount, item.currency)}</p>) : <span className="text-[#98a1aa]">No open AP</span>}<p className={`mt-1 text-[9px] ${p.overdue_bill_count ? "font-semibold text-[#9a4d55]" : "text-[#8a949e]"}`}>{p.overdue_bill_count} overdue · {p.bill_count} bills</p></td><td className="px-3"><p className="font-medium">{p.shipment_count} linked jobs</p><p className="mt-1 text-[9px] text-[#8a949e]">{dateLabel(p.last_activity_at)}</p><div className="mt-1.5 flex flex-wrap gap-1">{p.modes.slice(0,4).map((m) => <OpsStatusBadge key={m}>{partnerModeLabels[m]}</OpsStatusBadge>)}</div></td><td className="px-3"><OpsStatusBadge tone={statusTone(p.status)}>{partnerStatusLabels[p.status]}</OpsStatusBadge></td><td className="px-4">{canEdit ? <OpsButton onClick={() => startEdit(p)} aria-label={`Edit ${p.display_name}`}><Pencil size={12}/></OpsButton> : null}</td></tr>)}</tbody></table> : <OpsEmptyState title="No partner records match" detail="Adjust the type, status or search filters."/>}
      </OpsTableFrame>
    </div>
  </main>;
}

function PartnerEditor({ form, setForm, toggleType, toggleMode, busy, onSubmit, onCancel }: { form: PartnerForm; setForm: (form: PartnerForm) => void; toggleType: (value: PartnerType) => void; toggleMode: (value: PartnerMode) => void; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <form onSubmit={onSubmit} className="ops-panel overflow-visible">
    <div className="ops-panel-header"><div><p className="ops-eyebrow">Network record</p><h2 className="text-sm font-semibold text-[#30363d]">{form.id ? `Edit ${form.displayName}` : "Add partner or vendor"}</h2></div><OpsButton type="button" onClick={onCancel}>Close</OpsButton></div>
    <div className="grid gap-3 p-4 xl:grid-cols-2">
      <FormSection title="Identity & ownership"><div className="grid gap-3 sm:grid-cols-2"><Field label="Partner / vendor name"><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}/></Field><Field label="Legal name"><input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })}/></Field><Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PartnerStatus })}>{partnerStatuses.map((s) => <option key={s} value={s}>{partnerStatusLabels[s]}</option>)}</select></Field><Field label="KCPL owner"><select value={form.ownerBranch} onChange={(e) => setForm({ ...form, ownerBranch: e.target.value as PartnerOwnerBranch })}><option>Global</option>{kcplBranches.map((b) => <option key={b}>{b}</option>)}</select></Field></div><ToggleField label="Relationship types">{partnerTypes.map((t) => <Toggle key={t} active={form.types.includes(t)} onClick={() => toggleType(t)}>{partnerTypeLabels[t]}</Toggle>)}</ToggleField><ToggleField label="Services / modes">{partnerModes.map((m) => <Toggle key={m} active={form.modes.includes(m)} onClick={() => toggleMode(m)}>{partnerModeLabels[m]}</Toggle>)}</ToggleField></FormSection>
      <FormSection title="Coverage"><div className="grid gap-3 sm:grid-cols-2"><Field label="Base country"><input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}/></Field><Field label="Countries served"><input value={form.countriesServed} onChange={(e) => setForm({ ...form, countriesServed: e.target.value })}/></Field><Field label="Cities served"><input value={form.citiesServed} onChange={(e) => setForm({ ...form, citiesServed: e.target.value })}/></Field><Field label="Ports / airports"><input value={form.portsServed} onChange={(e) => setForm({ ...form, portsServed: e.target.value })}/></Field></div></FormSection>
      <FormSection title="Primary contact"><div className="grid gap-3 sm:grid-cols-2"><Field label="Contact name"><input value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })}/></Field><Field label="Email"><input type="email" value={form.primaryEmail} onChange={(e) => setForm({ ...form, primaryEmail: e.target.value })}/></Field><Field label="Phone"><input value={form.primaryPhone} onChange={(e) => setForm({ ...form, primaryPhone: e.target.value })}/></Field><Field label="WhatsApp"><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}/></Field><div className="sm:col-span-2"><Field label="Website"><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}/></Field></div></div></FormSection>
      <FormSection title="Commercial & compliance"><div className="grid gap-3 sm:grid-cols-2"><Field label="Preferred currency"><select value={form.preferredCurrency} onChange={(e) => setForm({ ...form, preferredCurrency: e.target.value as CrmCurrency })}>{crmCurrencies.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Payment terms"><input min="0" max="3650" type="number" value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}/></Field><Field label="Service rating"><select value={form.serviceRating} onChange={(e) => setForm({ ...form, serviceRating: e.target.value })}><option value="">Not rated</option>{[1,2,3,4,5].map((r) => <option key={r}>{r}</option>)}</select></Field><Field label="Registration number"><input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}/></Field><Field label="Tax / VAT ID"><input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })}/></Field><Field label="Contract reference"><input value={form.contractReference} onChange={(e) => setForm({ ...form, contractReference: e.target.value })}/></Field><Field label="Contract expiry"><input type="date" value={form.contractExpiryDate} onChange={(e) => setForm({ ...form, contractExpiryDate: e.target.value })}/></Field><Field label="Document URL"><input value={form.documentUrl} onChange={(e) => setForm({ ...form, documentUrl: e.target.value })}/></Field></div></FormSection>
      <FormSection title="Internal context"><div className="grid gap-3 sm:grid-cols-2"><Field label="Tags"><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}/></Field><label className="flex items-center gap-2 self-end pb-2 text-[11px] font-medium text-[#59616a]"><input type="checkbox" checked={form.preferred} onChange={(e) => setForm({ ...form, preferred: e.target.checked })}/>Preferred KCPL partner</label><Field label="Commercial terms"><textarea rows={4} value={form.commercialTerms} onChange={(e) => setForm({ ...form, commercialTerms: e.target.value })}/></Field><Field label="Internal notes"><textarea rows={4} value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}/></Field></div></FormSection>
    </div>
    <div className="flex justify-end gap-2 border-t border-[#eceef0] bg-[#fcfcfc] px-4 py-3"><OpsButton type="button" onClick={onCancel}>Cancel</OpsButton><OpsButton tone="primary" type="submit" disabled={busy || !form.types.length}>{busy ? "Saving…" : form.id ? "Save changes" : "Add to network"}</OpsButton></div>
  </form>;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-lg border border-[#e4e6e9] bg-white p-4"><h3 className="mb-3 text-xs font-semibold text-[#343a40]">{title}</h3>{children}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span>{children}</label>; }
function ToggleField({ label, children }: { label: string; children: React.ReactNode }) { return <div className="mt-3"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span><div className="flex flex-wrap gap-1.5">{children}</div></div>; }
function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium ${active ? "border-[#dce0fa] bg-[#f1f3ff] text-[#4655a0]" : "border-[#e1e4e7] bg-white text-[#737b84]"}`}>{children}</button>; }
