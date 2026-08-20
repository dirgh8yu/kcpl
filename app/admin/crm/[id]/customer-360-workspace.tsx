"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  Check,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  Tags,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  crmAccountStatusLabels,
  crmCommunicationPreferences,
  crmLeadStageLabels,
  crmRelationshipLabels,
  crmTaskPriorities,
  crmTaskPriorityLabels,
  type CrmCustomerDetail,
  type CrmTask,
  type CrmTaskPriority,
} from "../crm-data";
import {
  OpsButton,
  OpsEmptyState,
  OpsMetric,
  OpsMetricStrip,
  OpsPageHeader,
  OpsPanel,
  OpsStatusBadge,
} from "../../operations-ui";

const tabs = ["overview", "contacts", "addresses", "tasks", "activity"] as const;
type CustomerTab = (typeof tabs)[number];

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) return "Not set";
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toLocaleString("en-AU")}`; }
}

function taskSort(tasks: CrmTask[]) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

function accountTone(status: CrmCustomerDetail["account_status"]): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "prospect") return "info";
  if (status === "on_hold") return "warning";
  if (status === "blacklisted") return "danger";
  return "neutral";
}

function priorityTone(priority: CrmTaskPriority): "neutral" | "info" | "warning" | "danger" {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  if (priority === "normal") return "info";
  return "neutral";
}

export function Customer360Workspace({
  initialCustomer,
  userName,
  userEmail,
  commercialVisible,
  creditVisible,
}: {
  initialCustomer: CrmCustomerDetail;
  userName: string;
  userEmail: string;
  commercialVisible: boolean;
  creditVisible: boolean;
}) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [activeTab, setActiveTab] = useState<CustomerTab>("overview");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [note, setNote] = useState("");
  const [contact, setContact] = useState({ name: "", jobTitle: "", email: "", phone: "", communicationPreference: "email", isPrimary: false, notes: "" });
  const [address, setAddress] = useState({ label: "Office", line1: "", line2: "", city: "", stateRegion: "", postalCode: "", country: customer.country || "Nepal", isPrimary: false });
  const [task, setTask] = useState({ title: "", detail: "", dueAt: "", priority: "normal" as CrmTaskPriority, assignedToName: userName, assignedToEmail: userEmail });

  const tasks = useMemo(() => taskSort(customer.tasks), [customer.tasks]);
  const openTasks = tasks.filter((item) => !item.completed);
  const grossMargin = customer.revenue_total > 0 ? (customer.profit_total / customer.revenue_total) * 100 : 0;

  async function refresh() {
    const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customer.id)}`, { cache: "no-store" });
    const data = await response.json() as { ok?: boolean; customer?: CrmCustomerDetail; error?: string };
    if (!response.ok || !data.customer) throw new Error(data.error || "Could not refresh Customer 360.");
    setCustomer(data.customer);
  }

  async function write(path: string, body: Record<string, unknown>, method = "POST") {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customer.id)}/${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "The CRM update could not be saved.");
      await refresh();
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The CRM update could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await write("contacts", contact);
    if (!ok) return;
    setContact({ name: "", jobTitle: "", email: "", phone: "", communicationPreference: "email", isPrimary: false, notes: "" });
    setContactOpen(false);
    setNotice("Contact added.");
  }

  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await write("addresses", address);
    if (!ok) return;
    setAddress({ label: "Office", line1: "", line2: "", city: "", stateRegion: "", postalCode: "", country: customer.country || "Nepal", isPrimary: false });
    setAddressOpen(false);
    setNotice("Address added.");
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) return;
    const ok = await write("notes", { note });
    if (!ok) return;
    setNote("");
    setNotice("Internal note added.");
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await write("tasks", task);
    if (!ok) return;
    setTask({ title: "", detail: "", dueAt: "", priority: "normal", assignedToName: userName, assignedToEmail: userEmail });
    setTaskOpen(false);
    setNotice("Follow-up created.");
  }

  async function toggleTask(item: CrmTask) {
    const ok = await write("tasks", { taskId: item.id, completed: !item.completed }, "PATCH");
    if (ok) setNotice(item.completed ? "Follow-up reopened." : "Follow-up completed.");
  }

  const tabCounts: Partial<Record<CustomerTab, number>> = {
    contacts: customer.contacts.length,
    addresses: customer.addresses.length,
    tasks: openTasks.length,
    activity: customer.activity.length,
  };

  return <main>
    <OpsPageHeader
      eyebrow="Customer 360"
      title={customer.display_name}
      description={`${customer.country} · ${customer.primary_branch} · ${crmLeadStageLabels[customer.lead_stage]}`}
      breadcrumbs={[{ label: "Commercial" }, { label: "Customers", href: "/admin/crm" }, { label: customer.display_name }]}
      meta={<span>{customer.id} · Updated {formatDate(customer.updated_at)}</span>}
      actions={<>{customer.relationship_types.map((type) => <OpsStatusBadge key={type}>{crmRelationshipLabels[type]}</OpsStatusBadge>)}<OpsStatusBadge tone={accountTone(customer.account_status)}>{crmAccountStatusLabels[customer.account_status]}</OpsStatusBadge><OpsButton onClick={() => void refresh()}><RefreshCw size={13}/>Refresh</OpsButton></>}
    />

    <div className="ops-page-body ops-stack">
      <OpsMetricStrip columns={6}>
        <OpsMetric label="Contacts" value={customer.contacts.length} icon={<UsersRound size={13}/>}/>
        <OpsMetric label="Addresses" value={customer.addresses.length} icon={<MapPin size={13}/>}/>
        <OpsMetric label="Open follow-ups" value={openTasks.length} icon={<CalendarClock size={13}/>} tone={openTasks.length ? "warning" : "success"}/>
        <OpsMetric label="Quotes" value={customer.quote_count} icon={<MessageSquareText size={13}/>}/>
        <OpsMetric label="Active shipments" value={customer.active_shipment_count} icon={<Building2 size={13}/>}/>
        <OpsMetric label="Completed jobs" value={customer.completed_shipment_count} icon={<Check size={13}/>} tone="success"/>
      </OpsMetricStrip>

      {notice ? <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e5e8] bg-white px-3.5 py-2.5 text-[11px] text-[#59616a]"><span>{notice}</span><button type="button" onClick={() => setNotice("")} className="font-semibold text-[#6570a7]">Dismiss</button></div> : null}

      <div className="ops-panel overflow-visible">
        <nav className="flex overflow-x-auto border-b border-[#eceef0] px-2" aria-label="Customer record sections">{tabs.map((tab) => { const active = tab === activeTab; const count = tabCounts[tab]; return <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`relative flex h-11 items-center gap-1.5 px-3 text-[11px] font-medium capitalize ${active ? "text-[#303a75]" : "text-[#737b84] hover:text-[#333940]"}`}>{tab}{count !== undefined ? <span className={`rounded px-1.5 py-0.5 text-[9px] ${active ? "bg-[#eef0ff] text-[#5367a8]" : "bg-[#f1f2f3] text-[#8c939b]"}`}>{count}</span> : null}{active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-[#5367d9]"/> : null}</button>; })}</nav>

        <div className="bg-[var(--ops-bg)] p-3 sm:p-4">
          {activeTab === "overview" ? <div className="ops-grid-2">
            <OpsPanel title="Account profile" eyebrow="Relationship" description="Core customer identity and account ownership.">
              <div className="grid gap-x-8 px-4 py-1 sm:grid-cols-2">
                <Info label="Lead stage" value={crmLeadStageLabels[customer.lead_stage]}/><Info label="Primary branch" value={customer.primary_branch}/><Info label="Account manager" value={customer.account_manager_name || "Unassigned"}/><Info label="Primary email" value={customer.primary_email || "Not recorded"}/><Info label="Primary phone" value={customer.primary_phone || "Not recorded"}/><Info label="Country" value={customer.country}/><Info label="Tax ID" value={customer.tax_id || "Not recorded"}/><Info label="Industry" value={customer.industry || "Not recorded"}/>
              </div>
              {customer.tags.length ? <div className="flex flex-wrap gap-1.5 border-t border-[#eceef0] px-4 py-3">{customer.tags.map((tag) => <OpsStatusBadge key={tag}><Tags size={9}/>{tag}</OpsStatusBadge>)}</div> : null}
            </OpsPanel>

            {commercialVisible ? <OpsPanel title="Commercial snapshot" eyebrow="Internal" description="Revenue, cost and credit information available to this role.">
              <div className="divide-y divide-[#eceef0] px-4 py-1"><MoneyLine label="Revenue" value={formatMoney(customer.revenue_total, customer.preferred_currency)}/><MoneyLine label="Cost" value={formatMoney(customer.cost_total, customer.preferred_currency)}/><MoneyLine label="Gross profit" value={formatMoney(customer.profit_total, customer.preferred_currency)} positive={customer.profit_total >= 0}/><MoneyLine label="Gross margin" value={`${grossMargin.toFixed(1)}%`}/>{creditVisible ? <><MoneyLine label="Credit limit" value={formatMoney(customer.commercial.credit_limit, customer.preferred_currency)}/><MoneyLine label="Outstanding" value={formatMoney(customer.commercial.outstanding_balance, customer.preferred_currency)}/><MoneyLine label="Payment terms" value={customer.commercial.payment_terms_days === null ? "Not set" : `${customer.commercial.payment_terms_days} days`}/></> : null}</div>{customer.commercial.pricing_notes ? <div className="border-t border-[#eceef0] px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#858c94]">Pricing notes</p><p className="mt-1 text-[11px] leading-5 text-[#69717a]">{customer.commercial.pricing_notes}</p></div> : null}
            </OpsPanel> : <OpsPanel title="Commercial access" eyebrow="Restricted"><div className="flex items-start gap-3 p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#e2e5e8] bg-[#fafafa] text-[#858c94]"><LockKeyhole size={14}/></span><p className="text-[11px] leading-5 text-[#737b84]">Rates, revenue, costs, profit and customer credit data are not included in this staff session.</p></div></OpsPanel>}
          </div> : null}

          {activeTab === "contacts" ? <OpsPanel title="Contacts" eyebrow="People" description="People KCPL works with at this account." action={<OpsButton onClick={() => setContactOpen((value) => !value)}><Plus size={13}/>Add contact</OpsButton>}>
            {contactOpen ? <form onSubmit={addContact} className="grid gap-3 border-b border-[#eceef0] bg-[#fcfcfc] p-4 sm:grid-cols-2 xl:grid-cols-3"><Field label="Name"><input required value={contact.name} onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))}/></Field><Field label="Role / title"><input value={contact.jobTitle} onChange={(event) => setContact((current) => ({ ...current, jobTitle: event.target.value }))}/></Field><Field label="Email"><input type="email" value={contact.email} onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}/></Field><Field label="Phone"><input value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))}/></Field><Field label="Preferred contact"><select value={contact.communicationPreference} onChange={(event) => setContact((current) => ({ ...current, communicationPreference: event.target.value }))}>{crmCommunicationPreferences.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></Field><label className="flex items-center gap-2 self-end pb-2 text-[11px] font-medium text-[#606871]"><input type="checkbox" checked={contact.isPrimary} onChange={(event) => setContact((current) => ({ ...current, isPrimary: event.target.checked }))}/>Primary contact</label><div className="sm:col-span-2 xl:col-span-3"><Field label="Contact notes"><textarea rows={3} value={contact.notes} onChange={(event) => setContact((current) => ({ ...current, notes: event.target.value }))}/></Field></div><FormButtons busy={busy} onCancel={() => setContactOpen(false)} label="Save contact" className="sm:col-span-2 xl:col-span-3"/></form> : null}
            {customer.contacts.length ? <div className="overflow-x-auto"><table className="ops-dense-table min-w-[760px]"><thead><tr><th className="px-4 text-left">Contact</th><th className="px-3 text-left">Email</th><th className="px-3 text-left">Phone</th><th className="px-3 text-left">Preference</th><th className="px-4 text-right">Type</th></tr></thead><tbody>{customer.contacts.map((item) => <tr key={item.id}><td className="px-4"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#f1f2f4] text-[#7a828b]"><UserRound size={12}/></span><div><strong className="font-medium">{item.name}</strong><p className="mt-0.5 text-[9px] text-[#979ea5]">{item.job_title || "Contact"}</p></div></div></td><td className="px-3">{item.email ? <a href={`mailto:${item.email}`} className="inline-flex items-center gap-1.5 text-[#5367a8]"><Mail size={11}/>{item.email}</a> : "—"}</td><td className="px-3">{item.phone ? <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1.5"><Phone size={11}/>{item.phone}</a> : "—"}</td><td className="px-3 capitalize">{item.communication_preference?.replaceAll("_", " ") || "—"}</td><td className="px-4 text-right">{item.is_primary ? <OpsStatusBadge tone="success">Primary</OpsStatusBadge> : <OpsStatusBadge>Contact</OpsStatusBadge>}</td></tr>)}</tbody></table></div> : <OpsEmptyState compact title="No contacts saved" detail="Add the people KCPL communicates with at this account."/>}
          </OpsPanel> : null}

          {activeTab === "addresses" ? <OpsPanel title="Saved addresses" eyebrow="Locations" description="Office, warehouse, billing, pickup and delivery addresses." action={<OpsButton onClick={() => setAddressOpen((value) => !value)}><Plus size={13}/>Add address</OpsButton>}>
            {addressOpen ? <form onSubmit={addAddress} className="grid gap-3 border-b border-[#eceef0] bg-[#fcfcfc] p-4 sm:grid-cols-2 xl:grid-cols-3"><Field label="Label"><input required value={address.label} onChange={(event) => setAddress((current) => ({ ...current, label: event.target.value }))}/></Field><Field label="Country"><input required value={address.country} onChange={(event) => setAddress((current) => ({ ...current, country: event.target.value }))}/></Field><Field label="City"><input required value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))}/></Field><div className="sm:col-span-2 xl:col-span-3"><Field label="Address line 1"><input required value={address.line1} onChange={(event) => setAddress((current) => ({ ...current, line1: event.target.value }))}/></Field></div><div className="sm:col-span-2 xl:col-span-3"><Field label="Address line 2"><input value={address.line2} onChange={(event) => setAddress((current) => ({ ...current, line2: event.target.value }))}/></Field></div><Field label="State / region"><input value={address.stateRegion} onChange={(event) => setAddress((current) => ({ ...current, stateRegion: event.target.value }))}/></Field><Field label="Postal code"><input value={address.postalCode} onChange={(event) => setAddress((current) => ({ ...current, postalCode: event.target.value }))}/></Field><label className="flex items-center gap-2 self-end pb-2 text-[11px] font-medium text-[#606871]"><input type="checkbox" checked={address.isPrimary} onChange={(event) => setAddress((current) => ({ ...current, isPrimary: event.target.checked }))}/>Primary address</label><FormButtons busy={busy} onCancel={() => setAddressOpen(false)} label="Save address" className="sm:col-span-2 xl:col-span-3"/></form> : null}
            {customer.addresses.length ? <div className="grid gap-px bg-[#eceef0] sm:grid-cols-2 xl:grid-cols-3">{customer.addresses.map((item) => <div key={item.id} className="bg-white p-4"><div className="flex items-center justify-between gap-2"><strong className="text-xs font-semibold">{item.label}</strong>{item.is_primary ? <OpsStatusBadge tone="success">Primary</OpsStatusBadge> : null}</div><p className="mt-2 text-[11px] leading-5 text-[#69717a]">{item.line1}{item.line2 ? <><br/>{item.line2}</> : null}<br/>{item.city}{item.state_region ? `, ${item.state_region}` : ""}{item.postal_code ? ` ${item.postal_code}` : ""}<br/>{item.country}</p></div>)}</div> : <OpsEmptyState compact title="No saved addresses" detail="Save recurring office, warehouse or delivery locations here."/>}
          </OpsPanel> : null}

          {activeTab === "tasks" ? <OpsPanel title="Follow-ups" eyebrow="Account work queue" description={`${openTasks.length} open follow-up${openTasks.length === 1 ? "" : "s"}.`} action={<OpsButton onClick={() => setTaskOpen((value) => !value)}><Plus size={13}/>New task</OpsButton>}>
            {taskOpen ? <form onSubmit={addTask} className="grid gap-3 border-b border-[#eceef0] bg-[#fcfcfc] p-4 sm:grid-cols-2 xl:grid-cols-3"><Field label="Task"><input required value={task.title} onChange={(event) => setTask((current) => ({ ...current, title: event.target.value }))}/></Field><Field label="Due"><input type="datetime-local" value={task.dueAt} onChange={(event) => setTask((current) => ({ ...current, dueAt: event.target.value }))}/></Field><Field label="Priority"><select value={task.priority} onChange={(event) => setTask((current) => ({ ...current, priority: event.target.value as CrmTaskPriority }))}>{crmTaskPriorities.map((priority) => <option key={priority} value={priority}>{crmTaskPriorityLabels[priority]}</option>)}</select></Field><Field label="Assigned to"><input value={task.assignedToName} onChange={(event) => setTask((current) => ({ ...current, assignedToName: event.target.value }))}/></Field><Field label="Assignee email"><input type="email" value={task.assignedToEmail} onChange={(event) => setTask((current) => ({ ...current, assignedToEmail: event.target.value }))}/></Field><div className="sm:col-span-2 xl:col-span-3"><Field label="Detail"><textarea rows={3} value={task.detail} onChange={(event) => setTask((current) => ({ ...current, detail: event.target.value }))}/></Field></div><FormButtons busy={busy} onCancel={() => setTaskOpen(false)} label="Create follow-up" className="sm:col-span-2 xl:col-span-3"/></form> : null}
            {tasks.length ? <div className="divide-y divide-[#eceef0]">{tasks.map((item) => <TaskRow key={item.id} task={item} busy={busy} onToggle={() => void toggleTask(item)}/>)}</div> : <OpsEmptyState compact title="No follow-ups" detail="Create a task for quote follow-up, documentation or account actions."/>}
          </OpsPanel> : null}

          {activeTab === "activity" ? <div className="ops-grid-2">
            <OpsPanel title="Internal notes" eyebrow="Private account context">
              <form onSubmit={addNote} className="border-b border-[#eceef0] p-4"><Field label="Add note"><textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Relationship context, operating preferences, special instructions…"/></Field><div className="mt-2 flex justify-end"><OpsButton tone="primary" type="submit" disabled={busy || !note.trim()}>Add note</OpsButton></div></form>{customer.notes.length ? <div className="divide-y divide-[#eceef0]">{customer.notes.map((item) => <div key={item.id} className="px-4 py-3"><p className="text-[11px] leading-5 text-[#4f575f]">{item.note}</p><p className="mt-1.5 text-[9px] text-[#989fa6]">{item.author_name} · {formatDate(item.created_at)}</p></div>)}</div> : <OpsEmptyState compact title="No internal notes"/>}
            </OpsPanel>
            <OpsPanel title="Activity timeline" eyebrow="Institutional memory">
              {customer.activity.length ? <div className="px-4 py-2">{customer.activity.map((item, index) => <div key={item.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3"><div className="flex flex-col items-center"><span className="mt-3 h-2 w-2 rounded-full bg-[#6878c5]"/>{index < customer.activity.length - 1 ? <span className="min-h-10 w-px flex-1 bg-[#e4e6e9]"/> : null}</div><div className="py-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[11px] font-medium text-[#343a40]">{item.title}</strong><span className="text-[9px] text-[#989fa6]">{formatDate(item.created_at)}</span></div>{item.detail ? <p className="mt-1 text-[10px] leading-5 text-[#737b84]">{item.detail}</p> : null}{item.actor_name ? <p className="mt-1 text-[9px] text-[#a0a6ac]">{item.actor_name}</p> : null}</div></div>)}</div> : <OpsEmptyState compact title="No activity yet" detail="CRM activity will appear here as the account is used."/>}
            </OpsPanel>
          </div> : null}
        </div>
      </div>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#69717a]">{label}</span>{children}</label>;
}

function FormButtons({ busy, onCancel, label, className = "" }: { busy: boolean; onCancel: () => void; label: string; className?: string }) {
  return <div className={`flex justify-end gap-2 ${className}`}><OpsButton type="button" onClick={onCancel}>Cancel</OpsButton><OpsButton tone="primary" type="submit" disabled={busy}>{busy ? "Saving…" : label}</OpsButton></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[#eceef0] py-3 text-[11px]"><span className="text-[#858c94]">{label}</span><strong className="max-w-[62%] text-right font-medium text-[#414850]">{value}</strong></div>;
}

function MoneyLine({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return <div className="flex items-center justify-between gap-4 py-3 text-[11px]"><span className="text-[#858c94]">{label}</span><strong className={`font-semibold ${positive === true ? "text-[#397052]" : positive === false ? "text-[#9a4d55]" : "text-[#343a40]"}`}>{value}</strong></div>;
}

function TaskRow({ task, busy, onToggle }: { task: CrmTask; busy: boolean; onToggle: () => void }) {
  const overdue = !task.completed && task.due_at ? new Date(task.due_at).getTime() < Date.now() : false;
  return <div className={`flex items-start gap-3 px-4 py-3 ${task.completed ? "bg-[#fbfcfb]" : overdue ? "bg-[#fdf8f8]" : "bg-white"}`}><button type="button" disabled={busy} onClick={onToggle} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${task.completed ? "border-[#bdd7c6] bg-[#edf6f0] text-[#47765b]" : "border-[#d8dce0] bg-white text-transparent hover:border-[#aeb5bd]"}`} aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}><Check size={11}/></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className={`text-xs font-medium ${task.completed ? "text-[#7f878f] line-through" : "text-[#30363d]"}`}>{task.title}</strong><OpsStatusBadge tone={priorityTone(task.priority)}>{crmTaskPriorityLabels[task.priority]}</OpsStatusBadge>{overdue ? <OpsStatusBadge tone="danger">Overdue</OpsStatusBadge> : null}</div>{task.detail ? <p className="mt-1 text-[11px] leading-5 text-[#737b84]">{task.detail}</p> : null}<div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#969da4]"><span>{task.due_at ? formatDate(task.due_at) : "No due date"}</span>{task.assigned_to_name ? <span>{task.assigned_to_name}</span> : null}</div></div></div>;
}
