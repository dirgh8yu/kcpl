"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Calculator, PackagePlus, Plus, RefreshCw, Route, X } from "lucide-react";
import { crmCurrencies, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsKpiRail, OpsNotice, OpsPage, OpsPageHeader, OpsRailMetric, OpsSurface, OpsTableWrap } from "../operations-ui";
import {
  tmsModes,
  tmsRateUnitLabels,
  tmsRateUnits,
  type PartnerBuyRateCard,
  type RatingResult,
  type TmsMode,
  type TmsOrder,
  type TmsRateUnit,
} from "./tms-rating";

type PartnerOption = { id: string; name: string };
type ApiResponse = { ok: boolean; error?: string; order?: TmsOrder; orders?: TmsOrder[]; rateCard?: PartnerBuyRateCard; rateCards?: PartnerBuyRateCard[]; results?: RatingResult[]; result?: RatingResult };

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}
function modeLabel(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function dateLabel(value: string | null) { if (!value) return "Any date"; const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(d); }

export function TmsRatingWorkspace({ initialOrders, initialRateCards, partners, branches, canUseGlobalBranch, canManageRateCards }: {
  initialOrders: TmsOrder[];
  initialRateCards: PartnerBuyRateCard[];
  partners: PartnerOption[];
  branches: KcplBranch[];
  canUseGlobalBranch: boolean;
  canManageRateCards: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [rateCards, setRateCards] = useState(initialRateCards);
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrders[0]?.id ?? "");
  const [results, setResults] = useState<RatingResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

  const defaultBranch = branches[0] ?? "Kathmandu";
  const [orderBranch, setOrderBranch] = useState<KcplBranch>(defaultBranch);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<TmsMode>("road");
  const [weightKg, setWeightKg] = useState("0");
  const [volumeCbm, setVolumeCbm] = useState("0");
  const [pieces, setPieces] = useState("0");
  const [containers, setContainers] = useState("0");
  const [equipment, setEquipment] = useState("");
  const [pickupDate, setPickupDate] = useState("");

  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [rateBranch, setRateBranch] = useState<KcplBranch | "Global">(canUseGlobalBranch ? "Global" : defaultBranch);
  const [rateOrigin, setRateOrigin] = useState("");
  const [rateDestination, setRateDestination] = useState("");
  const [rateMode, setRateMode] = useState<TmsMode>("road");
  const [rateUnit, setRateUnit] = useState<TmsRateUnit>("per_kg");
  const [currency, setCurrency] = useState<CrmCurrency>("NPR");
  const [rateValue, setRateValue] = useState("");
  const [minimumCharge, setMinimumCharge] = useState("");
  const [fuelPercent, setFuelPercent] = useState("0");
  const [accessorial, setAccessorial] = useState("0");
  const [service, setService] = useState("");
  const [rateEquipment, setRateEquipment] = useState("");
  const [transitMin, setTransitMin] = useState("");
  const [transitMax, setTransitMax] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");

  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) ?? null, [orders, selectedOrderId]);
  const activeRateCards = rateCards.filter((card) => card.active).length;
  const selectedOrders = orders.filter((order) => order.status === "selected").length;

  async function refresh() {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/rating", { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.orders || !data.rateCards) throw new Error(data.error || "Rate Desk could not be refreshed.");
      setOrders(data.orders); setRateCards(data.rateCards);
      if (!selectedOrderId && data.orders[0]) setSelectedOrderId(data.orders[0].id);
      setNotice({ tone: "success", text: "Orders and Partner buy rates refreshed." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Rate Desk could not be refreshed." }); }
    finally { setBusy(false); }
  }

  async function createOrder(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/rating", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create_order", branch: orderBranch, origin, destination, mode, pickupDate, weightKg: Number(weightKg), volumeCbm: Number(volumeCbm), pieces: Number(pieces), containerCount: Number(containers), equipment }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.order) throw new Error(data.error || "Transport order could not be created.");
      setOrders((current) => [data.order!, ...current]); setSelectedOrderId(data.order.id); setResults([]); setShowOrder(false);
      setOrigin(""); setDestination(""); setWeightKg("0"); setVolumeCbm("0"); setPieces("0"); setContainers("0"); setEquipment(""); setPickupDate("");
      setNotice({ tone: "success", text: `${data.order.id} created. Rate it against active Partner buy rates.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Transport order could not be created." }); }
    finally { setBusy(false); }
  }

  async function createRate(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/rating", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create_rate", partnerId, branch: rateBranch, origin: rateOrigin, destination: rateDestination, mode: rateMode, service, equipment: rateEquipment, currency, rate: Number(rateValue), unit: rateUnit, minimumCharge: minimumCharge ? Number(minimumCharge) : null, fuelSurchargePercent: Number(fuelPercent), accessorialFlat: Number(accessorial), transitDaysMin: transitMin ? Number(transitMin) : null, transitDaysMax: transitMax ? Number(transitMax) : null, validFrom, validUntil, active: true }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.rateCard) throw new Error(data.error || "Partner buy rate could not be saved.");
      setRateCards((current) => [data.rateCard!, ...current]); setShowRate(false);
      setRateOrigin(""); setRateDestination(""); setRateValue(""); setMinimumCharge(""); setFuelPercent("0"); setAccessorial("0"); setService(""); setRateEquipment(""); setTransitMin(""); setTransitMax(""); setValidFrom(""); setValidUntil("");
      setNotice({ tone: "success", text: `Buy rate saved for ${data.rateCard.partner_name}.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Partner buy rate could not be saved." }); }
    finally { setBusy(false); }
  }

  async function rateSelectedOrder(orderId = selectedOrderId) {
    if (!orderId) return;
    setBusy(true); setNotice(null); setSelectedOrderId(orderId);
    try {
      const response = await fetch(`/api/admin/rating?order=${encodeURIComponent(orderId)}`, { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.results) throw new Error(data.error || "Order could not be rated.");
      setResults(data.results);
      setOrders((current) => current.map((order) => order.id === orderId && order.status === "draft" ? { ...order, status: "rated" } : order));
      setNotice({ tone: data.results.length ? "success" : "warning", text: data.results.length ? `${data.results.length} compatible Partner rate${data.results.length === 1 ? "" : "s"} found.` : "No compatible active Partner buy rates were found. Add or adjust a rate card." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Order could not be rated." }); }
    finally { setBusy(false); }
  }

  async function selectRate(result: RatingResult) {
    if (!selectedOrderId) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/rating", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "select_rate", orderId: selectedOrderId, rateCardId: result.rate_card_id }) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.result) throw new Error(data.error || "Rate could not be selected.");
      setOrders((current) => current.map((order) => order.id === selectedOrderId ? { ...order, status: "selected", selected_rate_card_id: result.rate_card_id, selected_partner_id: result.partner_id, selected_cost: result.total_cost, selected_currency: result.currency } : order));
      setNotice({ tone: "success", text: `${result.partner_name} selected at ${money(result.total_cost, result.currency)}. The buy-rate decision is now audited on the order.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Rate could not be selected." }); }
    finally { setBusy(false); }
  }

  function chooseOrder(id: string) {
    setSelectedOrderId(id); setResults([]);
    window.requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      comparisonRef.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    });
  }

  return (
    <OpsPage>
      <OpsPageHeader
        eyebrow={<Link href="/admin/rating" className="rate-back"><ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true"/>Transport Orders</Link>}
        title="Rate Desk"
        description="Compare Partner buy rates and lock the procurement rate."
        actions={<>
          <Link href="/admin/tenders" className="ops-button" data-variant="secondary" data-size="md">Tender Workspace</Link>
          <OpsButton variant="secondary" onClick={refresh} disabled={busy}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true"/>Refresh</OpsButton>
          {canManageRateCards ? <OpsButton variant="secondary" onClick={() => setShowRate((value) => !value)} aria-expanded={showRate}><Plus size={16} strokeWidth={1.75} aria-hidden="true"/>Partner buy rate</OpsButton> : null}
          <OpsButton variant="primary" onClick={() => setShowOrder((value) => !value)} aria-expanded={showOrder}><PackagePlus size={16} strokeWidth={1.75} aria-hidden="true"/>New order</OpsButton>
        </>}
      />

      <div className="px-4 pb-8 pt-4 md:px-6">
        <OpsKpiRail label="Rate Desk summary">
          <OpsRailMetric label="Orders" value={orders.length}/>
          <OpsRailMetric label="Selected rates" value={selectedOrders}/>
          <OpsRailMetric label="Active buy rates" value={activeRateCards}/>
          <OpsRailMetric label="Partners priced" value={new Set(rateCards.filter((card) => card.active).map((card) => card.partner_id)).size}/>
        </OpsKpiRail>

        {notice ? <div className="plan-notice"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

        {showOrder ? <div className="plan-panel"><OpsSurface density="compact" title="Create transport order" description="The planning object that later supports consolidation, tendering and booking." action={<button type="button" className="ops-inspector-close" onClick={() => setShowOrder(false)} aria-label="Close create order"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}>
          <form onSubmit={createOrder}>
            <div className="ops-form-grid">
              <OpsField label="Branch"><select value={orderBranch} onChange={(event) => setOrderBranch(event.target.value as KcplBranch)}>{branches.map((value) => <option key={value}>{value}</option>)}</select></OpsField>
              <OpsField label="Mode"><select value={mode} onChange={(event) => setMode(event.target.value as TmsMode)}>{tmsModes.map((value) => <option key={value} value={value}>{modeLabel(value)}</option>)}</select></OpsField>
              <OpsField label="Origin"><input required value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Kathmandu / KTM / Nepal"/></OpsField>
              <OpsField label="Destination"><input required value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Kolkata / CCU / India"/></OpsField>
              <OpsField label="Pickup date"><input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)}/></OpsField>
              <OpsField label="Weight (kg)"><input type="number" min="0" step="0.01" value={weightKg} onChange={(event) => setWeightKg(event.target.value)}/></OpsField>
              <OpsField label="Volume (CBM)"><input type="number" min="0" step="0.001" value={volumeCbm} onChange={(event) => setVolumeCbm(event.target.value)}/></OpsField>
              <OpsField label="Pieces"><input type="number" min="0" step="1" value={pieces} onChange={(event) => setPieces(event.target.value)}/></OpsField>
              <OpsField label="Containers"><input type="number" min="0" step="1" value={containers} onChange={(event) => setContainers(event.target.value)}/></OpsField>
              <OpsField label="Equipment"><input value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="20GP, 40HC, reefer, truck…"/></OpsField>
            </div>
            <div className="ops-form-actions"><OpsButton type="button" variant="ghost" size="sm" onClick={() => setShowOrder(false)}>Cancel</OpsButton><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Create order</OpsButton></div>
          </form>
        </OpsSurface></div> : null}

        {showRate && canManageRateCards ? <div className="plan-panel"><OpsSurface density="compact" title="Add Partner buy rate" description="Use * or Any for a lane endpoint that should match every location. Currency is never silently converted." action={<button type="button" className="ops-inspector-close" onClick={() => setShowRate(false)} aria-label="Close Partner buy rate"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}>
          <form onSubmit={createRate}>
            <div className="ops-form-grid">
              <OpsField label="Partner"><select required value={partnerId} onChange={(event) => setPartnerId(event.target.value)}><option value="">Choose Partner</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></OpsField>
              <OpsField label="Rate scope"><select value={rateBranch} onChange={(event) => setRateBranch(event.target.value as KcplBranch | "Global")}>{canUseGlobalBranch ? <option value="Global">Global</option> : null}{branches.map((value) => <option key={value}>{value}</option>)}</select></OpsField>
              <OpsField label="Origin"><input required value={rateOrigin} onChange={(event) => setRateOrigin(event.target.value)} placeholder="Exact location or *"/></OpsField>
              <OpsField label="Destination"><input required value={rateDestination} onChange={(event) => setRateDestination(event.target.value)} placeholder="Exact location or *"/></OpsField>
              <OpsField label="Mode"><select value={rateMode} onChange={(event) => setRateMode(event.target.value as TmsMode)}>{tmsModes.map((value) => <option key={value} value={value}>{modeLabel(value)}</option>)}</select></OpsField>
              <OpsField label="Service"><input value={service} onChange={(event) => setService(event.target.value)} placeholder="Express, standard, FCL…"/></OpsField>
              <OpsField label="Equipment"><input value={rateEquipment} onChange={(event) => setRateEquipment(event.target.value)} placeholder="Optional constraint"/></OpsField>
              <OpsField label="Currency"><select value={currency} onChange={(event) => setCurrency(event.target.value as CrmCurrency)}>{crmCurrencies.map((value) => <option key={value}>{value}</option>)}</select></OpsField>
              <OpsField label="Rate"><input required type="number" min="0" step="0.0001" value={rateValue} onChange={(event) => setRateValue(event.target.value)}/></OpsField>
              <OpsField label="Unit"><select value={rateUnit} onChange={(event) => setRateUnit(event.target.value as TmsRateUnit)}>{tmsRateUnits.map((value) => <option key={value} value={value}>{tmsRateUnitLabels[value]}</option>)}</select></OpsField>
              <OpsField label="Minimum charge"><input type="number" min="0" step="0.01" value={minimumCharge} onChange={(event) => setMinimumCharge(event.target.value)}/></OpsField>
              <OpsField label="Fuel surcharge %"><input type="number" min="0" step="0.01" value={fuelPercent} onChange={(event) => setFuelPercent(event.target.value)}/></OpsField>
              <OpsField label="Flat accessorials"><input type="number" min="0" step="0.01" value={accessorial} onChange={(event) => setAccessorial(event.target.value)}/></OpsField>
              <OpsField label="Transit min (days)"><input type="number" min="0" step="1" value={transitMin} onChange={(event) => setTransitMin(event.target.value)}/></OpsField>
              <OpsField label="Transit max (days)"><input type="number" min="0" step="1" value={transitMax} onChange={(event) => setTransitMax(event.target.value)}/></OpsField>
              <OpsField label="Valid from"><input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)}/></OpsField>
              <OpsField label="Valid until"><input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)}/></OpsField>
            </div>
            <div className="ops-form-actions"><OpsButton type="button" variant="ghost" size="sm" onClick={() => setShowRate(false)}>Cancel</OpsButton><OpsButton type="submit" variant="primary" size="sm" disabled={busy || !partnerId}>Save buy rate</OpsButton></div>
          </form>
        </OpsSurface></div> : null}

        <OpsSurface className="rate-queue" density="compact" title="Transport orders" description="Rate an order whenever cargo facts or supplier pricing change." flush>
          {orders.length ? <OpsTableWrap>
            <table className="ops-table ops-register-table rate-orders-table" aria-label="Transport orders">
              <thead><tr><th>Order</th><th>Lane</th><th>Cargo</th><th>Pickup</th><th>Status</th><th className="ops-col-num">Selected cost</th></tr></thead>
              <tbody>{orders.map((order) => {
                const chosen = selectedOrderId === order.id;
                return <tr key={order.id} tabIndex={0} data-selected={chosen || undefined} aria-current={chosen || undefined} onClick={() => chooseOrder(order.id)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseOrder(order.id); } }}>
                  <td><span className="ops-cell-primary ops-mono ops-cell-id">{order.id}</span><span className="ops-cell-secondary">{order.branch}</span></td>
                  <td><span className="ops-cell-primary ops-cell-clamp" title={`${order.origin} → ${order.destination}`}>{order.origin} → {order.destination}</span><span className="ops-cell-secondary">{modeLabel(order.mode)}</span></td>
                  <td><span className="ops-cell-muted plan-nowrap">{order.weight_kg.toLocaleString()} kg · {order.volume_cbm.toLocaleString()} CBM</span></td>
                  <td><span className="ops-cell-muted plan-nowrap">{dateLabel(order.pickup_date)}</span></td>
                  <td><OpsBadge tone={order.status === "selected" || order.status === "booked" ? "success" : order.status === "rated" || order.status === "tendering" ? "info" : "neutral"}>{modeLabel(order.status)}</OpsBadge></td>
                  <td className="ops-col-num">{order.selected_cost !== null && order.selected_currency ? <span className="ops-num">{money(order.selected_cost, order.selected_currency)}</span> : <span className="ops-cell-muted">—</span>}</td>
                </tr>;
              })}</tbody>
            </table>
          </OpsTableWrap> : <OpsEmptyState compact icon={<Route size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No transport orders yet" description="Create the first planning order to start procurement rating."/>}
        </OpsSurface>

        <div ref={comparisonRef} className="plan-section rate-comparison">
          <OpsSurface
            density="compact"
            title={selectedOrder ? <span className="rate-comparison-title"><span className="ops-mono">{selectedOrder.id}</span>{selectedOrder.origin} → {selectedOrder.destination}</span> : "Rate comparison"}
            description={selectedOrder ? `${modeLabel(selectedOrder.mode)} · ${selectedOrder.weight_kg.toLocaleString()} kg · ${selectedOrder.volume_cbm.toLocaleString()} CBM. Results are grouped by currency without hidden FX conversion.` : "Choose a transport order from the queue."}
            action={selectedOrder ? <OpsButton size="sm" variant="primary" onClick={() => rateSelectedOrder()} disabled={busy}><Calculator size={14} strokeWidth={1.75} aria-hidden="true"/>Rate order</OpsButton> : undefined}
            flush
          >
            {!selectedOrder ? <OpsEmptyState compact title="No order selected" description="Choose an order to compare Partner procurement rates."/> : results.length ? <OpsTableWrap>
              <table className="ops-table ops-register-table rate-results-table" aria-label="Compatible Partner buy rates">
                <thead><tr><th>Partner</th><th>Service</th><th>Basis</th><th className="ops-col-num">Linehaul</th><th className="ops-col-num">Fuel</th><th className="ops-col-num">Accessorials</th><th className="ops-col-num">Total</th><th>Transit</th><th><span className="sr-only">Action</span></th></tr></thead>
                <tbody>{results.map((result) => {
                  const isSelected = selectedOrder.selected_rate_card_id === result.rate_card_id;
                  return <tr key={result.rate_card_id} data-selected={isSelected || undefined}>
                    <td><span className="ops-cell-primary ops-cell-clamp" title={result.partner_name}>{result.partner_name}</span><span className="ops-cell-secondary ops-mono">{result.partner_id}</span></td>
                    <td><span className="ops-cell-primary">{result.service || modeLabel(result.mode)}</span>{result.equipment ? <span className="ops-cell-secondary">{result.equipment}</span> : null}</td>
                    <td><span className="plan-nowrap">{tmsRateUnitLabels[result.unit]} × {result.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>{result.minimum_applied ? <span className="ops-cell-secondary rate-minimum">Minimum applied</span> : null}</td>
                    <td className="ops-col-num"><span className="ops-num">{money(result.linehaul, result.currency)}</span></td>
                    <td className="ops-col-num"><span className="ops-num">{money(result.fuel_surcharge, result.currency)}</span></td>
                    <td className="ops-col-num"><span className="ops-num">{money(result.accessorials, result.currency)}</span></td>
                    <td className="ops-col-num"><span className="ops-num rate-total">{money(result.total_cost, result.currency)}</span></td>
                    <td><span className="ops-cell-muted plan-nowrap">{result.transit_days_min === null ? "Not set" : result.transit_days_max && result.transit_days_max !== result.transit_days_min ? `${result.transit_days_min}–${result.transit_days_max} days` : `${result.transit_days_min} days`}</span></td>
                    <td className="ops-cell-actions"><OpsButton size="xs" variant={isSelected ? "ghost" : "secondary"} onClick={() => selectRate(result)} disabled={busy || isSelected}>{isSelected ? "Selected" : "Select"}</OpsButton></td>
                  </tr>;
                })}</tbody>
              </table>
            </OpsTableWrap> : <OpsEmptyState compact icon={<Calculator size={16} strokeWidth={1.75} aria-hidden="true"/>} title="Rate this order" description={`KCPL compares it against ${activeRateCards} active Partner buy rate${activeRateCards === 1 ? "" : "s"}, respecting lane, mode, equipment, validity, minimum charge and surcharges.`} action={<OpsButton size="sm" variant="secondary" onClick={() => rateSelectedOrder()} disabled={busy}>Find rates</OpsButton>}/>}
          </OpsSurface>
        </div>
      </div>
    </OpsPage>
  );
}
