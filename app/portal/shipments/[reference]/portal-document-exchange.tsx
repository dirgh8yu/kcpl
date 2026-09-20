"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, FileUp, RotateCcw } from "lucide-react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsField,
  OpsNotice,
  OpsSurface,
} from "../../../admin/operations-ui";
import {
  customerUploadableDocumentTypes,
  type PortalRequirementRow,
  type PortalRequirementState,
} from "../../portal-access-policy";
import { portalDate, portalDocumentLabel } from "../../portal-format";
import { portalTranslator, type PortalLocale, type PortalTextKey } from "../../portal-i18n";

const stateKeys: Record<PortalRequirementState, PortalTextKey> = {
  needed: "xchg.state_needed",
  resend: "xchg.state_resend",
  with_kcpl: "xchg.state_with_kcpl",
  confirmed: "xchg.state_confirmed",
};

const stateTones: Record<PortalRequirementState, "warning" | "danger" | "info" | "success"> = {
  needed: "warning",
  resend: "danger",
  with_kcpl: "info",
  confirmed: "success",
};

function StateIcon({ state }: { state: PortalRequirementState }) {
  if (state === "confirmed") return <CheckCircle2 size={15} strokeWidth={1.75} aria-hidden="true"/>;
  if (state === "with_kcpl") return <Clock3 size={15} strokeWidth={1.75} aria-hidden="true"/>;
  if (state === "resend") return <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true"/>;
  return <FileUp size={15} strokeWidth={1.75} aria-hidden="true"/>;
}

export function PortalDocumentExchange({
  reference,
  checklist,
  canSend,
  locale,
}: {
  reference: string;
  checklist: PortalRequirementRow[];
  canSend: boolean;
  locale: PortalLocale;
}) {
  const t = portalTranslator(locale);
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [freeType, setFreeType] = useState<string>("commercial_invoice");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function send(documentType: string, file: File) {
    if (busy) return;
    setBusy(documentType);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("documentType", documentType);
      const response = await fetch(`/api/portal/documents/${encodeURIComponent(reference)}`, { method: "POST", body });
      const data = await response.json() as { ok?: boolean; error?: string; message?: string; duplicate?: boolean };
      if (!response.ok || !data.ok) throw new Error(data.error || t("xchg.failed"));
      setNotice(data.message ?? t("xchg.sent"));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("xchg.failed"));
    } finally {
      setBusy("");
    }
  }

  function pick(documentType: string) {
    inputs.current[documentType]?.click();
  }

  const outstanding = checklist.filter((row) => row.state === "needed" || row.state === "resend");

  return (
    <OpsSurface
      id="documents"
      eyebrow={t("overview.paperwork_eyebrow")}
      title={t("xchg.title")}
      description={outstanding.length
        ? t("xchg.description_outstanding")
        : t("xchg.description_clear")}
      priority={outstanding.some((row) => row.required) ? "warning" : "normal"}
    >
      <div className="portal-exchange">
        {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
        {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

        {checklist.length ? (
          <ul className="portal-checklist">
            {checklist.map((row) => (
              <li key={row.document_type} data-state={row.state}>
                <span className="portal-checklist-mark" aria-hidden="true"><StateIcon state={row.state}/></span>
                <span className="portal-checklist-main">
                  <strong>{portalDocumentLabel(row.document_type, locale)}</strong>
                  <span>
                    {row.required ? t("xchg.required") : t("xchg.if_available")}
                    {row.last_submitted_at ? t("xchg.last_sent", { date: portalDate(row.last_submitted_at) }) : ""}
                    {row.state === "resend" ? t("xchg.asked_again") : ""}
                    {!row.uploadable && row.state !== "confirmed" ? t("xchg.kcpl_prepares") : ""}
                  </span>
                </span>
                <OpsBadge tone={stateTones[row.state]} dot>{t(stateKeys[row.state])}</OpsBadge>
                {canSend && row.uploadable && row.state !== "confirmed" ? (
                  <>
                    <input
                      ref={(node) => { inputs.current[row.document_type] = node; }}
                      type="file"
                      className="portal-file-input"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      aria-label={t("xchg.send_aria", { document: portalDocumentLabel(row.document_type, locale) })}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void send(row.document_type, file);
                      }}
                    />
                    <OpsButton
                      size="sm"
                      variant={row.state === "needed" || row.state === "resend" ? "primary" : "secondary"}
                      disabled={busy === row.document_type}
                      onClick={() => pick(row.document_type)}
                    >
                      {busy === row.document_type ? t("xchg.sending") : t("xchg.send_file")}
                    </OpsButton>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <OpsEmptyState
            compact
            kind="healthy"
            icon={<FileUp size={18}/>}
            title={t("xchg.no_checklist_title")}
            description={t("xchg.no_checklist_description")}
          />
        )}

        {canSend ? (
          <div className="portal-exchange-free">
            <OpsField label={t("xchg.free_label")} hint={t("xchg.free_hint")}>
              <select value={freeType} onChange={(event) => setFreeType(event.target.value)} disabled={Boolean(busy)}>
                {customerUploadableDocumentTypes.map((type) => (
                  <option key={type} value={type}>{portalDocumentLabel(type, locale)}</option>
                ))}
              </select>
            </OpsField>
            <input
              ref={(node) => { inputs.current.__free = node; }}
              type="file"
              className="portal-file-input"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              aria-label={t("xchg.choose_aria")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void send(freeType, file);
              }}
            />
            <OpsButton size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => pick("__free")}>
              <FileUp size={14} strokeWidth={1.75} aria-hidden="true"/>
              <span>{busy === freeType ? t("xchg.sending") : t("xchg.choose_file")}</span>
            </OpsButton>
          </div>
        ) : (
          <p className="portal-footnote">{t("xchg.read_only")}</p>
        )}
      </div>
    </OpsSurface>
  );
}
