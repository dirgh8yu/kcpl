"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Calculator, CheckCircle2, CircleAlert, FilePlus2, RefreshCw, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsFact, OpsFacts, OpsField, OpsInspectorHeader, OpsInspectorNote, OpsInspectorSection, OpsKpiRail, OpsNotice, OpsPage, OpsPageHeader, OpsRailMetric, OpsRegisterToolbar, OpsScopeTabs, OpsSearch, OpsSurface, OpsTableWrap } from "../operations-ui";
import { tmsModes, type TmsMode } from "../rating/tms-rating";
import {
  deriveNrbMidpointFxRate,
  pricingRuleScopes,
  resolvePricingRule,
  rulePricingDefaults,
  type CustomerPricingProfile,
  type PricingForexRate,
  type PricingOrderCandidate,
  type PricingPreview,
  type PricingRule,
  type PricingRuleScope,
} from "./tms-pricing";

type PricingSnapshotView = PricingPreview & { approval_status?: "not_required" | "pending" | "approved" | "rejected" };
type ApiResponse = {
  ok: boolean;
  error?: string;
  orders?: PricingOrderCandidate[];
  customers?: CustomerPricingProfile[];
  rules?: PricingRule[];
  preview?: PricingSnapshotView;
  quoteReference?: string;
  status?: string;
};
type ForexResponse = { ok: boolean; error?: string; snapshot?: { date: string; rates: PricingForexRate[] } };

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}
function numberOrNull(value: string) { if (!value.trim()) return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function title(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function pricingTone(status: PricingOrderCandidate["pricing_status"]): "neutral" | "info" | "warning" | "success" {
  return status === "quoted" ? "success" : status === "approval_required" ? "warning" : status === "priced" ? "info" : "neutral";
}
function ruleMatch(rule: PricingRule) {
  const parts = [rule.branch, rule.mode ? title(rule.mode) : null, rule.customer_id ? `Customer ${rule.customer_id}` : null, rule.origin && rule.destination ? `${rule.origin} → ${rule.destination}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Any branch, mode, customer and lane";
}

type PricingScope = "all" | PricingOrderCandidate["pricing_status"];
const PRICING_SCOPES: Array<{ value: PricingScope; label: string }> = [
  { value: "all", label: "All" },
  { value: "unpriced", label: "Unpriced" },
  { value: "priced", label: "Priced" },
  { value: "approval_required", label: "Approval required" },
  { value: "quoted", label: "Quoted" },
];

/** Docked beside the register while there is room; mirrors the .ops-register-layout query. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1180px), (min-width: 900px) and (max-width: 1023px)";

export function TmsPricingWorkspace({ initialOrders, initialCustomers, initialRules, canManageRules, canApprove }: {
  initialOrders: PricingOrderCandidate[];
  initialCustomers: CustomerPricingProfile[];
  initialRules: PricingRule[];
  canManageRules: boolean;
  canApprove: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [customers, setCustomers] = useState(initialCustomers);
  const [rules, setRules] = useState(initialRules);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [sellCurrency, setSellCurrency] = useState<CrmCurrency>("NPR");
  const [fxRate, setFxRate] = useState("");
  const [markupPercent, setMarkupPercent] = useState("");
  const [targetMarginPercent, setTargetMarginPercent] = useState("");
  const [minimumMarginPercent, setMinimumMarginPercent] = useState("");
  const [approvalBelowMarginPercent, setApprovalBelowMarginPercent] = useState("");
  const [accessorialCost, setAccessorialCost] = useState("");
  const [accessorialMarkupPercent, setAccessorialMarkupPercent] = useState("");
  const [fixedMarkup, setFixedMarkup] = useState("");
  const [discount, setDiscount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [preview, setPreview] = useState<PricingSnapshotView | null>(null);
  const [quoteReference, setQuoteReference] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const [fxSource, setFxSource] = useState<string | null>(null);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<PricingScope>("all");
  const inspectorRef = useRef<HTMLElement>(null);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;
  const customer = customers.find((item) => item.id === selectedOrder?.customer_id) ?? null;
  const matchedRule = selectedOrder ? resolvePricingRule(rules, selectedOrder) : null;
  const pricedCount = orders.filter((order) => order.pricing_status === "priced" || order.pricing_status === "quoted").length;
  const approvalCount = orders.filter((order) => order.pricing_status === "approval_required").length;
  const quotedCount = orders.filter((order) => order.pricing_status === "quoted").length;

  const defaults = rulePricingDefaults(matchedRule, customer?.markup_percent ?? null);

  function loadDefaults(order: PricingOrderCandidate) {
    const nextCustomer = customers.find((item) => item.id === order.customer_id) ?? null;
    const nextRule = resolvePricingRule(rules, order);
    const nextDefaults = rulePricingDefaults(nextRule, nextCustomer?.markup_percent ?? null);
    setSelectedOrderId(order.id);
    setSellCurrency(nextRule?.sell_currency ?? nextCustomer?.preferred_currency ?? order.buy_currency);
    setFxRate(order.buy_currency === (nextRule?.sell_currency ?? nextCustomer?.preferred_currency ?? order.buy_currency) ? "1" : "");
    setMarkupPercent(String(nextDefaults.markup_percent));
    setTargetMarginPercent(nextDefaults.target_margin_percent === null ? "" : String(nextDefaults.target_margin_percent));
    setMinimumMarginPercent(String(nextDefaults.minimum_margin_percent));
    setApprovalBelowMarginPercent(String(nextDefaults.approval_below_margin_percent));
    setAccessorialMarkupPercent(String(nextDefaults.accessorial_markup_percent));
    setFixedMarkup(String(nextDefaults.fixed_markup));
    setAccessorialCost("");
    setDiscount("");
    setPreview(null);
    setQuoteReference(order.quoted_reference);
    setFxSource(null);
    setNotice(null);
  }

  function openOrder(order: PricingOrderCandidate) {
    if (order.id !== selectedOrderId) loadDefaults(order);
    // Stacked layouts put the inspector under the register; bring it into view.
    window.requestAnimationFrame(() => {
      if (window.matchMedia(SIDE_BY_SIDE_QUERY).matches) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      inspectorRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
  }

  // Escape closes the inspector, as it does on the other registers.
  const hasSelection = selectedOrder !== null;
  useEffect(() => {
    if (!hasSelection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      setSelectedOrderId("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasSelection]);

  async function refresh() {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/pricing", { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.orders || !data.customers || !data.rules) throw new Error(data.error || "Pricing Desk could not be refreshed.");
      setOrders(data.orders); setCustomers(data.customers); setRules(data.rules);
      setNotice({ tone: "success", text: "Pricing rules, customers and transport orders refreshed." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Pricing Desk could not be refreshed." }); }
    finally { setBusy(false); }
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/pricing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as ApiResponse;
    if (!response.ok || !data.ok) throw new Error(data.error || "Pricing update failed.");
    return data;
  }

  async function ensureFx(order: PricingOrderCandidate, currency: CrmCurrency) {
    if (order.buy_currency === currency) { setFxRate("1"); setFxSource("Same currency"); return 1; }
    const manual = numberOrNull(fxRate);
    if (manual && manual > 0) return manual;
    const response = await fetch("/api/admin/forex", { cache: "no-store" });
    const data = await response.json() as ForexResponse;
    if (!response.ok || !data.ok || !data.snapshot) throw new Error(data.error || "NRB FX reference is unavailable. Enter the FX rate manually.");
    const derived = deriveNrbMidpointFxRate(order.buy_currency, currency, data.snapshot.rates);
    if (!derived) throw new Error(`NRB does not have enough reference data for ${order.buy_currency} → ${currency}. Enter the FX rate manually.`);
    setFxRate(String(derived));
    setFxSource(`NRB midpoint cross-rate · ${data.snapshot.date}`);
    return derived;
  }

  async function calculate() {
    if (!selectedOrder) return;
    setBusy(true); setNotice(null); setQuoteReference(null);
    try {
      const resolvedFx = await ensureFx(selectedOrder, sellCurrency);
      const data = await post({
        action: "calculate", orderId: selectedOrder.id, sellCurrency, fxRate: resolvedFx,
        markupPercent: numberOrNull(markupPercent), targetMarginPercent: numberOrNull(targetMarginPercent),
        minimumMarginPercent: numberOrNull(minimumMarginPercent), approvalBelowMarginPercent: numberOrNull(approvalBelowMarginPercent),
        accessorialCost: numberOrNull(accessorialCost), accessorialMarkupPercent: numberOrNull(accessorialMarkupPercent),
        fixedMarkup: numberOrNull(fixedMarkup), discount: numberOrNull(discount),
      });
      if (!data.preview) throw new Error("Pricing calculation did not return a snapshot.");
      setPreview(data.preview);
      await refresh();
      setNotice(data.preview.result.approval_required ? { tone: "warning", text: "Price calculated, but Management approval is required before customer release." } : { tone: "success", text: "Sell price calculated and cleared for customer quote release." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Sell price could not be calculated." }); }
    finally { setBusy(false); }
  }

  async function approve() {
    if (!selectedOrder || !preview) return;
    setBusy(true); setNotice(null);
    try {
      const data = await post({ action: "approve", orderId: selectedOrder.id, note: "Approved in Pricing Desk" });
      if (data.preview) setPreview(data.preview);
      await refresh();
      setNotice({ tone: "success", text: "Management approved this pricing snapshot. It can now be released as a customer quote." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Price could not be approved." }); }
    finally { setBusy(false); }
  }

  async function createQuote() {
    if (!selectedOrder || !preview) return;
    setBusy(true); setNotice(null);
    try {
      const data = await post({ action: "create_quote", orderId: selectedOrder.id, validUntil, customerNote });
      setQuoteReference(data.quoteReference ?? null);
      await refresh();
      setNotice({ tone: "success", text: `Customer quote ${data.quoteReference} created from the approved pricing snapshot.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Customer quote could not be created." }); }
    finally { setBusy(false); }
  }

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = orders.filter((order) => {
    if (scope !== "all" && order.pricing_status !== scope) return false;
    if (!terms.length) return true;
    const haystack = [order.id, order.origin, order.destination, order.customer_name ?? "", order.customer_id ?? "", order.branch, order.mode, order.quoted_reference ?? "", title(order.pricing_status)].join(" ").toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  const scopeCounts = Object.fromEntries(PRICING_SCOPES.map((item) => [item.value, item.value === "all" ? orders.length : orders.filter((order) => order.pricing_status === item.value).length])) as Record<PricingScope, number>;
  const filtersActive = Boolean(query.trim()) || scope !== "all";
  const compact = selectedOrder !== null;
  function resetFilters() { setQuery(""); setScope("all"); }

  return <OpsPage>
    <OpsPageHeader
      title="Pricing Desk"
      description="Governed customer sell prices from selected partner buy costs, margin floors and NRB FX."
      actions={<>
        <OpsButton variant="secondary" onClick={refresh} disabled={busy}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true"/>Refresh</OpsButton>
        {canManageRules ? <OpsButton variant="secondary" onClick={() => setShowRuleForm((value) => !value)} aria-expanded={showRuleForm}><SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true"/>Pricing rules</OpsButton> : null}
        <Link href="/admin/rating" className="ops-button" data-size="md" data-variant="secondary">Rate Desk</Link>
      </>}
    />

    <div className="px-4 pb-8 pt-4 md:px-6">
      <OpsKpiRail label="Pricing Desk summary">
        <OpsRailMetric label="Priceable orders" value={orders.length}/>
        <OpsRailMetric label="Priced" value={pricedCount}/>
        <OpsRailMetric label="Approval queue" value={approvalCount} tone={approvalCount ? "warning" : "neutral"} active={scope === "approval_required"} onClick={() => setScope(scope === "approval_required" ? "all" : "approval_required")} title="Show orders awaiting Management approval"/>
        <OpsRailMetric label="Quotes released" value={quotedCount} active={scope === "quoted"} onClick={() => setScope(scope === "quoted" ? "all" : "quoted")} title="Show orders with a released customer quote"/>
      </OpsKpiRail>

      {notice ? <div className="plan-notice"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}
      {showRuleForm && canManageRules ? <div className="plan-panel"><PricingRuleForm customers={customers} rules={rules} onClose={() => setShowRuleForm(false)} onCreated={async () => { await refresh(); setShowRuleForm(false); }} /></div> : null}

      <OpsRegisterToolbar
        search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, lane, customer, quote…" aria-label="Search priceable orders"/>}
        actions={<>
          {filtersActive ? <OpsButton size="xs" variant="ghost" onClick={resetFilters}>Reset</OpsButton> : null}
          <span className="ops-result-count" aria-live="polite">{visible.length === orders.length ? `${orders.length} orders` : `${visible.length} of ${orders.length}`}</span>
        </>}
        tabs={<OpsScopeTabs label="Pricing status" items={PRICING_SCOPES.map((item) => ({ ...item, count: scopeCounts[item.value] }))} value={scope} onChange={setScope}/>}
      />

      <div className="ops-register-layout" data-inspector={selectedOrder ? "open" : undefined}>
        <section className="ops-surface" aria-label="Buy costs ready for sell pricing">
          {visible.length ? <OpsTableWrap>
            <table className="ops-table ops-register-table pricing-table" data-compact={compact || undefined} aria-label="Transport orders ready for sell pricing">
              <thead><tr><th>Order</th><th>Lane</th><th className="ops-col-num">Buy cost</th><th>Status</th>{compact ? null : <th>Quote</th>}</tr></thead>
              <tbody>{visible.map((order) => {
                const chosen = selectedOrderId === order.id;
                return <tr key={order.id} tabIndex={0} data-selected={chosen || undefined} aria-current={chosen || undefined} onClick={() => openOrder(order)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openOrder(order); } }}>
                  <td><span className="ops-cell-primary ops-mono ops-cell-id">{order.id}</span><span className="ops-cell-secondary">{order.branch} · {title(order.mode)}</span></td>
                  <td><span className="ops-cell-primary ops-cell-clamp" title={`${order.origin} → ${order.destination}`}>{order.origin} → {order.destination}</span><span className="ops-cell-secondary ops-cell-clamp">{order.customer_name || order.customer_id || "Customer not linked"}</span></td>
                  <td className="ops-col-num"><span className="ops-num">{money(order.buy_cost, order.buy_currency)}</span></td>
                  <td><OpsBadge tone={pricingTone(order.pricing_status)}>{title(order.pricing_status)}</OpsBadge></td>
                  {compact ? null : <td>{order.quoted_reference ? <span className="ops-mono ops-cell-muted">{order.quoted_reference}</span> : <span className="ops-cell-muted">—</span>}</td>}
                </tr>;
              })}</tbody>
            </table>
          </OpsTableWrap> : <OpsEmptyState compact kind="search" icon={<Calculator size={16} strokeWidth={1.75} aria-hidden="true"/>} title={filtersActive ? "No orders match" : "No orders ready for sell pricing"} description={filtersActive ? "Change or reset the filters." : "Select a partner buy rate in Rate Desk first. Only non-master orders with a selected procurement cost appear here."} action={filtersActive ? <OpsButton variant="secondary" size="sm" onClick={resetFilters}>Reset filters</OpsButton> : undefined}/>}
          {visible.length ? <footer className="ops-register-footer"><span>Only non-master orders with a selected procurement cost appear here.</span></footer> : null}
        </section>

        {selectedOrder ? <aside ref={inspectorRef} className="ops-inspector" aria-label={`Sell pricing for ${selectedOrder.id}`}>
          <OpsInspectorHeader
            kicker={selectedOrder.id}
            title={`${selectedOrder.origin} → ${selectedOrder.destination}`}
            subtitle={`${selectedOrder.customer_name || "Customer not linked"} · ${selectedOrder.branch} · ${title(selectedOrder.mode)}`}
            actions={<button type="button" className="ops-inspector-close" onClick={() => setSelectedOrderId("")} aria-label="Close sell pricing"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
          />
          <div className="ops-inspector-scroll">
            <div className="ops-inspector-body">
              <OpsFacts>
                <OpsFact label="Buy cost">{money(selectedOrder.buy_cost, selectedOrder.buy_currency)}</OpsFact>
                <OpsFact label="Customer" warning={!customer}>{customer?.display_name || "Customer required"}</OpsFact>
                <OpsFact label="Pricing basis">{matchedRule ? `Rule: ${matchedRule.name}` : "Customer / default pricing"}</OpsFact>
              </OpsFacts>
              {customer?.pricing_notes ? <OpsInspectorNote tone="info" title="Customer pricing note">{customer.pricing_notes}</OpsInspectorNote> : null}

              <OpsInspectorSection title="Sell calculation">
                <p className="ops-inspector-hint plan-hint">The most specific active rule applies. Customer markup is the fallback, then KCPL default controls.</p>
                <div className="ops-inspector-form">
                  <OpsField label="Sell currency"><select value={sellCurrency} onChange={(event) => { const next = event.target.value as CrmCurrency; setSellCurrency(next); setFxRate(selectedOrder.buy_currency === next ? "1" : ""); setFxSource(null); }}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></OpsField>
                  <OpsField label={`FX ${selectedOrder.buy_currency} → ${sellCurrency}`} hint={fxSource || (selectedOrder.buy_currency === sellCurrency ? "1.0" : "NRB midpoint on calculate; manual override allowed")}><input type="number" min="0" step="0.000001" value={fxRate} onChange={(event) => { setFxRate(event.target.value); setFxSource(event.target.value ? "Manual FX override" : null); }} placeholder={selectedOrder.buy_currency === sellCurrency ? "1" : "Auto / manual"}/></OpsField>
                  <OpsField label="Markup %" hint={`Default ${defaults.markup_percent}%`}><input type="number" min="0" step="0.01" value={markupPercent} onChange={(event) => setMarkupPercent(event.target.value)} placeholder={String(defaults.markup_percent)}/></OpsField>
                  <OpsField label="Target margin %" hint="Higher of markup or target margin"><input type="number" min="0" max="99.99" step="0.01" value={targetMarginPercent} onChange={(event) => setTargetMarginPercent(event.target.value)} placeholder="Optional"/></OpsField>
                  <OpsField label="Minimum margin %"><input type="number" min="0" max="99.99" step="0.01" value={minimumMarginPercent} onChange={(event) => setMinimumMarginPercent(event.target.value)} placeholder={String(defaults.minimum_margin_percent)}/></OpsField>
                  <OpsField label="Approval below margin %"><input type="number" min="0" max="99.99" step="0.01" value={approvalBelowMarginPercent} onChange={(event) => setApprovalBelowMarginPercent(event.target.value)} placeholder={String(defaults.approval_below_margin_percent)}/></OpsField>
                  <OpsField label={`Accessorial cost (${sellCurrency})`} hint="Handling, documentation or clearance"><input type="number" min="0" step="0.01" value={accessorialCost} onChange={(event) => setAccessorialCost(event.target.value)} placeholder="0"/></OpsField>
                  <OpsField label="Accessorial markup %"><input type="number" min="0" step="0.01" value={accessorialMarkupPercent} onChange={(event) => setAccessorialMarkupPercent(event.target.value)} placeholder={String(defaults.accessorial_markup_percent)}/></OpsField>
                  <OpsField label={`Fixed markup (${sellCurrency})`}><input type="number" min="0" step="0.01" value={fixedMarkup} onChange={(event) => setFixedMarkup(event.target.value)} placeholder={String(defaults.fixed_markup)}/></OpsField>
                  <OpsField label={`Manual discount (${sellCurrency})`} hint="Audited; can trigger approval"><input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0"/></OpsField>
                </div>
                <div className="ops-inspector-actions plan-section-actions"><OpsButton variant="primary" size="sm" onClick={calculate} disabled={busy || !customer}><Calculator size={14} strokeWidth={1.75} aria-hidden="true"/>Calculate governed sell price</OpsButton></div>
              </OpsInspectorSection>

              {preview ? <OpsInspectorSection title="Price result">
                <p className="plan-result">{money(preview.result.sell_price, preview.input.sell_currency)}</p>
                <p className="ops-inspector-hint plan-hint">This snapshot freezes the cost, FX, rule and margin decision used for approval and quote release.</p>
                <OpsFacts columns={2}>
                  <OpsFact label="Converted buy">{money(preview.result.converted_buy_cost, preview.input.sell_currency)}</OpsFact>
                  <OpsFact label="Gross profit">{money(preview.result.gross_profit, preview.input.sell_currency)}</OpsFact>
                  <OpsFact label="Gross margin">{`${preview.result.gross_margin_percent.toFixed(2)}%`}</OpsFact>
                  <OpsFact label="Minimum sell">{money(preview.result.minimum_sell_price, preview.input.sell_currency)}</OpsFact>
                </OpsFacts>
                <div className="plan-subform">
                  {preview.result.approval_required ? <OpsInspectorNote tone="warning" icon={<CircleAlert size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Management approval required">
                    <ul className="plan-reasons">{preview.result.approval_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                    {preview.approval_status === "approved" ? <strong className="plan-approved">Approved by Management.</strong> : canApprove ? null : "Quote release is locked until Management approves this exact snapshot."}
                  </OpsInspectorNote> : <OpsInspectorNote tone="success" icon={<CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Margin controls passed">This snapshot is cleared for quote release.</OpsInspectorNote>}
                </div>
                {preview.result.approval_required && preview.approval_status !== "approved" && canApprove ? <div className="ops-inspector-actions plan-section-actions"><OpsButton size="sm" onClick={approve} disabled={busy}><ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true"/>Approve this snapshot</OpsButton></div> : null}
              </OpsInspectorSection> : null}

              {preview && (!preview.result.approval_required || preview.approval_status === "approved") ? <OpsInspectorSection title="Customer quote">
                <div className="ops-inspector-form">
                  <OpsField label="Valid until"><input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)}/></OpsField>
                  <OpsField label="Customer quote note" className="col-span-full"><input value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Service assumptions, inclusions, exclusions…"/></OpsField>
                </div>
                <div className="ops-inspector-actions plan-section-actions"><OpsButton variant="primary" size="sm" onClick={createQuote} disabled={busy}><FilePlus2 size={14} strokeWidth={1.75} aria-hidden="true"/>Create customer quote</OpsButton></div>
              </OpsInspectorSection> : null}

              {quoteReference ? <OpsInspectorNote tone="success" icon={<CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true"/>} title={quoteReference}>
                Now a standard KCPL quote with the pricing snapshot attached. <Link href="/admin" className="plan-inline-link">Open enquiries</Link>
              </OpsInspectorNote> : null}
            </div>
          </div>
        </aside> : null}
      </div>

      <OpsSurface className="plan-section" density="compact" title="Pricing governance" description={`${rules.length} active and retained pricing rules. Customer and lane rules outrank broad branch or global rules; priority breaks ties.`} flush>
        {rules.length ? <OpsTableWrap>
          <table className="ops-table ops-register-table pricing-rules-table" aria-label="Pricing rules">
            <thead><tr><th>Rule</th><th>Match</th><th>Sell basis</th><th>Floor</th><th>Status</th></tr></thead>
            <tbody>{rules.map((rule) => <tr key={rule.id}>
              <td><span className="ops-cell-primary ops-cell-clamp" title={rule.name}>{rule.name}</span><span className="ops-cell-secondary">{title(rule.scope)} · priority {rule.priority}</span></td>
              <td><span className="ops-cell-clamp" title={ruleMatch(rule)}>{ruleMatch(rule)}</span></td>
              <td>{rule.markup_percent !== null ? `${rule.markup_percent}% markup` : rule.target_margin_percent !== null ? `${rule.target_margin_percent}% target margin` : "Default markup"}</td>
              <td><span className="ops-num">{rule.minimum_margin_percent}%</span></td>
              <td><OpsBadge tone={rule.active ? "success" : "neutral"}>{rule.active ? "Active" : "Inactive"}</OpsBadge></td>
            </tr>)}</tbody>
          </table>
        </OpsTableWrap> : <OpsEmptyState compact title="No custom pricing rules" description="KCPL uses each customer's markup percentage, then the system defaults."/>}
      </OpsSurface>
    </div>
  </OpsPage>;
}

function PricingRuleForm({ customers, rules, onCreated, onClose }: { customers: CustomerPricingProfile[]; rules: PricingRule[]; onCreated: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<PricingRuleScope>("global");
  const [priority, setPriority] = useState("0");
  const [branch, setBranch] = useState<"" | KcplBranch>("");
  const [customerId, setCustomerId] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<"" | TmsMode>("");
  const [sellCurrency, setSellCurrency] = useState<"" | CrmCurrency>("");
  const [markup, setMarkup] = useState("15");
  const [targetMargin, setTargetMargin] = useState("");
  const [minimumMargin, setMinimumMargin] = useState("10");
  const [accessorialMarkup, setAccessorialMarkup] = useState("15");
  const [fixedMarkup, setFixedMarkup] = useState("0");
  const [approvalBelow, setApprovalBelow] = useState("12");
  const [notes, setNotes] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const response = await fetch("/api/admin/pricing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create_rule", name, scope, priority, branch: branch || null, customerId: customerId || null, origin: origin || null, destination: destination || null, mode: mode || null, sellCurrency: sellCurrency || null, markupPercent: markup || null, targetMarginPercent: targetMargin || null, minimumMarginPercent: minimumMargin, accessorialMarkupPercent: accessorialMarkup, fixedMarkup, approvalBelowMarginPercent: approvalBelow, notes, active: true }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Pricing rule could not be created.");
      await onCreated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pricing rule could not be created."); }
    finally { setBusy(false); }
  }

  return <OpsSurface
    density="compact"
    title="Create pricing rule"
    description={`Rules currently stored: ${rules.length}. Customer and lane specificity outrank broad rules; priority breaks ties.`}
    action={<button type="button" className="ops-inspector-close" onClick={onClose} aria-label="Close pricing rule form"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
  >
    {error ? <div className="plan-notice"><OpsNotice tone="danger">{error}</OpsNotice></div> : null}
    <form onSubmit={submit}>
      <div className="ops-form-grid">
        <OpsField label="Rule name" className="ops-form-wide"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Kathmandu road standard"/></OpsField>
        <OpsField label="Scope"><select value={scope} onChange={(event) => setScope(event.target.value as PricingRuleScope)}>{pricingRuleScopes.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></OpsField>
        <OpsField label="Priority"><input type="number" step="1" value={priority} onChange={(event) => setPriority(event.target.value)}/></OpsField>
        <OpsField label="Branch"><select value={branch} onChange={(event) => setBranch(event.target.value as "" | KcplBranch)}><option value="">Any branch</option>{kcplBranches.map((value) => <option key={value} value={value}>{value}</option>)}</select></OpsField>
        <OpsField label="Customer"><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Any customer</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.display_name} · {item.id}</option>)}</select></OpsField>
        <OpsField label="Mode"><select value={mode} onChange={(event) => setMode(event.target.value as "" | TmsMode)}><option value="">Any mode</option>{tmsModes.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></OpsField>
        <OpsField label="Sell currency"><select value={sellCurrency} onChange={(event) => setSellCurrency(event.target.value as "" | CrmCurrency)}><option value="">Customer preferred</option>{crmCurrencies.map((value) => <option key={value} value={value}>{value}</option>)}</select></OpsField>
        <OpsField label="Origin"><input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Exact lane or blank"/></OpsField>
        <OpsField label="Destination"><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Exact lane or blank"/></OpsField>
        <OpsField label="Markup %"><input type="number" min="0" max="99.99" step="0.01" value={markup} onChange={(event) => setMarkup(event.target.value)}/></OpsField>
        <OpsField label="Target margin %"><input type="number" min="0" max="99.99" step="0.01" value={targetMargin} onChange={(event) => setTargetMargin(event.target.value)} placeholder="Optional"/></OpsField>
        <OpsField label="Minimum margin %"><input type="number" min="0" max="99.99" step="0.01" value={minimumMargin} onChange={(event) => setMinimumMargin(event.target.value)}/></OpsField>
        <OpsField label="Accessorial markup %"><input type="number" min="0" max="99.99" step="0.01" value={accessorialMarkup} onChange={(event) => setAccessorialMarkup(event.target.value)}/></OpsField>
        <OpsField label="Fixed markup"><input type="number" min="0" step="0.01" value={fixedMarkup} onChange={(event) => setFixedMarkup(event.target.value)}/></OpsField>
        <OpsField label="Approval below margin %"><input type="number" min="0" max="99.99" step="0.01" value={approvalBelow} onChange={(event) => setApprovalBelow(event.target.value)}/></OpsField>
        <OpsField label="Internal pricing note" className="ops-form-full"><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contract exception, seasonal rule, account agreement…"/></OpsField>
      </div>
      <div className="ops-form-actions">
        <OpsButton type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</OpsButton>
        <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Create pricing rule</OpsButton>
      </div>
    </form>
  </OpsSurface>;
}
