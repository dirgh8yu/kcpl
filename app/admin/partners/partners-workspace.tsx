/* eslint-disable react/no-unknown-property */
"use client";

import {
  BadgeCheck,
  Building2,
  CircleDollarSign,
  FileText,
  Globe2,
  Handshake,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Ship,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";
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

type PartnerForm = {
  id: string;
  displayName: string;
  legalName: string;
  types: PartnerType[];
  modes: PartnerMode[];
  status: PartnerStatus;
  preferred: boolean;
  country: string;
  ownerBranch: PartnerOwnerBranch;
  citiesServed: string;
  countriesServed: string;
  portsServed: string;
  primaryContactName: string;
  primaryEmail: string;
  primaryPhone: string;
  whatsapp: string;
  website: string;
  preferredCurrency: CrmCurrency;
  paymentTermsDays: string;
  serviceRating: string;
  registrationNumber: string;
  taxId: string;
  contractReference: string;
  contractExpiryDate: string;
  documentUrl: string;
  commercialTerms: string;
  internalNotes: string;
  tags: string;
};

function emptyForm(): PartnerForm {
  return {
    id: "",
    displayName: "",
    legalName: "",
    types: ["overseas_counterpart"],
    modes: [],
    status: "active",
    preferred: false,
    country: "Nepal",
    ownerBranch: "Global",
    citiesServed: "",
    countriesServed: "",
    portsServed: "",
    primaryContactName: "",
    primaryEmail: "",
    primaryPhone: "",
    whatsapp: "",
    website: "",
    preferredCurrency: "USD",
    paymentTermsDays: "30",
    serviceRating: "",
    registrationNumber: "",
    taxId: "",
    contractReference: "",
    contractExpiryDate: "",
    documentUrl: "",
    commercialTerms: "",
    internalNotes: "",
    tags: "",
  };
}

function formFromPartner(partner: PartnerRecord): PartnerForm {
  return {
    id: partner.id,
    displayName: partner.display_name,
    legalName: partner.legal_name ?? "",
    types: partner.types,
    modes: partner.modes,
    status: partner.status,
    preferred: partner.preferred,
    country: partner.country,
    ownerBranch: partner.owner_branch,
    citiesServed: partner.cities_served.join(", "),
    countriesServed: partner.countries_served.join(", "),
    portsServed: partner.ports_served.join(", "),
    primaryContactName: partner.primary_contact_name ?? "",
    primaryEmail: partner.primary_email ?? "",
    primaryPhone: partner.primary_phone ?? "",
    whatsapp: partner.whatsapp ?? "",
    website: partner.website ?? "",
    preferredCurrency: partner.preferred_currency,
    paymentTermsDays: String(partner.payment_terms_days),
    serviceRating: partner.service_rating ? String(partner.service_rating) : "",
    registrationNumber: partner.registration_number ?? "",
    taxId: partner.tax_id ?? "",
    contractReference: partner.contract_reference ?? "",
    contractExpiryDate: partner.contract_expiry_date ?? "",
    documentUrl: partner.document_url ?? "",
    commercialTerms: partner.commercial_terms ?? "",
    internalNotes: partner.internal_notes ?? "",
    tags: partner.tags.join(", "),
  };
}

function csv(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function dateLabel(value: string | null) {
  if (!value) return "No activity";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function statusClass(status: PartnerStatus) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "on_hold") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

export function PartnersWorkspace({ dashboard, canEdit }: { dashboard: PartnerDashboard; canEdit: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PartnerType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PartnerStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PartnerForm>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dashboard.partners.filter((partner) => {
      if (typeFilter !== "all" && !partner.types.includes(typeFilter)) return false;
      if (statusFilter !== "all" && partner.status !== statusFilter) return false;
      if (!needle) return true;
      return [
        partner.id,
        partner.display_name,
        partner.legal_name ?? "",
        partner.country,
        partner.owner_branch,
        partner.primary_contact_name ?? "",
        partner.primary_email ?? "",
        partner.ports_served.join(" "),
        partner.countries_served.join(" "),
        partner.tags.join(" "),
      ].join(" ").toLowerCase().includes(needle);
    });
  }, [dashboard.partners, query, typeFilter, statusFilter]);

  function startCreate() {
    setForm(emptyForm());
    setNotice("");
    setFormOpen(true);
  }

  function startEdit(partner: PartnerRecord) {
    setForm(formFromPartner(partner));
    setNotice("");
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleType(value: PartnerType) {
    setForm((current) => ({ ...current, types: current.types.includes(value) ? current.types.filter((item) => item !== value) : [...current.types, value] }));
  }

  function toggleMode(value: PartnerMode) {
    setForm((current) => ({ ...current, modes: current.modes.includes(value) ? current.modes.filter((item) => item !== value) : [...current.modes, value] }));
  }

  async function savePartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const payload = {
      ...form,
      citiesServed: csv(form.citiesServed),
      countriesServed: csv(form.countriesServed),
      portsServed: csv(form.portsServed),
      tags: csv(form.tags),
      paymentTermsDays: Number(form.paymentTermsDays || 0),
      serviceRating: form.serviceRating ? Number(form.serviceRating) : null,
    };
    try {
      const response = await fetch(form.id ? `/api/admin/partners/${encodeURIComponent(form.id)}` : "/api/admin/partners", {
        method: form.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Partner record could not be saved.");
      setNotice(form.id ? "Partner record updated." : "Partner added to the KCPL network.");
      setForm(emptyForm());
      setFormOpen(false);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Partner record could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#f5f6f7] text-[#10263f]">
    <header className="border-b border-[#dfe3e8] bg-white px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9a763b]">KCPL Global Network</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-.045em]">Partners & Vendors</h1>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[#68747f]">Counterparts, carriers, agents, transporters, warehouses and suppliers in one operational register, tied to live supplier exposure.</p>
        </div>
        {canEdit ? <button type="button" onClick={startCreate} className="flex items-center gap-2 rounded-lg bg-[#10263f] px-4 py-2.5 text-xs font-black text-white"><Plus size={15}/>New partner</button> : <span className="rounded-full border border-[#dfe3e8] bg-[#f8f9fa] px-3 py-2 text-[10px] font-black text-[#68747f]">Read-only access</span>}
      </div>
    </header>

    <section className="bg-[#0a1828] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-2 md:grid-cols-5">
        <Metric label="Active network" value={String(dashboard.active_count)} icon={<Handshake size={15}/>}/>
        <Metric label="Preferred" value={String(dashboard.preferred_count)} icon={<BadgeCheck size={15}/>}/>
        <Metric label="Countries" value={String(dashboard.country_count)} icon={<Globe2 size={15}/>}/>
        <Metric label="Unlinked supplier bills" value={String(dashboard.unlinked_supplier_bills)} icon={<TriangleAlert size={15}/>} danger={dashboard.unlinked_supplier_bills > 0}/>
        <Metric label="Partner records" value={String(dashboard.partners.length)} icon={<Building2 size={15}/>}/>
      </div>
    </section>

    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
      {notice ? <div className="rounded-xl border border-[#d9c28f] bg-[#fff8e8] px-4 py-3 text-sm font-bold text-[#76591f]">{notice}</div> : null}

      {formOpen && canEdit ? <section className="rounded-2xl border border-[#dfe3e8] bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#9a763b]">Network record</p><h2 className="mt-1 text-xl font-black">{form.id ? `Edit ${form.displayName}` : "Add partner or vendor"}</h2><p className="mt-1 text-xs text-[#7a858f]">Commercial, geographic and contact data stays internal to KCPL Operations.</p></div><button type="button" onClick={() => setFormOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#dfe3e8] text-[#68747f]"><X size={15}/></button></div>
        <form onSubmit={savePartner} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Partner / vendor name"><input required className="partner-input" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Organisation name"/></Field>
          <Field label="Legal name"><input className="partner-input" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })}/></Field>
          <Field label="Status"><select className="partner-input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PartnerStatus })}>{partnerStatuses.map((status) => <option key={status} value={status}>{partnerStatusLabels[status]}</option>)}</select></Field>
          <Field label="KCPL owner"><select className="partner-input" value={form.ownerBranch} onChange={(event) => setForm({ ...form, ownerBranch: event.target.value as PartnerOwnerBranch })}><option>Global</option>{kcplBranches.map((branch) => <option key={branch}>{branch}</option>)}</select></Field>

          <div className="md:col-span-2 xl:col-span-4"><Field label="Relationship types"><div className="flex flex-wrap gap-2">{partnerTypes.map((type) => <Toggle key={type} active={form.types.includes(type)} onClick={() => toggleType(type)}>{partnerTypeLabels[type]}</Toggle>)}</div></Field></div>
          <div className="md:col-span-2 xl:col-span-4"><Field label="Services / modes"><div className="flex flex-wrap gap-2">{partnerModes.map((mode) => <Toggle key={mode} active={form.modes.includes(mode)} onClick={() => toggleMode(mode)}>{partnerModeLabels[mode]}</Toggle>)}</div></Field></div>

          <Field label="Base country"><input required className="partner-input" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })}/></Field>
          <Field label="Countries served"><input className="partner-input" value={form.countriesServed} onChange={(event) => setForm({ ...form, countriesServed: event.target.value })} placeholder="India, China, Singapore"/></Field>
          <Field label="Cities served"><input className="partner-input" value={form.citiesServed} onChange={(event) => setForm({ ...form, citiesServed: event.target.value })} placeholder="Kolkata, Delhi, Shanghai"/></Field>
          <Field label="Ports / airports"><input className="partner-input" value={form.portsServed} onChange={(event) => setForm({ ...form, portsServed: event.target.value })} placeholder="CCU, DEL, Kolkata Port"/></Field>

          <Field label="Primary contact"><input className="partner-input" value={form.primaryContactName} onChange={(event) => setForm({ ...form, primaryContactName: event.target.value })}/></Field>
          <Field label="Email"><input type="email" className="partner-input" value={form.primaryEmail} onChange={(event) => setForm({ ...form, primaryEmail: event.target.value })}/></Field>
          <Field label="Phone"><input className="partner-input" value={form.primaryPhone} onChange={(event) => setForm({ ...form, primaryPhone: event.target.value })}/></Field>
          <Field label="WhatsApp"><input className="partner-input" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}/></Field>
          <Field label="Website"><input className="partner-input" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://..."/></Field>
          <Field label="Preferred currency"><select className="partner-input" value={form.preferredCurrency} onChange={(event) => setForm({ ...form, preferredCurrency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
          <Field label="Payment terms (days)"><input min="0" max="3650" type="number" className="partner-input" value={form.paymentTermsDays} onChange={(event) => setForm({ ...form, paymentTermsDays: event.target.value })}/></Field>
          <Field label="Service rating"><select className="partner-input" value={form.serviceRating} onChange={(event) => setForm({ ...form, serviceRating: event.target.value })}><option value="">Not rated</option>{[1,2,3,4,5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></Field>

          <Field label="Registration number"><input className="partner-input" value={form.registrationNumber} onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })}/></Field>
          <Field label="Tax / VAT ID"><input className="partner-input" value={form.taxId} onChange={(event) => setForm({ ...form, taxId: event.target.value })}/></Field>
          <Field label="Contract reference"><input className="partner-input" value={form.contractReference} onChange={(event) => setForm({ ...form, contractReference: event.target.value })}/></Field>
          <Field label="Contract expiry"><input type="date" className="partner-input" value={form.contractExpiryDate} onChange={(event) => setForm({ ...form, contractExpiryDate: event.target.value })}/></Field>
          <div className="md:col-span-2"><Field label="Contract / document URL"><input className="partner-input" value={form.documentUrl} onChange={(event) => setForm({ ...form, documentUrl: event.target.value })} placeholder="https://..."/></Field></div>
          <div className="md:col-span-2"><Field label="Tags"><input className="partner-input" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="priority, cross-border, pharma"/></Field></div>
          <div className="md:col-span-2"><Field label="Commercial terms / negotiated arrangements"><textarea className="partner-input min-h-24 resize-y" value={form.commercialTerms} onChange={(event) => setForm({ ...form, commercialTerms: event.target.value })}/></Field></div>
          <div className="md:col-span-2"><Field label="Internal notes"><textarea className="partner-input min-h-24 resize-y" value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })}/></Field></div>
          <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.preferred} onChange={(event) => setForm({ ...form, preferred: event.target.checked })}/>Preferred KCPL partner</label><button disabled={busy || !form.types.length} className="rounded-lg bg-[#10263f] px-5 py-3 text-xs font-black text-white disabled:opacity-50">{busy ? "Saving…" : form.id ? "Save partner changes" : "Add to partner network"}</button></div>
        </form>
      </section> : null}

      {dashboard.open_payables.length ? <section className="rounded-2xl border border-[#dfe3e8] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#9a763b]">Working capital</p><h2 className="mt-1 text-lg font-black">Open AP linked to partner records</h2></div><div className="flex flex-wrap gap-2">{dashboard.open_payables.map((item) => <span key={item.currency} className="rounded-lg border border-[#dfe3e8] bg-[#f8f9fa] px-3 py-2 text-xs font-black"><CircleDollarSign size={12} className="mr-1 inline"/>{money(item.amount, item.currency)}</span>)}</div></div></section> : null}

      <section className="rounded-2xl border border-[#dfe3e8] bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e7eaed] p-5">
          <div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#9a763b]">Network register</p><h2 className="mt-1 text-xl font-black">Global counterpart & supplier directory</h2><p className="mt-1 text-xs text-[#7a858f]">{filtered.length} of {dashboard.partners.length} records shown.</p></div>
          <div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border border-[#dfe3e8] bg-[#f8f9fa] px-3"><Search size={13} className="text-[#8a949e]"/><input className="bg-transparent py-2.5 text-xs outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search network…"/></label><select className="rounded-lg border border-[#dfe3e8] bg-[#f8f9fa] px-3 py-2.5 text-xs font-bold" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | PartnerType)}><option value="all">All types</option>{partnerTypes.map((type) => <option key={type} value={type}>{partnerTypeLabels[type]}</option>)}</select><select className="rounded-lg border border-[#dfe3e8] bg-[#f8f9fa] px-3 py-2.5 text-xs font-bold" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | PartnerStatus)}><option value="all">All statuses</option>{partnerStatuses.map((status) => <option key={status} value={status}>{partnerStatusLabels[status]}</option>)}</select></div>
        </div>
        <div className="overflow-x-auto"><table className="min-w-[1250px] w-full text-left text-xs"><thead className="bg-[#f8f9fa] text-[9px] font-black uppercase tracking-[.1em] text-[#8a949e]"><tr><th className="px-5 py-3">Partner</th><th className="px-3 py-3">Coverage</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Commercial</th><th className="px-3 py-3">AP exposure</th><th className="px-3 py-3">Activity</th><th className="px-3 py-3">Status</th><th className="px-3 py-3"></th></tr></thead><tbody className="divide-y divide-[#e7eaed]">{filtered.length ? filtered.map((partner) => <tr key={partner.id} className="align-top hover:bg-[#fbfcfc]"><td className="px-5 py-4"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eef2f5] text-[#10263f]"><Building2 size={15}/></span><div><div className="flex flex-wrap items-center gap-1.5"><strong className="text-sm">{partner.display_name}</strong>{partner.preferred ? <Star size={13} className="fill-[#c89b46] text-[#c89b46]"/> : null}</div><p className="mt-1 text-[9px] text-[#8a949e]">{partner.id}</p><div className="mt-2 flex max-w-[260px] flex-wrap gap-1">{partner.types.map((type) => <span key={type} className="rounded-full bg-[#f2eee5] px-2 py-1 text-[8px] font-black text-[#84672f]">{partnerTypeLabels[type]}</span>)}</div></div></div></td><td className="px-3 py-4"><p className="flex items-center gap-1.5 font-bold"><MapPin size={12}/>{partner.country}</p><p className="mt-1 max-w-[220px] text-[9px] leading-4 text-[#7a858f]">{partner.ports_served.length ? partner.ports_served.slice(0,4).join(" · ") : partner.countries_served.length ? partner.countries_served.slice(0,4).join(" · ") : "Coverage not recorded"}</p><p className="mt-1 text-[9px] font-bold text-[#9a763b]">Owner: {partner.owner_branch}</p></td><td className="px-3 py-4"><p className="font-bold">{partner.primary_contact_name || "No contact"}</p>{partner.primary_email ? <p className="mt-1 flex items-center gap-1 text-[9px] text-[#66727e]"><Mail size={10}/>{partner.primary_email}</p> : null}{partner.primary_phone ? <p className="mt-1 flex items-center gap-1 text-[9px] text-[#66727e]"><Phone size={10}/>{partner.primary_phone}</p> : null}</td><td className="px-3 py-4"><p className="font-black">{partner.preferred_currency} · {partner.payment_terms_days}d terms</p><p className="mt-1 text-[9px] text-[#7a858f]">{partner.service_rating ? `${partner.service_rating}/5 service rating` : "Not rated"}</p>{partner.contract_reference ? <p className="mt-1 flex items-center gap-1 text-[9px] text-[#7a858f]"><FileText size={10}/>{partner.contract_reference}</p> : null}</td><td className="px-3 py-4">{partner.payable_open.length ? <div className="space-y-1">{partner.payable_open.map((item) => <p key={item.currency} className="font-black">{money(item.amount, item.currency)}</p>)}</div> : <span className="text-[#98a1aa]">No open AP</span>}<p className={`mt-1 text-[9px] ${partner.overdue_bill_count ? "font-black text-rose-600" : "text-[#8a949e]"}`}>{partner.overdue_bill_count} overdue · {partner.bill_count} bills</p></td><td className="px-3 py-4"><p className="font-black">{partner.shipment_count} linked jobs</p><p className="mt-1 text-[9px] text-[#8a949e]">{dateLabel(partner.last_activity_at)}</p><div className="mt-2 flex flex-wrap gap-1">{partner.modes.slice(0,4).map((mode) => <span key={mode} className="rounded bg-[#eef2f5] px-1.5 py-1 text-[8px] font-bold">{partnerModeLabels[mode]}</span>)}</div></td><td className="px-3 py-4"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${statusClass(partner.status)}`}>{partnerStatusLabels[partner.status]}</span></td><td className="px-3 py-4">{canEdit ? <button type="button" onClick={() => startEdit(partner)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#dfe3e8] text-[#68747f] hover:bg-[#f8f9fa]" title="Edit partner"><Pencil size={13}/></button> : null}</td></tr>) : <tr><td colSpan={8} className="p-10 text-center text-[#8a949e]">No partner records match the current filters.</td></tr>}</tbody></table></div>
      </section>
    </div>
    <style jsx global>{`.partner-input{width:100%;border:1px solid #dfe3e8;border-radius:.55rem;background:#f8f9fa;padding:.72rem .8rem;font-size:.78rem;outline:none;color:#10263f}.partner-input:focus{border-color:#b89450;background:#fff}`}</style>
  </main>;
}

function Metric({ label, value, icon, danger = false }: { label: string; value: string; icon: React.ReactNode; danger?: boolean }) {
  return <div className={`rounded-xl border px-4 py-4 ${danger ? "border-rose-400/30 bg-rose-400/10" : "border-white/10 bg-white/[.045]"}`}><div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-[.12em] ${danger ? "text-rose-300" : "text-white/40"}`}>{icon}{label}</div><p className="mt-2 text-2xl font-black">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.1em] text-[#7c8791]">{label}</span>{children}</label>;
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-[9px] font-black ${active ? "border-[#10263f] bg-[#10263f] text-white" : "border-[#dfe3e8] bg-[#f8f9fa] text-[#68747f]"}`}>{children}</button>;
}
