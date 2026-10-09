"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { OpsButton, OpsField, OpsNotice, OpsSurface } from "../../operations-ui";
import { crmCurrencies } from "../../crm/crm-data";
import {
  DEFAULT_VAT_RATE,
  DUTY_ESTIMATE_MAX_LEVIES,
  DUTY_ESTIMATE_MAX_LINES,
  computeDutyEstimate,
  dutyEstimateFromInput,
  type StoredDutyEstimate,
} from "../../../shipment-duty-estimate";

/*
 * The duty estimate on the Job File, under customs: lines by HS code with the
 * tariff rates, freight and insurance, the customs exchange rate, and the
 * figures as they are typed. Saved, it can be shown to the customer so the
 * money is ready at the border.
 */

type Line = { hsCode: string; description: string; value: string; dutyRate: string; exciseRate: string };
type Levy = { label: string; kind: "percent" | "fixed"; amount: string };

/** Lines read from a commercial invoice, to start an estimate from; the rates still come from the tariff. */
export type DutySuggestion = {
  currency: string | null;
  incoterm: string | null;
  freight: number | null;
  insurance: number | null;
  lines: Array<{ hsCode: string; description: string; value: string }>;
  source: string;
};

const npr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(value);
const blankLine = (): Line => ({ hsCode: "", description: "", value: "", dutyRate: "", exciseRate: "0" });

