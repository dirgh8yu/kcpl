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

const stateLabels: Record<PortalRequirementState, string> = {
  needed: "Needed",
  resend: "Send again",
  with_kcpl: "With KCPL",
  confirmed: "Confirmed",
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
}: {
  reference: string;
  checklist: PortalRequirementRow[];
  canSend: boolean;
}) {
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
      if (!response.ok || !data.ok) throw new Error(data.error || "The document could not be sent.");
      setNotice(data.message ?? "Sent to KCPL.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The document could not be sent.");
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
      eyebrow="Paperwork"
      title="What KCPL needs from you"
      description={outstanding.length
        ? "Send these and KCPL will confirm each one once the team has checked it."
        : "Nothing is outstanding on this shipment."}
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
                  <strong>{portalDocumentLabel(row.document_type)}</strong>
                  <span>
                    {row.required ? "Required" : "If available"}
                    {row.last_submitted_at ? ` · last sent ${portalDate(row.last_submitted_at)}` : ""}
                    {row.state === "resend" ? " · KCPL asked for this to be sent again" : ""}
                    {!row.uploadable && row.state !== "confirmed" ? " · KCPL prepares this one" : ""}
                  </span>
                </span>
                <OpsBadge tone={stateTones[row.state]} dot>{stateLabels[row.state]}</OpsBadge>
                {canSend && row.uploadable && row.state !== "confirmed" ? (
                  <>
                    <input
                      ref={(node) => { inputs.current[row.document_type] = node; }}
                      type="file"
                      className="portal-file-input"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      aria-label={`Send ${portalDocumentLabel(row.document_type)} to KCPL`}
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
                      {busy === row.document_type ? "Sending…" : "Send file"}
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
            title="No document checklist on this shipment"
            description="KCPL has not listed any paperwork requirements here. You can still send a document below."
          />
        )}

        {canSend ? (
          <div className="portal-exchange-free">
            <OpsField label="Send something else" hint="PDF, JPEG, PNG or WEBP, up to 10 MB.">
              <select value={freeType} onChange={(event) => setFreeType(event.target.value)} disabled={Boolean(busy)}>
                {customerUploadableDocumentTypes.map((type) => (
                  <option key={type} value={type}>{portalDocumentLabel(type)}</option>
                ))}
              </select>
            </OpsField>
            <input
              ref={(node) => { inputs.current.__free = node; }}
              type="file"
              className="portal-file-input"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              aria-label="Choose a document to send to KCPL"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void send(freeType, file);
              }}
            />
            <OpsButton size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => pick("__free")}>
              <FileUp size={14} strokeWidth={1.75} aria-hidden="true"/>
              <span>{busy === freeType ? "Sending…" : "Choose file"}</span>
            </OpsButton>
          </div>
        ) : (
          <p className="portal-footnote">
            This login can view documents but cannot send them. Your account owner or KCPL account manager can change that.
          </p>
        )}
      </div>
    </OpsSurface>
  );
}
