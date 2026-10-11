"use client";

import { useId, useState, type ReactNode } from "react";
import { ArrowRight, Plus, X } from "@phosphor-icons/react/dist/ssr";
import { dutyToolEstimate, storageToolEstimate, volumeToolEstimate } from "../importer-tools";
import type { SiteLocale } from "../site-i18n";
import type { DutyToolCopy, StorageToolCopy, VolumeToolCopy } from "../tool-data";

/*
 * The three calculators. Each works out its figures as the reader types, in
 * the browser: nothing is sent anywhere. The pure sums live in
 * app/importer-tools.ts; this file only reads the fields and lays out the
 * answer. Paths and words arrive as props so the dictionaries stay on the
 * server.
 */

type Shared = { result: string; optional: string; privacy: string };

/* Nepal and India group thousands in lakhs (1,23,456); Chinese readers expect
 * groups of three. Digits stay Latin in every language so the answer reads in
 * the same figures the reader typed. */
const numberLocale: Record<SiteLocale, string> = { en: "en-IN", ne: "en-IN", hi: "en-IN", zh: "zh-CN" };
const dateLocale: Record<SiteLocale, string> = { en: "en-GB", ne: "ne-NP", hi: "hi-IN", zh: "zh-CN" };

function numberFormat(locale: SiteLocale) {
  return (value: number, digits = 2) => new Intl.NumberFormat(numberLocale[locale], { maximumFractionDigits: digits }).format(value);
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

/** A label, its control and an optional hint, wired together for assistive tech. */
function Field({ id, label, hint, optional, children }: { id: string; label: string; hint?: string; optional?: string; children: ReactNode }) {
  return (
    <div className="tool-field">
      <label htmlFor={id}>{label}{optional ? <small>{optional}</small> : null}</label>
      {children}
      {hint ? <p id={`${id}-hint`} className="tool-hint">{hint}</p> : null}
    </div>
  );
}

/** A number typed as text: no spinner, no scroll-wheel surprises, commas allowed. */
function NumberInput({ id, value, onChange, unit, hint, whole, placeholder }: { id: string; value: string; onChange: (value: string) => void; unit?: string; hint?: boolean; whole?: boolean; placeholder?: string }) {
  const input = (
    <input
      id={id}
      type="text"
      inputMode={whole ? "numeric" : "decimal"}
      autoComplete="off"
      enterKeyHint="next"
      spellCheck={false}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      aria-describedby={hint ? `${id}-hint` : undefined}
    />
  );
  return unit ? <div className="tool-input-unit">{input}<span aria-hidden="true">{unit}</span></div> : input;
}

function ResultPanel({ shared, children, status, footer }: { shared: Shared; children?: ReactNode; status: ReactNode; footer?: ReactNode }) {
  const id = useId();
  return (
    <section className="tool-result" aria-labelledby={id}>
      <h2 id={id} className="tool-result-title">{shared.result}</h2>
      {/* Only the headline is announced, so a screen reader hears the answer
        * change as the reader types, not every line of the breakdown. */}
      <p className="tool-result-status" aria-live="polite">{status}</p>
      {children}
      {footer}
      <p className="tool-result-note">{shared.privacy}</p>
    </section>
  );
}

const dutyCurrencies = ["USD", "EUR", "GBP", "INR", "CNY", "JPY", "NPR"];

export function DutyEstimator({ locale, copy, shared }: { locale: SiteLocale; copy: DutyToolCopy; shared: Shared }) {
  const id = useId();
  const format = numberFormat(locale);
  const [values, setValues] = useState({ value: "", currency: "USD", basis: "FOB", freight: "", insurance: "", exchangeRate: "", dutyRate: "", exciseRate: "", vatRate: "13" });
  const set = (field: keyof typeof values) => (value: string) => setValues((current) => ({ ...current, [field]: value }));
  const ready = Boolean(values.value.trim() && (values.currency === "NPR" || values.exchangeRate.trim()) && values.dutyRate.trim());
  const outcome = ready ? dutyToolEstimate(values) : null;
  const result = outcome?.ok ? outcome.result : null;
  const npr = (value: number) => `NPR ${format(value, 0)}`;

  return (
    <div className="tool-layout">
      <form className="tool-form" onSubmit={(event) => event.preventDefault()} noValidate>
        <div className="tool-row tool-row-money">
          <Field id={`${id}-value`} label={copy.value}>
            <NumberInput id={`${id}-value`} value={values.value} onChange={set("value")} placeholder="0"/>
          </Field>
          <Field id={`${id}-currency`} label={copy.currency}>
            <select id={`${id}-currency`} value={values.currency} onChange={(event) => set("currency")(event.target.value)}>
              {dutyCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </Field>
        </div>
        <fieldset className="tool-choice">
          <legend>{copy.basis}</legend>
          {(["FOB", "CIF"] as const).map((basis) => (
            <label key={basis}>
              <input type="radio" name={`${id}-basis`} value={basis} checked={values.basis === basis} onChange={() => set("basis")(basis)}/>
              <span>{basis === "FOB" ? copy.basisFob : copy.basisCif}</span>
            </label>
          ))}
        </fieldset>
        {values.basis === "FOB" ? (
          <div className="tool-row">
            <Field id={`${id}-freight`} label={copy.freight} hint={fill(copy.inCurrency, { currency: values.currency })}>
              <NumberInput id={`${id}-freight`} value={values.freight} onChange={set("freight")} hint placeholder="0"/>
            </Field>
            <Field id={`${id}-insurance`} label={copy.insurance} optional={shared.optional} hint={fill(copy.inCurrency, { currency: values.currency })}>
              <NumberInput id={`${id}-insurance`} value={values.insurance} onChange={set("insurance")} hint placeholder="0"/>
            </Field>
          </div>
        ) : null}
        {values.currency === "NPR" ? null : (
          <Field id={`${id}-rate`} label={copy.exchange} hint={fill(copy.exchangeHint, { currency: values.currency })}>
            <NumberInput id={`${id}-rate`} value={values.exchangeRate} onChange={set("exchangeRate")} unit="NPR" hint/>
          </Field>
        )}
        <div className="tool-row tool-row-three">
          <Field id={`${id}-duty`} label={copy.duty} hint={copy.dutyHint}>
            <NumberInput id={`${id}-duty`} value={values.dutyRate} onChange={set("dutyRate")} unit="%" hint/>
          </Field>
          <Field id={`${id}-excise`} label={copy.excise} optional={shared.optional} hint={copy.exciseHint}>
            <NumberInput id={`${id}-excise`} value={values.exciseRate} onChange={set("exciseRate")} unit="%" hint placeholder="0"/>
          </Field>
          <Field id={`${id}-vat`} label={copy.vat} hint={copy.vatHint}>
            <NumberInput id={`${id}-vat`} value={values.vatRate} onChange={set("vatRate")} unit="%" hint/>
          </Field>
        </div>
      </form>
      <ResultPanel
        shared={shared}
        status={result ? <><span>{copy.total}</span><strong>{npr(result.total)}</strong></> : outcome && !outcome.ok ? copy.errors[outcome.error] : copy.empty}
      >
        {result ? (
          <dl className="tool-result-lines">
            <div><dt>{copy.cif}</dt><dd>{npr(result.cif_npr)}</dd></div>
            <div><dt>{copy.dutyLine}</dt><dd>{npr(result.duty)}</dd></div>
            {result.excise > 0 ? <div><dt>{copy.exciseLine}</dt><dd>{npr(result.excise)}</dd></div> : null}
            <div><dt>{copy.vatLine}</dt><dd>{npr(result.vat)}</dd></div>
          </dl>
        ) : null}
      </ResultPanel>
    </div>
  );
}

const storageCurrencies = ["USD", "INR", "NPR"];

export function StorageEstimator({ locale, copy, shared }: { locale: SiteLocale; copy: StorageToolCopy; shared: Shared }) {
  const id = useId();
  const format = numberFormat(locale);
  const [values, setValues] = useState({ startedOn: "", freeDays: "", collectOn: "", dailyRate: "", currency: "USD", laterRate: "", laterAfterDays: "" });
  const set = (field: keyof typeof values) => (value: string) => setValues((current) => ({ ...current, [field]: value }));
  const ready = Boolean(values.startedOn && values.collectOn && values.freeDays.trim());
  const outcome = ready ? storageToolEstimate(values) : null;
  const result = outcome?.ok ? outcome.result : null;
  const priced = values.dailyRate.trim() !== "";
  const money = (value: number) => `${values.currency} ${format(value)}`;
  const day = (value: string) => new Intl.DateTimeFormat(dateLocale[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

  let status: ReactNode = copy.empty;
  if (outcome && !outcome.ok) status = copy.errors[outcome.error];
  else if (result && result.chargeableDays === 0) status = copy.inside;
  else if (result && !priced) status = copy.noRate;
  else if (result) status = <><span>{copy.total}</span><strong>{money(result.total)}</strong></>;

  return (
    <div className="tool-layout">
      <form className="tool-form" onSubmit={(event) => event.preventDefault()} noValidate>
        <div className="tool-row">
          <Field id={`${id}-start`} label={copy.started} hint={copy.startedHint}>
            <input id={`${id}-start`} type="date" value={values.startedOn} onChange={(event) => set("startedOn")(event.target.value)} aria-describedby={`${id}-start-hint`}/>
          </Field>
          <Field id={`${id}-days`} label={copy.freeDays} hint={copy.freeDaysHint}>
            <NumberInput id={`${id}-days`} value={values.freeDays} onChange={set("freeDays")} whole hint/>
          </Field>
        </div>
        <Field id={`${id}-collect`} label={copy.collect} hint={copy.collectHint}>
          <input id={`${id}-collect`} type="date" value={values.collectOn} min={values.startedOn || undefined} onChange={(event) => set("collectOn")(event.target.value)} aria-describedby={`${id}-collect-hint`}/>
        </Field>
        <div className="tool-row tool-row-money">
          <Field id={`${id}-rate`} label={copy.rate}>
            <NumberInput id={`${id}-rate`} value={values.dailyRate} onChange={set("dailyRate")} placeholder="0"/>
          </Field>
          <Field id={`${id}-currency`} label={copy.currency}>
            <select id={`${id}-currency`} value={values.currency} onChange={(event) => set("currency")(event.target.value)}>
              {storageCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </Field>
        </div>
        <div className="tool-row">
          <Field id={`${id}-later`} label={copy.laterRate} optional={shared.optional}>
            <NumberInput id={`${id}-later`} value={values.laterRate} onChange={set("laterRate")} placeholder="0"/>
          </Field>
          <Field id={`${id}-after`} label={copy.laterAfter} optional={shared.optional} hint={copy.laterHint}>
            <NumberInput id={`${id}-after`} value={values.laterAfterDays} onChange={set("laterAfterDays")} whole hint placeholder="0"/>
          </Field>
        </div>
      </form>
      <ResultPanel shared={shared} status={status}>
        {result ? (
          <dl className="tool-result-lines">
            <div><dt>{copy.lastFree}</dt><dd>{result.lastFreeDay ? day(result.lastFreeDay) : copy.noFree}</dd></div>
            <div><dt>{copy.chargeable}</dt><dd>{format(result.chargeableDays, 0)}</dd></div>
            {priced ? result.bands.map((band) => (
              <div key={`${band.rate}-${band.days}`}><dt>{fill(copy.band, { days: format(band.days, 0), rate: money(band.rate) })}</dt><dd>{money(band.amount)}</dd></div>
            )) : null}
          </dl>
        ) : null}
      </ResultPanel>
    </div>
  );
}

type PieceRow = { key: number; length: string; width: string; height: string; quantity: string; weight: string };
const MAX_ROWS = 12;

export function VolumeEstimator({ locale, copy, shared, quotePath }: { locale: SiteLocale; copy: VolumeToolCopy; shared: Shared; quotePath: string }) {
  const id = useId();
  const format = numberFormat(locale);
  const [units, setUnits] = useState<{ length: "cm" | "in"; weight: "kg" | "lb" }>({ length: "cm", weight: "kg" });
  const [rows, setRows] = useState<PieceRow[]>([{ key: 0, length: "", width: "", height: "", quantity: "1", weight: "" }]);
  const [nextKey, setNextKey] = useState(1);
  const update = (key: number, field: keyof Omit<PieceRow, "key">, value: string) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  const started = rows.some((row) => row.length.trim() && row.width.trim() && row.height.trim());
  const outcome = started ? volumeToolEstimate(rows, units) : null;
  const result = outcome?.ok ? outcome.result : null;

  // The quote form takes one set of dimensions and a total weight: send the
  // dimensions only when they describe the whole consignment.
  let quoteHref = quotePath;
  if (result) {
    const query = new URLSearchParams();
    if (result.grossKg > 0) { query.set("weight", String(result.grossKg)); query.set("weightUnit", "kg"); }
    const used = rows.filter((row) => row.length.trim() || row.width.trim() || row.height.trim());
    if (used.length === 1 && Number(used[0].quantity) === 1) {
      query.set("length", used[0].length.trim()); query.set("width", used[0].width.trim()); query.set("height", used[0].height.trim()); query.set("dimensionUnit", units.length);
    }
    const search = query.toString();
    if (search) quoteHref = `${quotePath}?${search}`;
  }

  return (
    <div className="tool-layout">
      <form className="tool-form" onSubmit={(event) => event.preventDefault()} noValidate>
        <div className="tool-row">
          <fieldset className="tool-choice tool-choice-compact">
            <legend>{copy.lengthUnit}</legend>
            {(["cm", "in"] as const).map((unit) => (
              <label key={unit}><input type="radio" name={`${id}-length`} checked={units.length === unit} onChange={() => setUnits((current) => ({ ...current, length: unit }))}/><span>{unit}</span></label>
            ))}
          </fieldset>
          <fieldset className="tool-choice tool-choice-compact">
            <legend>{copy.weightUnit}</legend>
            {(["kg", "lb"] as const).map((unit) => (
              <label key={unit}><input type="radio" name={`${id}-weight`} checked={units.weight === unit} onChange={() => setUnits((current) => ({ ...current, weight: unit }))}/><span>{unit}</span></label>
            ))}
          </fieldset>
        </div>
        {rows.map((row, index) => {
          const rowId = `${id}-row-${row.key}`;
          const number = index + 1;
          return (
            <fieldset key={row.key} className="tool-piece">
              <legend>{fill(copy.piece, { n: number })}</legend>
              {rows.length > 1 ? (
                <button type="button" className="tool-piece-remove" aria-label={fill(copy.remove, { n: number })} onClick={() => setRows((current) => current.filter((entry) => entry.key !== row.key))}>
                  <X size={16} weight="bold" aria-hidden="true"/>
                </button>
              ) : null}
              <div className="tool-piece-grid">
                <Field id={`${rowId}-l`} label={copy.length}><NumberInput id={`${rowId}-l`} value={row.length} onChange={(value) => update(row.key, "length", value)} unit={units.length}/></Field>
                <Field id={`${rowId}-w`} label={copy.width}><NumberInput id={`${rowId}-w`} value={row.width} onChange={(value) => update(row.key, "width", value)} unit={units.length}/></Field>
                <Field id={`${rowId}-h`} label={copy.height}><NumberInput id={`${rowId}-h`} value={row.height} onChange={(value) => update(row.key, "height", value)} unit={units.length}/></Field>
                <Field id={`${rowId}-q`} label={copy.quantity}><NumberInput id={`${rowId}-q`} value={row.quantity} onChange={(value) => update(row.key, "quantity", value)} whole/></Field>
                <Field id={`${rowId}-kg`} label={copy.weight}><NumberInput id={`${rowId}-kg`} value={row.weight} onChange={(value) => update(row.key, "weight", value)} unit={units.weight} placeholder="0"/></Field>
              </div>
            </fieldset>
          );
        })}
        {rows.length < MAX_ROWS ? (
          <button
            type="button"
            className="tool-add"
            onClick={() => {
              setRows((current) => [...current, { key: nextKey, length: "", width: "", height: "", quantity: "1", weight: "" }]);
              setNextKey((key) => key + 1);
            }}
          >
            <Plus size={16} weight="bold" aria-hidden="true"/>{copy.add}
          </button>
        ) : null}
      </form>
      <ResultPanel
        shared={shared}
        status={result ? <><span>{copy.airChargeable}</span><strong>{format(result.airChargeableKg, 1)} kg</strong></> : outcome && !outcome.ok ? copy.errors[outcome.error] : copy.empty}
        footer={result ? <a href={quoteHref} className="tool-result-link" data-analytics-event="tool_quote_tap">{copy.quoteWith}<ArrowRight size={15} weight="bold" aria-hidden="true"/></a> : null}
      >
        {result ? (
          <>
            <dl className="tool-result-lines">
              <div><dt>{copy.pieces}</dt><dd>{format(result.pieces, 0)}</dd></div>
              <div><dt>{copy.volume}</dt><dd>{format(result.cbm, 3)} m³</dd></div>
              <div><dt>{copy.gross}</dt><dd>{format(result.grossKg, 1)} kg</dd></div>
              <div><dt>{copy.volumetric}</dt><dd>{format(result.volumetricKg, 1)} kg</dd></div>
              <div><dt>{copy.sea}</dt><dd>{format(result.seaRevenueTonnes, 3)} {copy.seaUnit}</dd></div>
            </dl>
            <div className="tool-result-boxes">
              <p>{copy.containers}</p>
              <ul>
                {result.containers.map((box) => (
                  <li key={box.type}>
                    <span>{fill(copy.containerShare, { percent: `${format(box.percent, 0)}%`, box: copy.boxes[box.type] })}</span>
                    <span className="tool-meter" aria-hidden="true"><span style={{ transform: `scaleX(${Math.min(1, box.percent / 100)})` }}/></span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </ResultPanel>
    </div>
  );
}
