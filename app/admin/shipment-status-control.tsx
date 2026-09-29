"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { shipmentStatusLabels, type ShipmentStatus } from "../shipment-types";
import { OpsButton, OpsField } from "./operations-ui";
import { nextShipmentStatus, otherShipmentStatuses, workflowBlockerFix, type WorkflowFixStep } from "./workflow-guard";

export type WorkflowBlock = { target: ShipmentStatus | null; blockers: string[]; canOverride: boolean };

/** What stops a status change, each with the place it is fixed. The override
 * is the last option, closed until asked for, and only for Management. */
export function WorkflowBlockersPanel({
  reference,
  block,
  busy,
  onOverride,
  onCancel,
  onFix,
}: {
  reference: string;
  block: WorkflowBlock;
  busy: boolean;
  onOverride: (reason: string) => void;
  onCancel: () => void;
  /** Inside the Job File, open the step in place instead of navigating. */
  onFix?: (step: WorkflowFixStep) => void;
}) {
  const [overriding, setOverriding] = useState(false);
  const [reason, setReason] = useState("");
  const target = block.target ? shipmentStatusLabels[block.target] : "this status";
  return <div className="workflow-blockers" role="alert">
    <p className="workflow-blockers-title"><AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>Can’t move to {target} yet</p>
    <ul>
      {block.blockers.map((blocker) => {
        const fix = workflowBlockerFix(blocker);
        return <li key={blocker}>
          <span>{blocker}</span>
          {fix ? (onFix
            ? <button type="button" className="workflow-blockers-fix" onClick={() => onFix(fix.step)}>{fix.label}<ArrowRight size={12} strokeWidth={1.75} aria-hidden="true"/></button>
            : <Link className="workflow-blockers-fix" href={`/admin/jobs/${encodeURIComponent(reference)}?step=${fix.step}`}>{fix.label}<ArrowRight size={12} strokeWidth={1.75} aria-hidden="true"/></Link>) : null}
        </li>;
      })}
    </ul>
    {overriding ? <div className="workflow-blockers-override">
      <OpsField label="Reason for moving anyway" hint="Saved to the shipment history. At least 8 characters.">
        <textarea autoComplete="off" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why must this move before the checks above are done?"/>
      </OpsField>
      <div className="job-form-actions">
        <OpsButton variant="primary" size="sm" disabled={busy || reason.trim().length < 8} onClick={() => onOverride(reason.trim())}>{busy ? "Saving…" : `Move to ${target} anyway`}</OpsButton>
        <OpsButton variant="ghost" size="sm" disabled={busy} onClick={() => { setOverriding(false); setReason(""); }}>Back</OpsButton>
      </div>
    </div> : <div className="workflow-blockers-actions">
      <OpsButton variant="secondary" size="sm" onClick={onCancel}>OK</OpsButton>
      {block.canOverride ? <button type="button" className="workflow-blockers-link" onClick={() => setOverriding(true)}>Move anyway (management)…</button> : null}
    </div>}
  </div>;
}

type StatusResponse = { error?: string; blockers?: string[]; canOverride?: boolean; overrideUsed?: boolean };

/** One-click status moves for the Job File: the obvious next status as the
 * button, the rare ones behind "Other status". */
export function ShipmentStatusControl({
  reference,
  status,
  disabled = false,
  onChanged,
  onFix,
}: {
  reference: string;
  status: ShipmentStatus;
  disabled?: boolean;
  onChanged: (message: string) => void;
  onFix?: (step: WorkflowFixStep) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [block, setBlock] = useState<WorkflowBlock | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const next = nextShipmentStatus(status);
  const others = otherShipmentStatuses(status);

  async function move(target: ShipmentStatus, overrideReason = "") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/shipments/${encodeURIComponent(reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: target, overrideReason }),
      });
      const data = await response.json().catch(() => ({})) as StatusResponse;
      if (response.status === 409 && data.blockers?.length) {
        setBlock({ target, blockers: data.blockers, canOverride: data.canOverride === true });
        return;
      }
      if (!response.ok) throw new Error(data.error || "The status could not be changed. Try again.");
      setBlock(null);
      setOtherOpen(false);
      onChanged(data.overrideUsed ? `Moved to ${shipmentStatusLabels[target]}. Your reason was saved to the history.` : `Moved to ${shipmentStatusLabels[target]}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The status could not be changed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="shipment-status-control">
    <div className="shipment-status-control-row">
      {next ? <OpsButton variant="primary" size="sm" disabled={busy || disabled} onClick={() => void move(next)}>{busy ? "Saving…" : `Mark as ${shipmentStatusLabels[next]}`}</OpsButton> : null}
      {others.length ? <OpsButton variant="ghost" size="sm" disabled={busy || disabled} aria-expanded={otherOpen} onClick={() => setOtherOpen((value) => !value)}>Other status…</OpsButton> : null}
    </div>
    {otherOpen ? <div className="shipment-status-control-row" role="group" aria-label="Other statuses">
      {others.map((item) => <OpsButton key={item} variant="secondary" size="xs" disabled={busy || disabled} onClick={() => void move(item)}>{shipmentStatusLabels[item]}</OpsButton>)}
    </div> : null}
    {error ? <p className="shipment-status-control-error" role="alert">{error}</p> : null}
    {block ? <WorkflowBlockersPanel
      reference={reference}
      block={block}
      busy={busy}
      onFix={onFix}
      onCancel={() => setBlock(null)}
      onOverride={(reason) => { if (block.target) void move(block.target, reason); }}
    /> : null}
  </div>;
}