export function DutyEstimateControl({ reference, initial, suggestion, rates, ratesDate }: {
  reference: string;
  initial: StoredDutyEstimate | null;
  suggestion: DutySuggestion | null;
  /** Nepal Rastra Bank rates, NPR per unit, to start the exchange-rate field from. */
  rates: Record<string, number> | null;
  ratesDate: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const startCurrency = initial?.currency ?? suggestion?.currency ?? "USD";
  const [form, setForm] = useState(() => ({
    currency: startCurrency,
    basis: initial?.basis ?? (suggestion?.incoterm && /^C(IF|IP|FR|PT)$/.test(suggestion.incoterm) ? "CIF" : "FOB"),
    freight: initial ? String(initial.freight) : suggestion?.freight !== null && suggestion?.freight !== undefined ? String(suggestion.freight) : "",
    insurance: initial ? String(initial.insurance) : suggestion?.insurance !== null && suggestion?.insurance !== undefined ? String(suggestion.insurance) : "",
    exchangeRate: initial ? String(initial.exchange_rate) : startCurrency === "NPR" ? "1" : rates?.[startCurrency] ? String(rates[startCurrency]) : "",
    vatRate: String(initial?.vat_rate ?? DEFAULT_VAT_RATE),
    rateNote: initial?.rate_note ?? "",
    sharedWithCustomer: initial?.shared_with_customer ?? false,
  }));
  const [lines, setLines] = useState<Line[]>(() => initial?.lines.map((line) => ({ hsCode: line.hs_code, description: line.description, value: String(line.value), dutyRate: String(line.duty_rate), exciseRate: String(line.excise_rate) }))
    ?? (suggestion?.lines.length ? suggestion.lines.map((line) => ({ ...line, dutyRate: "", exciseRate: "0" })) : [blankLine()]));
  const [levies, setLevies] = useState<Levy[]>(() => initial?.levies.map((levy) => ({ label: levy.label, kind: levy.kind, amount: String(levy.amount) })) ?? []);

  const payload = { ...form, lines, levies };
  // The figures follow the form as it's filled in; the server works them out again on save.
  const live = useMemo(() => {
    const checked = dutyEstimateFromInput({ ...form, lines, levies });
    return checked.ok ? computeDutyEstimate(checked.input) : null;
  }, [form, lines, levies]);

  function chooseCurrency(currency: string) {
    setForm((current) => ({ ...current, currency, exchangeRate: currency === "NPR" ? "1" : rates?.[currency] ? String(rates[currency]) : current.exchangeRate }));
  }
  function setLine(index: number, patch: Partial<Line>) { setLines((current) => current.map((line, at) => at === index ? { ...line, ...patch } : line)); }
  function setLevy(index: number, patch: Partial<Levy>) { setLevies((current) => current.map((levy, at) => at === index ? { ...levy, ...patch } : levy)); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(reference)}/duty-estimate`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The estimate couldn’t be saved.");
      setNotice({ text: form.sharedWithCustomer ? "Estimate saved. The customer sees the total in their portal." : "Estimate saved.", tone: "success" });
      setOpen(false);
      router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "The estimate couldn’t be saved.", tone: "danger" }); }
    finally { setBusy(false); }
  }

  const shown = open ? live : initial?.result ?? null;
  return <OpsSurface
    id="shipment-duty-estimate"
    title="Duty estimate"
    description={initial ? `Saved by ${initial.updated_by_name}${initial.shared_with_customer ? " · shown to the customer" : ""}` : "What customs is likely to charge, worked out before the cargo arrives."}
    action={<OpsButton variant="secondary" size="xs" onClick={() => setOpen((value) => !value)} aria-expanded={open}><Calculator size={13} strokeWidth={1.75} aria-hidden="true"/>{open ? "Close" : initial ? "Edit" : "Estimate"}</OpsButton>}
  >
    {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
    {shown ? <dl className="job-stat-row">
      <div><dt>CIF in rupees</dt><dd>{npr(shown.cif_npr)}</dd></div>
      <div><dt>Customs duty</dt><dd>{npr(shown.duty)}</dd></div>
      {shown.excise ? <div><dt>Excise</dt><dd>{npr(shown.excise)}</dd></div> : null}
      <div><dt>VAT</dt><dd>{npr(shown.vat)}</dd></div>
      {shown.levy_total ? <div><dt>Other levies</dt><dd>{npr(shown.levy_total)}</dd></div> : null}
      <div><dt>To pay at customs</dt><dd><strong>{npr(shown.total)}</strong></dd></div>
    </dl> : !open ? <p className="portal-footnote m-0">No estimate yet. Add the HS codes and values from the commercial invoice.</p> : null}
    {shown ? <p className="ops-inspector-hint mt-2">An estimate from the declared value. Customs’ own assessment is what is paid.</p> : null}
    {!initial && suggestion ? <p className="ops-inspector-hint mt-2">{suggestion.lines.length} line{suggestion.lines.length === 1 ? "" : "s"} read from {suggestion.source}. Open it and add each line’s duty rate from the tariff.</p> : null}

    {open ? <form onSubmit={save} className="portal-form mt-3" aria-busy={busy}>
      <div className="portal-form-grid">
        <OpsField label="Invoice currency"><select value={form.currency} onChange={(event) => chooseCurrency(event.target.value)}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></OpsField>
        <OpsField label="Invoice terms" hint="FOB adds the freight and insurance below"><select value={form.basis} onChange={(event) => setForm({ ...form, basis: event.target.value as "FOB" | "CIF" })}><option value="FOB">FOB / EXW (add freight)</option><option value="CIF">CIF / CFR (freight included)</option></select></OpsField>
        {form.basis === "FOB" ? <>
          <OpsField label={`Freight (${form.currency})`}><input inputMode="decimal" value={form.freight} onChange={(event) => setForm({ ...form, freight: event.target.value })} placeholder="0"/></OpsField>
          <OpsField label={`Insurance (${form.currency})`} hint="Leave 0 if none"><input inputMode="decimal" value={form.insurance} onChange={(event) => setForm({ ...form, insurance: event.target.value })} placeholder="0"/></OpsField>
        </> : null}
        {form.currency !== "NPR" ? <OpsField label={`Rupees per ${form.currency}`} hint={rates?.[form.currency] ? `NRB ${ratesDate ?? "today"}: ${rates[form.currency]}. Use the customs rate if it differs.` : "The customs exchange rate"}><input required inputMode="decimal" value={form.exchangeRate} onChange={(event) => setForm({ ...form, exchangeRate: event.target.value })}/></OpsField> : null}
        <OpsField label="VAT %"><input inputMode="decimal" value={form.vatRate} onChange={(event) => setForm({ ...form, vatRate: event.target.value })}/></OpsField>
      </div>

      <fieldset className="duty-lines">
        <legend className="ops-field-label">Goods by HS code</legend>
        {lines.map((line, index) => <div key={index} className="duty-line">
          <OpsField label="HS code"><input required inputMode="numeric" value={line.hsCode} onChange={(event) => setLine(index, { hsCode: event.target.value })} placeholder="85171300"/></OpsField>
          <OpsField label="Goods"><input value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} placeholder="Mobile phones"/></OpsField>
          <OpsField label={`Value (${form.currency})`}><input required inputMode="decimal" value={line.value} onChange={(event) => setLine(index, { value: event.target.value })}/></OpsField>
          <OpsField label="Duty %"><input required inputMode="decimal" value={line.dutyRate} onChange={(event) => setLine(index, { dutyRate: event.target.value })}/></OpsField>
          <OpsField label="Excise %"><input inputMode="decimal" value={line.exciseRate} onChange={(event) => setLine(index, { exciseRate: event.target.value })}/></OpsField>
          {lines.length > 1 ? <OpsButton type="button" variant="ghost" size="sm" aria-label={`Remove line ${index + 1}`} onClick={() => setLines((current) => current.filter((_, at) => at !== index))}><Trash2 size={13} aria-hidden="true"/></OpsButton> : null}
        </div>)}
        {lines.length < DUTY_ESTIMATE_MAX_LINES ? <OpsButton type="button" variant="ghost" size="sm" onClick={() => setLines((current) => [...current, blankLine()])}><Plus size={13} aria-hidden="true"/>Add an HS line</OpsButton> : null}
      </fieldset>

      <fieldset className="duty-lines">
        <legend className="ops-field-label">Other levies</legend>
        {levies.map((levy, index) => <div key={index} className="duty-line" data-levy>
          <OpsField label="Levy"><input value={levy.label} onChange={(event) => setLevy(index, { label: event.target.value })} placeholder="Customs service fee"/></OpsField>
          <OpsField label="As"><select value={levy.kind} onChange={(event) => setLevy(index, { kind: event.target.value as "percent" | "fixed" })}><option value="percent">% of value with duty</option><option value="fixed">Fixed rupees</option></select></OpsField>
          <OpsField label={levy.kind === "percent" ? "Rate %" : "Amount NPR"}><input inputMode="decimal" value={levy.amount} onChange={(event) => setLevy(index, { amount: event.target.value })}/></OpsField>
          <OpsButton type="button" variant="ghost" size="sm" aria-label={`Remove ${levy.label || "levy"}`} onClick={() => setLevies((current) => current.filter((_, at) => at !== index))}><Trash2 size={13} aria-hidden="true"/></OpsButton>
        </div>)}
        {levies.length < DUTY_ESTIMATE_MAX_LEVIES ? <OpsButton type="button" variant="ghost" size="sm" onClick={() => setLevies((current) => [...current, { label: "", kind: "percent", amount: "" }])}><Plus size={13} aria-hidden="true"/>Add a levy</OpsButton> : null}
      </fieldset>

      <OpsField label="Where the rates came from" hint="Internal, e.g. Customs tariff 2083/84, chapter 85"><input maxLength={200} value={form.rateNote} onChange={(event) => setForm({ ...form, rateNote: event.target.value })}/></OpsField>
      <label className="job-container-all"><input type="checkbox" checked={form.sharedWithCustomer} onChange={(event) => setForm({ ...form, sharedWithCustomer: event.target.checked })}/>Show the total to the customer in their portal, marked as an estimate</label>
      <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy || !live}>{busy ? "Saving…" : "Save estimate"}</OpsButton></div>
    </form> : null}
  </OpsSurface>;
}
