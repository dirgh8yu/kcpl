import Link from "next/link";
import { FileText, Landmark, WalletCards } from "lucide-react";
import { getAdminAccess } from "../../../admin-auth";
import { getDigitalJobFile } from "../../../job-file.server";
import { jobCostCategoryLabels } from "../../../job-file";
import { OperationsShell } from "../../../operations-shell";
import { OpsBadge, OpsEmptyState, OpsMono, OpsPage, OpsPageHeader, OpsStat, OpsStatStrip, OpsSurface } from "../../../operations-ui";
import { listPayablesDashboard } from "../../../payables/payables.server";
import { payableStatusLabels } from "../../../payables/payables-data";
import { getStaffContext } from "../../../staff-directory.server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job Profitability | KCPL", robots: { index: false, follow: false } };

function money(amount: number, currency: string) { try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount.toLocaleString("en-AU")}`; } }

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

  return <OperationsShell userName={access.user.displayName} canManageStaff={staff.permissions.canManageStaff} canManageFinance={staff.permissions.canManageFinance} isManagement={staff.permissions.role === "management"}>
    <OpsPage>
      <OpsPageHeader eyebrow="Commercial control" title="Job profitability" description={<span><OpsMono>{job.reference}</OpsMono> · {job.origin || "Origin"} → {job.destination || "Destination"}</span>} meta={<><span>{job.customer_name || "Customer not linked"}</span><span>{job.primary_branch}</span><span>No automatic FX conversion</span></>} actions={<><Link href={`/admin/jobs/${encodeURIComponent(job.reference)}`} className="ops-button" data-variant="secondary" data-size="md">Digital Job File</Link>{staff.permissions.canManageFinance ? <Link href={`/admin/payables?shipment=${encodeURIComponent(job.reference)}`} className="ops-button" data-variant="primary" data-size="md">Add supplier bill</Link> : null}</>}/>
      <OpsStatStrip><OpsStat label="Customer" value={job.customer_name || "Not linked"}/><OpsStat label="Branch" value={job.primary_branch} icon={<Landmark size={13}/>} /><OpsStat label="Revenue currencies" value={Object.keys(job.revenue_totals).length}/><OpsStat label="Recognised costs" value={job.costs.length} icon={<WalletCards size={13}/>} /></OpsStatStrip>

      <div className="ops-content-wide ops-stack">
        <OpsSurface eyebrow="Commercial result" title="Revenue → cost → gross profit" description="Each currency remains independent. KCPL does not manufacture a consolidated margin by silently applying an FX rate.">
          {currencies.length ? <div className="grid gap-3 lg:grid-cols-2">{currencies.map((currency) => {
            const revenue = job.revenue_totals[currency as keyof typeof job.revenue_totals] ?? 0;
            const cost = job.cost_totals[currency as keyof typeof job.cost_totals] ?? 0;
            const profit = job.profit_totals[currency as keyof typeof job.profit_totals] ?? revenue - cost;
            const margin = job.margin_percent[currency as keyof typeof job.margin_percent];
            return <div key={currency} className="rounded-[15px] border border-[#e7dfd8] bg-[#faf7f4] p-5"><div className="flex items-center justify-between gap-3"><strong className="text-[13px] text-[#514840]">{currency}</strong><OpsBadge tone={profit >= 0 ? "success" : "danger"}>{margin === undefined ? "Margin N/A" : `${margin.toFixed(1)}% margin`}</OpsBadge></div><div className="mt-4 grid grid-cols-3 gap-2"><MoneyCell label="Revenue" value={money(revenue,currency)}/><MoneyCell label="Cost" value={money(cost,currency)}/><MoneyCell label="Gross profit" value={money(profit,currency)} positive={profit >= 0}/></div></div>;
          })}</div> : <OpsEmptyState title="No financial activity yet" description="Revenue appears after invoicing and costs appear after manual Job File costs or approved supplier bills."/>}
        </OpsSurface>

        <div className="ops-grid-2">
          <OpsSurface eyebrow="Cost ledger" title="Recognised job costs" description="Manual Job File costs and approved supplier bills share one traceable cost ledger.">
            {job.costs.length ? <div className="divide-y divide-[#eee7e1]">{job.costs.map((cost) => <div key={cost.id} className="flex items-start justify-between gap-4 py-3.5"><div className="min-w-0"><strong className="text-[10px] text-[#514840]">{cost.label}</strong><p className="mt-1 text-[8px] text-[#958b83]">{jobCostCategoryLabels[cost.category]}{cost.vendor ? ` · ${cost.vendor}` : ""}</p>{cost.source_type === "payable" && cost.source_reference ? <Link href={`/admin/payables/bills/${encodeURIComponent(cost.source_reference)}`} className="mt-2 inline-flex items-center gap-1 text-[8px] font-bold text-[#b5654f]"><FileText size={10}/>AP <OpsMono>{cost.source_reference}</OpsMono></Link> : <p className="mt-2 text-[8px] text-[#aaa098]">Manual Job File cost</p>}</div><strong className="shrink-0 text-[10px] text-[#514840]">{money(cost.amount,cost.currency)}</strong></div>)}</div> : <OpsEmptyState icon={<WalletCards size={17}/>} title="No recognised costs" description="Add costs in the Digital Job File or approve a supplier bill."/>}
          </OpsSurface>

          <OpsSurface eyebrow="Accounts Payable" title="Supplier bills for this job" description={staff.permissions.canManageFinance ? "Open AP records linked to the shipment." : "Supplier payment detail is restricted to Management and Accounts."}>
            {staff.permissions.canManageFinance ? bills.length ? <div className="divide-y divide-[#eee7e1]">{bills.map((bill) => <Link key={bill.reference} href={`/admin/payables/bills/${encodeURIComponent(bill.reference)}`} className="flex items-start justify-between gap-4 py-3.5"><div><strong className="text-[10px] text-[#514840]">{bill.supplier_name}</strong><p className="mt-1 text-[8px] text-[#958b83]"><OpsMono>{bill.reference}</OpsMono> · {payableStatusLabels[bill.status]}</p></div><div className="text-right"><strong className="text-[10px] text-[#514840]">{money(bill.total,bill.currency)}</strong><p className="mt-1 text-[8px] text-[#958b83]">{money(bill.balance_due,bill.currency)} due</p></div></Link>)}</div> : <OpsEmptyState title="No supplier bills linked" description="Create a payable from this job when a carrier, agent or supplier cost arrives."/> : <div className="rounded-[13px] bg-[#faf7f4] p-4 text-[9px] leading-5 text-[#80766e]">The operational job remains available, but supplier settlements are not exposed to this role.</div>}
          </OpsSurface>
        </div>
      </div>
    </OpsPage>
  </OperationsShell>;
}

function MoneyCell({label,value,positive}:{label:string;value:string;positive?:boolean}) { return <div className="rounded-[11px] bg-white p-3"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#9c928a]">{label}</p><strong className={`mt-1.5 block text-[10px] ${positive === false ? "text-[#b65355]" : positive === true ? "text-[#66806b]" : "text-[#514840]"}`}>{value}</strong></div>; }
function Gate({ title, detail }: { title: string; detail: string }) { return <main className="grid min-h-screen place-items-center bg-[#f8f6f3] p-6 text-[#332d29]"><section className="w-full max-w-xl rounded-[18px] border border-[#e7dfd8] bg-[#fffdfa] p-8 shadow-[0_18px_50px_rgba(81,61,47,.06)]"><p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#bd644e]">KCPL Job Profitability</p><h1 className="mt-3 text-[25px] font-[730] tracking-[-.04em]">{title}</h1><p className="mt-3 text-[11px] leading-6 text-[#81776f]">{detail}</p><Link href="/admin" className="mt-6 inline-flex rounded-[11px] bg-[#e8755d] px-4 py-2.5 text-[10px] font-bold text-white">Operations</Link></section></main>; }
