"use client";

import Link from "next/link";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, GripVertical, Landmark } from "lucide-react";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { financeInvoiceStatusLabels, type FinanceDashboard, type FinanceInvoiceStatus } from "./finance-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsKpiRail, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsProgress, OpsRailMetric, OpsRegisterToolbar, OpsSearch, OpsScopeTabs, OpsSurface, OpsTableWrap } from "../operations-ui";
import { ArrangeableGrid } from "../arrangeable-grid";
import {
  presetForStateIn,
  savedLayoutForState,
  WORKSPACE_PRESETS,
  type SavedLayout,
} from "../operations-arrangeable";
import { CustomiseMenu, CustomiseRow } from "../ops-register";
import { useStaffArrangement } from "../use-staff-arrangement";

/** Sections exposed to the workspace-layout customise primitive. */
const FINANCE_SECTION_LABELS: Record<"rail" | "register", string> = {
  rail: "Receivables summary",
  register: "Receivables ledger",
};

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString("en-AU")}`; }
}
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date); }
function statusTone(status: FinanceInvoiceStatus): "neutral" | "info" | "violet" | "success" | "danger" { if (status === "issued") return "info"; if (status === "partially_paid") return "violet"; if (status === "paid") return "success"; if (status === "overdue") return "danger"; return "neutral"; }

const STATUS_TABS: Array<{ value: "all" | FinanceInvoiceStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

export function FinanceWorkspace({ dashboard, roleLabel }: { dashboard: FinanceDashboard; roleLabel: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | FinanceInvoiceStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ shipmentReference: "", customerId: "", issueDate: today, dueDate: "", currency: "NPR" as CrmCurrency, description: "", amount: "", taxRate: "0", notes: "" });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return dashboard.invoices.filter((invoice) => {
      if (status !== "all" && invoice.status !== status) return false;
      if (!needle) return true;
      return [invoice.reference, invoice.external_invoice_number ?? "", invoice.record_type, invoice.migration_batch_id ?? "", invoice.customer_name, invoice.customer_id, invoice.shipment_reference ?? "", invoice.quote_reference ?? "", invoice.branch, invoice.currency].join(" ").toLowerCase().includes(needle);
    });
  }, [dashboard.invoices, query, status]);

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const shipmentReference = form.shipmentReference.trim().toUpperCase();
      const typedCustomerId = form.customerId.trim().toUpperCase();
      const customerId = typedCustomerId.startsWith("KCPL-C-") ? typedCustomerId : "";
      const response = await fetch("/api/admin/finance/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, shipmentReference, customerId, amount: Number(form.amount), taxRate: Number(form.taxRate) }) });
      const data = await response.json() as { reference?: string; error?: string; resolutionPath?: string };
      if (!response.ok && data.resolutionPath) { router.push(data.resolutionPath); return; }
      if (!response.ok || !data.reference) throw new Error(data.error || "Invoice could not be created.");
      router.push(`/admin/finance/invoices/${encodeURIComponent(data.reference)}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Invoice could not be created."); }
    finally { setBusy(false); }
  }

  const shipmentMode = Boolean(form.shipmentReference.trim());

  // Per-staff workspace layout: the summary rail and the receivables ledger are
  // arrangeable sections persisted server-side (same primitive as Shipments).
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
  } = useStaffArrangement("finance");
  const [arranging, setArranging] = useState(false);
  const [arrangeMenu, setArrangeMenu] = useState(false);
  const activePreset = presetForStateIn("finance", arrangement);
  const savedMatch = savedLayoutForState(saved, arrangement);
  const onSectionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, id: "rail" | "register") => {
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

  return <OpsPage>
    <OpsPageHeader eyebrow="Commercial" title="Receivables" description="Customer invoices, collections, imported opening balances and aging in the same operating ledger. Opening balances stay visibly separate from invoiced revenue so migration does not manufacture historical sales." meta={<><span>{roleLabel}</span><span>{dashboard.invoices.length} receivable records</span>{dashboard.opening_balance_count ? <span>{dashboard.opening_balance_count} opening balances</span> : null}</>} actions={<><Link href="/admin/payables" className="ops-button" data-variant="secondary" data-size="md">Payables</Link><OpsButton variant="primary" onClick={() => setCreateOpen((value) => !value)}><FilePlus2 size={13}/>{createOpen ? "Close form" : "New invoice"}</OpsButton></>}/>
    <div className="px-4 pt-3 md:px-6">
      <CustomiseRow
        arranging={arranging}
        onToggle={() => { setArranging(v => !v); setArrangeMenu(false); }}
        arrangeMenu={arrangeMenu}
        onToggleMenu={() => setArrangeMenu(v => !v)}
        arrangement={arrangement}
        presets={WORKSPACE_PRESETS.finance}
        activePreset={activePreset}
        applyPreset={preset => setArrangement(preset.layout)}
        onReset={resetArrangement}
        status={arrangeStatus}
        sectionLabels={FINANCE_SECTION_LABELS}
        saved={saved}
        onSaveCurrent={saveCurrentAs}
        onDeleteSaved={deleteSaved}
        savedMatchId={savedMatch?.id ?? null}
        onApplySaved={(layout: SavedLayout) => setArrangement({ order: layout.order, hidden: layout.hidden })}
      />
      <CustomiseMenu open={arranging && arrangeMenu} arrangement={arrangement} onToggle={toggleHidden} sectionLabels={FINANCE_SECTION_LABELS}/>
    </div>

    <div className="px-4 pt-3 md:px-6">
      <ArrangeableGrid
        workspace="finance"
        state={arrangement}
        onChange={setArrangement}
        arranging={arranging}
      >
        {(id: "rail" | "register", { handleProps, hidden }) => {
          if (hidden) return null;
          const handle = (
            <button
              type="button"
              className="ops-arrange-handle"
              {...handleProps}
              aria-label={`Move ${FINANCE_SECTION_LABELS[id]}`}
              tabIndex={arranging ? 0 : -1}
              onKeyDown={(event) => onSectionKeyDown(event, id)}
            >
              <GripVertical size={13} strokeWidth={1.75} aria-hidden="true"/>
            </button>
          );
          if (id === "rail") {
            return (
      <div>
      {/* One flat rail; segments reuse the existing status filter. */}
      <OpsKpiRail label="Receivables summary">
        <OpsRailMetric label="Overdue" value={dashboard.overdue_count} tone="danger" active={status === "overdue"} onClick={() => setStatus(status === "overdue" ? "all" : "overdue")}/>
        <OpsRailMetric label="Open receivables" value={dashboard.unpaid_count}/>
        <OpsRailMetric label="Opening balances" value={dashboard.opening_balance_count} tone="warning"/>
        <OpsRailMetric label="Paid" value={dashboard.paid_count} tone="success" active={status === "paid"} onClick={() => setStatus(status === "paid" ? "all" : "paid")}/>
        <OpsRailMetric label="Drafts" value={dashboard.draft_count} active={status === "draft"} onClick={() => setStatus(status === "draft" ? "all" : "draft")}/>
      </OpsKpiRail>
      </div>
        );
          }
          return (
    <div className="ops-content-wide ops-stack">
      {handle}
      {notice ? <OpsNotice tone="danger" onDismiss={() => setNotice("")}>{notice}</OpsNotice> : null}
      {createOpen ? <OpsSurface eyebrow="Create receivable" title="New invoice draft" description="If the invoice belongs to a shipment, enter the shipment reference and KCPL will resolve the linked CRM customer before continuing."><form onSubmit={createInvoice} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><OpsField label="Shipment reference"><input value={form.shipmentReference} onChange={(event) => setForm((current) => ({ ...current, shipmentReference: event.target.value, customerId: event.target.value.trim() ? "" : current.customerId }))} placeholder="KCPL-S-..."/></OpsField><OpsField label={shipmentMode ? "Customer reference (automatic)" : "Customer reference"}><input disabled={shipmentMode} value={shipmentMode ? "Resolved from shipment" : form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })} placeholder="KCPL-C-..."/></OpsField><OpsField label="Issue date"><input required type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })}/></OpsField><OpsField label="Due date"><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></OpsField><OpsField label="Currency"><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as CrmCurrency })}>{crmCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select></OpsField><OpsField label="Amount before tax"><input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></OpsField><OpsField label="Tax %"><input min="0" max="100" step="0.01" type="number" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}/></OpsField><OpsField label="Description"><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Freight and logistics services"/></OpsField><OpsField label="Invoice notes" className="md:col-span-2 xl:col-span-4"><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}/></OpsField><div className="flex gap-2 md:col-span-2 xl:col-span-4"><OpsButton type="submit" variant="primary" disabled={busy}>{busy ? "Creating…" : shipmentMode ? "Continue to invoice" : "Create invoice draft"}</OpsButton><OpsButton type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</OpsButton></div></form></OpsSurface> : null}

      {dashboard.currency_summaries.length ? <div className="grid gap-3 xl:grid-cols-2">{dashboard.currency_summaries.map((summary) => <OpsSurface key={summary.currency} eyebrow={`${summary.currency} receivables`} title={`${money(summary.outstanding, summary.currency)} outstanding`} description={`${summary.invoice_count} invoice${summary.invoice_count === 1 ? "" : "s"}${summary.opening_balance_count ? ` · ${summary.opening_balance_count} opening balance${summary.opening_balance_count === 1 ? "" : "s"}` : ""}.`}><div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]"><Mini label="Invoiced" value={money(summary.invoiced, summary.currency)}/><Mini label="Opening" value={money(summary.opening_balance, summary.currency)}/><Mini label="Collected" value={money(summary.collected, summary.currency)} tone="success"/><Mini label="Outstanding" value={money(summary.outstanding, summary.currency)}/><Mini label="Overdue" value={money(summary.overdue, summary.currency)} tone={summary.overdue > 0 ? "danger" : "neutral"}/></div><div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]"><Age label="0–30" value={summary.aging_0_30} total={summary.outstanding} currency={summary.currency}/><Age label="31–60" value={summary.aging_31_60} total={summary.outstanding} currency={summary.currency}/><Age label="61–90" value={summary.aging_61_90} total={summary.outstanding} currency={summary.currency}/><Age label="90+" value={summary.aging_90_plus} total={summary.outstanding} currency={summary.currency} danger={summary.aging_90_plus > 0}/></div></OpsSurface>)}</div> : null}

      <OpsSurface eyebrow="Receivable register" title="Receivables ledger" description={`${filtered.length} of ${dashboard.invoices.length} receivable records shown.`} flush>
        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice, opening balance, customer, shipment or branch"/>}
          actions={(
            <>
              {query.trim() || status !== "all" ? <OpsButton size="xs" variant="ghost" onClick={() => { setQuery(""); setStatus("all"); }}>Reset</OpsButton> : null}
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <span className="ops-result-count" aria-live="polite">{filtered.length === dashboard.invoices.length ? `${dashboard.invoices.length} records` : `${filtered.length} of ${dashboard.invoices.length}`}</span>
            </>
          )}
          tabs={<OpsScopeTabs label="Invoice status views" items={STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label }))} value={status} onChange={(value) => setStatus(value)}/>}
        />
        <OpsTableWrap><table className="ops-table ops-register-table finance-table"><thead><tr><th>Receivable</th><th>Customer</th><th>Job / branch</th><th>Date / due</th><th>Total / opening</th><th>Balance</th><th>Status</th></tr></thead><tbody>{filtered.length ? filtered.map((invoice: (typeof dashboard.invoices)[number]) => <tr key={invoice.reference}><td><Link href={`/admin/finance/invoices/${encodeURIComponent(invoice.reference)}`} className="ops-cell-ref ops-mono">{invoice.record_type === "opening_balance" ? "Opening balance" : invoice.external_invoice_number || invoice.reference}</Link><div className="mt-1 flex flex-wrap items-center gap-1.5"><span className="ops-cell-secondary ops-mono">{invoice.reference}</span>{invoice.record_type === "opening_balance" ? <OpsBadge tone="violet">Opening</OpsBadge> : invoice.migration_batch_id ? <OpsBadge tone="info">Imported invoice</OpsBadge> : null}</div>{invoice.migration_batch_id ? <p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]"><OpsMono>{invoice.migration_batch_id}</OpsMono></p> : null}</td><td><span className="ops-cell-primary">{invoice.customer_name}</span><p className="mt-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]"><OpsMono>{invoice.customer_id}</OpsMono></p></td><td><span>{invoice.shipment_reference ? <OpsMono>{invoice.shipment_reference}</OpsMono> : "No shipment"}</span><p className="mt-1 flex items-center gap-1 text-[length:var(--app-label-size)] text-[var(--admin-muted)]"><Landmark size={9}/>{invoice.branch}</p></td><td><span>{invoice.record_type === "opening_balance" ? `As at ${dateLabel(invoice.migration_as_of_date || invoice.issue_date)}` : dateLabel(invoice.issue_date)}</span><p className={`mt-1 text-[length:var(--app-label-size)] ${invoice.status === "overdue" ? "font-bold text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>Due {dateLabel(invoice.due_date)}</p></td><td className="font-bold text-[var(--admin-ink)] tabular-nums">{money(invoice.total, invoice.currency)}</td><td className={`font-bold tabular-nums ${invoice.balance_due > 0 ? "text-[var(--admin-ink)]" : "text-[var(--admin-success)]"}`}>{money(invoice.balance_due, invoice.currency)}</td><td><OpsBadge tone={statusTone(invoice.status)} dot>{financeInvoiceStatusLabels[invoice.status]}</OpsBadge></td></tr>) : <tr><td colSpan={7}><OpsEmptyState compact kind="search" title="No receivables match" description="Change the filters or create a new invoice draft."/></td></tr>}</tbody></table></OpsTableWrap>
      </OpsSurface>
    </div>
          );
        }}
      </ArrangeableGrid>
    </div>
  </OpsPage>;
}

function Mini({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" }) { return <div className="rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3"><p className="text-[length:var(--app-label-size)] font-bold uppercase tracking-[.07em] text-[var(--admin-muted)]">{label}</p><strong className={`mt-1.5 block tabular-nums text-[length:var(--app-label-size)] ${tone === "success" ? "text-[var(--admin-success)]" : tone === "danger" ? "text-[var(--admin-danger)]" : "text-[var(--admin-ink)]"}`}>{value}</strong></div>; }
function Age({ label, value, total, currency, danger = false }: { label: string; value: number; total: number; currency: string; danger?: boolean }) { return <div><div className="flex items-center justify-between gap-2"><span className="text-[length:var(--app-label-size)] font-bold text-[var(--admin-muted)]">{label}</span><span className={`tabular-nums text-[length:var(--app-label-size)] font-semibold ${danger ? "text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>{money(value, currency)}</span></div><div className="mt-2"><OpsProgress value={value} max={Math.max(total, 1)} tone={danger ? "danger" : value > 0 ? "warning" : "accent"}/></div></div>; }
