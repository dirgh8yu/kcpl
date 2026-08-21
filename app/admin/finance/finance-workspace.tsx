"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Clock3, FilePlus2, Landmark, TriangleAlert, WalletCards } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { financeInvoiceStatusLabels, financeInvoiceStatuses, type FinanceDashboard, type FinanceInvoiceStatus } from "./finance-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsProgress, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
function statusTone(status: FinanceInvoiceStatus): "neutral" | "info" | "violet" | "success" | "danger" { if (status === "issued") return "info"; if (status === "partially_paid") return "violet"; if (status === "paid") return "success"; if (status === "overdue") return "danger"; return "neutral"; }

export function FinanceWorkspace({ dashboard, roleLabel }: { dashboard: FinanceDashboard; roleLabel: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | FinanceInvoiceStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ shipmentReference: "", customerId: "", issueDate: today, dueDate: "", currency: "NPR" as CrmCurrency, description: "", amount: "", taxRate: "0", notes: "" });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dashboard.invoices.filter((invoice) => {
      if (status !== "all" && invoice.status !== status) return false;
      if (!needle) return true;
      return [invoice.reference, invoice.customer_name, invoice.customer_id, invoice.shipment_reference ?? "", invoice.quote_reference ?? "", invoice.branch, invoice.currency].join(" ").toLowerCase().includes(needle);
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

  return <OpsPage>
    <OpsPageHeader eyebrow="Commercial" title="Receivables" description="Customer invoices, collections and aging in the same calm operating system as the freight work. Currency balances stay separate so the numbers remain meaningful." meta={<><span>{roleLabel}</span><span>{dashboard.invoices.length} invoices</span></>} actions={<><Link href="/admin/payables" className="ops-button" data-variant="secondary" data-size="md">Payables</Link><OpsButton variant="primary" onClick={() => setCreateOpen((value) => !value)}><FilePlus2 size={13}/>{createOpen ? "Close form" : "New invoice"}</OpsButton></>}/>
    <OpsStatStrip>
      <OpsStat label="Overdue" value={dashboard.overdue_count} icon={<TriangleAlert size={13}/>} tone={dashboard.overdue_count ? "danger" : "neutral"} active={status === "overdue"} onClick={() => setStatus(status === "overdue" ? "all" : "overdue")}/>
      <OpsStat label="Open receivables" value={dashboard.unpaid_count} icon={<Clock3 size={13}/>} />
      <OpsStat label="Paid" value={dashboard.paid_count} icon={<Banknote size={13}/>} tone="success" active={status === "paid"} onClick={() => setStatus(status === "paid" ? "all" : "paid")}/>
      <OpsStat label="Drafts" value={dashboard.draft_count} icon={<WalletCards size={13}/>} active={status === "draft"} onClick={() => setStatus(status === "draft" ? "all" : "draft")}/>
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone="danger" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      {createOpen ? <OpsSurface eyebrow="Create receivable" title="New invoice draft" description="If the invoice belongs to a shipment, enter the shipment reference and KCPL will resolve the linked CRM customer before continuing."><form onSubmit={createInvoice} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><OpsField label="Shipment reference"><input value={form.shipmentReference} onChange={(event) => setForm((current) => ({ ...current, shipmentReference: event.target.value, customerId: event.target.value.trim() ? "" : current.customerId }))} placeholder="KCPL-S-..."/></OpsField><OpsField label={shipmentMode ? "Customer reference (automatic)" : "Customer reference"}><input disabled={shipmentMode} value={shipmentMode ? "Resolved from shipment" : form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} placeholder="KCPL-C-..."/></OpsField><OpsField label="Issue date"><input required type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })}/></OpsField><OpsField label="Due date"><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></OpsField><OpsField label="Currency"><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></OpsField><OpsField label="Amount before tax"><input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></OpsField><OpsField label="Tax %"><input min="0" max="100" step="0.01" type="number" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></OpsField><OpsField label="Description"><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Freight and logistics services"/></OpsField><OpsField label="Invoice notes" className="md:col-span-2 xl:col-span-4"><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></OpsField><div className="flex gap-2 md:col-span-2 xl:col-span-4"><OpsButton variant="primary" disabled={busy}>{busy ? "Creating…" : shipmentMode ? "Continue to invoice" : "Create invoice draft"}</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</OpsButton></div></form></OpsSurface> : null}

      {dashboard.currency_summaries.length ? <div className="grid gap-3 xl:grid-cols-2">{dashboard.currency_summaries.map((summary) => <OpsSurface key={summary.currency} eyebrow={`${summary.currency} receivables`} title={`${money(summary.outstanding, summary.currency)} outstanding`} description={`${summary.invoice_count} invoices in this currency.`}><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Mini label="Invoiced" value={money(summary.invoiced, summary.currency)}/><Mini label="Collected" value={money(summary.collected, summary.currency)} tone="success"/><Mini label="Outstanding" value={money(summary.outstanding, summary.currency)}/><Mini label="Overdue" value={money(summary.overdue, summary.currency)} tone={summary.overdue > 0 ? "danger" : "neutral"}/></div><div className="mt-4 grid grid-cols-4 gap-2"><Age label="0–30" value={summary.aging_0_30} total={summary.outstanding} currency={summary.currency}/><Age label="31–60" value={summary.aging_31_60} total={summary.outstanding} currency={summary.currency}/><Age label="61–90" value={summary.aging_61_90} total={summary.outstanding} currency={summary.currency}/><Age label="90+" value={summary.aging_90_plus} total={summary.outstanding} currency={summary.currency} danger={summary.aging_90_plus > 0}/></div></OpsSurface>)}</div> : null}

      <OpsSurface eyebrow="Invoice register" title="Receivables ledger" description={`${filtered.length} of ${dashboard.invoices.length} invoices shown.`} flush>
        <div className="ops-toolbar"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice, customer, shipment or branch"/><select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as "all" | FinanceInvoiceStatus)}><option value="all">All statuses</option>{financeInvoiceStatuses.map((item) => <option key={item} value={item}>{financeInvoiceStatusLabels[item]}</option>)}</select><OpsButton variant="ghost" size="sm" onClick={() => { setQuery(""); setStatus("all"); }}>Reset</OpsButton></div>
        <div className="ops-table-wrap"><table className="ops-table min-w-[1050px]"><thead><tr><th>Invoice</th><th>Customer</th><th>Job / branch</th><th>Issued / due</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead><tbody>{filtered.length ? filtered.map((invoice) => <tr key={invoice.reference}><td><Link href={`/admin/finance/invoices/${encodeURIComponent(invoice.reference)}`}><OpsMono>{invoice.reference}</OpsMono></Link></td><td><strong>{invoice.customer_name}</strong><p className="mt-1 text-[8px] text-[#9c928a]"><OpsMono>{invoice.customer_id}</OpsMono></p></td><td><span>{invoice.shipment_reference ? <OpsMono>{invoice.shipment_reference}</OpsMono> : "No shipment"}</span><p className="mt-1 flex items-center gap-1 text-[8px] text-[#9c928a]"><Landmark size={9}/>{invoice.branch}</p></td><td><span>{dateLabel(invoice.issue_date)}</span><p className={`mt-1 text-[8px] ${invoice.status === "overdue" ? "font-bold text-[#b65355]" : "text-[#9c928a]"}`}>Due {dateLabel(invoice.due_date)}</p></td><td className="font-bold text-[#514840]">{money(invoice.total, invoice.currency)}</td><td className={`font-bold ${invoice.balance_due > 0 ? "text-[#514840]" : "text-[#66806b]"}`}>{money(invoice.balance_due, invoice.currency)}</td><td><OpsBadge tone={statusTone(invoice.status)} dot>{financeInvoiceStatusLabels[invoice.status]}</OpsBadge></td></tr>) : <tr><td colSpan={7}><OpsEmptyState kind="search" title="No receivables match" description="Change the filters or create a new invoice draft."/></td></tr>}</tbody></table></div>
      </OpsSurface>
    </div>
  </OpsPage>;
}

function Mini({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" }) { return <div className="rounded-[12px] border border-[#ebe3dc] bg-[#faf7f4] p-3"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#9b9189]">{label}</p><strong className={`mt-1.5 block text-[10px] ${tone === "success" ? "text-[#66806b]" : tone === "danger" ? "text-[#b65355]" : "text-[#514840]"}`}>{value}</strong></div>; }
function Age({ label, value, total, currency, danger = false }: { label: string; value: number; total: number; currency: string; danger?: boolean }) { return <div><div className="flex items-center justify-between gap-2"><span className="text-[8px] font-bold text-[#8e847c]">{label}</span><span className={`text-[8px] font-semibold ${danger ? "text-[#b65355]" : "text-[#8e847c]"}`}>{money(value, currency)}</span></div><div className="mt-2"><OpsProgress value={value} max={Math.max(total, 1)} tone={danger ? "danger" : value > 0 ? "warning" : "accent"}/></div></div>; }
