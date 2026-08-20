"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeDollarSign,
  Building2,
  CalendarClock,
  Check,
  CircleDollarSign,
  Clock3,
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

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) return "Not set";
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-AU")}`;
  }
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

export function Customer360Workspace({
  initialCustomer,
  userName,
  userEmail,
}: {
  initialCustomer: CrmCustomerDetail;
  userName: string;
  userEmail: string;
}) {
  const [customer, setCustomer] = useState(initialCustomer);
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

  return (
    <main className="min-h-screen bg-[#f4f1e9] text-[#10263f]">
      <header className="border-b border-white/10 bg-[#0b1724] px-5 py-5 text-white lg:px-8">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <Link href="/admin/crm" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Back to CRM"><ArrowLeft size={17} /></Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d4ad62]">KCPL Customer 360 · {customer.id}</p>
              <h1 className="mt-1 text-2xl font-black tracking-[-.035em]">{customer.display_name}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {customer.relationship_types.map((type) => <span key={type} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.1em] text-white/75">{crmRelationshipLabels[type]}</span>)}
            <span className="rounded-full bg-[#d4ad62] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.1em] text-[#10263f]">{crmAccountStatusLabels[customer.account_status]}</span>
          </div>
        </div>
      </header>

      <section className="border-b border-black/10 bg-[#10263f] px-5 py-5 text-white lg:px-8">
        <div className="mx-auto grid max-w-[1680px] grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Metric label="Contacts" value={customer.contacts.length} icon={<UsersRound size={15} />} />
          <Metric label="Saved addresses" value={customer.addresses.length} icon={<MapPin size={15} />} />
          <Metric label="Open follow-ups" value={openTasks.length} icon={<CalendarClock size={15} />} accent />
          <Metric label="Quotes" value={customer.quote_count} icon={<MessageSquareText size={15} />} />
          <Metric label="Active shipments" value={customer.active_shipment_count} icon={<Building2 size={15} />} />
          <Metric label="Completed jobs" value={customer.completed_shipment_count} icon={<Check size={15} />} />
        </div>
      </section>

      <div className="mx-auto max-w-[1680px] p-5 lg:p-8">
        {notice ? <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-[#d4ad62]/35 bg-[#fff8e8] px-4 py-3 text-sm font-bold text-[#6d5427]"><span>{notice}</span><button type="button" onClick={() => refresh().catch(() => undefined)} className="text-[#6d5427]/60" aria-label="Refresh customer"><RefreshCw size={15} /></button></div> : null}

        <div className="grid gap-6 xl:grid-cols-[1.45fr_.8fr]">
          <div className="space-y-6">
            <section className="rounded-[26px] border border-black/10 bg-white p-6 shadow-sm sm:p-7">
              <SectionHeader title="Contacts" detail="People KCPL works with at this account." action="Add contact" onAction={() => setContactOpen((value) => !value)} />
              {contactOpen ? <form onSubmit={addContact} className="mt-5 grid gap-3 rounded-2xl border border-black/10 bg-[#faf9f5] p-4 sm:grid-cols-2">
                <Input label="Name"><input required className="crm360-input" value={contact.name} onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))} /></Input>
                <Input label="Role / title"><input className="crm360-input" value={contact.jobTitle} onChange={(event) => setContact((current) => ({ ...current, jobTitle: event.target.value }))} /></Input>
                <Input label="Email"><input type="email" className="crm360-input" value={contact.email} onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))} /></Input>
                <Input label="Phone"><input className="crm360-input" value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} /></Input>
                <Input label="Preferred contact"><select className="crm360-input" value={contact.communicationPreference} onChange={(event) => setContact((current) => ({ ...current, communicationPreference: event.target.value }))}>{crmCommunicationPreferences.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></Input>
                <label className="flex items-center gap-2 self-end pb-3 text-xs font-bold"><input type="checkbox" checked={contact.isPrimary} onChange={(event) => setContact((current) => ({ ...current, isPrimary: event.target.checked }))} /> Primary contact</label>
                <div className="sm:col-span-2"><Input label="Contact notes"><textarea className="crm360-input min-h-20 resize-y" value={contact.notes} onChange={(event) => setContact((current) => ({ ...current, notes: event.target.value }))} /></Input></div>
                <FormButtons busy={busy} onCancel={() => setContactOpen(false)} label="Save contact" />
              </form> : null}
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {customer.contacts.length ? customer.contacts.map((item) => <div key={item.id} className="rounded-2xl border border-black/10 p-4">
                  <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#10263f] text-white"><UserRound size={15} /></div><div><strong className="text-sm">{item.name}</strong><p className="mt-0.5 text-xs text-black/45">{item.job_title || "Contact"}</p></div></div>{item.is_primary ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">Primary</span> : null}</div>
                  <div className="mt-4 space-y-2 text-xs text-black/55">{item.email ? <p className="flex items-center gap-2"><Mail size={13} />{item.email}</p> : null}{item.phone ? <p className="flex items-center gap-2"><Phone size={13} />{item.phone}</p> : null}{item.communication_preference ? <p className="font-bold text-black/40">Prefers {item.communication_preference}</p> : null}</div>
                </div>) : <EmptyState text="No contacts saved yet." />}
              </div>
            </section>

            <section className="rounded-[26px] border border-black/10 bg-white p-6 shadow-sm sm:p-7">
              <SectionHeader title="Saved addresses" detail="Office, warehouse, billing, pickup and delivery locations." action="Add address" onAction={() => setAddressOpen((value) => !value)} />
              {addressOpen ? <form onSubmit={addAddress} className="mt-5 grid gap-3 rounded-2xl border border-black/10 bg-[#faf9f5] p-4 sm:grid-cols-2">
                <Input label="Label"><input required className="crm360-input" value={address.label} onChange={(event) => setAddress((current) => ({ ...current, label: event.target.value }))} placeholder="Office, Warehouse, Billing" /></Input>
                <Input label="Country"><input required className="crm360-input" value={address.country} onChange={(event) => setAddress((current) => ({ ...current, country: event.target.value }))} /></Input>
                <div className="sm:col-span-2"><Input label="Address line 1"><input required className="crm360-input" value={address.line1} onChange={(event) => setAddress((current) => ({ ...current, line1: event.target.value }))} /></Input></div>
                <div className="sm:col-span-2"><Input label="Address line 2"><input className="crm360-input" value={address.line2} onChange={(event) => setAddress((current) => ({ ...current, line2: event.target.value }))} /></Input></div>
                <Input label="City"><input required className="crm360-input" value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))} /></Input>
                <Input label="State / region"><input className="crm360-input" value={address.stateRegion} onChange={(event) => setAddress((current) => ({ ...current, stateRegion: event.target.value }))} /></Input>
                <Input label="Postal code"><input className="crm360-input" value={address.postalCode} onChange={(event) => setAddress((current) => ({ ...current, postalCode: event.target.value }))} /></Input>
                <label className="flex items-center gap-2 self-end pb-3 text-xs font-bold"><input type="checkbox" checked={address.isPrimary} onChange={(event) => setAddress((current) => ({ ...current, isPrimary: event.target.checked }))} /> Primary address</label>
                <FormButtons busy={busy} onCancel={() => setAddressOpen(false)} label="Save address" />
              </form> : null}
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {customer.addresses.length ? customer.addresses.map((item) => <div key={item.id} className="rounded-2xl border border-black/10 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{item.label}</strong>{item.is_primary ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">Primary</span> : null}</div><p className="mt-3 text-xs leading-6 text-black/55">{item.line1}{item.line2 ? <><br />{item.line2}</> : null}<br />{item.city}{item.state_region ? `, ${item.state_region}` : ""}{item.postal_code ? ` ${item.postal_code}` : ""}<br />{item.country}</p></div>) : <EmptyState text="No saved addresses yet." />}
              </div>
            </section>

            <section className="rounded-[26px] border border-black/10 bg-white p-6 shadow-sm sm:p-7">
              <SectionHeader title="Internal notes" detail="Private account context for KCPL staff." />
              <form onSubmit={addNote} className="mt-5"><textarea className="crm360-input min-h-28 resize-y" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add relationship context, operating preferences, special instructions…" /><div className="mt-3 flex justify-end"><button type="submit" disabled={busy || !note.trim()} className="rounded-xl bg-[#10263f] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Add note</button></div></form>
              <div className="mt-5 space-y-3">{customer.notes.length ? customer.notes.map((item) => <div key={item.id} className="rounded-2xl border border-black/10 bg-[#faf9f5] p-4"><p className="text-sm leading-6">{item.note}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-[.08em] text-black/35">{item.author_name} · {formatDate(item.created_at)}</p></div>) : <EmptyState text="No internal notes yet." />}</div>
            </section>

            <section className="rounded-[26px] border border-black/10 bg-white p-6 shadow-sm sm:p-7">
              <SectionHeader title="Activity timeline" detail="The institutional memory of this account." />
              <div className="mt-5 space-y-0">{customer.activity.length ? customer.activity.map((item, index) => <div key={item.id} className="grid grid-cols-[24px_1fr] gap-3"><div className="flex flex-col items-center"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#d4ad62]" />{index < customer.activity.length - 1 ? <div className="min-h-12 w-px flex-1 bg-black/10" /> : null}</div><div className="pb-5"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{item.title}</strong><span className="text-[10px] text-black/35">{formatDate(item.created_at)}</span></div>{item.detail ? <p className="mt-1 text-xs leading-5 text-black/50">{item.detail}</p> : null}{item.actor_name ? <p className="mt-1 text-[10px] font-bold uppercase tracking-[.08em] text-black/30">{item.actor_name}</p> : null}</div></div>) : <EmptyState text="Activity will appear as the account is used." />}</div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[26px] border border-black/10 bg-white p-6 shadow-sm">
              <SectionHeader title="Follow-ups" detail={`${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}.`} action="New task" onAction={() => setTaskOpen((value) => !value)} />
              {taskOpen ? <form onSubmit={addTask} className="mt-5 space-y-3 rounded-2xl border border-black/10 bg-[#faf9f5] p-4">
                <Input label="Task"><input required className="crm360-input" value={task.title} onChange={(event) => setTask((current) => ({ ...current, title: event.target.value }))} placeholder="Follow up quote, request documents…" /></Input>
                <Input label="Detail"><textarea className="crm360-input min-h-20 resize-y" value={task.detail} onChange={(event) => setTask((current) => ({ ...current, detail: event.target.value }))} /></Input>
                <Input label="Due"><input type="datetime-local" className="crm360-input" value={task.dueAt} onChange={(event) => setTask((current) => ({ ...current, dueAt: event.target.value }))} /></Input>
                <Input label="Priority"><select className="crm360-input" value={task.priority} onChange={(event) => setTask((current) => ({ ...current, priority: event.target.value as CrmTaskPriority }))}>{crmTaskPriorities.map((priority) => <option key={priority} value={priority}>{crmTaskPriorityLabels[priority]}</option>)}</select></Input>
                <Input label="Assigned to"><input className="crm360-input" value={task.assignedToName} onChange={(event) => setTask((current) => ({ ...current, assignedToName: event.target.value }))} /></Input>
                <Input label="Assignee email"><input type="email" className="crm360-input" value={task.assignedToEmail} onChange={(event) => setTask((current) => ({ ...current, assignedToEmail: event.target.value }))} /></Input>
                <FormButtons busy={busy} onCancel={() => setTaskOpen(false)} label="Create follow-up" />
              </form> : null}
              <div className="mt-5 space-y-3">{tasks.length ? tasks.map((item) => <TaskCard key={item.id} task={item} busy={busy} onToggle={() => toggleTask(item)} />) : <EmptyState text="No follow-ups yet." />}</div>
            </section>

            <section className="rounded-[26px] border border-black/10 bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[.17em] text-[#8b6b32]">Account profile</p>
              <div className="mt-4 divide-y divide-black/10">
                <Info label="Lead stage" value={crmLeadStageLabels[customer.lead_stage]} />
                <Info label="Primary branch" value={customer.primary_branch} />
                <Info label="Account manager" value={customer.account_manager_name || "Unassigned"} />
                <Info label="Primary email" value={customer.primary_email || "Not recorded"} />
                <Info label="Primary phone" value={customer.primary_phone || "Not recorded"} />
                <Info label="Country" value={customer.country} />
                <Info label="Tax ID" value={customer.tax_id || "Not recorded"} />
              </div>
              {customer.tags.length ? <div className="mt-5 flex flex-wrap gap-2">{customer.tags.map((tag) => <span key={tag} className="flex items-center gap-1 rounded-full bg-[#10263f] px-3 py-1.5 text-[9px] font-black text-white"><Tags size={10} />{tag}</span>)}</div> : null}
            </section>

            <section className="rounded-[26px] border border-black/10 bg-[#10263f] p-6 text-white shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[.17em] text-[#d4ad62]">Commercial & credit</p>
              <div className="mt-5 space-y-4">
                <Money label="Revenue" value={formatMoney(customer.revenue_total, customer.preferred_currency)} icon={<BadgeDollarSign size={14} />} />
                <Money label="Cost" value={formatMoney(customer.cost_total, customer.preferred_currency)} icon={<CircleDollarSign size={14} />} />
                <Money label="Gross profit" value={formatMoney(customer.profit_total, customer.preferred_currency)} icon={<BadgeDollarSign size={14} />} strong />
                <Money label="Gross margin" value={`${grossMargin.toFixed(1)}%`} icon={<CircleDollarSign size={14} />} />
                <Money label="Credit limit" value={formatMoney(customer.commercial.credit_limit, customer.preferred_currency)} icon={<CircleDollarSign size={14} />} />
                <Money label="Outstanding" value={formatMoney(customer.commercial.outstanding_balance, customer.preferred_currency)} icon={<Clock3 size={14} />} />
                <Money label="Payment terms" value={customer.commercial.payment_terms_days === null ? "Not set" : `${customer.commercial.payment_terms_days} days`} icon={<CalendarClock size={14} />} />
              </div>
              {customer.commercial.pricing_notes ? <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.05] p-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">Pricing notes</p><p className="mt-2 text-xs leading-5 text-white/65">{customer.commercial.pricing_notes}</p></div> : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value, icon, accent = false }: { label: string; value: number; icon: React.ReactNode; accent?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${accent ? "border-[#d4ad62]/45 bg-[#d4ad62]/10" : "border-white/10 bg-white/[.035]"}`}><div className="flex items-center gap-2 text-white/40">{icon}<span className="text-[9px] font-black uppercase tracking-[.14em]">{label}</span></div><p className={`mt-2 text-2xl font-black ${accent ? "text-[#e0bd79]" : "text-white"}`}>{value}</p></div>;
}

function SectionHeader({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black tracking-[-.02em]">{title}</h2><p className="mt-1 text-xs leading-5 text-black/45">{detail}</p></div>{action && onAction ? <button type="button" onClick={onAction} className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#f8f7f2] px-3 py-2 text-[10px] font-black"><Plus size={13} />{action}</button> : null}</div>;
}

function Input({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.13em] text-black/40">{label}</span>{children}</label>;
}

function FormButtons({ busy, onCancel, label }: { busy: boolean; onCancel: () => void; label: string }) {
  return <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={onCancel} className="rounded-xl border border-black/10 px-3 py-2 text-xs font-black">Cancel</button><button type="submit" disabled={busy} className="rounded-xl bg-[#10263f] px-4 py-2 text-xs font-black text-white disabled:opacity-50">{busy ? "Saving…" : label}</button></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-black/15 bg-[#faf9f5] p-5 text-sm text-black/40">{text}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 py-3 text-xs"><span className="text-black/40">{label}</span><strong className="max-w-[62%] text-right">{value}</strong></div>;
}

function Money({ label, value, icon, strong = false }: { label: string; value: string; icon: React.ReactNode; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4"><div className="flex items-center gap-2 text-xs text-white/45">{icon}{label}</div><strong className={strong ? "text-lg text-[#e0bd79]" : "text-sm"}>{value}</strong></div>;
}

function TaskCard({ task, busy, onToggle }: { task: CrmTask; busy: boolean; onToggle: () => void }) {
  const overdue = !task.completed && task.due_at ? new Date(task.due_at).getTime() < Date.now() : false;
  const priorityStyle: Record<CrmTaskPriority, string> = {
    low: "bg-stone-100 text-stone-600",
    normal: "bg-sky-50 text-sky-700",
    high: "bg-amber-50 text-amber-800",
    urgent: "bg-rose-50 text-rose-700",
  };
  return <div className={`rounded-2xl border p-4 ${task.completed ? "border-black/5 bg-black/[.025] opacity-65" : overdue ? "border-rose-200 bg-rose-50/40" : "border-black/10"}`}><div className="flex items-start gap-3"><button type="button" disabled={busy} onClick={onToggle} className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${task.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/20 bg-white"}`}>{task.completed ? <Check size={13} /> : null}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><strong className={`text-sm ${task.completed ? "line-through" : ""}`}>{task.title}</strong><span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[.08em] ${priorityStyle[task.priority]}`}>{crmTaskPriorityLabels[task.priority]}</span></div>{task.detail ? <p className="mt-1 text-xs leading-5 text-black/50">{task.detail}</p> : null}<div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-black/35">{task.due_at ? <span className={overdue ? "text-rose-600" : ""}>{overdue ? "Overdue · " : "Due · "}{formatDate(task.due_at)}</span> : <span>No due date</span>}{task.assigned_to_name ? <span>{task.assigned_to_name}</span> : null}</div></div></div></div>;
}
