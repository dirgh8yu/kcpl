"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, RefreshCw } from "lucide-react";
import type { ShipmentWorkflowReadiness } from "../../workflow-guard";
import { OpsBadge, OpsButton, OpsProgress, OpsSurface } from "../../operations-ui";

function directionLabel(value: ShipmentWorkflowReadiness["document_intelligence"]["direction"]) {
  if (value === "cross_trade") return "Cross-trade";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function SmartDocumentIntelligence({ initialWorkflow }: { initialWorkflow: ShipmentWorkflowReadiness }) {
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(initialWorkflow.reference)}`, { cache: "no-store" });
      const payload = await response.json() as { workflow?: ShipmentWorkflowReadiness; error?: string };
      if (!response.ok || !payload.workflow) throw new Error(payload.error || "Document intelligence could not be refreshed.");
      setWorkflow(payload.workflow);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document intelligence could not be refreshed.");
    } finally {
      setBusy(false);
    }
  }, [initialWorkflow.reference]);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 10_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const relevant = workflow.documents.filter((item) => item.required || item.advisory);
  const required = relevant.filter((item) => item.required && item.document_type !== "proof_of_delivery");
  const present = required.filter((item) => item.present).length;
  const missing = required.filter((item) => !item.present);

  return <div className="ops-content-wide pt-5">
    <OpsSurface
      eyebrow="Smart document intelligence"
      title="Compliance-aware document pack"
      description="KCPL recalculates this checklist from freight mode, trade direction, origin/destination, cargo text and shipment instructions. Explicit shipment overrides remain authoritative."
      action={<div className="flex flex-wrap items-center gap-2"><OpsBadge tone="info">{directionLabel(workflow.document_intelligence.direction)}</OpsBadge><OpsBadge tone={workflow.document_pack_ready ? "success" : "warning"}>{present}/{required.length} required ready</OpsBadge><OpsButton variant="ghost" size="sm" disabled={busy} onClick={() => void refresh()}><RefreshCw size={11}/>{busy ? "Refreshing" : "Refresh"}</OpsButton></div>}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
        <div>
          <div className="mb-3"><OpsProgress value={present} max={Math.max(required.length, 1)} tone={workflow.document_pack_ready ? "success" : "warning"}/></div>
          <div className="grid gap-2 md:grid-cols-2">{relevant.map((item) => <div key={item.document_type} className={`rounded-[11px] border p-3 ${item.present ? "border-[#d6e1d6] bg-[#f5f9f5]" : item.required ? "border-[#ead7b7] bg-[#fff9ef]" : "border-[#e5dfd9] bg-[#faf8f5]"}`}>
            <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2">{item.present ? <CheckCircle2 size={12} className="shrink-0 text-[#66806b]"/> : <FileCheck2 size={12} className="shrink-0 text-[#a46b38]"/>}<strong className="truncate text-[10px] text-[#514840]">{item.label}</strong></div><OpsBadge tone={item.present ? "success" : item.required ? "warning" : "neutral"}>{item.present ? "Present" : item.required ? "Required" : "Review"}</OpsBadge></div>
            <p className="mt-2 text-[8px] leading-4 text-[#837970]">{item.reason}</p>
            <p className="mt-1 text-[7px] uppercase tracking-[.06em] text-[#a09790]">Rule source: {item.source.replaceAll("_", " ")}</p>
          </div>)}</div>
        </div>

        <div className="rounded-[12px] border border-[#e9e2dc] bg-[#faf8f5] p-4">
          <p className="ops-eyebrow">Rule context</p>
          <div className="mt-3 grid gap-2 text-[9px] text-[#655c55]"><p><strong>Lane:</strong> {workflow.document_intelligence.origin || "Origin not set"} → {workflow.document_intelligence.destination || "Destination not set"}</p><p><strong>Mode:</strong> {workflow.document_intelligence.mode || "Not set"}</p><p><strong>Cargo:</strong> {workflow.document_intelligence.cargo_type || "Not specified"}</p></div>
          <div className="mt-4"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#948a82]">Rules applied</p><div className="mt-2 flex flex-wrap gap-1.5">{workflow.document_intelligence.rules_applied.map((rule) => <OpsBadge key={rule}>{rule}</OpsBadge>)}</div></div>
          {workflow.document_intelligence.advisories.length ? <div className="mt-4 rounded-[10px] border border-[#ead7b7] bg-[#fffaf2] p-3"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#8f6835]">Verify with customs</p>{workflow.document_intelligence.advisories.map((advisory) => <p key={advisory} className="mt-2 flex items-start gap-1.5 text-[8px] leading-4 text-[#806a50]"><AlertTriangle size={9} className="mt-0.5 shrink-0"/>{advisory}</p>)}</div> : null}
          {missing.length ? <p className="mt-4 text-[8px] leading-4 text-[#8e5d3b]">Missing required documents block controlled final-mile progression unless Management records an audited override.</p> : <p className="mt-4 text-[8px] leading-4 text-[#617564]">All smart-required operational documents are present.</p>}
          {error ? <p className="mt-3 text-[8px] leading-4 text-[#a04d4d]">{error}</p> : null}
        </div>
      </div>
    </OpsSurface>
  </div>;
}
