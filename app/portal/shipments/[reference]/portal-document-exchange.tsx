"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, FileUp, RotateCcw } from "lucide-react";
import {
  OpsBadge,
  OpsButton,
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
  requested,
}: {
  reference: string;
  checklist: PortalRequirementRow[];
  canSend: boolean;
  locale: PortalLocale;
  /** The document a "KCPL needs…" notice links to: marked, so the one
   * asked for stands out where the link lands (#documents). */
  requested?: string | null;
}) {
  const t = portalTranslator(locale);
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [freeType, setFreeType] = useState<string>("commercial_invoice");
  const [another, setAnother] = useState(false);
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

  // What is asked of the customer is paper they send. Paper KCPL prepares
  // (a bill of lading) arrives under Documents once released, and a confirmed
  // document is already there with its badge; this list is what is still open.
  const rows = checklist.filter((row) => row.uploadable && (row.state !== "confirmed" || row.document_type === requested));
  const outstanding = rows.filter((row) => row.state === "needed" || row.state === "resend");
  if (!rows.length && !canSend) return null;

  const freeForm = (
    <div className="portal-exchange-free">
      <OpsField label={t("common.document")} hint={t("xchg.free_hint")}>
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
  );

  return (
    <OpsSurface
      id="documents"
      title={rows.length ? t("xchg.title") : t("xchg.send_title")}
      priority={outstanding.some((row) => row.required) ? "warning" : "normal"}
    >
      <div className="portal-exchange">
        {notice ? <OpsNotice tone="success" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
        {error ? <OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice> : null}

        {rows.length ? (
          <ul className="portal-checklist">
            {rows.map((row) => {
              const detail = [
                row.required ? "" : t("xchg.if_available"),
                row.last_submitted_at ? t("xchg.last_sent", { date: portalDate(row.last_submitted_at) }) : "",
                row.state === "resend" ? t("xchg.asked_again") : "",
              ].filter(Boolean).join(" · ");
              const sendable = canSend && row.state !== "confirmed";
              return (
                <li key={row.document_type} data-state={row.state} data-requested={row.document_type === requested ? "" : undefined}>
                  <span className="portal-checklist-mark" aria-hidden="true"><StateIcon state={row.state}/></span>
                  <span className="portal-checklist-main">
                    <strong>{portalDocumentLabel(row.document_type, locale)}</strong>
                    {detail ? <span>{detail}</span> : null}
                  </span>
                  {/* "Needed" beside a Send button says the same thing twice. */}
                  {row.state !== "needed" || !sendable ? <OpsBadge tone={stateTones[row.state]} dot>{t(stateKeys[row.state])}</OpsBadge> : null}
                  {sendable ? (
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
              );
            })}
          </ul>
        ) : null}

        {/* Anything not on the list waits behind one quiet button, so the
            list stays the page's question. With no list it is the panel. */}
        {!canSend ? (
          <p className="portal-footnote">{t("xchg.read_only")}</p>
        ) : rows.length && !another ? (
          <div className="portal-exchange-more">
            <OpsButton size="sm" variant="ghost" onClick={() => setAnother(true)}>
              <FileUp size={14} strokeWidth={1.75} aria-hidden="true"/>
              <span>{t("xchg.free_label")}</span>
            </OpsButton>
          </div>
        ) : freeForm}
      </div>
    </OpsSurface>
  );
}
