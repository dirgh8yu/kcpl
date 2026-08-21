"use client";

import { BadgeCheck, Building2, Globe2, Handshake, Mail, Pencil, Phone, Plus, Star, TriangleAlert, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { crmCurrencies, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
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
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";

type PartnerForm = {
  id: string; displayName: string; legalName: string; types: PartnerType[]; modes: PartnerMode[]; status: PartnerStatus; preferred: boolean;
  country: string; ownerBranch: PartnerOwnerBranch; citiesServed: string; countriesServed: string; portsServed: string;
  primaryContactName: string; primaryEmail: string; primaryPhone: string; whatsapp: string; website: string;
  preferredCurrency: CrmCurrency; paymentTermsDays: string; serviceRating: string; registrationNumber: string; taxId: string;
  contractReference: string; contractExpiryDate: string; documentUrl: string; commercialTerms: string; internalNotes: string; tags: string;
};

function blank(ownerBranch: PartnerOwnerBranch): PartnerForm { return { id: "", displayName: "", legalName: "", types: ["overseas_counterpart"], modes: [], status: "active", preferred: false, country: "Nepal", ownerBranch, citiesServed: "", countriesServed: "", portsServed: "", primaryContactName: "", primaryEmail: "", primaryPhone: "", whatsapp: "", website: "", preferredCurrency: "USD", paymentTermsDays: "30", serviceRating: "", registrationNumber: "", taxId: "", contractReference: "", contractExpiryDate: "", documentUrl: "", commercialTerms: "", internalNotes: "", tags: "" }; }
function fromPartner(p: PartnerRecord, repairOwner: PartnerOwnerBranch): PartnerForm { return { id: p.id, displayName: p.display_name, legalName: p.legal_name ?? "", types: p.types, modes: p.modes, status: p.status, preferred: p.preferred, country: p.country, ownerBranch: p.owner_branch ?? repairOwner, citiesServed: p.cities_served.join(", "), countriesServed: p.countries_served.join(", "), portsServed: p.ports_served.join(", "), primaryContactName: p.primary_contact_name ?? "", primaryEmail: p.primary_email ?? "", primaryPhone: p.primary_phone ?? "", whatsapp: p.whatsapp ?? "", website: p.website ?? "", preferredCurrency: p.preferred_currency, paymentTermsDays: String(p.payment_terms_days), serviceRating: p.service_rating ? String(p.service_rating) : "", registrationNumber: p.registration_number ?? "", taxId: p.tax_id ?? "", contractReference: p.contract_reference ?? "", contractExpiryDate: p.contract_expiry_date ?? "", documentUrl: p.document_url ?? "", commercialTerms: p.commercial_terms ?? "", internalNotes: p.internal_notes ?? "", tags: p.tags.join(", ") }; }
function csv(value: string) { return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]; }
function money(amount: number, currency: string) { try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount.toLocaleString("en-AU")}`; } }
function dateLabel(value: string | null) { if (!value) return "No activity"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Asia/Kathmandu" }).format(date); }
function statusTone(status: PartnerStatus): "success" | "warning" | "neutral" { return status === "active" ? "success" : status === "on_hold" ? "warning" : "neutral"; }
function noticeTone(value: string): "success" | "danger" { const text = value.toLowerCase(); return ["could not", "cannot", "already", "invalid", "outside", "failed", "required"].some((token) => text.includes(token)) ? "danger" : "success"; }

function partnerSearchText(p: PartnerRecord) {
  return [
    p.id,
    p.display_name,
    p.legal_name ?? "",
    p.country,
    p.owner_branch ?? "needs owner repair",
    p.primary_contact_name ?? "",
    p.primary_email ?? "",
    p.primary_phone ?? "",
    p.whatsapp ?? "",
    p.website ?? "",
    p.registration_number ?? "",
    p.tax_id ?? "",
    p.contract_reference ?? "",
    p.cities_served.join(" "),
    p.countries_served.join(" "),
    p.ports_served.join(" "),
    p.tags.join(" "),
    p.types.map((type) => `${type} ${partnerTypeLabels[type]}`).join(" "),
    p.modes.map((mode) => `${mode} ${partnerModeLabels[mode]}`).join(" "),
    partnerStatusLabels[p.status],
    p.preferred_currency,
    p.service_rating ? `${p.service_rating} star` : "",
    p.preferred ? "preferred" : "",
  ].join(" ").toLowerCase();
}

export function PartnersWorkspace({ dashboard, canEdit, canEditGlobal, editableOwnerBranches, commercialVisible, financialVisible }: {
  dashboard: PartnerDashboard;
  canEdit: boolean;
  canEditGlobal: boolean;
  editableOwnerBranches: KcplBranch[];
  commercialVisible: boolean;
  financialVisible: boolean;
}) {
  const router = useRouter();
  const defaultOwner: PartnerOwnerBranch = canEditGlobal ? "Global" : editableOwnerBranches[0] ?? "Global";
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PartnerType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PartnerStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [form, setForm] = useState<PartnerForm>(() => blank(defaultOwner));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return dashboard.partners.filter((p) => {
      if (typeFilter !== "all" && !p.types.includes(typeFilter)) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!terms.length) return true;
      const haystack = partnerSearchText(p);
      return terms.every((term) => haystack.includes(term));
    });
  }, [dashboard.partners, query, typeFilter, statusFilter]);

  const canCreate = canEdit && (canEditGlobal || editableOwnerBranches.length > 0);
  const canEditRecord = (partner: PartnerRecord) => canEdit && (
    partner.owner_branch === "Global" ? canEditGlobal : partner.owner_branch === null ? canEditGlobal : editableOwnerBranches.includes(partner.owner_branch)
  );
  const ownerOptions: PartnerOwnerBranch[] = [
    ...(canEditGlobal ? ["Global" as const] : []),
    ...editableOwnerBranches,
  ];

  function startCreate() { setForm(blank(defaultOwner)); setNotice(""); setAdvancedOpen(false); setFormOpen(true); }
  function startEdit(p: PartnerRecord) { if (!canEditRecord(p)) return; setForm(fromPartner(p, defaultOwner)); setNotice(""); setAdvancedOpen(false); setFormOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function toggleType(value: PartnerType) { setForm((current) => ({ ...current, types: current.types.includes(value) ? current.types.filter((item) => item !== value) : [...current.types, value] })); }
  function toggleMode(value: PartnerMode) { setForm((current) => ({ ...current, modes: current.modes.includes(value) ? current.modes.filter((item) => item !== value) : [...current.modes, value] })); }

  async function savePartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const payload = { ...form, citiesServed: csv(form.citiesServed), countriesServed: csv(form.countriesServed), portsServed: csv(form.portsServed), tags: csv(form.tags), paymentTermsDays: Number(form.paymentTermsDays || 0), serviceRating: form.serviceRating ? Number(form.serviceRating) : null };
    try {
      const response = await fetch(form.id ? `/api/admin/partners/${encodeURIComponent(form.id)}` : "/api/admin/partners", { method: form.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Partner record could not be saved.");
      setNotice(form.id ? "Partner record updated." : "Partner added to the KCPL network."); setForm(blank(defaultOwner)); setFormOpen(false); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Partner record could not be saved."); }
    finally { setBusy(false); }
  }

  return <OpsPage>
    <OpsPageHeader eyebrow="Network" title="Partners & vendors" description="Counterparts, carriers, agents, transporters, warehouses and suppliers in one operational register. Finance exposure is shown only to authorised Accounts and Management roles." meta={<><span>{dashboard.partners.length} records</span><span>{dashboard.country_count} countries</span></>} actions={canCreate ? <OpsButton variant="primary" onClick={startCreate}><Plus size={13}/>New partner</OpsButton> : <OpsBadge>Read-only access</OpsBadge>}/>
    {dashboard.partners.length ? <OpsStatStrip>
      <OpsStat label="Active network" value={dashboard.active_count} icon={<Handshake size={13}/>} tone="success"/>
      <OpsStat label="Preferred" value={dashboard.preferred_count} icon={<BadgeCheck size={13}/>} tone="accent"/>
      <OpsStat label="Countries" value={dashboard.country_count} icon={<Globe2 size={13}/>} />
      {financialVisible ? <OpsStat label="Unlinked supplier bills" value={dashboard.unlinked_supplier_bills} icon={<TriangleAlert size={13}/>} tone={dashboard.unlinked_supplier_bills ? "warning" : "neutral"}/> : null}
      {financialVisible && dashboard.legacy_name_linked_bill_count ? <OpsStat label="Legacy name links" value={dashboard.legacy_name_linked_bill_count} icon={<TriangleAlert size={13}/>} tone="warning"/> : <OpsStat label="Partner records" value={dashboard.partners.length} icon={<Building2 size={13}/>} />}
    </OpsStatStrip> : null}

    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone={noticeTone(notice)} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      {formOpen && canEdit ? <OpsSurface eyebrow="Network record" title={form.id ? `Edit ${form.displayName}` : "Add partner or vendor"} description="Capture the service footprint and working contact first. Legal, contract and commercial detail can stay tucked away until needed." action={<button type="button" onClick={() => setFormOpen(false)} className="grid h-8 w-8 place-items-center rounded-[10px] text-[#9c928a] hover:bg-[#f5efea]" aria-label="Close partner form"><X size={13}/></button>}>
        <form onSubmit={savePartner} className="ops-stack">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><OpsField label="Partner / vendor name"><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}/></OpsField><OpsField label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PartnerStatus })}>{partnerStatuses.map((s) => <option key={s} value={s}>{partnerStatusLabels[s]}</option>)}</select></OpsField><OpsField label="KCPL owner"><select value={form.ownerBranch} onChange={(e) => setForm({ ...form, ownerBranch: e.target.value as PartnerOwnerBranch })}>{ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></OpsField><label className="flex items-center gap-2 self-end pb-3 text-[11px] font-semibold text-[#675e57]"><input type="checkbox" checked={form.preferred} onChange={(e) => setForm({ ...form, preferred: e.target.checked })}/>Preferred partner</label></div>
          <div><p className="mb-2 text-[11px] font-bold text-[#665c55]">Relationship types</p><div className="flex flex-wrap gap-2">{partnerTypes.map((t) => <Toggle key={t} active={form.types.includes(t)} onClick={() => toggleType(t)}>{partnerTypeLabels[t]}</Toggle>)}</div></div>
          <div><p className="mb-2 text-[11px] font-bold text-[#665c55]">Services / modes</p><div className="flex flex-wrap gap-2">{partnerModes.map((m) => <Toggle key={m} active={form.modes.includes(m)} onClick={() => toggleMode(m)}>{partnerModeLabels[m]}</Toggle>)}</div></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><OpsField label="Base country"><input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}/></OpsField><OpsField label="Countries served"><input value={form.countriesServed} onChange={(e) => setForm({ ...form, countriesServed: e.target.value })} placeholder="India, China, UAE"/></OpsField><OpsField label="Cities served"><input value={form.citiesServed} onChange={(e) => setForm({ ...form, citiesServed: e.target.value })}/></OpsField><OpsField label="Ports / airports"><input value={form.portsServed} onChange={(e) => setForm({ ...form, portsServed: e.target.value })}/></OpsField><OpsField label="Primary contact"><input value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })}/></OpsField><OpsField label="Email"><input type="email" value={form.primaryEmail} onChange={(e) => setForm({ ...form, primaryEmail: e.target.value })}/></OpsField><OpsField label="Phone"><input value={form.primaryPhone} onChange={(e) => setForm({ ...form, primaryPhone: e.target.value })}/></OpsField><OpsField label="WhatsApp"><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}/></OpsField></div>
          <button type="button" onClick={() => setAdvancedOpen(!advancedOpen)} className="flex items-center justify-between rounded-[13px] border border-[#e7dfd8] bg-[#faf7f4] px-4 py-3 text-left"><span><strong className="block text-[11px] text-[#514840]">Commercial, compliance & contract details</strong><small className="mt-1 block text-[10px] text-[#8d837b]">Optional fields that do not need to crowd everyday network work</small></span><span className="text-[10px] font-bold text-[#b66750]">{advancedOpen ? "Hide" : "Add details"}</span></button>
          {advancedOpen ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><OpsField label="Legal name"><input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })}/></OpsField><OpsField label="Website"><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}/></OpsField><OpsField label="Preferred currency"><select value={form.preferredCurrency} onChange={(e) => setForm({ ...form, preferredCurrency: e.target.value as CrmCurrency })}>{crmCurrencies.map((c) => <option key={c}>{c}</option>)}</select></OpsField><OpsField label="Payment terms"><input min="0" max="3650" type="number" value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}/></OpsField><OpsField label="Service rating"><select value={form.serviceRating} onChange={(e) => setForm({ ...form, serviceRating: e.target.value })}><option value="">Not rated</option>{[1,2,3,4,5].map((r) => <option key={r}>{r}</option>)}</select></OpsField><OpsField label="Registration number"><input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}/></OpsField><OpsField label="Tax / VAT ID"><input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })}/></OpsField><OpsField label="Contract reference"><input value={form.contractReference} onChange={(e) => setForm({ ...form, contractReference: e.target.value })}/></OpsField><OpsField label="Contract expiry"><input type="date" value={form.contractExpiryDate} onChange={(e) => setForm({ ...form, contractExpiryDate: e.target.value })}/></OpsField><OpsField label="Document URL" className="md:col-span-2"><input value={form.documentUrl} onChange={(e) => setForm({ ...form, documentUrl: e.target.value })}/></OpsField><OpsField label="Tags" className="md:col-span-2"><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}/></OpsField><OpsField label="Commercial terms" className="md:col-span-2"><textarea value={form.commercialTerms} onChange={(e) => setForm({ ...form, commercialTerms: e.target.value })}/></OpsField><OpsField label="Internal notes" className="md:col-span-2"><textarea value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}/></OpsField></div> : null}
          <div className="flex gap-2"><OpsButton variant="primary" disabled={busy}>{busy ? "Saving…" : form.id ? "Save partner" : "Create partner"}</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</OpsButton></div>
        </form>
      </OpsSurface> : null}

      {!dashboard.partners.length && !formOpen ? <OpsSurface eyebrow="Operating network" title="Build your operating network" description="Add the carriers, agents, transporters, warehouses and international counterparts KCPL works with to move freight." action={canCreate ? <OpsButton variant="primary" onClick={startCreate}><Plus size={12}/>Add first partner</OpsButton> : null}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><PartnerKind title="Carrier" detail="Shipping line, airline or trucking provider"/><PartnerKind title="Agent" detail="International freight or customs counterpart"/><PartnerKind title="Warehouse" detail="Storage, handling or consolidation facility"/><PartnerKind title="Vendor" detail="External operational supplier"/></div>
      </OpsSurface> : null}

      {dashboard.partners.length ? <OpsSurface eyebrow="Network register" title="Partners & vendors" description={`${filtered.length} of ${dashboard.partners.length} records shown. Search covers saved names, identifiers, countries, cities, ports, services, contacts and relationship types.`} flush>
        <div className="ops-toolbar"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, country, city, port, contact, ID or type"/><select className="ops-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | PartnerType)}><option value="all">All types</option>{partnerTypes.map((type) => <option key={type} value={type}>{partnerTypeLabels[type]}</option>)}</select><select className="ops-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | PartnerStatus)}><option value="all">All statuses</option>{partnerStatuses.map((status) => <option key={status} value={status}>{partnerStatusLabels[status]}</option>)}</select><OpsButton variant="ghost" size="sm" onClick={() => { setQuery(""); setTypeFilter("all"); setStatusFilter("all"); }}>Reset</OpsButton></div>
        <div className="ops-table-wrap"><table className={`ops-table ${financialVisible ? "min-w-[1280px]" : "min-w-[1080px]"}`}><thead><tr><th>Partner</th><th>Operating footprint</th><th>Services</th><th>Contact</th><th>KCPL owner</th>{financialVisible ? <th>Supplier exposure</th> : null}<th>Activity</th><th></th></tr></thead><tbody>{filtered.length ? filtered.map((p) => <tr key={p.id}><td><div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#f2ece7] text-[#8d7264]"><Building2 size={14}/></span><div><div className="flex items-center gap-1.5"><strong>{p.display_name}</strong>{p.preferred ? <Star size={11} fill="currentColor" className="text-[#c5795e]"/> : null}</div><div className="mt-1.5 flex max-w-[240px] flex-wrap gap-1"><OpsBadge tone={statusTone(p.status)}>{partnerStatusLabels[p.status]}</OpsBadge>{p.types.slice(0,3).map((type) => <OpsBadge key={type}>{partnerTypeLabels[type]}</OpsBadge>)}{p.types.length > 3 ? <OpsBadge>+{p.types.length - 3}</OpsBadge> : null}</div><p className="mt-1.5 text-[10px] text-[#948a82]">{p.id}</p></div></div></td><td><div className="min-w-[220px]"><span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4d4843]"><Globe2 size={11} className="text-[#a27b68]"/>{p.country}</span><FootprintLine label="Serves" values={p.countries_served}/><FootprintLine label="Cities" values={p.cities_served}/><FootprintLine label="Ports" values={p.ports_served}/></div></td><td><div className="flex max-w-[210px] flex-wrap gap-1">{p.modes.length ? p.modes.slice(0,5).map((mode) => <OpsBadge key={mode} tone="info">{partnerModeLabels[mode]}</OpsBadge>) : <span className="text-[10px] text-[#8d837b]">No services selected</span>}{p.modes.length > 5 ? <OpsBadge tone="info">+{p.modes.length - 5}</OpsBadge> : null}</div></td><td>{p.primary_contact_name ? <strong>{p.primary_contact_name}</strong> : <span className="text-[10px] text-[#8d837b]">No primary contact</span>}{p.primary_email ? <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[#81776f]"><Mail size={10}/>{p.primary_email}</p> : null}{p.primary_phone ? <p className="mt-1 flex items-center gap-1 text-[10px] text-[#81776f]"><Phone size={10}/>{p.primary_phone}</p> : null}{p.whatsapp ? <p className="mt-1 text-[10px] text-[#81776f]">WhatsApp · {p.whatsapp}</p> : null}</td><td>{p.owner_branch ? <strong>{p.owner_branch}</strong> : <OpsBadge tone="warning">Needs owner repair</OpsBadge>}{commercialVisible ? <p className="mt-1.5 text-[10px] text-[#8d837b]">Terms {p.payment_terms_days}d · {p.preferred_currency}</p> : <p className="mt-1.5 text-[10px] text-[#8d837b]">Commercial terms restricted</p>}</td>{financialVisible ? <td>{p.payable_open.length ? p.payable_open.map((amount) => <p key={amount.currency} className="text-[10px] font-semibold text-[#7b5e4e]">{money(amount.amount, amount.currency)} open</p>) : <span className="text-[10px] text-[#66806b]">No open payable</span>}<p className="mt-1.5 text-[10px] text-[#8d837b]">{p.bill_count} bills · {p.shipment_count} jobs</p></td> : null}<td><span className="text-[10px]">{dateLabel(p.last_activity_at)}</span>{financialVisible && p.overdue_bill_count ? <p className="mt-1.5 text-[10px] font-bold text-[#b65355]">{p.overdue_bill_count} overdue bill{p.overdue_bill_count === 1 ? "" : "s"}</p> : null}</td><td>{canEditRecord(p) ? <OpsButton variant="ghost" size="sm" onClick={() => startEdit(p)}><Pencil size={11}/>Edit</OpsButton> : p.owner_branch === null && canEdit ? <OpsBadge tone="warning">Management repair</OpsBadge> : null}</td></tr>) : <tr><td colSpan={financialVisible ? 8 : 7}><OpsEmptyState kind="search" icon={<Handshake size={18}/>} title="No partners match" description="Try a partner name, identifier, country, city, port, service, contact or relationship type, or change the filters."/></td></tr>}</tbody></table></div>
      </OpsSurface> : null}
    </div>
  </OpsPage>;
}

function FootprintLine({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return <p className="mt-1 max-w-[240px] text-[10px] leading-4 text-[#817970]"><span className="font-bold text-[#665f59]">{label}</span> · {values.join(", ")}</p>;
}

function PartnerKind({ title, detail }: { title: string; detail: string }) { return <div className="border-l-2 border-[#d8d2cc] pl-3"><strong className="text-[12px] text-[#403a36]">{title}</strong><p className="mt-1 text-[11px] leading-5 text-[#756e67]">{detail}</p></div>; }

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" className="ops-badge" data-tone={active ? "accent" : "neutral"} onClick={onClick}>{active ? <span>✓</span> : null}{children}</button>; }
