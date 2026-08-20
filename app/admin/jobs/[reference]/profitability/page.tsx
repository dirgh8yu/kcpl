import Link from "next/link";
import { BadgeDollarSign, FileText, Landmark, TrendingUp, WalletCards } from "lucide-react";
import { getAdminAccess } from "../../../admin-auth";
import { getDigitalJobFile } from "../../../job-file.server";
import { jobCostCategoryLabels } from "../../../job-file";
import { OperationsShell } from "../../../operations-shell";
import { OpsButton, OpsEmptyState, OpsMetric, OpsMetricStrip, OpsPageHeader, OpsPanel, OpsStatusBadge, OpsTableFrame } from "../../../operations-ui";
import { listPayablesDashboard } from "../../../payables/payables.server";
import { payableStatusLabels } from "../../../payables/payables-data";
import { getStaffContext } from "../../../staff-directory.server";
import { kcplStaffRoleLabels } from "../../../staff-permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job Profitability | KCPL", robots: { index: false, follow: false } };

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

export default async function JobProfitabilityPage({ params }: { params: Promise<{ reference: string }> }) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return <Gate title="Sign in required" detail="Job profitability is available only to authorised KCPL staff."/>;
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageJobCosts) return <Gate title="Profitability is restricted" detail="Your role can operate shipments, but commercial job-cost data is withheld."/>;
  const { reference } = await params;
  const result = await getDigitalJobFile(reference, staff);
  if (result.kind === "unavailable") return <Gate title="Profitability unavailable" detail="Firestore is unavailable for this deployment."/>;
  if (result.kind === "missing") return <Gate title="Shipment not found" detail="This shipment reference does not exist."/>;
  if (result.kind === "forbidden") return <Gate title="Outside your branch access" detail="This shipment belongs to a branch outside your staff profile."/>;

  const job = result.job;
  const payablesDashboard = staff.permissions.canManageFinance ? await listPayablesDashboard(staff) : null;
  const bills = payablesDashboard?.bills.filter((bill) => bill.shipment_reference === job.reference) ?? [];
  const currencies = [...new Set([...Object.keys(job.revenue_totals), ...Object.keys(job.cost_totals)])].sort();
  const roleLabel = kcplStaffRoleLabels[staff.permissions.role];

  return <OperationsShell userName={access.user.displayName} roleLabel={roleLabel} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}>
    <main>
      <OpsPageHeader
        eyebrow="Commercial control"
        title="Job Profitability"
        description={`${job.reference} · ${job.origin || "Origin"} → ${job.destination || "Destination"}`}
        breadcrumbs={[{ label: "Operations" }, { label: "Shipments", href: "/admin/shipments" }, { label: job.reference, href: `/admin/jobs/${encodeURIComponent(job.reference)}` }, { label: "Profitability" }]}
        meta={<span>{job.customer_name || "Customer not linked"} · {job.primary_branch}</span>}
        actions={<><OpsButton href={`/admin/jobs/${encodeURIComponent(job.reference)}`}>Digital Job File</OpsButton>{staff.permissions.canManageFinance ? <OpsButton href={`/admin/payables?shipment=${encodeURIComponent(job.reference)}`} tone="primary">Add supplier bill</OpsButton> : null}</>}
      />

      <div className="ops-page-body ops-stack">
        <OpsMetricStrip columns={4}>
          <OpsMetric label="Customer" value={<span className="text-[15px]">{job.customer_name || "Not linked"}</span>} icon={<BadgeDollarSign size={13}/>}/>
          <OpsMetric label="Branch" value={<span className="text-[15px]">{job.primary_branch}</span>} icon={<Landmark size={13}/>}/>
          <OpsMetric label="Revenue currencies" value={Object.keys(job.revenue_totals).length} icon={<TrendingUp size={13}/>}/>
          <OpsMetric label="Recognised costs" value={job.costs.length} icon={<WalletCards size={13}/>}/>
        </OpsMetricStrip>

        <OpsPanel title="Revenue → Cost → Gross profit" eyebrow="Commercial result" description="No automatic FX conversion is applied. Profit and margin stay separated by currency.">
          {currencies.length ? <div className="grid gap-px bg-[#eceef0] md:grid-cols-2">{currencies.map((currency) => {
            const revenue = job.revenue_totals[currency as keyof typeof job.revenue_totals] ?? 0;
            const cost = job.cost_totals[currency as keyof typeof job.cost_totals] ?? 0;
            const profit = job.profit_totals[currency as keyof typeof job.profit_totals] ?? revenue - cost;
            const margin = job.margin_percent[currency as keyof typeof job.margin_percent];
            return <div key={currency} className="bg-white p-4"><div className="flex items-center justify-between gap-3"><strong className="text-xs font-semibold text-[#30363d]">{currency}</strong><OpsStatusBadge tone={profit >= 0 ? "success" : "danger"}>{margin === undefined ? "Margin N/A" : `${margin.toFixed(2)}% margin`}</OpsStatusBadge></div><div className="mt-3 grid grid-cols-3 gap-2"><MoneyCell label="Revenue" value={money(revenue, currency)}/><MoneyCell label="Cost" value={money(cost, currency)}/><MoneyCell label="Gross profit" value={money(profit, currency)} positive={profit >= 0}/></div></div>;
          })}</div> : <OpsEmptyState compact title="No financial result yet" detail="No invoiced revenue or recognised job costs have been recorded."/>}
        </OpsPanel>

        <div className="ops-grid-even">
          <OpsTableFrame toolbar={<div><h2 className="text-xs font-semibold text-[#30363d]">Recognised job costs</h2><p className="mt-0.5 text-[10px] text-[#8c939b]">Manual Job File costs and approved supplier bills.</p></div>}>
            {job.costs.length ? <table className="ops-dense-table min-w-[700px]"><thead><tr><th className="px-4 text-left">Cost</th><th className="px-3 text-left">Category</th><th className="px-3 text-left">Vendor</th><th className="px-3 text-left">Source</th><th className="px-4 text-right">Amount</th></tr></thead><tbody>{job.costs.map((cost) => <tr key={cost.id}><td className="px-4"><strong className="font-medium">{cost.label}</strong></td><td className="px-3">{jobCostCategoryLabels[cost.category]}</td><td className="px-3">{cost.vendor || "—"}</td><td className="px-3">{cost.source_type === "payable" && cost.source_reference ? <Link href={`/admin/payables/bills/${encodeURIComponent(cost.source_reference)}`} className="inline-flex items-center gap-1 font-medium text-[#5367a8]"><FileText size={10}/>{cost.source_reference}</Link> : <OpsStatusBadge>Manual</OpsStatusBadge>}</td><td className="px-4 text-right font-medium">{money(cost.amount, cost.currency)}</td></tr>)}</tbody></table> : <OpsEmptyState compact title="No recognised costs" detail="Add a Job File cost or approve a linked supplier bill."/>}
          </OpsTableFrame>

          <OpsTableFrame toolbar={<div><h2 className="text-xs font-semibold text-[#30363d]">Supplier bills for this job</h2><p className="mt-0.5 text-[10px] text-[#8c939b]">Accounts Payable records linked to this shipment.</p></div>}>
            {staff.permissions.canManageFinance ? bills.length ? <table className="ops-dense-table min-w-[650px]"><thead><tr><th className="px-4 text-left">Supplier</th><th className="px-3 text-left">Bill</th><th className="px-3 text-left">Status</th><th className="px-3 text-right">Total</th><th className="px-4 text-right">Due</th></tr></thead><tbody>{bills.map((bill) => <tr key={bill.reference}><td className="px-4 font-medium">{bill.supplier_name}</td><td className="px-3"><Link href={`/admin/payables/bills/${encodeURIComponent(bill.reference)}`} className="ops-row-link">{bill.reference}</Link></td><td className="px-3"><OpsStatusBadge tone={bill.status === "overdue" ? "danger" : bill.status === "paid" ? "success" : "neutral"}>{payableStatusLabels[bill.status]}</OpsStatusBadge></td><td className="px-3 text-right">{money(bill.total, bill.currency)}</td><td className="px-4 text-right font-medium">{money(bill.balance_due, bill.currency)}</td></tr>)}</tbody></table> : <OpsEmptyState compact title="No supplier bills linked" detail="Add a supplier bill from Accounts Payable when vendor costs arrive."/> : <OpsEmptyState compact title="Supplier payments restricted" detail="Payment details are available only to Management and Accounts."/>}
          </OpsTableFrame>
        </div>
      </div>
    </main>
  </OperationsShell>;
}

function MoneyCell({ label, value, positive }: { label: string; value: string; positive?: boolean }) { return <div className="rounded-md bg-[#f7f8f9] p-2.5"><p className="text-[9px] text-[#9299a0]">{label}</p><p className={`mt-1 truncate text-[11px] font-semibold ${positive === false ? "text-[#9a4d55]" : positive === true ? "text-[#397052]" : "text-[#414850]"}`}>{value}</p></div>; }
function Gate({ title, detail }: { title: string; detail: string }) { return <main className="grid min-h-screen place-items-center bg-[#f7f7f5] p-6 text-[#1c2025]"><section className="w-full max-w-xl rounded-xl border border-[#e2e5e8] bg-white p-8"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#717a86]">KCPL Job Profitability</p><h1 className="mt-3 text-2xl font-semibold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#68717a]">{detail}</p><Link href="/admin/shipments" className="ops-button ops-button-primary mt-6">Shipments</Link></section></main>; }
