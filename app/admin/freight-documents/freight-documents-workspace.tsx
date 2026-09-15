"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, ExternalLink, FilePlus2, FileText, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsField,
  OpsMono,
  OpsNotice,
  OpsPage,
  OpsSearch,
  OpsSurface,
  OpsTableWrap,
  OpsToolbar,
} from "../operations-ui";
import { useWorkspaceQuery } from "../use-workspace-query";
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
  const label = document.review_status.replaceAll("_", " ");
  if (document.review_status === "verified") return { label: "Verified", tone: "success" as const };
  if (document.review_status === "rejected") return { label: "Rejected", tone: "danger" as const };
  if (document.review_status === "received" || document.review_status === "under_review") return { label, tone: "warning" as const };
  return { label, tone: "neutral" as const };
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

  return (
    <OpsPage className="freight-documents-register">
      <div className="freight-documents-page min-h-[calc(100dvh-var(--app-toolbar-height))] bg-[var(--admin-canvas)] px-4 pb-8 pt-5 md:px-6">
        <header className="freight-documents-header mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="m-0 text-2xl font-semibold leading-8 tracking-[-0.02em] text-[var(--admin-ink)]">Freight Documents</h1>
            <p className="mt-0.5 text-sm leading-5 text-[var(--admin-muted)]">Controlled production queue for KCPL-generated carriage and execution documents.</p>
            <p className="mt-1.5 text-xs text-[var(--admin-muted)]">{summary.eligible} eligible Job File{summary.eligible === 1 ? "" : "s"} · {summary.missing_primary} missing primary draft · {summary.generated_current} current generated · {summary.review_pending} awaiting review</p>
          </div>
          <Link href="/admin/documents" className="ops-button" data-variant="secondary" data-size="md"><FileText size={15} strokeWidth={1.75} aria-hidden="true"/>Document Vault</Link>
        </header>

        {message ? <div className="mb-4"><OpsNotice tone={messageTone} onDismiss={() => setMessage("")}>{message}</OpsNotice></div> : null}
        {summary.missing_primary > 0 || summary.review_pending > 0 ? (
          <div className="mb-4">
            <OpsNotice tone="warning">
              <span className="flex items-start gap-2">
                <AlertCircle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true"/>
                <span>{summary.missing_primary > 0 ? <><strong>{summary.missing_primary} Job File{summary.missing_primary === 1 ? "" : "s"} missing the primary KCPL carriage draft.</strong> </> : null}{summary.review_pending > 0 ? <><strong>{summary.review_pending} generated revision{summary.review_pending === 1 ? "" : "s"} awaiting review.</strong></> : null}</span>
              </span>
            </OpsNotice>
          </div>
        ) : null}

        <OpsToolbar className="freight-documents-toolbar mb-4">
          <div className="freight-documents-search min-w-[240px] flex-1 basis-[320px] max-w-[420px]">
            <OpsSearch
              value={query}
              onChange={(event) => update({ q: event.target.value || null })}
              placeholder="Search shipment, booking, customer, route, carrier or cargo…"
              aria-label="Search freight document jobs"
            />
          </div>

          <div className="freight-documents-filters flex flex-wrap items-center gap-1.5" role="group" aria-label="Freight document filters">
            {FOCUS_OPTIONS.map((option) => {
              const active = focus === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setAllowInitialSelection(false); update({ view: option.value === "all" ? null : option.value, selected: null, shipment: null }); }}
                  aria-pressed={active}
                  className="freight-documents-filter"
                  data-active={active || undefined}
                >
                  {option.label} <span className="tabular-nums">{focusCounts[option.value]}</span>
                </button>
              );
            })}
          </div>

          <div className="freight-documents-toolbar-actions ml-auto flex items-center gap-2">
            <OpsButton
              size="sm"
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
            {hasFilters ? <OpsButton size="sm" variant="ghost" onClick={() => { setAllowInitialSelection(false); update({ q: null, view: null, selected: null, shipment: null }); }}>Reset</OpsButton> : null}
            <span className="freight-documents-result-count whitespace-nowrap text-xs text-[var(--admin-muted)]">{filtered.length} of {rows.length}</span>
          </div>
        </OpsToolbar>

        <OpsSurface flush className="freight-documents-surface">
          {filtered.length ? (
            <OpsTableWrap>
              <table className="ops-table min-w-[1160px]" aria-label="Freight document production queue">
                <thead>
                  <tr>
                    <th>Job file</th>
                    <th>Route</th>
                    <th>Current document</th>
                    <th>Filename / revision</th>
                    <th>Customer-safe</th>
                    <th>Review</th>
                    <th>Queue status</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const latest = latestCurrentDocument(row);
                    const status = queueState(row);
                    const review = reviewState(latest);
                    const selectedRow = selected?.reference === row.reference;
                    const primaryKind = primaryCarriageDocumentKind(row.mode);
                    const primaryLabel = primaryKind ? generatedFreightDocumentLabels[primaryKind] : "Primary carriage draft";
                    return (
                      <tr key={row.reference} data-selected={selectedRow || undefined} aria-selected={selectedRow} tabIndex={0} onClick={() => openEditor(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEditor(row); } }}>
                        <td>
                          <div className="font-medium"><OpsMono className="text-xs text-[var(--admin-info)]">{row.reference}</OpsMono></div>
                          <div className="mt-0.5 text-xs text-[var(--admin-muted)]">{row.customer_name || "Customer not linked"}{row.booking_reference ? ` · Booking ${row.booking_reference}` : ""}</div>
                        </td>
                        <td>
                          <div className="text-sm text-[var(--admin-ink)]">{row.origin} → {row.destination}</div>
                          <div className="mt-0.5 text-xs text-[var(--admin-muted)]">{row.mode || "Mode not set"}{row.carrier_name ? ` · ${row.carrier_name}` : ""}</div>
                        </td>
                        <td>
                          {latest ? <div><span className="text-sm font-medium">{latest.label}</span>{row.missing_primary_carriage_document ? <div className="mt-0.5 text-xs text-[var(--admin-warning)]">{primaryLabel} still required</div> : null}</div> : <span className="text-sm text-[var(--admin-muted)]">Not generated</span>}
                        </td>
                        <td>
                          {latest ? <div><span className="block max-w-[240px] truncate text-sm text-[var(--admin-ink)]">{latest.filename}</span><span className="mt-0.5 block text-xs text-[var(--admin-muted)]">R{latest.revision} · {shortDate(latest.generated_at)}{row.current_generated_count > 1 ? ` · ${row.current_generated_count} current drafts` : ""}</span></div> : <span className="text-sm text-[var(--admin-muted)]">—</span>}
                        </td>
                        <td>{latest?.customer_safe ? <span className="inline-flex items-center gap-1.5 text-xs text-[var(--admin-success)]"><CheckCircle2 size={14} aria-hidden="true"/>Customer-safe</span> : <span className="text-xs text-[var(--admin-muted)]">Internal</span>}</td>
                        <td><OpsBadge tone={review.tone}>{review.label}</OpsBadge></td>
                        <td><OpsBadge tone={status.tone}>{status.label}</OpsBadge></td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {latest ? <OpsButton size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); void openDocument(row.reference, latest.document_id); }}><ExternalLink size={13} aria-hidden="true"/>PDF</OpsButton> : null}
                            <OpsButton size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); openEditor(row); }}>{row.missing_primary_carriage_document ? "Produce primary" : hasPendingReview(row) ? "Continue" : "Manage"}</OpsButton>
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
              action={hasFilters ? <OpsButton size="sm" onClick={() => update({ q: null, view: null })}>Clear filters</OpsButton> : undefined}
            />
          )}
        </OpsSurface>
      </div>

      {selected ? (
        <FreightDocumentPanel
          key={selected.reference}
          row={selected}
          returnTo={returnTo}
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
  onClose,
  onRefresh,
  onOpenDocument,
  onMessage,
}: {
  row: FreightDocumentQueueRow;
  returnTo: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onOpenDocument: (reference: string, documentId: string) => Promise<void>;
  onMessage: (tone: "success" | "warning" | "danger", text: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() => formFor(row));
  const [busy, setBusy] = useState(false);
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

  return (
    <>
      <button type="button" className="fixed inset-0 z-[70] cursor-default bg-black/15" onClick={onClose} aria-label="Close document production panel"/>
      <aside className="freight-document-inspector fixed inset-y-0 right-0 z-[80] flex w-full flex-col overflow-hidden border-l border-[var(--admin-line)] bg-[var(--admin-surface)] shadow-xl md:w-[620px]" aria-label={`Freight documents for ${row.reference}`}>
        <header className="freight-document-inspector-header flex shrink-0 items-start justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
          <div className="min-w-0">
            <p className="m-0 text-xs text-[var(--admin-muted)]"><OpsMono>{row.reference}</OpsMono>{row.booking_reference ? ` · Booking ${row.booking_reference}` : ""}</p>
            <h2 className="mt-1 text-base font-semibold leading-6">Document production</h2>
            <p className="mt-0.5 text-sm text-[var(--admin-muted)]">{row.customer_name} · {row.origin} → {row.destination} · {row.mode || "Mode not set"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <OpsBadge tone={status.tone}>{status.label}</OpsBadge>
            <button type="button" className="freight-document-inspector-close" onClick={onClose} aria-label="Close document production panel"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="border-b border-[var(--admin-line)] px-5 py-4">
            <OpsNotice>
              <span className="flex items-start gap-2"><ShieldCheck size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true"/>KCPL-generated PDFs are controlled internal/house drafts. Carrier-issued master originals remain authoritative.</span>
            </OpsNotice>
            {row.missing_primary_carriage_document && row.current_generated_count > 0 ? <div className="mt-3"><OpsNotice tone="warning"><span className="flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true"/>Other KCPL drafts exist for this Job File, but the mode-specific primary carriage draft is still missing.</span></OpsNotice></div> : null}

            <div className="mt-3 grid gap-2 rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-[var(--admin-muted)]">Current controlled draft</div>
                  <div className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{latest ? latest.label : "No generated revision yet"}</div>
                  {latest ? <div className="mt-0.5 text-xs text-[var(--admin-muted)]">R{latest.revision} · {latest.filename} · {reviewState(latest).label}</div> : null}
                </div>
                {latest ? <div className="flex flex-wrap justify-end gap-2">
                  {hasPendingReview(row) ? <Link href={`/admin/documents?q=${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="ghost" data-size="sm">Review in Document Vault</Link> : null}
                  <OpsButton size="sm" variant="secondary" onClick={() => void onOpenDocument(row.reference, latest.document_id)}><ExternalLink size={13} aria-hidden="true"/>Open PDF</OpsButton>
                </div> : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}?returnTo=${encodeURIComponent(returnTo)}`} className="ops-button" data-variant="secondary" data-size="sm">Open Job File</Link>
              <Link href={`/admin/documents?q=${encodeURIComponent(row.reference)}`} className="ops-button" data-variant="ghost" data-size="sm">Document Vault</Link>
              <span className="text-xs text-[var(--admin-muted)]">{row.current_generated_count} current draft{row.current_generated_count === 1 ? "" : "s"}</span>
            </div>
          </div>

          <PanelSection title="Source context" description="Operational context inherited from the Digital Job File.">
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <Context label="Carrier" value={row.carrier_name || "Not assigned"}/>
              <Context label="Booking reference" value={row.booking_reference || "Not recorded"}/>
              <Context label="Cargo" value={row.cargo_description || "Not recorded"}/>
              <Context label="Pieces / weight" value={`${row.pieces || 0} piece${row.pieces === 1 ? "" : "s"} · ${row.weight_kg || 0} kg`}/>
            </div>
          </PanelSection>

          <PanelSection title="Document" description="Choose the controlled document type and internal reference.">
            <div className="grid gap-3 md:grid-cols-2">
              <OpsField label="Document type"><select value={form.kind} onChange={(event) => changeKind(event.target.value as GeneratedFreightDocumentKind)}>{generatedFreightDocumentKinds.filter((kind) => row.recommended_kinds.includes(kind)).map((kind) => <option key={kind} value={kind}>{generatedFreightDocumentLabels[kind]}</option>)}</select></OpsField>
              <OpsField label="House / internal reference"><input value={form.houseReference} onChange={(event) => patch("houseReference", event.target.value)}/></OpsField>
            </div>
          </PanelSection>

          <PanelSection title="Parties & cargo" description="Capture the legal parties and shipment description used in the controlled draft.">
            <div className="grid gap-3 md:grid-cols-2">
              <OpsField label="Shipper"><textarea value={form.shipper} onChange={(event) => patch("shipper", event.target.value)} placeholder="Legal shipper/exporter name and address"/></OpsField>
              <OpsField label="Consignee"><textarea value={form.consignee} onChange={(event) => patch("consignee", event.target.value)} placeholder="Legal consignee/importer name and address"/></OpsField>
              <OpsField label="Notify party"><textarea value={form.notifyParty} onChange={(event) => patch("notifyParty", event.target.value)}/></OpsField>
              <OpsField label="Cargo description"><textarea value={form.cargoDescription} onChange={(event) => patch("cargoDescription", event.target.value)}/></OpsField>
              <OpsField label="Marks & numbers"><input value={form.marksAndNumbers} onChange={(event) => patch("marksAndNumbers", event.target.value)}/></OpsField>
              <OpsField label="Package type"><input value={form.packageType} onChange={(event) => patch("packageType", event.target.value)}/></OpsField>
            </div>
          </PanelSection>

          <PanelSection title="Carriage terms" description="Set receipt and delivery places, references and commercial carriage instructions.">
            <div className="grid gap-3 md:grid-cols-2">
              <OpsField label="Place of receipt"><input value={form.placeOfReceipt} onChange={(event) => patch("placeOfReceipt", event.target.value)}/></OpsField>
              <OpsField label="Place of delivery"><input value={form.placeOfDelivery} onChange={(event) => patch("placeOfDelivery", event.target.value)}/></OpsField>
              <OpsField label="Carrier / master reference"><input value={form.masterReference} onChange={(event) => patch("masterReference", event.target.value)}/></OpsField>
              <OpsField label="Freight terms"><input value={form.freightTerms} onChange={(event) => patch("freightTerms", event.target.value)} placeholder="Prepaid / collect / as agreed"/></OpsField>
              <OpsField label="Incoterm"><input value={form.incoterm} onChange={(event) => patch("incoterm", event.target.value)} placeholder="e.g. FOB, CIF, DDP"/></OpsField>
              <OpsField label="Special instructions"><textarea value={form.specialInstructions} onChange={(event) => patch("specialInstructions", event.target.value)}/></OpsField>
            </div>
          </PanelSection>

          <PanelSection title="Revision history" description="Current and superseded controlled revisions for this Job File.">
            {row.generated_documents.length ? <div className="divide-y divide-[var(--admin-line)] border-y border-[var(--admin-line)]">{row.generated_documents.map((document) => <div key={document.document_id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm font-medium">R{document.revision} · {document.label}</strong><OpsBadge tone={document.superseded ? "neutral" : reviewState(document).tone}>{document.superseded ? "Superseded" : reviewState(document).label}</OpsBadge>{document.customer_safe ? <OpsBadge tone="info">Customer-safe</OpsBadge> : null}</div><p className="mt-1 truncate text-xs text-[var(--admin-muted)]">{document.filename} · SHA {document.sha256.slice(0, 12)}…</p></div><OpsButton size="sm" variant="ghost" onClick={() => void onOpenDocument(row.reference, document.document_id)}>Open PDF</OpsButton></div>)}</div> : <div className="flex items-start gap-2 rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3 text-sm text-[var(--admin-muted)]"><FileText size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true"/>No generated revisions yet.</div>}
          </PanelSection>
        </div>

        <footer className="freight-document-inspector-footer shrink-0 border-t border-[var(--admin-line)] bg-[var(--admin-surface)] px-5 py-4">
          <label className="flex items-start gap-2 text-sm text-[var(--admin-muted)]"><input type="checkbox" checked={form.customerSafe} onChange={(event) => patch("customerSafe", event.target.checked)}/><span>Mark this draft customer-safe after staff checks the content.</span></label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-[var(--admin-muted)]">{row.missing_primary_carriage_document ? <><AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>Primary carriage draft missing</> : <><CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>Primary carriage draft present</>}</span>
            <OpsButton variant="primary" disabled={busy} onClick={generate}><FilePlus2 size={16} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Generating…" : "Generate PDF"}</OpsButton>
          </div>
        </footer>
      </aside>
    </>
  );
}

function PanelSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="border-b border-[var(--admin-line)] px-5 py-5 last:border-b-0"><h3 className="text-base font-semibold">{title}</h3><p className="mt-1 text-sm leading-5 text-[var(--admin-muted)]">{description}</p><div className="mt-4">{children}</div></section>;
}

function Context({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-medium text-[var(--admin-muted)]">{label}</div><div className="mt-1 text-sm text-[var(--admin-ink)]">{value}</div></div>;
}
