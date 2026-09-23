"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowRight, ChevronDown, Plus, Users, X } from "lucide-react";
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
import { OpsBadge, OpsButton, OpsEmptyState, OpsFact, OpsFacts, OpsField, OpsInspectorHeader, OpsInspectorSection, OpsKpiRail, OpsNotice, OpsPage, OpsPageHeader, OpsRailMetric, OpsRegisterToolbar, OpsScopeTabs, OpsSearch, OpsSurface, OpsTableWrap } from "../operations-ui";
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

/** Docked beside the register while there is room; mirrors the .ops-register-layout query. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1180px), (min-width: 900px) and (max-width: 1023px)";

export function CrmDashboard({ initialCustomers, initialStats, userName, userEmail, commercialVisible, jump }: { initialCustomers: CrmCustomerSummary[]; initialStats: CrmDashboardStats; userName: string; userEmail: string; commercialVisible: boolean; /** Header control for opening a Customer 360 directly. */ jump?: ReactNode }) {
  const buyerCustomers = initialCustomers.filter((customer) => customer.relationship_types.includes("customer"));
  const [customers, setCustomers] = useState(buyerCustomers);
  const [stats, setStats] = useState(buyerCustomers.length === initialCustomers.length ? initialStats : computeStats(buyerCustomers));
  const [selectedId, setSelectedId] = useState("");
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
  const inspectorRef = useRef<HTMLElement>(null);
  const createRef = useRef<HTMLDivElement>(null);

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

  function openNew() {
    resetForm(); setShowCreate(true);
    window.requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      createRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  }

  function openCustomer(id: string) {
    setSelectedId(id); setNotice("");
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
      setSelectedId("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasSelection]);

  const statusCounts = useMemo(() => Object.fromEntries(crmAccountStatuses.map((status) => [status, customers.filter((customer) => customer.account_status === status).length])) as Record<CrmAccountStatus, number>, [customers]);
  const filtersActive = Boolean(query.trim()) || statusFilter !== "all";
  const compact = selected !== null;

  return (
    <OpsPage>
      <OpsPageHeader
        title="Customers"
        description="Accounts that buy KCPL freight and logistics services. Carriers, agents and suppliers live in Partners."
        meta={<span>Working as {userName}</span>}
        actions={<>
          {jump}
          <OpsButton variant="primary" onClick={openNew} aria-expanded={showCreate}><Plus size={16} strokeWidth={1.75} aria-hidden="true"/>New record</OpsButton>
        </>}
      />

      <div className="px-4 pb-8 pt-4 md:px-6">
        <OpsKpiRail label="Customer summary">
          <OpsRailMetric label="Records" value={stats.total} active={statusFilter === "all"} onClick={() => setStatusFilter("all")}/>
          <OpsRailMetric label="Prospects" value={stats.prospects} active={statusFilter === "prospect"} onClick={() => setStatusFilter(statusFilter === "prospect" ? "all" : "prospect")}/>
          <OpsRailMetric label="Active" value={stats.active} active={statusFilter === "active"} onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}/>
          <OpsRailMetric label="Dormant" value={stats.dormant} active={statusFilter === "dormant"} onClick={() => setStatusFilter(statusFilter === "dormant" ? "all" : "dormant")}/>
          <OpsRailMetric label="On hold" value={stats.onHold} tone={stats.onHold ? "warning" : "neutral"} active={statusFilter === "on_hold"} onClick={() => setStatusFilter(statusFilter === "on_hold" ? "all" : "on_hold")}/>
          <OpsRailMetric label="Follow-ups" value={stats.followUpsDue} tone={stats.followUpsDue ? "warning" : "neutral"}/>
        </OpsKpiRail>

        {notice ? <div className="plan-notice"><OpsNotice tone={duplicates.length ? "warning" : notice.toLowerCase().includes("could not") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice></div> : null}

        {showCreate ? <div ref={createRef} className="plan-panel crm-create"><CreateCustomerForm form={form} setField={setField} tagDraft={tagDraft} setTagDraft={setTagDraft} carrierDraft={carrierDraft} setCarrierDraft={setCarrierDraft} transportDraft={transportDraft} setTransportDraft={setTransportDraft} saving={saving} duplicates={duplicates} advancedOpen={advancedOpen} setAdvancedOpen={setAdvancedOpen} onSubmit={createCustomer} onCancel={() => { setShowCreate(false); setDuplicates([]); }}/></div> : null}

        {customers.length ? <>
          <OpsRegisterToolbar
            search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, contact, branch or tag" aria-label="Search customers"/>}
            actions={<>
              {filtersActive ? <OpsButton size="xs" variant="ghost" onClick={() => { setQuery(""); setStatusFilter("all"); }}>Reset</OpsButton> : null}
              <span className="ops-result-count" aria-live="polite">{filtered.length === customers.length ? `${customers.length} customers` : `${filtered.length} of ${customers.length}`}</span>
            </>}
            tabs={<OpsScopeTabs<CrmAccountStatus | "all"> label="Account status" items={[{ value: "all", label: "All", count: customers.length }, ...crmAccountStatuses.map((status) => ({ value: status, label: crmAccountStatusLabels[status], count: statusCounts[status] }))]} value={statusFilter} onChange={setStatusFilter}/>}
          />
          <div className="crm-saved-views"><SavedFilterViews storageKey="kcpl-customer-saved-views-v1" query={query} status={statusFilter} onApply={(view) => { setQuery(view.query); setStatusFilter(view.status); }}/></div>

          <div className="ops-register-layout" data-inspector={selected ? "open" : undefined}>
            <section className="ops-surface" aria-label="Customer register">
              {filtered.length ? <OpsTableWrap>
                <table className="ops-table ops-register-table crm-table" data-compact={compact || undefined} aria-label="Customers">
                  <thead><tr><th>Customer</th><th>Branch · manager</th><th>Status</th>{compact ? null : <th className="ops-col-num">Quotes</th>}{compact ? null : <th className="ops-col-num">Active jobs</th>}<th className="ops-col-num">Follow-ups</th></tr></thead>
                  <tbody>{filtered.map((customer) => {
                    const chosen = selectedId === customer.id;
                    return <tr key={customer.id} tabIndex={0} data-selected={chosen || undefined} aria-current={chosen || undefined} onClick={() => openCustomer(customer.id)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCustomer(customer.id); } }}>
                      <td><span className="ops-cell-primary ops-cell-clamp" title={customer.display_name}>{customer.display_name}</span><span className="ops-cell-secondary ops-cell-clamp">{customer.primary_email || customer.primary_phone || customer.country}</span></td>
                      <td><span className="ops-cell-primary">{customer.primary_branch}</span><span className="ops-cell-secondary ops-cell-clamp">{customer.account_manager_name || "Unassigned"}</span></td>
                      <td><OpsBadge tone={statusTone(customer.account_status)}>{crmAccountStatusLabels[customer.account_status]}</OpsBadge></td>
                      {compact ? null : <td className="ops-col-num"><span className="ops-num">{customer.quote_count}</span></td>}
                      {compact ? null : <td className="ops-col-num"><span className="ops-num">{customer.active_shipment_count}</span></td>}
                      <td className="ops-col-num">{customer.follow_up_count ? <span className="ops-num crm-follow-ups">{customer.follow_up_count}</span> : <span className="ops-cell-muted">0</span>}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </OpsTableWrap> : <OpsEmptyState compact kind="search" icon={<Users size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No customers match" description="Change the filter or create a customer account." action={<OpsButton variant="secondary" size="sm" onClick={() => { setQuery(""); setStatusFilter("all"); }}>Reset filters</OpsButton>}/>}
              {filtered.length ? <footer className="ops-register-footer"><span>{filtered.length} customer{filtered.length === 1 ? "" : "s"} in this view</span></footer> : null}
            </section>

            {selected ? <CustomerInspector customer={selected} commercialVisible={commercialVisible} inspectorRef={inspectorRef} onClose={() => setSelectedId("")}/> : null}
          </div>
        </> : showCreate ? null : <section className="ops-surface" aria-label="Customers">
          <OpsEmptyState compact kind="setup" icon={<Users size={16} strokeWidth={1.75} aria-hidden="true"/>} title="Add the first KCPL customer" description="Customer accounts connect enquiries, shipments, contacts, commercial terms and activity. Agents, carriers and vendors belong in Partners." action={<OpsButton variant="primary" size="sm" onClick={openNew}>Create customer</OpsButton>}/>
        </section>}
      </div>
    </OpsPage>
  );
}

function CustomerInspector({ customer, commercialVisible, inspectorRef, onClose }: { customer: CrmCustomerSummary; commercialVisible: boolean; inspectorRef: RefObject<HTMLElement | null>; onClose: () => void }) {
  const grossMargin = customer.revenue_total > 0 ? (customer.profit_total / customer.revenue_total) * 100 : 0;
  return <aside ref={inspectorRef} className="ops-inspector" aria-label={`Customer ${customer.display_name}`}>
    <OpsInspectorHeader
      kicker={customer.id}
      title={customer.display_name}
      subtitle={`${customer.primary_email || "No primary email"}${customer.primary_phone ? ` · ${customer.primary_phone}` : ""} · ${customer.country}`}
      actions={<button type="button" className="ops-inspector-close" onClick={onClose} aria-label="Close customer inspector"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
    />
    <div className="ops-inspector-scroll">
      <div className="ops-inspector-body">
        <div className="plan-badges">
          <OpsBadge tone={statusTone(customer.account_status)}>{crmAccountStatusLabels[customer.account_status]}</OpsBadge>
          {customer.relationship_types.map((type) => <OpsBadge key={type}>{crmRelationshipLabels[type]}</OpsBadge>)}
        </div>

        <OpsInspectorSection title="Activity">
          <OpsFacts columns={2}>
            <OpsFact label="Quotes">{customer.quote_count}</OpsFact>
            <OpsFact label="Active shipments">{customer.active_shipment_count}</OpsFact>
            <OpsFact label="Completed jobs">{customer.completed_shipment_count}</OpsFact>
            <OpsFact label="Follow-ups" warning={customer.follow_up_count > 0}>{customer.follow_up_count}</OpsFact>
          </OpsFacts>
        </OpsInspectorSection>

        <OpsInspectorSection title="Relationship">
          <OpsFacts>
            <OpsFact label="Lead stage">{crmLeadStageLabels[customer.lead_stage]}</OpsFact>
            <OpsFact label="Primary branch">{customer.primary_branch}</OpsFact>
            <OpsFact label="Account manager">{customer.account_manager_name || "Unassigned"}</OpsFact>
            <OpsFact label="Manager email">{customer.account_manager_email || "Not set"}</OpsFact>
            <OpsFact label="Manager phone">{customer.account_manager_phone || "Not set"}</OpsFact>
            <OpsFact label="Entity">{customer.entity_kind === "company" ? "Company / organisation" : "Individual"}</OpsFact>
            <OpsFact label="Updated">{customer.updated_at ? new Date(customer.updated_at).toLocaleDateString("en-AU") : "Just created"}</OpsFact>
          </OpsFacts>
          {customer.tags.length ? <div className="plan-badges plan-subform">{customer.tags.map((tag) => <OpsBadge key={tag}>{tag}</OpsBadge>)}</div> : null}
        </OpsInspectorSection>

        {commercialVisible ? <OpsInspectorSection title={`Commercial · ${customer.preferred_currency}`}>
          <OpsFacts>
            <OpsFact label="Revenue">{formatMoney(customer.revenue_total, customer.preferred_currency)}</OpsFact>
            <OpsFact label="Cost">{formatMoney(customer.cost_total, customer.preferred_currency)}</OpsFact>
            <OpsFact label="Gross profit">{formatMoney(customer.profit_total, customer.preferred_currency)}</OpsFact>
            <OpsFact label="Gross margin">{`${grossMargin.toFixed(1)}%`}</OpsFact>
          </OpsFacts>
          <p className="ops-inspector-hint plan-subform">Headline lifetime totals. Full terms and rate cards live in Customer 360.</p>
        </OpsInspectorSection> : null}
      </div>
    </div>
    <footer className="ops-inspector-footer">
      <Link href={`/admin/crm/${encodeURIComponent(customer.id)}`} className="ops-button" data-variant="primary" data-size="sm">Open Customer 360<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true"/></Link>
    </footer>
  </aside>;
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
  return <OpsSurface
    density="compact"
    title="Create CRM record"
    description="Start with identity and ownership. Commercial and operating preferences are available below when useful."
    action={<button type="button" onClick={onCancel} className="ops-inspector-close" aria-label="Close create customer"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
  >
    {duplicates.length ? <div className="crm-duplicates">
      <p className="crm-form-section">Possible existing records</p>
      <p className="ops-inspector-hint">KCPL found similar customer data. Open an existing record first unless this is genuinely a separate relationship.</p>
      <ul className="crm-duplicate-list">{duplicates.map((match) => <li key={`${match.id}-${match.reason}`}><div className="min-w-0"><strong>{match.display_name}</strong><span>Matched by {match.reason}</span></div><Link href={`/admin/crm/${encodeURIComponent(match.id)}`} className="ops-button" data-variant="secondary" data-size="xs">Open existing</Link></li>)}</ul>
    </div> : null}
    <form onSubmit={(event) => onSubmit(event, false)}>
      <p className="crm-form-section">Identity</p>
      <div className="ops-form-grid">
        <OpsField label="Record type"><select value={form.entityKind} onChange={(event) => setField("entityKind", event.target.value as CrmCreateCustomerInput["entityKind"])}>{crmEntityKinds.map((kind) => <option value={kind} key={kind}>{kind === "company" ? "Company / organisation" : "Individual"}</option>)}</select></OpsField>
        <OpsField label="Display name"><input required value={form.displayName} onChange={(event) => setField("displayName", event.target.value)} placeholder="Customer or organisation name"/></OpsField>
        <OpsField label="Legal name"><input value={form.legalName} onChange={(event) => setField("legalName", event.target.value)}/></OpsField>
        <OpsField label="Country"><input value={form.country} onChange={(event) => setField("country", event.target.value)}/></OpsField>
        <OpsField label="Primary email"><input type="email" value={form.primaryEmail} onChange={(event) => setField("primaryEmail", event.target.value)}/></OpsField>
        <OpsField label="Primary phone"><input value={form.primaryPhone} onChange={(event) => setField("primaryPhone", event.target.value)}/></OpsField>
      </div>
      <p className="ops-inspector-hint crm-form-hint">This workspace is for buyers of KCPL services. Operational suppliers and counterparts belong in Partners.</p>

      <p className="crm-form-section">Ownership</p>
      <div className="ops-form-grid">
        <OpsField label="Account status"><select value={form.accountStatus} onChange={(event) => setField("accountStatus", event.target.value as CrmCreateCustomerInput["accountStatus"])}>{crmAccountStatuses.map((status) => <option value={status} key={status}>{crmAccountStatusLabels[status]}</option>)}</select></OpsField>
        <OpsField label="Lead stage"><select value={form.leadStage} onChange={(event) => setField("leadStage", event.target.value as CrmCreateCustomerInput["leadStage"])}>{crmLeadStages.map((stage) => <option value={stage} key={stage}>{crmLeadStageLabels[stage]}</option>)}</select></OpsField>
        <OpsField label="Lead source"><select value={form.leadSource} onChange={(event) => setField("leadSource", event.target.value as CrmCreateCustomerInput["leadSource"])}><option value="">Not set</option>{crmLeadSources.map((source) => <option value={source} key={source}>{source.replaceAll("_", " ")}</option>)}</select></OpsField>
        <OpsField label="Primary branch"><select value={form.primaryBranch} onChange={(event) => setField("primaryBranch", event.target.value as CrmCreateCustomerInput["primaryBranch"])}>{kcplBranches.map((branch) => <option key={branch}>{branch}</option>)}</select></OpsField>
        <OpsField label="Account manager" hint="From People & branches; name, email and phone fill automatically." className="ops-form-wide"><StaffAssignmentPicker branch={form.primaryBranch} value={{ name: form.accountManagerName, email: form.accountManagerEmail, phone: form.accountManagerPhone }} onChange={(staff) => { setField("accountManagerName", staff.name); setField("accountManagerEmail", staff.email); setField("accountManagerPhone", staff.phone); }}/></OpsField>
        <OpsField label="Internal summary" className="ops-form-wide"><textarea value={form.internalSummary} onChange={(event) => setField("internalSummary", event.target.value)} placeholder="What should another KCPL staff member know before speaking with this account?"/></OpsField>
      </div>

      <button type="button" onClick={() => setAdvancedOpen(!advancedOpen)} className="ops-disclosure" aria-expanded={advancedOpen} aria-controls="crm-advanced-fields">
        <span><strong>Commercial & operating details</strong><small>Optional terms, preferences, IDs and tags</small></span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true"/>
      </button>

      {advancedOpen ? <div id="crm-advanced-fields" className="ops-form-grid">
        <OpsField label="Trading name"><input value={form.tradingName} onChange={(event) => setField("tradingName", event.target.value)}/></OpsField>
        <OpsField label="Website"><input value={form.website} onChange={(event) => setField("website", event.target.value)}/></OpsField>
        <OpsField label="Industry"><input value={form.industry} onChange={(event) => setField("industry", event.target.value)}/></OpsField>
        <OpsField label="Tax ID"><input value={form.taxId} onChange={(event) => setField("taxId", event.target.value)}/></OpsField>
        <OpsField label="Billing email"><input type="email" value={form.billingEmail} onChange={(event) => setField("billingEmail", event.target.value)}/></OpsField>
        <OpsField label="Preferred currency"><select value={form.preferredCurrency} onChange={(event) => setField("preferredCurrency", event.target.value as CrmCreateCustomerInput["preferredCurrency"])}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></OpsField>
        <OpsField label="Payment terms (days)"><input inputMode="numeric" value={form.paymentTermsDays} onChange={(event) => setField("paymentTermsDays", event.target.value)}/></OpsField>
        <OpsField label="Credit limit"><input inputMode="decimal" value={form.creditLimit} onChange={(event) => setField("creditLimit", event.target.value)}/></OpsField>
        <OpsField label="Opening outstanding"><input inputMode="decimal" value={form.outstandingBalance} onChange={(event) => setField("outstandingBalance", event.target.value)}/></OpsField>
        <OpsField label="Markup %"><input inputMode="decimal" value={form.markupPercent} onChange={(event) => setField("markupPercent", event.target.value)}/></OpsField>
        <OpsField label="Tags" hint="Comma separated"><input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="vip, garments, air-import"/></OpsField>
        <OpsField label="Preferred carriers" hint="Comma separated"><input value={carrierDraft} onChange={(event) => setCarrierDraft(event.target.value)}/></OpsField>
        <OpsField label="Transport preferences" hint="Comma separated"><input value={transportDraft} onChange={(event) => setTransportDraft(event.target.value)}/></OpsField>
        <OpsField label="Pricing notes" className="ops-form-full"><textarea value={form.pricingNotes} onChange={(event) => setField("pricingNotes", event.target.value)}/></OpsField>
      </div> : null}

      <div className="ops-form-actions">
        {duplicates.length ? <OpsButton type="button" variant="danger" size="sm" disabled={saving} onClick={() => { const synthetic = { preventDefault() {} } as FormEvent<HTMLFormElement>; void onSubmit(synthetic, true); }}>Create anyway</OpsButton> : null}
        <OpsButton type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</OpsButton>
        <OpsButton type="submit" variant="primary" size="sm" disabled={saving}>{saving ? "Creating…" : "Create record"}</OpsButton>
      </div>
    </form>
  </OpsSurface>;
}

