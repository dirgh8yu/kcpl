"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Eye, FilePlus2, FileText, GripVertical, History, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  OpsBadge,
  OpsButton,
  OpsDialog,
  OpsEmptyState,
  OpsFact,
  OpsFacts,
  OpsField,
  OpsInlineAlert,
  OpsInspectorHeader,
  OpsInspectorNote,
  OpsKpiRail,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsRailMetric,
  OpsRegisterToolbar,
  OpsScopeTabs,
  OpsSearch,
  OpsTableWrap,
  useAdminPortalContainer,
} from "../operations-ui";
import { useWorkspaceQuery } from "../use-workspace-query";
import { ArrangeableGrid } from "../arrangeable-grid";
import "../arrangeable-grid.css";
import { presetForStateIn, savedLayoutForState, WORKSPACE_PRESETS } from "../operations-arrangeable";
import { useStaffArrangement } from "../use-staff-arrangement";
import { CustomiseMenu, CustomiseRow } from "../ops-register";
import {
  generatedFreightDocumentKinds,
  generatedFreightDocumentLabels,
  generatedReference,
  primaryCarriageDocumentKind,
  type FreightDocumentQueueRow,
  type GeneratedFreightDocumentKind,
  type GeneratedFreightDocumentRow,
} from "./freight-documents";

type Summary = { eligible: number; missing_primary: number; generated_current: number; review_pending: number };
type Focus = "all" | "missing" | "generated" | "review";
type FreightDocSectionId = "rail" | "queue";
const FREIGHT_DOC_SECTION_LABELS: Record<FreightDocSectionId, string> = { rail: "Production summary", queue: "Document queue" };
type InspectorTab = "preview" | "details" | "revisions" | "generate";
type FormState = {
  kind: GeneratedFreightDocumentKind;
  shipper: string;
  consignee: string;
  notifyParty: string;
  cargoDescription: string;
  marksAndNumbers: string;
  packageType: string;
  freightTerms: string;
  placeOfReceipt: string;
  placeOfDelivery: string;
  masterReference: string;
  houseReference: string;
  incoterm: string;
  specialInstructions: string;
  customerSafe: boolean;
};

const emptyForm: FormState = {
  kind: "shipping_instruction",
  shipper: "",
  consignee: "",
  notifyParty: "",
  cargoDescription: "",
  marksAndNumbers: "",
  packageType: "",
  freightTerms: "",
  placeOfReceipt: "",
  placeOfDelivery: "",
  masterReference: "",
  houseReference: "",
  incoterm: "",
  specialInstructions: "",
  customerSafe: false,
};

const FOCUS_OPTIONS: Array<{ value: Focus; label: string }> = [
  { value: "all", label: "All" },
  { value: "missing", label: "Missing primary" },
  { value: "review", label: "Awaiting review" },
  { value: "generated", label: "Generated" },
];
const PAGE_SIZE = 10;

function formFor(row: FreightDocumentQueueRow): FormState {
  const primary = primaryCarriageDocumentKind(row.mode);
  const kind = primary && row.recommended_kinds.includes(primary) ? primary : row.recommended_kinds[0] ?? "shipping_instruction";
  return {
    ...emptyForm,
    kind,
    cargoDescription: row.cargo_description,
    packageType: row.pieces > 0 ? `${row.pieces} package(s)` : "",
    placeOfReceipt: row.origin,
    placeOfDelivery: row.destination,
    masterReference: row.booking_reference ?? "",
    houseReference: generatedReference(kind, row.reference),
  };
}

function currentDocuments(row: FreightDocumentQueueRow) {
  return row.generated_documents
    .filter((document) => !document.superseded)
    .sort((a, b) => b.revision - a.revision || b.generated_at.localeCompare(a.generated_at));
}

function latestCurrentDocument(row: FreightDocumentQueueRow) {
  return currentDocuments(row)[0] ?? null;
}

function hasPendingReview(row: FreightDocumentQueueRow) {
  return currentDocuments(row).some((document) => ["received", "under_review"].includes(document.review_status));
}

function rowMatchesFocus(row: FreightDocumentQueueRow, focus: Focus) {
  if (focus === "missing") return row.missing_primary_carriage_document;
  if (focus === "generated") return row.current_generated_count > 0;
  if (focus === "review") return hasPendingReview(row);
  return true;
}

function queueState(row: FreightDocumentQueueRow) {
  if (hasPendingReview(row)) return { label: "Awaiting review", tone: "warning" as const };
  if (row.missing_primary_carriage_document) return { label: "Primary draft missing", tone: "warning" as const };
  if (row.current_generated_count > 0) return { label: "Generated", tone: "success" as const };
  return { label: "Ready", tone: "neutral" as const };
}

