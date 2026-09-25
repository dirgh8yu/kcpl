"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { OpsButton, OpsNotice, OpsSurface } from "../../../admin/operations-ui";
import { portalTranslator, type PortalLocale } from "../../portal-i18n";

/** One question once the shipment is delivered. The rules are
 * ratePortalDelivery's, shared with the KCPL app. */
export function PortalDeliveryRating({ reference, locale }: { reference: string; locale: PortalLocale }) {
  const t = portalTranslator(locale);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ message: string; reviewUrl: string | null } | null>(null);

  async function send() {
    if (!score || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/shipments/${encodeURIComponent(reference)}/rating`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ score, comment }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; message?: string; reviewUrl?: string | null };
      if (!response.ok || !data.ok) throw new Error(data.error || t("rate.failed"));
      setDone({ message: data.message || t("rate.done"), reviewUrl: data.reviewUrl ?? null });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("rate.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <OpsSurface eyebrow={t("rate.eyebrow")} title={t("rate.done")} priority="success">
        <p className="portal-footnote">{done.message}</p>
        {done.reviewUrl ? (
          <p><a className="ops-button" data-variant="secondary" data-size="sm" href={done.reviewUrl} target="_blank" rel="noopener noreferrer">{t("rate.review")}</a></p>
        ) : null}
      </OpsSurface>
    );
  }

  return (
    <OpsSurface eyebrow={t("rate.eyebrow")} title={t("rate.title")} description={t("rate.description")}>
      {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}
      <div className="delivery-rating" role="radiogroup" aria-label={t("rate.title")}>
        {[1, 2, 3, 4, 5].map((value) => (
          <OpsButton
            key={value}
            type="button"
            variant="secondary"
            size="sm"
            role="radio"
            aria-checked={score === value}
            aria-label={t("rate.score", { score: value })}
            onClick={() => setScore(value)}
            disabled={busy}
          >
            <Star size={14} strokeWidth={1.75} aria-hidden="true" fill={score !== null && value <= score ? "currentColor" : "none"}/>
            <span>{value}</span>
          </OpsButton>
        ))}
      </div>
      {score ? (
        <div className="shipment-thread-form">
          <label className="portal-sr-only" htmlFor="rating-comment">{t("rate.comment_placeholder")}</label>
          <textarea id="rating-comment" rows={2} maxLength={1000} value={comment} disabled={busy} placeholder={t("rate.comment_placeholder")} onChange={(event) => setComment(event.target.value)}/>
          <OpsButton type="button" variant="primary" size="sm" disabled={busy} onClick={() => void send()}>
            {busy ? t("rate.sending") : t("rate.send")}
          </OpsButton>
        </div>
      ) : null}
    </OpsSurface>
  );
}
