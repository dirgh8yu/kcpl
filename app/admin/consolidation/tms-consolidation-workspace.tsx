"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Boxes, CheckCircle2, PackagePlus, RefreshCw, Route, Trash2, Truck } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsStat, OpsStatStrip, OpsSurface } from "../operations-ui";
import { tmsModes, type TmsMode, type TmsOrder } from "../rating/tms-rating";
import {
  consolidationSavings,
  loadTotals,
  orderEligibleForConsolidation,
  selectedCostBaselines,
  type TmsConsolidationLoad,
  type TmsLoadStop,
} from "./tms-consolidation";

type ApiResponse = {
  ok: boolean;
  error?: string;
  loads?: TmsConsolidationLoad[];
  orders?: TmsOrder[];
  load?: TmsConsolidationLoad;
  masterOrderId?: string;
};

type StopDraft = { plannedAt: string; instructions: string };

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}
function modeLabel(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function dateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function statusTone(status: TmsConsolidationLoad["status"]): "neutral" | "info" | "warning" | "success" {
  if (status === "booked") return "success";
  if (status === "ready_for_procurement" || status === "tendering") return "info";
  if (status === "cancelled") return "neutral";
  return "warning";
}
function statusLabel(status: TmsConsolidationLoad["status"]) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function TmsConsolidationWorkspace({ initialLoads, initialOrders, canManage }: {
  initialLoads: TmsConsolidationLoad[];
  initialOrders: TmsOrder[];
  canManage: boolean;
}) {
  const [loads, setLoads] = useState(initialLoads);
  const [orders, setOrders] = useState(initialOrders);
  const [selectedLoadId, setSelectedLoadId] = useState(initialLoads.find((load) => load.status !== "cancelled")?.id ?? initialLoads[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<TmsMode>("road");
  const [equipment, setEquipment] = useState("");
  const [capacityWeight, setCapacityWeight] = useState("");
  const [capacityVolume, setCapacityVolume] = useState("");
  const [capacityPieces, setCapacityPieces] = useState("");
  const [capacityContainers, setCapacityContainers] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [addOrderId, setAddOrderId] = useState("");
  const [stopDrafts, setStopDrafts] = useState<Record<string, StopDraft>>({});

  const selectedLoad = useMemo(() => loads.find((load) => load.id === selectedLoadId) ?? null, [loads, selectedLoadId]);
  const eligibleOrders = useMemo(() => orders.filter((order) => orderEligibleForConsolidation(order)), [orders]);
  const loadOrderIds = new Set(selectedLoad?.members.map((member) => member.order_id) ?? []);
  const addableOrders = eligibleOrders.filter((order) => !loadOrderIds.has(order.id) && (!selectedLoad || order.branch === selectedLoad.branch));
  const totals = selectedLoad ? loadTotals(selectedLoad.members.map((member) => ({ weight_kg: member.weight_kg, volume_cbm: member.volume_cbm, pieces: member.pieces, container_count: member.container_count }))) : null;
  const baselines = selectedLoad ? selectedCostBaselines(selectedLoad.members) : {};
  const savings = selectedLoad ? consolidationSavings(selectedLoad) : null;
  const bookedLoads = loads.filter((load) => load.status === "booked").length;
  const draftLoads = loads.filter((load) => load.status === "draft").length;

  function replaceLoad(next: TmsConsolidationLoad) {
    setLoads((current) => current.map((load) => load.id === next.id ? next : load));
    setSelectedLoadId(next.id);
  }

  async function refresh() {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/consolidation", { cache: "no-store" });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.loads || !data.orders) throw new Error(data.error || "Load Planner could not be refreshed.");
      setLoads(data.loads); setOrders(data.orders);
      if (!selectedLoadId && data.loads[0]) setSelectedLoadId(data.loads[0].id);
      setNotice({ tone: "success", text: "Consolidation loads and transport orders refreshed." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Load Planner could not be refreshed." }); }
    finally { setBusy(false); }
  }

  async function action(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/consolidation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as ApiResponse;
    if (!response.ok || !data.ok) throw new Error(data.error || "The consolidation update failed.");
    return data;
  }

  async function createLoad(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const data = await action({ action: "create", name, mode, equipment, orderIds: selectedOrderIds, capacityWeightKg: capacityWeight || null, capacityVolumeCbm: capacityVolume || null, capacityPieces: capacityPieces || null, capacityContainers: capacityContainers || null });
      if (!data.load) throw new Error("Load record was not returned.");
      setLoads((current) => [data.load!, ...current]); setSelectedLoadId(data.load.id); setShowCreate(false); setSelectedOrderIds([]); setName(""); setEquipment(""); setCapacityWeight(""); setCapacityVolume(""); setCapacityPieces(""); setCapacityContainers("");
      await refresh();
      setNotice({ tone: "success", text: `${data.load.reference} created with ${data.load.members.length} house orders. Review and sequence its stops before procurement.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Load could not be created." }); }
    finally { setBusy(false); }
  }

  async function addOrder() {
    if (!selectedLoad || !addOrderId) return;
    setBusy(true); setNotice(null);
    try {
      const data = await action({ action: "add_order", loadId: selectedLoad.id, orderId: addOrderId });
      if (data.load) replaceLoad(data.load);
      setAddOrderId(""); await refresh();
      setNotice({ tone: "success", text: "Order added. The default stop sequence was regenerated, so review the route again." });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Order could not be added." }); }
    finally { setBusy(false); }
  }

  async function removeOrder(orderId: string) {
    if (!selectedLoad) return;
    setBusy(true); setNotice(null);
    try {
      const data = await action({ action: "remove_order", loadId: selectedLoad.id, orderId });
      if (data.load) replaceLoad(data.load);
      await refresh();
      setNotice({ tone: "success", text: `${orderId} removed. The route was regenerated for the remaining house orders.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Order could not be removed." }); }
    finally { setBusy(false); }
  }

  async function moveStop(index: number, direction: -1 | 1) {
    if (!selectedLoad) return;
    const stops = [...selectedLoad.stops].sort((a, b) => a.sequence - b.sequence);
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    [stops[index], stops[target]] = [stops[target], stops[index]];
    setBusy(true); setNotice(null);
    try {
      const data = await action({ action: "reorder", loadId: selectedLoad.id, stopIds: stops.map((stop) => stop.id) });
      if (data.load) replaceLoad(data.load);
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Stop could not be moved." }); }
    finally { setBusy(false); }
  }

  function stopDraft(stop: TmsLoadStop): StopDraft {
    return stopDrafts[stop.id] ?? { plannedAt: dateTimeLocal(stop.planned_at), instructions: stop.instructions ?? "" };
  }

  async function saveStop(stop: TmsLoadStop) {
    if (!selectedLoad) return;
    const draft = stopDraft(stop);
    setBusy(true); setNotice(null);
    try {
      const data = await action({ action: "update_stop", loadId: selectedLoad.id, stopId: stop.id, plannedAt: draft.plannedAt, instructions: draft.instructions });
      if (data.load) replaceLoad(data.load);
      setNotice({ tone: "success", text: `Stop ${stop.sequence} planning details saved.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Stop could not be updated." }); }
    finally { setBusy(false); }
  }

  async function releaseLoad() {
    if (!selectedLoad) return;
    setBusy(true); setNotice(null);
    try {
      const data = await action({ action: "release", loadId: selectedLoad.id });
      await refresh();
      setNotice({ tone: "success", text: `${selectedLoad.reference} is locked for procurement. Rate master order ${data.masterOrderId} in the Rate Desk, then tender it normally.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Load could not be released to procurement." }); }
    finally { setBusy(false); }
  }

  async function cancelLoad() {
    if (!selectedLoad) return;
    setBusy(true); setNotice(null);
    try {
      await action({ action: "cancel", loadId: selectedLoad.id, note: "Cancelled from Load Planner" });
      await refresh();
      setNotice({ tone: "success", text: `${selectedLoad.reference} cancelled and its house orders were released.` });
    } catch (error) { setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Load could not be cancelled." }); }
    finally { setBusy(false); }
  }

  return (
    <OpsPage>
      <OpsPageHeader eyebrow="Transportation management" title="Load Planner" description="Combine compatible transport orders into master movements, sequence multi-stop pickup/delivery plans, enforce capacity, then procure the consolidated load while retaining separate house shipments and Digital Job Files." actions={<div className="flex flex-wrap gap-2"><OpsButton size="sm" onClick={refresh} disabled={busy}><RefreshCw size={13}/> Refresh</OpsButton>{canManage ? <OpsButton size="sm" variant="primary" onClick={() => setShowCreate((value) => !value)}><PackagePlus size={13}/> New load</OpsButton> : null}<Link href="/admin/rating" className="ops-button" data-size="sm" data-variant="secondary">Rate Desk <ArrowRight size={12}/></Link><Link href="/admin/tenders" className="ops-button" data-size="sm" data-variant="secondary">Tender Desk <ArrowRight size={12}/></Link></div>} />

      <OpsStatStrip>
        <OpsStat label="Loads" value={loads.length} icon={<Boxes size={13}/>}/>
        <OpsStat label="Draft planning" value={draftLoads} tone="warning" icon={<Route size={13}/>}/>
        <OpsStat label="Booked masters" value={bookedLoads} tone="success" icon={<CheckCircle2 size={13}/>}/>
        <OpsStat label="Unassigned orders" value={eligibleOrders.length} tone="info" icon={<Truck size={13}/>}/>
      </OpsStatStrip>

      {notice ? <div className="mt-4"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

      {showCreate && canManage ? <OpsSurface className="mt-4" eyebrow="Consolidation planning" title="Create master load" description="Choose at least two compatible orders. Same-branch, mode, equipment, temperature and capacity rules are enforced server-side.">
        <form onSubmit={createLoad} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <OpsField label="Load name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="KTM–Kolkata groupage 22 Aug"/></OpsField>
            <OpsField label="Master mode"><select value={mode} onChange={(event) => setMode(event.target.value as TmsMode)}>{tmsModes.map((value) => <option key={value} value={value}>{modeLabel(value)}</option>)}</select></OpsField>
            <OpsField label="Equipment"><input value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="Truck, 40HC, ULD…"/></OpsField>
            <OpsField label="Weight capacity kg"><input type="number" min="0" step="0.01" value={capacityWeight} onChange={(event) => setCapacityWeight(event.target.value)} placeholder="Optional"/></OpsField>
            <OpsField label="Volume capacity CBM"><input type="number" min="0" step="0.001" value={capacityVolume} onChange={(event) => setCapacityVolume(event.target.value)} placeholder="Optional"/></OpsField>
            <OpsField label="Piece capacity"><input type="number" min="0" step="1" value={capacityPieces} onChange={(event) => setCapacityPieces(event.target.value)} placeholder="Optional"/></OpsField>
            <OpsField label="Container capacity"><input type="number" min="0" step="1" value={capacityContainers} onChange={(event) => setCapacityContainers(event.target.value)} placeholder="Optional"/></OpsField>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[.09em] text-[#7a7069]">House orders</p>
            <div className="grid max-h-[280px] gap-2 overflow-auto rounded-[12px] border border-[#e8e0d9] bg-[#fcfbf9] p-3 md:grid-cols-2">
              {eligibleOrders.length ? eligibleOrders.map((order) => <label key={order.id} className="flex cursor-pointer items-start gap-2 rounded-[10px] border border-[#ece5df] bg-white p-3 text-[10px]"><input type="checkbox" checked={selectedOrderIds.includes(order.id)} onChange={(event) => setSelectedOrderIds((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))}/><span><OpsMono>{order.id}</OpsMono><strong className="mt-1 block text-[#4c433d]">{order.origin} → {order.destination}</strong><span className="mt-1 block text-[#8a8078]">{order.branch} · {modeLabel(order.mode)} · {order.weight_kg.toFixed(1)} kg · {order.volume_cbm.toFixed(3)} CBM{order.customer_name ? ` · ${order.customer_name}` : " · customer not linked"}</span></span></label>) : <OpsEmptyState title="No eligible orders" description="Create transport orders or resolve their current tender/booking state before consolidating."/>}
            </div>
          </div>
          <div className="flex justify-end gap-2"><OpsButton type="button" onClick={() => setShowCreate(false)}>Cancel</OpsButton><OpsButton type="submit" variant="primary" disabled={busy || selectedOrderIds.length < 2}>Create load ({selectedOrderIds.length})</OpsButton></div>
        </form>
      </OpsSurface> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
        <OpsSurface eyebrow="Master loads" title="Consolidation register" description="Select a load to plan its house orders and stop sequence.">
          <div className="grid gap-2">
            {loads.length ? loads.map((load) => <button key={load.id} type="button" onClick={() => setSelectedLoadId(load.id)} className={`rounded-[12px] border p-3 text-left transition ${selectedLoadId === load.id ? "border-[#dca99d] bg-[#fff8f5]" : "border-[#e9e2dc] bg-white hover:border-[#d9cec6]"}`}>
              <div className="flex items-center justify-between gap-2"><OpsMono>{load.reference}</OpsMono><OpsBadge tone={statusTone(load.status)}>{statusLabel(load.status)}</OpsBadge></div>
              <strong className="mt-2 block text-[11px] text-[#4b423c]">{load.name}</strong>
              <span className="mt-1 block text-[9px] text-[#8a8078]">{load.members.length} orders · {load.stops.length} stops · {load.branch} · {modeLabel(load.mode)}</span>
            </button>) : <OpsEmptyState title="No consolidation loads" description="Create a load from compatible transport orders to begin multi-stop planning."/>}
          </div>
        </OpsSurface>

        {selectedLoad ? <div className="grid gap-4">
          <OpsSurface eyebrow={selectedLoad.reference} title={selectedLoad.name} description="Master movement plan with house-level commercial and shipment traceability.">
            <div className="flex flex-wrap items-center gap-2"><OpsBadge tone={statusTone(selectedLoad.status)}>{statusLabel(selectedLoad.status)}</OpsBadge><OpsBadge tone="neutral">{selectedLoad.branch}</OpsBadge><OpsBadge tone="neutral">{modeLabel(selectedLoad.mode)}</OpsBadge>{selectedLoad.equipment ? <OpsBadge tone="info">{selectedLoad.equipment}</OpsBadge> : null}</div>
            {totals ? <div className="mt-4 grid gap-2 sm:grid-cols-4"><Mini label="Weight" value={`${totals.weight_kg.toFixed(2)} kg`} sub={selectedLoad.capacity_weight_kg ? `of ${selectedLoad.capacity_weight_kg} kg` : "No cap set"}/><Mini label="Volume" value={`${totals.volume_cbm.toFixed(3)} CBM`} sub={selectedLoad.capacity_volume_cbm ? `of ${selectedLoad.capacity_volume_cbm} CBM` : "No cap set"}/><Mini label="Pieces" value={String(totals.pieces)} sub={selectedLoad.capacity_pieces ? `of ${selectedLoad.capacity_pieces}` : "No cap set"}/><Mini label="Containers" value={String(totals.containers)} sub={selectedLoad.capacity_containers ? `of ${selectedLoad.capacity_containers}` : "No cap set"}/></div> : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[12px] border border-[#e9e2dc] bg-[#fcfbf9] p-3"><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#8a8078]">Pre-consolidation selected cost baseline</p>{Object.entries(baselines).length ? Object.entries(baselines).map(([currency, value]) => <strong key={currency} className="mt-1 block text-[12px] text-[#4b423c]">{money(value ?? 0, currency)}</strong>) : <p className="mt-1 text-[10px] text-[#8a8078]">No comparable individual selected costs yet.</p>}</div>
              <div className="rounded-[12px] border border-[#e9e2dc] bg-[#fcfbf9] p-3"><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#8a8078]">Consolidation result</p>{savings && selectedLoad.procurement_currency ? <><strong className="mt-1 block text-[12px] text-[#4b423c]">{money(savings.savings, selectedLoad.procurement_currency)} savings</strong><p className="mt-1 text-[9px] text-[#8a8078]">Baseline {money(savings.baseline, selectedLoad.procurement_currency)} → master {money(savings.consolidated, selectedLoad.procurement_currency)}</p></> : selectedLoad.procurement_cost !== null && selectedLoad.procurement_currency ? <strong className="mt-1 block text-[12px] text-[#4b423c]">Master procurement {money(selectedLoad.procurement_cost, selectedLoad.procurement_currency)}</strong> : <p className="mt-1 text-[10px] text-[#8a8078]">Calculated after the master tender is booked.</p>}</div>
            </div>
            {selectedLoad.status === "ready_for_procurement" && selectedLoad.master_order_id ? <div className="mt-4 rounded-[12px] border border-[#d9e5dc] bg-[#f6faf7] p-3 text-[10px] text-[#56675a]"><strong>Master procurement order:</strong> <OpsMono>{selectedLoad.master_order_id}</OpsMono><div className="mt-2 flex flex-wrap gap-2"><Link href="/admin/rating" className="ops-button" data-size="sm" data-variant="primary">Rate master order <ArrowRight size={11}/></Link><Link href="/admin/tenders" className="ops-button" data-size="sm" data-variant="secondary">Tender Desk <ArrowRight size={11}/></Link></div></div> : null}
            {selectedLoad.status === "booked" ? <div className="mt-4 rounded-[12px] border border-[#d9e5dc] bg-[#f6faf7] p-3 text-[10px] text-[#56675a]"><strong>Master booking:</strong> {selectedLoad.master_booking_reference || "Recorded"} · {selectedLoad.procurement_partner_name || "Partner"}<p className="mt-1">Each house order below has its own Digital Job File while remaining linked to this master movement.</p></div> : null}
          </OpsSurface>

          <OpsSurface eyebrow="House orders" title={`${selectedLoad.members.length} orders in master load`} description={selectedLoad.status === "draft" ? "Membership can be adjusted until the load is released to procurement. Adding/removing an order regenerates the default route." : "House membership is locked to preserve procurement and shipment truth."}>
            <div className="grid gap-2">
              {selectedLoad.members.map((member) => <div key={member.order_id} className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-[#e9e2dc] bg-white p-3"><div><OpsMono>{member.order_id}</OpsMono><strong className="mt-1 block text-[10px] text-[#4b423c]">{member.origin} → {member.destination}</strong><span className="mt-1 block text-[9px] text-[#8a8078]">{member.customer_name || member.customer_id || "Customer not linked"} · {member.weight_kg.toFixed(1)} kg · {member.volume_cbm.toFixed(3)} CBM{member.allocated_cost !== null && member.allocated_currency ? ` · allocated ${money(member.allocated_cost, member.allocated_currency)}` : ""}</span></div><div className="flex items-center gap-2">{member.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(member.shipment_reference)}`} className="ops-button" data-size="sm" data-variant="secondary">Job File <ArrowRight size={11}/></Link> : null}{selectedLoad.status === "draft" && canManage ? <OpsButton size="sm" onClick={() => removeOrder(member.order_id)} disabled={busy}><Trash2 size={11}/> Remove</OpsButton> : null}</div></div>)}
            </div>
            {selectedLoad.status === "draft" && canManage ? <div className="mt-3 flex flex-wrap items-end gap-2"><OpsField label="Add compatible order"><select value={addOrderId} onChange={(event) => setAddOrderId(event.target.value)}><option value="">Choose order</option>{addableOrders.map((order) => <option key={order.id} value={order.id}>{order.id} · {order.origin} → {order.destination}</option>)}</select></OpsField><OpsButton onClick={addOrder} disabled={!addOrderId || busy}>Add order</OpsButton></div> : null}
          </OpsSurface>

          <OpsSurface eyebrow="Multi-stop route" title={`${selectedLoad.stops.length} planned stops`} description={selectedLoad.status === "draft" ? "Sequence the route. The server blocks any plan that delivers an order before its pickup." : "Stop sequence is locked because procurement now references this route."}>
            <div className="grid gap-2">
              {[...selectedLoad.stops].sort((a, b) => a.sequence - b.sequence).map((stop, index, sorted) => { const draft = stopDraft(stop); return <div key={stop.id} className="rounded-[12px] border border-[#e8e0d9] bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#f4ece7] text-[10px] font-bold text-[#8d6559]">{stop.sequence}</span><div><div className="flex flex-wrap items-center gap-2"><strong className="text-[11px] text-[#4b423c]">{stop.location}</strong><OpsBadge tone={stop.kind === "pickup" ? "info" : stop.kind === "delivery" ? "success" : "neutral"}>{modeLabel(stop.kind)}</OpsBadge></div><p className="mt-1 text-[9px] text-[#8a8078]">Orders: {stop.order_ids.join(", ")}</p></div></div>{selectedLoad.status === "draft" && canManage ? <div className="flex gap-1"><OpsButton size="sm" onClick={() => moveStop(index, -1)} disabled={busy || index === 0}><ArrowUp size={11}/></OpsButton><OpsButton size="sm" onClick={() => moveStop(index, 1)} disabled={busy || index === sorted.length - 1}><ArrowDown size={11}/></OpsButton></div> : null}</div>{selectedLoad.status === "draft" && canManage ? <div className="mt-3 grid gap-2 md:grid-cols-[220px_1fr_auto]"><OpsField label="Planned time"><input type="datetime-local" value={draft.plannedAt} onChange={(event) => setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, plannedAt: event.target.value } }))}/></OpsField><OpsField label="Stop instructions"><input value={draft.instructions} onChange={(event) => setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, instructions: event.target.value } }))} placeholder="Dock, contact, customs handoff, time window…"/></OpsField><div className="flex items-end"><OpsButton size="sm" onClick={() => saveStop(stop)} disabled={busy}>Save stop</OpsButton></div></div> : stop.planned_at || stop.instructions ? <p className="mt-2 text-[9px] text-[#8a8078]">{stop.planned_at ? new Date(stop.planned_at).toLocaleString("en-AU") : "Time not fixed"}{stop.instructions ? ` · ${stop.instructions}` : ""}</p> : null}</div>; })}
            </div>
          </OpsSurface>

          {selectedLoad.status === "draft" && canManage ? <div className="flex flex-wrap justify-end gap-2"><OpsButton onClick={cancelLoad} disabled={busy}><Trash2 size={12}/> Cancel load</OpsButton><OpsButton variant="primary" onClick={releaseLoad} disabled={busy}>Lock route & release to procurement <ArrowRight size={12}/></OpsButton></div> : null}
        </div> : <OpsSurface><OpsEmptyState title="Choose a load" description="Select a master load to manage its house orders, capacity and stop sequence."/></OpsSurface>}
      </div>
    </OpsPage>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="rounded-[11px] border border-[#e9e2dc] bg-white p-3"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#958a82]">{label}</p><strong className="mt-1 block text-[12px] text-[#4b423c]">{value}</strong><span className="mt-1 block text-[8px] text-[#9a9089]">{sub}</span></div>;
}
