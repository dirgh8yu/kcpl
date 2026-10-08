"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, ChevronRight, X } from "lucide-react";
import type { KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsButton, OpsFact, OpsFacts, OpsField, OpsFilterSelect, OpsInspectorHeader, OpsInspectorSection, OpsNoMatches, OpsNotice, OpsPage, OpsPageHeader, OpsRegisterToolbar, OpsResultCount, OpsScopeTabs, OpsSearch, OpsSurface, OpsTableWrap } from "../operations-ui";
import { tmsModes, type TmsMode, type TmsOrder, type TmsOrderStatus } from "./tms-rating";
import { freightModeLabel } from "../freight-mode";

type ApiResponse = { ok: boolean; error?: string; order?: TmsOrder };

type StatusFilter = "active" | "all" | TmsOrderStatus;

const statusLabels: Record<TmsOrderStatus, string> = {
  draft: "Draft",
  rated: "Rated",
  selected: "Rate selected",
  tendering: "Tendering",
  booked: "Booked",
  cancelled: "Cancelled",
};

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "rated", label: "Rated" },
  { value: "selected", label: "Rate selected" },
  { value: "tendering", label: "Tendering" },
  { value: "booked", label: "Booked" },
];

function statusTone(status: TmsOrderStatus): "success" | "info" | "warning" | "neutral" {
  if (status === "booked") return "success";
  if (status === "tendering" || status === "rated") return "info";
  if (status === "selected") return "warning";
  return "neutral";
}

const modeLabel = freightModeLabel;

function shortDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: value.length === 10 ? "UTC" : "Asia/Kathmandu" }).format(date);
}

function money(value: number | null, currency: string | null) {
  if (value === null || !currency) return "Not selected";
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}

function nextAction(order: TmsOrder) {
  if (order.status === "draft") return { title: "Rate transport order", detail: "Compare the order against active Partner buy rates before procurement." };
  if (order.status === "rated") return { title: "Select procurement rate", detail: "A compatible rate has been calculated but no Partner rate is locked yet." };
  if (order.status === "selected") return { title: "Open carrier booking", detail: "The procurement rate is selected. Tendering remains server-authoritative." };
  if (order.status === "tendering") return { title: "Review carrier response", detail: "Tender activity is in progress. Booking requires an accepted or valid counter-offer." };
  if (order.status === "booked") return { title: "Review booking handoff", detail: "The accepted commercial outcome has already moved into execution." };
  return { title: "Review record", detail: "This transport order is not currently progressing through procurement." };
}

