"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, ShieldAlert, X } from "lucide-react";
import { OpsBadge, OpsButton, OpsField, OpsNotice } from "../operations-ui";
import type { CustomsAgentOption } from "./customs-clearance";
import { customsClearanceStatuses, customsClearanceStatusLabels, type CustomsClearanceStatus } from "./customs-policy";
import type { CustomsDeskRow } from "./customs-data.server";

function timeLabel(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(date) + " NPT";
}

function clearanceTone(status: CustomsClearanceStatus): "neutral" | "info" | "warning" | "danger" | "success" {
  if (status === "released") return "success";
  if (status === "held") return "danger";
  if (status === "lodged") return "info";
  if (status === "preparing") return "warning";
  return "neutral";
}

export function CustomsClearanceEditor({ row, agents }: { row: CustomsDeskRow; agents: CustomsAgentOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [form, setForm] = useState(() => ({
    status: row.clearance.status,
    entryPoint: row.clearance.entry_point ?? "",
    declarationReference: row.clearance.declaration_reference ?? "",
    agentPartnerId: row.clearance.agent_partner_id ?? "",
    holdReason: row.clearance.hold_reason ?? "",
    releaseEvidence: row.clearance.release_evidence ?? "",
  }));

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/customs/${encodeURIComponent(row.reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Customs clearance could not be updated.");
      setNotice({ tone: "success", text: form.status === "released" ? "Customs release recorded and added to the Job File audit trail." : "Customs clearance record updated." });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Customs clearance could not be updated." });
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3 rounded-[11px] border border-[#e4ddd7] bg-[#fbf9f6] p-3.5">
    {notice ? <div className="mb-3"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#887e76]">Customs clearance record</span><OpsBadge tone={clearanceTone(row.clearance.status)} dot>{customsClearanceStatusLabels[row.clearance.status]}</OpsBadge>{row.release_required ? <OpsBadge tone="info">Release required</OpsBadge> : <OpsBadge>Release not required by lane rule</OpsBadge>}</div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] leading-5 text-[#746a63]"><span>Point: <strong className="text-[#514840]">{row.clearance.entry_point || "Not recorded"}</strong></span><span>Declaration/ref: <strong className="text-[#514840]">{row.clearance.declaration_reference || "Not recorded"}</strong></span><span>Agent: <strong className="text-[#514840]">{row.clearance.agent_name || "Not assigned"}</strong></span>{row.clearance.released_at ? <span>Last release: <strong className="text-[#617564]">{timeLabel(row.clearance.released_at)}</strong></span> : null}</div>
        {row.clearance.status === "held" && row.clearance.hold_reason ? <p className="mt-2 flex items-start gap-2 text-[10px] leading-5 text-[#9a5552]"><ShieldAlert size={12} className="mt-1 shrink-0"/>{row.clearance.hold_reason}</p> : null}
        {row.clearance.release_evidence ? <p className="mt-1 text-[10px] leading-5 text-[#81776f]">Release evidence: {row.clearance.release_evidence}</p> : null}
      </div>
      <OpsButton variant="secondary" size="sm" onClick={() => setOpen((value) => !value)}><Pencil size={11}/>{open ? "Close" : "Update clearance"}</OpsButton>
    </div>

    {open ? <div className="mt-4 border-t border-[#e6dfd8] pt-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OpsField label="Clearance status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CustomsClearanceStatus })}>{customsClearanceStatuses.map((status) => <option key={status} value={status}>{customsClearanceStatusLabels[status]}</option>)}</select></OpsField>
        <OpsField label="Customs / border point"><input value={form.entryPoint} onChange={(event) => setForm({ ...form, entryPoint: event.target.value })} placeholder="Birgunj ICP, TIA Customs…"/></OpsField>
        <OpsField label="Declaration / entry reference"><input value={form.declarationReference} onChange={(event) => setForm({ ...form, declarationReference: event.target.value })} placeholder="Customs entry / declaration no."/></OpsField>
        <OpsField label="Customs agent / clearing partner"><select value={form.agentPartnerId} onChange={(event) => setForm({ ...form, agentPartnerId: event.target.value })}><option value="">No registered agent selected</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></OpsField>
        {form.status === "held" ? <OpsField label="Hold reason" className="md:col-span-2"><textarea required value={form.holdReason} onChange={(event) => setForm({ ...form, holdReason: event.target.value })} placeholder="What Customs is waiting for or why cargo is held"/></OpsField> : null}
        {form.status === "released" ? <OpsField label="Release evidence / note" className="md:col-span-2"><textarea value={form.releaseEvidence} onChange={(event) => setForm({ ...form, releaseEvidence: event.target.value })} placeholder="Portal confirmation, broker confirmation, release email or other evidence"/></OpsField> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><OpsButton variant="primary" disabled={busy} onClick={() => void save()}><CheckCircle2 size={11}/>{busy ? "Saving…" : form.status === "released" ? "Record Customs release" : "Save clearance"}</OpsButton><OpsButton variant="ghost" disabled={busy} onClick={() => setOpen(false)}><X size={11}/>Cancel</OpsButton></div>
      {form.status === "released" ? <p className="mt-3 text-[10px] leading-5 text-[#8a6755]">Release is a controlled operational fact. KCPL requires a customs point plus either a declaration/reference or a release-evidence note before this status can be saved.</p> : null}
    </div> : null}
  </div>;
}
