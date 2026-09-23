"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
import type { KcplBranch } from "../crm/crm-data";
import { OpsBadge, OpsEmptyState, OpsFilterSelect, OpsKpiRail, OpsNotice, OpsPage, OpsPageHeader, OpsRailMetric, OpsRegisterToolbar, OpsScopeTabs, OpsSearch, OpsTableWrap } from "../operations-ui";
import { tmsModes, type TmsMode, type TmsOrder, type TmsOrderStatus } from "./tms-rating";

type ApiResponse = { ok: boolean; error?: string; order?: TmsOrder };

type StatusFilter = "active" | "all" | TmsOrderStatus;

const tabs = [
  { label: "Orders", href: "/admin/rating", active: true },
  { label: "Tenders", href: "/admin/tenders" },
  { label: "Bookings", href: "/admin/tenders" },
  { label: "Pickups", href: "/admin/pickups" },
  { label: "Shipments", href: "/admin/shipments" },
  { label: "Consolidations", href: "/admin/consolidation" },
];

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

function modeLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

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
  if (order.status === "selected") return { title: "Open Tender Workspace", detail: "The procurement rate is selected. Tendering remains server-authoritative." };
  if (order.status === "tendering") return { title: "Review carrier response", detail: "Tender activity is in progress. Booking requires an accepted or valid counter-offer." };
  if (order.status === "booked") return { title: "Review booking handoff", detail: "The accepted commercial outcome has already moved into execution." };
  return { title: "Review record", detail: "This transport order is not currently progressing through procurement." };
}

