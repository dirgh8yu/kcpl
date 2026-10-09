"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Percent, Users } from "lucide-react";
import { bsMonthNames } from "../../../nepali-calendar";
import type { AccountMarginReport } from "../account-margin.server";
import { OpsButton, OpsEmptyState, OpsField, OpsMetric, OpsMetricStrip, OpsNotice, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../../operations-ui";
import { dateLabel, money } from "../../finance/credits/credits-format";

/** The last twelve Nepali months, newest first, and the current and two earlier fiscal years. */
function periodOptions(current: { year: number; month: number }, currentFiscalYear: number) {
  const months: Array<{ value: string; label: string }> = [];
  let { year, month } = current;
  for (let index = 0; index < 12; index += 1) {
    months.push({ value: `m:${year}-${month}`, label: `${bsMonthNames[month - 1]} ${year}` });
    if (month === 1) { year -= 1; month = 12; } else month -= 1;
  }
  const years = [0, 1, 2].map((back) => currentFiscalYear - back).map((start) => ({ value: `fy:${start}`, label: `Fiscal year ${start}/${String((start + 1) % 100).padStart(2, "0")}` }));
  return { months, years };
}

/** A large figure that may break after the currency code on a phone, rather than run out of its box. */
function figure(amount: number) {
  return money(amount, "NPR").replace(/\u00a0/g, " ");
}

function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export function CommissionWorkspace({ report, current, currentFiscalYear }: { report: AccountMarginReport; current: { year: number; month: number }; currentFiscalYear: number }) {
  const { period, rows, totals } = report;
  const options = periodOptions(current, currentFiscalYear);
  const selected = period.kind === "fiscal" ? `fy:${period.year}` : `m:${period.year}-${period.month}`;
  const known = [...options.months, ...options.years].some((option) => option.value === selected);
  const marginPercent = totals.revenue > 0 ? Math.round((totals.margin / totals.revenue) * 1000) / 10 : null;

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Reports"
      title="Margin by account manager"
      description={`${period.label} · ${dateLabel(period.start)} to ${dateLabel(period.end)}`}
      actions={<form className="col-span-full flex items-end gap-2" action="/admin/management/commission">
        <div className="w-48 shrink-0"><label className="sr-only" htmlFor="commission-period">Period</label>
          <select id="commission-period" name="p" defaultValue={selected} className="ops-input">
            {known ? null : <option value={selected}>{period.label}</option>}
            <optgroup label="Months">{options.months.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>
            <optgroup label="Fiscal years">{options.years.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>
          </select></div>
        <OpsButton type="submit" variant="secondary">Show</OpsButton>
      </form>}
    />
    <div className="ops-content-wide ops-stack">
      {report.unconverted.length ? <OpsNotice tone="warning">No exchange rate for {report.unconverted.join(", ")}, so invoices and costs in {report.unconverted.length === 1 ? "it" : "them"} are left out. The figures come back when Nepal Rastra Bank’s rates load.</OpsNotice> : null}
      {!report.complete ? <OpsNotice tone="warning">Not every record could be read, so these figures may be low. Try again in a minute.</OpsNotice> : null}

      <OpsMetricStrip columns={4}>
        <OpsMetric label="Revenue" value={figure(totals.revenue)} detail={`${totals.invoices} invoice${totals.invoices === 1 ? "" : "s"}`}/>
        <OpsMetric label="Job costs" value={figure(totals.cost)} detail="Shared across each shipment’s invoices"/>
        <OpsMetric label="Margin" value={figure(totals.margin)} detail={marginPercent === null ? "No revenue" : `${marginPercent.toFixed(1)}% of revenue`}/>
        <OpsMetric label="Commission" value={figure(totals.commission)} detail={report.settings.paid_only ? "On the paid share of margin" : "On margin invoiced"}/>
      </OpsMetricStrip>

      <OpsSurface title="By account manager" description={`Invoices issued in the period, before VAT and money paid out at cost, less credit notes. Each shipment’s job costs are shared across its invoices by value. In rupees${report.rate_date ? ` at NRB rates of ${dateLabel(report.rate_date)}` : ""}.`} flush>
        {rows.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table">
          <thead><tr><th>Account manager</th><th className="text-right">Revenue</th><th className="text-right">Job costs</th><th className="text-right">Margin</th><th className="text-right">Commission</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.uid ?? "unassigned"}>
            <td data-cell="primary">
              <span className="ops-cell-primary">{row.name}</span>
              <span className="ops-cell-secondary">{row.customers} customer{row.customers === 1 ? "" : "s"} · {row.invoices} invoice{row.invoices === 1 ? "" : "s"}{row.top_customers.length ? ` · most from ${row.top_customers.slice(0, 2).map((customer) => customer.name).join(", ")}` : ""}</span>
            </td>
            <td data-cell="meta" data-label="Revenue" className="text-right tabular-nums">{money(row.revenue, "NPR")}</td>
            <td data-cell="meta" data-label="Job costs" className="text-right tabular-nums">{money(row.cost, "NPR")}</td>
            <td data-cell="meta" data-label="Margin" className="text-right tabular-nums"><span className={row.margin < 0 ? "text-[var(--admin-danger)]" : undefined}>{money(row.margin, "NPR")}</span><span className="ops-cell-secondary">{percent(row.margin_percent)}</span></td>
            <td data-cell="amount" data-label="Commission" className="text-right font-semibold tabular-nums text-[var(--admin-ink)]">{row.uid ? <>{money(row.commission, "NPR")}<span className="ops-cell-secondary">{row.commission_rate}% of {money(row.commission_base, "NPR")}</span></> : <span className="ops-cell-secondary">Assign the customers on their pages</span>}</td>
          </tr>)}</tbody>
        </table></OpsTableWrap> : <OpsEmptyState compact icon={<Users size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No invoices in this period" description="Invoices appear here in the month they are issued, under the customer’s account manager."/>}
      </OpsSurface>

      <RatesForm report={report}/>
    </div>
  </OpsPage>;
}

function RatesForm({ report }: { report: AccountMarginReport }) {
  const router = useRouter();
  const [defaultRate, setDefaultRate] = useState(String(report.settings.default_rate));
  const [paidOnly, setPaidOnly] = useState(report.settings.paid_only);
  const [rates, setRates] = useState<Record<string, string>>(() => Object.fromEntries(report.managers.map((manager) => [manager.uid, report.settings.rates[manager.uid] !== undefined ? String(report.settings.rates[manager.uid]) : ""])));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/management/commission", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ defaultRate, paidOnly, rates }) });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The rates weren’t saved.");
      setNotice({ text: "Rates saved. The figures above use them now.", tone: "success" });
      router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "The rates weren’t saved.", tone: "danger" }); }
    finally { setBusy(false); }
  }

  return <OpsSurface title="Commission rates" description="A percentage of each manager’s margin. Nothing is earned on a loss, and a manager with no rate of their own gets the usual rate.">
    <form className="ops-stack" onSubmit={save}>
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
      <div className="commission-rates">
        <OpsField label="Usual rate (%)"><input inputMode="decimal" value={defaultRate} onChange={(event) => setDefaultRate(event.target.value)} className="ops-input"/></OpsField>
        {report.managers.map((manager) => <OpsField key={manager.uid} label={manager.name}>
          <input inputMode="decimal" placeholder={`${defaultRate || 0} (usual)`} value={rates[manager.uid] ?? ""} onChange={(event) => setRates({ ...rates, [manager.uid]: event.target.value })} className="ops-input" aria-label={`${manager.name}’s rate (%)`}/>
        </OpsField>)}
      </div>
      {report.managers.length ? null : <p className="ops-inspector-hint">No customer has an account manager yet. <Link href="/admin/crm" className="ops-cell-link">Assign one on the customer’s page</Link>, then set their rate here.</p>}
      <label className="commission-check"><input type="checkbox" checked={paidOnly} onChange={(event) => setPaidOnly(event.target.checked)}/>Only count what the customer has paid (recommended)</label>
      <div><OpsButton type="submit" variant="primary" disabled={busy}><Percent size={13} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Saving…" : "Save rates"}</OpsButton></div>
    </form>
  </OpsSurface>;
}
