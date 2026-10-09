import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { CashFlowCurrency, CashFlowEntry, CashFlowKind, CashFlowRow } from "../cash-flow";
import type { CashFlowOverview } from "../cash-flow.server";
import { OpsBadge, OpsEmptyState, OpsMetric, OpsMetricStrip, OpsNotice, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../../operations-ui";
import { dateLabel, money } from "../credits/credits-format";

const kindLabels: Record<CashFlowKind, string> = { invoice: "Invoice", bill: "Supplier bill", refund: "Refund", tds: "TDS deposit", vat: "VAT" };

function weekLabel(start: string, end: string) {
  const format = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
  return `${format.format(new Date(`${start}T00:00:00`))} – ${format.format(new Date(`${end}T00:00:00`))}`;
}

function Signed({ value, currency }: { value: number; currency: string }) {
  if (Math.abs(value) < 0.005) return <span className="text-[var(--admin-muted)]">—</span>;
  return <span className={value < 0 ? "text-[var(--admin-danger)]" : undefined}>{value < 0 ? "−" : ""}{money(Math.abs(value), currency)}</span>;
}

/** The next four weeks' items, overdue first: the part someone can act on now. */
const SOON_WEEKS = 4;

export function CashFlowWorkspace({ overview }: { overview: CashFlowOverview }) {
  const missingBalance = overview.currencies.filter((currency) => currency.opening === null).map((currency) => currency.currency);
  return <OpsPage>
    <OpsPageHeader eyebrow="Finance" title="Cash flow" description="The next 13 weeks, from the bank balance: what customers owe by the date it's due, and what KCPL owes suppliers, in refunds, TDS and VAT. Overdue money owed to KCPL is listed but not counted; overdue bills are counted now."/>
    <div className="ops-content-wide ops-stack">
      {overview.partial ? <OpsNotice tone="warning">You see only your branches&apos; invoices and bills, and VAT is left out. Management sees the whole company.</OpsNotice> : null}
      {missingBalance.length ? <OpsNotice tone="warning">No bank balance for {missingBalance.join(", ")} yet, so the weeks show money in and out without a balance. <Link href="/admin/finance/bank" className="ops-cell-link">Upload a statement</Link> with a balance column to start from what&apos;s in the bank.</OpsNotice> : null}
      {overview.currencies.length ? overview.currencies.map((currency) => <CurrencyFlow key={currency.currency} flow={currency} accounts={overview.accounts.filter((account) => account.currency === currency.currency)}/>)
        : <OpsSurface title="Nothing due"><OpsEmptyState compact kind="healthy" icon={<CalendarClock size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No money due in or out" description="Open invoices, approved bills, refunds and tax to pay appear here by the week they're due."/></OpsSurface>}
      <Soon entries={overview.entries} today={overview.today} lastDay={overview.currencies[0]?.weeks[SOON_WEEKS - 1]?.end ?? overview.today}/>
    </div>
  </OpsPage>;
}

/** A large figure that may break after the currency code on a phone, rather than run out of its box. */
function figure(amount: number, currency: string) {
  return money(amount, currency).replace(/\u00a0/g, " ");
}

function CurrencyFlow({ flow, accounts }: { flow: CashFlowCurrency; accounts: CashFlowOverview["accounts"] }) {
  const sum = (pick: (row: CashFlowRow) => number) => flow.weeks.reduce((total, row) => total + pick(row), 0);
  const asOf = accounts.map((account) => account.as_of).sort().at(0);
  return <section className="ops-stack" aria-label={`${flow.currency} cash flow`}>
    <OpsMetricStrip columns={4}>
      <OpsMetric label={`In the bank, ${flow.currency}`} value={flow.opening === null ? "—" : figure(flow.opening, flow.currency)} detail={flow.opening === null ? "No statement balance" : `${accounts.length} account${accounts.length === 1 ? "" : "s"}${asOf ? `, from ${dateLabel(asOf)}` : ""}`}/>
      <OpsMetric label="Coming in, 13 weeks" value={figure(sum((row) => row.in), flow.currency)} detail={flow.overdue.in_overdue ? `${money(flow.overdue.in_overdue, flow.currency)} overdue besides` : "Nothing overdue"}/>
      <OpsMetric label="Going out, 13 weeks" value={figure(sum((row) => row.out) + flow.overdue.out, flow.currency)} detail={flow.overdue.out ? `${money(flow.overdue.out, flow.currency)} of it overdue` : "Nothing overdue"}/>
      <OpsMetric label="Lowest point" value={flow.lowest === null ? "—" : <span className={flow.lowest < 0 ? "text-[var(--admin-danger)]" : undefined}>{flow.lowest < 0 ? "−" : ""}{figure(Math.abs(flow.lowest), flow.currency)}</span>} detail={flow.short_from ? `Short from ${dateLabel(flow.short_from)}` : flow.lowest === null ? "Needs a bank balance" : "Stays above zero"}/>
    </OpsMetricStrip>
    <OpsSurface title={`${flow.currency} by week`} flush>
    <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table">
      <caption className="sr-only">{flow.currency} money in and out by week</caption>
      <thead><tr><th>Week</th><th>In</th><th>Out</th><th>Net</th><th>Balance</th></tr></thead>
      <tbody>
        {flow.overdue.count ? <tr>
          <td data-cell="primary"><span className="ops-cell-primary">Overdue now</span><span className="ops-cell-secondary">Past their due date</span></td>
          <td data-cell="meta" data-label="In" className="tabular-nums">{flow.overdue.in_overdue ? <span className="text-[var(--admin-muted)]">{money(flow.overdue.in_overdue, flow.currency)}, not counted</span> : "—"}</td>
          <td data-cell="meta" data-label="Out" className="tabular-nums">{flow.overdue.out ? money(flow.overdue.out, flow.currency) : "—"}</td>
          <td data-cell="meta" data-label="Net" className="tabular-nums"><Signed value={flow.overdue.net} currency={flow.currency}/></td>
          <td data-cell="amount" data-label="Balance" className="font-semibold tabular-nums">{flow.overdue.balance === null ? "—" : <Signed value={flow.overdue.balance} currency={flow.currency}/>}</td>
        </tr> : null}
        {flow.weeks.map((week, index) => <tr key={week.start}>
          <td data-cell="primary"><span className="ops-cell-primary">{weekLabel(week.start, week.end)}</span>{index === 0 ? <span className="ops-cell-secondary">This week</span> : null}</td>
          <td data-cell="meta" data-label="In" className="tabular-nums">{week.in ? money(week.in, flow.currency) : "—"}</td>
          <td data-cell="meta" data-label="Out" className="tabular-nums">{week.out ? money(week.out, flow.currency) : "—"}</td>
          <td data-cell="meta" data-label="Net" className="tabular-nums"><Signed value={week.net} currency={flow.currency}/></td>
          <td data-cell="amount" data-label="Balance" className="font-semibold tabular-nums">{week.balance === null ? "—" : <Signed value={week.balance} currency={flow.currency}/>}</td>
        </tr>)}
        {flow.later.count ? <tr>
          <td data-cell="primary"><span className="ops-cell-primary">Later</span><span className="ops-cell-secondary">After the 13th week</span></td>
          <td data-cell="meta" data-label="In" className="tabular-nums">{flow.later.in ? money(flow.later.in, flow.currency) : "—"}</td>
          <td data-cell="meta" data-label="Out" className="tabular-nums">{flow.later.out ? money(flow.later.out, flow.currency) : "—"}</td>
          <td data-cell="meta" data-label="Net" className="tabular-nums"><Signed value={flow.later.net} currency={flow.currency}/></td>
          <td data-cell="amount" data-label="Balance" className="font-semibold tabular-nums">{flow.later.balance === null ? "—" : <Signed value={flow.later.balance} currency={flow.currency}/>}</td>
        </tr> : null}
      </tbody>
    </table></OpsTableWrap>
    </OpsSurface>
  </section>;
}

function Soon({ entries, today, lastDay }: { entries: CashFlowEntry[]; today: string; lastDay: string }) {
  const soon = entries.filter((entry) => (entry.date ?? today) <= lastDay);
  if (!soon.length) return null;
  return <OpsSurface title={`Due in the next ${SOON_WEEKS} weeks`} description="Overdue first. Chase what's coming in; plan what's going out." flush>
    <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table" data-row-link>
      <thead><tr><th>What</th><th>Due</th><th>In</th><th>Out</th></tr></thead>
      <tbody>{soon.map((entry, index) => {
        const overdue = (entry.date ?? today) < today;
        return <tr key={`${entry.kind}-${entry.link}-${index}`}>
          <td data-cell="primary">{entry.link ? <Link href={entry.link} className="ops-cell-primary">{entry.label}</Link> : <span className="ops-cell-primary">{entry.label}</span>}<span className="ops-cell-secondary">{kindLabels[entry.kind]}</span></td>
          <td data-cell="meta" data-label="Due">{entry.date ? dateLabel(entry.date) : "Now"}{overdue ? <> <OpsBadge tone={entry.direction === "in" ? "warning" : "danger"}>Overdue</OpsBadge></> : null}</td>
          <td data-cell="meta" data-label="In" className="tabular-nums">{entry.direction === "in" ? money(entry.amount, entry.currency) : ""}</td>
          <td data-cell="meta" data-label="Out" className="tabular-nums">{entry.direction === "out" ? money(entry.amount, entry.currency) : ""}</td>
        </tr>;
      })}</tbody>
    </table></OpsTableWrap>
  </OpsSurface>;
}
