"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Receipt } from "lucide-react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsField,
  OpsNotice,
  OpsSurface,
} from "../../../admin/operations-ui";
import type { PortalRemittance } from "../../portal-remittance.server";
import { portalDate, portalFileSize } from "../../portal-format";
import { portalTranslator, type PortalLocale } from "../../portal-i18n";

export function PortalRemittancePanel({
  reference,
  initialRemittances,
  currency,
  locale,
}: {
  reference: string;
  initialRemittances: PortalRemittance[];
  currency: string;
  locale: PortalLocale;
}) {
  const t = portalTranslator(locale);
  const router = useRouter();
  const [remittances, setRemittances] = useState(initialRemittances);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    if (!(form.get("file") instanceof File) || !(form.get("file") as File).size) {
      setError(t("rem.receipt_aria"));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/portal/invoices/${encodeURIComponent(reference)}/remittance`, {
        method: "POST",
        body: form,
      });
      const data = await response.json() as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || t("rem.failed"));
      setNotice(data.message ?? t("rem.sent"));
      setOpen(false);

      const listing = await fetch(`/api/portal/invoices/${encodeURIComponent(reference)}/remittance`, { cache: "no-store" });
      const listed = await listing.json() as { ok?: boolean; remittances?: PortalRemittance[] };
      if (listed.ok && listed.remittances) setRemittances(listed.remittances);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("rem.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsSurface
      eyebrow={t("rem.eyebrow")}
      title={t("rem.title")}
      description={t("rem.description")}
      action={<OpsButton variant="secondary" size="sm" onClick={() => setOpen((value) => !value)}>{open ? t("common.cancel") : t("rem.open")}</OpsButton>}
    >
      <div className="portal-exchange">
        {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
        {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

        {open ? (
          <form onSubmit={submit} className="portal-form" aria-busy={busy}>
            <div className="portal-form-grid">
              <OpsField label={t("rem.amount_label")} hint={t("rem.amount_hint")}>
                <input name="amount" inputMode="decimal" placeholder="25000" disabled={busy}/>
              </OpsField>
              <OpsField label={t("rem.currency")}>
                <input name="currency" maxLength={3} defaultValue={currency} disabled={busy}/>
              </OpsField>
              <OpsField label={t("rem.date_paid")}>
                <input name="paidOn" type="date" disabled={busy}/>
              </OpsField>
              <OpsField label={t("rem.receipt")} hint={t("rem.receipt_hint")}>
                <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy}/>
              </OpsField>
            </div>
            <OpsField label={t("rem.note_label")} hint={t("rem.note_hint")}>
              <textarea name="note" placeholder={t("rem.note_placeholder")} disabled={busy}/>
            </OpsField>
            <div className="portal-form-actions">
              <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>
                <Banknote size={14} strokeWidth={1.75} aria-hidden="true"/>
                <span>{busy ? t("rem.sending") : t("rem.submit")}</span>
              </OpsButton>
            </div>
          </form>
        ) : null}

        {remittances.length ? (
          <ul className="portal-document-list">
            {remittances.map((remittance) => (
              <li key={remittance.id}>
                <span className="portal-document-icon" aria-hidden="true"><Receipt size={15} strokeWidth={1.75}/></span>
                <span className="portal-document-main">
                  <strong>
                    {remittance.amount === null ? t("rem.receipt_title") : `${remittance.currency ?? ""} ${remittance.amount}`}
                    {remittance.paid_on ? ` · paid ${portalDate(remittance.paid_on)}` : ""}
                  </strong>
                  <span>
                    {remittance.filename} · {portalFileSize(remittance.size_bytes)} · sent {portalDate(remittance.uploaded_at)}
                    {remittance.note ? ` · ${remittance.note}` : ""}
                  </span>
                </span>
                <OpsBadge tone={remittance.review_state === "acknowledged" ? "success" : "info"}>
                  {remittance.review_state === "acknowledged" ? t("rem.acknowledged") : t("rem.with_accounts")}
                </OpsBadge>
                <a
                  className="ops-button"
                  data-variant="secondary"
                  data-size="sm"
                  href={`/api/portal/invoices/${encodeURIComponent(reference)}/remittance/${encodeURIComponent(remittance.id)}`}
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <OpsEmptyState
            compact
            kind="neutral"
            icon={<Receipt size={18}/>}
            title={t("rem.empty_title")}
            description={t("rem.empty_description")}
          />
        )}
      </div>
    </OpsSurface>
  );
}
