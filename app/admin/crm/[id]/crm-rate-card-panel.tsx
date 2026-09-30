"use client";

import { FormEvent, useMemo, useState } from "react";
import { Archive, ArrowRight, BadgeDollarSign, Pencil, Plus, Save, X } from "lucide-react";
import { crmCurrencies } from "../crm-data";
import { crmRateModes, crmRateUnitLabels, crmRateUnits, type CrmRateCard, type CrmRateMode, type CrmRateUnit } from "../crm-rate-cards";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsNotice } from "../../operations-ui";
import { freightModeLabel } from "../../freight-mode";
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

/** A calendar day, whether stored as "2026-11-29" or as a full timestamp. */
function dateLabel(value: string | null) {
  if (!value) return "Open-ended";
  const plainDay = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(plainDay ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: plainDay ? "UTC" : "Asia/Kathmandu" }).format(date);
}

export function CrmRateCardPanel({ customerId, initialRateCards, permissions }: { customerId: string; initialRateCards: CrmRateCard[]; permissions: StaffCapabilities }) {
  const [rateCards, setRateCards] = useState(initialRateCards);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);

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
    setNotice(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
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
      setNotice({ text: editingId ? "Rate card updated." : "Rate card added.", tone: "success" });
      reset();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Rate card could not be saved.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function archive(item: CrmRateCard) {
    if (!window.confirm(`Archive the ${item.origin} → ${item.destination} rate card?`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/crm/customers/${encodeURIComponent(customerId)}/rate-cards/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Rate card could not be archived.");
      setRateCards((current) => current.map((rate) => rate.id === item.id ? { ...rate, active: false } : rate));
      setNotice({ text: "Rate card archived.", tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Rate card could not be archived.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-tool-panel">
      <div className="crm-tool-bar">
        <p className="crm-tool-intro">Costs show only to people with commercial access.</p>
        {permissions.canManageRateCards ? <OpsButton variant={open ? "secondary" : "primary"} onClick={() => { if (open) reset(); else { setForm(blankForm); setEditingId(null); setOpen(true); } }}>{open ? <X size={14} strokeWidth={1.75} aria-hidden="true"/> : <Plus size={14} strokeWidth={1.75} aria-hidden="true"/>}{open ? "Close" : "New rate card"}</OpsButton> : null}
      </div>

      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}

        {open && permissions.canManageRateCards ? <form onSubmit={save} className="ops-inset-group grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Origin"><input required className="ops-input" value={form.origin} onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))} /></Field>
          <Field label="Destination"><input required className="ops-input" value={form.destination} onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))} /></Field>
          <Field label="Mode"><select className="ops-select" value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as CrmRateMode }))}>{crmRateModes.map((mode) => <option key={mode} value={mode}>{freightModeLabel(mode)}</option>)}</select></Field>
          <Field label="Rate unit"><select className="ops-select" value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value as CrmRateUnit }))}>{crmRateUnits.map((unit) => <option key={unit} value={unit}>{crmRateUnitLabels[unit]}</option>)}</select></Field>
          <Field label="Carrier"><input className="ops-input" value={form.carrier} onChange={(event) => setForm((current) => ({ ...current, carrier: event.target.value }))} /></Field>
          <Field label="Service"><input className="ops-input" value={form.service} onChange={(event) => setForm((current) => ({ ...current, service: event.target.value }))} /></Field>
          <Field label="Currency"><select className="ops-select" value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></Field>
          <Field label="Sell rate"><input required inputMode="decimal" className="ops-input" value={form.sellRate} onChange={(event) => setForm((current) => ({ ...current, sellRate: event.target.value }))} /></Field>
          <Field label="Internal cost rate"><input inputMode="decimal" className="ops-input" value={form.costRate} onChange={(event) => setForm((current) => ({ ...current, costRate: event.target.value }))} /></Field>
          <Field label="Minimum charge"><input inputMode="decimal" className="ops-input" value={form.minimumCharge} onChange={(event) => setForm((current) => ({ ...current, minimumCharge: event.target.value }))} /></Field>
          <Field label="Valid from"><input type="date" className="ops-input" value={form.validFrom} onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))} /></Field>
          <Field label="Valid until"><input type="date" className="ops-input" value={form.validUntil} onChange={(event) => setForm((current) => ({ ...current, validUntil: event.target.value }))} /></Field>
          <div className="md:col-span-2 xl:col-span-4"><Field label="Notes"><textarea className="ops-textarea min-h-20" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></Field></div>
          <label className="crm-tool-check"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />Active rate</label>
          <div className="flex justify-end gap-2 md:col-span-2 xl:col-span-3"><OpsButton variant="ghost" onClick={reset}>Cancel</OpsButton><OpsButton type="submit" variant="primary" disabled={busy}><Save size={14} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Saving…" : editingId ? "Update rate" : "Save rate"}</OpsButton></div>
        </form> : null}

        <div>
          {activeCards.length ? <div className="grid gap-3 lg:grid-cols-2">{activeCards.map((item) => <article key={item.id} className="crm-rate-card">
            <div className="flex items-start justify-between gap-3"><div><strong className="ops-route"><span>{item.origin}</span><ArrowRight size={11} className="ops-route-arrow" aria-hidden="true"/><span>{item.destination}</span></strong><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{freightModeLabel(item.mode)} · {crmRateUnitLabels[item.unit]}</p></div><OpsBadge tone="success" dot>Active</OpsBadge></div>
            <div className="crm-rate-facts"><div><p className="crm-rate-label">Sell</p><p className="crm-rate-value">{formatMoney(item.sell_rate, item.currency)}</p></div><div><p className="crm-rate-label">Cost</p><p className="crm-rate-value">{formatMoney(item.cost_rate, item.currency)}</p></div><div><p className="crm-rate-label">Carrier</p><p className="crm-rate-value">{item.carrier || "Any"}</p></div><div><p className="crm-rate-label">Valid until</p><p className="crm-rate-value">{dateLabel(item.valid_until)}</p></div></div>
            {item.minimum_charge !== null ? <p className="crm-rate-note"><BadgeDollarSign size={13} strokeWidth={1.75} aria-hidden="true"/>Minimum {formatMoney(item.minimum_charge, item.currency)}</p> : null}
            {item.notes ? <p className="crm-rate-note">{item.notes}</p> : null}
            {permissions.canManageRateCards ? <div className="mt-4 flex justify-end gap-2"><OpsButton size="sm" variant="secondary" onClick={() => edit(item)}><Pencil size={13} strokeWidth={1.75} aria-hidden="true"/>Edit</OpsButton><OpsButton size="sm" variant="danger" disabled={busy} onClick={() => archive(item)}><Archive size={13} strokeWidth={1.75} aria-hidden="true"/>Archive</OpsButton></div> : null}
          </article>)}</div> : <OpsEmptyState compact icon={<BadgeDollarSign size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No rate cards yet" description="Add one for a lane this customer ships often."/>}
        </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <OpsField label={label}>{children}</OpsField>;
}