export function V4TransportOrdersWorkspace({ initialOrders, branches }: { initialOrders: TmsOrder[]; branches: KcplBranch[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [branch, setBranch] = useState<"all" | KcplBranch>("all");
  const [modeFilter, setModeFilter] = useState<"all" | TmsMode>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const defaultBranch = branches[0] ?? "Kathmandu";
  const [orderBranch, setOrderBranch] = useState<KcplBranch>(defaultBranch);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<TmsMode>("road");
  const [pickupDate, setPickupDate] = useState("");
  const [weightKg, setWeightKg] = useState("0");
  const [volumeCbm, setVolumeCbm] = useState("0");
  const [pieces, setPieces] = useState("0");
  const [containers, setContainers] = useState("0");
  const [equipment, setEquipment] = useState("");

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return orders.filter((order) => {
      if (status === "active" && ["booked", "cancelled"].includes(order.status)) return false;
      if (status !== "active" && status !== "all" && order.status !== status) return false;
      if (branch !== "all" && order.branch !== branch) return false;
      if (modeFilter !== "all" && order.mode !== modeFilter) return false;
      if (!terms.length) return true;
      const haystack = [order.id, order.customer_name ?? "", order.origin, order.destination, order.mode, order.branch, statusLabels[order.status]].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  }, [branch, modeFilter, orders, query, status]);

  const selected = orders.find((order) => order.id === selectedOrderId) ?? null;
  const statusCounts = useMemo(() => {
    const byStatus = Object.fromEntries(Object.keys(statusLabels).map((key) => [key, orders.filter((order) => order.status === key).length])) as Record<TmsOrderStatus, number>;
    return { ...byStatus, active: orders.filter((order) => !["booked", "cancelled"].includes(order.status)).length, all: orders.length } as Record<StatusFilter, number>;
  }, [orders]);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/rating", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create_order",
          branch: orderBranch,
          origin,
          destination,
          mode,
          pickupDate,
          weightKg: Number(weightKg),
          volumeCbm: Number(volumeCbm),
          pieces: Number(pieces),
          containerCount: Number(containers),
          equipment,
        }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.order) throw new Error(data.error || "Transport order could not be created.");
      setOrders((current) => [data.order!, ...current.filter((item) => item.id !== data.order!.id)]);
      setSelectedOrderId(data.order.id);
      setCreatedOrderId(data.order.id);
      setShowCreate(false);
      setOrigin("");
      setDestination("");
      setPickupDate("");
      setWeightKg("0");
      setVolumeCbm("0");
      setPieces("0");
      setContainers("0");
      setEquipment("");
      setNotice({ tone: "success", text: `${data.order.id} was created successfully.` });
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Transport order could not be created." });
    } finally {
      setBusy(false);
    }
  }

  return <OpsPage>
    <OpsPageHeader
      title="Buy rates"
      description="What carriers charge us for each order, and which one we chose."
      actions={(
        <>
          <Link href="/admin/rating?view=rate-desk" className="ops-button" data-variant="secondary" data-size="md">Rate desk</Link>
          <button type="button" onClick={() => setShowCreate((value) => !value)} className="ops-button" data-variant="primary" data-size="md">New transport order</button>
        </>
      )}
    />


      {notice ? <div className="mt-4"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

      {createdOrderId ? <div className="mt-4"><OpsNotice tone="success" onDismiss={() => setCreatedOrderId(null)}>
        <strong>Order <span className="ops-mono">{createdOrderId}</span> created.</strong> It’s ready to rate.{" "}
        <Link href={`/admin/rating?view=rate-desk&order=${encodeURIComponent(createdOrderId)}`} className="font-semibold underline">Rate it now</Link> or <Link href={`/admin/rating/${encodeURIComponent(createdOrderId)}`} className="font-semibold underline">open the order</Link>.
      </OpsNotice></div> : null}

      {showCreate ? <div className="px-4 pt-4 md:px-6"><OpsSurface title="New transport order">
        <form onSubmit={createOrder} className="grid gap-x-4 gap-y-3 md:grid-cols-4">
          <Field label="Branch"><select className="ops-select" value={orderBranch} onChange={(event) => setOrderBranch(event.target.value as KcplBranch)}>{branches.map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Mode"><select className="ops-select" value={mode} onChange={(event) => setMode(event.target.value as TmsMode)}>{tmsModes.map((value) => <option key={value} value={value}>{modeLabel(value)}</option>)}</select></Field>
          <Field label="Origin"><input className="ops-input" required value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Kathmandu / KTM / Nepal"/></Field>
          <Field label="Destination"><input className="ops-input" required value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Melbourne / MEL / Australia"/></Field>
          <Field label="Pickup date"><input className="ops-input" type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)}/></Field>
          <Field label="Weight (kg)"><input className="ops-input" type="number" min="0" step="0.01" value={weightKg} onChange={(event) => setWeightKg(event.target.value)}/></Field>
          <Field label="Volume (CBM)"><input className="ops-input" type="number" min="0" step="0.001" value={volumeCbm} onChange={(event) => setVolumeCbm(event.target.value)}/></Field>
          <Field label="Pieces"><input className="ops-input" type="number" min="0" step="1" value={pieces} onChange={(event) => setPieces(event.target.value)}/></Field>
          <Field label="Containers"><input className="ops-input" type="number" min="0" step="1" value={containers} onChange={(event) => setContainers(event.target.value)}/></Field>
          <Field label="Equipment"><input className="ops-input" value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="20GP, 40HC, reefer, truck…"/></Field>
          <div className="flex items-end justify-end gap-2 md:col-span-2"><OpsButton variant="ghost" onClick={() => setShowCreate(false)}>Cancel</OpsButton><OpsButton type="submit" variant="primary" disabled={busy}>{busy ? "Creating…" : "Create order"}</OpsButton></div>
        </form>
      </OpsSurface></div> : null}

      <div className="px-4 pb-8 pt-4 md:px-6">
      <OpsRegisterToolbar
        search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, customer, route…" aria-label="Search transport orders"/>}
        actions={(
          <>
            <OpsFilterSelect label="Branch" value={branch} allLabel="All branches" options={branches.map((value) => ({ value, label: value }))} onChange={(value) => setBranch(value === "all" ? "all" : value as KcplBranch)}/>
            <OpsFilterSelect label="Mode" value={modeFilter} allLabel="All modes" options={tmsModes.map((value) => ({ value, label: modeLabel(value) }))} onChange={(value) => setModeFilter(value === "all" ? "all" : value as TmsMode)}/>
            {query.trim() || status !== "active" || branch !== "all" || modeFilter !== "all" ? <button type="button" className="ops-inline-alert-action" onClick={() => { setQuery(""); setStatus("active"); setBranch("all"); setModeFilter("all"); }}>Reset</button> : null}
            <span className="ops-toolbar-divider" aria-hidden="true"/>
            <OpsResultCount count={filtered.length} searching={Boolean(query.trim())}/>
          </>
        )}
        tabs={<OpsScopeTabs label="Order status views" items={STATUS_TABS.map((tab) => ({ ...tab, count: statusCounts[tab.value] }))} value={status} onChange={(value) => setStatus(value)}/>}
      />

      <div className="ops-register-layout" data-inspector={selected ? "open" : undefined}>
        <section className="ops-surface" aria-label="Transport order register">
          {filtered.length ? (
            <OpsTableWrap>
              <table className="ops-table ops-register-table ops-stack-table rating-orders-table" aria-label="Transport orders">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Route</th>
                    <th>Customer</th>
                    {selected ? null : <th>Mode</th>}
                    <th>State</th>
                    {selected ? null : <th>Pickup</th>}
                    <th className="ops-cell-actions">Buy rate</th>
                    <th className="ops-cell-open"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>{filtered.map((order) => {
                  const chosen = selected?.id === order.id;
                  return <tr key={order.id} tabIndex={0} data-selected={chosen || undefined} aria-current={chosen || undefined} onClick={() => setSelectedOrderId(order.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedOrderId(order.id); } }} onDoubleClick={() => router.push(`/admin/rating/${encodeURIComponent(order.id)}`)} aria-label={`Select transport order ${order.id}`}>
                    <td data-cell="primary"><span className="ops-cell-primary ops-mono ops-cell-id">{order.id}</span></td>
                    <td data-cell="route"><span className="ops-cell-primary ops-cell-clamp">{order.origin} → {order.destination}</span></td>
                    <td data-cell="meta" data-label="Customer"><span className="ops-cell-muted ops-cell-clamp">{order.customer_name || "Not linked"}</span></td>
                    {selected ? null : <td data-cell="meta" data-label="Mode"><span className="ops-cell-muted">{modeLabel(order.mode)}</span></td>}
                    <td data-cell="status"><OpsBadge tone={statusTone(order.status)} dot>{statusLabels[order.status]}</OpsBadge></td>
                    {selected ? null : <td data-cell="meta" data-label="Pickup"><span className="ops-cell-muted">{shortDate(order.pickup_date)}</span></td>}
                    <td data-cell="amount" className="ops-cell-actions"><span className="ops-cell-primary tabular-nums">{money(order.selected_cost, order.selected_currency)}</span></td>
                    <td data-cell="open" className="ops-cell-open">
                      <Link href={`/admin/rating/${encodeURIComponent(order.id)}`} className="ops-row-open" onClick={(event) => event.stopPropagation()} aria-label={`Open order ${order.id}`} tabIndex={-1}>
                        <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true"/>
                      </Link>
                    </td>
                  </tr>;
                })}</tbody>
              </table>
            </OpsTableWrap>
          ) : (
            <OpsNoMatches noun="transport orders" onClear={() => { setQuery(""); setStatus("active"); setBranch("all"); setModeFilter("all"); }}/>
          )}
        </section>

        {selected ? <aside className="ops-inspector" aria-label={`Order ${selected.id}`}><OrderPeek order={selected} onClose={() => setSelectedOrderId("")}/></aside> : null}
      </div>
      </div>
  </OpsPage>;
}

