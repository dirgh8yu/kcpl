"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BadgeDollarSign, CheckCircle2, CircleAlert, FilePlus2, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
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

  return <OpsPage>
    <OpsPageHeader eyebrow="Commercial pricing" title="Pricing Desk" description="Turn selected partner buy costs into governed customer sell prices using customer markups, lane rules, margin floors, NRB FX references and Management approval thresholds." actions={<div className="flex flex-wrap gap-2"><OpsButton size="sm" onClick={refresh} disabled={busy}><RefreshCw size={12}/> Refresh</OpsButton>{canManageRules ? <OpsButton size="sm" onClick={() => setShowRuleForm((value) => !value)}><SlidersHorizontal size={12}/> Pricing rules</OpsButton> : null}<Link href="/admin/rating" className="ops-button" data-size="sm" data-variant="secondary">Rate Desk</Link></div>}/>

    <OpsStatStrip>
      <OpsStat label="Priceable orders" value={orders.length} icon={<BadgeDollarSign size={13}/>}/>
      <OpsStat label="Priced" value={pricedCount} tone="success" icon={<CheckCircle2 size={13}/>}/>
      <OpsStat label="Approval queue" value={approvalCount} tone="warning" icon={<ShieldCheck size={13}/>}/>
      <OpsStat label="Quotes released" value={quotedCount} tone="info" icon={<FilePlus2 size={13}/>}/>
    </OpsStatStrip>

    {notice ? <div className="mt-4"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}
    {showRuleForm && canManageRules ? <div className="mt-4"><PricingRuleForm customers={customers} rules={rules} onCreated={async () => { await refresh(); setShowRuleForm(false); }} /></div> : null}

    <div className="mt-4 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <OpsSurface eyebrow="Transport orders" title="Buy costs ready for sell pricing" description="Only non-master orders with a selected procurement cost appear here.">
        <div className="grid max-h-[720px] gap-2 overflow-auto">
          {orders.length ? orders.map((order) => <button key={order.id} type="button" onClick={() => loadDefaults(order)} className={`rounded-[12px] border p-3 text-left ${selectedOrderId === order.id ? "border-[#dca99d] bg-[#fff8f5]" : "border-[#e9e2dc] bg-white hover:border-[#d9cec6]"}`}>
            <div className="flex items-center justify-between gap-2"><OpsMono>{order.id}</OpsMono><OpsBadge tone={order.pricing_status === "quoted" ? "success" : order.pricing_status === "approval_required" ? "warning" : order.pricing_status === "priced" ? "info" : "neutral"}>{title(order.pricing_status)}</OpsBadge></div>
            <strong className="mt-2 block text-[10px] text-[#4b423c]">{order.origin} → {order.destination}</strong>
            <span className="mt-1 block text-[9px] text-[#8a8078]">{order.customer_name || order.customer_id || "Customer not linked"} · {order.branch} · {title(order.mode)}</span>
            <span className="mt-1 block text-[10px] font-bold text-[#62584f]">Buy {money(order.buy_cost, order.buy_currency)}</span>
          </button>) : <OpsEmptyState title="No orders ready for sell pricing" description="Select a partner buy rate in Rate Desk first."/>}
        </div>
      </OpsSurface>

      {selectedOrder ? <div className="grid gap-4">
        <OpsSurface eyebrow="Sell calculation" title={`${selectedOrder.origin} → ${selectedOrder.destination}`} description="Pricing uses the most specific active rule. Customer markup is the fallback, followed by KCPL default controls.">
          <div className="flex flex-wrap gap-2"><OpsBadge tone="neutral">Buy {money(selectedOrder.buy_cost, selectedOrder.buy_currency)}</OpsBadge><OpsBadge tone={customer ? "info" : "warning"}>{customer?.display_name || "Customer required"}</OpsBadge>{matchedRule ? <OpsBadge tone="success">Rule: {matchedRule.name}</OpsBadge> : <OpsBadge tone="neutral">Customer/default pricing</OpsBadge>}</div>
          {customer?.pricing_notes ? <p className="mt-3 rounded-[10px] bg-[#faf7f3] p-3 text-[9px] leading-5 text-[#766b63]">Customer pricing note: {customer.pricing_notes}</p> : null}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <OpsField label="Sell currency"><select value={sellCurrency} onChange={(event) => { const next = event.target.value as CrmCurrency; setSellCurrency(next); setFxRate(selectedOrder.buy_currency === next ? "1" : ""); setFxSource(null); }}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></OpsField>
            <OpsField label={`FX ${selectedOrder.buy_currency} → ${sellCurrency}`} hint={fxSource || (selectedOrder.buy_currency === sellCurrency ? "1.0" : "NRB midpoint auto-filled on calculate; manual override allowed")}><input type="number" min="0" step="0.000001" value={fxRate} onChange={(event) => { setFxRate(event.target.value); setFxSource(event.target.value ? "Manual FX override" : null); }} placeholder={selectedOrder.buy_currency === sellCurrency ? "1" : "Auto / manual"}/></OpsField>
            <OpsField label="Markup %" hint={`Rule/customer default: ${defaults.markup_percent}%`}><input type="number" min="0" step="0.01" value={markupPercent} onChange={(event) => setMarkupPercent(event.target.value)} placeholder={String(defaults.markup_percent)}/></OpsField>
            <OpsField label="Target margin %" hint="Optional. Engine uses the higher sell price of markup or target margin."><input type="number" min="0" max="99.99" step="0.01" value={targetMarginPercent} onChange={(event) => setTargetMarginPercent(event.target.value)} placeholder="Optional"/></OpsField>
            <OpsField label="Minimum margin %"><input type="number" min="0" max="99.99" step="0.01" value={minimumMarginPercent} onChange={(event) => setMinimumMarginPercent(event.target.value)} placeholder={String(defaults.minimum_margin_percent)}/></OpsField>
            <OpsField label="Approval below margin %"><input type="number" min="0" max="99.99" step="0.01" value={approvalBelowMarginPercent} onChange={(event) => setApprovalBelowMarginPercent(event.target.value)} placeholder={String(defaults.approval_below_margin_percent)}/></OpsField>
            <OpsField label={`Accessorial cost (${sellCurrency})`} hint="Local sell-currency costs such as handling, documentation or clearance."><input type="number" min="0" step="0.01" value={accessorialCost} onChange={(event) => setAccessorialCost(event.target.value)} placeholder="0"/></OpsField>
            <OpsField label="Accessorial markup %"><input type="number" min="0" step="0.01" value={accessorialMarkupPercent} onChange={(event) => setAccessorialMarkupPercent(event.target.value)} placeholder={String(defaults.accessorial_markup_percent)}/></OpsField>
            <OpsField label={`Fixed markup (${sellCurrency})`}><input type="number" min="0" step="0.01" value={fixedMarkup} onChange={(event) => setFixedMarkup(event.target.value)} placeholder={String(defaults.fixed_markup)}/></OpsField>
            <OpsField label={`Manual discount (${sellCurrency})`} hint="Discounts are explicitly audited and can trigger approval."><input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0"/></OpsField>
          </div>
          <div className="mt-4 flex justify-end"><OpsButton variant="primary" onClick={calculate} disabled={busy || !customer}>Calculate governed sell price</OpsButton></div>
        </OpsSurface>

        {preview ? <OpsSurface eyebrow="Price result" title={money(preview.result.sell_price, preview.input.sell_currency)} description="This snapshot freezes the cost, FX, rule and margin decision used for approval and quote release.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Mini label="Converted buy" value={money(preview.result.converted_buy_cost, preview.input.sell_currency)}/><Mini label="Gross profit" value={money(preview.result.gross_profit, preview.input.sell_currency)}/><Mini label="Gross margin" value={`${preview.result.gross_margin_percent.toFixed(2)}%`}/><Mini label="Minimum sell" value={money(preview.result.minimum_sell_price, preview.input.sell_currency)}/></div>
          {preview.result.approval_required ? <div className="mt-4 rounded-[12px] border border-[#ead7b6] bg-[#fffaf0] p-3 text-[10px] text-[#795e32]"><div className="flex items-center gap-2 font-bold"><CircleAlert size={13}/> Management approval required</div><ul className="mt-2 list-disc space-y-1 pl-5">{preview.result.approval_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>{preview.approval_status === "approved" ? <p className="mt-2 font-bold text-[#55705c]">Approved by Management.</p> : canApprove ? <div className="mt-3"><OpsButton size="sm" onClick={approve} disabled={busy}><ShieldCheck size={12}/> Approve this snapshot</OpsButton></div> : <p className="mt-2">Quote release is locked until Management approves this exact snapshot.</p>}</div> : <div className="mt-4 rounded-[12px] border border-[#d9e5dc] bg-[#f6faf7] p-3 text-[10px] text-[#56675a]"><strong>Margin controls passed.</strong> This snapshot is cleared for quote release.</div>}

          {(!preview.result.approval_required || preview.approval_status === "approved") ? <div className="mt-4 grid gap-3 md:grid-cols-[200px_1fr_auto]"><OpsField label="Valid until"><input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)}/></OpsField><OpsField label="Customer quote note"><input value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Service assumptions, inclusions, exclusions…"/></OpsField><div className="flex items-end"><OpsButton variant="primary" onClick={createQuote} disabled={busy}><FilePlus2 size={12}/> Create customer quote</OpsButton></div></div> : null}
          {quoteReference ? <div className="mt-4 rounded-[12px] border border-[#d9e5dc] bg-[#f6faf7] p-3 text-[10px] text-[#56675a]"><CheckCircle2 size={13} className="mr-2 inline"/><strong>{quoteReference}</strong> is now a standard KCPL quote with the pricing snapshot attached. <Link href="/admin" className="ml-2 font-bold underline">Open enquiries</Link></div> : null}
        </OpsSurface> : null}
      </div> : <OpsSurface><OpsEmptyState title="Select a transport order" description="Choose an order with a selected buy rate to calculate its customer sell price."/></OpsSurface>}
    </div>

    <div className="mt-4"><OpsSurface eyebrow="Pricing governance" title={`${rules.length} active and retained pricing rules`} description="More specific customer/lane rules outrank broad branch/global rules. Priority breaks ties between otherwise equally specific matches.">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{rules.length ? rules.map((rule) => <div key={rule.id} className="rounded-[11px] border border-[#e9e2dc] bg-white p-3"><div className="flex items-center justify-between gap-2"><strong className="text-[10px] text-[#4b423c]">{rule.name}</strong><OpsBadge tone={rule.active ? "success" : "neutral"}>{rule.active ? "Active" : "Inactive"}</OpsBadge></div><p className="mt-1 text-[9px] text-[#8a8078]">{title(rule.scope)} · priority {rule.priority}{rule.branch ? ` · ${rule.branch}` : ""}{rule.mode ? ` · ${title(rule.mode)}` : ""}</p><p className="mt-1 text-[9px] text-[#8a8078]">{rule.customer_id ? `Customer ${rule.customer_id} · ` : ""}{rule.origin && rule.destination ? `${rule.origin} → ${rule.destination} · ` : ""}{rule.markup_percent !== null ? `${rule.markup_percent}% markup` : rule.target_margin_percent !== null ? `${rule.target_margin_percent}% target margin` : "default markup"} · floor {rule.minimum_margin_percent}%</p></div>) : <OpsEmptyState title="No custom pricing rules" description="KCPL will use each customer's markup percentage, then the system defaults."/>}</div>
    </OpsSurface></div>
  </OpsPage>;
}

