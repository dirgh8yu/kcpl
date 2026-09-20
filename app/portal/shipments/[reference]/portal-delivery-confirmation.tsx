"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { OpsButton, OpsField, OpsNotice, OpsSurface } from "../../../admin/operations-ui";
import { portalDateTime } from "../../portal-format";
import { portalTranslator, type PortalLocale } from "../../portal-i18n";

export function PortalDeliveryConfirmation({
  reference,
  confirmedAt,
  confirmedBy,
  canConfirm,
  locale,
}: {
  reference: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  canConfirm: boolean;
  locale: PortalLocale;
}) {
  const t = portalTranslator(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/portal/shipments/${encodeURIComponent(reference)}/confirm-delivery`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receivedBy: form.get("receivedBy"), note: form.get("note") }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || t("confirm.failed"));
      setNotice(data.message ?? t("confirm.thanks"));
      setOpen(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("confirm.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (confirmedAt) {
    return (
      <OpsSurface eyebrow={t("confirm.eyebrow")} title={t("confirm.done_title")} priority="success">
        <p className="portal-footnote">
          <CheckCircle2 size={14} aria-hidden="true"/> {t("confirm.done_at", { when: portalDateTime(confirmedAt) })}
          {confirmedBy ? t("confirm.done_by", { name: confirmedBy }) : ""}. {t("confirm.done_note")}
        </p>
      </OpsSurface>
    );
  }

  if (!canConfirm) return null;

  return (
    <OpsSurface
      eyebrow={t("confirm.eyebrow")}
      title={t("confirm.title")}
      description={t("confirm.description")}
      action={<OpsButton variant="primary" size="sm" onClick={() => setOpen((value) => !value)}>{open ? t("common.cancel") : t("confirm.open")}</OpsButton>}
    >
      {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

      {open ? (
        <form onSubmit={confirm} className="portal-form" aria-busy={busy}>
          <div className="portal-form-grid">
            <OpsField label={t("confirm.who_label")} hint={t("confirm.who_hint")}>
              <input name="receivedBy" placeholder={t("confirm.who_placeholder")} disabled={busy}/>
            </OpsField>
          </div>
          <OpsField label={t("confirm.note_label")} hint={t("confirm.note_hint")}>
            <textarea name="note" placeholder={t("confirm.note_placeholder")} disabled={busy}/>
          </OpsField>
          <div className="portal-form-actions">
            <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>
              <PackageCheck size={14} strokeWidth={1.75} aria-hidden="true"/>
              <span>{busy ? t("confirm.sending") : t("confirm.submit")}</span>
            </OpsButton>
          </div>
        </form>
      ) : null}
    </OpsSurface>
  );
}
