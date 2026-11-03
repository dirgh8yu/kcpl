"use client";

import { useState, type FormEvent } from "react";
import { CreditCard } from "lucide-react";
import { OpsButton, OpsField, OpsNotice, OpsSurface } from "../../../admin/operations-ui";
import { portalTranslator, type PortalLocale } from "../../portal-i18n";

type Gateway = "khalti" | "esewa" | "connectips";

const gatewayLabels: Record<Gateway, string> = {
  khalti: "Khalti",
  esewa: "eSewa",
  connectips: "connectIPS",
};

export function PortalPaymentPanel({
  reference,
  currency,
  balance,
  rate,
  rateDate,
  minimumNpr,
  gateways,
  locale,
}: {
  reference: string;
  currency: string;
  balance: number;
  rate: number;
  rateDate: string | null;
  minimumNpr: number;
  gateways: Gateway[];
  locale: PortalLocale;
}) {
  const t = portalTranslator(locale);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [gateway, setGateway] = useState<Gateway>(gateways[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/invoices/${encodeURIComponent(reference)}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gateway, amount }),
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !result.ok || !result.url) throw new Error(result.error || t("pay.failed"));
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("pay.failed"));
      setBusy(false);
    }
  }

  return <OpsSurface
    title={t("pay.title")}
    description={currency !== "NPR" ? t("pay.rate", { rate: rate.toFixed(2), currency }) : undefined}
    action={<OpsButton variant="primary" size="sm" onClick={() => setOpen((value) => !value)}>{open ? t("common.cancel") : t("pay.open")}</OpsButton>}
  >
    {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
    {open ? <form onSubmit={start} className="portal-form" aria-busy={busy}>
      <div className="portal-form-grid">
        <OpsField label={t("pay.amount")} hint={t("pay.amount_hint")}>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" autoComplete="off" disabled={busy}/>
        </OpsField>
        <OpsField label={t("pay.gateway")}>
          <select value={gateway} onChange={(event) => setGateway(event.target.value as Gateway)} disabled={busy}>
            {gateways.map((item) => <option key={item} value={item}>{gatewayLabels[item]}</option>)}
          </select>
        </OpsField>
      </div>
      <p className="portal-footnote m-0">{t("pay.note")}</p>
      <p className="portal-footnote m-0">{t("pay.minimum", { amount: minimumNpr.toLocaleString("en-AU") })}{currency !== "NPR" && rateDate ? ` · NRB ${rateDate}` : ""}</p>
      <div className="portal-form-actions">
        <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>
          <CreditCard size={14} aria-hidden="true"/>{busy ? t("pay.working") : t("pay.submit")}
        </OpsButton>
      </div>
    </form> : null}
  </OpsSurface>;
}
