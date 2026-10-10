"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ShieldAlert } from "lucide-react";
import { OpsBadge, OpsButton, OpsField, OpsNotice, OpsSurface } from "../../../admin/operations-ui";
import { OpsFileDrop } from "../../../admin/ops-file-drop";
import { CLAIM_MAX_PHOTOS, claimKinds, type ClaimKind, type ClaimStatus, type PortalClaimView } from "../../../cargo-claims";
import { portalDate, portalMoney } from "../../portal-format";
import { portalTranslator, type PortalLocale, type PortalTextKey } from "../../portal-i18n";

const kindText: Record<ClaimKind, PortalTextKey> = {
  damage: "claim.kind_damage", shortage: "claim.kind_shortage", loss: "claim.kind_loss", delay: "claim.kind_delay", other: "claim.kind_other",
};
const statusText: Record<ClaimStatus, PortalTextKey> = {
  reported: "claim.status_reported", filed: "claim.status_filed", settled: "claim.status_settled", rejected: "claim.status_rejected", withdrawn: "claim.status_withdrawn",
};
const statusTone: Record<ClaimStatus, "info" | "neutral" | "success" | "danger"> = { reported: "info", filed: "info", settled: "success", rejected: "danger", withdrawn: "neutral" };

/** Report damage, shortage, loss or delay, and follow each claim. The rules are receivePortalClaim's, shared with the KCPL app. */
export function PortalClaims({ reference, claims, canSend, today, locale }: { reference: string; claims: PortalClaimView[]; canSend: boolean; today: string; locale: PortalLocale }) {
  const t = portalTranslator(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const base = `/api/portal/shipments/${encodeURIComponent(reference)}/claims`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.delete("photos");
    for (const photo of photos.slice(0, CLAIM_MAX_PHOTOS)) form.append("photos", photo);
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(base, { method: "POST", body: form });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || t("claim.failed"));
      setNotice({ text: data.message || t("claim.status_reported"), tone: "success" });
      setOpen(false); setPhotos([]); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : t("claim.failed"), tone: "danger" }); }
    finally { setBusy(false); }
  }

  async function withdraw(claim: PortalClaimView) {
    if (!window.confirm(t("claim.withdraw_confirm"))) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`${base}/${encodeURIComponent(claim.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || t("claim.failed"));
      router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : t("claim.failed"), tone: "danger" }); }
    finally { setBusy(false); }
  }

  function settledLine(claim: PortalClaimView) {
    const amount = claim.compensation_amount ? portalMoney(claim.compensation_amount, claim.currency) : "";
    if (claim.compensation_method === "credit_note" && amount) return t("claim.settled_credit_note", { amount });
    if (claim.compensation_method === "refund" && amount) return t("claim.settled_refund", { amount });
    if (claim.compensation_method === "insurer_paid") return t("claim.settled_insurer");
    return null;
  }

  if (!claims.length && !canSend) return null;
  return (
    <OpsSurface
      id="claims"
      title={t("claim.title")}
      description={claims.length ? undefined : t("claim.lead")}
      action={canSend ? <OpsButton variant="secondary" size="xs" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? t("claim.close") : t("claim.report")}</OpsButton> : undefined}
    >
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
      {open && canSend ? <form onSubmit={submit} className="portal-form" aria-busy={busy}>
        <div className="portal-form-grid">
          <OpsField label={t("claim.kind")}><select name="kind" required defaultValue="damage">{claimKinds.map((kind) => <option key={kind} value={kind}>{t(kindText[kind])}</option>)}</select></OpsField>
          <OpsField label={t("claim.noticed_on")}><input type="date" name="noticedOn" required max={today} defaultValue={today}/></OpsField>
        </div>
        <OpsField label={t("claim.description")} hint={t("claim.description_hint")}><textarea name="description" required minLength={10} maxLength={2000} rows={3}/></OpsField>
        <div className="portal-form-grid">
          <OpsField label={t("claim.value")}><input name="claimedAmount" inputMode="decimal"/></OpsField>
          <OpsField label={t("claim.currency")}><input name="currency" maxLength={3} defaultValue="NPR" autoCapitalize="characters"/></OpsField>
        </div>
        <OpsFileDrop prompt={t("claim.photos")} hint={t("claim.photos_hint")} accept="image/jpeg,image/png,image/webp,application/pdf" multiple chosen={photos.length ? t("claim.photos_chosen", { count: photos.length }) : null} onFiles={(files) => setPhotos(files.slice(0, CLAIM_MAX_PHOTOS))}/>
        <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}><ShieldAlert size={14} strokeWidth={1.75} aria-hidden="true"/>{busy ? t("claim.sending") : t("claim.send")}</OpsButton></div>
      </form> : null}
      {claims.length ? <ul className="portal-container-list">{claims.map((claim) => {
        const settled = claim.status === "settled" ? settledLine(claim) : null;
        return <li key={claim.id}>
          <div className="min-w-0">
            <strong>{t("claim.number", { number: claim.number })} · {t(kindText[claim.kind])}</strong>
            <span>{t("claim.reported_on", { date: portalDate(claim.noticed_on) })}{settled ? ` · ${settled}` : claim.claimed_amount ? ` · ${portalMoney(claim.claimed_amount, claim.currency)}` : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <OpsBadge tone={statusTone[claim.status]}>{t(statusText[claim.status])}</OpsBadge>
            {claim.can_withdraw && canSend ? <OpsButton variant="ghost" size="xs" disabled={busy} onClick={() => withdraw(claim)}>{t("claim.withdraw")}</OpsButton> : null}
          </div>
        </li>;
      })}</ul> : null}
    </OpsSurface>
  );
}
