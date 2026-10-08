"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FilePlus2, Landmark } from "lucide-react";
import { invoiceStatusLabel, type FinanceDashboard, type FinanceInvoice, type FinanceInvoiceStatus } from "./finance-data";
import { OpsBadge, OpsButton, OpsMono, OpsNoMatches, OpsPage, OpsPageHeader, OpsProgress, OpsRegisterToolbar, OpsResultCount, OpsSearch, OpsScopeTabs, OpsSurface, OpsTableWrap } from "../operations-ui";
function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
/** The number the customer holds: the tax invoice number once issued, an imported invoice's own number, or the reference. */
function invoiceLabel(invoice: FinanceInvoice) { return invoice.tax_invoice_number || invoice.external_invoice_number || invoice.reference; }
function statusTone(status: FinanceInvoiceStatus): "neutral" | "info" | "violet" | "success" | "danger" { if (status === "issued") return "info"; if (status === "partially_paid") return "violet"; if (status === "paid") return "success"; if (status === "overdue") return "danger"; return "neutral"; }

const STATUS_TABS: Array<{ value: "all" | FinanceInvoiceStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

export function FinanceWorkspace({ dashboard }: { dashboard: FinanceDashboard }) {
  // A Job File links here filtered to its shipment (?q=REF).
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState<"all" | FinanceInvoiceStatus>("all");
  const [showAllToInvoice, setShowAllToInvoice] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dashboard.invoices.filter((invoice) => {
      if (status !== "all" && invoice.status !== status) return false;
      if (!needle) return true;
      return [invoice.reference, invoice.tax_invoice_number ?? "", invoice.external_invoice_number ?? "", invoice.record_type, invoice.migration_batch_id ?? "", invoice.customer_name, invoice.customer_id, invoice.shipment_reference ?? "", invoice.quote_reference ?? "", invoice.branch, invoice.currency].join(" ").toLowerCase().includes(needle);
    });
  }, [dashboard.invoices, query, status]);



  // Each status says how many it holds, once, on the chip that filters to it.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: dashboard.invoices.length };
    for (const invoice of dashboard.invoices) counts[invoice.status] = (counts[invoice.status] ?? 0) + 1;
    return counts;
  }, [dashboard.invoices]);

  return <OpsPage>
    <OpsPageHeader title="Receivables" description="What customers owe and when it’s due." actions={<Link href="/admin/finance/new" className="ops-button" data-variant="primary" data-size="md"><FilePlus2 size={13}/>New invoice</Link>}/>
    <div className="ops-content-wide ops-stack">
      {/* Per currency: what's owed and how old it is. Counts live on the chips below. */}
      {dashboard.currency_summaries.length ? <div className={`grid gap-3 ${dashboard.currency_summaries.length > 1 ? "xl:grid-cols-2" : ""}`}>{dashboard.currency_summaries.map((summary) => <OpsSurface key={summary.currency} title={`${money(summary.outstanding, summary.currency)} outstanding`} description={<>{summary.overdue > 0 ? <strong className="text-[var(--admin-danger)]">{money(summary.overdue, summary.currency)} overdue</strong> : "Nothing overdue"}{` · ${money(summary.collected, summary.currency)} collected of ${money(summary.invoiced + summary.opening_balance, summary.currency)}`}{summary.opening_balance_count ? ` · ${summary.opening_balance_count} opening balance${summary.opening_balance_count === 1 ? "" : "s"}` : ""}</>}><div className="grid gap-x-6 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"><Age label="0–30 days" value={summary.aging_0_30} total={summary.outstanding} currency={summary.currency}/><Age label="31–60 days" value={summary.aging_31_60} total={summary.outstanding} currency={summary.currency}/><Age label="61–90 days" value={summary.aging_61_90} total={summary.outstanding} currency={summary.currency}/><Age label="Over 90 days" value={summary.aging_90_plus} total={summary.outstanding} currency={summary.currency} danger={summary.aging_90_plus > 0}/></div></OpsSurface>)}</div> : null}

      {/* Work delivered and not yet billed: nothing else in the app says so. */}
      {dashboard.to_invoice.length ? <OpsSurface title={`${dashboard.to_invoice.length} delivered, not invoiced`} flush>
        <OpsTableWrap><table className="ops-table ops-register-table finance-table ops-stack-table"><thead><tr><th>Shipment</th><th>Customer</th><th>Delivered</th><th><span className="sr-only">Next step</span></th></tr></thead><tbody>{(showAllToInvoice ? dashboard.to_invoice : dashboard.to_invoice.slice(0, 8)).map((row) => <tr key={row.reference}>
          <td data-cell="primary"><Link href={`/admin/jobs/${encodeURIComponent(row.reference)}`}><OpsMono>{row.reference}</OpsMono></Link></td>
          <td data-cell="route">{row.customer_name || row.customer_id || "Customer not linked"}<p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{row.branch}</p></td>
          <td data-cell="meta" data-label="Delivered">{row.delivered_on ? dateLabel(row.delivered_on) : "—"}</td>
          <td data-cell="action">{row.draft_invoice_count ? <OpsButton size="xs" variant="secondary" onClick={() => { setQuery(row.reference); setStatus("draft"); }}>Issue the draft</OpsButton> : <Link href={`/admin/finance/new/${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="secondary" data-size="xs">Create invoice</Link>}</td>
        </tr>)}</tbody></table></OpsTableWrap>
        {dashboard.to_invoice.length > 8 ? <div className="p-3"><OpsButton size="xs" variant="ghost" onClick={() => setShowAllToInvoice((value) => !value)}>{showAllToInvoice ? "Show fewer" : `Show all ${dashboard.to_invoice.length}`}</OpsButton></div> : null}
      </OpsSurface> : null}

      <OpsSurface flush>
        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice, opening balance, customer, shipment or branch"/>}
          actions={(
            <>
              {query.trim() || status !== "all" ? <OpsButton size="xs" variant="ghost" onClick={() => { setQuery(""); setStatus("all"); }}>Reset</OpsButton> : null}
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <OpsResultCount count={filtered.length} searching={Boolean(query.trim())}/>
            </>
          )}
          tabs={<OpsScopeTabs label="Invoice status" items={STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label, count: statusCounts[tab.value] ?? 0 }))} value={status} onChange={(value) => setStatus(value)}/>}
        />
        {filtered.length ? <OpsTableWrap><table className="ops-table ops-register-table finance-table ops-stack-table" data-row-link><thead><tr><th>Receivable</th><th>Customer</th><th>Job / branch</th><th>Date / due</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead><tbody>{filtered.map((invoice: (typeof dashboard.invoices)[number]) => <tr key={invoice.reference}><td data-cell="primary"><Link href={`/admin/finance/invoices/${encodeURIComponent(invoice.reference)}`} className="ops-cell-ref ops-mono">{invoice.record_type === "opening_balance" ? "Opening balance" : invoiceLabel(invoice)}</Link>{/* The KCPL reference shows underneath only when the label above is something else. */}{(invoice.record_type === "opening_balance" || invoiceLabel(invoice) !== invoice.reference) || invoice.migration_batch_id ? <div className="mt-1 flex flex-wrap items-center gap-1.5">{invoice.record_type === "opening_balance" || invoiceLabel(invoice) !== invoice.reference ? <span className="ops-cell-secondary ops-mono">{invoice.reference}</span> : null}{invoice.migration_batch_id && invoice.record_type !== "opening_balance" ? <OpsBadge tone="info">Imported</OpsBadge> : null}</div> : null}</td><td data-cell="route"><span className="ops-cell-primary">{invoice.customer_name}</span></td><td data-cell="meta"><span>{invoice.shipment_reference ? <OpsMono>{invoice.shipment_reference}</OpsMono> : "No shipment"}</span><p className="mt-1 flex items-center gap-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]"><Landmark size={9}/>{invoice.branch}</p></td><td data-cell="meta"><span>{invoice.record_type === "opening_balance" ? `As at ${dateLabel(invoice.migration_as_of_date || invoice.issue_date)}` : dateLabel(invoice.issue_date)}</span><p className={`mt-1 text-[length:var(--app-label-size)] ${invoice.status === "overdue" ? "font-bold text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>Due {dateLabel(invoice.due_date)}</p></td><td data-cell="meta" data-label="Total" className="font-bold text-[var(--admin-ink)] tabular-nums">{money(invoice.total, invoice.currency)}</td><td data-cell="amount" data-label="Balance" className={`font-bold tabular-nums ${invoice.balance_due > 0 ? "text-[var(--admin-ink)]" : "text-[var(--admin-success)]"}`}>{money(invoice.balance_due, invoice.currency)}</td><td data-cell="status"><OpsBadge tone={statusTone(invoice.status)} dot>{invoiceStatusLabel(invoice)}</OpsBadge></td></tr>)}</tbody></table></OpsTableWrap> : <OpsNoMatches noun="receivables" onClear={() => { setQuery(""); setStatus("all"); }}/>}
      </OpsSurface>
    </div>
  </OpsPage>;
}

function Age({ label, value, total, currency, danger = false }: { label: string; value: number; total: number; currency: string; danger?: boolean }) { return <div><div className="flex items-center justify-between gap-2"><span className="text-[length:var(--app-label-size)] font-bold text-[var(--admin-muted)]">{label}</span><span className={`tabular-nums text-[length:var(--app-label-size)] font-semibold ${danger ? "text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>{money(value, currency)}</span></div><div className="mt-2"><OpsProgress value={value} max={Math.max(total, 1)} tone={danger ? "danger" : value > 0 ? "warning" : "accent"}/></div></div>; }
