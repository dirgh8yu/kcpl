"use client";
import { nepalOperationalDate } from "../../invoice-effective-status";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilePlus2, Landmark } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { financeInvoiceStatusLabels, type FinanceDashboard, type FinanceInvoiceStatus } from "./finance-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsProgress, OpsRegisterToolbar, OpsSearch, OpsScopeTabs, OpsSurface, OpsTableWrap } from "../operations-ui";
function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
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
  const router = useRouter();
  // A Job File links here filtered to its shipment (?q=REF).
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState<"all" | FinanceInvoiceStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const today = nepalOperationalDate();
  const [form, setForm] = useState({ shipmentReference: "", customerId: "", issueDate: today, dueDate: "", currency: "NPR" as CrmCurrency, description: "", amount: "", taxRate: "0", notes: "" });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dashboard.invoices.filter((invoice) => {
      if (status !== "all" && invoice.status !== status) return false;
      if (!needle) return true;
      return [invoice.reference, invoice.external_invoice_number ?? "", invoice.record_type, invoice.migration_batch_id ?? "", invoice.customer_name, invoice.customer_id, invoice.shipment_reference ?? "", invoice.quote_reference ?? "", invoice.branch, invoice.currency].join(" ").toLowerCase().includes(needle);
    });
  }, [dashboard.invoices, query, status]);

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const shipmentReference = form.shipmentReference.trim().toUpperCase();
      const typedCustomerId = form.customerId.trim().toUpperCase();
      const customerId = typedCustomerId.startsWith("KCPL-C-") ? typedCustomerId : "";
      const response = await fetch("/api/admin/finance/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, shipmentReference, customerId, amount: Number(form.amount), taxRate: Number(form.taxRate) }) });
      const data = await response.json() as { reference?: string; error?: string; resolutionPath?: string };
      if (!response.ok && data.resolutionPath) { router.push(data.resolutionPath); return; }
      if (!response.ok || !data.reference) throw new Error(data.error || "Invoice could not be created.");
      router.push(`/admin/finance/invoices/${encodeURIComponent(data.reference)}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Invoice could not be created."); }
    finally { setBusy(false); }
  }

  const shipmentMode = Boolean(form.shipmentReference.trim());

  // Each status says how many it holds, once, on the chip that filters to it.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: dashboard.invoices.length };
    for (const invoice of dashboard.invoices) counts[invoice.status] = (counts[invoice.status] ?? 0) + 1;
    return counts;
  }, [dashboard.invoices]);

  return <OpsPage>
    <OpsPageHeader title="Receivables" description="What customers owe and when it’s due." actions={<OpsButton variant="primary" onClick={() => setCreateOpen((value) => !value)}><FilePlus2 size={13}/>{createOpen ? "Close form" : "New invoice"}</OpsButton>}/>
    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone="danger" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      {createOpen ? <OpsSurface eyebrow="Create receivable" title="New invoice draft" description="If the invoice belongs to a shipment, enter the shipment reference and KCPL will resolve the linked customer record before continuing."><form onSubmit={createInvoice} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><OpsField label="Shipment reference"><input value={form.shipmentReference} onChange={(event) => setForm((current) => ({ ...current, shipmentReference: event.target.value, customerId: event.target.value.trim() ? "" : current.customerId }))} placeholder="KCPL-S-…"/></OpsField><OpsField label={shipmentMode ? "Customer reference (automatic)" : "Customer reference"}><input disabled={shipmentMode} value={shipmentMode ? "Resolved from shipment" : form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} placeholder="KCPL-C-…"/></OpsField><OpsField label="Issue date"><input required type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })}/></OpsField><OpsField label="Due date"><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></OpsField><OpsField label="Currency"><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></OpsField><OpsField label="Amount before tax"><input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></OpsField><OpsField label="Tax %"><input min="0" max="100" step="0.01" type="number" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></OpsField><OpsField label="Description"><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Freight and logistics services"/></OpsField><OpsField label="Invoice notes" className="md:col-span-2 xl:col-span-4"><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></OpsField><div className="flex gap-2 md:col-span-2 xl:col-span-4"><OpsButton type="submit" variant="primary" disabled={busy}>{busy ? "Creating…" : shipmentMode ? "Continue to invoice" : "Create invoice draft"}</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</OpsButton></div></form></OpsSurface> : null}

      {/* Per currency: what's owed and how old it is. Counts live on the chips below. */}
      {dashboard.currency_summaries.length ? <div className={`grid gap-3 ${dashboard.currency_summaries.length > 1 ? "xl:grid-cols-2" : ""}`}>{dashboard.currency_summaries.map((summary) => <OpsSurface key={summary.currency} title={`${money(summary.outstanding, summary.currency)} outstanding`} description={<>{summary.overdue > 0 ? <strong className="text-[var(--admin-danger)]">{money(summary.overdue, summary.currency)} overdue</strong> : "Nothing overdue"}{` · ${money(summary.collected, summary.currency)} collected of ${money(summary.invoiced + summary.opening_balance, summary.currency)}`}{summary.opening_balance_count ? ` · ${summary.opening_balance_count} opening balance${summary.opening_balance_count === 1 ? "" : "s"}` : ""}</>}><div className="grid gap-x-6 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"><Age label="0–30 days" value={summary.aging_0_30} total={summary.outstanding} currency={summary.currency}/><Age label="31–60 days" value={summary.aging_31_60} total={summary.outstanding} currency={summary.currency}/><Age label="61–90 days" value={summary.aging_61_90} total={summary.outstanding} currency={summary.currency}/><Age label="Over 90 days" value={summary.aging_90_plus} total={summary.outstanding} currency={summary.currency} danger={summary.aging_90_plus > 0}/></div></OpsSurface>)}</div> : null}

      <OpsSurface flush>
        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice, opening balance, customer, shipment or branch"/>}
          actions={(
            <>
              {query.trim() || status !== "all" ? <OpsButton size="xs" variant="ghost" onClick={() => { setQuery(""); setStatus("all"); }}>Reset</OpsButton> : null}
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <span className="ops-result-count" aria-live="polite">{filtered.length === dashboard.invoices.length ? `${dashboard.invoices.length} records` : `${filtered.length} of ${dashboard.invoices.length}`}</span>
            </>
          )}
          tabs={<OpsScopeTabs label="Invoice status" items={STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label, count: statusCounts[tab.value] ?? 0 }))} value={status} onChange={(value) => setStatus(value)}/>}
        />
        <OpsTableWrap><table className="ops-table ops-register-table finance-table ops-stack-table" data-row-link><thead><tr><th>Receivable</th><th>Customer</th><th>Job / branch</th><th>Date / due</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead><tbody>{filtered.length ? filtered.map((invoice: (typeof dashboard.invoices)[number]) => <tr key={invoice.reference}><td data-cell="primary"><Link href={`/admin/finance/invoices/${encodeURIComponent(invoice.reference)}`} className="ops-cell-ref ops-mono">{invoice.record_type === "opening_balance" ? "Opening balance" : invoice.external_invoice_number || invoice.reference}</Link>{/* The KCPL reference shows underneath only when the label above is something else. */}{(invoice.record_type === "opening_balance" || (invoice.external_invoice_number && invoice.external_invoice_number !== invoice.reference)) || invoice.migration_batch_id ? <div className="mt-1 flex flex-wrap items-center gap-1.5">{invoice.record_type === "opening_balance" || (invoice.external_invoice_number && invoice.external_invoice_number !== invoice.reference) ? <span className="ops-cell-secondary ops-mono">{invoice.reference}</span> : null}{invoice.migration_batch_id && invoice.record_type !== "opening_balance" ? <OpsBadge tone="info">Imported</OpsBadge> : null}</div> : null}</td><td data-cell="route"><span className="ops-cell-primary">{invoice.customer_name}</span></td><td data-cell="meta"><span>{invoice.shipment_reference ? <OpsMono>{invoice.shipment_reference}</OpsMono> : "No shipment"}</span><p className="mt-1 flex items-center gap-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]"><Landmark size={9}/>{invoice.branch}</p></td><td data-cell="meta"><span>{invoice.record_type === "opening_balance" ? `As at ${dateLabel(invoice.migration_as_of_date || invoice.issue_date)}` : dateLabel(invoice.issue_date)}</span><p className={`mt-1 text-[length:var(--app-label-size)] ${invoice.status === "overdue" ? "font-bold text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>Due {dateLabel(invoice.due_date)}</p></td><td data-cell="meta" data-label="Total" className="font-bold text-[var(--admin-ink)] tabular-nums">{money(invoice.total, invoice.currency)}</td><td data-cell="amount" data-label="Balance" className={`font-bold tabular-nums ${invoice.balance_due > 0 ? "text-[var(--admin-ink)]" : "text-[var(--admin-success)]"}`}>{money(invoice.balance_due, invoice.currency)}</td><td data-cell="status"><OpsBadge tone={statusTone(invoice.status)} dot>{financeInvoiceStatusLabels[invoice.status]}</OpsBadge></td></tr>) : <tr><td colSpan={7}><OpsEmptyState compact kind="search" title="No receivables match" description="Change the filters or create a new invoice draft."/></td></tr>}</tbody></table></OpsTableWrap>
      </OpsSurface>
    </div>
  </OpsPage>;
}

function Age({ label, value, total, currency, danger = false }: { label: string; value: number; total: number; currency: string; danger?: boolean }) { return <div><div className="flex items-center justify-between gap-2"><span className="text-[length:var(--app-label-size)] font-bold text-[var(--admin-muted)]">{label}</span><span className={`tabular-nums text-[length:var(--app-label-size)] font-semibold ${danger ? "text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>{money(value, currency)}</span></div><div className="mt-2"><OpsProgress value={value} max={Math.max(total, 1)} tone={danger ? "danger" : value > 0 ? "warning" : "accent"}/></div></div>; }