export function V4TransportOrdersWorkspace({ initialOrders, branches }: { initialOrders: TmsOrder[]; branches: KcplBranch[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrders[0]?.id ?? "");
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

  const selected = orders.find((order) => order.id === selectedOrderId) ?? filtered[0] ?? null;
  const active = orders.filter((order) => !["booked", "cancelled"].includes(order.status)).length;
  const tendering = orders.filter((order) => order.status === "tendering").length;
  const ready = orders.filter((order) => order.status === "selected").length;
  const booked = orders.filter((order) => order.status === "booked").length;
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
      title="Transport Orders"
      description={`${active} active · ${ready} rate selected · ${tendering} tendering · ${booked} booked`}
      actions={(
        <>
          <Link href="/admin/rating?view=rate-desk" className="ops-button" data-variant="secondary" data-size="md">Rate Desk</Link>
          <button type="button" onClick={() => setShowCreate((value) => !value)} className="ops-button" data-variant="primary" data-size="md">Create Transport Order</button>
        </>
      )}
    />

    <div className="px-4 pt-3 md:px-6">
      <OpsKpiRail label="Transport orders summary">
        <OpsRailMetric label="Active" value={active} active={status === "active"} onClick={() => setStatus("active")}/>
        <OpsRailMetric label="Rate selected" value={ready} tone="warning" active={status === "selected"} onClick={() => setStatus(status === "selected" ? "active" : "selected")} title="Ready to tender"/>
        <OpsRailMetric label="Tendering" value={tendering} tone="info" active={status === "tendering"} onClick={() => setStatus(status === "tendering" ? "active" : "tendering")}/>
        <OpsRailMetric label="Booked" value={booked} tone="success" active={status === "booked"} onClick={() => setStatus(status === "booked" ? "active" : "booked")}/>
        <OpsRailMetric label="All orders" value={orders.length} active={status === "all"} onClick={() => setStatus("all")}/>
      </OpsKpiRail>
    </div>

      <nav className="ops-scroll-x flex h-11 items-center gap-5 overflow-x-auto border-b border-[var(--admin-line)]" aria-label="Operations workflow">
        {tabs.map((tab) => <Link key={tab.label} href={tab.href} className={`relative flex h-10 shrink-0 items-center justify-center px-2 text-[13px] font-medium leading-[19px] ${tab.active ? "text-[var(--admin-ink)]" : "text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"}`}>{tab.label}{tab.active ? <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--admin-crimson)]"/> : null}</Link>)}
      </nav>

      {notice ? <div className="mt-4"><OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice></div> : null}

      {createdOrderId ? <section className="mt-4 border-y border-[var(--admin-line)] bg-[var(--admin-surface)] px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[var(--admin-success)]">Order Created</p><p className="mt-1 text-[14px] font-semibold">{createdOrderId}</p><p className="mt-1 text-[12px] text-[var(--admin-muted)]">The planning record is ready for rating and procurement.</p></div>
          <div className="flex flex-wrap gap-2"><Link href={`/admin/rating/${encodeURIComponent(createdOrderId)}`} className="inline-flex h-8 items-center rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 text-[12px] font-semibold">Open order</Link><Link href={`/admin/rating?view=rate-desk&order=${encodeURIComponent(createdOrderId)}`} className="inline-flex h-8 items-center rounded-[var(--app-radius)] bg-[var(--admin-crimson)] px-3 text-[12px] font-semibold text-[var(--admin-on-crimson)]">Continue to rating</Link><button type="button" onClick={() => setCreatedOrderId(null)} className="inline-flex h-8 items-center rounded-[var(--app-radius)] px-3 text-[12px] font-semibold text-[var(--admin-muted)]">Return to list</button></div>
        </div>
      </section> : null}

      {showCreate ? <section className="mt-4 border-y border-[var(--admin-line)] bg-[var(--admin-surface)] px-4 py-5">
        <div className="mb-4"><p className="text-[14px] font-semibold">Create Transport Order</p><p className="mt-1 text-[12px] text-[var(--admin-muted)]">Create the planning record first. Rating, tender and booking authority remain separate downstream steps.</p></div>
        <form onSubmit={createOrder} className="grid gap-x-4 gap-y-3 md:grid-cols-4">
          <Field label="Branch"><select value={orderBranch} onChange={(event) => setOrderBranch(event.target.value as KcplBranch)}>{branches.map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Mode"><select value={mode} onChange={(event) => setMode(event.target.value as TmsMode)}>{tmsModes.map((value) => <option key={value} value={value}>{modeLabel(value)}</option>)}</select></Field>
          <Field label="Origin"><input required value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Kathmandu / KTM / Nepal"/></Field>
          <Field label="Destination"><input required value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Melbourne / MEL / Australia"/></Field>
          <Field label="Pickup date"><input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)}/></Field>
          <Field label="Weight (kg)"><input type="number" min="0" step="0.01" value={weightKg} onChange={(event) => setWeightKg(event.target.value)}/></Field>
          <Field label="Volume (CBM)"><input type="number" min="0" step="0.001" value={volumeCbm} onChange={(event) => setVolumeCbm(event.target.value)}/></Field>
          <Field label="Pieces"><input type="number" min="0" step="1" value={pieces} onChange={(event) => setPieces(event.target.value)}/></Field>
          <Field label="Containers"><input type="number" min="0" step="1" value={containers} onChange={(event) => setContainers(event.target.value)}/></Field>
          <Field label="Equipment"><input value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="20GP, 40HC, reefer, truck…"/></Field>
          <div className="flex items-end justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setShowCreate(false)} className="h-8 rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 text-[12px] font-semibold">Cancel</button><button type="submit" disabled={busy} className="h-8 rounded-[var(--app-radius)] bg-[var(--admin-crimson)] px-4 text-[12px] font-semibold text-[var(--admin-on-crimson)] disabled:opacity-50">{busy ? "Creating…" : "Create order"}</button></div>
        </form>
      </section> : null}

      <div className="px-4 pb-8 pt-4 md:px-6">
      <OpsRegisterToolbar
        search={<OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, customer, route…" aria-label="Search transport orders"/>}
        actions={(
          <>
            <OpsFilterSelect label="Branch" value={branch} allLabel="All branches" options={branches.map((value) => ({ value, label: value }))} onChange={(value) => setBranch(value === "all" ? "all" : value as KcplBranch)}/>
            <OpsFilterSelect label="Mode" value={modeFilter} allLabel="All modes" options={tmsModes.map((value) => ({ value, label: modeLabel(value) }))} onChange={(value) => setModeFilter(value === "all" ? "all" : value as TmsMode)}/>
            {query.trim() || status !== "active" || branch !== "all" || modeFilter !== "all" ? <button type="button" className="ops-inline-alert-action" onClick={() => { setQuery(""); setStatus("active"); setBranch("all"); setModeFilter("all"); }}>Reset</button> : null}
            <span className="ops-toolbar-divider" aria-hidden="true"/>
            <span className="ops-result-count" aria-live="polite">{filtered.length === orders.length ? `${orders.length} orders` : `${filtered.length} of ${orders.length}`}</span>
          </>
        )}
        tabs={<OpsScopeTabs label="Order status views" items={STATUS_TABS.map((tab) => ({ ...tab, count: statusCounts[tab.value] }))} value={status} onChange={(value) => setStatus(value)}/>}
      />

      <div className="ops-register-layout">
        <section className="ops-surface" aria-label="Transport order register">
          {filtered.length ? (
            <OpsTableWrap>
              <table className="ops-table ops-register-table rating-orders-table" aria-label="Transport orders">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Route</th>
                    <th>Customer</th>
                    <th>Mode</th>
                    <th>State</th>
                    <th>Pickup</th>
                    <th className="ops-cell-actions">Procurement</th>
                    <th className="ops-cell-open"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>{filtered.map((order) => {
                  const chosen = selected?.id === order.id;
                  return <tr key={order.id} tabIndex={0} data-selected={chosen || undefined} aria-current={chosen || undefined} onClick={() => setSelectedOrderId(order.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedOrderId(order.id); } }} onDoubleClick={() => router.push(`/admin/rating/${encodeURIComponent(order.id)}`)} aria-label={`Select transport order ${order.id}`}>
                    <td><span className="ops-cell-primary ops-mono ops-cell-id">{order.id}</span></td>
                    <td><span className="ops-cell-primary ops-cell-clamp">{order.origin} → {order.destination}</span></td>
                    <td><span className="ops-cell-muted ops-cell-clamp">{order.customer_name || "Not linked"}</span></td>
                    <td><span className="ops-cell-muted">{modeLabel(order.mode)}</span></td>
                    <td><OpsBadge tone={statusTone(order.status)} dot>{statusLabels[order.status]}</OpsBadge></td>
                    <td><span className="ops-cell-muted">{shortDate(order.pickup_date)}</span></td>
                    <td className="ops-cell-actions"><span className="ops-cell-primary tabular-nums">{money(order.selected_cost, order.selected_currency)}</span></td>
                    <td className="ops-cell-open">
                      <Link href={`/admin/rating/${encodeURIComponent(order.id)}`} className="ops-row-open" onClick={(event) => event.stopPropagation()} aria-label={`Open order ${order.id}`} tabIndex={-1}>
                        <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true"/>
                      </Link>
                    </td>
                  </tr>;
                })}</tbody>
              </table>
            </OpsTableWrap>
          ) : (
            <OpsEmptyState compact kind="search" title="No transport orders match this view" description="Change the filters or reset the workspace." action={<button type="button" className="ops-button" data-variant="secondary" data-size="sm" onClick={() => { setQuery(""); setStatus("active"); setBranch("all"); setModeFilter("all"); }}>Reset</button>}/>
          )}
        </section>

        <aside className="ops-surface ops-order-peek" aria-label="Selected order">
          {selected ? <OrderPeek order={selected}/> : <OpsEmptyState compact title="No order selected" description="Choose a row to inspect the planning record."/>}
        </aside>
      </div>
      </div>
  </OpsPage>;
}

function OrderPeek({ order }: { order: TmsOrder }) {
  const action = nextAction(order);
  return <div className="flex h-full flex-col">
    <div className="min-h-[108px]"><p className="text-[11px] font-medium leading-[15px] text-[var(--admin-muted)]"><span className="ops-mono">{order.id}</span></p><h2 className="mt-1 text-[18px] font-semibold leading-[26px]">{order.origin} → {order.destination}</h2><p className="mt-1 text-[12px] font-medium leading-[17px] text-[var(--admin-muted)]">{order.customer_name || "Customer not linked"} · {order.branch} · {modeLabel(order.mode)}</p><span className="mt-2 inline-flex"><OpsBadge tone={statusTone(order.status)} dot>{statusLabels[order.status]}</OpsBadge></span></div>
    <div className="border-t border-[var(--admin-line)] py-4"><p className="text-[11px] font-medium text-[var(--admin-muted)]">NEXT ACTION</p><p className="mt-1 text-[13px] font-semibold">{action.title}</p><p className="mt-1 text-[12px] leading-[18px] text-[var(--admin-muted)]">{action.detail}</p></div>
    <dl className="border-t border-[var(--admin-line)] py-4 text-[12px]">
      <Row label="Pickup" value={shortDate(order.pickup_date)}/><Row label="Weight" value={`${order.weight_kg.toLocaleString()} kg`}/><Row label="Volume" value={`${order.volume_cbm.toLocaleString()} CBM`}/><Row label="Pieces" value={order.pieces.toLocaleString()}/><Row label="Equipment" value={order.equipment || "Not set"}/><Row label="Procurement" value={money(order.selected_cost, order.selected_currency)}/>
    </dl>
    <div className="mt-auto border-t border-[var(--admin-line)] pt-4"><div className="flex flex-wrap gap-2"><Link href={`/admin/rating/${encodeURIComponent(order.id)}`} className="inline-flex h-8 items-center rounded-[var(--app-radius)] bg-[var(--admin-crimson)] px-3 text-[12px] font-semibold text-[var(--admin-on-crimson)]">Open order</Link>{["draft", "rated"].includes(order.status) ? <Link href={`/admin/rating?view=rate-desk&order=${encodeURIComponent(order.id)}`} className="inline-flex h-8 items-center rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 text-[12px] font-semibold">Rate order</Link> : null}{["selected", "tendering"].includes(order.status) ? <Link href="/admin/tenders" className="inline-flex h-8 items-center rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 text-[12px] font-semibold">Tender workspace</Link> : null}</div></div>
  </div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[92px_1fr] gap-3 py-[5px]"><dt className="text-[var(--admin-muted)]">{label}</dt><dd className="min-w-0 break-words font-medium text-[var(--admin-ink)]">{value}</dd></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-[var(--admin-muted)]"><span className="mb-1.5 block">{label}</span><span className="block [&_input]:h-8 [&_input]:w-full [&_input]:rounded-[var(--app-radius)] [&_input]:border [&_input]:border-[var(--admin-line)] [&_input]:bg-[var(--admin-surface)] [&_input]:px-3 [&_input]:text-[12px] [&_input]:font-medium [&_input]:outline-none [&_select]:h-8 [&_select]:w-full [&_select]:rounded-[var(--app-radius)] [&_select]:border [&_select]:border-[var(--admin-line)] [&_select]:bg-[var(--admin-surface)] [&_select]:px-3 [&_select]:text-[12px] [&_select]:font-medium [&_select]:outline-none">{children}</span></label>;
}
