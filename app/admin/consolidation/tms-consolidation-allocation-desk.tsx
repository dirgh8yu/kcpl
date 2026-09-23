"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsFact, OpsFacts, OpsInspectorNote, OpsNotice, OpsSurface, OpsTableWrap } from "../operations-ui";
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

  async function refreshAllocations() {
    setBusy(true); setNotice(null);
    try { await refresh(); }
    catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Allocation could not be refreshed." }); }
    finally { setBusy(false); }
  }

  return <OpsSurface
    density="compact"
    title="Commercial allocation"
    description="Prepare → approve exact versions → book. Released membership and source commercials are frozen first; this stage persists the exact derived house economics before any booking artifacts are created."
  >
    {notice ? <div className="plan-notice"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}
    {eligible.length ? <div className="allocation-grid">
      <div className="allocation-list">
        <OpsTableWrap>
          <table className="ops-table ops-register-table allocation-table" aria-label="Released consolidation loads">
            <thead><tr><th>Load</th><th>Allocation</th></tr></thead>
            <tbody>{eligible.map((load) => {
              const view = allocations[load.id];
              const chosen = selectedLoadId === load.id;
              return <tr key={load.id} tabIndex={0} data-selected={chosen || undefined} aria-current={chosen || undefined} onClick={() => setSelectedLoadId(load.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedLoadId(load.id); } }}>
                <td><span className="ops-cell-primary ops-mono ops-cell-id">{load.reference}</span><span className="ops-cell-secondary ops-cell-clamp" title={load.name}>{load.name} · {load.members.length} houses · {load.branch}</span></td>
                <td><OpsBadge tone={allocationTone(view)}>{allocationLabel(view)}</OpsBadge></td>
              </tr>;
            })}</tbody>
          </table>
        </OpsTableWrap>
      </div>
      {selectedLoad ? <div className="allocation-detail">
        <div className="allocation-detail-head">
          <div className="min-w-0">
            <p className="ops-inspector-kicker">{selectedLoad.reference}</p>
            <div className="allocation-detail-title"><strong>{selectedLoad.name}</strong><OpsBadge tone={allocationTone(allocation)}>{allocationLabel(allocation)}</OpsBadge></div>
          </div>
          <div className="ops-inspector-actions">
            <OpsButton size="sm" onClick={refreshAllocations} disabled={busy}><RefreshCw size={14} strokeWidth={1.75} aria-hidden="true"/>Refresh</OpsButton>
            {canPrepare && selectedLoad.status !== "booked" ? <OpsButton size="sm" variant="primary" onClick={prepare} disabled={busy}><ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true"/>{allocation ? "Re-prepare exact allocation" : "Prepare allocation"}</OpsButton> : null}
          </div>
        </div>
        {!allocation ? <p className="ops-inspector-hint">After the master tender is accepted or countered, prepare the commercial allocation here. Booking will fail closed until this exact package exists.</p> : <>
          <OpsFacts columns={2}>
            <OpsFact label="Master procurement">{money(allocation.total, allocation.currency)}</OpsFact>
            <OpsFact label="Allocation basis">{allocation.allocation_basis.replaceAll("_", " ")}</OpsFact>
            <OpsFact label="Approvals">{`${allocation.approved_approvals}/${allocation.required_approvals}`}</OpsFact>
            <OpsFact label="Package"><span className="ops-mono allocation-package" title={allocation.package_id}>{allocation.package_id}</span></OpsFact>
          </OpsFacts>
          {allocation.approvals.some((item) => item.approval_required) ? <ul className="allocation-approvals">
            {allocation.approvals.filter((item) => item.approval_required).map((item) => <li key={item.commercial_version_id}>
              <div className="min-w-0">
                <div className="allocation-approval-head"><span className="ops-mono">{item.order_id}</span><OpsBadge tone={item.approval_status === "approved" ? "success" : "warning"}>{item.approval_status === "approved" ? "Approved" : "Pending approval"}</OpsBadge></div>
                <p className="allocation-approval-meta">Version <span className="ops-mono">{item.commercial_version_id}</span>{item.gross_margin_percent !== null ? ` · margin ${item.gross_margin_percent.toFixed(2)}%` : ""}</p>
                {item.approval_reasons.length ? <p className="allocation-approval-meta">{item.approval_reasons.join(" ")}</p> : null}
              </div>
              {item.approval_status === "pending" && canApprove ? <OpsButton size="sm" variant="primary" onClick={() => approve(item.commercial_version_id)} disabled={busy}><CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>Approve exact version</OpsButton> : null}
            </li>)}
          </ul> : <div className="plan-subform"><OpsInspectorNote tone="success" title="No new Management approval required">The staged house economics are within policy.</OpsInspectorNote></div>}
          {allocation.status === "ready" ? <div className="plan-subform"><OpsInspectorNote tone="success" title="Ready to book">
            Final booking will consume these same derived version IDs and fingerprints.
            <span className="load-note-actions"><Link href="/admin/tenders" className="ops-button" data-size="xs" data-variant="secondary">Tender Desk<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true"/></Link></span>
          </OpsInspectorNote></div> : null}
        </>}
      </div> : null}
    </div> : <OpsEmptyState compact title="No released consolidation loads" description="Release a draft load to procurement before preparing its commercial allocation."/>}
  </OpsSurface>;
}
