"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, BadgeDollarSign, Building2, Clock3, Globe2, Plus, Sparkles, UserRound, UsersRound, X } from "lucide-react";
import {
  crmAccountStatusLabels,
  crmAccountStatuses,
  crmCurrencies,
  crmEntityKinds,
  crmLeadSources,
  crmLeadStageLabels,
  crmLeadStages,
  crmRelationshipLabels,
  kcplBranches,
  type CrmAccountStatus,
  type CrmCreateCustomerInput,
  type CrmCustomerSummary,
  type CrmDashboardStats,
  type CrmDuplicateMatch,
} from "./crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
import { SavedFilterViews } from "../saved-filter-views";
import { StaffAssignmentPicker } from "../staff-assignment-picker";

const emptyForm: CrmCreateCustomerInput = {
  entityKind: "company", displayName: "", legalName: "", tradingName: "", relationshipTypes: ["customer"], accountStatus: "prospect", leadStage: "new_lead", leadSource: "", primaryEmail: "", primaryPhone: "", website: "", industry: "", taxId: "", country: "Nepal", primaryBranch: "Kathmandu", accountManagerName: "", accountManagerEmail: "", accountManagerPhone: "", billingEmail: "", preferredCurrency: "NPR", paymentTermsDays: "", creditLimit: "", outstandingBalance: "", pricingNotes: "", markupPercent: "", preferredCarriers: [], transportPreferences: [], tags: [], internalSummary: "",
};

function statusTone(status: CrmAccountStatus): "info" | "success" | "neutral" | "warning" | "danger" {
  if (status === "prospect") return "info";
  if (status === "active") return "success";
  if (status === "on_hold") return "warning";
  if (status === "blacklisted") return "danger";
  return "neutral";
}