function OrderPeek({ order, onClose }: { order: TmsOrder; onClose: () => void }) {
  const action = nextAction(order);
  return <>
    <OpsInspectorHeader
      kicker={<span className="ops-mono">{order.id}</span>}
      title={<span className="ops-route"><span>{order.origin}</span><ArrowRight size={13} className="ops-route-arrow" aria-hidden="true"/><span>{order.destination}</span></span>}
      subtitle={`${order.customer_name || "Customer not linked"} · ${order.branch} · ${modeLabel(order.mode)}`}
      actions={<>
        <OpsBadge tone={statusTone(order.status)} dot>{statusLabels[order.status]}</OpsBadge>
        <button type="button" className="ops-inspector-close" onClick={onClose} aria-label="Close order details"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>
      </>}
    />
    <div className="ops-inspector-scroll"><div className="ops-inspector-body">
      <OpsInspectorSection title="Next step" tinted>
        <p className="m-0 font-semibold text-[var(--admin-ink)]">{action.title}</p>
        <p className="m-0 mt-1 text-[length:var(--app-text-sm)] text-[var(--admin-muted)]">{action.detail}</p>
      </OpsInspectorSection>
      <OpsInspectorSection title="Load">
        <OpsFacts>
          <OpsFact label="Pickup">{shortDate(order.pickup_date)}</OpsFact>
          <OpsFact label="Weight">{`${order.weight_kg.toLocaleString()} kg`}</OpsFact>
          <OpsFact label="Volume">{`${order.volume_cbm.toLocaleString()} CBM`}</OpsFact>
          <OpsFact label="Pieces">{order.pieces.toLocaleString()}</OpsFact>
          <OpsFact label="Equipment" warning={!order.equipment}>{order.equipment || "Not set"}</OpsFact>
          <OpsFact label="Buy rate">{money(order.selected_cost, order.selected_currency)}</OpsFact>
        </OpsFacts>
      </OpsInspectorSection>
      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/rating/${encodeURIComponent(order.id)}`} className="ops-button" data-variant="primary" data-size="md">Open order</Link>
        {["draft", "rated"].includes(order.status) ? <Link href={`/admin/rating?view=rate-desk&order=${encodeURIComponent(order.id)}`} className="ops-button" data-variant="secondary" data-size="md">Rate order</Link> : null}
        {["selected", "tendering"].includes(order.status) ? <Link href="/admin/tenders" className="ops-button" data-variant="secondary" data-size="md">Carrier booking</Link> : null}
      </div>
    </div></div>
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <OpsField label={label}>{children}</OpsField>;
}
