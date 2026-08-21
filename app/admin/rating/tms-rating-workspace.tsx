"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Calculator, CheckCircle2, PackagePlus, Plus, RefreshCw, Route, Tags } from "lucide-react";
import { crmCurrencies, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
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

  return (
    <OpsPage>
      <OpsPageHeader eyebrow="Transportation management" title="Rate Desk" description="Create transport orders, maintain Partner buy rates, compare compatible multimodal costs and lock the selected procurement rate before quotation or booking." actions={<div className="flex flex-wrap gap-2"><OpsButton size="sm" onClick={refresh} disabled={busy}><RefreshCw size={13}/> Refresh</OpsButton><OpsButton size="sm" variant="primary" onClick={() => setShowOrder((value) => !value)}><PackagePlus size={13}/> New order</OpsButton>{canManageRateCards ? <OpsButton size="sm" onClick={() => setShowRate((value) => !value)}><Plus size={13}/> Partner buy rate</OpsButton> : null}</div>} />

      <OpsStatStrip>
        <OpsStat label="Orders" value={orders.length} icon={<Route size={13}/>}/>
        <OpsStat label="Selected rates" value={selectedOrders} tone="success" icon={<CheckCircle2 size={13}/>}/>
        <OpsStat label="Active buy rates" value={activeRateCards} tone="info" icon={<Tags size={13}/>}/>
        <OpsStat label="Partners priced" value={new Set(rateCards.filter((card) => card.active).map((card) => card.partner_id)).size} icon={<Calculator size={13}/>}/>
      </OpsStatStrip>

      {notice ? <div className="mt-4"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

      {showOrder ? <OpsSurface className="mt-4" eyebrow="Order planning" title="Create transport order" description="This is the planning object that will later support consolidation, tendering and booking."><form onSubmit={createOrder} className="grid gap-3 md:grid-cols-4">
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
        <div className="md:col-span-2 flex items-end justify-end gap-2"><OpsButton type="button" onClick={() => setShowOrder(false)}>Cancel</OpsButton><OpsButton type="submit" variant="primary" disabled={busy}>Create order</OpsButton></div>
      </form></OpsSurface> : null}

      {showRate && canManageRateCards ? <OpsSurface className="mt-4" eyebrow="Procurement" title="Add Partner buy rate" description="Use * or Any for a lane endpoint that should match every location. Currency is never silently converted."><form onSubmit={createRate} className="grid gap-3 md:grid-cols-4">
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
        <div className="md:col-span-3 flex items-end justify-end gap-2"><OpsButton type="button" onClick={() => setShowRate(false)}>Cancel</OpsButton><OpsButton type="submit" variant="primary" disabled={busy || !partnerId}>Save buy rate</OpsButton></div>
      </form></OpsSurface> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,.8fr)_minmax(0,1.7fr)]">
        <OpsSurface eyebrow="Order queue" title="Transport orders" description="Rate an order whenever cargo facts or supplier pricing changes.">
          <div className="space-y-2">{orders.length ? orders.map((order) => <button key={order.id} type="button" onClick={() => { setSelectedOrderId(order.id); setResults([]); }} className={`w-full rounded-[12px] border p-3 text-left transition ${selectedOrderId === order.id ? "border-[#df8a75] bg-[#fff8f4]" : "border-[#e8e1db] bg-white hover:border-[#d8cec5]"}`}>
            <div className="flex items-start justify-between gap-2"><div><OpsMono>{order.id}</OpsMono><p className="mt-1 text-[12px] font-bold text-[#3c3530]">{order.origin} <ArrowRight className="inline" size={12}/> {order.destination}</p></div><OpsBadge tone={order.status === "selected" ? "success" : order.status === "rated" ? "info" : "neutral"}>{order.status}</OpsBadge></div>
            <p className="mt-2 text-[10px] text-[#847a72]">{modeLabel(order.mode)} · {order.weight_kg.toLocaleString()} kg · {order.volume_cbm.toLocaleString()} CBM · pickup {dateLabel(order.pickup_date)}</p>
            {order.selected_cost !== null && order.selected_currency ? <p className="mt-2 text-[10px] font-bold text-[#55705b]">Selected {money(order.selected_cost, order.selected_currency)}</p> : null}
          </button>) : <OpsEmptyState compact icon={<Route size={18}/>} title="No transport orders yet" description="Create the first planning order to start procurement rating."/>}</div>
        </OpsSurface>

        <OpsSurface eyebrow="Rate comparison" title={selectedOrder ? `${selectedOrder.origin} → ${selectedOrder.destination}` : "Select an order"} description={selectedOrder ? `${modeLabel(selectedOrder.mode)} · ${selectedOrder.weight_kg.toLocaleString()} kg · ${selectedOrder.volume_cbm.toLocaleString()} CBM. Results are grouped by currency without hidden FX conversion.` : "Choose a transport order from the queue."} action={selectedOrder ? <OpsButton size="sm" variant="primary" onClick={() => rateSelectedOrder()} disabled={busy}><Calculator size={13}/> Rate order</OpsButton> : undefined}>
          {!selectedOrder ? <OpsEmptyState compact title="No order selected" description="Choose an order to compare Partner procurement rates."/> : results.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[10px]"><thead><tr className="border-b border-[#e8e1db] text-[#8b8179]"><th className="px-3 py-2">Partner</th><th className="px-3 py-2">Service</th><th className="px-3 py-2">Basis</th><th className="px-3 py-2">Linehaul</th><th className="px-3 py-2">Fuel</th><th className="px-3 py-2">Accessorials</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Transit</th><th className="px-3 py-2"></th></tr></thead><tbody>{results.map((result) => <tr key={result.rate_card_id} className="border-b border-[#f0ebe7] last:border-0"><td className="px-3 py-3"><strong className="block text-[11px] text-[#403833]">{result.partner_name}</strong><OpsMono>{result.partner_id}</OpsMono></td><td className="px-3 py-3">{result.service || modeLabel(result.mode)}{result.equipment ? <span className="block text-[#8b8179]">{result.equipment}</span> : null}</td><td className="px-3 py-3">{tmsRateUnitLabels[result.unit]} × {result.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}{result.minimum_applied ? <span className="block text-[#ae6b43]">minimum applied</span> : null}</td><td className="px-3 py-3">{money(result.linehaul, result.currency)}</td><td className="px-3 py-3">{money(result.fuel_surcharge, result.currency)}</td><td className="px-3 py-3">{money(result.accessorials, result.currency)}</td><td className="px-3 py-3 text-[12px] font-black text-[#342e2a]">{money(result.total_cost, result.currency)}</td><td className="px-3 py-3">{result.transit_days_min === null ? "Not set" : result.transit_days_max && result.transit_days_max !== result.transit_days_min ? `${result.transit_days_min}–${result.transit_days_max} days` : `${result.transit_days_min} days`}</td><td className="px-3 py-3"><OpsButton size="sm" onClick={() => selectRate(result)} disabled={busy || selectedOrder.selected_rate_card_id === result.rate_card_id}>{selectedOrder.selected_rate_card_id === result.rate_card_id ? "Selected" : "Select"}</OpsButton></td></tr>)}</tbody></table></div> : <OpsEmptyState compact icon={<Calculator size={18}/>} title="Rate this order" description={`KCPL will compare it against ${activeRateCards} active Partner buy rate${activeRateCards === 1 ? "" : "s"}, respecting lane, mode, equipment, validity, minimum charge and surcharges.`} action={<OpsButton size="sm" variant="primary" onClick={() => rateSelectedOrder()} disabled={busy}>Find rates</OpsButton>}/>} 
        </OpsSurface>
      </div>
    </OpsPage>
  );
}
