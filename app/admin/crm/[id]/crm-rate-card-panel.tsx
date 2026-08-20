"use client";

import { FormEvent, useMemo, useState } from "react";
import { Archive, ArrowRight, BadgeDollarSign, Pencil, Plus, Save, X } from "lucide-react";
import { crmCurrencies } from "../crm-data";
import { crmRateModes, crmRateUnitLabels, crmRateUnits, type CrmRateCard, type CrmRateMode, type CrmRateUnit } from "../crm-rate-cards";
import type { StaffCapabilities } from "../../staff-permissions";

const blankForm = {
  origin: "",
  destination: "",
  mode: "road" as CrmRateMode,
  carrier: "",
  service: "",
  currency: "NPR",
  costRate: "",
  sellRate: "",
  unit: "flat" as CrmRateUnit,
  minimumCharge: "",
  validFrom: "",
  validUntil: "",
  notes: "",
  active: true,
};

function formatMoney(value: number | null, currency: string) {
  if (value === null) return "Not set";
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 3 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-AU")}`;
  }
}

function dateLabel(value: string | null) {
  if (!value) return "Open-ended";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

export function CrmRateCardPanel({ customerId, initialRateCards, permissions }: { customerId: string; initialRateCards: CrmRateCard[]; permissions: StaffCapabilities }) {
  const [rateCards, setRateCards] = useState(initialRateCards);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const activeCards = useMemo(() => rateCards.filter((item) => item.active), [rateCards]);

  function reset() {
    setForm(blankForm);
    setEditingId(null);
    setOpen(false);
  }

  function edit(item: CrmRateCard) {
    setForm({
      origin: item.origin,
      destination: item.destination,
      mode: item.mode,
      carrier: item.carrier ?? "",
      service: item.service ?? "",
      currency: item.currency,
      costRate: item.cost_rate?.toString() ?? "",
      sellRate: item.sell_rate.toString(),
      unit: item.unit,
      minimumCharge: item.minimum_charge?.toString() ?? "",
      validFrom: item.valid_from ?? "",
      validUntil: item.valid_until ?? "",
      notes: item.notes ?? "",
      active: item.active,
    });
    setEditingId(item.id);
    setOpen(true);
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const path = editingId
        ? `/api/admin/crm/customers/${encodeURIComponent(customerId)}/rate-cards/${encodeURIComponent(editingId)}`
        : `/api/admin/crm/customers/${encodeURIComponent(customerId)}/rate-cards`;
      const response = await fetch(path, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          costRate: form.costRate,
          sellRate: form.sellRate,
          minimumCharge: form.minimumCharge,
        }),
      });
      const data = await response.json() as { ok?: boolean; rateCard?: CrmRateCard; error?: string };
      if (!response.ok || !data.rateCard) throw new Error(data.error || "Rate card could not be saved.");
      setRateCards((current) => editingId
        ? current.map((item) => item.id === editingId ? data.rateCard! : item)
        : [data.rateCard!, ...current]);
      setNotice(editingId ? "Rate card updated." : "Rate card added.");
      reset();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Rate card could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function archive(item: CrmRateCard) {
    if (!window.confirm(`Archive the ${item.origin} → ${item.destination} rate card?`)) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customerId)}/rate-cards/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Rate card could not be archived.");
      setRateCards((current) => current.map((rate) => rate.id === item.id ? { ...rate, active: false } : rate));
      setNotice("Rate card archived.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Rate card could not be archived.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-[#f4f1e9] px-5 pb-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] rounded-[28px] border border-black/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 p-6 sm:p-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#b78a3e]">Customer pricing</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-.035em]">Rate cards</h2>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-black/45">Structured customer-specific lanes and commercial rates. Cost fields stay inside commercial permissions.</p>
          </div>
          {permissions.canManageRateCards ? <button type="button" onClick={() => { if (open) reset(); else { setForm(blankForm); setEditingId(null); setOpen(true); } }} className="flex items-center gap-2 rounded-xl bg-[#10263f] px-4 py-2.5 text-xs font-black text-white">{open ? <X size={14} /> : <Plus size={14} />}{open ? "Close" : "New rate card"}</button> : null}
        </div>

        {notice ? <div className="mx-6 mt-5 rounded-xl bg-[#fff8e8] px-4 py-3 text-xs font-bold text-[#6d5427] sm:mx-8">{notice}</div> : null}

        {open && permissions.canManageRateCards ? <form onSubmit={save} className="mx-6 mt-5 grid gap-3 rounded-2xl border border-[#d4ad62]/30 bg-[#fffaf0] p-4 sm:mx-8 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Origin"><input required className="crm360-input" value={form.origin} onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))} /></Field>
          <Field label="Destination"><input required className="crm360-input" value={form.destination} onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))} /></Field>
          <Field label="Mode"><select className="crm360-input" value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as CrmRateMode }))}>{crmRateModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></Field>
          <Field label="Rate unit"><select className="crm360-input" value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value as CrmRateUnit }))}>{crmRateUnits.map((unit) => <option key={unit} value={unit}>{crmRateUnitLabels[unit]}</option>)}</select></Field>
          <Field label="Carrier"><input className="crm360-input" value={form.carrier} onChange={(event) => setForm((current) => ({ ...current, carrier: event.target.value }))} /></Field>
          <Field label="Service"><input className="crm360-input" value={form.service} onChange={(event) => setForm((current) => ({ ...current, service: event.target.value }))} /></Field>
          <Field label="Currency"><select className="crm360-input" value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></Field>
          <Field label="Sell rate"><input required inputMode="decimal" className="crm360-input" value={form.sellRate} onChange={(event) => setForm((current) => ({ ...current, sellRate: event.target.value }))} /></Field>
          <Field label="Internal cost rate"><input inputMode="decimal" className="crm360-input" value={form.costRate} onChange={(event) => setForm((current) => ({ ...current, costRate: event.target.value }))} /></Field>
          <Field label="Minimum charge"><input inputMode="decimal" className="crm360-input" value={form.minimumCharge} onChange={(event) => setForm((current) => ({ ...current, minimumCharge: event.target.value }))} /></Field>
          <Field label="Valid from"><input type="date" className="crm360-input" value={form.validFrom} onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))} /></Field>
          <Field label="Valid until"><input type="date" className="crm360-input" value={form.validUntil} onChange={(event) => setForm((current) => ({ ...current, validUntil: event.target.value }))} /></Field>
          <div className="md:col-span-2 xl:col-span-4"><Field label="Notes"><textarea className="crm360-input min-h-20 resize-y" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field></div>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />Active rate</label>
          <div className="flex justify-end gap-2 md:col-span-2 xl:col-span-3"><button type="button" onClick={reset} className="rounded-xl border border-black/10 px-4 py-2 text-xs font-black">Cancel</button><button type="submit" disabled={busy} className="flex items-center gap-2 rounded-xl bg-[#10263f] px-4 py-2 text-xs font-black text-white disabled:opacity-50"><Save size={13} />{busy ? "Saving…" : editingId ? "Update rate" : "Save rate"}</button></div>
        </form> : null}

        <div className="p-6 sm:p-8">
          {activeCards.length ? <div className="grid gap-3 lg:grid-cols-2">{activeCards.map((item) => <article key={item.id} className="rounded-2xl border border-black/10 bg-[#faf9f5] p-4">
            <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-black"><span>{item.origin}</span><ArrowRight size={13} /><span>{item.destination}</span></div><p className="mt-1 text-[10px] font-bold uppercase tracking-[.09em] text-black/35">{item.mode} · {crmRateUnitLabels[item.unit]}</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">Active</span></div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/10 pt-3 text-xs"><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-black/30">Sell</p><p className="mt-1 font-black text-[#10263f]">{formatMoney(item.sell_rate, item.currency)}</p></div><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-black/30">Cost</p><p className="mt-1 font-bold text-black/55">{formatMoney(item.cost_rate, item.currency)}</p></div><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-black/30">Carrier</p><p className="mt-1 font-bold text-black/55">{item.carrier || "Any"}</p></div><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-black/30">Valid until</p><p className="mt-1 font-bold text-black/55">{dateLabel(item.valid_until)}</p></div></div>
            {item.minimum_charge !== null ? <p className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[10px] font-bold text-black/50"><BadgeDollarSign size={12} />Minimum {formatMoney(item.minimum_charge, item.currency)}</p> : null}
            {item.notes ? <p className="mt-3 text-xs leading-5 text-black/45">{item.notes}</p> : null}
            {permissions.canManageRateCards ? <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => edit(item)} className="flex items-center gap-1 rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[9px] font-black"><Pencil size={11} />Edit</button><button type="button" disabled={busy} onClick={() => archive(item)} className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[9px] font-black text-rose-700"><Archive size={11} />Archive</button></div> : null}
          </article>)}</div> : <div className="rounded-2xl border border-dashed border-black/15 bg-[#faf9f5] p-8 text-center text-sm text-black/40">No active customer rate cards yet.</div>}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[.13em] text-black/40">{label}</span>{children}</label>;
}
