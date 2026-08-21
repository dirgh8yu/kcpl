"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, TriangleAlert } from "lucide-react";
import { payableStatusLabels } from "../../payables/payables-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSearch, OpsStat, OpsStatStrip, OpsSurface } from "../../operations-ui";
import type { SupplierReconciliationBill, SupplierReconciliationSnapshot } from "./supplier-reconciliation";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}

function dateLabel(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Asia/Kathmandu" }).format(date);
}

function identityLabel(bill: SupplierReconciliationBill) {
  if (bill.identity_kind === "customer_reference") return "Legacy Customer ID";
  if (bill.identity_kind === "missing_partner") return "Missing Partner reference";
  if (bill.identity_kind === "invalid_reference") return "Invalid supplier reference";
  return "Name only";
}

export function SupplierReconciliationWorkspace({ snapshot, roleLabel }: { snapshot: SupplierReconciliationSnapshot; roleLabel: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "suggested" | "manual" | "customer_reference">("all");
  const [selections, setSelections] = useState<Record<string, string>>(() => Object.fromEntries(
    snapshot.bills.filter((bill) => bill.suggestion).map((bill) => [bill.reference, bill.suggestion!.partner_id]),
  ));
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const partnerById = useMemo(() => new Map(snapshot.partners.map((partner) => [partner.id, partner])), [snapshot.partners]);
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return snapshot.bills.filter((bill) => {
      if (filter === "suggested" && !bill.suggestion) return false;
      if (filter === "manual" && bill.suggestion) return false;
      if (filter === "customer_reference" && bill.identity_kind !== "customer_reference") return false;
      if (!terms.length) return true;
      const suggestion = bill.suggestion ? `${bill.suggestion.partner_name} ${bill.suggestion.partner_id}` : "";
      const haystack = [bill.reference, bill.supplier_bill_reference ?? "", bill.supplier_name, bill.supplier_id ?? "", bill.branch, bill.currency, bill.shipment_reference ?? "", suggestion].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [snapshot.bills, query, filter]);

  async function confirmLink(bill: SupplierReconciliationBill) {
    const partnerId = selections[bill.reference];
    if (!partnerId) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/partners/reconciliation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          billReference: bill.reference,
          partnerId,
          expectedSupplierId: bill.supplier_id,
          expectedSupplierName: bill.supplier_name,
        }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; partnerName?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Supplier bill could not be reconciled.");
      setNotice({ tone: "success", text: `${bill.reference} is now linked to ${data.partnerName || "the selected Partner"}.` });
      setConfirming(null);
      router.refresh();
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Supplier bill could not be reconciled." });
    } finally {
      setBusy(false);
    }
  }

  return <OpsPage>
    <OpsPageHeader
      eyebrow="Finance control"
      title="Supplier reconciliation"
      description="Replace legacy name-only, Customer-ID and broken supplier references with confirmed KCPL Partner identities. Suggestions are advisory only; every accounting relink requires explicit confirmation."
      meta={<><span>{roleLabel}</span><span>{snapshot.unresolved_count} unresolved</span></>}
      actions={<><Link href="/admin/partners" className="ops-button" data-variant="secondary" data-size="md">Partners</Link><Link href="/admin/payables" className="ops-button" data-variant="secondary" data-size="md">Accounts Payable</Link></>}
    />

    <OpsStatStrip>
      <OpsStat label="Unresolved bills" value={snapshot.unresolved_count} icon={<TriangleAlert size={13}/>} tone={snapshot.unresolved_count ? "warning" : "success"}/>
      <OpsStat label="Exact-name suggestions" value={snapshot.exact_match_count} icon={<Link2 size={13}/>} tone="info" active={filter === "suggested"} onClick={() => setFilter(filter === "suggested" ? "all" : "suggested")}/>
      <OpsStat label="Legacy Customer IDs" value={snapshot.customer_reference_count} tone={snapshot.customer_reference_count ? "warning" : "neutral"} active={filter === "customer_reference"} onClick={() => setFilter(filter === "customer_reference" ? "all" : "customer_reference")}/>
      <OpsStat label="Needs manual match" value={snapshot.no_suggestion_count} active={filter === "manual"} onClick={() => setFilter(filter === "manual" ? "all" : "manual")}/>
    </OpsStatStrip>

    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
      <OpsNotice tone="warning">Exact-name suggestions are not automatic matches. Review the supplier name, bill reference, branch and job before confirming. Reconciliation never changes amounts, payment history, bill status or currency.</OpsNotice>

      <OpsSurface eyebrow="Legacy supplier identity" title="Bills requiring Partner linkage" description={`${filtered.length} of ${snapshot.bills.length} unresolved supplier bills shown.`} flush>
        <div className="ops-toolbar">
          <OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bill, supplier, old ID, Partner, shipment or branch"/>
          <select className="ops-select" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="all">All unresolved</option>
            <option value="suggested">Exact-name suggestions</option>
            <option value="manual">Needs manual match</option>
            <option value="customer_reference">Legacy Customer IDs</option>
          </select>
          <OpsButton variant="ghost" size="sm" onClick={() => { setQuery(""); setFilter("all"); }}>Reset</OpsButton>
        </div>

        <div className="ops-table-wrap"><table className="ops-table min-w-[1320px]"><thead><tr><th>Supplier bill</th><th>Current supplier identity</th><th>Job / branch</th><th>Amount</th><th>Due / status</th><th>Partner match</th><th></th></tr></thead><tbody>
          {filtered.length ? filtered.map((bill) => {
            const partnerId = selections[bill.reference] || "";
            const selectedPartner = partnerById.get(partnerId);
            return <Fragment key={bill.reference}>
              <tr>
                <td><Link href={`/admin/payables/bills/${encodeURIComponent(bill.reference)}`} className="font-bold text-[#514840] hover:underline"><OpsMono>{bill.reference}</OpsMono></Link><p className="mt-1 text-[10px] text-[#8f857d]">Vendor ref: {bill.supplier_bill_reference || "Not recorded"}</p></td>
                <td><strong>{bill.supplier_name}</strong><div className="mt-1.5 flex flex-wrap gap-1"><OpsBadge tone={bill.identity_kind === "customer_reference" ? "warning" : "neutral"}>{identityLabel(bill)}</OpsBadge>{bill.supplier_id ? <OpsMono>{bill.supplier_id}</OpsMono> : null}</div></td>
                <td>{bill.shipment_reference ? <Link href={`/admin/shipments/${encodeURIComponent(bill.shipment_reference)}`} className="font-semibold hover:underline"><OpsMono>{bill.shipment_reference}</OpsMono></Link> : <span>General payable</span>}<p className="mt-1 text-[10px] text-[#8f857d]">{bill.branch}</p></td>
                <td><strong>{money(bill.total, bill.currency)}</strong><p className="mt-1 text-[10px] text-[#8f857d]">{money(bill.balance_due, bill.currency)} outstanding</p></td>
                <td><span>{dateLabel(bill.due_date)}</span><p className="mt-1"><OpsBadge tone={bill.status === "overdue" ? "danger" : bill.status === "paid" ? "success" : "neutral"}>{payableStatusLabels[bill.status]}</OpsBadge></p></td>
                <td><select className="ops-select min-w-[250px]" value={partnerId} onChange={(event) => { setSelections((current) => ({ ...current, [bill.reference]: event.target.value })); setConfirming(null); }} aria-label={`Partner for ${bill.reference}`}><option value="">Choose Partner…</option>{snapshot.partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name} · {partner.owner_branch || "owner repair"}</option>)}</select>{bill.suggestion ? <p className="mt-1 text-[10px] text-[#8f857d]">Suggested from exact saved name match.</p> : <p className="mt-1 text-[10px] text-[#9a6f55]">No unique exact-name match. Review manually.</p>}</td>
                <td><OpsButton variant="secondary" size="sm" disabled={!partnerId || busy} onClick={() => setConfirming(confirming === bill.reference ? null : bill.reference)}>Review link</OpsButton></td>
              </tr>
              {confirming === bill.reference && selectedPartner ? <tr><td colSpan={7} className="bg-[#fbf7f3] p-0"><div className="m-3 rounded-[13px] border border-[#e6d8cf] bg-white p-4"><p className="text-[11px] font-bold text-[#514840]">Confirm accounting identity change</p><div className="mt-3 grid gap-3 md:grid-cols-3"><Review label="Before" value={`${bill.supplier_name}${bill.supplier_id ? ` · ${bill.supplier_id}` : " · no supplier ID"}`}/><Review label="After" value={`${selectedPartner.name} · ${selectedPartner.id}`}/><Review label="Bill values" value={`${money(bill.total, bill.currency)} · ${payableStatusLabels[bill.status]} · amounts unchanged`}/></div><p className="mt-3 text-[10px] leading-5 text-[#7e746d]">This writes the Partner ID to the supplier bill and updates the linked Job File cost identity if one exists. It does not change the bill amount, payments, status, currency or due date.</p><div className="mt-4 flex gap-2"><OpsButton variant="primary" size="sm" disabled={busy} onClick={() => void confirmLink(bill)}>{busy ? "Linking…" : "Confirm Partner link"}</OpsButton><OpsButton variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(null)}>Cancel</OpsButton></div></div></td></tr> : null}
            </Fragment>;
          }) : <tr><td colSpan={7}><OpsEmptyState title={snapshot.bills.length ? "No reconciliation records match" : "Supplier identities are reconciled"} description={snapshot.bills.length ? "Change the search or filter to see other unresolved supplier bills." : "There are no accessible non-void supplier bills with legacy or broken Partner identities."}/></td></tr>}
        </tbody></table></div>
      </OpsSurface>
    </div>
  </OpsPage>;
}

function Review({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[11px] border border-[#eee5df] bg-[#fffdfa] p-3"><p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#9b9189]">{label}</p><p className="mt-1.5 text-[11px] font-semibold leading-5 text-[#514840]">{value}</p></div>;
}
