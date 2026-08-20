"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeDollarSign,
  Building2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Filter,
  Globe2,
  Plus,
  Search,
  Sparkles,
  Tags,
  UserRound,
  UsersRound,
} from "lucide-react";
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

const statusStyle: Record<CrmAccountStatus, string> = {
  prospect: "border-sky-200 bg-sky-50 text-sky-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  dormant: "border-stone-200 bg-stone-100 text-stone-600",
  on_hold: "border-amber-200 bg-amber-50 text-amber-800",
  blacklisted: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-AU")}`;
  }
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

export function CrmDashboard({
  initialCustomers,
  initialStats,
  userName,
  userEmail,
}: {
  initialCustomers: CrmCustomerSummary[];
  initialStats: CrmDashboardStats;
  userName: string;
  userEmail: string;
}) {
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
      return [
        customer.id,
        customer.display_name,
        customer.legal_name ?? "",
        customer.primary_email ?? "",
        customer.primary_phone ?? "",
        customer.country,
        customer.primary_branch,
        customer.account_manager_name ?? "",
        customer.tags.join(" "),
        customer.relationship_types.join(" "),
      ].join(" ").toLowerCase().includes(needle);
    });
  }, [customers, query, statusFilter]);

  function setField<K extends keyof CrmCreateCustomerInput>(key: K, value: CrmCreateCustomerInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDuplicates([]);
  }

  function toggleRelationship(type: CrmRelationshipType) {
    setForm((current) => {
      const exists = current.relationshipTypes.includes(type);
      const relationshipTypes = exists
        ? current.relationshipTypes.filter((item) => item !== type)
        : [...current.relationshipTypes, type];
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
    setNotice("");
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>, allowDuplicate = false) {
    event.preventDefault();
    setSaving(true);
    setNotice("");

    try {
      const payload = {
        ...form,
        tags: csv(tagDraft),
        preferredCarriers: csv(carrierDraft),
        transportPreferences: csv(transportDraft),
        allowDuplicate,
      };
      const response = await fetch("/api/admin/crm/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as {
        ok?: boolean;
        customer?: CrmCustomerSummary;
        error?: string;
        code?: string;
        duplicates?: CrmDuplicateMatch[];
      };

      if (response.status === 409 && data.code === "possible_duplicate") {
        setDuplicates(data.duplicates ?? []);
        setNotice("Possible duplicate found. Review it before creating another record.");
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

  return (
    <main className="min-h-screen bg-[#f4f1e9] text-[#10263f]">
      <header className="border-b border-white/10 bg-[#0b1724] px-5 py-5 text-white lg:px-8">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <Link href="/admin" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Back to quote desk">
              <ArrowLeft size={17} />
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#d4ad62]">KCPL Operations</p>
              <h1 className="mt-1 text-2xl font-black tracking-[-.035em]">Customer command centre</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs text-white/55 sm:block"><p>CRM operator</p><strong className="text-white">{userName}</strong></div>
            <button type="button" onClick={() => { setShowCreate(true); setDuplicates([]); }} className="flex items-center gap-2 rounded-xl bg-[#d4ad62] px-4 py-2.5 text-xs font-black text-[#10263f] transition hover:-translate-y-0.5 hover:bg-[#e1bd76]">
              <Plus size={15} /> New record
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-black/10 bg-[#10263f] px-5 py-5 text-white lg:px-8">
        <div className="mx-auto grid max-w-[1680px] grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Metric label="CRM records" value={stats.total} />
          <Metric label="Prospects" value={stats.prospects} />
          <Metric label="Active" value={stats.active} />
          <Metric label="Dormant" value={stats.dormant} />
          <Metric label="On hold" value={stats.onHold} />
          <Metric label="Blacklisted" value={stats.blacklisted} />
          <Metric label="Follow-ups" value={stats.followUpsDue} accent />
        </div>
      </section>

      <div className="mx-auto grid max-w-[1680px] xl:min-h-[calc(100vh-190px)] xl:grid-cols-[390px_1fr]">
        <aside className="border-r border-black/10 bg-white">
          <div className="sticky top-0 z-10 border-b border-black/10 bg-white p-5">
            <div className="relative">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers, agents, tags" className="w-full rounded-xl border border-black/10 bg-[#f8f7f2] py-3 pl-10 pr-3 text-sm outline-none transition focus:border-[#b78a3e]" />
            </div>
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              <Filter size={13} className="shrink-0 text-black/30" />
              <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</FilterChip>
              {crmAccountStatuses.map((status) => <FilterChip key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>{crmAccountStatusLabels[status]}</FilterChip>)}
            </div>
          </div>

          <div className="divide-y divide-black/10">
            {filtered.length === 0 ? <div className="p-8 text-sm leading-6 text-black/45">No CRM records match this view.</div> : null}
            {filtered.map((customer) => (
              <button key={customer.id} type="button" onClick={() => { setSelectedId(customer.id); setShowCreate(false); setNotice(""); }} className={`block w-full p-5 text-left transition ${selectedId === customer.id && !showCreate ? "bg-[#f4f1e9]" : "hover:bg-[#faf9f5]"}`}>
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#10263f] text-white">
                    {customer.entity_kind === "company" ? <Building2 size={17} /> : <UserRound size={17} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="truncate text-sm">{customer.display_name}</strong>
                      <ChevronRight size={15} className="mt-0.5 shrink-0 text-black/25" />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[.1em] ${statusStyle[customer.account_status]}`}>{crmAccountStatusLabels[customer.account_status]}</span>
                      <span className="text-[10px] font-bold text-black/40">{customer.primary_branch}</span>
                    </div>
                    <p className="mt-2 truncate text-xs text-black/50">{customer.primary_email || customer.primary_phone || customer.country}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="p-5 lg:p-8 xl:p-10">
          {notice ? <div className="mb-5 rounded-2xl border border-[#d4ad62]/35 bg-[#fff8e8] px-4 py-3 text-sm font-bold text-[#6d5427]">{notice}</div> : null}
          {showCreate ? (
            <CreateCustomerForm
              form={form}
              setField={setField}
              toggleRelationship={toggleRelationship}
              tagDraft={tagDraft}
              setTagDraft={setTagDraft}
              carrierDraft={carrierDraft}
              setCarrierDraft={setCarrierDraft}
              transportDraft={transportDraft}
              setTransportDraft={setTransportDraft}
              saving={saving}
              duplicates={duplicates}
              onSubmit={createCustomer}
              onCancel={() => { setShowCreate(false); setDuplicates([]); }}
            />
          ) : selected ? (
            <CustomerOverview customer={selected} onNew={() => setShowCreate(true)} />
          ) : (
            <EmptyCrm onNew={() => setShowCreate(true)} />
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${accent ? "border-[#d4ad62]/45 bg-[#d4ad62]/10" : "border-white/10 bg-white/[.035]"}`}><p className="text-[9px] font-black uppercase tracking-[.16em] text-white/45">{label}</p><p className={`mt-2 text-2xl font-black ${accent ? "text-[#e0bd79]" : "text-white"}`}>{value}</p></div>;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-black transition ${active ? "border-[#10263f] bg-[#10263f] text-white" : "border-black/10 bg-[#f4f1e9] text-black/55 hover:bg-[#ece7dc]"}`}>{children}</button>;
}

function CustomerOverview({ customer, onNew }: { customer: CrmCustomerSummary; onNew: () => void }) {
  const grossMargin = customer.revenue_total > 0 ? (customer.profit_total / customer.revenue_total) * 100 : 0;
  return (
    <div className="mx-auto max-w-6xl">
      <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/10 bg-[linear-gradient(135deg,#10263f,#173958)] p-7 text-white sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#d4ad62]">Customer 360 · {customer.id}</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-.045em] sm:text-4xl">{customer.display_name}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {customer.relationship_types.map((type) => <span key={type} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.1em] text-white/80">{crmRelationshipLabels[type]}</span>)}
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[.1em] ${statusStyle[customer.account_status]}`}>{crmAccountStatusLabels[customer.account_status]}</span>
              </div>
            </div>
            <button type="button" onClick={onNew} className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-black transition hover:bg-white/15"><Plus size={14}/> New record</button>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.4fr_.9fr]">
          <div className="p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewStat icon={<BadgeDollarSign size={16}/>} label="Quotes" value={customer.quote_count} />
              <OverviewStat icon={<Globe2 size={16}/>} label="Active shipments" value={customer.active_shipment_count} />
              <OverviewStat icon={<Sparkles size={16}/>} label="Completed jobs" value={customer.completed_shipment_count} />
              <OverviewStat icon={<Clock3 size={16}/>} label="Follow-ups" value={customer.follow_up_count} />
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <InfoCard title="Relationship">
                <InfoLine label="Lead stage" value={crmLeadStageLabels[customer.lead_stage]} />
                <InfoLine label="Primary branch" value={customer.primary_branch} />
                <InfoLine label="Account manager" value={customer.account_manager_name || "Unassigned"} />
                <InfoLine label="Country" value={customer.country} />
              </InfoCard>
              <InfoCard title="Contact">
                <InfoLine label="Email" value={customer.primary_email || "Not recorded"} />
                <InfoLine label="Phone" value={customer.primary_phone || "Not recorded"} />
                <InfoLine label="Entity" value={customer.entity_kind === "company" ? "Company / organisation" : "Individual"} />
                <InfoLine label="Updated" value={customer.updated_at ? new Date(customer.updated_at).toLocaleDateString("en-AU") : "Just created"} />
              </InfoCard>
            </div>

            <div className="mt-5 rounded-2xl border border-black/10 bg-[#faf9f5] p-5">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-black/45"><Tags size={14}/> Tags</div>
              <div className="mt-3 flex flex-wrap gap-2">{customer.tags.length ? customer.tags.map((tag) => <span key={tag} className="rounded-full bg-[#10263f] px-3 py-1.5 text-[10px] font-black text-white">{tag}</span>) : <span className="text-sm text-black/40">No tags yet.</span>}</div>
            </div>
          </div>

          <aside className="border-t border-black/10 bg-[#f8f6ef] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#8b6b32]">Commercial snapshot</p>
            <p className="mt-2 text-xs leading-5 text-black/45">Sensitive commercial fields are designed for management, accounts and explicitly authorised staff.</p>
            <div className="mt-6 space-y-4">
              <MoneyLine label="Revenue" value={formatMoney(customer.revenue_total, customer.preferred_currency)} />
              <MoneyLine label="Cost" value={formatMoney(customer.cost_total, customer.preferred_currency)} />
              <MoneyLine label="Gross profit" value={formatMoney(customer.profit_total, customer.preferred_currency)} strong />
              <MoneyLine label="Gross margin" value={`${grossMargin.toFixed(1)}%`} />
            </div>
            <div className="mt-8 rounded-2xl border border-dashed border-black/15 bg-white/70 p-5">
              <p className="text-xs font-black">Next CRM slice</p>
              <p className="mt-2 text-xs leading-5 text-black/50">Contacts, saved addresses, customer notes, tasks, activity, rate cards, documents and linked quote/shipment history plug into this Customer 360 record.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function OverviewStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-2xl border border-black/10 p-4"><div className="flex items-center gap-2 text-black/35">{icon}<span className="text-[9px] font-black uppercase tracking-[.14em]">{label}</span></div><p className="mt-3 text-2xl font-black">{value}</p></div>;
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-black/10 p-5"><p className="text-[10px] font-black uppercase tracking-[.17em] text-black/35">{title}</p><div className="mt-4 divide-y divide-black/10">{children}</div></div>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-5 py-3 text-xs"><span className="text-black/45">{label}</span><strong className="text-right">{value}</strong></div>;
}

function MoneyLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-4 border-b border-black/10 pb-4 text-sm"><span className="text-black/45">{label}</span><strong className={strong ? "text-lg text-emerald-700" : ""}>{value}</strong></div>;
}

function EmptyCrm({ onNew }: { onNew: () => void }) {
  return <div className="mx-auto grid min-h-[520px] max-w-3xl place-items-center rounded-[28px] border border-dashed border-black/15 bg-white/60 p-10 text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#10263f] text-white"><UsersRound size={26}/></div><h2 className="mt-6 text-3xl font-black tracking-[-.04em]">Build the customer graph.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-black/50">Companies, individuals, overseas agents, suppliers and partners will live here with their quotes, shipments, contacts, commercial terms and operational history.</p><button type="button" onClick={onNew} className="mt-6 rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white">Create first CRM record</button></div></div>;
}

function CreateCustomerForm({
  form,
  setField,
  toggleRelationship,
  tagDraft,
  setTagDraft,
  carrierDraft,
  setCarrierDraft,
  transportDraft,
  setTransportDraft,
  saving,
  duplicates,
  onSubmit,
  onCancel,
}: {
  form: CrmCreateCustomerInput;
  setField: <K extends keyof CrmCreateCustomerInput>(key: K, value: CrmCreateCustomerInput[K]) => void;
  toggleRelationship: (type: CrmRelationshipType) => void;
  tagDraft: string;
  setTagDraft: (value: string) => void;
  carrierDraft: string;
  setCarrierDraft: (value: string) => void;
  transportDraft: string;
  setTransportDraft: (value: string) => void;
  saving: boolean;
  duplicates: CrmDuplicateMatch[];
  onSubmit: (event: FormEvent<HTMLFormElement>, allowDuplicate?: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={(event) => onSubmit(event)} className="mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-sm">
      <div className="border-b border-black/10 bg-[#10263f] p-7 text-white sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#d4ad62]">New CRM record</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-.04em]">Create the customer once. Reuse it everywhere.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">This record becomes the anchor for contacts, quotes, shipments, documents, follow-ups, pricing and credit control.</p>
      </div>

      <div className="space-y-8 p-6 sm:p-8">
        {duplicates.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900"><div className="flex gap-3"><CircleAlert className="mt-0.5 shrink-0" size={18}/><div><p className="text-sm font-black">Possible duplicate detected</p><div className="mt-2 space-y-1 text-xs">{duplicates.map((match) => <p key={match.id}><strong>{match.display_name}</strong> · matches {match.reason.replace("_", " ")} · {match.id}</p>)}</div><button type="button" disabled={saving} onClick={(event) => onSubmit(event as unknown as FormEvent<HTMLFormElement>, true)} className="mt-4 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-black">Create anyway</button></div></div></div> : null}

        <FormSection title="Identity" detail="Who this record represents and how KCPL relates to them.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Record type"><select value={form.entityKind} onChange={(event) => setField("entityKind", event.target.value as CrmCreateCustomerInput["entityKind"])} className="crm-input">{crmEntityKinds.map((kind) => <option key={kind} value={kind}>{kind === "company" ? "Company / organisation" : "Individual"}</option>)}</select></Field>
            <Field label="Display name"><input required value={form.displayName} onChange={(event) => setField("displayName", event.target.value)} className="crm-input" placeholder="e.g. Himalayan Traders Pvt Ltd" /></Field>
            <Field label="Legal name"><input value={form.legalName} onChange={(event) => setField("legalName", event.target.value)} className="crm-input" placeholder="Registered legal name" /></Field>
            <Field label="Trading name"><input value={form.tradingName} onChange={(event) => setField("tradingName", event.target.value)} className="crm-input" placeholder="Trading / brand name" /></Field>
          </div>
          <div className="mt-5"><p className="mb-2 text-[10px] font-black uppercase tracking-[.15em] text-black/45">Relationship types</p><div className="flex flex-wrap gap-2">{crmRelationshipTypes.map((type) => { const active = form.relationshipTypes.includes(type); return <button key={type} type="button" onClick={() => toggleRelationship(type)} className={`rounded-full border px-3 py-2 text-[10px] font-black transition ${active ? "border-[#10263f] bg-[#10263f] text-white" : "border-black/10 bg-[#f8f7f2] text-black/50"}`}>{crmRelationshipLabels[type]}</button>; })}</div></div>
        </FormSection>

        <FormSection title="Sales & ownership" detail="Pipeline, source, branch and the KCPL person responsible.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Account status"><select value={form.accountStatus} onChange={(event) => setField("accountStatus", event.target.value as CrmCreateCustomerInput["accountStatus"])} className="crm-input">{crmAccountStatuses.map((status) => <option key={status} value={status}>{crmAccountStatusLabels[status]}</option>)}</select></Field>
            <Field label="Lead stage"><select value={form.leadStage} onChange={(event) => setField("leadStage", event.target.value as CrmCreateCustomerInput["leadStage"])} className="crm-input">{crmLeadStages.map((stage) => <option key={stage} value={stage}>{crmLeadStageLabels[stage]}</option>)}</select></Field>
            <Field label="Lead source"><select value={form.leadSource} onChange={(event) => setField("leadSource", event.target.value as CrmCreateCustomerInput["leadSource"])} className="crm-input"><option value="">Not recorded</option>{crmLeadSources.map((source) => <option key={source} value={source}>{source.replaceAll("_", " ")}</option>)}</select></Field>
            <Field label="Primary branch"><select value={form.primaryBranch} onChange={(event) => setField("primaryBranch", event.target.value as CrmCreateCustomerInput["primaryBranch"])} className="crm-input">{kcplBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></Field>
            <Field label="Account manager"><input value={form.accountManagerName} onChange={(event) => setField("accountManagerName", event.target.value)} className="crm-input" /></Field>
            <Field label="Manager email"><input type="email" value={form.accountManagerEmail} onChange={(event) => setField("accountManagerEmail", event.target.value)} className="crm-input" /></Field>
          </div>
        </FormSection>

        <FormSection title="Contact & business" detail="Primary contact channels and business identifiers used for matching and operations.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Primary email"><input type="email" value={form.primaryEmail} onChange={(event) => setField("primaryEmail", event.target.value)} className="crm-input" placeholder="contact@company.com" /></Field>
            <Field label="Primary phone"><input value={form.primaryPhone} onChange={(event) => setField("primaryPhone", event.target.value)} className="crm-input" placeholder="+977…" /></Field>
            <Field label="Billing email"><input type="email" value={form.billingEmail} onChange={(event) => setField("billingEmail", event.target.value)} className="crm-input" /></Field>
            <Field label="Country"><input value={form.country} onChange={(event) => setField("country", event.target.value)} className="crm-input" /></Field>
            <Field label="Industry"><input value={form.industry} onChange={(event) => setField("industry", event.target.value)} className="crm-input" placeholder="Importer, manufacturer…" /></Field>
            <Field label="PAN / VAT / Tax ID"><input value={form.taxId} onChange={(event) => setField("taxId", event.target.value)} className="crm-input" /></Field>
            <Field label="Website"><input value={form.website} onChange={(event) => setField("website", event.target.value)} className="crm-input" placeholder="https://" /></Field>
            <Field label="Tags"><input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} className="crm-input" placeholder="VIP, China Trade, Importer" /></Field>
            <Field label="Transport preferences"><input value={transportDraft} onChange={(event) => setTransportDraft(event.target.value)} className="crm-input" placeholder="Sea freight, Air freight" /></Field>
          </div>
        </FormSection>

        <FormSection title="Commercial & credit" detail="Management/accounts fields. These will sit behind role-based commercial permissions as staff roles expand.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Account currency"><select value={form.preferredCurrency} onChange={(event) => setField("preferredCurrency", event.target.value as CrmCreateCustomerInput["preferredCurrency"])} className="crm-input">{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></Field>
            <Field label="Payment terms (days)"><input inputMode="numeric" value={form.paymentTermsDays} onChange={(event) => setField("paymentTermsDays", event.target.value)} className="crm-input" placeholder="30" /></Field>
            <Field label="Credit limit"><input inputMode="decimal" value={form.creditLimit} onChange={(event) => setField("creditLimit", event.target.value)} className="crm-input" placeholder="0.00" /></Field>
            <Field label="Outstanding balance"><input inputMode="decimal" value={form.outstandingBalance} onChange={(event) => setField("outstandingBalance", event.target.value)} className="crm-input" placeholder="0.00" /></Field>
            <Field label="Default markup %"><input inputMode="decimal" value={form.markupPercent} onChange={(event) => setField("markupPercent", event.target.value)} className="crm-input" placeholder="15" /></Field>
            <Field label="Preferred carriers"><input value={carrierDraft} onChange={(event) => setCarrierDraft(event.target.value)} className="crm-input" placeholder="Carrier A, Carrier B" /></Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Pricing / rate notes"><textarea value={form.pricingNotes} onChange={(event) => setField("pricingNotes", event.target.value)} className="crm-input min-h-28 resize-y" placeholder="Negotiated rates, markup rules, agreed lanes…" /></Field>
            <Field label="Internal account summary"><textarea value={form.internalSummary} onChange={(event) => setField("internalSummary", event.target.value)} className="crm-input min-h-28 resize-y" placeholder="Operational preferences, relationship context, special instructions…" /></Field>
          </div>
        </FormSection>

        <div className="flex flex-wrap justify-end gap-3 border-t border-black/10 pt-6">
          <button type="button" onClick={onCancel} className="rounded-xl border border-black/10 px-5 py-3 text-sm font-black">Cancel</button>
          <button type="submit" disabled={saving || form.relationshipTypes.length === 0} className="rounded-xl bg-[#10263f] px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Creating…" : "Create CRM record"}</button>
        </div>
      </div>
      <style jsx global>{`.crm-input{min-height:46px;width:100%;border:1px solid rgba(0,0,0,.1);border-radius:12px;background:#f8f7f2;padding:11px 12px;font-size:13px;color:#10263f;outline:none;transition:border-color .2s,box-shadow .2s}.crm-input:focus{border-color:#b78a3e;box-shadow:0 0 0 3px rgba(183,138,62,.1)}`}</style>
    </form>
  );
}

function FormSection({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return <section><div className="mb-5"><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-black/45">{detail}</p></div>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[.13em] text-black/45">{label}</span>{children}</label>;
}
