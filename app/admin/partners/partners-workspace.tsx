"use client";

import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, Handshake, Pencil, Plus, Star, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState, type RefObject } from "react";
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
import { Partner360Jump } from "./partner-360-jump";
import {
  OpsActiveFilters,
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsFact,
  OpsFacts,
  OpsField,
  OpsFilterSelect,
  OpsInspectorHeader,
  OpsInspectorNote,
  OpsInspectorSection,
  OpsKpiRail,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsRailMetric,
  OpsRegisterToolbar,
  OpsScopeTabs,
  OpsSearch,
  OpsSurface,
  OpsTableWrap,
  type OpsActiveFilter,
} from "../operations-ui";

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
function dateOnly(value: string) { const date = new Date(`${value}T00:00:00Z`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" }).format(date); }
function statusTone(status: PartnerStatus): "success" | "warning" | "neutral" { return status === "active" ? "success" : status === "on_hold" ? "warning" : "neutral"; }
function noticeTone(value: string): "success" | "danger" { const text = value.toLowerCase(); return ["could not", "cannot", "already", "invalid", "outside", "failed", "required"].some((token) => text.includes(token)) ? "danger" : "success"; }
function typesText(p: PartnerRecord) { return p.types.map((type) => partnerTypeLabels[type]).join(" · "); }
function modesText(p: PartnerRecord) { return p.modes.map((mode) => partnerModeLabels[mode]).join(" · "); }
function listOrNone(values: string[]) { return values.length ? values.join(", ") : "Not recorded"; }
function footprintLine(p: PartnerRecord) {
  return [
    p.countries_served.length ? `Serves ${p.countries_served.join(", ")}` : null,
    p.cities_served.length ? `Cities ${p.cities_served.join(", ")}` : null,
    p.ports_served.length ? `Ports ${p.ports_served.join(", ")}` : null,
  ].filter(Boolean).join(" · ");
}

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

/** Docked beside the register while there is room; mirrors the .ops-register-layout query. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1180px), (min-width: 900px) and (max-width: 1023px)";

export function PartnersWorkspace({ dashboard, canReconcile, canEdit, canEditGlobal, editableOwnerBranches, commercialVisible, financialVisible }: {
  dashboard: PartnerDashboard;
  canReconcile: boolean;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [form, setForm] = useState<PartnerForm>(() => blank(defaultOwner));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);

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

  const statusCounts = useMemo(() => Object.fromEntries(partnerStatuses.map((status) => [status, dashboard.partners.filter((p) => p.status === status).length])) as Record<PartnerStatus, number>, [dashboard.partners]);
  const selected = selectedId ? dashboard.partners.find((p) => p.id === selectedId) ?? null : null;

  const canCreate = canEdit && (canEditGlobal || editableOwnerBranches.length > 0);
  const canEditRecord = (partner: PartnerRecord) => canEdit && (
    partner.owner_branch === "Global" ? canEditGlobal : partner.owner_branch === null ? canEditGlobal : editableOwnerBranches.includes(partner.owner_branch)
  );
  const ownerOptions: PartnerOwnerBranch[] = [
    ...(canEditGlobal ? ["Global" as const] : []),
    ...editableOwnerBranches,
  ];

  // The register scrolls inside the workspace pane, so bring the form into view there.
  function revealForm() {
    window.requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      formRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  }
  function startCreate() { setForm(blank(defaultOwner)); setNotice(""); setAdvancedOpen(false); setFormOpen(true); revealForm(); }
  function startEdit(p: PartnerRecord) { if (!canEditRecord(p)) return; setForm(fromPartner(p, defaultOwner)); setNotice(""); setAdvancedOpen(false); setFormOpen(true); revealForm(); }
  function toggleType(value: PartnerType) { setForm((current) => ({ ...current, types: current.types.includes(value) ? current.types.filter((item) => item !== value) : [...current.types, value] })); }
  function toggleMode(value: PartnerMode) { setForm((current) => ({ ...current, modes: current.modes.includes(value) ? current.modes.filter((item) => item !== value) : [...current.modes, value] })); }
  function reset() { setQuery(""); setTypeFilter("all"); setStatusFilter("all"); }

  function openRow(id: string) {
    setSelectedId(id);
    // Stacked layouts put the inspector under the register; bring it into view.
    window.requestAnimationFrame(() => {
      if (window.matchMedia(SIDE_BY_SIDE_QUERY).matches) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      inspectorRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  }

  // Escape closes the inspector, as it does on the other registers.
  const hasSelection = selected !== null;
  useEffect(() => {
    if (!hasSelection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      setSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasSelection]);

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

  const total = dashboard.partners.length;
  const filtersActive = Boolean(query.trim()) || typeFilter !== "all" || statusFilter !== "all";
  const compact = selected !== null;
  const activeFilters: OpsActiveFilter[] = typeFilter !== "all" ? [{ key: "type", label: partnerTypeLabels[typeFilter], title: `Type: ${partnerTypeLabels[typeFilter]}`, onRemove: () => setTypeFilter("all") }] : [];

  return <OpsPage>
    <OpsPageHeader
      title="Partners & vendors"
      description={`Carriers, agents, transporters and suppliers · ${total} records · ${dashboard.country_count} countries`}
      meta={financialVisible ? undefined : <span>Supplier exposure is shown only to Accounts and Management roles.</span>}
      actions={<>
        <Partner360Jump partners={dashboard.partners.map((partner) => ({ id: partner.id, display_name: partner.display_name }))}/>
        {canReconcile ? <Link href="/admin/partners/reconciliation" className="ops-button" data-variant="secondary" data-size="md">Reconcile supplier bills</Link> : null}
        {canCreate ? <OpsButton variant="primary" onClick={startCreate}><Plus size={16} strokeWidth={1.75} aria-hidden="true"/>New partner</OpsButton> : <OpsBadge>Read-only access</OpsBadge>}
      </>}
    />

    <div className="px-4 pb-8 pt-4 md:px-6">
      {total ? <OpsKpiRail label="Partner network summary">
        <OpsRailMetric label="Active network" value={dashboard.active_count} active={statusFilter === "active"} onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")} title="Show active partners"/>
        <OpsRailMetric label="Preferred" value={dashboard.preferred_count}/>
        <OpsRailMetric label="Countries" value={dashboard.country_count}/>
        {financialVisible ? <OpsRailMetric label="Unlinked supplier bills" value={dashboard.unlinked_supplier_bills} tone={dashboard.unlinked_supplier_bills ? "warning" : "neutral"}/> : null}
        {financialVisible && dashboard.legacy_name_linked_bill_count ? <OpsRailMetric label="Legacy name links" value={dashboard.legacy_name_linked_bill_count} tone="warning"/> : <OpsRailMetric label="Partner records" value={total}/>}
      </OpsKpiRail> : null}

      {notice ? <div className="network-notice"><OpsNotice tone={noticeTone(notice)} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}

      {formOpen && canEdit ? <div ref={formRef} className="network-form-panel">
        <OpsSurface
          density="compact"
          title={form.id ? `Edit ${form.displayName}` : "Add partner or vendor"}
          description="Capture the service footprint and working contact first. Legal, contract and commercial detail can stay tucked away until needed."
          action={<button type="button" onClick={() => setFormOpen(false)} className="ops-inspector-close" aria-label="Close partner form"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
        >
          <form onSubmit={savePartner} className="network-form">
            <div className="ops-form-grid">
              <OpsField label="Partner / vendor name"><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}/></OpsField>
              <OpsField label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PartnerStatus })}>{partnerStatuses.map((s) => <option key={s} value={s}>{partnerStatusLabels[s]}</option>)}</select></OpsField>
              <OpsField label="KCPL owner"><select value={form.ownerBranch} onChange={(e) => setForm({ ...form, ownerBranch: e.target.value as PartnerOwnerBranch })}>{ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select></OpsField>
              <label className="network-check"><input type="checkbox" checked={form.preferred} onChange={(e) => setForm({ ...form, preferred: e.target.checked })}/>Preferred partner</label>
            </div>
            <ChoiceGroup label="Relationship types">{partnerTypes.map((t) => <Toggle key={t} active={form.types.includes(t)} onClick={() => toggleType(t)}>{partnerTypeLabels[t]}</Toggle>)}</ChoiceGroup>
            <ChoiceGroup label="Services / modes">{partnerModes.map((m) => <Toggle key={m} active={form.modes.includes(m)} onClick={() => toggleMode(m)}>{partnerModeLabels[m]}</Toggle>)}</ChoiceGroup>
            <div className="ops-form-grid">
              <OpsField label="Base country"><input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}/></OpsField>
              <OpsField label="Countries served"><input value={form.countriesServed} onChange={(e) => setForm({ ...form, countriesServed: e.target.value })} placeholder="India, China, UAE"/></OpsField>
              <OpsField label="Cities served"><input value={form.citiesServed} onChange={(e) => setForm({ ...form, citiesServed: e.target.value })}/></OpsField>
              <OpsField label="Ports / airports"><input value={form.portsServed} onChange={(e) => setForm({ ...form, portsServed: e.target.value })}/></OpsField>
              <OpsField label="Primary contact"><input value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })}/></OpsField>
              <OpsField label="Email"><input type="email" value={form.primaryEmail} onChange={(e) => setForm({ ...form, primaryEmail: e.target.value })}/></OpsField>
              <OpsField label="Phone"><input value={form.primaryPhone} onChange={(e) => setForm({ ...form, primaryPhone: e.target.value })}/></OpsField>
              <OpsField label="WhatsApp"><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}/></OpsField>
            </div>
            <button type="button" onClick={() => setAdvancedOpen(!advancedOpen)} className="ops-disclosure" aria-expanded={advancedOpen} aria-controls="partner-advanced-fields">
              <span><strong>Commercial, compliance & contract details</strong><small>Optional fields that do not need to crowd everyday network work</small></span>
              <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true"/>
            </button>
            {advancedOpen ? <div id="partner-advanced-fields" className="ops-form-grid">
              <OpsField label="Legal name"><input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })}/></OpsField>
              <OpsField label="Website"><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}/></OpsField>
              <OpsField label="Preferred currency"><select value={form.preferredCurrency} onChange={(e) => setForm({ ...form, preferredCurrency: e.target.value as CrmCurrency })}>{crmCurrencies.map((c) => <option key={c}>{c}</option>)}</select></OpsField>
              <OpsField label="Payment terms"><input min="0" max="3650" type="number" value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}/></OpsField>
              <OpsField label="Service rating"><select value={form.serviceRating} onChange={(e) => setForm({ ...form, serviceRating: e.target.value })}><option value="">Not rated</option>{[1,2,3,4,5].map((r) => <option key={r}>{r}</option>)}</select></OpsField>
              <OpsField label="Registration number"><input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}/></OpsField>
              <OpsField label="Tax / VAT ID"><input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })}/></OpsField>
              <OpsField label="Contract reference"><input value={form.contractReference} onChange={(e) => setForm({ ...form, contractReference: e.target.value })}/></OpsField>
              <OpsField label="Contract expiry"><input type="date" value={form.contractExpiryDate} onChange={(e) => setForm({ ...form, contractExpiryDate: e.target.value })}/></OpsField>
              <OpsField label="Document URL" className="ops-form-wide"><input value={form.documentUrl} onChange={(e) => setForm({ ...form, documentUrl: e.target.value })}/></OpsField>
              <OpsField label="Tags" className="ops-form-wide"><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}/></OpsField>
              <OpsField label="Commercial terms" className="ops-form-wide"><textarea value={form.commercialTerms} onChange={(e) => setForm({ ...form, commercialTerms: e.target.value })}/></OpsField>
              <OpsField label="Internal notes" className="ops-form-wide"><textarea value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}/></OpsField>
            </div> : null}
            <div className="ops-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Saving…" : form.id ? "Save partner" : "Create partner"}</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)}>Cancel</OpsButton></div>
          </form>
        </OpsSurface>
      </div> : null}

      {!total && !formOpen ? <section className="ops-surface" aria-label="Operating network">
        <OpsEmptyState compact kind="setup" icon={<Handshake size={16} strokeWidth={1.75} aria-hidden="true"/>} title="Build your operating network" description="Add the carriers, agents, transporters, warehouses and international counterparts KCPL works with to move freight." action={canCreate ? <OpsButton variant="primary" size="sm" onClick={startCreate}><Plus size={14} strokeWidth={1.75} aria-hidden="true"/>Add first partner</OpsButton> : undefined}/>
      </section> : null}

      {total ? <>
        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search partner, country, port, contact or ID" aria-label="Search partners"/>}
          actions={<>
            <OpsFilterSelect label="Type" value={typeFilter} allLabel="All types" options={partnerTypes.map((type) => ({ value: type, label: partnerTypeLabels[type] }))} onChange={(value) => setTypeFilter(value as "all" | PartnerType)}/>
            {filtersActive ? <OpsButton size="xs" variant="ghost" onClick={reset}>Reset</OpsButton> : null}
            <span className="ops-toolbar-divider" aria-hidden="true"/>
            <span className="ops-result-count" aria-live="polite">{filtered.length === total ? `${total} records` : `${filtered.length} of ${total}`}</span>
          </>}
          tabs={<OpsScopeTabs label="Partner status" items={[{ value: "all" as const, label: "All", count: total }, ...partnerStatuses.map((status) => ({ value: status, label: partnerStatusLabels[status], count: statusCounts[status] }))]} value={statusFilter} onChange={setStatusFilter}/>}
        />
        <OpsActiveFilters chips={activeFilters}/>

        <div className="ops-register-layout" data-inspector={selected ? "open" : undefined}>
          <section className="ops-surface" aria-label="Partner register">
            {filtered.length ? <OpsTableWrap>
              <table className="ops-table ops-register-table partners-table" data-compact={compact || undefined} data-financial={financialVisible || undefined} aria-label="Partners and vendors">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Status</th>
                    <th className="partners-col-footprint">Footprint</th>
                    {compact ? null : <th className="partners-col-services">Services</th>}
                    {compact ? null : <th className="partners-col-contact">Contact</th>}
                    {compact ? null : <th>KCPL owner</th>}
                    {financialVisible ? <th className="partners-col-money">Supplier exposure</th> : null}
                    {compact ? null : <th className="partners-col-activity">Activity</th>}
                    {compact ? null : <th><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const rowSelected = selectedId === p.id;
                    const footprint = footprintLine(p);
                    return <tr key={p.id} data-selected={rowSelected || undefined} aria-current={rowSelected || undefined} tabIndex={0} onClick={() => openRow(p.id)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openRow(p.id); } }}>
                      <td>
                        <span className="ops-cell-primary partners-name"><span className="ops-cell-clamp" title={p.display_name}>{p.display_name}</span>{p.preferred ? <Star size={12} strokeWidth={1.75} className="partners-preferred" aria-label="Preferred partner"/> : null}</span>
                        <span className="ops-cell-secondary ops-cell-clamp" title={typesText(p)}><span className="ops-mono">{p.id}</span> · {typesText(p)}</span>
                      </td>
                      <td><OpsBadge tone={statusTone(p.status)}>{partnerStatusLabels[p.status]}</OpsBadge></td>
                      <td className="partners-col-footprint">
                        <span className="ops-cell-primary">{p.country}</span>
                        {footprint ? <span className="ops-cell-secondary ops-cell-clamp" title={footprint}>{footprint}</span> : null}
                      </td>
                      {compact ? null : <td className="partners-col-services">{p.modes.length ? <span className="ops-cell-clamp" title={modesText(p)}>{modesText(p)}</span> : <span className="ops-cell-muted">Not set</span>}</td>}
                      {compact ? null : <td className="partners-col-contact">
                        {p.primary_contact_name ? <span className="ops-cell-primary ops-cell-clamp">{p.primary_contact_name}</span> : <span className="ops-cell-muted">No primary contact</span>}
                        {p.primary_email || p.primary_phone ? <span className="ops-cell-secondary ops-cell-clamp">{p.primary_email ?? p.primary_phone}</span> : null}
                      </td>}
                      {compact ? null : <td>
                        {p.owner_branch ? <span className="ops-cell-primary">{p.owner_branch}</span> : <OpsBadge tone="warning">Needs owner repair</OpsBadge>}
                        <span className="ops-cell-secondary">{commercialVisible ? `Terms ${p.payment_terms_days}d · ${p.preferred_currency}` : "Terms restricted"}</span>
                      </td>}
                      {financialVisible ? <td className="partners-col-money">
                        {p.payable_open.length ? <span className="ops-cell-primary partners-amount">{p.payable_open.map((amount) => money(amount.amount, amount.currency)).join(" · ")}</span> : <span className="ops-cell-muted">No open payable</span>}
                        <span className="ops-cell-secondary">{p.bill_count} bills · {p.shipment_count} jobs{p.overdue_bill_count ? <span className="partners-overdue"> · {p.overdue_bill_count} overdue</span> : null}</span>
                      </td> : null}
                      {compact ? null : <td className="partners-col-activity"><span className="ops-cell-muted">{dateLabel(p.last_activity_at)}</span></td>}
                      {compact ? null : <td className="ops-cell-actions">{canEditRecord(p) ? <OpsButton variant="ghost" size="xs" onClick={(event) => { event.stopPropagation(); startEdit(p); }} aria-label={`Edit ${p.display_name}`}><Pencil size={14} strokeWidth={1.75} aria-hidden="true"/>Edit</OpsButton> : p.owner_branch === null && canEdit ? <span className="ops-cell-muted">Management repair</span> : null}</td>}
                    </tr>;
                  })}
                </tbody>
              </table>
            </OpsTableWrap> : <OpsEmptyState compact kind="search" icon={<Handshake size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No partners match" description="Try a partner name, identifier, country, city, port, service, contact or relationship type, or change the filters." action={<OpsButton variant="secondary" size="sm" onClick={reset}>Reset filters</OpsButton>}/>}
            {filtered.length ? <footer className="ops-register-footer"><span>{filtered.length} partner{filtered.length === 1 ? "" : "s"} in this view</span></footer> : null}
          </section>

          {selected ? <PartnerInspector
            partner={selected}
            inspectorRef={inspectorRef}
            commercialVisible={commercialVisible}
            financialVisible={financialVisible}
            canEditRecord={canEditRecord(selected)}
            repairOnly={selected.owner_branch === null && canEdit && !canEditRecord(selected)}
            onEdit={() => startEdit(selected)}
            onClose={() => setSelectedId(null)}
          /> : null}
        </div>
      </> : null}
    </div>
  </OpsPage>;
}

function PartnerInspector({ partner, inspectorRef, commercialVisible, financialVisible, canEditRecord, repairOnly, onEdit, onClose }: {
  partner: PartnerRecord;
  inspectorRef: RefObject<HTMLElement | null>;
  commercialVisible: boolean;
  financialVisible: boolean;
  canEditRecord: boolean;
  repairOnly: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  return <aside ref={inspectorRef} className="ops-inspector" aria-label={`Partner ${partner.display_name}`}>
    <OpsInspectorHeader
      kicker={partner.id}
      title={partner.display_name}
      subtitle={partner.legal_name || typesText(partner)}
      actions={<button type="button" className="ops-inspector-close" onClick={onClose} aria-label="Close partner inspector"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
    />
    <div className="ops-inspector-scroll">
      <div className="ops-inspector-body">
        <div className="network-badges">
          <OpsBadge tone={statusTone(partner.status)}>{partnerStatusLabels[partner.status]}</OpsBadge>
          {partner.preferred ? <OpsBadge><Star size={12} strokeWidth={1.75} aria-hidden="true"/>Preferred</OpsBadge> : null}
          {partner.types.map((type) => <OpsBadge key={type}>{partnerTypeLabels[type]}</OpsBadge>)}
        </div>

        {partner.owner_branch === null ? <OpsInspectorNote tone="warning" title="Needs owner repair">No KCPL owner branch is recorded, so only global network editors can change this record.</OpsInspectorNote> : null}
        {financialVisible && partner.overdue_bill_count ? <OpsInspectorNote tone="danger" title={`${partner.overdue_bill_count} overdue supplier bill${partner.overdue_bill_count === 1 ? "" : "s"}`}/> : null}

        <OpsInspectorSection title="Operating footprint">
          <OpsFacts>
            <OpsFact label="Base country">{partner.country}</OpsFact>
            <OpsFact label="Countries served">{listOrNone(partner.countries_served)}</OpsFact>
            <OpsFact label="Cities served">{listOrNone(partner.cities_served)}</OpsFact>
            <OpsFact label="Ports / airports">{listOrNone(partner.ports_served)}</OpsFact>
            <OpsFact label="Services">{partner.modes.length ? modesText(partner) : "No services selected"}</OpsFact>
          </OpsFacts>
        </OpsInspectorSection>

        <OpsInspectorSection title="Contact">
          <OpsFacts>
            <OpsFact label="Primary contact">{partner.primary_contact_name || "Not recorded"}</OpsFact>
            <OpsFact label="Email">{partner.primary_email ? <a href={`mailto:${partner.primary_email}`}>{partner.primary_email}</a> : "Not recorded"}</OpsFact>
            <OpsFact label="Phone">{partner.primary_phone ? <a href={`tel:${partner.primary_phone.replace(/\s+/g, "")}`}>{partner.primary_phone}</a> : "Not recorded"}</OpsFact>
            {partner.whatsapp ? <OpsFact label="WhatsApp">{partner.whatsapp}</OpsFact> : null}
            {partner.website ? <OpsFact label="Website">{partner.website}</OpsFact> : null}
          </OpsFacts>
        </OpsInspectorSection>

        <OpsInspectorSection title="Ownership & terms">
          <OpsFacts>
            <OpsFact label="KCPL owner" warning={!partner.owner_branch}>{partner.owner_branch ?? "Needs owner repair"}</OpsFact>
            <OpsFact label="Payment terms">{commercialVisible ? `${partner.payment_terms_days} days · ${partner.preferred_currency}` : "Commercial terms restricted"}</OpsFact>
            <OpsFact label="Service rating">{partner.service_rating ? `${partner.service_rating}/5` : "Not rated"}</OpsFact>
            <OpsFact label="Contract">{partner.contract_reference ? `${partner.contract_reference}${partner.contract_expiry_date ? ` · expires ${dateOnly(partner.contract_expiry_date)}` : ""}` : "Not recorded"}</OpsFact>
          </OpsFacts>
        </OpsInspectorSection>

        {financialVisible ? <OpsInspectorSection title="Supplier exposure">
          <OpsFacts>
            <OpsFact label="Open payable">{partner.payable_open.length ? partner.payable_open.map((amount) => money(amount.amount, amount.currency)).join(" · ") : "No open payable"}</OpsFact>
            <OpsFact label="Bills · jobs">{`${partner.bill_count} bills · ${partner.shipment_count} jobs`}</OpsFact>
            <OpsFact label="Overdue" warning={partner.overdue_bill_count > 0}>{partner.overdue_bill_count ? `${partner.overdue_bill_count} overdue` : "None"}</OpsFact>
          </OpsFacts>
        </OpsInspectorSection> : null}

        <OpsInspectorSection title="Activity">
          <OpsFacts>
            <OpsFact label="Last activity">{dateLabel(partner.last_activity_at)}</OpsFact>
          </OpsFacts>
        </OpsInspectorSection>
      </div>
    </div>
    <footer className="ops-inspector-footer">
      {repairOnly ? <span className="network-footer-note">Management repair</span> : null}
      <Link href={`/admin/partners/${encodeURIComponent(partner.id)}`} className="ops-button" data-variant="secondary" data-size="sm"><ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true"/>Partner 360</Link>
      {canEditRecord ? <OpsButton variant="primary" size="sm" onClick={onEdit}><Pencil size={14} strokeWidth={1.75} aria-hidden="true"/>Edit partner</OpsButton> : null}
    </footer>
  </aside>;
}

function ChoiceGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="network-choice-group" role="group" aria-label={label}><span className="ops-field-label">{label}</span><div className="ops-filter-choices">{children}</div></div>;
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className="ops-filter-choice network-toggle" data-active={active || undefined} aria-pressed={active} onClick={onClick}>{active ? <Check size={12} strokeWidth={2} aria-hidden="true"/> : null}{children}</button>;
}
