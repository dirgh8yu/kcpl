"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Clock3, FilePlus2, Landmark, Search, TriangleAlert, WalletCards, X } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import {
  OpsButton,
  OpsEmptyState,
  OpsFilterBar,
  OpsMetric,
  OpsMetricStrip,
  OpsPageHeader,
  OpsPanel,
  OpsStatusBadge,
  OpsTableFrame,
} from "../operations-ui";
import { financeInvoiceStatusLabels, financeInvoiceStatuses, type FinanceDashboard, type FinanceInvoiceStatus } from "./finance-data";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

function statusTone(status: FinanceInvoiceStatus): "neutral" | "info" | "success" | "warning" | "danger" | "accent" {
  if (status === "paid") return "success";
  if (status === "overdue") return "danger";
  if (status === "partially_paid") return "accent";
  if (status === "issued") return "info";
  if (status === "void") return "neutral";
  return "warning";
}

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
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const shipmentReference = form.shipmentReference.trim().toUpperCase();
      const typedCustomerId = form.customerId.trim().toUpperCase();
      const customerId = typedCustomerId.startsWith("KCPL-C-") ? typedCustomerId : "";
      const response = await fetch("/api/admin/finance/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, shipmentReference, customerId, amount: Number(form.amount), taxRate: Number(form.taxRate) }),
      });
      const data = await response.json() as { reference?: string; error?: string; resolutionPath?: string };
      if (!response.ok && data.resolutionPath) { router.push(data.resolutionPath); return; }
      if (!response.ok || !data.reference) throw new Error(data.error || "Invoice could not be created.");
      router.push(`/admin/finance/invoices/${encodeURIComponent(data.reference)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Invoice could not be created.");
    } finally { setBusy(false); }
  }

  const shipmentMode = Boolean(form.shipmentReference.trim());
  const filtersActive = status !== "all" || Boolean(query.trim());

  return <main>
    <OpsPageHeader
      eyebrow="Finance"
      title="Finance & AR"
      description="Issue invoices, work collections and monitor receivables aging without losing the shipment and customer context behind each balance."
      breadcrumbs={[{ label: "Finance" }, { label: "Finance & AR" }]}
      meta={roleLabel}
      actions={<OpsButton tone="primary" onClick={() => setCreateOpen((value) => !value)}>{createOpen ? <X size={13}/> : <FilePlus2 size={13}/>} {createOpen ? "Close form" : "New invoice"}</OpsButton>}
    />

    <div className="ops-page-body ops-stack">
      <OpsMetricStrip columns={4}>
        <OpsMetric label="Overdue invoices" value={dashboard.overdue_count} icon={<TriangleAlert size={13}/>} tone={dashboard.overdue_count ? "danger" : "neutral"}/>
        <OpsMetric label="Open receivables" value={dashboard.unpaid_count} icon={<Clock3 size={13}/>} tone={dashboard.unpaid_count ? "warning" : "neutral"}/>
        <OpsMetric label="Paid invoices" value={dashboard.paid_count} icon={<Banknote size={13}/>} tone="success"/>
        <OpsMetric label="Draft invoices" value={dashboard.draft_count} icon={<WalletCards size={13}/>} />
      </OpsMetricStrip>

      {notice ? <div className="rounded-lg border border-[#ecd8da] bg-[#fbf3f4] px-3.5 py-2.5 text-[11px] text-[#8d4b53]">{notice}</div> : null}

      {createOpen ? <OpsPanel title="New invoice draft" eyebrow="Create receivable" description="For shipment invoices, enter the shipment reference and KCPL will resolve the CRM customer using the existing finance linking logic.">
        <form onSubmit={createInvoice} className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Shipment reference"><input className="h-10 w-full px-3" value={form.shipmentReference} onChange={(event) => setForm((current) => ({ ...current, shipmentReference: event.target.value, customerId: event.target.value.trim() ? "" : current.customerId }))} placeholder="KCPL-S-..."/></Field>
          <Field label={shipmentMode ? "Customer reference · automatic" : "Customer reference"}><input disabled={shipmentMode} className="h-10 w-full px-3 disabled:opacity-55" value={shipmentMode ? "Resolved from shipment" : form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} placeholder="KCPL-C-..."/></Field>
          <Field label="Issue date"><input required type="date" className="h-10 w-full px-3" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })}/></Field>
          <Field label="Due date"><input type="date" className="h-10 w-full px-3" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></Field>
          <Field label="Currency"><select className="h-10 w-full px-3" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
          <Field label="Amount before tax"><input required min="0.01" step="0.01" type="number" className="h-10 w-full px-3" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></Field>
          <Field label="Tax %"><input min="0" max="100" step="0.01" type="number" className="h-10 w-full px-3" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></Field>
          <Field label="Description"><input className="h-10 w-full px-3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Freight and logistics services"/></Field>
          <div className="md:col-span-2 xl:col-span-4"><Field label="Invoice notes"><textarea className="min-h-20 w-full resize-y px-3 py-2.5" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></Field></div>
          <div className="md:col-span-2 xl:col-span-4 flex justify-end"><OpsButton tone="primary" disabled={busy} type="submit">{busy ? "Creating…" : shipmentMode ? "Continue to invoice" : "Create invoice draft"}</OpsButton></div>
        </form>
      </OpsPanel> : null}

      {dashboard.currency_summaries.length ? <div className="grid gap-3 xl:grid-cols-2">{dashboard.currency_summaries.map((summary) => <OpsPanel key={summary.currency} title={`${summary.currency} receivables`} eyebrow="Currency exposure" action={<strong className="text-sm font-semibold text-[#30363d]">{money(summary.outstanding, summary.currency)} outstanding</strong>}>
        <div className="grid gap-px bg-[#eceef0] sm:grid-cols-4"><Mini label="Invoiced" value={money(summary.invoiced, summary.currency)}/><Mini label="Collected" value={money(summary.collected, summary.currency)}/><Mini label="Outstanding" value={money(summary.outstanding, summary.currency)}/><Mini label="Overdue" value={money(summary.overdue, summary.currency)} warn={summary.overdue > 0}/></div>
        <div className="grid gap-px border-t border-[#eceef0] bg-[#eceef0] sm:grid-cols-4"><Age label="0–30 days" value={summary.aging_0_30} currency={summary.currency}/><Age label="31–60" value={summary.aging_31_60} currency={summary.currency}/><Age label="61–90" value={summary.aging_61_90} currency={summary.currency}/><Age label="90+" value={summary.aging_90_plus} currency={summary.currency}/></div>
      </OpsPanel>)}</div> : null}

      <OpsTableFrame toolbar={<OpsFilterBar count={<><strong className="font-semibold text-[#353b42]">{filtered.length}</strong> of {dashboard.invoices.length}</>} reset={filtersActive ? <button type="button" onClick={() => { setQuery(""); setStatus("all"); }} className="inline-flex items-center gap-1 text-[#5968bb] hover:underline"><X size={11}/>Clear</button> : null}><label className="ops-search-field flex-1 lg:max-w-[470px]"><Search size={13} className="text-[#8e959c]"/><span className="sr-only">Search invoices</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice, customer, shipment or branch"/></label><label className="ops-filter-control"><WalletCards size={13}/><span className="sr-only">Invoice status</span><select value={status} onChange={(event) => setStatus(event.target.value as "all" | FinanceInvoiceStatus)}><option value="all">All statuses</option>{financeInvoiceStatuses.map((item) => <option key={item} value={item}>{financeInvoiceStatusLabels[item]}</option>)}</select></label></OpsFilterBar>}>
        <table className="ops-dense-table min-w-[1050px] text-left"><thead><tr><th className="px-4">Invoice</th><th className="px-3">Customer</th><th className="px-3">Shipment / branch</th><th className="px-3">Issued / due</th><th className="px-3">Total</th><th className="px-3">Balance</th><th className="px-3">Status</th></tr></thead><tbody>{filtered.length ? filtered.map((invoice) => <tr key={invoice.reference}><td className="px-4"><Link href={`/admin/finance/invoices/${encodeURIComponent(invoice.reference)}`} className="ops-row-link">{invoice.reference}</Link></td><td className="px-3"><strong className="font-medium text-[#414850]">{invoice.customer_name}</strong><p className="mt-0.5 text-[9px] text-[#9aa0a7]">{invoice.customer_id}</p></td><td className="px-3"><span>{invoice.shipment_reference || "No shipment"}</span><p className="mt-0.5 flex items-center gap-1 text-[9px] text-[#939aa1]"><Landmark size={9}/>{invoice.branch}</p></td><td className="px-3"><span>{dateLabel(invoice.issue_date)}</span><p className={`mt-0.5 text-[9px] ${invoice.status === "overdue" ? "font-semibold text-[#9f5059]" : "text-[#939aa1]"}`}>Due {dateLabel(invoice.due_date)}</p></td><td className="px-3 font-semibold">{money(invoice.total, invoice.currency)}</td><td className={`px-3 font-semibold ${invoice.balance_due > 0 ? "text-[#343b43]" : "text-[#47765b]"}`}>{money(invoice.balance_due, invoice.currency)}</td><td className="px-3"><OpsStatusBadge tone={statusTone(invoice.status)}>{financeInvoiceStatusLabels[invoice.status]}</OpsStatusBadge></td></tr>) : <tr><td colSpan={7}><OpsEmptyState title="No invoices match this view" detail="Clear the current filters or create a new invoice draft."/></td></tr>}</tbody></table>
      </OpsTableFrame>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#606871]">{label}</span>{children}</label>; }
function Mini({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) { return <div className="bg-white p-3"><p className="text-[9px] font-medium uppercase tracking-[.06em] text-[#8a929a]">{label}</p><p className={`mt-1 text-[12px] font-semibold ${warn ? "text-[#9f5059]" : "text-[#373e45]"}`}>{value}</p></div>; }
function Age({ label, value, currency }: { label: string; value: number; currency: string }) { return <div className="bg-[#fafafa] p-3"><p className="text-[9px] font-medium uppercase tracking-[.06em] text-[#8a929a]">{label}</p><p className={`mt-1 text-[11px] font-semibold ${value ? "text-[#8b6938]" : "text-[#9aa0a7]"}`}>{money(value, currency)}</p></div>; }
