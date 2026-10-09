"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileCheck2, Landmark } from "lucide-react";
import { nepalOperationalDate } from "../../../invoice-effective-status";
import { bsDateLabel, bsMonthNames } from "../../../nepali-calendar";
import type { TaxMonth, WithheldTaxRow } from "../tax-books.server";
import { tallyLedgerLabels, type TallyLedgerSettings } from "../tally-export";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMetric, OpsMetricStrip, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../../operations-ui";

function money(amount: number, currency = "NPR") {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}
function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

type Notice = { text: string; tone: "success" | "danger" } | null;

async function send(url: string, method: "POST" | "PATCH" | "PUT", body: unknown) {
  const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error || "That didn't go through.");
  return data;
}

export function TaxWorkspace({ month, currentYear }: { month: TaxMonth; currentYear: number }) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const exportUrl = (kind: string) => `/api/admin/finance/tax/export?kind=${kind}&y=${month.year}&m=${month.month}`;
  const summary = month.summary;
  const toDeposit = month.tds_by_kcpl.filter((row) => row.status === "to_deposit");
  const toDepositTotal = toDeposit.filter((row) => row.currency === "NPR").reduce((sum, row) => sum + row.amount, 0);
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 3 + index);

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Finance"
      title="Tax & books"
      description={`${month.label} · ${dateLabel(month.start)} to ${dateLabel(month.end)}${month.fiscal_year ? ` · fiscal year ${month.fiscal_year.replace("-", "/")}` : ""}`}
      actions={<form className="col-span-full flex items-end gap-2" action="/admin/finance/tax">
        {/* The inputs fill their box; the boxes set the widths, so the three sit on one line. */}
        <div className="w-32 shrink-0"><label className="sr-only" htmlFor="tax-month">Month</label>
          <select id="tax-month" name="m" defaultValue={month.month} className="ops-input">{bsMonthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></div>
        <div className="w-24 shrink-0"><label className="sr-only" htmlFor="tax-year">Year (BS)</label>
          <select id="tax-year" name="y" defaultValue={month.year} className="ops-input">{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
        <OpsButton type="submit" variant="secondary">Show</OpsButton>
      </form>}
    />
    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
      {month.partial ? <OpsNotice tone="warning">You see your own branches only. The VAT return covers the whole company, so ask Management for the full books.</OpsNotice> : null}

      <OpsMetricStrip columns={4}>
        <OpsMetric label="VAT on sales" value={money(summary.output_vat)} detail={`${money(summary.taxable_sales)} taxable sales`}/>
        <OpsMetric label="VAT on purchases" value={money(summary.input_vat)} detail={`${money(summary.taxable_purchases)} taxable purchases`}/>
        <OpsMetric label={summary.net_vat >= 0 ? "VAT to pay" : "VAT to carry forward"} value={money(Math.abs(summary.net_vat))} detail="Rupee documents only"/>
        <OpsMetric label="TDS to deposit" value={money(toDepositTotal)} detail={toDeposit.length ? `By ${dateLabel(month.tds_deposit_due)} (${bsDateLabel(month.tds_deposit_due ?? "")})` : "Nothing this month"}/>
      </OpsMetricStrip>

      {summary.foreign_sales || summary.foreign_purchases || summary.missing_customer_pan ? <OpsNotice tone="warning">
        {summary.foreign_sales ? `${summary.foreign_sales} sales document${summary.foreign_sales === 1 ? " is" : "s are"} in another currency and left out of the figures: add them in rupees at the rate on their date. ` : ""}
        {summary.foreign_purchases ? `${summary.foreign_purchases} purchase${summary.foreign_purchases === 1 ? " is" : "s are"} in another currency and left out the same way. ` : ""}
        {summary.missing_customer_pan ? `${summary.missing_customer_pan} taxable invoice${summary.missing_customer_pan === 1 ? " has" : "s have"} no customer PAN.` : ""}
      </OpsNotice> : null}

      <OpsSurface title="Sales book" description="Invoices issued this month, with credit notes as sales returns. Money paid on customers' behalf isn't a sale: it is left out here and has its own column in the CSV." action={<a className="ops-button" data-variant="secondary" data-size="sm" href={exportUrl("sales")}><Download size={12}/>CSV</a>} flush>
        {month.sales.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table">
          <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th className="text-right">Non-taxable</th><th className="text-right">Taxable</th><th className="text-right">VAT</th></tr></thead>
          <tbody>{month.sales.map((row) => <tr key={`${row.kind}-${row.number}`}>
            <td data-cell="meta" data-label="Date">{row.date_bs}<span className="ops-cell-secondary">{dateLabel(row.date)}</span></td>
            <td data-cell="primary"><Link href={`/admin/finance/invoices/${encodeURIComponent(row.reference)}`} className="ops-cell-ref ops-mono">{row.number}</Link>{row.kind === "credit_note" ? <span className="ops-cell-secondary">Return against {row.against}</span> : row.kind === "void" ? <span className="ops-cell-secondary">Void</span> : null}</td>
            <td data-cell="route"><span className="ops-cell-primary">{row.customer_name}</span><span className="ops-cell-secondary">{row.customer_pan ? `PAN ${row.customer_pan}` : "No PAN"}{row.currency !== "NPR" ? ` · ${row.currency}` : ""}</span></td>
            <td data-cell="meta" data-label="Non-taxable" className="text-right tabular-nums">{money(row.non_taxable, row.currency)}</td>
            <td data-cell="meta" data-label="Taxable" className="text-right tabular-nums">{money(row.taxable, row.currency)}</td>
            <td data-cell="amount" data-label="VAT" className="text-right font-semibold tabular-nums text-[var(--admin-ink)]">{money(row.vat, row.currency)}</td>
          </tr>)}</tbody>
        </table></OpsTableWrap> : <OpsEmptyState compact icon={<FileCheck2 size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No sales this month" description="Invoices appear here in the month they are issued."/>}
      </OpsSurface>

      <OpsSurface title="Purchase book" description="Supplier bills dated this month, once approved." action={<a className="ops-button" data-variant="secondary" data-size="sm" href={exportUrl("purchases")}><Download size={12}/>CSV</a>} flush>
        {month.purchases.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table">
          <thead><tr><th>Date</th><th>Supplier bill</th><th>Supplier</th><th className="text-right">Non-taxable</th><th className="text-right">Taxable</th><th className="text-right">VAT</th></tr></thead>
          <tbody>{month.purchases.map((row) => <tr key={row.reference}>
            <td data-cell="meta" data-label="Date">{row.date_bs}<span className="ops-cell-secondary">{dateLabel(row.date)}</span></td>
            <td data-cell="primary"><Link href={`/admin/payables/bills/${encodeURIComponent(row.reference)}`} className="ops-cell-ref ops-mono">{row.bill_number}</Link></td>
            <td data-cell="route"><span className="ops-cell-primary">{row.supplier_name}</span><span className="ops-cell-secondary">{row.supplier_pan ? `PAN ${row.supplier_pan}` : "No PAN"}{row.currency !== "NPR" ? ` · ${row.currency}` : ""}</span></td>
            <td data-cell="meta" data-label="Non-taxable" className="text-right tabular-nums">{money(row.non_taxable, row.currency)}</td>
            <td data-cell="meta" data-label="Taxable" className="text-right tabular-nums">{money(row.taxable, row.currency)}</td>
            <td data-cell="amount" data-label="VAT" className="text-right font-semibold tabular-nums text-[var(--admin-ink)]">{money(row.vat, row.currency)}</td>
          </tr>)}</tbody>
        </table></OpsTableWrap> : <OpsEmptyState compact icon={<FileCheck2 size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No purchases this month" description="Supplier bills appear here in the month they are dated."/>}
      </OpsSurface>

      <TdsDeposit rows={month.tds_by_kcpl} due={month.tds_deposit_due} exportUrl={exportUrl("tds")} onDone={(text) => { setNotice({ text, tone: "success" }); router.refresh(); }} onError={(text) => setNotice({ text, tone: "danger" })}/>
      <Certificates rows={month.certificates_pending} yearTotals={month.tds_by_customers_this_year} fiscalYear={month.fiscal_year} onDone={(text) => { setNotice({ text, tone: "success" }); router.refresh(); }} onError={(text) => setNotice({ text, tone: "danger" })}/>
      <Tally settings={month.tally} mastersUrl={exportUrl("tally-masters")} vouchersUrl={exportUrl("tally-vouchers")} onDone={(text) => { setNotice({ text, tone: "success" }); router.refresh(); }} onError={(text) => setNotice({ text, tone: "danger" })}/>
    </div>
  </OpsPage>;
}

function TdsDeposit({ rows, due, exportUrl, onDone, onError }: { rows: WithheldTaxRow[]; due: string | null; exportUrl: string; onDone: (text: string) => void; onError: (text: string) => void }) {
  const open = rows.filter((row) => row.status === "to_deposit");
  const [form, setForm] = useState({ reference: "", depositedOn: nepalOperationalDate() });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try { const data = await send("/api/admin/finance/withheld-tax/deposit", "POST", { ids: open.map((row) => row.id), ...form }) as { count?: number }; onDone(`${data.count ?? open.length} TDS amount${data.count === 1 ? "" : "s"} recorded as deposited.`); setForm({ ...form, reference: "" }); }
    catch (error) { onError(error instanceof Error ? error.message : "That didn't go through."); }
    finally { setBusy(false); }
  }
  return <OpsSurface title="TDS KCPL withheld" description={`Withheld from supplier payments this month. Deposit it with the tax office by ${dateLabel(due)}.`} action={rows.length ? <a className="ops-button" data-variant="secondary" data-size="sm" href={exportUrl}><Download size={12}/>CSV</a> : undefined} flush>
    {rows.length ? <>
      <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table">
        <thead><tr><th>Paid on</th><th>Supplier</th><th className="text-right">Paid and withheld</th><th className="text-right">TDS</th><th>Status</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td data-cell="meta" data-label="Paid on">{dateLabel(row.withheld_on)}</td>
          <td data-cell="primary"><Link href={`/admin/payables/bills/${encodeURIComponent(row.document_reference)}`} className="ops-cell-primary">{row.counterparty_name}</Link><span className="ops-cell-secondary">{row.counterparty_pan ? `PAN ${row.counterparty_pan}` : "No PAN"} · {row.document_number}</span></td>
          <td data-cell="meta" data-label="Paid and withheld" className="text-right tabular-nums">{money(row.settled_amount, row.currency)}</td>
          <td data-cell="amount" data-label="TDS" className="text-right font-semibold tabular-nums text-[var(--admin-ink)]">{money(row.amount, row.currency)}{row.rate !== null ? <span className="ops-cell-secondary">{row.rate}%</span> : null}</td>
          <td data-cell="status"><OpsBadge tone={row.status === "deposited" ? "success" : "warning"} dot>{row.status === "deposited" ? `Deposited ${dateLabel(row.deposited_on)}` : row.status_label}</OpsBadge></td>
        </tr>)}</tbody>
      </table></OpsTableWrap>
      {open.length ? <form onSubmit={submit} className="grid gap-3 border-t border-[var(--admin-line)] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)_auto] sm:items-end">
        <OpsField label="Deposit voucher or reference"><input required maxLength={120} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })}/></OpsField>
        <OpsField label="Deposited on"><input required type="date" max={nepalOperationalDate()} value={form.depositedOn} onChange={(event) => setForm({ ...form, depositedOn: event.target.value })}/></OpsField>
        <OpsButton type="submit" variant="primary" disabled={busy}><Landmark size={12}/>Record {open.length} as deposited</OpsButton>
      </form> : null}
    </> : <OpsEmptyState compact icon={<Landmark size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No TDS withheld this month" description="TDS entered on a supplier payment appears here, with the date it is due."/>}
  </OpsSurface>;
}

function Certificates({ rows, yearTotals, fiscalYear, onDone, onError }: { rows: WithheldTaxRow[]; yearTotals: TaxMonth["tds_by_customers_this_year"]; fiscalYear: string | null; onDone: (text: string) => void; onError: (text: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  async function save(row: WithheldTaxRow) {
    setBusy(row.id);
    try { await send(`/api/admin/finance/withheld-tax/${encodeURIComponent(row.id)}`, "PATCH", { certificateNumber: values[row.id] ?? "" }); onDone(`Certificate recorded for ${row.document_number}.`); }
    catch (error) { onError(error instanceof Error ? error.message : "That didn't go through."); }
    finally { setBusy(""); }
  }
  return <OpsSurface title="TDS certificates to collect" description={`TDS customers withheld is KCPL's tax already paid, claimed with these certificates.${yearTotals.length && fiscalYear ? ` Withheld so far in ${fiscalYear.replace("-", "/")}: ${yearTotals.map((item) => `${money(item.amount, item.currency)} (${item.count})`).join(" · ")}.` : ""}`} flush>
    {rows.length ? <ul className="divide-y divide-[var(--admin-line)]">{rows.map((row) => <li key={row.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,240px)_auto] sm:items-end">
      <div className="min-w-0">
        <p className="font-semibold text-[var(--admin-ink)]">{row.counterparty_name} · {money(row.amount, row.currency)}</p>
        <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">Withheld {dateLabel(row.withheld_on)} from <Link href={`/admin/finance/invoices/${encodeURIComponent(row.document_reference)}`} className="ops-cell-link"><OpsMono>{row.document_number}</OpsMono></Link>{row.counterparty_pan ? ` · PAN ${row.counterparty_pan}` : ""}</p>
      </div>
      <OpsField label="Certificate no."><input maxLength={120} value={values[row.id] ?? ""} onChange={(event) => setValues({ ...values, [row.id]: event.target.value })}/></OpsField>
      <OpsButton variant="secondary" disabled={busy === row.id || !(values[row.id] ?? "").trim()} onClick={() => save(row)}>Save</OpsButton>
    </li>)}</ul> : <OpsEmptyState compact kind="healthy" icon={<FileCheck2 size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No certificates outstanding" description="TDS entered on a customer payment without a certificate number appears here until it comes."/>}
  </OpsSurface>;
}

function Tally({ settings, mastersUrl, vouchersUrl, onDone, onError }: { settings: TallyLedgerSettings; mastersUrl: string; vouchersUrl: string; onDone: (text: string) => void; onError: (text: string) => void }) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try { await send("/api/admin/finance/tax/tally-settings", "PUT", form); onDone("Tally ledger names saved."); }
    catch (error) { onError(error instanceof Error ? error.message : "That didn't go through."); }
    finally { setBusy(false); }
  }
  return <OpsSurface title="Tally" description="The month as Tally import files: first the customers' and suppliers' ledgers, then the vouchers. Try them on a copy of the Tally company first. Rupee documents only.">
    <div className="flex flex-wrap gap-2">
      <a className="ops-button" data-variant="secondary" data-size="sm" href={mastersUrl}><Download size={12}/>1. Customer and supplier ledgers</a>
      <a className="ops-button" data-variant="secondary" data-size="sm" href={vouchersUrl}><Download size={12}/>2. Vouchers</a>
    </div>
    <details className="mt-4">
      <summary className="cursor-pointer text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]">Ledger names in your Tally company</summary>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(tallyLedgerLabels) as Array<keyof TallyLedgerSettings>).map((key) => <OpsField key={key} label={tallyLedgerLabels[key]}><input required maxLength={120} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}/></OpsField>)}
        <div className="sm:col-span-2 xl:col-span-3"><OpsButton type="submit" variant="secondary" disabled={busy}>Save ledger names</OpsButton></div>
      </form>
    </details>
  </OpsSurface>;
}
