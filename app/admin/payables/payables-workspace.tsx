"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, BriefcaseBusiness, Clock3, FilePlus2, TriangleAlert, WalletCards } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { jobCostCategories, jobCostCategoryLabels, type JobCostCategory } from "../job-file";
import { payableStatusLabels, payableStatuses, type PayablesDashboard, type PayableStatus } from "./payables-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsProgress, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
function statusTone(status: PayableStatus): "neutral" | "info" | "violet" | "success" | "danger" { if (status === "approved") return "info"; if (status === "partially_paid") return "violet"; if (status === "paid") return "success"; if (status === "overdue") return "danger"; return "neutral"; }

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
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/payables/bills", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, amount: Number(form.amount), taxRate: Number(form.taxRate) }) });
      const data = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !data.reference) throw new Error(data.error || "Supplier bill could not be created.");
      router.push(`/admin/payables/bills/${encodeURIComponent(data.reference)}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Supplier bill could not be created."); }
    finally { setBusy(false); }
  }

  return <OpsPage>
    <OpsPageHeader eyebrow="Finance" title="Accounts Payable" description="Supplier bills, payment aging and job-linked costs without leaving the KCPL operations language. Approved shipment bills feed the Job File cost trail." meta={<><span>{roleLabel}</span><span>{dashboard.bills.length} bills</span></>} actions={<><Link href="/admin/finance" className="ops-button" data-variant="secondary" data-size="md">Receivables</Link><OpsButton variant="primary" onClick={() => setCreateOpen((value) => !value)}><FilePlus2 size={13}/>{createOpen ? "Close form" : "New supplier bill"}</OpsButton></>}/>
    <OpsStatStrip>
      <OpsStat label="Overdue" value={dashboard.overdue_count} icon={<TriangleAlert size={13}/>} tone={dashboard.overdue_count ? "danger" : "neutral"} active={status === "overdue"} onClick={() => setStatus(status === "overdue" ? "all" : "overdue")}/>
      <OpsStat label="Open payables" value={dashboard.unpaid_count} icon={<Clock3 size={13}/>} />
      <OpsStat label="Paid" value={dashboard.paid_count} icon={<Banknote size={13}/>} tone="success" active={status === "paid"} onClick={() => setStatus(status === "paid" ? "all" : "paid")}/>
      <OpsStat label="Drafts" value={dashboard.draft_count} icon={<WalletCards size={13}/>} active={status === "draft"} onClick={() => setStatus(status === "draft" ? "all" : "draft")}/>
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone="danger" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      {createOpen ? <OpsSurface eyebrow="Create payable" title="New supplier bill" description="Link the shipment where possible so the approved bill becomes part of the freight job’s true cost and profitability trail."><form onSubmit={createBill} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><OpsField label="Shipment reference"><input value={form.shipmentReference} onChange={(event) => setForm({ ...form, shipmentReference: event.target.value })} placeholder="KCPL-S-..."/></OpsField><OpsField label="Supplier CRM reference"><input value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })} placeholder="Optional KCPL-C-..."/></OpsField><OpsField label="Supplier / carrier name"><input value={form.supplierName} onChange={(event) => setForm({ ...form, supplierName: event.target.value })} placeholder="Carrier, agent, transporter…"/></OpsField><OpsField label="Supplier bill reference"><input value={form.supplierBillReference} onChange={(event) => setForm({ ...form, supplierBillReference: event.target.value })} placeholder="Vendor invoice / bill no."/></OpsField><OpsField label="Bill date"><input required type="date" value={form.billDate} onChange={(event) => setForm({ ...form, billDate: event.target.value })}/></OpsField><OpsField label="Due date"><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></OpsField><OpsField label="Cost category"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as JobCostCategory })}>{jobCostCategories.map((item) => <option key={item} value={item}>{jobCostCategoryLabels[item]}</option>)}</select></OpsField><OpsField label="Currency"><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></OpsField><OpsField label="Amount before tax"><input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></OpsField><OpsField label="Tax %"><input min="0" max="100" step="0.01" type="number" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></OpsField><OpsField label="Description" className="md:col-span-2"><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></OpsField><OpsField label="Notes" className="md:col-span-2 xl:col-span-4"><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></OpsField><div className="flex gap-2 md:col-span-2 xl:col-span-4"><OpsButton variant="primary" disabled={busy}>{busy ? "Creating…" : "Create bill draft"}</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</OpsButton></div></form></OpsSurface> : null}

      {dashboard.currency_summaries.length ? <div className="grid gap-3 xl:grid-cols-2">{dashboard.currency_summaries.map((summary) => <OpsSurface key={summary.currency} eyebrow={`${summary.currency} payables`} title={`${money(summary.outstanding, summary.currency)} outstanding`} description={`${summary.bill_count} supplier bills in this currency.`}><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Mini label="Billed" value={money(summary.billed, summary.currency)}/><Mini label="Paid" value={money(summary.paid, summary.currency)} tone="success"/><Mini label="Outstanding" value={money(summary.outstanding, summary.currency)}/><Mini label="Overdue" value={money(summary.overdue, summary.currency)} tone={summary.overdue > 0 ? "danger" : "neutral"}/></div><div className="mt-4 grid grid-cols-4 gap-2"><Age label="0–30" value={summary.aging_0_30} total={summary.outstanding} currency={summary.currency}/><Age label="31–60" value={summary.aging_31_60} total={summary.outstanding} currency={summary.currency}/><Age label="61–90" value={summary.aging_61_90} total={summary.outstanding} currency={summary.currency}/><Age label="90+" value={summary.aging_90_plus} total={summary.outstanding} currency={summary.currency} danger={summary.aging_90_plus > 0}/></div></OpsSurface>)}</div> : null}

      <OpsSurface eyebrow="Payables register" title="Supplier bill ledger" description={`${filtered.length} of ${dashboard.bills.length} bills shown.`} flush>
        <div className="ops-toolbar"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search supplier, bill, shipment or branch"/><select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as "all" | PayableStatus)}><option value="all">All statuses</option>{payableStatuses.map((item) => <option key={item} value={item}>{payableStatusLabels[item]}</option>)}</select><OpsButton variant="ghost" size="sm" onClick={() => { setQuery(""); setStatus("all"); }}>Reset</OpsButton></div>
        <div className="ops-table-wrap"><table className="ops-table min-w-[1100px]"><thead><tr><th>Bill</th><th>Supplier</th><th>Job / branch</th><th>Bill / due</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead><tbody>{filtered.length ? filtered.map((bill) => <tr key={bill.reference}><td><Link href={`/admin/payables/bills/${encodeURIComponent(bill.reference)}`}><OpsMono>{bill.reference}</OpsMono></Link><p className="mt-1 text-[8px] text-[#9c928a]">{bill.supplier_bill_reference || "No vendor ref"}</p></td><td><strong>{bill.supplier_name}</strong><p className="mt-1 text-[8px] text-[#9c928a]">{jobCostCategoryLabels[bill.category]}</p></td><td><span>{bill.shipment_reference ? <OpsMono>{bill.shipment_reference}</OpsMono> : "General payable"}</span><p className="mt-1 flex items-center gap-1 text-[8px] text-[#9c928a]"><BriefcaseBusiness size={9}/>{bill.branch}</p></td><td><span>{dateLabel(bill.bill_date)}</span><p className={`mt-1 text-[8px] ${bill.status === "overdue" ? "font-bold text-[#b65355]" : "text-[#9c928a]"}`}>Due {dateLabel(bill.due_date)}</p></td><td className="font-bold text-[#514840]">{money(bill.total, bill.currency)}</td><td className="font-bold text-[#514840]">{money(bill.balance_due, bill.currency)}</td><td><OpsBadge tone={statusTone(bill.status)} dot>{payableStatusLabels[bill.status]}</OpsBadge></td></tr>) : <tr><td colSpan={7}><OpsEmptyState title="No supplier bills match" description="Change the filters or create a new payable."/></td></tr>}</tbody></table></div>
      </OpsSurface>
    </div>
  </OpsPage>;
}

function Mini({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" }) { return <div className="rounded-[12px] border border-[#ebe3dc] bg-[#faf7f4] p-3"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#9b9189]">{label}</p><strong className={`mt-1.5 block text-[10px] ${tone === "success" ? "text-[#66806b]" : tone === "danger" ? "text-[#b65355]" : "text-[#514840]"}`}>{value}</strong></div>; }
function Age({ label, value, total, currency, danger = false }: { label: string; value: number; total: number; currency: string; danger?: boolean }) { return <div><div className="flex items-center justify-between gap-2"><span className="text-[8px] font-bold text-[#8e847c]">{label}</span><span className={`text-[8px] font-semibold ${danger ? "text-[#b65355]" : "text-[#8e847c]"}`}>{money(value, currency)}</span></div><div className="mt-2"><OpsProgress value={value} max={Math.max(total, 1)} tone={danger ? "danger" : value > 0 ? "warning" : "accent"}/></div></div>; }