function reviewState(document: GeneratedFreightDocumentRow | null) {
  if (!document) return { label: "Not generated", tone: "neutral" as const };
  const status = document.review_status.replaceAll("_", " ");
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  if (document.review_status === "verified") return { label: "Verified", tone: "success" as const };
  if (document.review_status === "rejected") return { label: "Rejected", tone: "danger" as const };
  if (document.review_status === "received" || document.review_status === "under_review") return { label, tone: "warning" as const };
  return { label, tone: "neutral" as const };
}

/** Filenames lead with the Job File reference, so keep the distinctive tail visible. */
function middleTruncate(value: string, max = 28) {
  if (value.length <= max) return value;
  const tail = Math.ceil((max - 1) * 0.6);
  return `${value.slice(0, max - 1 - tail)}…${value.slice(-tail)}`;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kathmandu" }).format(date);
}

export function FreightDocumentsWorkspace({
  initialRows,
  initialSummary,
  initialShipment,
}: {
  initialRows: FreightDocumentQueueRow[];
  initialSummary: Summary;
  initialShipment?: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const portalContainer = useAdminPortalContainer();
  const { params, search, update } = useWorkspaceQuery();
  const query = params.get("q") ?? "";
  const requestedFocus = params.get("view");
  const focus: Focus = FOCUS_OPTIONS.some((option) => option.value === requestedFocus) ? requestedFocus as Focus : "all";
  const [allowInitialSelection, setAllowInitialSelection] = useState(Boolean(initialShipment));
  const selectedReference = (params.get("selected") ?? (allowInitialSelection ? initialShipment : "") ?? "").trim().toUpperCase();
  const selected = useMemo(() => rows.find((row) => row.reference === selectedReference) ?? null, [rows, selectedReference]);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "danger">("success");

  // Per-staff workspace layout: the production rail and document queue are
  // arrangeable sections persisted server-side (same primitive as Overview).
  const {
    state: arrangement,
    status: arrangeStatus,
    applyState: setArrangement,
    toggleHidden,
    moveSectionToward,
    resetArrangement,
    saved,
    saveCurrentAs,
    deleteSaved,
  } = useStaffArrangement("freight-documents");
  const [arranging, setArranging] = useState(false);
  const [arrangeMenu, setArrangeMenu] = useState(false);
  const activePreset = presetForStateIn("freight-documents", arrangement);
  const savedMatch = savedLayoutForState(saved, arrangement);
  const onSectionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, id: FreightDocSectionId) => {
      if (!arranging || event.defaultPrevented) return;
      if ((event.altKey || event.metaKey) && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        const target = event.target as HTMLElement | null;
        if (target && target.closest("input, textarea, select")) return;
        event.preventDefault();
        moveSectionToward(id, event.key === "ArrowUp" ? "up" : "down");
        return;
      }
      if ((event.key === "h" || event.key === "H") && document.activeElement === event.currentTarget) {
        event.preventDefault();
        toggleHidden(id);
      }
    },
    [arranging, moveSectionToward, toggleHidden],
  );

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (!rowMatchesFocus(row, focus)) return false;
      if (!terms.length) return true;
      const generatedContext = row.generated_documents.flatMap((document) => [document.label, document.filename, document.review_status]).join(" ");
      const haystack = [
        row.reference,
        row.booking_reference ?? "",
        row.customer_name,
        row.origin,
        row.destination,
        row.mode,
        row.carrier_name ?? "",
        row.cargo_description,
        generatedContext,
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [focus, query, rows]);

  const focusCounts = useMemo(() => ({
    all: rows.length,
    missing: rows.filter((row) => row.missing_primary_carriage_document).length,
    generated: rows.filter((row) => row.current_generated_count > 0).length,
    review: rows.filter(hasPendingReview).length,
  }), [rows]);
  const documentStats = useMemo(() => ({
    current: rows.reduce((count, row) => count + row.current_generated_count, 0),
    revisions: rows.reduce((count, row) => count + row.generated_documents.length, 0),
    customerSafe: rows.reduce((count, row) => count + row.generated_documents.filter((document) => !document.superseded && document.customer_safe).length, 0),
  }), [rows]);
  const requestedPage = Number(params.get("page") ?? "1");
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(Math.floor(requestedPage), pageCount) : 1;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAllowInitialSelection(false);
        update({ selected: null, shipment: null });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected, update]);

  function openEditor(row: FreightDocumentQueueRow) {
    setAllowInitialSelection(false);
    update({ selected: row.reference, shipment: null }, "push");
  }

  function closeEditor() {
    setAllowInitialSelection(false);
    update({ selected: null, shipment: null });
  }

  async function refresh(showNotice = true) {
    const response = await fetch("/api/admin/freight-documents", { cache: "no-store" });
    const data = await response.json() as { ok?: boolean; rows?: FreightDocumentQueueRow[]; summary?: Summary; error?: string };
    if (!response.ok || !data.ok || !data.rows || !data.summary) throw new Error(data.error || "Could not refresh freight documents.");
    setRows(data.rows);
    setSummary(data.summary);
    if (selectedReference && !data.rows.some((row) => row.reference === selectedReference)) closeEditor();
    if (showNotice) {
      setMessageTone("success");
      setMessage("Freight document workspace refreshed.");
    }
  }

  async function openDocument(reference: string, documentId: string) {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/freight-documents?reference=${encodeURIComponent(reference)}&document=${encodeURIComponent(documentId)}`, { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !data.ok || !data.url) throw new Error(data.error || "Document could not be opened.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessageTone("danger");
      setMessage(error instanceof Error ? error.message : "Document could not be opened.");
    }
  }

  const returnTo = `/admin/freight-documents${search}`;
  const hasFilters = Boolean(query) || focus !== "all";

  /** Every scope control (rail, tabs, summary actions) routes through the one update the tabs always used. */
  function setFocus(next: Focus) {
    setAllowInitialSelection(false);
    update({ view: next === "all" ? null : next, page: null, selected: null, shipment: null });
  }

  return (
    <OpsPage className="freight-documents-register">
      <OpsPageHeader
        title="Freight Documents"
        description="Produce, review and open controlled carriage documents without losing the shipment context."
        actions={<Link href="/admin/documents" className="ops-button" data-variant="secondary" data-size="md"><FileText size={16} strokeWidth={1.75} aria-hidden="true"/>Document Vault</Link>}
      />

      <div className="px-4 pt-3 md:px-6">
        <CustomiseRow
          arranging={arranging}
          onToggle={() => { setArranging(v => !v); setArrangeMenu(false); }}
          arrangeMenu={arrangeMenu}
          onToggleMenu={() => setArrangeMenu(v => !v)}
          arrangement={arrangement}
          presets={WORKSPACE_PRESETS["freight-documents"]}
          activePreset={activePreset}
          applyPreset={preset => setArrangement(preset.layout)}
          onReset={resetArrangement}
          status={arrangeStatus}
          sectionLabels={FREIGHT_DOC_SECTION_LABELS}
          saved={saved}
          onSaveCurrent={saveCurrentAs}
          onDeleteSaved={deleteSaved}
          savedMatchId={savedMatch?.id ?? null}
          onApplySaved={(layout) => setArrangement({ order: layout.order, hidden: layout.hidden })}
        />
        <CustomiseMenu open={arranging && arrangeMenu} arrangement={arrangement} onToggle={toggleHidden} sectionLabels={FREIGHT_DOC_SECTION_LABELS}/>
      </div>

      <ArrangeableGrid
        workspace="freight-documents"
        state={arrangement}
        onChange={setArrangement}
        arranging={arranging}
      >
        {(id: FreightDocSectionId, { handleProps, hidden }) => {
          if (hidden) return null;
          const handle = (
            <button type="button" className="ops-arrange-handle" {...handleProps} aria-label={`Move ${FREIGHT_DOC_SECTION_LABELS[id]}`} tabIndex={arranging ? 0 : -1} onKeyDown={(event) => onSectionKeyDown(event, id)}>
              <GripVertical size={13} strokeWidth={1.75} aria-hidden="true"/>
            </button>
          );
          if (id === "rail") {
            return (
              <div className="px-4 pt-3 md:px-6">
                {handle}
                {/* One rail instead of five cards. Segments that already mapped to a
                    queue scope keep that behaviour; the rest are plain statistics. */}
                <OpsKpiRail label="Document production summary">
                  <OpsRailMetric label="Primary draft" value={summary.missing_primary} detail="missing" tone="warning" active={focus === "missing"} onClick={() => setFocus(focus === "missing" ? "all" : "missing")} title="Job Files without the mode-specific KCPL carriage draft"/>
                  <OpsRailMetric label="Awaiting review" value={summary.review_pending} detail="revisions" tone="warning" active={focus === "review"} onClick={() => setFocus(focus === "review" ? "all" : "review")} title="Generated revisions waiting for staff review"/>
                  <OpsRailMetric label="Current drafts" value={documentStats.current} detail={`${documentStats.customerSafe} customer-safe`} active={focus === "generated"} onClick={() => setFocus(focus === "generated" ? "all" : "generated")}/>
                  <OpsRailMetric label="Revisions" value={documentStats.revisions} detail="incl. superseded" title="Current and superseded PDFs"/>
                  <OpsRailMetric label="Job files" value={summary.eligible} detail="eligible" active={focus === "all"} onClick={() => { setAllowInitialSelection(false); update({ view: null, selected: null, shipment: null }); }} title="Accessible, non-cancelled shipments in this snapshot"/>
                </OpsKpiRail>
              </div>
            );
          }
          return (
      <div className="px-4 pb-8 pt-4 md:px-6">
        {handle}
        {message ? <div className="mb-3"><OpsNotice tone={messageTone} onDismiss={() => setMessage("")}>{message}</OpsNotice></div> : null}
        {summary.missing_primary > 0 || summary.review_pending > 0 ? (
          <div className="mb-3">
            <OpsInlineAlert
              icon={<AlertCircle size={14} strokeWidth={1.75} aria-hidden="true"/>}
              actions={(
                <>
                  {summary.missing_primary > 0 ? <button type="button" className="ops-inline-alert-action" aria-pressed={focus === "missing"} onClick={() => setFocus("missing")}>Show missing</button> : null}
                  {summary.review_pending > 0 ? <button type="button" className="ops-inline-alert-action" aria-pressed={focus === "review"} onClick={() => setFocus("review")}>Show review queue</button> : null}
                </>
              )}
            >
              {summary.missing_primary > 0 ? <><strong>{summary.missing_primary}</strong> Job File{summary.missing_primary === 1 ? "" : "s"} missing the primary KCPL carriage draft</> : null}
              {summary.missing_primary > 0 && summary.review_pending > 0 ? " · " : null}
              {summary.review_pending > 0 ? <><strong>{summary.review_pending}</strong> generated revision{summary.review_pending === 1 ? "" : "s"} awaiting review</> : null}
            </OpsInlineAlert>
          </div>
        ) : null}

        <OpsRegisterToolbar
          search={(
            <OpsSearch
              value={query}
              onChange={(event) => update({ q: event.target.value || null, page: null })}
              placeholder="Search shipment, booking, customer, route, carrier or cargo…"
              aria-label="Search freight document jobs"
            />
          )}
          actions={(
            <>
              {hasFilters ? <OpsButton size="xs" variant="ghost" onClick={() => { setAllowInitialSelection(false); update({ q: null, view: null, page: null, selected: null, shipment: null }); }}>Reset</OpsButton> : null}
              <OpsButton
                variant="secondary"
                disabled={refreshing}
                onClick={() => {
                  setRefreshing(true);
                  refresh().catch((error) => {
                    setMessageTone("danger");
                    setMessage(error instanceof Error ? error.message : "Could not refresh freight documents.");
                  }).finally(() => setRefreshing(false));
                }}
              >
                <RefreshCw size={14} strokeWidth={1.75} className={refreshing ? "app-refreshing" : ""} aria-hidden="true"/>{refreshing ? "Refreshing…" : "Refresh"}
              </OpsButton>
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <span className="ops-result-count" aria-live="polite">{filtered.length === rows.length ? `${rows.length} Job Files` : `${filtered.length} of ${rows.length}`} · {documentStats.revisions} revisions</span>
            </>
          )}
          tabs={<OpsScopeTabs label="Freight document filters" items={FOCUS_OPTIONS.map((option) => ({ ...option, count: focusCounts[option.value] }))} value={focus} onChange={setFocus}/>}
        />

        <section className="ops-surface freight-documents-surface" aria-label="Freight document production queue">
          {filtered.length ? (
            <OpsTableWrap>
              <table className="ops-table ops-register-table freight-documents-table" aria-label="Freight document production queue">
                <thead>
                  <tr>
                    <th>Job file</th>
                    <th>Route</th>
                    <th>Current document</th>
                    <th className="freight-documents-col-file">Filename / revision</th>
                    <th>Review · Access</th>
                    <th>Queue status</th>
                    <th className="text-right"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const latest = latestCurrentDocument(row);
                    const status = queueState(row);
                    const review = reviewState(latest);
                    const selectedRow = selected?.reference === row.reference;
                    const primaryKind = primaryCarriageDocumentKind(row.mode);
                    const primaryLabel = primaryKind ? generatedFreightDocumentLabels[primaryKind] : "Primary carriage draft";
                    const pendingReview = hasPendingReview(row);
                    return (
                      <tr key={row.reference} data-selected={selectedRow || undefined} aria-current={selectedRow || undefined} tabIndex={0} onClick={() => openEditor(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEditor(row); } }}>
                        <td>
                          <Link className="ops-cell-ref ops-mono" href={`/admin/jobs/${encodeURIComponent(row.reference)}?returnTo=${encodeURIComponent(returnTo)}`} onClick={(event) => event.stopPropagation()}>{row.reference}</Link>
                          <span className="ops-cell-secondary ops-cell-clamp" title={`${row.customer_name || "Customer not linked"}${row.booking_reference ? ` · Booking ${row.booking_reference}` : ""}`}>{row.customer_name || "Customer not linked"}{row.booking_reference ? ` · ${row.booking_reference}` : ""}</span>
                        </td>
                        <td>
                          <span className="ops-cell-primary freight-documents-route" title={`${row.origin} → ${row.destination}`}>{row.origin} → {row.destination}</span>
                          <span className="ops-cell-secondary freight-documents-route">{row.mode || "Mode not set"}{row.carrier_name ? ` · ${row.carrier_name}` : ""}</span>
                        </td>
                        <td>
                          {latest ? <span className="ops-cell-primary freight-documents-doc" title={latest.label}>{latest.label}</span> : <span className="ops-cell-primary freight-documents-none">Not generated</span>}
                          {row.missing_primary_carriage_document ? <span className="ops-cell-secondary freight-documents-doc freight-documents-required" title={`${primaryLabel} ${latest ? "still required" : "required"}`}>Needs {primaryLabel}</span> : null}
                        </td>
                        <td className="freight-documents-col-file">
                          {latest ? (
                            <>
                              <span className="ops-cell-primary ops-cell-clamp freight-documents-filename" title={latest.filename}>{middleTruncate(latest.filename, 24)}</span>
                              <span className="ops-cell-secondary">R{latest.revision} · {shortDate(latest.generated_at)}{row.current_generated_count > 1 ? ` · ${row.current_generated_count} current` : ""}</span>
                            </>
                          ) : <span className="ops-cell-muted">—</span>}
                        </td>
                        <td>
                          <div className="freight-documents-review">
                            <OpsBadge tone={review.tone}>{review.label}</OpsBadge>
                            {latest ? (
                              latest.customer_safe
                                ? <span className="freight-documents-safety" data-safe="true"><ShieldCheck size={12} strokeWidth={1.75} aria-hidden="true"/>Customer-safe</span>
                                : <span className="freight-documents-safety">Internal</span>
                            ) : null}
                          </div>
                        </td>
                        <td><OpsBadge tone={status.tone} dot={row.missing_primary_carriage_document && !pendingReview}>{status.label}</OpsBadge></td>
                        <td>
                          <div className="ops-cell-actions">
                            {latest ? <OpsButton size="xs" variant="ghost" aria-label={`Open PDF for ${row.reference}`} title="Open the current PDF in a new tab" onClick={(event) => { event.stopPropagation(); void openDocument(row.reference, latest.document_id); }}>PDF</OpsButton> : null}
                            <OpsButton size="xs" variant={row.missing_primary_carriage_document || pendingReview ? "secondary" : "ghost"} className="freight-documents-action" onClick={(event) => { event.stopPropagation(); openEditor(row); }}>{row.missing_primary_carriage_document ? "Produce primary" : pendingReview ? "Continue" : "Manage"}</OpsButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </OpsTableWrap>
          ) : (
            <OpsEmptyState
              compact
              kind={hasFilters ? "search" : "neutral"}
              title={hasFilters ? "No Job Files match this view" : "No eligible Job Files"}
              description={hasFilters ? "Change the document filter or search terms." : "Booked and active shipments will appear here when document generation is available."}
              action={hasFilters ? <OpsButton size="sm" onClick={() => update({ q: null, view: null, page: null })}>Clear filters</OpsButton> : undefined}
            />
          )}
          {filtered.length ? (
            <footer className="ops-register-footer">
              <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} Job File{filtered.length === 1 ? "" : "s"}</span>
              {pageCount > 1 ? (
                <nav className="ops-pager" aria-label="Freight document pages">
                  <button type="button" className="ops-pager-button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} aria-label="Previous page"><ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true"/></button>
                  <span className="px-1">Page {page} of {pageCount}</span>
                  <button type="button" className="ops-pager-button" disabled={page >= pageCount} onClick={() => update({ page: String(page + 1) })} aria-label="Next page"><ChevronRight size={14} strokeWidth={1.75} aria-hidden="true"/></button>
                </nav>
              ) : null}
            </footer>          ) : null}
        </section>
      </div>
          );
        }}
      </ArrangeableGrid>

      {selected ? (
        <FreightDocumentPanel
          key={selected.reference}
          row={selected}
          returnTo={returnTo}
          container={portalContainer}
          onClose={closeEditor}
          onRefresh={() => refresh(false)}
          onOpenDocument={openDocument}
          onMessage={(tone, text) => { setMessageTone(tone); setMessage(text); }}
        />
      ) : null}
    </OpsPage>
  );
}

function FreightDocumentPanel({
  row,
  returnTo,
  container,
  onClose,
  onRefresh,
  onOpenDocument,
  onMessage,
}: {
  row: FreightDocumentQueueRow;
  returnTo: string;
  container: HTMLElement | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onOpenDocument: (reference: string, documentId: string) => Promise<void>;
  onMessage: (tone: "success" | "warning" | "danger", text: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() => formFor(row));
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<InspectorTab>("preview");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const latest = latestCurrentDocument(row);
  const status = queueState(row);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeKind(kind: GeneratedFreightDocumentKind) {
    setForm((current) => ({ ...current, kind, houseReference: generatedReference(kind, row.reference) }));
  }

  async function generate() {
    setBusy(true);
    onMessage("success", "");
    try {
      const response = await fetch("/api/admin/freight-documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference: row.reference, ...form }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; document?: { filename: string } };
      if (!response.ok || !data.ok) throw new Error(data.error || "Document generation failed.");
      await onRefresh();
      onMessage("success", `${data.document?.filename ?? "Freight document"} generated and placed in Document Vault for review.`);
    } catch (error) {
      onMessage("danger", error instanceof Error ? error.message : "Document generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview() {
    if (!latest || previewUrl) return;
    setPreviewBusy(true);
    try {
      const response = await fetch(`/api/admin/freight-documents?reference=${encodeURIComponent(row.reference)}&document=${encodeURIComponent(latest.document_id)}`, { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !data.ok || !data.url) throw new Error(data.error || "Preview could not be loaded.");
      setPreviewUrl(data.url);
    } catch (error) {
      onMessage("danger", error instanceof Error ? error.message : "Preview could not be loaded.");
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <OpsDialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <OpsDialog.Portal container={container ?? undefined}>
        <OpsDialog.Overlay className="ops-dialog-overlay fixed inset-0 z-[70] cursor-default bg-black/10" />
        <OpsDialog.Content className="freight-document-inspector fixed inset-y-0 right-0 z-[80] flex w-full flex-col overflow-hidden border-l border-[var(--admin-line)] bg-[var(--admin-surface)] shadow-xl" aria-label={`Document production for ${row.reference}`}>
          <OpsDialog.Title className="sr-only">{row.reference} document production</OpsDialog.Title>
          <OpsDialog.Description className="sr-only">Generate, review and open controlled carriage documents for this shipment.</OpsDialog.Description>
          <OpsInspectorHeader
            kicker={`${row.reference}${row.booking_reference ? ` · Booking ${row.booking_reference}` : ""}`}
            title="Document production"
            subtitle={`${row.customer_name} · ${row.origin} → ${row.destination} · ${row.mode || "Mode not set"}`}
            actions={(
              <>
                <OpsBadge tone={status.tone}>{status.label}</OpsBadge>
                <OpsDialog.Close asChild>
                  <button type="button" className="ops-inspector-close" aria-label="Close document production panel"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>
                </OpsDialog.Close>
              </>
            )}
          />

          <div className="freight-document-tabs" role="tablist" aria-label="Freight document inspector tabs">
            {([
              ["preview", "Preview", Eye],
              ["details", "Details", FileText],
              ["revisions", "Revisions", History],
              ["generate", "Generate", FilePlus2],
            ] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} className="freight-document-tab" data-active={tab === value || undefined} onClick={() => setTab(value)}>
                <Icon size={14} strokeWidth={1.75} aria-hidden="true"/>{label}
                {value === "revisions" && row.generated_documents.length ? <span className="ops-scope-count">{row.generated_documents.length}</span> : null}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {tab === "preview" ? (
              <PanelSection title="PDF preview" description={latest ? `${latest.filename} · revision ${latest.revision}` : "Generate a controlled draft to preview it here."}>
                {latest ? <div className="freight-document-preview">
                  {previewUrl ? <iframe title={`PDF preview for ${row.reference}`} src={previewUrl}/> : <div className="freight-document-preview-empty"><FileText size={20} strokeWidth={1.75} aria-hidden="true"/><p>Preview the current controlled PDF without leaving this Job File.</p><OpsButton type="button" size="sm" variant="secondary" disabled={previewBusy} onClick={() => void loadPreview()}>{previewBusy ? "Loading preview…" : "Load PDF preview"}</OpsButton></div>}
                </div> : <OpsEmptyState compact title="No PDF to preview" description="Use Generate to create the first controlled revision." action={<OpsButton type="button" size="sm" onClick={() => setTab("generate")}>Generate document</OpsButton>}/>}
              </PanelSection>
            ) : null}
            {tab === "details" ? (
              <>
                <div className="freight-document-section grid gap-2">
                  <OpsInspectorNote tone="neutral" icon={<ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Controlled house drafts">KCPL-generated PDFs are controlled internal/house drafts. Carrier-issued master originals remain authoritative.</OpsInspectorNote>
                  {row.missing_primary_carriage_document && row.current_generated_count > 0 ? <OpsInspectorNote tone="warning" icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Primary carriage draft missing">Other KCPL drafts exist for this Job File, but the mode-specific primary carriage draft is still missing.</OpsInspectorNote> : null}
                </div>

                <PanelSection
                  title="Current controlled draft"
                  action={latest ? (
                    <>
                      {hasPendingReview(row) ? <Link href={`/admin/documents?q=${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="ghost" data-size="xs">Review in Document Vault</Link> : null}
                      <OpsButton size="xs" variant="secondary" onClick={() => void onOpenDocument(row.reference, latest.document_id)}><ExternalLink size={13} strokeWidth={1.75} aria-hidden="true"/>Open PDF</OpsButton>
                    </>
                  ) : undefined}
                >
                  <OpsFacts>
                    <OpsFact label="Document">{latest ? latest.label : "No generated revision yet"}</OpsFact>
                    {latest ? <OpsFact label="Revision">R{latest.revision} · {shortDate(latest.generated_at)}</OpsFact> : null}
                    {latest ? <OpsFact label="Filename">{latest.filename}</OpsFact> : null}
                    {latest ? <OpsFact label="Review">{reviewState(latest).label}</OpsFact> : null}
                    <OpsFact label="Current drafts">{row.current_generated_count}</OpsFact>
                  </OpsFacts>
                  <div className="ops-inspector-actions mt-3">
                    <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}?returnTo=${encodeURIComponent(returnTo)}`} className="ops-button" data-variant="secondary" data-size="xs">Open Job File</Link>
                    <Link href={`/admin/documents?q=${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="ghost" data-size="xs">Document Vault</Link>
                  </div>
                </PanelSection>

                <PanelSection title="Source context" description="Operational context inherited from the Digital Job File.">
                  <OpsFacts>
                    <OpsFact label="Carrier" warning={!row.carrier_name}>{row.carrier_name || "Not assigned"}</OpsFact>
                    <OpsFact label="Booking reference">{row.booking_reference || "Not recorded"}</OpsFact>
                    <OpsFact label="Cargo">{row.cargo_description || "Not recorded"}</OpsFact>
                    <OpsFact label="Pieces / weight">{`${row.pieces || 0} piece${row.pieces === 1 ? "" : "s"} · ${row.weight_kg || 0} kg`}</OpsFact>
                  </OpsFacts>
                </PanelSection>
              </>
            ) : null}

            {tab === "generate" ? <form id="freight-document-generation-form" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
              <PanelSection title="Document" description="Choose the controlled document type and internal reference.">
                <div className="ops-inspector-form">
                  <OpsField label="Document type"><select value={form.kind} onChange={(event) => changeKind(event.target.value as GeneratedFreightDocumentKind)}>{generatedFreightDocumentKinds.filter((kind) => row.recommended_kinds.includes(kind)).map((kind) => <option key={kind} value={kind}>{generatedFreightDocumentLabels[kind]}</option>)}</select></OpsField>
                  <OpsField label="House / internal reference"><input value={form.houseReference} onChange={(event) => patch("houseReference", event.target.value)}/></OpsField>
                </div>
              </PanelSection>

              <PanelSection title="Parties & cargo" description="Capture the legal parties and shipment description used in the controlled draft.">
                <div className="ops-inspector-form">
                  <OpsField label="Shipper"><textarea value={form.shipper} onChange={(event) => patch("shipper", event.target.value)} placeholder="Legal shipper/exporter name and address"/></OpsField>
                  <OpsField label="Consignee"><textarea value={form.consignee} onChange={(event) => patch("consignee", event.target.value)} placeholder="Legal consignee/importer name and address"/></OpsField>
                  <OpsField label="Notify party"><textarea value={form.notifyParty} onChange={(event) => patch("notifyParty", event.target.value)}/></OpsField>
                  <OpsField label="Cargo description"><textarea value={form.cargoDescription} onChange={(event) => patch("cargoDescription", event.target.value)}/></OpsField>
                  <OpsField label="Marks & numbers"><input value={form.marksAndNumbers} onChange={(event) => patch("marksAndNumbers", event.target.value)}/></OpsField>
                  <OpsField label="Package type"><input value={form.packageType} onChange={(event) => patch("packageType", event.target.value)}/></OpsField>
                </div>
              </PanelSection>

              <PanelSection title="Carriage terms" description="Set receipt and delivery places, references and commercial carriage instructions.">
                <div className="ops-inspector-form">
                  <OpsField label="Place of receipt"><input value={form.placeOfReceipt} onChange={(event) => patch("placeOfReceipt", event.target.value)}/></OpsField>
                  <OpsField label="Place of delivery"><input value={form.placeOfDelivery} onChange={(event) => patch("placeOfDelivery", event.target.value)}/></OpsField>
                  <OpsField label="Carrier / master reference"><input value={form.masterReference} onChange={(event) => patch("masterReference", event.target.value)}/></OpsField>
                  <OpsField label="Freight terms"><input value={form.freightTerms} onChange={(event) => patch("freightTerms", event.target.value)} placeholder="Prepaid / collect / as agreed"/></OpsField>
                  <OpsField label="Incoterm"><input value={form.incoterm} onChange={(event) => patch("incoterm", event.target.value)} placeholder="e.g. FOB, CIF, DDP"/></OpsField>
                  <OpsField label="Special instructions"><textarea value={form.specialInstructions} onChange={(event) => patch("specialInstructions", event.target.value)}/></OpsField>
                </div>
              </PanelSection>
            </form> : null}

            {tab === "revisions" ? (
              <PanelSection title="Revision history" description="Current and superseded controlled revisions for this Job File.">
                {row.generated_documents.length ? (
                  <ul className="freight-document-revisions">
                    {row.generated_documents.map((document) => (
                      <li key={document.document_id} data-superseded={document.superseded || undefined}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <strong className="freight-document-revision-title">R{document.revision} · {document.label}</strong>
                            <OpsBadge tone={document.superseded ? "neutral" : reviewState(document).tone}>{document.superseded ? "Superseded" : reviewState(document).label}</OpsBadge>
                            {document.customer_safe ? <OpsBadge tone="success">Customer-safe</OpsBadge> : null}
                          </div>
                          <p className="freight-document-revision-meta" title={document.filename}>{document.filename} · SHA {document.sha256.slice(0, 12)}…</p>
                        </div>
                        <OpsButton size="xs" variant="ghost" onClick={() => void onOpenDocument(row.reference, document.document_id)}><ExternalLink size={13} strokeWidth={1.75} aria-hidden="true"/>Open PDF</OpsButton>
                      </li>
                    ))}
                  </ul>
                ) : <OpsEmptyState compact icon={<FileText size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No generated revisions yet" description="Generate the first controlled draft from the Generate tab."/>}
              </PanelSection>
            ) : null}
          </div>

          {tab === "generate" ? <footer className="freight-document-inspector-footer shrink-0 border-t border-[var(--admin-line)] bg-[var(--admin-surface)]">
            <label className="freight-document-safe-toggle"><input form="freight-document-generation-form" type="checkbox" checked={form.customerSafe} onChange={(event) => patch("customerSafe", event.target.checked)}/><span>Mark this draft customer-safe after staff checks the content.</span></label>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="freight-document-primary-state" data-missing={row.missing_primary_carriage_document || undefined}>{row.missing_primary_carriage_document ? <><AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>Primary carriage draft missing</> : <><CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>Primary carriage draft present</>}</span>
              <OpsButton form="freight-document-generation-form" type="submit" variant="primary" disabled={busy}><FilePlus2 size={16} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Generating…" : "Generate PDF"}</OpsButton>
            </div>
          </footer> : null}
        </OpsDialog.Content>
      </OpsDialog.Portal>
    </OpsDialog.Root>
  );
}

function PanelSection({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="freight-document-section">
      <div className="ops-inspector-section-head">
        <h3>{title}</h3>
        {action ? <div className="ops-inspector-section-action">{action}</div> : null}
      </div>
      {description ? <p className="ops-inspector-hint">{description}</p> : null}
      <div className={description ? "mt-3" : undefined}>{children}</div>
    </section>
  );
}
