"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, FileSearch, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { OpsBadge, OpsButton, OpsMono, OpsNotice, OpsSurface } from "../../operations-ui";
import type { MigrationRecoveryPlan, MigrationRecoveryResult, RecoveryRecordStatus } from "./recovery-data";

function tone(status: RecoveryRecordStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "eligible") return "success";
  if (status === "already_reversed") return "neutral";
  if (status === "missing") return "danger";
  return "warning";
}

function label(status: RecoveryRecordStatus) {
  if (status === "eligible") return "Safe to reverse";
  if (status === "already_reversed") return "Already reversed";
  if (status === "missing") return "Missing";
  return "Blocked";
}

export function RecoveryPanel({ batchId, rollbackStatus }: { batchId: string; rollbackStatus: string | null }) {
  const [plan, setPlan] = useState<MigrationRecoveryPlan | null>(null);
  const [result, setResult] = useState<MigrationRecoveryResult | null>(null);
  const [busy, setBusy] = useState<"plan" | "execute" | "">("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  async function requestPlan() {
    setBusy("plan");
    setError("");
    setResult(null);
    try {
      const response = await fetch(`/api/admin/migration/recovery/${encodeURIComponent(batchId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "plan" }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string; plan?: MigrationRecoveryPlan };
      if (!response.ok || !payload.ok || !payload.plan) throw new Error(payload.error || "Recovery dry run could not be generated.");
      setPlan(payload.plan);
      setConfirmation("");
      setAcknowledged(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recovery dry run could not be generated.");
    } finally {
      setBusy("");
    }
  }

  async function execute() {
    if (!plan) return;
    setBusy("execute");
    setError("");
    try {
      const response = await fetch(`/api/admin/migration/recovery/${encodeURIComponent(batchId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          plan_id: plan.plan_id,
          plan_hash: plan.plan_hash,
          confirmation,
        }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string; result?: MigrationRecoveryResult };
      if (!response.ok || !payload.ok || !payload.result) throw new Error(payload.error || "Recovery could not be completed.");
      setResult(payload.result);
      setPlan(null);
      setConfirmation("");
      setAcknowledged(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recovery could not be completed.");
    } finally {
      setBusy("");
    }
  }

  return <OpsSurface
    eyebrow="Stage 4C · Controlled recovery"
    title="Dry run first. Reverse only proven migration records."
    description="Stage 4C never offers a force-delete switch. It proves batch ownership, checks post-import activity and dependencies, preserves Paper Archive evidence, then rechecks every record immediately before deletion."
    priority={rollbackStatus === "partial_failure" ? "warning" : rollbackStatus === "completed" ? "success" : "normal"}
    action={<OpsButton variant="secondary" disabled={Boolean(busy)} onClick={() => void requestPlan()}>{busy === "plan" ? <LoaderCircle size={12} className="animate-spin"/> : <FileSearch size={12}/>}Run recovery dry run</OpsButton>}
  >
    <div className="space-y-4">
      {rollbackStatus ? <OpsNotice tone={rollbackStatus === "completed" ? "success" : rollbackStatus === "partial_failure" ? "warning" : "neutral"}><strong>Recovery state:</strong> {rollbackStatus.replaceAll("_", " ")}.</OpsNotice> : null}
      {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
      {result ? <OpsNotice tone={result.status === "completed" ? "success" : "warning"}><strong>{result.status === "completed" ? "Recovery completed." : "Recovery stopped safely after a partial failure."}</strong> Recovery <OpsMono>{result.recovery_id}</OpsMono> reversed {result.reversed_count} record{result.reversed_count === 1 ? "" : "s"}, preserved and re-linked {result.archive_relinks} archive item{result.archive_relinks === 1 ? "" : "s"}{result.error ? ` · ${result.error}` : ""}. Refresh this page to see the authoritative batch state.</OpsNotice> : null}

      {!plan ? <div className="grid gap-3 md:grid-cols-3">
        <Safety icon={<ShieldCheck size={14}/>} title="No force mode" detail="Any changed, dependent or unverifiable record blocks automatic rollback."/>
        <Safety icon={<FileSearch size={14}/>} title="Fresh-state proof" detail="The plan expires after 15 minutes and is invalidated if the data changes."/>
        <Safety icon={<RotateCcw size={14}/>} title="Evidence survives" detail="Paper Archive files are re-linked to the migration batch before source records are removed."/>
      </div> : null}

      {plan ? <>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Eligible" value={plan.eligible_count} tone="success"/>
          <Metric label="Blocked" value={plan.blocked_count} tone={plan.blocked_count ? "danger" : "neutral"}/>
          <Metric label="Missing" value={plan.missing_count} tone={plan.missing_count ? "danger" : "neutral"}/>
          <Metric label="Already reversed" value={plan.already_reversed_count}/>
          <Metric label="Archive relinks" value={plan.archive_relinks}/>
        </div>

        {plan.warnings.length ? <OpsNotice tone={plan.can_execute ? "warning" : "danger"}>{plan.warnings.join(" ")}</OpsNotice> : null}

        <div className="overflow-x-auto rounded-[12px] border border-[#e8e0d9]">
          <table className="ops-table min-w-[800px]"><thead><tr><th>Type</th><th>Record</th><th>State</th><th>Archive</th><th>Reason</th></tr></thead><tbody>{plan.records.map((record) => <tr key={record.key}><td><OpsBadge tone="neutral">{record.kind}</OpsBadge></td><td>{record.status === "already_reversed" || record.status === "missing" ? <OpsMono>{record.id}</OpsMono> : <Link href={record.href} className="font-bold text-[#b5654f]"><OpsMono>{record.id}</OpsMono></Link>}</td><td><OpsBadge tone={tone(record.status)}>{label(record.status)}</OpsBadge></td><td>{record.archive_relinks ? `${record.archive_relinks} preserved` : "None"}</td><td><span className="text-[9px] leading-4 text-[#776e67]">{record.reasons.length ? record.reasons.join(" ") : "Ownership and untouched-state checks passed."}</span></td></tr>)}</tbody></table>
        </div>

        {plan.can_execute ? <div className="rounded-[13px] border border-[#e0c8bd] bg-[#fff8f4] p-4">
          <div className="flex items-start gap-3"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#b5654f]"/><div><strong className="text-[11px] text-[#4d433d]">Final destructive confirmation</strong><p className="mt-1 text-[9px] leading-4 text-[#7f746c]">This removes only the records marked Safe to reverse. It does not erase the migration batch, recovery audit, or Paper Archive evidence. Type the exact confirmation below.</p></div></div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="block"><span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[.08em] text-[#94887f]">Type <OpsMono>{plan.confirmation_text}</OpsMono></span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-10 w-full rounded-[9px] border border-[#d8cec6] bg-white px-3 text-[11px] text-[#4d433d] outline-none focus:border-[#b97864]" autoComplete="off"/></label>
            <OpsButton variant="danger" disabled={busy === "execute" || !acknowledged || confirmation.trim().toUpperCase() !== plan.confirmation_text} onClick={() => void execute()}>{busy === "execute" ? <LoaderCircle size={12} className="animate-spin"/> : <RotateCcw size={12}/>}Execute controlled rollback</OpsButton>
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[9px] leading-4 text-[#70665f]"><input type="checkbox" className="mt-0.5" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/><span>I reviewed the dry run and understand that this action permanently removes the eligible imported records while retaining the migration and recovery evidence.</span></label>
          <p className="mt-3 text-[8px] text-[#9a8d84]">Plan <OpsMono>{plan.plan_id}</OpsMono> expires {new Date(plan.expires_at).toLocaleString()}.</p>
        </div> : <OpsNotice tone="danger"><strong>Rollback is blocked.</strong> Stage 4C will not bypass these checks. Resolve the dependencies or review the affected records manually, then generate a fresh dry run.</OpsNotice>}
      </> : null}
    </div>
  </OpsSurface>;
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "danger" }) {
  const color = tone === "success" ? "text-[#5f7864]" : tone === "danger" ? "text-[#a74d50]" : "text-[#4d453f]";
  return <div className="rounded-[11px] border border-[#e8e0d9] bg-[#faf8f5] p-3"><p className="text-[8px] font-bold uppercase tracking-[.07em] text-[#998f87]">{label}</p><strong className={`mt-1 block text-[18px] ${color}`}>{value}</strong></div>;
}

function Safety({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="rounded-[12px] border border-[#e8e0d9] bg-[#faf8f5] p-4"><strong className="flex items-center gap-2 text-[10px] text-[#514840]">{icon}{title}</strong><p className="mt-2 text-[8px] leading-4 text-[#857b73]">{detail}</p></div>;
}
