"use client";

import { Plus, X } from "lucide-react";
import { invoiceTotals, INVOICE_MAX_LINES, type InvoiceLineInput } from "./finance-data";
import { NEPAL_VAT_RATE } from "./invoice-tax-field";
import { OpsButton } from "../operations-ui";

/**
 * How a line is charged. Nothing is chosen until someone chooses, so VAT is
 * never left off by default; "at cost" is money paid for the customer
 * (customs duty, port charges), passed on with no VAT and not KCPL's revenue.
 */
export type InvoiceLineType = "" | "vat" | "none" | "other" | "disbursement";

export type InvoiceLineDraft = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  type: InvoiceLineType;
  rate: string;
};

let keySeed = 0;
export function newInvoiceLine(values: Partial<Omit<InvoiceLineDraft, "key">> = {}): InvoiceLineDraft {
  keySeed += 1;
  return { key: `line-${Date.now().toString(36)}-${keySeed}`, description: "", quantity: "1", unitPrice: "", type: "", rate: "", ...values };
}

/** The lines as the server reads them, or what is missing. */
export function invoiceLinesForSubmit(lines: readonly InvoiceLineDraft[]): { ok: true; lines: InvoiceLineInput[] } | { ok: false; error: string } {
  if (!lines.length) return { ok: false, error: "Add at least one line." };
  const out: InvoiceLineInput[] = [];
  for (const [index, line] of lines.entries()) {
    const label = lines.length > 1 ? `Line ${index + 1}: ` : "";
    if (!line.type) return { ok: false, error: `${label}choose how it is charged.` };
    const unitPrice = Number(line.unitPrice);
    const quantity = Number(line.quantity || "1");
    if (!line.unitPrice.trim() || !Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, error: `${label}enter its price.` };
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: `${label}enter a quantity above zero.` };
    const taxRate = line.type === "vat" ? NEPAL_VAT_RATE : line.type === "other" ? Number(line.rate) : 0;
    if (line.type === "other" && (!line.rate.trim() || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)) return { ok: false, error: `${label}enter a tax rate between 0 and 100.` };
    out.push({ kind: line.type === "disbursement" ? "disbursement" : "service", description: line.description, quantity, unitPrice, taxRate });
  }
  return { ok: true, lines: out };
}

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

export function InvoiceLinesEditor({ lines, currency, disabled = false, onChange }: {
  lines: InvoiceLineDraft[];
  currency: string;
  disabled?: boolean;
  onChange: (lines: InvoiceLineDraft[]) => void;
}) {
  const update = (key: string, values: Partial<InvoiceLineDraft>) => onChange(lines.map((line) => line.key === key ? { ...line, ...values } : line));
  const ready = invoiceLinesForSubmit(lines);
  const totals = ready.ok ? invoiceTotals(ready.lines) : null;

  return <div className="invoice-lines">
    <div className="invoice-lines-head" aria-hidden="true">
      <span>Description</span><span>Qty</span><span>Unit price</span><span>Charged as</span><span/>
    </div>
    {lines.map((line, index) => <fieldset key={line.key} className="invoice-line" disabled={disabled}>
      <legend className="sr-only">Line {index + 1}</legend>
      <label className="invoice-line-field invoice-line-description"><span className="invoice-line-label">Description</span><input className="ops-input" value={line.description} onChange={(event) => update(line.key, { description: event.target.value })} placeholder={line.type === "disbursement" ? "Customs duty paid on your behalf" : "Freight, handling, documentation…"}/></label>
      <label className="invoice-line-field"><span className="invoice-line-label">Qty</span><input className="ops-input" type="number" inputMode="decimal" min="0.01" step="0.01" value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })}/></label>
      <label className="invoice-line-field"><span className="invoice-line-label">Unit price</span><input className="ops-input" type="number" inputMode="decimal" min="0" step="0.01" value={line.unitPrice} onChange={(event) => update(line.key, { unitPrice: event.target.value })}/></label>
      <label className="invoice-line-field invoice-line-charge"><span className="invoice-line-label">Charged as</span>
        <select className="ops-input" required value={line.type} onChange={(event) => update(line.key, { type: event.target.value as InvoiceLineType })}>
          <option value="" disabled>Choose…</option>
          <option value="vat">VAT {NEPAL_VAT_RATE}%</option>
          <option value="none">No VAT (exempt or zero-rated)</option>
          <option value="other">Another tax rate</option>
          <option value="disbursement">Paid for the customer, at cost</option>
        </select>
      </label>
      {line.type === "other" ? <label className="invoice-line-field invoice-line-rate"><span className="invoice-line-label">Tax rate %</span><input className="ops-input" type="number" inputMode="decimal" min="0" max="100" step="0.01" placeholder="Tax rate %" value={line.rate} onChange={(event) => update(line.key, { rate: event.target.value })}/></label> : null}
      {lines.length > 1 ? <button type="button" className="invoice-line-remove" onClick={() => onChange(lines.filter((item) => item.key !== line.key))} aria-label={`Remove line ${index + 1}`}><X size={14} strokeWidth={1.75} aria-hidden="true"/></button> : <span className="invoice-line-spacer" aria-hidden="true"/>}
    </fieldset>)}
    <div className="invoice-lines-foot">
      {lines.length < INVOICE_MAX_LINES ? <OpsButton type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([...lines, newInvoiceLine()])}><Plus size={13} strokeWidth={1.75} aria-hidden="true"/>Add line</OpsButton> : <span/>}
      {totals?.ok ? <dl className="invoice-lines-totals">
        <div><dt>Before tax</dt><dd>{money(totals.subtotal - totals.disbursement_total, currency)}</dd></div>
        <div><dt>Tax</dt><dd>{money(totals.tax_total, currency)}</dd></div>
        {totals.disbursement_total ? <div><dt>At cost</dt><dd>{money(totals.disbursement_total, currency)}</dd></div> : null}
        <div data-strong><dt>Total</dt><dd>{money(totals.total, currency)}</dd></div>
      </dl> : null}
    </div>
  </div>;
}
