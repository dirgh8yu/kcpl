"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Handshake, X } from "lucide-react";
import { OpsButton, OpsField, OpsNotice, OpsSurface } from "../../operations-ui";
import { partnerShipmentRoleLabels, partnerShipmentRoles, type PartnerShipmentAccess } from "../../../partner/partner-access-policy";

/*
 * Who outside KCPL can see this shipment in the partner portal: the overseas
 * agent, the trucker, the customs agent. They post its milestones and upload
 * its papers there; staff add or take them off here.
 */

export function PartnerAccessControl({ reference, partners, options, canEdit }: {
  reference: string;
  partners: PartnerShipmentAccess[] | null;
  options: Array<{ id: string; name: string }>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const current = partners ?? [];
  const available = options.filter((option) => !current.some((item) => item.partner_id === option.id));
  const base = `/api/admin/jobs/${encodeURIComponent(reference)}/partners`;

  async function send(method: "POST" | "PATCH", body: Record<string, unknown>, success: string) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(base, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "That didn’t save.");
      setNotice({ text: success, tone: "success" }); router.refresh(); return true;
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "That didn’t save.", tone: "danger" }); return false; }
    finally { setBusy(false); }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const partner = options.find((option) => option.id === form.get("partnerId"));
    if (await send("POST", { partnerId: form.get("partnerId"), role: form.get("role") }, `${partner?.name ?? "The partner"} can now see this shipment in the partner portal.`)) setOpen(false);
  }

  if (partners === null) return null;
  return <OpsSurface
    id="shipment-partners"
    title="Partners on this shipment"
    description={current.length ? "They see its route, status and milestones in the partner portal, post milestones and upload documents. Never prices, the customer’s documents or your notes." : undefined}
    action={canEdit && available.length ? <OpsButton variant="secondary" size="xs" onClick={() => setOpen((value) => !value)} aria-expanded={open}><Handshake size={13} strokeWidth={1.75} aria-hidden="true"/>{open ? "Close" : "Add"}</OpsButton> : undefined}
  >
    {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
    {open && canEdit ? <form onSubmit={add} className="portal-form" aria-busy={busy}>
      <div className="portal-form-grid">
        <OpsField label="Partner"><select name="partnerId" required defaultValue=""><option value="" disabled>Choose a partner</option>{available.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></OpsField>
        <OpsField label="Role on this shipment"><select name="role" defaultValue="origin_agent">{partnerShipmentRoles.map((role) => <option key={role} value={role}>{partnerShipmentRoleLabels[role]}</option>)}</select></OpsField>
      </div>
      <p className="ops-inspector-hint">Their staff sign in with a partner login, set up on the partner’s page.</p>
      <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Adding…" : "Add partner"}</OpsButton></div>
    </form> : null}
    {current.length ? <ul className="job-rows">{current.map((item) => <li key={item.partner_id} className="job-partner-row">
      <span><strong>{item.partner_name}</strong> · {partnerShipmentRoleLabels[item.role]}</span>
      {canEdit ? <OpsButton variant="ghost" size="xs" disabled={busy} aria-label={`Take ${item.partner_name} off this shipment`} onClick={() => { if (window.confirm(`Take ${item.partner_name} off this shipment? It leaves their partner portal straight away.`)) void send("PATCH", { partnerId: item.partner_id }, `${item.partner_name} no longer sees this shipment.`); }}><X size={13} aria-hidden="true"/>Remove</OpsButton> : null}
    </li>)}</ul> : <p className="portal-footnote m-0">No partners see this shipment yet{canEdit && available.length ? ". Add the overseas agent or trucker so they can post its milestones themselves." : "."}</p>}
  </OpsSurface>;
}
