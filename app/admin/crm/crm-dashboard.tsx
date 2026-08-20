"use client";

import { FormEvent, useMemo, useState } from "react";
import { Building2, CircleAlert, Plus, Search, UserRound, UsersRound } from "lucide-react";
import {
  crmAccountStatusLabels,
  crmAccountStatuses,
  crmCurrencies,
  crmEntityKinds,
  crmLeadSources,
  crmLeadStageLabels,
  crmLeadStages,
  crmRelationshipLabels,
  crmRelationshipTypes,
  kcplBranches,
  type CrmAccountStatus,
  type CrmCreateCustomerInput,
  type CrmCustomerSummary,
  type CrmDashboardStats,
  type CrmDuplicateMatch,
  type CrmRelationshipType,
} from "./crm-data";
import {
  OpsButton,
  OpsEmptyState,
  OpsFilterBar,
  OpsMetric,
  OpsMetricStrip,
  OpsPageHeader,
  OpsPanel,
  OpsStatusBadge,
  OpsTableFrame,
} from "../operations-ui";

const emptyForm: CrmCreateCustomerInput = {
  entityKind: "company",
  displayName: "",
  legalName: "",
  tradingName: "",
  relationshipTypes: ["customer"],
  accountStatus: "prospect",
  leadStage: "new_lead",
  leadSource: "",
  primaryEmail: "",
  primaryPhone: "",
  website: "",
  industry: "",
  taxId: "",
  country: "Nepal",
  primaryBranch: "Kathmandu",
  accountManagerName: "",
  accountManagerEmail: "",
  billingEmail: "",
  preferredCurrency: "NPR",
  paymentTermsDays: "",
  creditLimit: "",
  outstandingBalance: "",
  pricingNotes: "",
  markupPercent: "",
  preferredCarriers: [],
  transportPreferences: [],
  tags: [],
  internalSummary: "",
};

function statusTone(status: CrmAccountStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "prospect") return "info";
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

