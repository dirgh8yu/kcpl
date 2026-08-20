"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FilePlus2, Link2, TriangleAlert, UserCheck } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../../../crm/crm-data";
import type { FinanceCustomerSuggestion } from "../../finance-customer-resolution";

export function ShipmentInvoiceForm({
  shipmentReference,
  customerId,
  customerName,
  quoteReference,
  suggestions,
}: {
  shipmentReference: string;
  customerId: string | null;
  customerName: string | null;
  quoteReference: string | null;
  suggestions: FinanceCustomerSuggestion[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [manualCustomerId, setManualCustomerId] = useState("");
  const [form, setForm] = useState({
    issueDate: today,
    dueDate: "",
    currency: "NPR" as CrmCurrency,
    description: "Freight and Logistics",
    amount: "",
    taxRate: "0",
    notes: "",
  });

  async function confirmCustomer(targetCustomerId: string) {
    const target = targetCustomerId.trim().toUpperCase();
    if (!target) return;
    setLinkBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/finance/customer-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shipmentReference, customerId: target }),
      });
      const data = await response.json() as { customerId?: string; error?: string };
      if (!response.ok || !data.customerId) throw new Error(data.error || "Customer could not be linked.");
      setNotice("CRM customer confirmed. Reloading the invoice workspace…");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Customer could not be linked.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerId) {
      setNotice("Confirm the CRM customer before creating the invoice.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/finance/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          customerId,
          shipmentReference,
          amount: Number(form.amount),
          taxRate: Number(form.taxRate),
        }),
      });
      const data = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !data.reference) throw new Error(data.error || "Invoice could not be created.");
      router.push(`/admin/finance/invoices/${encodeURIComponent(data.reference)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Invoice could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#f3f0e7] text-[#10263f]">
    <header className="bg-[#091624] px-5 py-6 text-white lg:px-8"><div className="mx-auto flex max-w-[1300px] flex-wrap items-start justify-between gap-5"><div className="flex items-start gap-4"><Link href={`/admin/jobs/${encodeURIComponent(shipmentReference)}`} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 text-white/65 hover:bg-white/10"><ArrowLeft size={16}/></Link><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#d4ad62]">KCPL Finance</p><h1 className="mt-1 text-3xl font-black tracking-[-.045em]">Create shipment invoice</h1><p className="mt-2 text-xs text-white/45">{shipmentReference}</p></div></div><Link href="/admin/finance" className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-black">Accounts Receivable</Link></div></header>

    <div className="mx-auto max-w-[1300px] p-5 lg:p-8">
      {notice ? <div className="mb-5 rounded-2xl border border-[#d4ad62]/35 bg-[#fff8e8] px-4 py-3 text-sm font-bold text-[#6d5427]">{notice}</div> : null}

      <section className="mb-5 rounded-[26px] border border-black/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-black/35">Shipment</p><p className="mt-1 text-sm font-black">{shipmentReference}</p>{quoteReference ? <p className="mt-1 text-[10px] text-black/40">Quote {quoteReference}</p> : null}</div><div className="min-w-[280px]"><p className="text-[9px] font-black uppercase tracking-[.14em] text-black/35">CRM customer</p>{customerId ? <div className="mt-1"><p className="flex items-center gap-2 text-sm font-black text-emerald-700"><Link2 size={14}/>{customerName || customerId}</p><p className="mt-1 text-[10px] text-black/35">{customerId}</p></div> : <p className="mt-1 flex items-center gap-2 text-sm font-black text-amber-700"><TriangleAlert size={14}/>Confirmation required</p>}</div></div>
      </section>

      {!customerId ? <section className="mb-5 rounded-[28px] border border-amber-200 bg-amber-50 p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="rounded-xl bg-amber-100 p-2.5 text-amber-800"><UserCheck size={17}/></span><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-amber-700">Resolve customer</p><h2 className="mt-1 text-xl font-black text-amber-950">Confirm who this shipment belongs to</h2><p className="mt-2 text-xs leading-5 text-amber-900/70">Finance will link the originating quote and shipment to the customer you confirm. This preserves the CRM audit trail before invoicing.</p></div></div>
        {suggestions.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{suggestions.map((item) => <div key={item.id} className="rounded-2xl border border-amber-200 bg-white p-4"><p className="text-sm font-black text-[#10263f]">{item.display_name}</p><p className="mt-1 text-[10px] text-black/40">{item.id}</p><p className="mt-2 text-[10px] font-bold text-amber-800">Matched by {item.reason}</p><button type="button" disabled={linkBusy} onClick={() => confirmCustomer(item.id)} className="mt-4 rounded-xl bg-[#10263f] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{linkBusy ? "Linking…" : "Confirm this customer"}</button></div>)}</div> : <div className="mt-5 rounded-2xl border border-amber-200 bg-white p-4 text-xs text-black/55">No strong CRM match was found automatically.</div>}
        <div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-[280px] flex-1"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.12em] text-amber-800">Or enter CRM customer reference</span><input className="ship-fin-input" value={manualCustomerId} onChange={(event) => setManualCustomerId(event.target.value)} placeholder="KCPL-C-..."/></label><button type="button" disabled={linkBusy || !manualCustomerId.trim()} onClick={() => confirmCustomer(manualCustomerId)} className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-xs font-black text-amber-950 disabled:opacity-50">Confirm manual customer</button></div>
      </section> : null}

      <section className={`rounded-[30px] border border-black/10 bg-white p-6 shadow-sm sm:p-8 ${customerId ? "" : "opacity-60"}`}><div className="mb-6 flex items-start gap-3"><span className="rounded-xl bg-[#10263f] p-2.5 text-white"><FilePlus2 size={17}/></span><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#b78a3e]">New receivable</p><h2 className="mt-1 text-2xl font-black">Invoice draft</h2><p className="mt-1 text-xs text-black/45">{customerId ? "Customer confirmed. Complete the commercial details below." : "Invoice creation unlocks after the CRM customer is confirmed above."}</p></div></div>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Issue date"><input required disabled={!customerId} type="date" className="ship-fin-input" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })}/></Field>
          <Field label="Due date"><input disabled={!customerId} type="date" className="ship-fin-input" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></Field>
          <Field label="Currency"><select disabled={!customerId} className="ship-fin-input" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
          <Field label="Amount before tax"><input required disabled={!customerId} min="0.01" step="0.01" type="number" className="ship-fin-input" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></Field>
          <Field label="Tax %"><input disabled={!customerId} min="0" max="100" step="0.01" type="number" className="ship-fin-input" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></Field>
          <Field label="Description"><input disabled={!customerId} className="ship-fin-input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></Field>
          <div className="md:col-span-2 xl:col-span-4"><Field label="Invoice notes"><textarea disabled={!customerId} className="ship-fin-input min-h-24 resize-y" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></Field></div>
          <div className="md:col-span-2 xl:col-span-4"><button disabled={busy || !customerId} className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white disabled:opacity-40">{busy ? "Creating…" : "Create invoice draft"}</button></div>
        </form>
      </section>
    </div>
    <style jsx global>{`.ship-fin-input{width:100%;border:1px solid rgba(0,0,0,.1);border-radius:.75rem;background:#faf9f5;padding:.75rem;font-size:.8rem;outline:none}.ship-fin-input:focus{border-color:#b78a3e;background:white}.ship-fin-input:disabled{cursor:not-allowed;opacity:.6}`}</style>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.12em] text-black/40">{label}</span>{children}</label>;
}
