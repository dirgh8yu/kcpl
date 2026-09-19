"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import {
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

  const types = useMemo(() => {
    const seen = new Map<string, number>();
    for (const document of documents) seen.set(document.document_type, (seen.get(document.document_type) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [documents]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((document) => {
      if (documentType !== "all" && document.document_type !== documentType) return false;
      if (!needle) return true;
      return [document.filename, document.shipment_reference, portalDocumentLabel(document.document_type)]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [documents, documentType, query]);

  const filtered = documentType !== "all" || query.trim().length > 0;

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow="Kapileshwor Cargo"
        title="Documents"
        description="Bills of lading, air waybills, customs paperwork and proof of delivery that KCPL has released to your account."
        meta={<>
          <span>{documents.length} document{documents.length === 1 ? "" : "s"} released</span>
          {total > scanned ? <span>Covering your {scanned} most recent shipments of {total}</span> : null}
        </>}
      />
      <div className="ops-content">
        <OpsSurface flush>
          <OpsToolbar className="portal-toolbar">
            <OpsSearch
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search file name, type or shipment…"
              aria-label="Search your documents"
            />
            <div className="portal-filter-group" role="group" aria-label="Document type filter">
              <OpsFilterChip active={documentType === "all"} onClick={() => setDocumentType("all")}>All</OpsFilterChip>
              {types.map(([type, count]) => (
                <OpsFilterChip key={type} active={documentType === type} onClick={() => setDocumentType(type)}>
                  {portalDocumentLabel(type)} · {count}
                </OpsFilterChip>
              ))}
            </div>
            {filtered ? (
              <OpsButton size="sm" variant="ghost" onClick={() => { setDocumentType("all"); setQuery(""); }}>Reset</OpsButton>
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
                    <th>Released</th>
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
                title={filtered ? "No documents match this view" : "No documents released yet"}
                description={filtered
                  ? "Try a different type or clear the search."
                  : "KCPL releases shipment paperwork to your account as each document is verified."}
                action={filtered ? <OpsButton size="sm" variant="secondary" onClick={() => { setDocumentType("all"); setQuery(""); }}>Reset view</OpsButton> : undefined}
              />
            </div>
          )}
        </OpsSurface>
      </div>
    </OpsPage>
  );
}
