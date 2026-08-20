"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, BriefcaseBusiness, Clock3, FilePlus2, Search, TriangleAlert, WalletCards, X } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { jobCostCategories, jobCostCategoryLabels, type JobCostCategory } from "../job-file";
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
import { payableStatusLabels, payableStatuses, type PayablesDashboard, type PayableStatus } from "./payables-data";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
function statusTone(status: PayableStatus): "neutral" | "info" | "success" | "warning" | "danger" | "accent" { if (status === "paid") return "success"; if (status === "overdue") return "danger"; if (status === "partially_paid") return "accent"; if (status === "approved") return "info"; if (status === "void") return "neutral"; return "warning"; }

export function PayablesWorkspace({ dashboard, roleLabel, initialShipment = "" }: { dashboard: PayablesDashboard; roleLabel: string; initialShipment?: string }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | PayableStatus>("all");
  const [createOpen, setCreateOpen] = useState(Boolean(initialShipment));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ shipmentReference: initialShipment, supplierId: "", supplierName: "", supplierBillReference: "", billDate: today, dueDate: "", currency: "NPR" as CrmCurrency, category: "freight" as JobCostCategory, description: "Freight / logistics supplier cost", amount: "", taxRate: "0", notes: "" });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dashboard.bills.filter((bill) => {
      if (status !== "all" && bill.status !== status) return false;
      if (!needle) return true;
      return [bill.reference, bill.supplier_name, bill.supplier_bill_reference ?? "", bill.shipment_reference ?? "", bill.branch, bill.currency].join(" ").toLowerCase().includes(needle);
    });
  }, [dashboard.bills, query, status]);

  async function createBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/payables/bills", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, amount: Number(form.amount), taxRate: Number(form.taxRate) }) });
      const data = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !data.reference) throw new Error(data.error || "Supplier bill could not be created.");
      router.push(`/admin/payables/bills/${encodeURIComponent(data.reference)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Supplier bill could not be created.");
    } finally { setBusy(false); }
  }

  const filtersActive = status !== "all" || Boolean(query.trim());

  return <main>
    <OpsPageHeader eyebrow="Finance" title="Payables" description="Work supplier bills, payments, aging and shipment-linked job costs from one controlled ledger." breadcrumbs={[{ label: "Finance", href: "/admin/finance" }, { label: "Payables" }]} meta={roleLabel} actions={<OpsButton tone="primary" onClick={() => setCreateOpen((value) => !value)}>{createOpen ? <X size={13}/> : <FilePlus2 size={13}/>} {createOpen ? "Close form" : "New supplier bill"}</OpsButton>}/>

    <div className="ops-page-body ops-stack">
      <OpsMetricStrip columns={4}>
        <OpsMetric label="Overdue bills" value={dashboard.overdue_count} icon={<TriangleAlert size={13}/>} tone={dashboard.overdue_count ? "danger" : "neutral"}/>
        <OpsMetric label="Open payables" value={dashboard.unpaid_count} icon={<Clock3 size={13}/>} tone={dashboard.unpaid_count ? "warning" : "neutral"}/>
        <OpsMetric label="Paid bills" value={dashboard.paid_count} icon={<Banknote size={13}/>} tone="success"/>
        <OpsMetric label="Draft bills" value={dashboard.draft_count} icon={<WalletCards size={13}/>} />
      </OpsMetricStrip>

      {notice ? <div className="rounded-lg border border-[#ecd8da] bg-[#fbf3f4] px-3.5 py-2.5 text-[11px] text-[#8d4b53]">{notice}</div> : null}

      {createOpen ? <OpsPanel title="New supplier bill" eyebrow="Create payable" description="Link a shipment to make this bill part of the Digital Job File cost and profitability trail after approval.">
        <form onSubmit={createBill} className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Shipment reference"><input className="h-10 w-full px-3" value={form.shipmentReference} onChange={(event) => setForm({ ...form, shipmentReference: event.target.value })} placeholder="KCPL-S-..."/></Field>
          <Field label="Supplier CRM reference"><input className="h-10 w-full px-3" value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })} placeholder="Optional KCPL-C-..."/></Field>
          <Field label="Supplier / carrier name"><input className="h-10 w-full px-3" value={form.supplierName} onChange={(event) => setForm({ ...form, supplierName: event.target.value })} placeholder="Carrier, agent, transporter…"/></Field>
          <Field label="Supplier bill reference"><input className="h-10 w-full px-3" value={form.supplierBillReference} onChange={(event) => setForm({ ...form, supplierBillReference: event.target.value })} placeholder="Vendor invoice / bill no."/></Field>
          <Field label="Bill date"><input required type="date" className="h-10 w-full px-3" value={form.billDate} onChange={(event) => setForm({ ...form, billDate: event.target.value })}/></Field>
          <Field label="Due date"><input type="date" className="h-10 w-full px-3" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></Field>
          <Field label="Cost category"><select className="h-10 w-full px-3" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as JobCostCategory })}>{jobCostCategories.map((item) => <option key={item} value={item}>{jobCostCategoryLabels[item]}</option>)}</select></Field>
          <Field label="Currency"><select className="h-10 w-full px-3" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
          <Field label="Amount before tax"><input required min="0.01" step="0.01" type="number" className="h-10 w-full px-3" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></Field>
          <Field label="Tax %"><input min="0" max="100" step="0.01" type="number" className="h-10 w-full px-3" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></Field>
          <div className="md:col-span-2"><Field label="Description"><input className="h-10 w-full px-3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></Field></div>
          <div className="md:col-span-2 xl:col-span-4"><Field label="Notes"><textarea className="min-h-20 w-full resize-y px-3 py-2.5" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></Field></div>
          <div className="md:col-span-2 xl:col-span-4 flex justify-end"><OpsButton tone="primary" disabled={busy} type="submit">{busy ? "Creating…" : "Create bill draft"}</OpsButton></div>
        </form>
      </OpsPanel> : null}

      {dashboard.currency_summaries.length ? <div className="grid gap-3 xl:grid-cols-2">{dashboard.currency_summaries.map((summary) => <OpsPanel key={summary.currency} title={`${summary.currency} payables`} eyebrow="Currency exposure" action={<strong className="text-sm font-semibold text-[#30363d]">{money(summary.outstanding, summary.currency)} outstanding</strong>}><div className="grid gap-px bg-[#eceef0] sm:grid-cols-4"><Mini label="Billed" value={money(summary.billed, summary.currency)}/><Mini label="Paid" value={money(summary.paid, summary.currency)}/><Mini label="Outstanding" value={money(summary.outstanding, summary.currency)}/><Mini label="Overdue" value={money(summary.overdue, summary.currency)} warn={summary.overdue > 0}/></div><div className="grid gap-px border-t border-[#eceef0] bg-[#eceef0] sm:grid-cols-4"><Age label="0–30 days" value={summary.aging_0_30} currency={summary.currency}/><Age label="31–60" value={summary.aging_31_60} currency={summary.currency}/><Age label="61–90" value={summary.aging_61_90} currency={summary.currency}/><Age label="90+" value={summary.aging_90_plus} currency={summary.currency}/></div></OpsPanel>)}</div> : null}

      <OpsTableFrame toolbar={<OpsFilterBar count={<><strong className="font-semibold text-[#353b42]">{filtered.length}</strong> of {dashboard.bills.length}</>} reset={filtersActive ? <button type="button" onClick={() => { setQuery(""); setStatus("all"); }} className="inline-flex items-center gap-1 text-[#5968bb] hover:underline"><X size={11}/>Clear</button> : null}><label className="ops-search-field flex-1 lg:max-w-[470px]"><Search size={13} className="text-[#8e959c]"/><span className="sr-only">Search supplier bills</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search supplier, bill, shipment or branch"/></label><label className="ops-filter-control"><WalletCards size={13}/><span className="sr-only">Payable status</span><select value={status} onChange={(event) => setStatus(event.target.value as "all" | PayableStatus)}><option value="all">All statuses</option>{payableStatuses.map((item) => <option key={item} value={item}>{payableStatusLabels[item]}</option>)}</select></label></OpsFilterBar>}>
        <table className="ops-dense-table min-w-[1100px] text-left"><thead><tr><th className="px-4">Bill</th><th className="px-3">Supplier</th><th className="px-3">Shipment / branch</th><th className="px-3">Bill / due</th><th className="px-3">Total</th><th className="px-3">Balance</th><th className="px-3">Status</th></tr></thead><tbody>{filtered.length ? filtered.map((bill) => <tr key={bill.reference}><td className="px-4"><Link href={`/admin/payables/bills/${encodeURIComponent(bill.reference)}`} className="ops-row-link">{bill.reference}</Link><p className="mt-0.5 text-[9px] text-[#9aa0a7]">{bill.supplier_bill_reference || "No vendor ref"}</p></td><td className="px-3"><strong className="font-medium text-[#414850]">{bill.supplier_name}</strong><p className="mt-0.5 text-[9px] text-[#9aa0a7]">{jobCostCategoryLabels[bill.category]}</p></td><td className="px-3"><span>{bill.shipment_reference || "General payable"}</span><p className="mt-0.5 flex items-center gap-1 text-[9px] text-[#939aa1]"><BriefcaseBusiness size={9}/>{bill.branch}</p></td><td className="px-3"><span>{dateLabel(bill.bill_date)}</span><p className={`mt-0.5 text-[9px] ${bill.status === "overdue" ? "font-semibold text-[#9f5059]" : "text-[#939aa1]"}`}>Due {dateLabel(bill.due_date)}</p></td><td className="px-3 font-semibold">{money(bill.total, bill.currency)}</td><td className="px-3 font-semibold">{money(bill.balance_due, bill.currency)}</td><td className="px-3"><OpsStatusBadge tone={statusTone(bill.status)}>{payableStatusLabels[bill.status]}</OpsStatusBadge></td></tr>) : <tr><td colSpan={7}><OpsEmptyState title="No supplier bills match this view" detail="Clear the current filters or create a new supplier bill."/></td></tr>}</tbody></table>
      </OpsTableFrame>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-[#606871]">{label}</span>{children}</label>; }
function Mini({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) { return <div className="bg-white p-3"><p className="text-[9px] font-medium uppercase tracking-[.06em] text-[#8a929a]">{label}</p><p className={`mt-1 text-[12px] font-semibold ${warn ? "text-[#9f5059]" : "text-[#373e45]"}`}>{value}</p></div>; }
function Age({ label, value, currency }: { label: string; value: number; currency: string }) { return <div className="bg-[#fafafa] p-3"><p className="text-[9px] font-medium uppercase tracking-[.06em] text-[#8a929a]">{label}</p><p className={`mt-1 text-[11px] font-semibold ${value ? "text-[#8b6938]" : "text-[#9aa0a7]"}`}>{money(value, currency)}</p></div>; }