function formatMoney(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${currency} ${value.toLocaleString("en-AU")}`; }
}

function computeStats(customers: CrmCustomerSummary[]): CrmDashboardStats {
  return {
    total: customers.length,
    prospects: customers.filter((customer) => customer.account_status === "prospect").length,
    active: customers.filter((customer) => customer.account_status === "active").length,
    dormant: customers.filter((customer) => customer.account_status === "dormant").length,
    onHold: customers.filter((customer) => customer.account_status === "on_hold").length,
    blacklisted: customers.filter((customer) => customer.account_status === "blacklisted").length,
    followUpsDue: customers.reduce((total, customer) => total + customer.follow_up_count, 0),
  };
}

function csv(value: string) { return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]; }

export function CrmDashboard({ initialCustomers, initialStats, userName, userEmail }: { initialCustomers: CrmCustomerSummary[]; initialStats: CrmDashboardStats; userName: string; userEmail: string }) {
  const buyerCustomers = initialCustomers.filter((customer) => customer.relationship_types.includes("customer"));
  const [customers, setCustomers] = useState(buyerCustomers);
  const [stats, setStats] = useState(buyerCustomers.length === initialCustomers.length ? initialStats : computeStats(buyerCustomers));
  const [selectedId, setSelectedId] = useState(buyerCustomers[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CrmAccountStatus>("all");
  const [showCreate, setShowCreate] = useState(buyerCustomers.length === 0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [form, setForm] = useState<CrmCreateCustomerInput>({ ...emptyForm, accountManagerName: userName, accountManagerEmail: userEmail });
  const [tagDraft, setTagDraft] = useState("");
  const [carrierDraft, setCarrierDraft] = useState("");
  const [transportDraft, setTransportDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [duplicates, setDuplicates] = useState<CrmDuplicateMatch[]>([]);

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customers.filter((customer) => {
      if (statusFilter !== "all" && customer.account_status !== statusFilter) return false;
      if (!needle) return true;
      return [customer.id, customer.display_name, customer.legal_name ?? "", customer.primary_email ?? "", customer.primary_phone ?? "", customer.country, customer.primary_branch, customer.account_manager_name ?? "", customer.account_manager_email ?? "", customer.account_manager_phone ?? "", customer.tags.join(" "), customer.relationship_types.join(" ")].join(" ").toLowerCase().includes(needle);
    });
  }, [customers, query, statusFilter]);

  function setField<K extends keyof CrmCreateCustomerInput>(key: K, value: CrmCreateCustomerInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDuplicates([]);
  }

  function resetForm() {
    setForm({ ...emptyForm, accountManagerName: userName, accountManagerEmail: userEmail });
    setTagDraft(""); setCarrierDraft(""); setTransportDraft(""); setDuplicates([]); setAdvancedOpen(false); setNotice("");
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>, allowDuplicate = false) {
    event.preventDefault();
    setSaving(true); setNotice("");
    try {
      const payload = { ...form, tags: csv(tagDraft), preferredCarriers: csv(carrierDraft), transportPreferences: csv(transportDraft), allowDuplicate };
      const response = await fetch("/api/admin/crm/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { customer?: CrmCustomerSummary; error?: string; code?: string; duplicates?: CrmDuplicateMatch[] };
      if (response.status === 409 && data.code === "possible_duplicate") {
        setDuplicates(data.duplicates ?? []); setNotice("Possible duplicate found. Review the existing record before creating another one."); return;
      }
      if (!response.ok || !data.customer) throw new Error(data.error || "Could not create the CRM record.");
      const next = [data.customer, ...customers];
      setCustomers(next); setStats(computeStats(next)); setSelectedId(data.customer.id); setShowCreate(false); resetForm(); setNotice(`${data.customer.display_name} added to KCPL CRM.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create the CRM record."); }
    finally { setSaving(false); }
  }

  function openNew() { resetForm(); setShowCreate(true); }

  return (
    <main className="min-h-[calc(100vh-58px)] bg-[#f8f6f3]">
      <section className="border-b border-[#e8e0d9] bg-[#fffdfa]/72 px-5 py-6 backdrop-blur-xl lg:px-8">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-end justify-between gap-5"><div><p className="ops-eyebrow">Relationships</p><h1 className="mt-2 text-[31px] font-[730] tracking-[-.045em] text-[#332d29]">Customers</h1><p className="mt-2 max-w-2xl text-[11px] leading-5 text-[#887e76]">Customer accounts that buy KCPL freight and logistics services. Carriers, agents, transporters, suppliers and overseas counterparts live in Partners.</p></div><div className="flex items-center gap-2"><span className="hidden text-[9px] font-semibold text-[#9b9189] sm:inline">Working as {userName}</span><OpsButton variant="primary" onClick={openNew}><Plus size={13}/>New record</OpsButton></div></div>
      </section>

      <OpsStatStrip>
        <OpsStat label="Records" value={stats.total} />
        <OpsStat label="Prospects" value={stats.prospects} tone="info" active={statusFilter === "prospect"} onClick={() => setStatusFilter(statusFilter === "prospect" ? "all" : "prospect")}/>
        <OpsStat label="Active" value={stats.active} tone="success" active={statusFilter === "active"} onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}/>
        <OpsStat label="Dormant" value={stats.dormant} active={statusFilter === "dormant"} onClick={() => setStatusFilter(statusFilter === "dormant" ? "all" : "dormant")}/>
        <OpsStat label="On hold" value={stats.onHold} tone="warning" active={statusFilter === "on_hold"} onClick={() => setStatusFilter(statusFilter === "on_hold" ? "all" : "on_hold")}/>
        <OpsStat label="Follow-ups" value={stats.followUpsDue} tone={stats.followUpsDue ? "warning" : "neutral"}/>
      </OpsStatStrip>

      <div className="grid min-h-[calc(100vh-214px)] xl:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="min-h-0 border-r border-[#e7dfd8] bg-[#fffdfa]/72">
          <div className="sticky top-[58px] z-10 border-b border-[#e9e2dc] bg-[#fffdfa]/94 p-4 backdrop-blur-xl"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, contact, branch or tag"/><div className="ops-filter-pills mt-3"><button type="button" className="ops-filter-pill" data-active={statusFilter === "all" || undefined} onClick={() => setStatusFilter("all")}>All</button>{crmAccountStatuses.map((status) => <button key={status} type="button" className="ops-filter-pill" data-active={statusFilter === status || undefined} onClick={() => setStatusFilter(status)}>{crmAccountStatusLabels[status]}</button>)}</div><SavedFilterViews storageKey="kcpl-customer-saved-views-v1" query={query} status={statusFilter} onApply={(view) => { setQuery(view.query); setStatusFilter(view.status); }}/></div>
          <div>{filtered.length ? filtered.map((customer) => <button key={customer.id} type="button" onClick={() => { setSelectedId(customer.id); setShowCreate(false); setNotice(""); }} className="ops-record-row block w-full border-b border-[#eee7e1] px-4 py-3.5 text-left" data-selected={selectedId === customer.id && !showCreate || undefined}><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#f1ebe6] text-[#8c7162]">{customer.entity_kind === "company" ? <Building2 size={15}/> : <UserRound size={15}/>}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><strong className="truncate text-[11px] text-[#4c433d]">{customer.display_name}</strong><OpsBadge tone={statusTone(customer.account_status)}>{crmAccountStatusLabels[customer.account_status]}</OpsBadge></div><p className="mt-1 truncate text-[9px] text-[#8d837b]">{customer.primary_email || customer.primary_phone || customer.country}</p><p className="mt-1.5 text-[8px] font-semibold text-[#a19890]">{customer.primary_branch}{customer.account_manager_name ? ` · ${customer.account_manager_name}` : ""}</p></div></div></button>) : <OpsEmptyState kind="search" title="No customers match" description="Change the filter or create a customer account."/>}</div>
        </aside>

        <section className="min-w-0 p-5 lg:p-7 xl:p-8">
          {notice ? <div className="mb-4"><OpsNotice tone={duplicates.length ? "warning" : notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}
          {showCreate ? <CreateCustomerForm form={form} setField={setField} tagDraft={tagDraft} setTagDraft={setTagDraft} carrierDraft={carrierDraft} setCarrierDraft={setCarrierDraft} transportDraft={transportDraft} setTransportDraft={setTransportDraft} saving={saving} duplicates={duplicates} advancedOpen={advancedOpen} setAdvancedOpen={setAdvancedOpen} onSubmit={createCustomer} onCancel={() => { setShowCreate(false); setDuplicates([]); }}/>
            : selected ? <CustomerOverview customer={selected} onNew={openNew}/>
            : <OpsEmptyState kind="setup" icon={<UsersRound size={19}/>} title="Add the first KCPL customer" description="Customer accounts connect enquiries, shipments, contacts, commercial terms and activity. Agents, carriers and vendors belong in Partners." action={<OpsButton variant="primary" onClick={openNew}>Create customer</OpsButton>}/>} 
        </section>
      </div>
    </main>
  );
}

function CustomerOverview({ customer, onNew }: { customer: CrmCustomerSummary; onNew: () => void }) {
  const grossMargin = customer.revenue_total > 0 ? (customer.profit_total / customer.revenue_total) * 100 : 0;
  return <div className="mx-auto max-w-6xl ops-stack">
    <div className="flex flex-wrap items-start justify-between gap-5"><div><div className="flex flex-wrap items-center gap-2"><OpsMono className="text-[9px] text-[#9b7060]">{customer.id}</OpsMono><OpsBadge tone={statusTone(customer.account_status)} dot>{crmAccountStatusLabels[customer.account_status]}</OpsBadge>{customer.relationship_types.map((type) => <OpsBadge key={type}>{crmRelationshipLabels[type]}</OpsBadge>)}</div><h2 className="mt-3 text-[30px] font-[735] tracking-[-.045em] text-[#39312c]">{customer.display_name}</h2><p className="mt-2 text-[10px] text-[#8b8179]">{customer.primary_email || "No primary email"}{customer.primary_phone ? ` · ${customer.primary_phone}` : ""} · {customer.country}</p></div><div className="flex gap-2"><OpsButton variant="secondary" onClick={onNew}><Plus size={12}/>New record</OpsButton><Link href={`/admin/crm/${encodeURIComponent(customer.id)}`} className="ops-button" data-variant="primary" data-size="md">Open Customer 360 <ArrowRight size={12}/></Link></div></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MiniStat icon={<BadgeDollarSign size={14}/>} label="Quotes" value={customer.quote_count}/><MiniStat icon={<Globe2 size={14}/>} label="Active shipments" value={customer.active_shipment_count}/><MiniStat icon={<Sparkles size={14}/>} label="Completed jobs" value={customer.completed_shipment_count}/><MiniStat icon={<Clock3 size={14}/>} label="Follow-ups" value={customer.follow_up_count} warn={customer.follow_up_count > 0}/></div>

    <div className="ops-grid-main"><OpsSurface eyebrow="Account" title="Relationship snapshot"><div className="grid gap-x-8 gap-y-5 sm:grid-cols-2"><Fact label="Lead stage" value={crmLeadStageLabels[customer.lead_stage]}/><Fact label="Primary branch" value={customer.primary_branch}/><Fact label="Account manager" value={customer.account_manager_name || "Unassigned"}/><Fact label="Manager email" value={customer.account_manager_email || "Not set"}/><Fact label="Manager phone" value={customer.account_manager_phone || "Not set"}/><Fact label="Country" value={customer.country}/><Fact label="Entity" value={customer.entity_kind === "company" ? "Company / organisation" : "Individual"}/><Fact label="Updated" value={customer.updated_at ? new Date(customer.updated_at).toLocaleDateString("en-AU") : "Just created"}/></div>{customer.tags.length ? <div className="mt-5 border-t border-[#eee7e1] pt-4"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">Tags</p><div className="mt-2 flex flex-wrap gap-1.5">{customer.tags.map((tag) => <OpsBadge key={tag} tone="accent">{tag}</OpsBadge>)}</div></div> : null}</OpsSurface>
      <OpsSurface eyebrow="Commercial" title={`${customer.preferred_currency} account`} description="Headline lifetime totals for quick context. Full terms and rate cards live inside Customer 360."><div className="divide-y divide-[#eee7e1]"><MoneyLine label="Revenue" value={formatMoney(customer.revenue_total, customer.preferred_currency)}/><MoneyLine label="Cost" value={formatMoney(customer.cost_total, customer.preferred_currency)}/><MoneyLine label="Gross profit" value={formatMoney(customer.profit_total, customer.preferred_currency)} strong/><MoneyLine label="Gross margin" value={`${grossMargin.toFixed(1)}%`}/></div></OpsSurface>
    </div>
  </div>;
}

function CreateCustomerForm({ form, setField, tagDraft, setTagDraft, carrierDraft, setCarrierDraft, transportDraft, setTransportDraft, saving, duplicates, advancedOpen, setAdvancedOpen, onSubmit, onCancel }: {
  form: CrmCreateCustomerInput;
  setField: <K extends keyof CrmCreateCustomerInput>(key: K, value: CrmCreateCustomerInput[K]) => void;
  tagDraft: string; setTagDraft: (value: string) => void;
  carrierDraft: string; setCarrierDraft: (value: string) => void;
  transportDraft: string; setTransportDraft: (value: string) => void;
  saving: boolean; duplicates: CrmDuplicateMatch[]; advancedOpen: boolean; setAdvancedOpen: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, allowDuplicate?: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  return <div className="mx-auto max-w-5xl ops-stack">
    <div className="flex items-start justify-between gap-4"><div><p className="ops-eyebrow">New relationship</p><h2 className="mt-2 text-[27px] font-[730] tracking-[-.04em] text-[#39312c]">Create CRM record</h2><p className="mt-2 text-[10px] leading-5 text-[#887e76]">Start with identity and ownership. Commercial and operating preferences are available below when they are useful.</p></div><button type="button" onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-[11px] text-[#9b9189] hover:bg-white" aria-label="Close create customer"><X size={14}/></button></div>
    {duplicates.length ? <OpsSurface eyebrow="Duplicate check" title="Possible existing records" description="KCPL found similar customer data. Open an existing record first unless this is genuinely a separate relationship."><div className="divide-y divide-[#eee7e1]">{duplicates.map((match) => <div key={`${match.id}-${match.reason}`} className="flex items-center justify-between gap-4 py-3"><div><strong className="text-[10px] text-[#514840]">{match.display_name}</strong><p className="mt-1 text-[8px] text-[#9b9189]">Matched by {match.reason}</p></div><Link href={`/admin/crm/${encodeURIComponent(match.id)}`} className="ops-button" data-variant="secondary" data-size="sm">Open existing</Link></div>)}</div></OpsSurface> : null}
    <form onSubmit={(event) => onSubmit(event, false)} className="ops-stack">
      <OpsSurface eyebrow="Identity" title="Who is this?">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><OpsField label="Record type"><select value={form.entityKind} onChange={(event) => setField("entityKind", event.target.value as CrmCreateCustomerInput["entityKind"])}>{crmEntityKinds.map((kind) => <option value={kind} key={kind}>{kind === "company" ? "Company / organisation" : "Individual"}</option>)}</select></OpsField><OpsField label="Display name"><input required value={form.displayName} onChange={(event) => setField("displayName", event.target.value)} placeholder="Customer or organisation name"/></OpsField><OpsField label="Legal name"><input value={form.legalName} onChange={(event) => setField("legalName", event.target.value)}/></OpsField><OpsField label="Primary email"><input type="email" value={form.primaryEmail} onChange={(event) => setField("primaryEmail", event.target.value)}/></OpsField><OpsField label="Primary phone"><input value={form.primaryPhone} onChange={(event) => setField("primaryPhone", event.target.value)}/></OpsField><OpsField label="Country"><input value={form.country} onChange={(event) => setField("country", event.target.value)}/></OpsField></div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><OpsBadge tone="info">Customer</OpsBadge><span className="text-[10px] text-[#756e67]">This workspace is for buyers of KCPL services. Operational suppliers and counterparts belong in Partners.</span></div>
      </OpsSurface>

      <OpsSurface eyebrow="Ownership" title="How KCPL will manage the account"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><OpsField label="Account status"><select value={form.accountStatus} onChange={(event) => setField("accountStatus", event.target.value as CrmCreateCustomerInput["accountStatus"])}>{crmAccountStatuses.map((status) => <option value={status} key={status}>{crmAccountStatusLabels[status]}</option>)}</select></OpsField><OpsField label="Lead stage"><select value={form.leadStage} onChange={(event) => setField("leadStage", event.target.value as CrmCreateCustomerInput["leadStage"])}>{crmLeadStages.map((stage) => <option value={stage} key={stage}>{crmLeadStageLabels[stage]}</option>)}</select></OpsField><OpsField label="Lead source"><select value={form.leadSource} onChange={(event) => setField("leadSource", event.target.value as CrmCreateCustomerInput["leadSource"])}><option value="">Not set</option>{crmLeadSources.map((source) => <option value={source} key={source}>{source.replaceAll("_", " ")}</option>)}</select></OpsField><OpsField label="Primary branch"><select value={form.primaryBranch} onChange={(event) => setField("primaryBranch", event.target.value as CrmCreateCustomerInput["primaryBranch"])}>{kcplBranches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField><div className="md:col-span-2"><OpsField label="Account manager" hint="Choose from People & branches. Name, email and phone populate automatically."><StaffAssignmentPicker branch={form.primaryBranch} value={{ name: form.accountManagerName, email: form.accountManagerEmail, phone: form.accountManagerPhone }} onChange={(staff) => { setField("accountManagerName", staff.name); setField("accountManagerEmail", staff.email); setField("accountManagerPhone", staff.phone); }}/></OpsField></div></div><OpsField label="Internal summary" className="mt-4"><textarea value={form.internalSummary} onChange={(event) => setField("internalSummary", event.target.value)} placeholder="What should another KCPL staff member know before speaking with this account?"/></OpsField></OpsSurface>

      <button type="button" onClick={() => setAdvancedOpen(!advancedOpen)} className="flex items-center justify-between rounded-[14px] border border-[#e7dfd8] bg-[#fffdfa] px-4 py-3 text-left"><span><strong className="block text-[10px] text-[#514840]">Commercial & operating details</strong><small className="mt-1 block text-[8px] text-[#9b9189]">Optional terms, preferences, IDs and tags</small></span><span className="text-[10px] font-bold text-[#b66750]">{advancedOpen ? "Hide" : "Add details"}</span></button>

      {advancedOpen ? <OpsSurface eyebrow="Account setup" title="Commercial & operating details"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><OpsField label="Trading name"><input value={form.tradingName} onChange={(event) => setField("tradingName", event.target.value)}/></OpsField><OpsField label="Website"><input value={form.website} onChange={(event) => setField("website", event.target.value)}/></OpsField><OpsField label="Industry"><input value={form.industry} onChange={(event) => setField("industry", event.target.value)}/></OpsField><OpsField label="Tax ID"><input value={form.taxId} onChange={(event) => setField("taxId", event.target.value)}/></OpsField><OpsField label="Billing email"><input type="email" value={form.billingEmail} onChange={(event) => setField("billingEmail", event.target.value)}/></OpsField><OpsField label="Preferred currency"><select value={form.preferredCurrency} onChange={(event) => setField("preferredCurrency", event.target.value as CrmCreateCustomerInput["preferredCurrency"])}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></OpsField><OpsField label="Payment terms (days)"><input inputMode="numeric" value={form.paymentTermsDays} onChange={(event) => setField("paymentTermsDays", event.target.value)}/></OpsField><OpsField label="Credit limit"><input inputMode="decimal" value={form.creditLimit} onChange={(event) => setField("creditLimit", event.target.value)}/></OpsField><OpsField label="Opening outstanding"><input inputMode="decimal" value={form.outstandingBalance} onChange={(event) => setField("outstandingBalance", event.target.value)}/></OpsField><OpsField label="Markup %"><input inputMode="decimal" value={form.markupPercent} onChange={(event) => setField("markupPercent", event.target.value)}/></OpsField><OpsField label="Tags" hint="Comma separated"><input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="vip, garments, air-import"/></OpsField><OpsField label="Preferred carriers" hint="Comma separated"><input value={carrierDraft} onChange={(event) => setCarrierDraft(event.target.value)}/></OpsField><OpsField label="Transport preferences" hint="Comma separated"><input value={transportDraft} onChange={(event) => setTransportDraft(event.target.value)}/></OpsField><OpsField label="Pricing notes" className="md:col-span-2 xl:col-span-3"><textarea value={form.pricingNotes} onChange={(event) => setField("pricingNotes", event.target.value)}/></OpsField></div></OpsSurface> : null}

      <div className="flex flex-wrap gap-2"><OpsButton variant="primary" disabled={saving}>{saving ? "Creating…" : "Create record"}</OpsButton><OpsButton type="button" variant="secondary" onClick={onCancel}>Cancel</OpsButton>{duplicates.length ? <OpsButton type="button" variant="danger" disabled={saving} onClick={() => { const synthetic = { preventDefault() {} } as FormEvent<HTMLFormElement>; void onSubmit(synthetic, true); }}>Create anyway</OpsButton> : null}</div>
    </form>
  </div>;
}

function MiniStat({ icon, label, value, warn = false }: { icon: React.ReactNode; label: string; value: number; warn?: boolean }) { return <div className="rounded-[14px] border border-[#e7dfd8] bg-[#fffdfa] p-4"><div className={`flex items-center gap-2 ${warn ? "text-[#a46a2f]" : "text-[#958b83]"}`}>{icon}<span className="text-[8px] font-bold uppercase tracking-[.08em]">{label}</span></div><strong className={`mt-2 block text-[21px] tracking-[-.035em] ${warn ? "text-[#9a682f]" : "text-[#4b423c]"}`}>{value}</strong></div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">{label}</p><p className="mt-1.5 text-[10px] font-semibold text-[#5b524b]">{value}</p></div>; }
function MoneyLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-4 py-3 text-[10px]"><span className="text-[#8d837b]">{label}</span><strong className={strong ? "text-[12px] text-[#66806b]" : "text-[#514840]"}>{value}</strong></div>; }
