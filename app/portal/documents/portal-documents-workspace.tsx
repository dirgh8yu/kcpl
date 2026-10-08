"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsMono,
  OpsPage,
  OpsPageHeader,
  OpsSearch,
  OpsSurface,
  OpsTableWrap,
} from "../../admin/operations-ui";
import { OpsFilterSelect, OpsRegisterToolbar, OpsScopeTabs } from "../../admin/ops-register";
import type { PortalDocumentRow } from "../portal-data.server";
import { portalDate, portalDocumentLabel, portalFileSize } from "../portal-format";
import { portalTranslator, type PortalLocale } from "../portal-i18n";

export function PortalDocumentsWorkspace({
  documents,
  scanned,
  total,
  locale,
}: {
  documents: PortalDocumentRow[];
  scanned: number;
  total: number;
  locale: PortalLocale;
}) {
  const t = portalTranslator(locale);
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
      return [document.filename, document.shipment_reference, portalDocumentLabel(document.document_type, locale)]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [documents, direction, documentType, query, locale]);

  const sentByYou = documents.filter((document) => document.from_customer).length;
  const filtered = documentType !== "all" || direction !== "all" || query.trim().length > 0;

  return (
    <OpsPage>
      <OpsPageHeader
        title={t("docs.title")}
        meta={total > scanned ? <span>{t("docs.coverage", { scanned, total })}</span> : undefined}
      />
      <div className="ops-content">
        {/* The Document Vault's operating row: direction as scopes with
            counts, the paper type as a filter, as staff see it. Until there is
            a document there is nothing to search or filter. */}
        {documents.length ? <OpsRegisterToolbar
          search={(
            <OpsSearch
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("docs.search_placeholder")}
              aria-label={t("docs.search_label")}
            />
          )}
          actions={(
            <>
              <OpsFilterSelect
                label={t("docs.type")}
                filterLabel={t("docs.type_label")}
                value={documentType}
                allLabel={t("docs.all_types")}
                options={types.map(([type, count]) => ({ value: type, label: `${portalDocumentLabel(type, locale)} · ${count}` }))}
                onChange={setDocumentType}
                align="end"
              />
              {filtered ? (
                <OpsButton size="sm" variant="ghost" onClick={() => { setDocumentType("all"); setDirection("all"); setQuery(""); }}>{t("ships.reset")}</OpsButton>
              ) : null}
              <span className="portal-toolbar-count" aria-live="polite">{query.trim() ? t("ships.shown", { count: rows.length }) : ""}</span>
            </>
          )}
          tabs={(
            <OpsScopeTabs
              label={t("docs.direction_label")}
              value={direction}
              onChange={setDirection}
              items={[
                { value: "all", label: t("docs.all"), count: documents.length },
                { value: "from_kcpl", label: t("docs.from_kcpl"), count: documents.length - sentByYou },
                { value: "from_you", label: t("docs.sent_by_you"), count: sentByYou },
              ]}
            />
          )}
        /> : null}
        <OpsSurface flush>

          {rows.length ? (
            <OpsTableWrap>
              <table className="ops-table ops-register-table portal-stack-table">
                <thead>
                  <tr>
                    <th>{t("common.document")}</th>
                    <th>{t("common.shipment")}</th>
                    <th>{t("docs.col_direction")}</th>
                    <th>{t("docs.col_date")}</th>
                    <th>{t("docs.col_size")}</th>
                    <th><span className="portal-sr-only">{t("common.download")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((document) => (
                    <tr key={`${document.shipment_reference}:${document.id}`}>
                      <td data-cell="primary">
                        <span className="portal-cell-title">{portalDocumentLabel(document.document_type, locale)}</span>
                        <span className="portal-cell-detail">{document.filename}</span>
                      </td>
                      <td data-cell="meta" data-label={t("common.shipment")}>
                        <Link href={`/portal/shipments/${encodeURIComponent(document.shipment_reference)}`} className="portal-row-link">
                          <OpsMono>{document.shipment_reference}</OpsMono>
                        </Link>
                      </td>
                      <td data-cell="status">
                        {document.from_customer ? (
                          <OpsBadge tone={document.review_state === "confirmed" ? "success" : document.review_state === "resend" ? "danger" : "info"}>
                            {document.review_state === "confirmed" ? t("docs.state_confirmed") : document.review_state === "resend" ? t("docs.state_resend") : t("docs.state_with_kcpl")}
                          </OpsBadge>
                        ) : <OpsBadge tone="neutral">{t("docs.from_kcpl")}</OpsBadge>}
                      </td>
                      <td data-cell="meta" data-label={t("docs.col_date")}>{portalDate(document.uploaded_at)}</td>
                      <td data-cell="meta" data-label={t("docs.col_size")}>{portalFileSize(document.size_bytes)}</td>
                      <td data-cell="action">
                        <a
                          className="ops-button"
                          data-variant="secondary"
                          data-size="sm"
                          href={`/api/portal/documents/${encodeURIComponent(document.shipment_reference)}/${encodeURIComponent(document.id)}`}
                        >
                          {t("common.download")}
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
                title={filtered ? t("docs.empty_filtered_title") : t("docs.empty_title")}
                description={filtered
                  ? t("ships.empty_filtered_description")
                  : t("docs.empty_description")}
                action={filtered ? <OpsButton size="sm" variant="secondary" onClick={() => { setDocumentType("all"); setQuery(""); }}>{t("ships.reset_view")}</OpsButton> : undefined}
              />
            </div>
          )}
        </OpsSurface>
      </div>
    </OpsPage>
  );
}
