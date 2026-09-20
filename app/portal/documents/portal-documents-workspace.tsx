"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Clock, FileDown, FileText, FileUp } from "lucide-react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsFilterChip,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsSearch,
  OpsSurface,
  OpsTableWrap,
  OpsToolbar,
} from "../../admin/operations-ui";
import { PortalKpiStrip } from "../portal-kpi";
import type { PortalDocumentRow } from "../portal-data.server";
import { portalDate, portalDocumentLabel, portalFileSize } from "../portal-format";

export function PortalDocumentsWorkspace({
  documents,
  scanned,
  total,
}: {
  documents: PortalDocumentRow[];
  scanned: number;
  total: number;
}) {
  const [query, setQuery] = useState("");
  const [documentType, setDocumentType] = useState("all");
  const [direction, setDirection] = useState<"all" | "from_kcpl" | "from_you">("all");

  const types = useMemo(() => {
    const seen = new Map<string, number>();
    for (const document of documents) seen.set(document.document_type, (seen.get(document.document_type) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [documents]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((document) => {
      if (direction === "from_kcpl" && document.from_customer) return false;
      if (direction === "from_you" && !document.from_customer) return false;
      if (documentType !== "all" && document.document_type !== documentType) return false;
      if (!needle) return true;
      return [document.filename, document.shipment_reference, portalDocumentLabel(document.document_type)]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [documents, direction, documentType, query]);

  const sentByYou = documents.filter((document) => document.from_customer).length;
  const releasedByKcpl = documents.length - sentByYou;
  const withKcpl = documents.filter((document) => document.review_state === "with_kcpl").length;
  const resendRequested = documents.filter((document) => document.review_state === "resend").length;
  const filtered = documentType !== "all" || direction !== "all" || query.trim().length > 0;

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Kapileshwor Cargo"
        title="Documents"
        description="Paperwork KCPL has released to you, and the documents you have sent to KCPL."
        meta={<>
          <span>{documents.length} document{documents.length === 1 ? "" : "s"}</span>
          {total > scanned ? <span>Covering your {scanned} most recent shipments of {total}</span> : null}
        </>}
      />
      <div className="ops-content">
        <div className="ops-stack portal-stack">
          <PortalKpiStrip
            items={[
              { key: "total", icon: FileText, label: "Documents on file", value: documents.length, tone: "accent" },
              {
                key: "released",
                icon: FileDown,
                label: "Released by KCPL",
                value: releasedByKcpl,
                tone: "info",
                detail: "Yours to download at any time",
              },
              { key: "sent", icon: FileUp, label: "Sent by you", value: sentByYou, tone: "neutral" },
              {
                key: "with-kcpl",
                icon: Clock,
                label: "With KCPL",
                value: withKcpl,
                tone: withKcpl > 0 ? "warning" : "success",
                detail: withKcpl > 0 ? "Being checked by our team" : "Nothing waiting on review",
              },
              {
                key: "resend",
                icon: AlertTriangle,
                label: "Send again",
                value: resendRequested,
                tone: resendRequested > 0 ? "danger" : "success",
                detail: resendRequested > 0 ? "KCPL needs a clearer copy" : "No documents rejected",
              },
            ]}
          />

          <OpsSurface flush>
            <OpsToolbar className="portal-toolbar">
              <OpsSearch
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search file name, type or shipment…"
                aria-label="Search your documents"
              />
              <div className="portal-filter-group" role="group" aria-label="Document direction filter">
                <OpsFilterChip active={direction === "all"} onClick={() => setDirection("all")}>All</OpsFilterChip>
                <OpsFilterChip active={direction === "from_kcpl"} onClick={() => setDirection("from_kcpl")}>From KCPL</OpsFilterChip>
                <OpsFilterChip active={direction === "from_you"} onClick={() => setDirection("from_you")}>Sent by you · {sentByYou}</OpsFilterChip>
              </div>
              <div className="portal-filter-group" role="group" aria-label="Document type filter">
                <OpsFilterChip active={documentType === "all"} onClick={() => setDocumentType("all")}>All types</OpsFilterChip>
                {types.map(([type, count]) => (
                  <OpsFilterChip key={type} active={documentType === type} onClick={() => setDocumentType(type)}>
                    {portalDocumentLabel(type)} · {count}
                  </OpsFilterChip>
                ))}
              </div>
              {filtered ? (
                <OpsButton size="sm" variant="ghost" onClick={() => { setDocumentType("all"); setDirection("all"); setQuery(""); }}>Reset</OpsButton>
              ) : null}
              <span className="portal-toolbar-count">{rows.length} shown</span>
            </OpsToolbar>

            {rows.length ? (
              <OpsTableWrap>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Shipment</th>
                      <th>Direction</th>
                      <th>Date</th>
                      <th>Size</th>
                      <th><span className="portal-sr-only">Download</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((document) => (
                      <tr key={`${document.shipment_reference}:${document.id}`}>
                        <td>
                          <span className="portal-cell-title">{portalDocumentLabel(document.document_type)}</span>
                          <span className="portal-cell-detail">{document.filename}</span>
                        </td>
                        <td>
                          <Link href={`/portal/shipments/${encodeURIComponent(document.shipment_reference)}`} className="portal-row-link">
                            <OpsMono>{document.shipment_reference}</OpsMono>
                          </Link>
                        </td>
                        <td>
                          {document.from_customer ? (
                            <OpsBadge tone={document.review_state === "confirmed" ? "success" : document.review_state === "resend" ? "danger" : "info"}>
                              {document.review_state === "confirmed" ? "Confirmed" : document.review_state === "resend" ? "Send again" : "With KCPL"}
                            </OpsBadge>
                          ) : <OpsBadge tone="neutral">From KCPL</OpsBadge>}
                        </td>
                        <td>{portalDate(document.uploaded_at)}</td>
                        <td>{portalFileSize(document.size_bytes)}</td>
                        <td>
                          <a
                            className="ops-button"
                            data-variant="secondary"
                            data-size="sm"
                            href={`/api/portal/documents/${encodeURIComponent(document.shipment_reference)}/${encodeURIComponent(document.id)}`}
                          >
                            Download
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : (
              <div className="portal-empty-wrap">
                <OpsEmptyState
                  kind={filtered ? "search" : "neutral"}
                  icon={<FileText size={18}/>}
                  title={filtered ? "No documents match this view" : "No documents yet"}
                  description={filtered
                    ? "Try a different filter or clear the search."
                    : "Paperwork KCPL releases to you, and anything you send from a shipment, is listed here."}
                  action={filtered ? <OpsButton size="sm" variant="secondary" onClick={() => { setDocumentType("all"); setQuery(""); }}>Reset view</OpsButton> : undefined}
                />
              </div>
            )}
          </OpsSurface>
        </div>
      </div>
    </OpsPage>
  );
}
