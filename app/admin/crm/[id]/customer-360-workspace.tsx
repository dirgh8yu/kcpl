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
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../../operations-ui";
import { StaffAssignmentPicker } from "../../staff-assignment-picker";

const communicationLabels: Record<string, string> = { phone: "Phone", email: "Email", whatsapp: "WhatsApp", wechat: "WeChat", viber: "Viber", other: "Other" };

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
  const [task, setTask] = useState({ title: "", detail: "", dueAt: "", priority: "normal" as CrmTaskPriority, assignedToUid: "", assignedToName: userName, assignedToEmail: userEmail, assignedToPhone: "" });

  const tasks = useMemo(() => taskSort(customer.tasks), [customer.tasks]);
  const openTasks = tasks.filter((item) => !item.completed);
  const overdueTasks = openTasks.filter((item) => item.due_at && new Date(item.due_at).getTime() < Date.now());
  const financeRevenue = financeSnapshot?.revenue_total ?? customer.revenue_total;
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
          ? `${financeSnapshot.overdue_invoice_count} overdue invoice${financeSnapshot.overdue_invoice_count === 1 ? " requires" : "s require"} Accounts follow-up.`
          : null;

  async function refresh() {
    const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customer.id)}`, { cache: "no-store" });
    const data = await response.json() as { customer?: CrmCustomerDetail; financeSnapshot?: CrmCustomerFinanceSnapshot | null; error?: string };
    if (!response.ok || !data.customer) throw new Error(data.error || "Could not refresh this customer.");
    setCustomer(data.customer);
    setFinanceSnapshot(data.financeSnapshot ?? null);
  }

  async function write(path: string, body: Record<string, unknown>, method = "POST") {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customer.id)}/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The change could not be saved.");
      await refresh();
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : "The change could not be saved."); return false; }
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
    setTask({ title: "", detail: "", dueAt: "", priority: "normal", assignedToUid: "", assignedToName: userName, assignedToEmail: userEmail, assignedToPhone: "" }); setTaskOpen(false); setNotice("Follow-up created.");
  }
  async function toggleTask(item: CrmTask) {
    const ok = await write("tasks", { taskId: item.id, completed: !item.completed }, "PATCH");
    if (ok) setNotice(item.completed ? "Follow-up reopened." : "Follow-up completed.");
  }

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Customer"
        title={<span className="inline-flex flex-wrap items-center gap-2">{customer.display_name}<OpsBadge tone={customer.account_status === "active" ? "success" : customer.account_status === "on_hold" ? "warning" : customer.account_status === "blacklisted" ? "danger" : customer.account_status === "prospect" ? "info" : "neutral"} dot>{crmAccountStatusLabels[customer.account_status]}</OpsBadge></span>}
        description={customer.internal_summary || undefined}
        meta={<>{customer.relationship_types.filter((type) => type !== "customer").map((type) => <OpsBadge key={type}>{crmRelationshipLabels[type]}</OpsBadge>)}</>}
        // Contacts, addresses and follow-ups are counted where they are listed;
        // quotes and shipments are in "Quotes and shipments" below.
        actions={<Link href={`/admin/shipments?q=${encodeURIComponent(customer.display_name)}`} className="ops-button" data-variant="secondary" data-size="md">Shipments{customer.active_shipment_count ? ` · ${customer.active_shipment_count} active` : ""}</Link>}
      />

      <div className="ops-content-wide ops-stack">
        {notice ? <OpsNotice tone={notice.toLowerCase().includes("could not") || notice.toLowerCase().includes("failed") ? "danger" : "success"} onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}

        <div className="ops-grid-main">
          <div className="ops-stack">
            <OpsSurface title="Contacts" action={<OpsButton variant="secondary" size="sm" onClick={() => setContactOpen((value) => !value)}><Plus size={12}/>{contactOpen ? "Close" : "Add contact"}</OpsButton>}>
              {contactOpen ? <form onSubmit={addContact} className="mb-4 grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4 sm:grid-cols-2"><OpsField label="Name"><input required value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })}/></OpsField><OpsField label="Role / title"><input value={contact.jobTitle} onChange={(event) => setContact({ ...contact, jobTitle: event.target.value })}/></OpsField><OpsField label="Email"><input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })}/></OpsField><OpsField label="Phone"><input value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })}/></OpsField><OpsField label="Preferred contact"><select value={contact.communicationPreference} onChange={(event) => setContact({ ...contact, communicationPreference: event.target.value })}>{crmCommunicationPreferences.map((item) => <option key={item} value={item}>{communicationLabels[item]}</option>)}</select></OpsField><label className="flex items-center gap-2 self-end pb-3 text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]"><input type="checkbox" checked={contact.isPrimary} onChange={(event) => setContact({ ...contact, isPrimary: event.target.checked })}/>Primary contact</label><OpsField label="Contact notes" className="sm:col-span-2"><textarea value={contact.notes} onChange={(event) => setContact({ ...contact, notes: event.target.value })}/></OpsField><div className="flex gap-2 sm:col-span-2"><OpsButton type="submit" variant="primary" disabled={busy}>Save contact</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setContactOpen(false)}>Cancel</OpsButton></div></form> : null}
              {customer.contacts.length ? <div className="divide-y divide-[var(--admin-line)]">{customer.contacts.map((item) => <div key={item.id} className="flex items-start gap-3 py-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--app-radius)] bg-[var(--admin-accent-bg)] text-[var(--admin-crimson)]"><UserRound size={15}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{item.name}</strong>{item.is_primary ? <OpsBadge tone="success">Primary</OpsBadge> : null}{item.communication_preference ? <OpsBadge>{communicationLabels[item.communication_preference]}</OpsBadge> : null}</div><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-faint)]">{item.job_title || "Contact"}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{item.email ? <a href={`mailto:${item.email}`} className="flex items-center gap-1.5 hover:underline"><Mail size={11}/>{item.email}</a> : null}{item.phone ? <a href={`tel:${item.phone}`} className="flex items-center gap-1.5 hover:underline"><Phone size={11}/>{item.phone}</a> : null}</div>{item.notes ? <p className="mt-2 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-faint)]">{item.notes}</p> : null}</div></div>)}</div> : <OpsEmptyState icon={<UsersRound size={18}/>} title="No contacts saved" description="Add the people KCPL calls, emails or coordinates with at this account."/>}
            </OpsSurface>

            <OpsSurface title="Saved addresses" action={<OpsButton variant="secondary" size="sm" onClick={() => setAddressOpen((value) => !value)}><Plus size={12}/>{addressOpen ? "Close" : "Add address"}</OpsButton>}>
              {addressOpen ? <form onSubmit={addAddress} className="mb-4 grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4 sm:grid-cols-2"><OpsField label="Label"><input required value={address.label} onChange={(event) => setAddress({ ...address, label: event.target.value })} placeholder="Office, Warehouse, Billing"/></OpsField><OpsField label="Country"><input required value={address.country} onChange={(event) => setAddress({ ...address, country: event.target.value })}/></OpsField><OpsField label="Address line 1" className="sm:col-span-2"><input required value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })}/></OpsField><OpsField label="Address line 2" className="sm:col-span-2"><input value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })}/></OpsField><OpsField label="City"><input required value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })}/></OpsField><OpsField label="State / region"><input value={address.stateRegion} onChange={(event) => setAddress({ ...address, stateRegion: event.target.value })}/></OpsField><OpsField label="Postal code"><input value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })}/></OpsField><label className="flex items-center gap-2 self-end pb-3 text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]"><input type="checkbox" checked={address.isPrimary} onChange={(event) => setAddress({ ...address, isPrimary: event.target.checked })}/>Primary address</label><div className="flex gap-2 sm:col-span-2"><OpsButton type="submit" variant="primary" disabled={busy}>Save address</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setAddressOpen(false)}>Cancel</OpsButton></div></form> : null}
              {customer.addresses.length ? <div className="grid gap-3 md:grid-cols-2">{customer.addresses.map((item) => <div key={item.id} className="rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4"><div className="flex items-center justify-between gap-2"><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{item.label}</strong>{item.is_primary ? <OpsBadge tone="success">Primary</OpsBadge> : null}</div><p className="mt-2 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{[item.line1, item.line2, item.city, item.state_region, item.postal_code, item.country].filter(Boolean).join(", ")}</p></div>)}</div> : <OpsEmptyState icon={<MapPin size={18}/>} title="No addresses saved" description="Add recurring pickup, billing or delivery locations once and reuse the context later."/>}
            </OpsSurface>

            <OpsSurface title="Follow-ups" description={openTasks.length ? <>{openTasks.length} open{overdueTasks.length ? <> · <span className="text-[var(--admin-danger)]">{overdueTasks.length} overdue</span></> : null}</> : "Callbacks and chases for this customer, not tied to one shipment."} action={<OpsButton variant="secondary" size="sm" onClick={() => setTaskOpen((value) => !value)}><Plus size={12}/>{taskOpen ? "Close" : "Add follow-up"}</OpsButton>}>
              {taskOpen ? <form onSubmit={addTask} className="mb-4 grid gap-3 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-4 sm:grid-cols-2"><OpsField label="Follow-up"><input required value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })}/></OpsField><OpsField label="Priority"><select value={task.priority} onChange={(event) => setTask({ ...task, priority: event.target.value as CrmTaskPriority })}>{crmTaskPriorities.map((priority) => <option key={priority} value={priority}>{crmTaskPriorityLabels[priority]}</option>)}</select></OpsField><OpsField label="Due"><input type="datetime-local" value={task.dueAt} onChange={(event) => setTask({ ...task, dueAt: event.target.value })}/></OpsField><div className="sm:col-span-2"><OpsField label="Assigned to" hint="Choose from People & branches. Identity and contact details stay synchronized automatically."><StaffAssignmentPicker branch={customer.primary_branch} value={{ uid: task.assignedToUid, name: task.assignedToName, email: task.assignedToEmail, phone: task.assignedToPhone }} onChange={(staff) => setTask((current) => ({ ...current, assignedToUid: staff.uid ?? "", assignedToName: staff.name, assignedToEmail: staff.email, assignedToPhone: staff.phone }))}/></OpsField></div><OpsField label="Detail" className="sm:col-span-2"><textarea value={task.detail} onChange={(event) => setTask({ ...task, detail: event.target.value })}/></OpsField><div className="flex gap-2 sm:col-span-2"><OpsButton type="submit" variant="primary" disabled={busy}>Create follow-up</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setTaskOpen(false)}>Cancel</OpsButton></div></form> : null}
              {tasks.length ? <div className="divide-y divide-[var(--admin-line)]">{tasks.map((item) => <FollowUpRow key={item.id} item={item} busy={busy} onToggle={() => toggleTask(item)}/>)}</div> : <OpsEmptyState icon={<CalendarClock size={18}/>} title="No follow-ups yet" description="Create callbacks, document chases, commercial follow-ups or relationship tasks here."/>}
            </OpsSurface>

            <OpsSurface title="Relationship notes">
              <form onSubmit={addNote} className="flex flex-col gap-2 sm:flex-row sm:items-start"><textarea className="ops-input min-h-[72px] flex-1 resize-y" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add an internal note…"/><OpsButton type="submit" variant="primary" disabled={busy || !note.trim()}><MessageSquareText size={12}/>Add note</OpsButton></form>
              <div className="mt-4 divide-y divide-[var(--admin-line)]">{customer.notes.length ? customer.notes.map((item) => <article key={item.id} className="py-3.5"><p className="whitespace-pre-wrap text-[length:var(--app-label-size)] leading-5 text-[var(--admin-ink)]">{item.note}</p><p className="mt-2 text-[length:var(--app-label-size)] font-semibold text-[var(--admin-faint)]">{item.author_name || item.author_email} · {formatDate(item.created_at)}</p></article>) : <OpsEmptyState icon={<MessageSquareText size={17}/>} title="No notes yet" description="Use this for relationship context that should persist beyond one quote or shipment."/>}</div>
            </OpsSurface>
          </div>

          <aside className="ops-stack xl:sticky xl:top-[76px]">
            <OpsSurface title="Relationship snapshot"><div className="grid grid-cols-2 gap-x-4 gap-y-4"><Fact label="Lead stage" value={crmLeadStageLabels[customer.lead_stage]}/><Fact label="Primary branch" value={<Link href={`/admin/branches/${encodeURIComponent(customer.primary_branch)}`} className="hover:text-[var(--admin-crimson)] hover:underline">{customer.primary_branch}</Link>}/><Fact label="Account manager" value={customer.account_manager_uid ? <Link href={`/admin/workload/${encodeURIComponent(customer.account_manager_uid)}`} className="hover:text-[var(--admin-crimson)] hover:underline">{customer.account_manager_name || customer.account_manager_email || "Assigned staff"}</Link> : customer.account_manager_name || "Unassigned"}/><Fact label="Country" value={customer.country}/><Fact wide label="Billing email" value={customer.billing_email || "Not set"}/></div>{customer.tags.length ? <div className="mt-4 border-t border-[var(--admin-line)] pt-4"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">Tags</p><div className="mt-2 flex flex-wrap gap-1.5">{customer.tags.map((tag) => <OpsBadge key={tag} tone="accent">{tag}</OpsBadge>)}</div></div> : null}</OpsSurface>

            {commercialVisible ? <OpsSurface title={`${customer.preferred_currency} account`} description={financeSnapshot ? undefined : "Commercial data is visible only to authorised roles."}>{accountRisk ? <div className="mb-4 rounded-[var(--app-radius)] border border-[var(--admin-accent-line)] bg-[var(--admin-accent-bg)] p-3"><p className="text-[length:var(--app-label-size)] font-semibold uppercase tracking-[.04em] text-[var(--admin-warning)]">Account attention</p><p className="mt-1.5 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{accountRisk}</p></div> : null}<div className="divide-y divide-[var(--admin-line)]"><MoneyLine label="Revenue" value={formatMoney(financeRevenue, customer.preferred_currency)}/><MoneyLine label="Gross profit" value={formatMoney(financeProfit, customer.preferred_currency)} strong/><MoneyLine label="Gross margin" value={`${grossMargin.toFixed(1)}%`}/>{creditVisible ? <><MoneyLine label="Payment terms" value={customer.commercial.payment_terms_days === null ? "Not set" : `${customer.commercial.payment_terms_days} days`}/><MoneyLine label="Credit limit" value={formatMoney(customer.commercial.credit_limit, customer.preferred_currency)}/><MoneyLine label="Outstanding" value={formatMoney(financeOutstanding, customer.preferred_currency)}/><MoneyLine label="Available credit" value={availableCredit === null ? "Not set" : formatMoney(availableCredit, customer.preferred_currency)}/>{financeSnapshot ? <><MoneyLine label="Overdue" value={formatMoney(financeSnapshot.overdue_total, customer.preferred_currency)}/>{financeSnapshot.oldest_overdue_days !== null ? <MoneyLine label="Oldest overdue" value={`${financeSnapshot.oldest_overdue_days} days`}/> : null}</> : null}</> : null}</div>{financeSnapshot?.rates_date ? <p className="mt-3 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">Revenue is before VAT. Other currencies are converted to {customer.preferred_currency} at Nepal Rastra Bank rates of {financeSnapshot.rates_date}.</p> : null}{financeSnapshot && (financeSnapshot.other_currency_invoice_count || financeSnapshot.other_currency_cost_count || financeSnapshot.integrity_warning_count) ? <div className="mt-4 rounded-[var(--app-radius)] bg-[var(--admin-surface-muted)] p-3"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">Reconciliation note</p><p className="mt-2 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{financeSnapshot.other_currency_invoice_count ? `${financeSnapshot.other_currency_invoice_count} invoice(s) are in a currency with no exchange rate right now, so they are left out. ` : ""}{financeSnapshot.other_currency_cost_count ? `${financeSnapshot.other_currency_cost_count} job cost(s) are in a currency with no exchange rate right now, so they are left out. ` : ""}{financeSnapshot.integrity_warning_count ? `${financeSnapshot.integrity_warning_count} finance record(s) were excluded because branch data is invalid.` : ""}</p></div> : null}{customer.commercial.pricing_notes ? <div className="mt-4 rounded-[var(--app-radius)] bg-[var(--admin-surface-muted)] p-3"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">Pricing note</p><p className="mt-2 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-muted)]">{customer.commercial.pricing_notes}</p></div> : null}</OpsSurface> : <OpsSurface title="Commercial data restricted" description="Your role can work the relationship without receiving pricing, margin or credit data."><div className="flex gap-3 rounded-[var(--app-radius)] bg-[var(--admin-surface-muted)] p-3 text-[var(--admin-muted)]"><LockKeyhole size={15} className="mt-0.5 shrink-0 text-[var(--admin-crimson)]"/><p className="text-[length:var(--app-label-size)] leading-5">Sensitive fields are withheld server-side, not merely hidden with CSS.</p></div></OpsSurface>}

            <OpsSurface title="Account trail"><div className="divide-y divide-[var(--admin-line)]">{customer.activity.length ? customer.activity.slice(0, 8).map((item) => <div key={item.id} className="py-3"><div className="flex items-start gap-2.5"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--admin-crimson)]"/><div><strong className="text-[length:var(--app-label-size)] text-[var(--admin-ink)]">{item.title}</strong>{item.detail ? <p className="mt-1 text-[length:var(--app-label-size)] leading-4 text-[var(--admin-muted)]">{item.detail}</p> : null}<p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-faint)]">{formatDate(item.created_at)}{item.actor_name ? ` · ${item.actor_name}` : ""}</p></div></div></div>) : <p className="py-4 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">No activity recorded yet.</p>}</div></OpsSurface>
          </aside>
        </div>
      </div>
    </OpsPage>
  );
}

function Fact({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) { return <div className={wide ? "col-span-2" : undefined}><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.04em] text-[var(--admin-muted)]">{label}</p><div className="mt-1.5 break-words text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]">{value}</div></div>; }
function MoneyLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-4 py-3 text-[length:var(--app-label-size)]"><span className="text-[var(--admin-muted)]">{label}</span><strong className={strong ? "text-[length:var(--app-label-size)] text-[var(--admin-success)]" : "text-[var(--admin-ink)]"}>{value}</strong></div>; }
function FollowUpRow({ item, busy, onToggle }: { item: CrmTask; busy: boolean; onToggle: () => void }) {
  const overdue = !item.completed && Boolean(item.due_at) && new Date(item.due_at!).getTime() < Date.now();
  const assignee = item.assigned_to_name || item.assigned_to_email || "Unassigned";
  return <div className="flex items-start gap-3 py-3.5"><button type="button" disabled={busy} onClick={onToggle} aria-pressed={item.completed} aria-label={item.completed ? `Reopen: ${item.title}` : `Mark done: ${item.title}`} className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${item.completed ? "border-[var(--admin-success-line)] bg-[var(--admin-success-bg)] text-[var(--admin-success)]" : overdue ? "border-[var(--admin-danger-line)] bg-[var(--admin-danger-bg)] text-transparent" : "border-[var(--admin-line)] bg-[var(--admin-surface)] text-transparent"}`}><Check size={11}/></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className={`text-[length:var(--app-label-size)] ${item.completed ? "text-[var(--admin-faint)] line-through" : "text-[var(--admin-ink)]"}`}>{item.title}</strong>{item.priority === "urgent" || item.priority === "high" ? <OpsBadge tone={item.priority === "urgent" ? "danger" : "warning"}>{crmTaskPriorityLabels[item.priority]}</OpsBadge> : null}{overdue ? <OpsBadge tone="danger">Overdue</OpsBadge> : null}</div>{item.detail ? <p className="mt-1 text-[length:var(--app-label-size)] leading-5 text-[var(--admin-faint)]">{item.detail}</p> : null}<p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[length:var(--app-label-size)] text-[var(--admin-faint)]">{item.assigned_to_uid ? <Link href={`/admin/workload/${encodeURIComponent(item.assigned_to_uid)}`} className="font-semibold hover:text-[var(--admin-crimson)] hover:underline">{assignee}</Link> : <span>{assignee}</span>}<span>{item.due_at ? `Due ${formatDate(item.due_at)}` : "No due time"}</span></p></div></div>;
}