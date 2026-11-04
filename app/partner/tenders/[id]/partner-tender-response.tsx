"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, Send, X } from "lucide-react";
import { OpsButton, OpsField, OpsNotice, OpsSurface } from "../../../admin/operations-ui";
import { crmCurrencies, type CrmCurrency } from "../../../admin/crm/crm-data";

export function PartnerTenderResponse({ tenderId, currency, offeredCost }: { tenderId: string; currency: CrmCurrency; offeredCost: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "counter">("idle");
  const [counterCurrency, setCounterCurrency] = useState<CrmCurrency>(currency);
  const [amount, setAmount] = useState(String(offeredCost));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function respond(action: "accept" | "reject" | "counter") {
    if (busy) return;
    setBusy(action); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/partner/tenders/${encodeURIComponent(tenderId)}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note, ...(action === "counter" ? { amount, currency: counterCurrency } : {}) }),
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "The tender response didn’t save.");
      setNotice(action === "accept" ? "Offer accepted. KCPL has been told." : action === "reject" ? "Offer declined. KCPL can re-tender the load." : "Counter-offer sent to KCPL.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The tender response didn’t save.");
    } finally {
      setBusy(null);
    }
  }

  return <OpsSurface title="Respond to KCPL" description="One response per tender. The deadline is fixed in Nepal time.">
    {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
    {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
    <div className="ops-stack">
      <OpsField label="Message to KCPL" hint="Optional. Shown beside your response.">
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} placeholder="Truck available, loading Tuesday morning."/>
      </OpsField>
      {mode === "counter" ? <div className="portal-form-grid">
        <OpsField label="Counter amount" hint={`Offered: ${currency} ${offeredCost.toFixed(2)}`}>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal"/>
        </OpsField>
        <OpsField label="Currency">
          <select value={counterCurrency} onChange={(event) => setCounterCurrency(event.target.value as CrmCurrency)}>
            {crmCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </OpsField>
      </div> : null}
      <div className="portal-form-actions">
        {mode === "idle" ? <>
          <OpsButton variant="primary" size="sm" disabled={busy !== null} onClick={() => respond("accept")}><Check size={14} aria-hidden="true"/>{busy === "accept" ? "Accepting…" : "Accept offer"}</OpsButton>
          <OpsButton variant="secondary" size="sm" disabled={busy !== null} onClick={() => setMode("counter")}><Send size={14} aria-hidden="true"/>Counter-offer</OpsButton>
          <OpsButton variant="ghost" size="sm" disabled={busy !== null} onClick={() => respond("reject")}><X size={14} aria-hidden="true"/>{busy === "reject" ? "Declining…" : "Decline"}</OpsButton>
        </> : <>
          <OpsButton variant="primary" size="sm" disabled={busy !== null} onClick={() => respond("counter")}><ClipboardCheck size={14} aria-hidden="true"/>{busy === "counter" ? "Sending…" : "Send counter-offer"}</OpsButton>
          <OpsButton variant="ghost" size="sm" disabled={busy !== null} onClick={() => setMode("idle")}>Back</OpsButton>
        </>}
      </div>
    </div>
  </OpsSurface>;
}
