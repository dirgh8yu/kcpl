"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsMono, OpsNotice, OpsSurface } from "../operations-ui";
import type { ConsolidationAllocationView } from "./tms-consolidation-allocation";
import type { TmsConsolidationLoad } from "./tms-consolidation";

type AllocationMap = Record<string, ConsolidationAllocationView>;
type ApiResponse = {
  ok: boolean;
  error?: string;
  allocations?: AllocationMap;
  status?: "approval_required" | "ready";
  packageId?: string;
  packageStatus?: string;
};

function allocationLabel(view: ConsolidationAllocationView | undefined) {
  if (!view) return "Not prepared";
  if (view.status === "pending_approval") return "Approval required";
  if (view.status === "ready") return "Ready to book";
  if (view.status === "booked") return "Booked";
  return "Stale";
}
function allocationTone(view: ConsolidationAllocationView | undefined): "neutral" | "warning" | "success" | "info" {
  if (!view || view.status === "stale") return "neutral";
  if (view.status === "pending_approval") return "warning";
  if (view.status === "ready" || view.status === "booked") return "success";
  return "info";
}
function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(value); }
  catch { return `${currency} ${value}`; }
}

export function TmsConsolidationAllocationDesk({ initialLoads, initialAllocations, canPrepare, canApprove }: {
  initialLoads: TmsConsolidationLoad[];
  initialAllocations: AllocationMap;
  canPrepare: boolean;
  canApprove: boolean;
}) {
  const eligible = useMemo(() => initialLoads.filter((load) => ["ready_for_procurement", "tendering", "booked"].includes(load.status)), [initialLoads]);
  const [selectedLoadId, setSelectedLoadId] = useState(eligible.find((load) => load.status !== "booked")?.id ?? eligible[0]?.id ?? "");
  const [allocations, setAllocations] = useState(initialAllocations);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const selectedLoad = eligible.find((load) => load.id === selectedLoadId) ?? null;
  const allocation = selectedLoad ? allocations[selectedLoad.id] : undefined;

  async function refresh() {
    const response = await fetch("/api/admin/consolidation", { cache: "no-store" });
    const data = await response.json() as ApiResponse;
    if (!response.ok || !data.ok || !data.allocations) throw new Error(data.error || "Commercial allocation state could not be refreshed.");
    setAllocations(data.allocations);
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/consolidation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as ApiResponse;
    if (!response.ok || !data.ok) throw new Error(data.error || "Commercial allocation action failed.");
    return data;
  }

  async function prepare() {
    if (!selectedLoad) return;
    setBusy(true); setNotice(null);
    try {
      const result = await post({ action: "prepare_allocation", loadId: selectedLoad.id });
      await refresh();
      setNotice(result.status === "approval_required"
        ? { tone: "warning", text: "Exact allocation economics are staged. Management approval is required for the listed house versions before booking." }
        : { tone: "success", text: "Exact allocation economics are staged and ready for consolidated booking." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Allocation could not be prepared." }); }
    finally { setBusy(false); }
  }

  async function approve(commercialVersionId: string) {
    if (!selectedLoad || !allocation) return;
    setBusy(true); setNotice(null);
    try {
      const result = await post({ action: "approve_allocation", loadId: selectedLoad.id, packageId: allocation.package_id, commercialVersionId, note: "Approved from KCPL Load Planner allocation workflow" });
      await refresh();
      setNotice({ tone: "success", text: result.packageStatus === "ready" ? "Exact commercial version approved. The allocation package is now ready to book." : "Exact commercial version approved. Additional staged versions still require Management approval." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Allocation version could not be approved." }); }
    finally { setBusy(false); }
  }

  return <OpsSurface className="mb-4" eyebrow="Commercial allocation" title="Prepare → approve exact versions → book" description="Released consolidation membership and source commercials are frozen first. This stage persists the exact derived house economics before any final booking artifacts are created.">
    {notice ? <div className="mb-3"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}
    {eligible.length ? <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="grid content-start gap-2">
        {eligible.map((load) => {
          const view = allocations[load.id];
          return <button key={load.id} type="button" onClick={() => setSelectedLoadId(load.id)} className={`rounded-[11px] border p-3 text-left ${selectedLoadId === load.id ? "border-[#dca99d] bg-[#fff8f5]" : "border-[#e9e2dc] bg-white"}`}>
            <div className="flex items-center justify-between gap-2"><OpsMono>{load.reference}</OpsMono><OpsBadge tone={allocationTone(view)}>{allocationLabel(view)}</OpsBadge></div>
            <strong className="mt-2 block text-[10px] text-[#4b423c]">{load.name}</strong>
            <span className="mt-1 block text-[9px] text-[#8a8078]">{load.members.length} houses · {load.branch}</span>
          </button>;
        })}
      </div>
      {selectedLoad ? <div className="rounded-[12px] border border-[#e9e2dc] bg-[#fcfbf9] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#8a8078]">{selectedLoad.reference}</p><div className="mt-1 flex items-center gap-2"><strong className="text-[13px] text-[#4b423c]">{allocationLabel(allocation)}</strong><OpsBadge tone={allocationTone(allocation)}>{allocation?.status ?? "not_prepared"}</OpsBadge></div></div>
          <div className="flex flex-wrap gap-2"><OpsButton size="sm" onClick={async () => { setBusy(true); setNotice(null); try { await refresh(); } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Allocation could not be refreshed." }); } finally { setBusy(false); } }} disabled={busy}><RefreshCw size={12}/> Refresh</OpsButton>{canPrepare && selectedLoad.status !== "booked" ? <OpsButton size="sm" variant="primary" onClick={prepare} disabled={busy}><ShieldCheck size={12}/> {allocation ? "Re-prepare exact allocation" : "Prepare allocation"}</OpsButton> : null}</div>
        </div>
        {!allocation ? <div className="mt-4 rounded-[10px] border border-[#eadfd7] bg-white p-3 text-[10px] leading-5 text-[#776e67]">After the master tender is accepted or countered, prepare the commercial allocation here. Booking will fail closed until this exact package exists.</div> : <>
          <div className="mt-4 grid gap-2 sm:grid-cols-4"><Mini label="Master procurement" value={money(allocation.total, allocation.currency)}/><Mini label="Allocation basis" value={allocation.allocation_basis.replaceAll("_", " ")}/><Mini label="Approvals" value={`${allocation.approved_approvals}/${allocation.required_approvals}`}/><Mini label="Package" value={allocation.package_id}/></div>
          {allocation.approvals.some((item) => item.approval_required) ? <div className="mt-4 grid gap-2">
            {allocation.approvals.filter((item) => item.approval_required).map((item) => <div key={item.commercial_version_id} className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-[#e9e2dc] bg-white p-3"><div><div className="flex items-center gap-2"><OpsMono>{item.order_id}</OpsMono><OpsBadge tone={item.approval_status === "approved" ? "success" : "warning"}>{item.approval_status}</OpsBadge></div><p className="mt-1 text-[9px] text-[#8a8078]">Version <OpsMono>{item.commercial_version_id}</OpsMono>{item.gross_margin_percent !== null ? ` · margin ${item.gross_margin_percent.toFixed(2)}%` : ""}</p>{item.approval_reasons.length ? <p className="mt-1 max-w-2xl text-[9px] leading-4 text-[#8a8078]">{item.approval_reasons.join(" ")}</p> : null}</div>{item.approval_status === "pending" && canApprove ? <OpsButton size="sm" variant="primary" onClick={() => approve(item.commercial_version_id)} disabled={busy}><CheckCircle2 size={12}/> Approve exact version</OpsButton> : null}</div>)}
          </div> : <div className="mt-4 rounded-[10px] border border-[#d9e5dc] bg-[#f6faf7] p-3 text-[10px] text-[#56675a]">No new Management approval is required for the staged house economics.</div>}
          {allocation.status === "ready" ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#d9e5dc] bg-[#f6faf7] p-3 text-[10px] text-[#56675a]"><span><strong>Ready to book.</strong> Final booking will consume these same derived version IDs and fingerprints.</span><Link href="/admin/tenders" className="ops-button" data-size="sm" data-variant="primary">Tender Desk <ArrowRight size={11}/></Link></div> : null}
        </>}
      </div> : null}
    </div> : <OpsEmptyState title="No released consolidation loads" description="Release a draft load to procurement before preparing its commercial allocation."/>}
  </OpsSurface>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-[9px] border border-[#ece5df] bg-white p-2"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#8a8078]">{label}</p><p className="mt-1 truncate text-[10px] font-semibold text-[#4b423c]" title={value}>{value}</p></div>;
}
