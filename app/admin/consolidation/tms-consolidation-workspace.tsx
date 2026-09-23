"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp, PackagePlus, RefreshCw, Trash2, X } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsFact, OpsFacts, OpsField, OpsInspectorNote, OpsKpiRail, OpsNotice, OpsPage, OpsPageHeader, OpsRailMetric, OpsRegisterToolbar, OpsScopeTabs, OpsSearch, OpsSurface, OpsTableWrap } from "../operations-ui";
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
  const words = status.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type LoadScope = "all" | TmsConsolidationLoad["status"];
const LOAD_SCOPES: Array<{ value: LoadScope; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "ready_for_procurement", label: "Ready for procurement" },
  { value: "tendering", label: "Tendering" },
  { value: "booked", label: "Booked" },
  { value: "cancelled", label: "Cancelled" },
];

export function TmsConsolidationWorkspace({ initialLoads, initialOrders, canManage, allocation }: {
  initialLoads: TmsConsolidationLoad[];
  initialOrders: TmsOrder[];
  canManage: boolean;
  /** The commercial allocation desk, rendered in the page flow under the load workspace. */
  allocation?: ReactNode;
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
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<LoadScope>("all");
  const detailRef = useRef<HTMLElement>(null);

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

  // The load workspace sits under the register; bring it into view on selection.
  function selectLoad(id: string) {
    setSelectedLoadId(id);
    window.requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      detailRef.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    });
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

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visibleLoads = loads.filter((load) => {
    if (scope !== "all" && load.status !== scope) return false;
    if (!terms.length) return true;
    const haystack = [load.reference, load.name, load.branch, load.mode, load.equipment ?? "", statusLabel(load.status), ...load.members.map((member) => `${member.order_id} ${member.origin} ${member.destination} ${member.customer_name ?? ""}`)].join(" ").toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  const scopeItems = LOAD_SCOPES.map((item) => ({ ...item, count: item.value === "all" ? loads.length : loads.filter((load) => load.status === item.value).length }));
  const filtersActive = Boolean(query.trim()) || scope !== "all";
  const sortedStops = selectedLoad ? [...selectedLoad.stops].sort((a, b) => a.sequence - b.sequence) : [];
  const editable = Boolean(selectedLoad && selectedLoad.status === "draft" && canManage);

  return (
    <OpsPage>
      <OpsPageHeader
        title="Load Planner"
        description="Consolidate transport orders into master loads and sequence their stops."
        actions={<>
          <OpsButton variant="secondary" onClick={refresh} disabled={busy}><RefreshCw size={16} strokeWidth={1.75} aria-hidden="true"/>Refresh</OpsButton>
          <Link href="/admin/rating" className="ops-button" data-size="md" data-variant="secondary">Rate Desk</Link>
          <Link href="/admin/tenders" className="ops-button" data-size="md" data-variant="secondary">Tender Desk</Link>
          {canManage ? <OpsButton variant="primary" onClick={() => setShowCreate((value) => !value)} aria-expanded={showCreate}><PackagePlus size={16} strokeWidth={1.75} aria-hidden="true"/>New load</OpsButton> : null}
        </>}
      />

      <div className="px-4 pb-8 pt-4 md:px-6">
        <OpsKpiRail label="Load planner summary">
          <OpsRailMetric label="Loads" value={loads.length}/>
          <OpsRailMetric label="Draft planning" value={draftLoads} tone={draftLoads ? "warning" : "neutral"} active={scope === "draft"} onClick={() => setScope(scope === "draft" ? "all" : "draft")} title="Show loads still in draft planning"/>
          <OpsRailMetric label="Booked masters" value={bookedLoads} active={scope === "booked"} onClick={() => setScope(scope === "booked" ? "all" : "booked")} title="Show booked master loads"/>
          <OpsRailMetric label="Unassigned orders" value={eligibleOrders.length}/>
        </OpsKpiRail>

        {notice ? <div className="plan-notice"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

        {showCreate && canManage ? <div className="plan-panel">
          <OpsSurface
            density="compact"
            title="Create master load"
            description="Choose at least two compatible orders. Same-branch, mode, equipment, temperature and capacity rules are enforced server-side."
            action={<button type="button" className="ops-inspector-close" onClick={() => setShowCreate(false)} aria-label="Close create load"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>}
          >
            <form onSubmit={createLoad}>
              <div className="ops-form-grid">
                <OpsField label="Load name" className="ops-form-wide"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="KTM-Kolkata groupage 22 Aug"/></OpsField>
                <OpsField label="Master mode"><select value={mode} onChange={(event) => setMode(event.target.value as TmsMode)}>{tmsModes.map((value) => <option key={value} value={value}>{modeLabel(value)}</option>)}</select></OpsField>
                <OpsField label="Equipment"><input value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="Truck, 40HC, ULD…"/></OpsField>
                <OpsField label="Weight capacity kg"><input type="number" min="0" step="0.01" value={capacityWeight} onChange={(event) => setCapacityWeight(event.target.value)} placeholder="Optional"/></OpsField>
                <OpsField label="Volume capacity CBM"><input type="number" min="0" step="0.001" value={capacityVolume} onChange={(event) => setCapacityVolume(event.target.value)} placeholder="Optional"/></OpsField>
                <OpsField label="Piece capacity"><input type="number" min="0" step="1" value={capacityPieces} onChange={(event) => setCapacityPieces(event.target.value)} placeholder="Optional"/></OpsField>
                <OpsField label="Container capacity"><input type="number" min="0" step="1" value={capacityContainers} onChange={(event) => setCapacityContainers(event.target.value)} placeholder="Optional"/></OpsField>
              </div>
              <div className="load-picker">
                <p className="load-picker-label">House orders · {selectedOrderIds.length} selected</p>
                {eligibleOrders.length ? <div className="load-picker-list"><OpsTableWrap>
                  <table className="ops-table ops-register-table load-picker-table" aria-label="Eligible house orders">
                    <thead><tr><th><span className="sr-only">Select</span></th><th>Order</th><th>Lane</th><th>Customer</th><th className="ops-col-num">Weight · volume</th></tr></thead>
                    <tbody>{eligibleOrders.map((order) => {
                      const checked = selectedOrderIds.includes(order.id);
                      return <tr key={order.id} data-selected={checked || undefined}>
                        <td className="load-picker-check"><input type="checkbox" aria-label={`Select ${order.id} for consolidation`} checked={checked} onChange={(event) => setSelectedOrderIds((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))}/></td>
                        <td><span className="ops-cell-primary ops-mono ops-cell-id">{order.id}</span><span className="ops-cell-secondary">{order.branch} · {modeLabel(order.mode)}</span></td>
                        <td><span className="ops-cell-clamp" title={`${order.origin} → ${order.destination}`}>{order.origin} → {order.destination}</span></td>
                        <td>{order.customer_name ? <span className="ops-cell-clamp">{order.customer_name}</span> : <span className="ops-cell-muted">Customer not linked</span>}</td>
                        <td className="ops-col-num"><span className="ops-num">{order.weight_kg.toFixed(1)} kg · {order.volume_cbm.toFixed(3)} CBM</span></td>
                      </tr>;
                    })}</tbody>
                  </table>
                </OpsTableWrap></div> : <OpsEmptyState compact title="No eligible orders" description="Create transport orders or resolve their current tender/booking state before consolidating."/>}
              </div>
              <div className="ops-form-actions">
                <OpsButton type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</OpsButton>
                <OpsButton type="submit" variant="primary" size="sm" disabled={busy || selectedOrderIds.length < 2}>Create load ({selectedOrderIds.length})</OpsButton>
              </div>
            </form>
          </OpsSurface>
        </div> : null}

        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search load, order, lane, customer…" aria-label="Search master loads"/>}
          actions={<>
            {filtersActive ? <OpsButton size="xs" variant="ghost" onClick={() => { setQuery(""); setScope("all"); }}>Reset</OpsButton> : null}
            <span className="ops-result-count" aria-live="polite">{visibleLoads.length === loads.length ? `${loads.length} loads` : `${visibleLoads.length} of ${loads.length}`}</span>
          </>}
          tabs={<OpsScopeTabs label="Load status" items={scopeItems} value={scope} onChange={setScope}/>}
        />

        <section className="ops-surface load-register" aria-label="Consolidation register">
          {visibleLoads.length ? <OpsTableWrap>
            <table className="ops-table ops-register-table load-table" aria-label="Master loads">
              <thead><tr><th>Load</th><th>Branch · mode</th><th>Orders · stops</th><th>Capacity</th><th>Status</th></tr></thead>
              <tbody>{visibleLoads.map((load) => {
                const chosen = selectedLoadId === load.id;
                const loadWeight = load.members.reduce((sum, member) => sum + member.weight_kg, 0);
                return <tr key={load.id} tabIndex={0} data-selected={chosen || undefined} aria-current={chosen || undefined} onClick={() => selectLoad(load.id)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectLoad(load.id); } }}>
                  <td><span className="ops-cell-primary ops-mono ops-cell-id">{load.reference}</span><span className="ops-cell-secondary ops-cell-clamp" title={load.name}>{load.name}</span></td>
                  <td><span className="ops-cell-primary">{load.branch}</span><span className="ops-cell-secondary">{modeLabel(load.mode)}{load.equipment ? ` · ${load.equipment}` : ""}</span></td>
                  <td><span className="ops-num">{load.members.length} · {load.stops.length}</span></td>
                  <td><span className="ops-cell-muted plan-nowrap">{loadWeight.toFixed(1)} kg{load.capacity_weight_kg ? ` of ${load.capacity_weight_kg}` : ""}</span></td>
                  <td><OpsBadge tone={statusTone(load.status)}>{statusLabel(load.status)}</OpsBadge></td>
                </tr>;
              })}</tbody>
            </table>
          </OpsTableWrap> : <OpsEmptyState compact kind="search" icon={<PackagePlus size={16} strokeWidth={1.75} aria-hidden="true"/>} title={filtersActive ? "No loads match" : "No consolidation loads"} description={filtersActive ? "Change or reset the filters." : "Create a load from compatible transport orders to begin multi-stop planning."}/>}
        </section>

        {selectedLoad ? <section ref={detailRef} className="load-detail" aria-label={`Load ${selectedLoad.reference}`}>
          <header className="load-detail-head">
            <div className="min-w-0">
              <p className="ops-inspector-kicker">{selectedLoad.reference}</p>
              <h2>{selectedLoad.name}</h2>
              <p className="load-detail-meta">{selectedLoad.branch} · {modeLabel(selectedLoad.mode)}{selectedLoad.equipment ? ` · ${selectedLoad.equipment}` : ""} · master movement with house-level commercial and shipment traceability</p>
            </div>
            <OpsBadge tone={statusTone(selectedLoad.status)}>{statusLabel(selectedLoad.status)}</OpsBadge>
          </header>

          <div className="load-detail-grid">
            <div className="load-detail-main">
              <OpsSurface density="compact" title={`${selectedLoad.members.length} house orders`} description={selectedLoad.status === "draft" ? "Membership can change until the load is released. Adding or removing an order regenerates the default route." : "House membership is locked to preserve procurement and shipment truth."} flush>
                <OpsTableWrap>
                  <table className="ops-table ops-register-table load-members-table" aria-label="House orders in this load">
                    <thead><tr><th>Order</th><th>Customer</th><th className="ops-col-num">Weight · volume</th><th className="ops-col-num">Allocated</th><th><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>{selectedLoad.members.map((member) => <tr key={member.order_id}>
                      <td><span className="ops-cell-primary ops-mono ops-cell-id">{member.order_id}</span><span className="ops-cell-secondary ops-cell-clamp" title={`${member.origin} → ${member.destination}`}>{member.origin} → {member.destination}</span></td>
                      <td>{member.customer_name || member.customer_id ? <span className="ops-cell-clamp">{member.customer_name || member.customer_id}</span> : <span className="ops-cell-muted">Customer not linked</span>}</td>
                      <td className="ops-col-num"><span className="ops-num">{member.weight_kg.toFixed(1)} kg · {member.volume_cbm.toFixed(3)} CBM</span></td>
                      <td className="ops-col-num">{member.allocated_cost !== null && member.allocated_currency ? <span className="ops-num">{money(member.allocated_cost, member.allocated_currency)}</span> : <span className="ops-cell-muted">—</span>}</td>
                      <td className="ops-cell-actions">
                        {member.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(member.shipment_reference)}`} className="ops-button" data-size="xs" data-variant="ghost">Job File</Link> : null}
                        {editable ? <OpsButton size="xs" variant="ghost" onClick={() => removeOrder(member.order_id)} disabled={busy} aria-label={`Remove ${member.order_id}`}><Trash2 size={14} strokeWidth={1.75} aria-hidden="true"/>Remove</OpsButton> : null}
                      </td>
                    </tr>)}</tbody>
                  </table>
                </OpsTableWrap>
                {editable ? <div className="load-add-order">
                  <OpsField label="Add compatible order"><select value={addOrderId} onChange={(event) => setAddOrderId(event.target.value)}><option value="">Choose order</option>{addableOrders.map((order) => <option key={order.id} value={order.id}>{order.id} · {order.origin} → {order.destination}</option>)}</select></OpsField>
                  <OpsButton size="sm" onClick={addOrder} disabled={!addOrderId || busy}>Add order</OpsButton>
                </div> : null}
              </OpsSurface>

              <OpsSurface className="load-route" density="compact" title={`${selectedLoad.stops.length} planned stops`} description={selectedLoad.status === "draft" ? "Sequence the route. The server blocks any plan that delivers an order before its pickup." : "Stop sequence is locked because procurement now references this route."} flush>
                <ol className="load-stops">
                  {sortedStops.map((stop, index) => {
                    const draft = stopDraft(stop);
                    return <li key={stop.id} className="load-stop">
                      <div className="load-stop-head">
                        <span className="load-stop-seq" aria-label={`Stop ${stop.sequence}`}>{stop.sequence}</span>
                        <div className="min-w-0">
                          <div className="load-stop-title"><strong>{stop.location}</strong><OpsBadge tone={stop.kind === "pickup" ? "info" : stop.kind === "delivery" ? "success" : "neutral"}>{modeLabel(stop.kind)}</OpsBadge></div>
                          <p className="load-stop-meta">Orders: {stop.order_ids.join(", ")}</p>
                          {!editable && (stop.planned_at || stop.instructions) ? <p className="load-stop-meta">{stop.planned_at ? new Date(stop.planned_at).toLocaleString("en-AU") : "Time not fixed"}{stop.instructions ? ` · ${stop.instructions}` : ""}</p> : null}
                        </div>
                        {editable ? <div className="load-stop-move">
                          <OpsButton size="xs" variant="ghost" onClick={() => moveStop(index, -1)} disabled={busy || index === 0} aria-label={`Move stop ${stop.sequence} up`}><ArrowUp size={14} strokeWidth={1.75} aria-hidden="true"/></OpsButton>
                          <OpsButton size="xs" variant="ghost" onClick={() => moveStop(index, 1)} disabled={busy || index === sortedStops.length - 1} aria-label={`Move stop ${stop.sequence} down`}><ArrowDown size={14} strokeWidth={1.75} aria-hidden="true"/></OpsButton>
                        </div> : null}
                      </div>
                      {editable ? <div className="load-stop-edit">
                        <OpsField label="Planned time"><input type="datetime-local" value={draft.plannedAt} onChange={(event) => setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, plannedAt: event.target.value } }))}/></OpsField>
                        <OpsField label="Stop instructions"><input value={draft.instructions} onChange={(event) => setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, instructions: event.target.value } }))} placeholder="Dock, contact, customs handoff, time window…"/></OpsField>
                        <OpsButton size="sm" onClick={() => saveStop(stop)} disabled={busy}>Save stop</OpsButton>
                      </div> : null}
                    </li>;
                  })}
                </ol>
              </OpsSurface>
            </div>

            <div className="load-detail-side">
              {totals ? <OpsSurface density="compact" title="Capacity">
                <OpsFacts>
                  <OpsFact label="Weight">{`${totals.weight_kg.toFixed(2)} kg · ${selectedLoad.capacity_weight_kg ? `of ${selectedLoad.capacity_weight_kg} kg` : "no cap set"}`}</OpsFact>
                  <OpsFact label="Volume">{`${totals.volume_cbm.toFixed(3)} CBM · ${selectedLoad.capacity_volume_cbm ? `of ${selectedLoad.capacity_volume_cbm} CBM` : "no cap set"}`}</OpsFact>
                  <OpsFact label="Pieces">{`${totals.pieces} · ${selectedLoad.capacity_pieces ? `of ${selectedLoad.capacity_pieces}` : "no cap set"}`}</OpsFact>
                  <OpsFact label="Containers">{`${totals.containers} · ${selectedLoad.capacity_containers ? `of ${selectedLoad.capacity_containers}` : "no cap set"}`}</OpsFact>
                </OpsFacts>
              </OpsSurface> : null}

              <OpsSurface density="compact" title="Economics">
                <OpsFacts>
                  <OpsFact label="Selected cost baseline">{Object.entries(baselines).length ? Object.entries(baselines).map(([currency, value]) => money(value ?? 0, currency)).join(" · ") : "No comparable individual selected costs yet"}</OpsFact>
                  <OpsFact label="Consolidation result">{savings && selectedLoad.procurement_currency ? `${money(savings.savings, selectedLoad.procurement_currency)} savings · ${money(savings.baseline, selectedLoad.procurement_currency)} → ${money(savings.consolidated, selectedLoad.procurement_currency)}` : selectedLoad.procurement_cost !== null && selectedLoad.procurement_currency ? `Master procurement ${money(selectedLoad.procurement_cost, selectedLoad.procurement_currency)}` : "Calculated after the master tender is booked"}</OpsFact>
                </OpsFacts>
              </OpsSurface>

              {selectedLoad.status === "ready_for_procurement" && selectedLoad.master_order_id ? <OpsInspectorNote tone="info" title={`Master procurement order ${selectedLoad.master_order_id}`}>
                Rate the master order in the Rate Desk, then tender it normally.
                <span className="load-note-actions"><Link href="/admin/rating" className="ops-button" data-size="xs" data-variant="secondary">Rate master order</Link><Link href="/admin/tenders" className="ops-button" data-size="xs" data-variant="ghost">Tender Desk</Link></span>
              </OpsInspectorNote> : null}
              {selectedLoad.status === "booked" ? <OpsInspectorNote tone="success" title={`Master booking ${selectedLoad.master_booking_reference || "recorded"} · ${selectedLoad.procurement_partner_name || "Partner"}`}>Each house order keeps its own Digital Job File while remaining linked to this master movement.</OpsInspectorNote> : null}

              {editable ? <div className="load-detail-actions">
                <OpsButton variant="danger" size="sm" onClick={cancelLoad} disabled={busy}><Trash2 size={14} strokeWidth={1.75} aria-hidden="true"/>Cancel load</OpsButton>
                <OpsButton variant="primary" size="sm" onClick={releaseLoad} disabled={busy}>Lock route & release to procurement<ArrowRight size={14} strokeWidth={1.75} aria-hidden="true"/></OpsButton>
              </div> : null}
            </div>
          </div>
        </section> : null}

        {allocation ? <div className="plan-section">{allocation}</div> : null}
      </div>
    </OpsPage>
  );
}
