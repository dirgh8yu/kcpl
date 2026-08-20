"use client";

import { FormEvent, useMemo, useState } from "react";
import { Archive, ArrowRight, BadgeDollarSign, Pencil, Plus, Save, X } from "lucide-react";
import { crmCurrencies } from "../crm-data";
import { crmRateModes, crmRateUnitLabels, crmRateUnits, type CrmRateCard, type CrmRateMode, type CrmRateUnit } from "../crm-rate-cards";
import type { StaffCapabilities } from "../../staff-permissions";
import { OpsButton, OpsEmptyState, OpsPanel, OpsStatusBadge } from "../../operations-ui";

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
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 3 }).format(value); }
  catch { return `${currency} ${value.toLocaleString("en-AU")}`; }
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
        body: JSON.stringify({ ...form, costRate: form.costRate, sellRate: form.sellRate, minimumCharge: form.minimumCharge }),
      });
      const data = await response.json() as { ok?: boolean; rateCard?: CrmRateCard; error?: string };
      if (!response.ok || !data.rateCard) throw new Error(data.error || "Rate card could not be saved.");
      setRateCards((current) => editingId ? current.map((item) => item.id === editingId ? data.rateCard! : item) : [data.rateCard!, ...current]);
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
    <section className="ops-page-body !pt-0">
      <OpsPanel
        eyebrow="Customer pricing"
        title="Rate cards"
        description="Customer-specific lanes, sell rates and internal cost benchmarks. Cost fields remain restricted to authorised commercial roles."
        action={permissions.canManageRateCards ? <OpsButton tone="secondary" onClick={() => { if (open) reset(); else { setForm(blankForm); setEditingId(null); setOpen(true); } }} aria-expanded={open}>{open ? <><X size={13}/>Close editor</> : <><Plus size={13}/>New rate card</>}</OpsButton> : undefined}
      >
        {notice ? <div role="status" aria-live="polite" className="mx-4 mt-4 rounded-lg border border-[#e5dfd1] bg-[#faf7f0] px-3 py-2.5 text-[11px] font-medium text-[#765f3b]">{notice}</div> : null}

        {open && permissions.canManageRateCards ? <form onSubmit={save} className="mx-4 mt-4 grid gap-3 rounded-lg border border-[#e3e6e9] bg-[#fafafa] p-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Origin"><input required className="crm360-input" value={form.origin} onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))}/></Field>
          <Field label="Destination"><input required className="crm360-input" value={form.destination} onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))}/></Field>
          <Field label="Mode"><select className="crm360-input" value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as CrmRateMode }))}>{crmRateModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></Field>
          <Field label="Rate unit"><select className="crm360-input" value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value as CrmRateUnit }))}>{crmRateUnits.map((unit) => <option key={unit} value={unit}>{crmRateUnitLabels[unit]}</option>)}</select></Field>
          <Field label="Carrier"><input className="crm360-input" value={form.carrier} onChange={(event) => setForm((current) => ({ ...current, carrier: event.target.value }))}/></Field>
          <Field label="Service"><input className="crm360-input" value={form.service} onChange={(event) => setForm((current) => ({ ...current, service: event.target.value }))}/></Field>
          <Field label="Currency"><select className="crm360-input" value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></Field>
          <Field label="Sell rate"><input required inputMode="decimal" className="crm360-input" value={form.sellRate} onChange={(event) => setForm((current) => ({ ...current, sellRate: event.target.value }))}/></Field>
          <Field label="Internal cost rate"><input inputMode="decimal" className="crm360-input" value={form.costRate} onChange={(event) => setForm((current) => ({ ...current, costRate: event.target.value }))}/></Field>
          <Field label="Minimum charge"><input inputMode="decimal" className="crm360-input" value={form.minimumCharge} onChange={(event) => setForm((current) => ({ ...current, minimumCharge: event.target.value }))}/></Field>
          <Field label="Valid from"><input type="date" className="crm360-input" value={form.validFrom} onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))}/></Field>
          <Field label="Valid until"><input type="date" className="crm360-input" value={form.validUntil} onChange={(event) => setForm((current) => ({ ...current, validUntil: event.target.value }))}/></Field>
          <div className="md:col-span-2 xl:col-span-4"><Field label="Notes"><textarea className="crm360-input min-h-20 resize-y" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}/></Field></div>
          <label className="flex min-h-10 items-center gap-2 text-[11px] font-medium text-[#5d6670]"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}/>Active rate</label>
          <div className="flex justify-end gap-2 md:col-span-2 xl:col-span-3"><OpsButton type="button" tone="ghost" onClick={reset}>Cancel</OpsButton><OpsButton type="submit" tone="primary" disabled={busy}><Save size={13}/>{busy ? "Saving…" : editingId ? "Update rate" : "Save rate"}</OpsButton></div>
        </form> : null}

        <div className="p-4">
          {activeCards.length ? <div className="overflow-hidden rounded-lg border border-[#e3e6e9]"><div className="overflow-x-auto"><table className="ops-dense-table min-w-[920px] text-left"><thead><tr><th className="px-4">Lane</th><th className="px-3">Mode / unit</th><th className="px-3">Sell</th><th className="px-3">Cost</th><th className="px-3">Carrier</th><th className="px-3">Validity</th><th className="px-3">Status</th><th className="px-3 text-right">Actions</th></tr></thead><tbody>{activeCards.map((item) => <tr key={item.id}><td className="px-4"><div className="flex items-center gap-2 font-semibold text-[#31363c]"><span>{item.origin}</span><ArrowRight size={12} className="text-[#9aa0a7]"/><span>{item.destination}</span></div>{item.notes ? <p className="mt-1 max-w-[260px] truncate text-[10px] text-[#8a9199]" title={item.notes}>{item.notes}</p> : null}</td><td className="px-3 text-[#66707a]">{item.mode} · {crmRateUnitLabels[item.unit]}</td><td className="px-3 font-semibold">{formatMoney(item.sell_rate, item.currency)}{item.minimum_charge !== null ? <p className="mt-1 flex items-center gap-1 text-[9px] font-medium text-[#8a9199]"><BadgeDollarSign size={10}/>Min {formatMoney(item.minimum_charge, item.currency)}</p> : null}</td><td className="px-3 text-[#66707a]">{formatMoney(item.cost_rate, item.currency)}</td><td className="px-3 text-[#66707a]">{item.carrier || "Any"}</td><td className="px-3 text-[#66707a]">{dateLabel(item.valid_until)}</td><td className="px-3"><OpsStatusBadge tone="success">Active</OpsStatusBadge></td><td className="px-3"><div className="flex justify-end gap-1.5">{permissions.canManageRateCards ? <><OpsButton type="button" tone="ghost" className="!min-h-8 !px-2" onClick={() => edit(item)} aria-label={`Edit ${item.origin} to ${item.destination} rate card`}><Pencil size={12}/></OpsButton><OpsButton type="button" tone="danger" className="!min-h-8 !px-2" disabled={busy} onClick={() => archive(item)} aria-label={`Archive ${item.origin} to ${item.destination} rate card`}><Archive size={12}/></OpsButton></> : null}</div></td></tr>)}</tbody></table></div></div> : <OpsEmptyState compact title="No active customer rate cards" detail="Add lane-specific pricing when this account has negotiated rates or repeat trade."/>}
        </div>
      </OpsPanel>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#69727b]">{label}</span>{children}</label>;
}
