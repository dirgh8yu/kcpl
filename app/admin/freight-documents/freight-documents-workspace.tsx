"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, FilePlus2, FileText, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsField,
  OpsMono,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
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
  type FreightDocumentQueueRow,
  type GeneratedFreightDocumentKind,
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
  { value: "missing", label: "Missing carriage doc" },
  { value: "generated", label: "Generated" },
  { value: "review", label: "Awaiting review" },
];

function formFor(row: FreightDocumentQueueRow): FormState {
  const kind = row.recommended_kinds[0] ?? "shipping_instruction";
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

function hasPendingReview(row: FreightDocumentQueueRow) {
  return row.generated_documents.some((document) => !document.superseded && document.review_status !== "verified");
}

function rowMatchesFocus(row: FreightDocumentQueueRow, focus: Focus) {
  if (focus === "missing") return row.missing_primary_carriage_document;
  if (focus === "generated") return row.current_generated_count > 0;
  if (focus === "review") return hasPendingReview(row);
  return true;
}

function rowStatus(row: FreightDocumentQueueRow) {
  if (row.missing_primary_carriage_document) return { label: "Missing carriage doc", tone: "warning" as const };
  if (hasPendingReview(row)) return { label: "Awaiting review", tone: "warning" as const };
  if (row.current_generated_count > 0) return { label: "Generated", tone: "success" as const };
  return { label: "Ready", tone: "neutral" as const };
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
  const selectedKey = selected?.reference ?? null;
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "warning" | "danger">("success");

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (!rowMatchesFocus(row, focus)) return false;
      if (!terms.length) return true;
      const haystack = [
        row.reference,
        row.booking_reference ?? "",
        row.customer_name,
        row.origin,
        row.destination,
        row.mode,
        row.carrier_name ?? "",
        row.cargo_description,
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
    if (!selectedKey) return;
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
  }, [selectedKey, update]);

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
    <OpsPage>
      <OpsPageHeader
        title="Freight Documents"
        description="Controlled carriage and execution documents generated from Digital Job Files."
        meta={`${summary.eligible} eligible Job File${summary.eligible === 1 ? "" : "s"} · ${summary.missing_primary} missing carriage doc · ${summary.generated_current} current generated · ${summary.review_pending} awaiting review`}
        actions={
          <Link href="/admin/documents" className="ops-button" data-variant="primary" data-size="md">
            <FileText size={16} strokeWidth={1.75} aria-hidden="true"/> Document Vault
          </Link>
        }
      />

      <div className="px-4 pb-6 md:px-6">
        {message ? <div className="mb-4"><OpsNotice tone={messageTone} onDismiss={() => setMessage("")}>{message}</OpsNotice></div> : null}

        <OpsToolbar className="mb-4">
          <div className="min-w-[240px] flex-1 basis-[320px] max-w-[380px]">
            <OpsSearch
              value={query}
              onChange={(event) => update({ q: event.target.value || null })}
              placeholder="Search ref, customer, route…"
              aria-label="Search freight document jobs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Freight document filters">
            {FOCUS_OPTIONS.map((option) => {
              const active = focus === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setAllowInitialSelection(false); update({ view: option.value === "all" ? null : option.value, selected: null, shipment: null }); }}
                  aria-pressed={active}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${active ? "border-[var(--admin-crimson)] bg-[var(--admin-crimson)] text-white" : "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-muted)] hover:border-[var(--admin-line-strong)] hover:text-[var(--admin-ink)]"}`}
                >
                  {option.label} <span className="tabular-nums">{focusCounts[option.value]}</span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
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
              <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true"/> {refreshing ? "Refreshing…" : "Refresh"}
            </OpsButton>
            {hasFilters ? <OpsButton size="sm" variant="ghost" onClick={() => { setAllowInitialSelection(false); update({ q: null, view: null, selected: null, shipment: null }); }}>Reset</OpsButton> : null}
            <span className="whitespace-nowrap text-xs text-[var(--admin-muted)]">{filtered.length} of {rows.length}</span>
          </div>
        </OpsToolbar>

        <OpsSurface flush>
          {filtered.length ? (
            <OpsTableWrap>
              <table className="ops-table min-w-[920px]" aria-label="Freight document production queue">
                <thead>
                  <tr>
                    <th>Job File</th>
                    <th>Customer · route</th>
                    <th>Mode</th>
                    <th>Document state</th>
                    <th>Current revisions</th>
                    <th>Updated</th>
                    <th><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const status = rowStatus(row);
                    const chosen = selected?.reference === row.reference;
                    return (
                      <tr key={row.reference} data-selected={chosen || undefined}>
                        <td>
                          <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}?returnTo=${encodeURIComponent(returnTo)}`}>
                            <OpsMono className="text-xs font-medium text-[var(--admin-info)]">{row.reference}</OpsMono>
                          </Link>
                          {row.booking_reference ? <span className="mt-0.5 block text-xs text-[var(--admin-muted)]">Booking {row.booking_reference}</span> : null}
                        </td>
                        <td>
                          <strong className="block text-sm font-medium text-[var(--admin-ink)]">{row.customer_name || "Customer not linked"}</strong>
                          <span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{row.origin} → {row.destination}</span>
                        </td>
                        <td><span className="text-sm text-[var(--admin-muted)]">{row.mode || "—"}</span></td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <OpsBadge tone={status.tone}>{status.label}</OpsBadge>
                            {row.current_generated_count > 0 && row.missing_primary_carriage_document ? <OpsBadge tone="neutral">{row.current_generated_count} generated</OpsBadge> : null}
                          </div>
                        </td>
                        <td><span className="text-sm tabular-nums text-[var(--admin-ink)]">{row.current_generated_count}</span></td>
                        <td><span className="text-sm text-[var(--admin-muted)]">{shortDate(row.updated_at)}</span></td>
                        <td className="text-right"><OpsButton size="sm" variant="secondary" onClick={() => openEditor(row)}>Produce</OpsButton></td>
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
  const status = rowStatus(row);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeKind(kind: GeneratedFreightDocumentKind) {
    setForm((current) => ({
      ...current,
      kind,
      houseReference: generatedReference(kind, row.reference),
    }));
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
      <aside className="fixed inset-y-0 right-0 z-[80] flex w-full flex-col overflow-hidden border-l border-[var(--admin-line)] bg-[var(--admin-surface)] shadow-xl md:w-[620px]" aria-label={`Freight documents for ${row.reference}`}>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
          <div className="min-w-0">
            <p className="m-0 text-xs text-[var(--admin-muted)]"><OpsMono>{row.reference}</OpsMono>{row.booking_reference ? ` · Booking ${row.booking_reference}` : ""}</p>
            <h2 className="mt-1 text-base font-semibold leading-6">Document production</h2>
            <p className="mt-0.5 text-sm text-[var(--admin-muted)]">{row.customer_name} · {row.origin} → {row.destination} · {row.mode || "Mode not set"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <OpsBadge tone={status.tone}>{status.label}</OpsBadge>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-[var(--admin-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-ink)]" onClick={onClose} aria-label="Close document production panel">
              <X size={16} strokeWidth={1.75} aria-hidden="true"/>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-[var(--admin-line)] px-5 py-4">
            <OpsNotice>
              <span className="flex items-start gap-2"><ShieldCheck size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true"/>KCPL-generated PDFs are controlled internal/house drafts. Carrier-issued master originals remain authoritative.</span>
            </OpsNotice>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link href={`/admin/jobs/${encodeURIComponent(row.reference)}?returnTo=${encodeURIComponent(returnTo)}`} className="ops-button" data-variant="secondary" data-size="sm">Open Job File</Link>
              <span className="text-xs text-[var(--admin-muted)]">{row.current_generated_count} current revision{row.current_generated_count === 1 ? "" : "s"}</span>
            </div>
          </div>

          <PanelSection title="Document" description="Choose the controlled document type and internal reference.">
            <div className="grid gap-3 md:grid-cols-2">
              <OpsField label="Document type">
                <select value={form.kind} onChange={(event) => changeKind(event.target.value as GeneratedFreightDocumentKind)}>
                  {generatedFreightDocumentKinds.filter((kind) => row.recommended_kinds.includes(kind)).map((kind) => <option key={kind} value={kind}>{generatedFreightDocumentLabels[kind]}</option>)}
                </select>
              </OpsField>
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
            {row.generated_documents.length ? (
              <div className="divide-y divide-[var(--admin-line)] border-y border-[var(--admin-line)]">
                {row.generated_documents.map((document) => (
                  <div key={document.document_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm font-medium">R{document.revision} · {document.label}</strong>
                        <OpsBadge tone={document.superseded ? "neutral" : document.review_status === "verified" ? "success" : "warning"}>{document.superseded ? "Superseded" : document.review_status.replaceAll("_", " ")}</OpsBadge>
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--admin-muted)]">{document.filename} · SHA {document.sha256.slice(0, 12)}…</p>
                    </div>
                    <OpsButton size="sm" variant="ghost" onClick={() => onOpenDocument(row.reference, document.document_id)}>Open PDF</OpsButton>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3 text-sm text-[var(--admin-muted)]">
                <FileText size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true"/> No generated revisions yet.
              </div>
            )}
          </PanelSection>
        </div>

        <footer className="shrink-0 border-t border-[var(--admin-line)] bg-[var(--admin-surface)] px-5 py-4">
          <label className="flex items-start gap-2 text-sm text-[var(--admin-muted)]">
            <input type="checkbox" checked={form.customerSafe} onChange={(event) => patch("customerSafe", event.target.checked)}/>
            <span>Mark this draft customer-safe after staff checks the content.</span>
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-[var(--admin-muted)]">
              {row.missing_primary_carriage_document ? <><AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>Primary carriage document missing</> : <><CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>Primary carriage document present</>}
            </span>
            <OpsButton variant="primary" disabled={busy} onClick={generate}>
              <FilePlus2 size={16} strokeWidth={1.75} aria-hidden="true"/> {busy ? "Generating…" : "Generate PDF"}
            </OpsButton>
          </div>
        </footer>
      </aside>
    </>
  );
}

function PanelSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--admin-line)] px-5 py-5 last:border-b-0">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-[var(--admin-muted)]">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
