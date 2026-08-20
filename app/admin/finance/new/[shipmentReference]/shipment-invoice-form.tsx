"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FilePlus2, Link2, TriangleAlert } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../../../crm/crm-data";

export function ShipmentInvoiceForm({ shipmentReference, customerId, quoteReference }: { shipmentReference: string; customerId: string | null; quoteReference: string | null }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    customerId: customerId ?? "",
    issueDate: today,
    dueDate: "",
    currency: "NPR" as CrmCurrency,
    description: "Freight and Logistics",
    amount: "",
    taxRate: "0",
    notes: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/finance/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
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
      {notice ? <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{notice}</div> : null}

      <section className="mb-5 rounded-[26px] border border-black/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-black/35">Shipment</p><p className="mt-1 text-sm font-black">{shipmentReference}</p></div><div className="min-w-[260px]"><p className="text-[9px] font-black uppercase tracking-[.14em] text-black/35">CRM customer</p>{customerId ? <p className="mt-1 flex items-center gap-2 text-sm font-black text-emerald-700"><Link2 size={14}/>{customerId}</p> : <p className="mt-1 flex items-center gap-2 text-sm font-black text-amber-700"><TriangleAlert size={14}/>Not linked yet</p>}</div></div>
      </section>

      {!customerId ? <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>This shipment has no confirmed CRM customer.</strong><p className="mt-1 text-xs leading-5">{quoteReference ? `Its originating quote is ${quoteReference}. Confirm that quote against the correct customer in CRM, or enter the correct KCPL-C customer reference below.` : "Link the shipment to a CRM customer, or enter the correct KCPL-C customer reference below."}</p></div> : null}

      <section className="rounded-[30px] border border-black/10 bg-white p-6 shadow-sm sm:p-8"><div className="mb-6 flex items-start gap-3"><span className="rounded-xl bg-[#10263f] p-2.5 text-white"><FilePlus2 size={17}/></span><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#b78a3e]">New receivable</p><h2 className="mt-1 text-2xl font-black">Invoice draft</h2><p className="mt-1 text-xs text-black/45">The shipment reference is locked. Customer ownership is resolved automatically whenever possible.</p></div></div>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {!customerId ? <Field label="CRM customer reference"><input required className="ship-fin-input" value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} placeholder="KCPL-C-..."/></Field> : null}
          <Field label="Issue date"><input required type="date" className="ship-fin-input" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })}/></Field>
          <Field label="Due date"><input type="date" className="ship-fin-input" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></Field>
          <Field label="Currency"><select className="ship-fin-input" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
          <Field label="Amount before tax"><input required min="0.01" step="0.01" type="number" className="ship-fin-input" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></Field>
          <Field label="Tax %"><input min="0" max="100" step="0.01" type="number" className="ship-fin-input" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></Field>
          <Field label="Description"><input className="ship-fin-input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></Field>
          <div className="md:col-span-2 xl:col-span-4"><Field label="Invoice notes"><textarea className="ship-fin-input min-h-24 resize-y" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></Field></div>
          <div className="md:col-span-2 xl:col-span-4"><button disabled={busy} className="rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Creating…" : "Create invoice draft"}</button></div>
        </form>
      </section>
    </div>
    <style jsx global>{`.ship-fin-input{width:100%;border:1px solid rgba(0,0,0,.1);border-radius:.75rem;background:#faf9f5;padding:.75rem;font-size:.8rem;outline:none}.ship-fin-input:focus{border-color:#b78a3e;background:white}`}</style>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.12em] text-black/40">{label}</span>{children}</label>;
}