function csv(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function CrmDashboard({ initialCustomers, initialStats, userName, userEmail }: { initialCustomers: CrmCustomerSummary[]; initialStats: CrmDashboardStats; userName: string; userEmail: string }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [stats, setStats] = useState(initialStats);
  const [selectedId, setSelectedId] = useState(initialCustomers[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CrmAccountStatus>("all");
  const [showCreate, setShowCreate] = useState(initialCustomers.length === 0);
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
      return [customer.id, customer.display_name, customer.legal_name ?? "", customer.primary_email ?? "", customer.primary_phone ?? "", customer.country, customer.primary_branch, customer.account_manager_name ?? "", customer.tags.join(" "), customer.relationship_types.join(" ")].join(" ").toLowerCase().includes(needle);
    });
  }, [customers, query, statusFilter]);

  function setField<K extends keyof CrmCreateCustomerInput>(key: K, value: CrmCreateCustomerInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDuplicates([]);
  }

  function toggleRelationship(type: CrmRelationshipType) {
    setForm((current) => {
      const relationshipTypes = current.relationshipTypes.includes(type) ? current.relationshipTypes.filter((item) => item !== type) : [...current.relationshipTypes, type];
      return { ...current, relationshipTypes };
    });
    setDuplicates([]);
  }

  function resetForm() {
    setForm({ ...emptyForm, accountManagerName: userName, accountManagerEmail: userEmail });
    setTagDraft("");
    setCarrierDraft("");
    setTransportDraft("");
    setDuplicates([]);
  }

  async function submitCustomer(allowDuplicate = false) {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/crm/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, tags: csv(tagDraft), preferredCarriers: csv(carrierDraft), transportPreferences: csv(transportDraft), allowDuplicate }),
      });
      const data = await response.json() as { ok?: boolean; customer?: CrmCustomerSummary; error?: string; code?: string; duplicates?: CrmDuplicateMatch[] };
      if (response.status === 409 && data.code === "possible_duplicate") {
        setDuplicates(data.duplicates ?? []);
        setNotice("Possible duplicate found. Review the existing record before creating another one.");
        return;
      }
      if (!response.ok || !data.customer) throw new Error(data.error || "Could not create the CRM record.");
      const next = [data.customer, ...customers];
      setCustomers(next);
      setStats(computeStats(next));
      setSelectedId(data.customer.id);
      setShowCreate(false);
      resetForm();
      setNotice(`${data.customer.display_name} added to KCPL CRM.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create the CRM record.");
    } finally {
      setSaving(false);
    }
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCustomer(false);
  }

  function selectCustomer(id: string) {
    setSelectedId(id);
    setShowCreate(false);
    setNotice("");
  }

  return <main>
    <OpsPageHeader
      eyebrow="Commercial"
      title="Customers"
      description="One operational customer register for contacts, quotes, shipments, commercial terms and account history."
      breadcrumbs={[{ label: "Commercial" }, { label: "Customers" }]}
      actions={<OpsButton tone="primary" onClick={() => { setShowCreate(true); setDuplicates([]); }}><Plus size={13}/>New customer</OpsButton>}
    />

    <div className="ops-page-body ops-stack">
      <OpsMetricStrip columns={6}>
        <OpsMetric label="CRM records" value={stats.total} icon={<UsersRound size={13}/>}/>
        <OpsMetric label="Active" value={stats.active} tone="success"/>
        <OpsMetric label="Prospects" value={stats.prospects} tone="info"/>
        <OpsMetric label="On hold" value={stats.onHold} tone={stats.onHold ? "warning" : "neutral"}/>
        <OpsMetric label="Dormant" value={stats.dormant}/>
        <OpsMetric label="Open follow-ups" value={stats.followUpsDue} tone={stats.followUpsDue ? "warning" : "success"}/>
      </OpsMetricStrip>

      {notice ? <div className="rounded-lg border border-[#e2e5e8] bg-white px-3.5 py-2.5 text-[11px] text-[#59616a]">{notice}</div> : null}

      {showCreate ? <CreateCustomerForm form={form} setField={setField} toggleRelationship={toggleRelationship} tagDraft={tagDraft} setTagDraft={setTagDraft} carrierDraft={carrierDraft} setCarrierDraft={setCarrierDraft} transportDraft={transportDraft} setTransportDraft={setTransportDraft} saving={saving} duplicates={duplicates} onSubmit={createCustomer} onCreateAnyway={() => void submitCustomer(true)} onCancel={() => { setShowCreate(false); setDuplicates([]); }}/>
      : <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <OpsTableFrame
          toolbar={<OpsFilterBar count={<span>{filtered.length} of {customers.length}</span>} reset={statusFilter !== "all" || query ? <button type="button" onClick={() => { setStatusFilter("all"); setQuery(""); }} className="font-medium text-[#5367a8]">Clear filters</button> : null}><label className="ops-search-field"><Search size={13} className="text-[#8b9299]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, contact, tag or branch"/></label><label className="ops-filter-control"><span className="text-[10px]">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | CrmAccountStatus)}><option value="all">All</option>{crmAccountStatuses.map((status) => <option key={status} value={status}>{crmAccountStatusLabels[status]}</option>)}</select></label></OpsFilterBar>}
          footer={<span>Click a row for a quick account preview. Open Customer 360 for the full record.</span>}
        >
          {filtered.length ? <table className="ops-dense-table min-w-[980px]"><thead><tr><th className="px-4 text-left">Customer</th><th className="px-3 text-left">Status</th><th className="px-3 text-left">Branch</th><th className="px-3 text-left">Account manager</th><th className="px-3 text-right">Quotes</th><th className="px-3 text-right">Active jobs</th><th className="px-3 text-right">Follow-ups</th><th className="px-4 text-left">Contact</th></tr></thead><tbody>{filtered.map((customer) => <tr key={customer.id} onClick={() => selectCustomer(customer.id)} className={`cursor-pointer ${selectedId === customer.id ? "bg-[#f7f8fc]" : ""}`}><td className="px-4"><div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#e2e5e8] bg-[#fafafa] text-[#7b838c]">{customer.entity_kind === "company" ? <Building2 size={12}/> : <UserRound size={12}/>}</span><div className="min-w-0"><strong className="block max-w-[220px] truncate font-medium text-[#30363d]">{customer.display_name}</strong><p className="mt-0.5 text-[9px] text-[#989fa6]">{customer.id} · {customer.country}</p></div></div></td><td className="px-3"><OpsStatusBadge tone={statusTone(customer.account_status)}>{crmAccountStatusLabels[customer.account_status]}</OpsStatusBadge></td><td className="px-3">{customer.primary_branch}</td><td className="px-3">{customer.account_manager_name || "Unassigned"}</td><td className="px-3 text-right">{customer.quote_count}</td><td className="px-3 text-right">{customer.active_shipment_count}</td><td className={`px-3 text-right ${customer.follow_up_count ? "font-semibold text-[#8a6734]" : ""}`}>{customer.follow_up_count}</td><td className="px-4"><span className="block max-w-[210px] truncate">{customer.primary_email || customer.primary_phone || "Not recorded"}</span></td></tr>)}</tbody></table> : <OpsEmptyState title="No customers match this view" detail="Adjust the status filter or search term." action={<OpsButton onClick={() => { setStatusFilter("all"); setQuery(""); }}>Clear filters</OpsButton>}/>} 
        </OpsTableFrame>

        {selected ? <CustomerPreview customer={selected} onNew={() => setShowCreate(true)}/> : <OpsPanel><OpsEmptyState title="Select a customer" detail="Choose a row to preview the account without leaving the register." action={<OpsButton tone="primary" onClick={() => setShowCreate(true)}>Create customer</OpsButton>}/></OpsPanel>}
      </div>}
    </div>
  </main>;
}

function CustomerPreview({ customer, onNew }: { customer: CrmCustomerSummary; onNew: () => void }) {
  const grossMargin = customer.revenue_total > 0 ? (customer.profit_total / customer.revenue_total) * 100 : 0;
  return <OpsPanel title={customer.display_name} eyebrow="Account preview" description={`${crmLeadStageLabels[customer.lead_stage]} · ${customer.country}`} action={<OpsStatusBadge tone={statusTone(customer.account_status)}>{crmAccountStatusLabels[customer.account_status]}</OpsStatusBadge>}>
    <div className="divide-y divide-[#eceef0] px-4 py-1"><PreviewLine label="Primary branch" value={customer.primary_branch}/><PreviewLine label="Account manager" value={customer.account_manager_name || "Unassigned"}/><PreviewLine label="Quotes" value={String(customer.quote_count)}/><PreviewLine label="Active shipments" value={String(customer.active_shipment_count)}/><PreviewLine label="Completed jobs" value={String(customer.completed_shipment_count)}/><PreviewLine label="Follow-ups" value={String(customer.follow_up_count)}/></div>
    <div className="border-t border-[#eceef0] px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#858c94]">Commercial snapshot</p><div className="mt-2 grid grid-cols-2 gap-2"><MiniValue label="Revenue" value={formatMoney(customer.revenue_total, customer.preferred_currency)}/><MiniValue label="Gross profit" value={formatMoney(customer.profit_total, customer.preferred_currency)} positive={customer.profit_total >= 0}/><MiniValue label="Margin" value={`${grossMargin.toFixed(1)}%`}/><MiniValue label="Currency" value={customer.preferred_currency}/></div></div>
    {customer.tags.length ? <div className="flex flex-wrap gap-1.5 border-t border-[#eceef0] px-4 py-3">{customer.tags.slice(0, 8).map((tag) => <OpsStatusBadge key={tag}>{tag}</OpsStatusBadge>)}</div> : null}
    <div className="flex flex-wrap gap-2 border-t border-[#eceef0] p-4"><OpsButton href={`/admin/crm/${encodeURIComponent(customer.id)}`} tone="primary">Open Customer 360</OpsButton><OpsButton onClick={onNew}><Plus size={12}/>New customer</OpsButton></div>
  </OpsPanel>;
}

function CreateCustomerForm({ form, setField, toggleRelationship, tagDraft, setTagDraft, carrierDraft, setCarrierDraft, transportDraft, setTransportDraft, saving, duplicates, onSubmit, onCreateAnyway, onCancel }: {
  form: CrmCreateCustomerInput;
  setField: <K extends keyof CrmCreateCustomerInput>(key: K, value: CrmCreateCustomerInput[K]) => void;
  toggleRelationship: (type: CrmRelationshipType) => void;
  tagDraft: string; setTagDraft: (value: string) => void;
  carrierDraft: string; setCarrierDraft: (value: string) => void;
  transportDraft: string; setTransportDraft: (value: string) => void;
  saving: boolean; duplicates: CrmDuplicateMatch[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateAnyway: () => void;
  onCancel: () => void;
}) {
  return <form onSubmit={onSubmit} className="ops-panel overflow-visible">
    <div className="ops-panel-header"><div><p className="ops-eyebrow">New customer</p><h2 className="text-sm font-semibold text-[#23272d]">Create CRM record</h2><p className="mt-1 text-[11px] text-[#7c848d]">Create the account once, then reuse it across quotes, shipments, documents and finance.</p></div><OpsButton type="button" onClick={onCancel}>Cancel</OpsButton></div>
    {duplicates.length ? <div className="m-4 flex items-start gap-3 rounded-lg border border-[#eadfca] bg-[#fbf7ef] p-3.5 text-[11px] text-[#765b31]"><CircleAlert size={15} className="mt-0.5 shrink-0"/><div className="min-w-0 flex-1"><p className="font-semibold text-[#5e4829]">Possible duplicate detected</p><div className="mt-1.5 space-y-1">{duplicates.map((match) => <p key={match.id}><strong>{match.display_name}</strong> matches {match.reason.replace("_", " ")} · {match.id}</p>)}</div></div><OpsButton type="button" disabled={saving} onClick={onCreateAnyway}>Create anyway</OpsButton></div> : null}
    <div className="grid gap-3 p-4 xl:grid-cols-2">
      <FormSection title="Identity" detail="Who this record represents and how KCPL relates to them.">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Record type"><select value={form.entityKind} onChange={(event) => setField("entityKind", event.target.value as CrmCreateCustomerInput["entityKind"])}>{crmEntityKinds.map((kind) => <option key={kind} value={kind}>{kind === "company" ? "Company / organisation" : "Individual"}</option>)}</select></Field><Field label="Display name"><input required value={form.displayName} onChange={(event) => setField("displayName", event.target.value)} placeholder="Himalayan Traders Pvt Ltd"/></Field><Field label="Legal name"><input value={form.legalName} onChange={(event) => setField("legalName", event.target.value)} /></Field><Field label="Trading name"><input value={form.tradingName} onChange={(event) => setField("tradingName", event.target.value)} /></Field></div>
        <div className="mt-3"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">Relationship types</span><div className="flex flex-wrap gap-1.5">{crmRelationshipTypes.map((type) => <button key={type} type="button" onClick={() => toggleRelationship(type)} className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium ${form.relationshipTypes.includes(type) ? "border-[#dce0fa] bg-[#f1f3ff] text-[#4655a0]" : "border-[#e1e4e7] bg-white text-[#737b84]"}`}>{crmRelationshipLabels[type]}</button>)}</div></div>
      </FormSection>

      <FormSection title="Sales & ownership" detail="Pipeline, branch and the KCPL person responsible.">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Account status"><select value={form.accountStatus} onChange={(event) => setField("accountStatus", event.target.value as CrmCreateCustomerInput["accountStatus"])}>{crmAccountStatuses.map((status) => <option key={status} value={status}>{crmAccountStatusLabels[status]}</option>)}</select></Field><Field label="Lead stage"><select value={form.leadStage} onChange={(event) => setField("leadStage", event.target.value as CrmCreateCustomerInput["leadStage"])}>{crmLeadStages.map((stage) => <option key={stage} value={stage}>{crmLeadStageLabels[stage]}</option>)}</select></Field><Field label="Lead source"><select value={form.leadSource} onChange={(event) => setField("leadSource", event.target.value as CrmCreateCustomerInput["leadSource"])}><option value="">Not recorded</option>{crmLeadSources.map((source) => <option key={source} value={source}>{source.replaceAll("_", " ")}</option>)}</select></Field><Field label="Primary branch"><select value={form.primaryBranch} onChange={(event) => setField("primaryBranch", event.target.value as CrmCreateCustomerInput["primaryBranch"])}>{kcplBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></Field><Field label="Account manager"><input value={form.accountManagerName} onChange={(event) => setField("accountManagerName", event.target.value)}/></Field><Field label="Manager email"><input type="email" value={form.accountManagerEmail} onChange={(event) => setField("accountManagerEmail", event.target.value)}/></Field></div>
      </FormSection>

      <FormSection title="Contact & business" detail="Primary contact channels and identifiers used for matching and operations.">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Primary email"><input type="email" value={form.primaryEmail} onChange={(event) => setField("primaryEmail", event.target.value)}/></Field><Field label="Primary phone"><input value={form.primaryPhone} onChange={(event) => setField("primaryPhone", event.target.value)}/></Field><Field label="Billing email"><input type="email" value={form.billingEmail} onChange={(event) => setField("billingEmail", event.target.value)}/></Field><Field label="Country"><input value={form.country} onChange={(event) => setField("country", event.target.value)}/></Field><Field label="Industry"><input value={form.industry} onChange={(event) => setField("industry", event.target.value)}/></Field><Field label="PAN / VAT / Tax ID"><input value={form.taxId} onChange={(event) => setField("taxId", event.target.value)}/></Field><Field label="Website"><input value={form.website} onChange={(event) => setField("website", event.target.value)} placeholder="https://"/></Field><Field label="Tags"><input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="VIP, Importer"/></Field><div className="sm:col-span-2"><Field label="Transport preferences"><input value={transportDraft} onChange={(event) => setTransportDraft(event.target.value)} placeholder="Sea freight, Air freight"/></Field></div></div>
      </FormSection>

      <FormSection title="Commercial & credit" detail="Internal commercial defaults and account terms.">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Account currency"><select value={form.preferredCurrency} onChange={(event) => setField("preferredCurrency", event.target.value as CrmCreateCustomerInput["preferredCurrency"])}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field><Field label="Payment terms (days)"><input inputMode="numeric" value={form.paymentTermsDays} onChange={(event) => setField("paymentTermsDays", event.target.value)}/></Field><Field label="Credit limit"><input inputMode="decimal" value={form.creditLimit} onChange={(event) => setField("creditLimit", event.target.value)}/></Field><Field label="Outstanding balance"><input inputMode="decimal" value={form.outstandingBalance} onChange={(event) => setField("outstandingBalance", event.target.value)}/></Field><Field label="Default markup %"><input inputMode="decimal" value={form.markupPercent} onChange={(event) => setField("markupPercent", event.target.value)}/></Field><Field label="Preferred carriers"><input value={carrierDraft} onChange={(event) => setCarrierDraft(event.target.value)}/></Field><div className="sm:col-span-2"><Field label="Pricing / rate notes"><textarea rows={3} value={form.pricingNotes} onChange={(event) => setField("pricingNotes", event.target.value)}/></Field></div><div className="sm:col-span-2"><Field label="Internal account summary"><textarea rows={3} value={form.internalSummary} onChange={(event) => setField("internalSummary", event.target.value)}/></Field></div></div>
      </FormSection>
    </div>
    <div className="flex justify-end gap-2 border-t border-[#eceef0] bg-[#fcfcfc] px-4 py-3"><OpsButton type="button" onClick={onCancel}>Cancel</OpsButton><OpsButton tone="primary" type="submit" disabled={saving || form.relationshipTypes.length === 0}>{saving ? "Creating…" : "Create customer"}</OpsButton></div>
  </form>;
}

function FormSection({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-[#e4e6e9] bg-white p-4"><h3 className="text-xs font-semibold text-[#343a40]">{title}</h3><p className="mt-1 text-[10px] leading-4 text-[#8c939b]">{detail}</p><div className="mt-3">{children}</div></section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span>{children}</label>;
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 py-3 text-[11px]"><span className="text-[#858c94]">{label}</span><strong className="text-right font-medium text-[#414850]">{value}</strong></div>;
}

function MiniValue({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return <div className="rounded-md bg-[#f7f8f9] p-2.5"><p className="text-[9px] text-[#9299a0]">{label}</p><p className={`mt-1 truncate text-[11px] font-semibold ${positive === true ? "text-[#397052]" : positive === false ? "text-[#9a4d55]" : "text-[#414850]"}`}>{value}</p></div>;
}
