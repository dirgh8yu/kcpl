"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
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
import type { CrmCustomerFinanceSnapshot } from "../crm-customer-finance";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsStat, OpsStatStrip, OpsSurface } from "../../operations-ui";
import { StaffAssignmentPicker } from "../../staff-assignment-picker";

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
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

export function Customer360Workspace({ initialCustomer, initialFinanceSnapshot, userName, userEmail, commercialVisible, creditVisible }: { initialCustomer: CrmCustomerDetail; initialFinanceSnapshot: CrmCustomerFinanceSnapshot | null; userName: string; userEmail: string; commercialVisible: boolean; creditVisible: boolean }) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [financeSnapshot, setFinanceSnapshot] = useState(initialFinanceSnapshot);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [note, setNote] = useState("");
  const [contact, setContact] = useState({ name: "", jobTitle: "", email: "", phone: "", communicationPreference: "email", isPrimary: false, notes: "" });
  const [address, setAddress] = useState({ label: "Office", line1: "", line2: "", city: "", stateRegion: "", postalCode: "", country: customer.country || "Nepal", isPrimary: false });
  const [task, setTask] = useState({ title: "", detail: "", dueAt: "", priority: "normal" as CrmTaskPriority, assignedToName: userName, assignedToEmail: userEmail, assignedToPhone: "" });

  const tasks = useMemo(() => taskSort(customer.tasks), [customer.tasks]);
  const openTasks = tasks.filter((item) => !item.completed);
  const overdueTasks = openTasks.filter((item) => item.due_at && new Date(item.due_at).getTime() < Date.now());
  const financeRevenue = financeSnapshot?.revenue_total ?? customer.revenue_total;
  const financeCost = financeSnapshot?.cost_total ?? customer.cost_total;
  const financeProfit = financeSnapshot?.profit_total ?? customer.profit_total;
  const financeOutstanding = financeSnapshot?.outstanding_total ?? customer.commercial.outstanding_balance ?? 0;
  const creditLimit = customer.commercial.credit_limit;
  const availableCredit = creditLimit === null ? null : creditLimit - financeOutstanding;
  const creditOverLimit = creditLimit !== null && financeOutstanding > creditLimit;
  const grossMargin = financeSnapshot?.gross_margin_percent ?? (financeRevenue > 0 ? (financeProfit / financeRevenue) * 100 : 0);
  const accountRisk = customer.account_status === "blacklisted"
    ? "This account is blacklisted. New commercial commitments should not proceed."
    : customer.account_status === "on_hold"
      ? "This account is on credit hold. Accounts or Management must clear the hold before new exposure."
      : creditOverLimit
        ? "Outstanding receivables exceed the approved credit limit."
        : financeSnapshot && financeSnapshot.overdue_total > 0
          ? `${financeSnapshot.overdue_invoice_count} overdue invoice${financeSnapshot.overdue_invoice_count === 1 ? "" : "s"} require Accounts follow-up.`
          : null;

  async function refresh() {
    const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customer.id)}`, { cache: "no-store" });
    const data = await response.json() as { customer?: CrmCustomerDetail; financeSnapshot?: CrmCustomerFinanceSnapshot | null; error?: string };
    if (!response.ok || !data.customer) throw new Error(data.error || "Could not refresh Customer 360.");
    setCustomer(data.customer);
    setFinanceSnapshot(data.financeSnapshot ?? null);
  }

  async function write(path: string, body: Record<string, unknown>, method = "POST") {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customer.id)}/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The CRM update could not be saved.");
      await refresh();
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : "The CRM update could not be saved."); return false; }
    finally { setBusy(false); }
  }

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(await write("contacts", contact))) return;
    setContact({ name: "", jobTitle: "", email: "", phone: "", communicationPreference: "email", isPrimary: false, notes: "" }); setContactOpen(false); setNotice("Contact added.");
  }
  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(await write("addresses", address))) return;
    setAddress({ label: "Office", line1: "", line2: "", city: "", stateRegion: "", postalCode: "", country: customer.country || "Nepal", isPrimary: false }); setAddressOpen(false); setNotice("Address added.");
  }
  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!note.trim()) return;
    if (!(await write("notes", { note }))) return;
    setNote(""); setNotice("Internal note added.");
  }
  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(await write("tasks", task))) return;
    setTask({ title: "", detail: "", dueAt: "", priority: "normal", assignedToName: userName, assignedToEmail: userEmail, assignedToPhone: "" }); setTaskOpen(false); setNotice("Follow-up created.");
  }
  async function toggleTask(item: CrmTask) {
    const ok = await write("tasks", { taskId: item.id, completed: !item.completed }, "PATCH");
    if (ok) setNotice(item.completed ? "Follow-up reopened." : "Follow-up completed.");
  }

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Customer 360"
        title={customer.display_name}
        description={customer.internal_summary || "Relationship, contacts, operational history and commercial context in one account record."}
        meta={<><OpsMono>{customer.id}</OpsMono><OpsBadge tone={customer.account_status === "active" ? "success" : customer.account_status === "on_hold" ? "warning" : customer.account_status === "blacklisted" ? "danger" : customer.account_status === "prospect" ? "info" : "neutral"} dot>{crmAccountStatusLabels[customer.account_status]}</OpsBadge>{customer.relationship_types.map((type) => <OpsBadge key={type}>{crmRelationshipLabels[type]}</OpsBadge>)}</>}
        actions={<><Link href="/admin/crm" className="ops-button" data-variant="secondary" data-size="md">Back to customers</Link><OpsButton variant="primary" onClick={() => refresh().catch((error) => setNotice(error instanceof Error ? error.message : "Refresh failed."))}><RefreshCw size={13}/>Refresh</OpsButton></>}
      />

      <OpsStatStrip>
        <OpsStat label="Contacts" value={customer.contacts.length} icon={<UsersRound size={13}/>} />
        <OpsStat label="Addresses" value={customer.addresses.length} icon={<MapPin size={13}/>} />
        <OpsStat label="Open follow-ups" value={openTasks.length} detail={overdueTasks.length ? `${overdueTasks.length} overdue` : "No overdue work"} icon={<CalendarClock size={13}/>} tone={overdueTasks.length ? "danger" : "neutral"}/>
        <OpsStat label="Quotes" value={customer.quote_count} icon={<MessageSquareText size={13}/>} />
        <OpsStat label="Active shipments" value={customer.active_shipment_count} />
        <OpsStat label="Completed jobs" value={customer.completed_shipment_count} tone="success" />
      </OpsStatStrip>

      <div className="ops-content-wide ops-stack">
        {notice ? <OpsNotice tone={notice.toLowerCase().includes("could not") || notice.toLowerCase().includes("failed") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}

        <div className="ops-grid-main">
          <div className="ops-stack">
            <OpsSurface eyebrow="People" title="Contacts" description="The people KCPL actually works with at this account." action={<OpsButton variant="secondary" size="sm" onClick={() => setContactOpen((value) => !value)}><Plus size={12}/>{contactOpen ? "Close" : "Add contact"}</OpsButton>}>
              {contactOpen ? <form onSubmit={addContact} className="mb-4 grid gap-3 rounded-[14px] border border-[#ebe3dc] bg-[#faf7f4] p-4 sm:grid-cols-2"><OpsField label="Name"><input required value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })}/></OpsField><OpsField label="Role / title"><input value={contact.jobTitle} onChange={(event) => setContact({ ...contact, jobTitle: event.target.value })}/></OpsField><OpsField label="Email"><input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })}/></OpsField><OpsField label="Phone"><input value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })}/></OpsField><OpsField label="Preferred contact"><select value={contact.communicationPreference} onChange={(event) => setContact({ ...contact, communicationPreference: event.target.value })}>{crmCommunicationPreferences.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></OpsField><label className="flex items-center gap-2 self-end pb-3 text-[10px] font-semibold text-[#675e57]"><input type="checkbox" checked={contact.isPrimary} onChange={(event) => setContact({ ...contact, isPrimary: event.target.checked })}/>Primary contact</label><OpsField label="Contact notes" className="sm:col-span-2"><textarea value={contact.notes} onChange={(event) => setContact({ ...contact, notes: event.target.value })}/></OpsField><div className="flex gap-2 sm:col-span-2"><OpsButton variant="primary" disabled={busy}>Save contact</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setContactOpen(false)}>Cancel</OpsButton></div></form> : null}
              {customer.contacts.length ? <div className="divide-y divide-[#eee7e1]">{customer.contacts.map((item) => <div key={item.id} className="flex items-start gap-3 py-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#f2ece7] text-[#8f7567]"><UserRound size={15}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-[10px] text-[#514840]">{item.name}</strong>{item.is_primary ? <OpsBadge tone="success">Primary</OpsBadge> : null}{item.communication_preference ? <OpsBadge>{item.communication_preference}</OpsBadge> : null}</div><p className="mt-1 text-[9px] text-[#8c827a]">{item.job_title || "Contact"}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-[#80766e]">{item.email ? <a href={`mailto:${item.email}`} className="flex items-center gap-1.5 hover:underline"><Mail size={11}/>{item.email}</a> : null}{item.phone ? <a href={`tel:${item.phone}`} className="flex items-center gap-1.5 hover:underline"><Phone size={11}/>{item.phone}</a> : null}</div>{item.notes ? <p className="mt-2 text-[9px] leading-5 text-[#928880]">{item.notes}</p> : null}</div></div>)}</div> : <OpsEmptyState icon={<UsersRound size={18}/>} title="No contacts saved" description="Add the people KCPL calls, emails or coordinates with at this account."/>}
            </OpsSurface>

            <OpsSurface eyebrow="Places" title="Saved addresses" description="Office, warehouse, billing, pickup and delivery locations." action={<OpsButton variant="secondary" size="sm" onClick={() => setAddressOpen((value) => !value)}><Plus size={12}/>{addressOpen ? "Close" : "Add address"}</OpsButton>}>
              {addressOpen ? <form onSubmit={addAddress} className="mb-4 grid gap-3 rounded-[14px] border border-[#ebe3dc] bg-[#faf7f4] p-4 sm:grid-cols-2"><OpsField label="Label"><input required value={address.label} onChange={(event) => setAddress({ ...address, label: event.target.value })} placeholder="Office, Warehouse, Billing"/></OpsField><OpsField label="Country"><input required value={address.country} onChange={(event) => setAddress({ ...address, country: event.target.value })}/></OpsField><OpsField label="Address line 1" className="sm:col-span-2"><input required value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })}/></OpsField><OpsField label="Address line 2" className="sm:col-span-2"><input value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })}/></OpsField><OpsField label="City"><input required value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })}/></OpsField><OpsField label="State / region"><input value={address.stateRegion} onChange={(event) => setAddress({ ...address, stateRegion: event.target.value })}/></OpsField><OpsField label="Postal code"><input value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })}/></OpsField><label className="flex items-center gap-2 self-end pb-3 text-[10px] font-semibold text-[#675e57]"><input type="checkbox" checked={address.isPrimary} onChange={(event) => setAddress({ ...address, isPrimary: event.target.checked })}/>Primary address</label><div className="flex gap-2 sm:col-span-2"><OpsButton variant="primary" disabled={busy}>Save address</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setAddressOpen(false)}>Cancel</OpsButton></div></form> : null}
              {customer.addresses.length ? <div className="grid gap-3 md:grid-cols-2">{customer.addresses.map((item) => <div key={item.id} className="rounded-[13px] border border-[#eae2dc] bg-[#faf7f4] p-4"><div className="flex items-center justify-between gap-2"><strong className="text-[10px] text-[#514840]">{item.label}</strong>{item.is_primary ? <OpsBadge tone="success">Primary</OpsBadge> : null}</div><p className="mt-2 text-[9px] leading-5 text-[#7f756d]">{[item.line1, item.line2, item.city, item.state_region, item.postal_code, item.country].filter(Boolean).join(", ")}</p></div>)}</div> : <OpsEmptyState icon={<MapPin size={18}/>} title="No addresses saved" description="Add recurring pickup, billing or delivery locations once and reuse the context later."/>}
            </OpsSurface>

            <OpsSurface eyebrow="Relationship work" title="Follow-ups" description="Tasks that belong to the customer relationship rather than a specific shipment." action={<OpsButton variant="secondary" size="sm" onClick={() => setTaskOpen((value) => !value)}><Plus size={12}/>{taskOpen ? "Close" : "Add follow-up"}</OpsButton>}>
              {taskOpen ? <form onSubmit={addTask} className="mb-4 grid gap-3 rounded-[14px] border border-[#ebe3dc] bg-[#faf7f4] p-4 sm:grid-cols-2"><OpsField label="Follow-up"><input required value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })}/></OpsField><OpsField label="Priority"><select value={task.priority} onChange={(event) => setTask({ ...task, priority: event.target.value as CrmTaskPriority })}>{crmTaskPriorities.map((priority) => <option key={priority} value={priority}>{crmTaskPriorityLabels[priority]}</option>)}</select></OpsField><OpsField label="Due"><input type="datetime-local" value={task.dueAt} onChange={(event) => setTask({ ...task, dueAt: event.target.value })}/></OpsField><div className="sm:col-span-2"><OpsField label="Assigned to" hint="Choose from People & branches. Name, email and phone populate automatically."><StaffAssignmentPicker branch={customer.primary_branch} compact value={{ name: task.assignedToName, email: task.assignedToEmail, phone: task.assignedToPhone }} onChange={(staff) => setTask((current) => ({ ...current, assignedToName: staff.name, assignedToEmail: staff.email, assignedToPhone: staff.phone }))}/></OpsField></div><OpsField label="Detail" className="sm:col-span-2"><textarea value={task.detail} onChange={(event) => setTask({ ...task, detail: event.target.value })}/></OpsField><div className="flex gap-2 sm:col-span-2"><OpsButton variant="primary" disabled={busy}>Create follow-up</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setTaskOpen(false)}>Cancel</OpsButton></div></form> : null}
              {tasks.length ? <div className="divide-y divide-[#eee7e1]">{tasks.map((item) => <FollowUpRow key={item.id} item={item} busy={busy} onToggle={() => toggleTask(item)}/>)}</div> : <OpsEmptyState icon={<CalendarClock size={18}/>} title="No follow-ups yet" description="Create callbacks, document chases, commercial follow-ups or relationship tasks here."/>}
            </OpsSurface>

            <OpsSurface eyebrow="Internal notes" title="Relationship notes" description="Context and decisions that should stay with the account.">
              <form onSubmit={addNote} className="flex flex-col gap-2 sm:flex-row"><textarea className="ops-input min-h-[72px] flex-1 resize-y" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add an internal note…"/><OpsButton variant="primary" disabled={busy || !note.trim()}><MessageSquareText size={12}/>Add note</OpsButton></form>
              <div className="mt-4 divide-y divide-[#eee7e1]">{customer.notes.length ? customer.notes.map((item) => <article key={item.id} className="py-3.5"><p className="whitespace-pre-wrap text-[10px] leading-5 text-[#615850]">{item.note}</p><p className="mt-2 text-[8px] font-semibold text-[#9e948c]">{item.author_name || item.author_email} · {formatDate(item.created_at)}</p></article>) : <OpsEmptyState icon={<MessageSquareText size={17}/>} title="No notes yet" description="Use this for relationship context that should persist beyond one quote or shipment."/>}</div>
            </OpsSurface>
          </div>

          <aside className="ops-stack xl:sticky xl:top-[76px]">
            <OpsSurface eyebrow="Account" title="Relationship snapshot"><div className="grid grid-cols-2 gap-x-4 gap-y-4"><Fact label="Lead stage" value={crmLeadStageLabels[customer.lead_stage]}/><Fact label="Primary branch" value={customer.primary_branch}/><Fact label="Account manager" value={customer.account_manager_name || "Unassigned"}/><Fact label="Manager email" value={customer.account_manager_email || "Not set"}/><Fact label="Manager phone" value={customer.account_manager_phone || "Not set"}/><Fact label="Country" value={customer.country}/><Fact label="Entity" value={customer.entity_kind === "company" ? "Company / organisation" : "Individual"}/><Fact label="Billing email" value={customer.billing_email || "Not set"}/></div>{customer.tags.length ? <div className="mt-4 border-t border-[#eee7e1] pt-4"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">Tags</p><div className="mt-2 flex flex-wrap gap-1.5">{customer.tags.map((tag) => <OpsBadge key={tag} tone="accent">{tag}</OpsBadge>)}</div></div> : null}</OpsSurface>

            {commercialVisible ? <OpsSurface eyebrow="Commercial" title={`${customer.preferred_currency} account`} description={financeSnapshot ? `Live branch-aware reconciliation · ${formatDate(financeSnapshot.generated_at)}` : "Commercial data is visible only to authorised roles."}>{accountRisk ? <div className="mb-4 rounded-[12px] border border-[#ead1c8] bg-[#fff6f2] p-3"><p className="text-[8px] font-black uppercase tracking-[.08em] text-[#a45543]">Account attention</p><p className="mt-1.5 text-[9px] leading-5 text-[#71544a]">{accountRisk}</p></div> : null}<div className="divide-y divide-[#eee7e1]"><MoneyLine label="Revenue" value={formatMoney(financeRevenue, customer.preferred_currency)}/><MoneyLine label="Cost" value={formatMoney(financeCost, customer.preferred_currency)}/><MoneyLine label="Gross profit" value={formatMoney(financeProfit, customer.preferred_currency)} strong/><MoneyLine label="Gross margin" value={`${grossMargin.toFixed(1)}%`}/><MoneyLine label="Markup" value={customer.commercial.markup_percent === null ? "Not set" : `${customer.commercial.markup_percent}%`}/>{creditVisible ? <><MoneyLine label="Payment terms" value={customer.commercial.payment_terms_days === null ? "Not set" : `${customer.commercial.payment_terms_days} days`}/><MoneyLine label="Credit limit" value={formatMoney(customer.commercial.credit_limit, customer.preferred_currency)}/><MoneyLine label="Outstanding" value={formatMoney(financeOutstanding, customer.preferred_currency)}/><MoneyLine label="Available credit" value={availableCredit === null ? "Not set" : formatMoney(availableCredit, customer.preferred_currency)}/>{financeSnapshot ? <><MoneyLine label="Collected" value={formatMoney(financeSnapshot.collected_total, customer.preferred_currency)}/><MoneyLine label="Overdue" value={formatMoney(financeSnapshot.overdue_total, customer.preferred_currency)}/><MoneyLine label="Open invoices" value={`${financeSnapshot.open_invoice_count}`}/>{financeSnapshot.oldest_overdue_days !== null ? <MoneyLine label="Oldest overdue" value={`${financeSnapshot.oldest_overdue_days} days`}/> : null}</> : null}</> : null}</div>{financeSnapshot && (financeSnapshot.other_currency_invoice_count || financeSnapshot.other_currency_cost_count || financeSnapshot.integrity_warning_count) ? <div className="mt-4 rounded-[12px] bg-[#faf7f4] p-3"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">Reconciliation note</p><p className="mt-2 text-[9px] leading-5 text-[#756b63]">{financeSnapshot.other_currency_invoice_count ? `${financeSnapshot.other_currency_invoice_count} invoice(s) use another currency. ` : ""}{financeSnapshot.other_currency_cost_count ? `${financeSnapshot.other_currency_cost_count} job cost(s) use another currency. ` : ""}{financeSnapshot.integrity_warning_count ? `${financeSnapshot.integrity_warning_count} finance record(s) were excluded because branch data is invalid.` : ""}</p></div> : null}{customer.commercial.pricing_notes ? <div className="mt-4 rounded-[12px] bg-[#faf7f4] p-3"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">Pricing note</p><p className="mt-2 text-[9px] leading-5 text-[#756b63]">{customer.commercial.pricing_notes}</p></div> : null}</OpsSurface> : <OpsSurface eyebrow="Commercial" title="Commercial data restricted" description="Your role can work the relationship without receiving pricing, margin or credit data."><div className="flex gap-3 rounded-[12px] bg-[#faf7f4] p-3 text-[#756b63]"><LockKeyhole size={15} className="mt-0.5 shrink-0 text-[#9b745f]"/><p className="text-[9px] leading-5">Sensitive fields are withheld server-side, not merely hidden with CSS.</p></div></OpsSurface>}

            <OpsSurface eyebrow="Recent activity" title="Account trail"><div className="divide-y divide-[#eee7e1]">{customer.activity.length ? customer.activity.slice(0, 8).map((item) => <div key={item.id} className="py-3"><div className="flex items-start gap-2.5"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c6755d]"/><div><strong className="text-[9px] text-[#514840]">{item.title}</strong>{item.detail ? <p className="mt-1 text-[8px] leading-4 text-[#8b8179]">{item.detail}</p> : null}<p className="mt-1 text-[8px] text-[#a0968e]">{formatDate(item.created_at)}{item.actor_name ? ` · ${item.actor_name}` : ""}</p></div></div></div>) : <p className="py-4 text-[9px] text-[#91877f]">No activity recorded yet.</p>}</div></OpsSurface>
          </aside>
        </div>
      </div>
    </OpsPage>
  );
}

function Fact({ label, value }: { label: string; value: string }) { return <div><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#9c928a]">{label}</p><p className="mt-1.5 break-words text-[9px] font-semibold text-[#5b524b]">{value}</p></div>; }
function MoneyLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-4 py-3 text-[9px]"><span className="text-[#8d837b]">{label}</span><strong className={strong ? "text-[11px] text-[#66806b]" : "text-[#514840]"}>{value}</strong></div>; }
function FollowUpRow({ item, busy, onToggle }: { item: CrmTask; busy: boolean; onToggle: () => void }) {
  const overdue = !item.completed && Boolean(item.due_at) && new Date(item.due_at!).getTime() < Date.now();
  return <div className="flex items-start gap-3 py-3.5"><button type="button" disabled={busy} onClick={onToggle} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${item.completed ? "border-[#93aa97] bg-[#edf4ee] text-[#637c68]" : overdue ? "border-[#dda9aa] bg-[#fff0f0] text-transparent" : "border-[#dcd3cc] bg-white text-transparent"}`}><Check size={11}/></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className={`text-[10px] ${item.completed ? "text-[#968c84] line-through" : "text-[#514840]"}`}>{item.title}</strong><OpsBadge tone={item.priority === "urgent" ? "danger" : item.priority === "high" ? "warning" : "neutral"}>{crmTaskPriorityLabels[item.priority]}</OpsBadge>{overdue ? <OpsBadge tone="danger">Overdue</OpsBadge> : null}</div>{item.detail ? <p className="mt-1 text-[9px] leading-5 text-[#877d75]">{item.detail}</p> : null}<p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[8px] text-[#9f958d]"><span>{item.assigned_to_name || item.assigned_to_email || "Unassigned"}</span>{item.assigned_to_email ? <span>{item.assigned_to_email}</span> : null}{item.assigned_to_phone ? <span>{item.assigned_to_phone}</span> : null}<span>{item.due_at ? `Due ${formatDate(item.due_at)}` : "No due time"}</span></p></div></div>;
}