function PricingRuleForm({ customers, rules, onCreated }: { customers: CustomerPricingProfile[]; rules: PricingRule[]; onCreated: () => Promise<void> }) {
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

  return <OpsSurface eyebrow="Pricing administration" title="Create pricing rule" description={`Rules currently stored: ${rules.length}. Customer and lane specificity outrank broad rules; priority breaks ties.`}>
    {error ? <div className="mb-3"><OpsNotice tone="danger">{error}</OpsNotice></div> : null}
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
      <OpsField label="Rule name"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Kathmandu road standard"/></OpsField>
      <OpsField label="Scope"><select value={scope} onChange={(event) => setScope(event.target.value as PricingRuleScope)}>{pricingRuleScopes.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></OpsField>
      <OpsField label="Priority"><input type="number" step="1" value={priority} onChange={(event) => setPriority(event.target.value)}/></OpsField>
      <OpsField label="Branch"><select value={branch} onChange={(event) => setBranch(event.target.value as "" | KcplBranch)}><option value="">Any branch</option>{kcplBranches.map((value) => <option key={value} value={value}>{value}</option>)}</select></OpsField>
      <OpsField label="Customer"><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Any customer</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.display_name} · {item.id}</option>)}</select></OpsField>
      <OpsField label="Mode"><select value={mode} onChange={(event) => setMode(event.target.value as "" | TmsMode)}><option value="">Any mode</option>{tmsModes.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></OpsField>
      <OpsField label="Origin"><input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Exact lane or blank"/></OpsField>
      <OpsField label="Destination"><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Exact lane or blank"/></OpsField>
      <OpsField label="Sell currency"><select value={sellCurrency} onChange={(event) => setSellCurrency(event.target.value as "" | CrmCurrency)}><option value="">Customer preferred</option>{crmCurrencies.map((value) => <option key={value} value={value}>{value}</option>)}</select></OpsField>
      <OpsField label="Markup %"><input type="number" min="0" max="99.99" step="0.01" value={markup} onChange={(event) => setMarkup(event.target.value)}/></OpsField>
      <OpsField label="Target margin %"><input type="number" min="0" max="99.99" step="0.01" value={targetMargin} onChange={(event) => setTargetMargin(event.target.value)} placeholder="Optional"/></OpsField>
      <OpsField label="Minimum margin %"><input type="number" min="0" max="99.99" step="0.01" value={minimumMargin} onChange={(event) => setMinimumMargin(event.target.value)}/></OpsField>
      <OpsField label="Accessorial markup %"><input type="number" min="0" max="99.99" step="0.01" value={accessorialMarkup} onChange={(event) => setAccessorialMarkup(event.target.value)}/></OpsField>
      <OpsField label="Fixed markup"><input type="number" min="0" step="0.01" value={fixedMarkup} onChange={(event) => setFixedMarkup(event.target.value)}/></OpsField>
      <OpsField label="Approval below margin %"><input type="number" min="0" max="99.99" step="0.01" value={approvalBelow} onChange={(event) => setApprovalBelow(event.target.value)}/></OpsField>
      <div className="md:col-span-3"><OpsField label="Internal pricing note"><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contract exception, seasonal rule, account agreement…"/></OpsField></div>
      <div className="md:col-span-3 flex justify-end"><OpsButton type="submit" variant="primary" disabled={busy}>Create pricing rule</OpsButton></div>
    </form>
  </OpsSurface>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[11px] border border-[#e9e2dc] bg-white p-3"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#958a82]">{label}</p><strong className="mt-1 block text-[12px] text-[#4b423c]">{value}</strong></div>;
}
