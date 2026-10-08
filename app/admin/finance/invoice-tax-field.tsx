"use client";

import { OpsField } from "../operations-ui";

/** Nepal's VAT rate. */
export const NEPAL_VAT_RATE = 13;

export type TaxChoice = "" | "vat" | "none" | "other";

/**
 * Tax on an invoice or supplier bill is a decision, not a number that starts
 * at 0: VAT 13%, no VAT (exempt or zero-rated), or another rate for a branch
 * outside Nepal. Nothing is chosen until someone chooses, so VAT is never
 * left off by default.
 */
export function TaxChoiceField({ choice, rate, disabled = false, onChange }: {
  choice: TaxChoice;
  rate: string;
  disabled?: boolean;
  onChange: (next: { choice: TaxChoice; rate: string }) => void;
}) {
  return <>
    <OpsField label="Tax">
      <select required disabled={disabled} value={choice} onChange={(event) => onChange({ choice: event.target.value as TaxChoice, rate })}>
        <option value="" disabled>Choose…</option>
        <option value="vat">VAT {NEPAL_VAT_RATE}%</option>
        <option value="none">No VAT (exempt or zero-rated)</option>
        <option value="other">Another rate</option>
      </select>
    </OpsField>
    {choice === "other" ? <OpsField label="Tax rate %"><input required disabled={disabled} min="0" max="100" step="0.01" type="number" inputMode="decimal" value={rate} onChange={(event) => onChange({ choice, rate: event.target.value })}/></OpsField> : null}
  </>;
}

/** The percentage a choice stands for, or null when none is made yet. */
export function taxRateFromChoice(choice: TaxChoice, rate: string) {
  if (choice === "vat") return NEPAL_VAT_RATE;
  if (choice === "none") return 0;
  if (choice === "other") {
    const parsed = Number(rate);
    return rate.trim() && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
  }
  return null;
}
