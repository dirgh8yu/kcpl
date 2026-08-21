"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, BriefcaseBusiness, Clock3, FilePlus2, Landmark, TriangleAlert, WalletCards } from "lucide-react";
import { crmCurrencies, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { jobCostCategories, jobCostCategoryLabels, type JobCostCategory } from "../job-file";
import type { PartnerOption } from "../partners/partners-data";
import { payableStatusLabels, payableStatuses, type PayablesDashboard, type PayableStatus } from "./payables-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsProgress, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function nepalToday() {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + Math.max(0, days));
  return date.toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function statusTone(status: PayableStatus): "neutral" | "info" | "violet" | "success" | "danger" {
  if (status === "approved") return "info";
  if (status === "partially_paid") return "violet";
  if (status === "paid") return "success";
  if (status === "overdue") return "danger";
  return "neutral";
}

type PayableForm = {
  shipmentReference: string;
  supplierId: string;
  supplierName: string;
  supplierBillReference: string;
  branch: KcplBranch;
  billDate: string;
  dueDate: string;
  currency: CrmCurrency;
  category: JobCostCategory;
  description: string;
  amount: string;
  taxRate: string;
  notes: string;
};

export function PayablesWorkspace({ dashboard, roleLabel, initialShipment = "", initialPartner = "", initialCreate = false, partnerOptions, branchOptions, defaultBranch }: {
  dashboard: PayablesDashboard;
  roleLabel: string;
  initialShipment?: string;
  initialPartner?: string;
  initialCreate?: boolean;
  partnerOptions: PartnerOption[];
  branchOptions: KcplBranch[];
  defaultBranch: KcplBranch;
}) {
  const router = useRouter();
  const today = nepalToday();
  const initialPartnerRecord = partnerOptions.find((partner) => partner.id === initialPartner);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | PayableStatus>("all");
  const [createOpen, setCreateOpen] = useState(Boolean(initialCreate || initialShipment || initialPartner));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<PayableForm>(() => ({
    shipmentReference: initialShipment,
    supplierId: initialPartnerRecord?.id ?? "",
    supplierName: initialPartnerRecord?.name ?? "",
    supplierBillReference: "",
    branch: defaultBranch,
    billDate: today,
    dueDate: initialPartnerRecord ? addDays(today, initialPartnerRecord.payment_terms_days) : "",
    currency: initialPartnerRecord?.currency ?? "NPR",
    category: "freight",
    description: "Freight / logistics supplier cost",
    amount: "",
    taxRate: "0",
    notes: "",
  }));

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return dashboard.bills.filter((bill) => {
      if (status !== "all" && bill.status !== status) return false;
      if (!terms.length) return true;
      const haystack = [
        bill.reference,
        bill.record_type,
        bill.supplier_id ?? "",
        bill.supplier_name,
        bill.supplier_bill_reference ?? "",
        bill.shipment_reference ?? "",
        bill.branch,
        bill.currency,
        bill.description,
        jobCostCategoryLabels[bill.category],
        bill.migration_batch_id ?? "",
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [dashboard.bills, query, status]);

  function choosePartner(partnerId: string) {
    const partner = partnerOptions.find((item) => item.id === partnerId);
    if (!partner) {
      setForm((current) => ({ ...current, supplierId: "", supplierName: "" }));
      return;
    }
    setForm((current) => ({
      ...current,
      supplierId: partner.id,
      supplierName: partner.name,
      currency: partner.currency,
      dueDate: current.billDate ? addDays(current.billDate, partner.payment_terms_days) : current.dueDate,
    }));
  }

  function changeBillDate(billDate: string) {
    const partner = partnerOptions.find((item) => item.id === form.supplierId);
    setForm((current) => ({
      ...current,
      billDate,
      dueDate: partner && billDate ? addDays(billDate, partner.payment_terms_days) : current.dueDate,
    }));
  }

  async function createBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/payables/bills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount), taxRate: Number(form.taxRate) }),
      });
      const data = await response.json() as { reference?: string; error?: string; existingReference?: string };
      if (!response.ok || !data.reference) throw new Error(data.error || "Supplier bill could not be created.");
      router.push(`/admin/payables/bills/${encodeURIComponent(data.reference)}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Supplier bill could not be created."); }
    finally { setBusy(false); }
  }

  return <OpsPage>
    <OpsPageHeader eyebrow="Finance" title="Accounts Payable" description="Supplier bills, opening payables, payment aging and job-linked costs. Real supplier bills can feed shipment cost; migration opening balances stay ledger-only so historical debt does not become fictional job spend." meta={<><span>{roleLabel}</span><span>{dashboard.bills.length} payable records</span></>} actions={<><Link href="/admin/finance" className="ops-button" data-variant="secondary" data-size="md">Receivables</Link><OpsButton variant="primary" onClick={() => setCreateOpen((value) => !value)}><FilePlus2 size={13}/>{createOpen ? "Close form" : "New supplier bill"}</OpsButton></>}/>
    <OpsStatStrip>
      <OpsStat label="Overdue" value={dashboard.overdue_count} icon={<TriangleAlert size={13}/>} tone={dashboard.overdue_count ? "danger" : "neutral"} active={status === "overdue"} onClick={() => setStatus(status === "overdue" ? "all" : "overdue")}/>
      <OpsStat label="Open payables" value={dashboard.unpaid_count} icon={<Clock3 size={13}/>} />
      <OpsStat label="Opening balances" value={dashboard.opening_balance_count} icon={<Landmark size={13}/>} />
      <OpsStat label="Paid" value={dashboard.paid_count} icon={<Banknote size={13}/>} tone="success" active={status === "paid"} onClick={() => setStatus(status === "paid" ? "all" : "paid")}/>
      <OpsStat label="Drafts" value={dashboard.draft_count} icon={<WalletCards size={13}/>} active={status === "draft"} onClick={() => setStatus(status === "draft" ? "all" : "draft")}/>
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone="danger" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      {createOpen ? <OpsSurface eyebrow="Create payable" title="New supplier bill" description="Choose a Partner whenever the supplier is already registered. Leave Partner blank only for a genuinely unregistered supplier. Shipment-linked bills inherit the shipment branch automatically.">
        <form onSubmit={createBill} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OpsField label="Shipment reference" hint="Optional. When supplied, the shipment determines the payable branch."><input value={form.shipmentReference} onChange={(event) => setForm({ ...form, shipmentReference: event.target.value })} placeholder="KCPL-S-..."/></OpsField>
          <OpsField label="Registered Partner"><select value={form.supplierId} onChange={(event) => choosePartner(event.target.value)}><option value="">Unregistered supplier</option>{partnerOptions.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}{partner.owner_branch ? ` · ${partner.owner_branch}` : ""}</option>)}</select></OpsField>
          <OpsField label={form.supplierId ? "Supplier name" : "Unregistered supplier name"} hint={form.supplierId ? "Filled from the Partner registry." : "Use only when the supplier has not been registered yet."}><input required={!form.supplierId} disabled={Boolean(form.supplierId)} value={form.supplierName} onChange={(event) => setForm({ ...form, supplierName: event.target.value })} placeholder="Carrier, agent, transporter…"/></OpsField>
          <OpsField label="Supplier bill reference" hint="Duplicate references for the same supplier are blocked."><input value={form.supplierBillReference} onChange={(event) => setForm({ ...form, supplierBillReference: event.target.value })} placeholder="Vendor invoice / bill no."/></OpsField>
          <OpsField label="KCPL branch" hint={form.shipmentReference ? "Shipment branch overrides this selection." : "Required for general payables."}><select disabled={Boolean(form.shipmentReference)} value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value as KcplBranch })}>{branchOptions.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></OpsField>
          <OpsField label="Bill date"><input required type="date" value={form.billDate} onChange={(event) => changeBillDate(event.target.value)}/></OpsField>
          <OpsField label="Due date" hint={form.supplierId ? "Defaults from the Partner payment terms; you can override it." : "Defaults to 30 days when left blank."}><input type="date" value={form.dueDate} min={form.billDate || undefined} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></OpsField>
          <OpsField label="Cost category"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as JobCostCategory })}>{jobCostCategories.map((item) => <option key={item} value={item}>{jobCostCategoryLabels[item]}</option>)}</select></OpsField>
          <OpsField label="Currency"><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></OpsField>
          <OpsField label="Amount before tax"><input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></OpsField>
          <OpsField label="Tax %"><input min="0" max="100" step="0.01" type="number" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></OpsField>
          <OpsField label="Description" className="md:col-span-2"><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></OpsField>
          <OpsField label="Notes" className="md:col-span-2 xl:col-span-4"><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></OpsField>
          <div className="flex gap-2 md:col-span-2 xl:col-span-4"><OpsButton variant="primary" disabled={busy}>{busy ? "Creating…" : "Create bill draft"}</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</OpsButton></div>
        </form>
      </OpsSurface> : null}

      {dashboard.currency_summaries.length ? <div className="grid gap-3 xl:grid-cols-2">{dashboard.currency_summaries.map((summary) => <OpsSurface key={summary.currency} eyebrow={`${summary.currency} payables`} title={`${money(summary.outstanding, summary.currency)} outstanding`} description={`${summary.bill_count} supplier bills and ${summary.opening_balance_count} opening balance records in this currency.`}><div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><Mini label="Billed" value={money(summary.billed, summary.currency)}/><Mini label="Opening" value={money(summary.opening_balance, summary.currency)}/><Mini label="Paid" value={money(summary.paid, summary.currency)} tone="success"/><Mini label="Outstanding" value={money(summary.outstanding, summary.currency)}/><Mini label="Overdue" value={money(summary.overdue, summary.currency)} tone={summary.overdue > 0 ? "danger" : "neutral"}/></div><div className="mt-4 grid grid-cols-4 gap-2"><Age label="0–30" value={summary.aging_0_30} total={summary.outstanding} currency={summary.currency}/><Age label="31–60" value={summary.aging_31_60} total={summary.outstanding} currency={summary.currency}/><Age label="61–90" value={summary.aging_61_90} total={summary.outstanding} currency={summary.currency}/><Age label="90+" value={summary.aging_90_plus} total={summary.outstanding} currency={summary.currency} danger={summary.aging_90_plus > 0}/></div></OpsSurface>)}</div> : null}

      <OpsSurface eyebrow="Payables register" title="Supplier payable ledger" description={`${filtered.length} of ${dashboard.bills.length} payable records shown.`} flush>
        <div className="ops-toolbar"><OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search partner, bill, opening balance, shipment, branch or reference"/><select className="ops-select" value={status} onChange={(event) => setStatus(event.target.value as "all" | PayableStatus)}><option value="all">All statuses</option>{payableStatuses.map((item) => <option key={item} value={item}>{payableStatusLabels[item]}</option>)}</select><OpsButton variant="ghost" size="sm" onClick={() => { setQuery(""); setStatus("all"); }}>Reset</OpsButton></div>
        <div className="ops-table-wrap"><table className="ops-table min-w-[1100px]"><thead><tr><th>Payable</th><th>Supplier</th><th>Job / branch</th><th>Bill / due</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead><tbody>{filtered.length ? filtered.map((bill) => <tr key={bill.reference}><td><Link href={`/admin/payables/bills/${encodeURIComponent(bill.reference)}`}><OpsMono>{bill.reference}</OpsMono></Link><div className="mt-1.5 flex flex-wrap items-center gap-1.5">{bill.record_type === "opening_balance" ? <OpsBadge tone="violet">Opening balance</OpsBadge> : null}<span className="text-[10px] text-[#8d837b]">{bill.record_type === "opening_balance" ? `As at ${bill.migration_as_of_date ? dateLabel(bill.migration_as_of_date) : dateLabel(bill.bill_date)}` : bill.supplier_bill_reference || "No vendor reference"}</span></div></td><td><strong>{bill.supplier_name}</strong><p className="mt-1.5 text-[10px] text-[#8d837b]">{bill.supplier_id || "Unregistered supplier"}{bill.record_type === "opening_balance" ? " · Ledger opening" : ` · ${jobCostCategoryLabels[bill.category]}`}</p></td><td><span>{bill.shipment_reference ? <OpsMono>{bill.shipment_reference}</OpsMono> : bill.record_type === "opening_balance" ? "Ledger only" : "General payable"}</span><p className="mt-1.5 flex items-center gap-1 text-[10px] text-[#8d837b]"><BriefcaseBusiness size={10}/>{bill.branch}</p></td><td><span>{bill.record_type === "opening_balance" ? "Opening balance" : dateLabel(bill.bill_date)}</span><p className={`mt-1.5 text-[10px] ${bill.status === "overdue" ? "font-bold text-[#b65355]" : "text-[#8d837b]"}`}>Due {dateLabel(bill.due_date)}</p></td><td className="font-bold text-[#514840]">{bill.record_type === "opening_balance" ? <span className="text-[#8d837b]">Opening</span> : money(bill.total, bill.currency)}</td><td className="font-bold text-[#514840]">{money(bill.balance_due, bill.currency)}</td><td><OpsBadge tone={statusTone(bill.status)} dot>{payableStatusLabels[bill.status]}</OpsBadge></td></tr>) : <tr><td colSpan={7}><OpsEmptyState title="No supplier payables match" description="Change the filters or create a new payable."/></td></tr>}</tbody></table></div>
      </OpsSurface>
    </div>
  </OpsPage>;
}

function Mini({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" }) { return <div className="rounded-[12px] border border-[#ebe3dc] bg-[#faf7f4] p-3"><p className="text-[10px] font-bold uppercase tracking-[.06em] text-[#8d837b]">{label}</p><strong className={`mt-1.5 block text-[11px] ${tone === "success" ? "text-[#66806b]" : tone === "danger" ? "text-[#b65355]" : "text-[#514840]"}`}>{value}</strong></div>; }
function Age({ label, value, total, currency, danger = false }: { label: string; value: number; total: number; currency: string; danger?: boolean }) { return <div><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-[#817970]">{label}</span><span className={`text-[10px] font-semibold ${danger ? "text-[#b65355]" : "text-[#817970]"}`}>{money(value, currency)}</span></div><div className="mt-2"><OpsProgress value={value} max={Math.max(total, 1)} tone={danger ? "danger" : value > 0 ? "warning" : "accent"}/></div></div>; }
