"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import type { KcplBranch } from "../crm/crm-data";
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

function statusClasses(status: TmsOrderStatus) {
  if (status === "booked") return "bg-[#edf8f2] text-[#18794e]";
  if (status === "tendering" || status === "rated") return "bg-[#eef5ff] text-[#2563a6]";
  if (status === "selected") return "bg-[#fff7e6] text-[#945b00]";
  if (status === "cancelled") return "bg-[#f7f7f7] text-[#737373]";
  return "bg-[#f7f7f7] text-[#5b5b5b]";
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

  return <main className="min-h-[calc(100vh-54px)] bg-[#f6f6f3] px-4 pb-10 pt-6 text-[#141414] sm:px-6 lg:px-7">
    <div className="mx-auto w-full max-w-[1152px]">
      <header className="flex min-h-[60px] flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold leading-[30px]">Transport Orders</h1>
          <p className="mt-[3px] text-[13px] leading-[19px] text-[#5b5b5b]">{active} active · {ready} rate selected · {tendering} tendering · {booked} booked</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/rating?view=rate-desk" className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold text-[#141414] hover:bg-[#fbfbf9]">Rate Desk</Link>
          <button type="button" onClick={() => setShowCreate((value) => !value)} className="inline-flex h-8 items-center justify-center rounded-[6px] bg-[#dc143c] px-4 text-[12px] font-semibold text-white hover:bg-[#c81035]">Create Transport Order</button>
        </div>
      </header>

      <nav className="flex h-11 items-center gap-5 overflow-x-auto border-b border-[#e2e2e2]" aria-label="Operations workflow">
        {tabs.map((tab) => <Link key={tab.label} href={tab.href} className={`relative flex h-10 shrink-0 items-center justify-center px-2 text-[13px] font-medium leading-[19px] ${tab.active ? "text-[#141414]" : "text-[#5b5b5b] hover:text-[#141414]"}`}>{tab.label}{tab.active ? <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#dc143c]"/> : null}</Link>)}
      </nav>

      {notice ? <div className={`mt-4 flex min-h-10 items-center justify-between gap-3 border px-3 py-2 text-[12px] font-medium ${notice.tone === "success" ? "border-[#cfe8da] bg-[#f2faf6] text-[#18794e]" : "border-[#f0cccc] bg-[#fff6f6] text-[#a83232]"}`}><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} className="text-[11px] font-semibold">Dismiss</button></div> : null}

      {createdOrderId ? <section className="mt-4 border-y border-[#e2e2e2] bg-white px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#18794e]">Order Created</p><p className="mt-1 text-[14px] font-semibold">{createdOrderId}</p><p className="mt-1 text-[12px] text-[#5b5b5b]">The planning record is ready for rating and procurement.</p></div>
          <div className="flex flex-wrap gap-2"><Link href={`/admin/rating/${encodeURIComponent(createdOrderId)}`} className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Open order</Link><Link href={`/admin/rating?view=rate-desk&order=${encodeURIComponent(createdOrderId)}`} className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Continue to rating</Link><button type="button" onClick={() => setCreatedOrderId(null)} className="inline-flex h-8 items-center rounded-[6px] px-3 text-[12px] font-semibold text-[#5b5b5b]">Return to list</button></div>
        </div>
      </section> : null}

      {showCreate ? <section className="mt-4 border-y border-[#e2e2e2] bg-white px-4 py-5">
        <div className="mb-4"><p className="text-[14px] font-semibold">Create Transport Order</p><p className="mt-1 text-[12px] text-[#5b5b5b]">Create the planning record first. Rating, tender and booking authority remain separate downstream steps.</p></div>
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
          <div className="flex items-end justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setShowCreate(false)} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Cancel</button><button type="submit" disabled={busy} className="h-8 rounded-[6px] bg-[#dc143c] px-4 text-[12px] font-semibold text-white disabled:opacity-50">{busy ? "Creating…" : "Create order"}</button></div>
        </form>
      </section> : null}

      <div className="flex min-h-[58px] flex-wrap items-center gap-2 border-b border-[#e2e2e2] py-3">
        <label className="flex h-8 min-w-[260px] flex-1 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 md:max-w-[300px]"><span className="mr-2 text-[12px] text-[#737373]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, customer, route…" className="min-w-0 flex-1 bg-transparent text-[12px] font-medium outline-none placeholder:text-[#737373]"/></label>
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold outline-none"><option value="active">Active</option><option value="all">All states</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={branch} onChange={(event) => setBranch(event.target.value as "all" | KcplBranch)} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold outline-none"><option value="all">All branches</option>{branches.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value as "all" | TmsMode)} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold outline-none"><option value="all">All modes</option>{tmsModes.map((value) => <option key={value} value={value}>{modeLabel(value)}</option>)}</select>
        <button type="button" onClick={() => { setQuery(""); setStatus("active"); setBranch("all"); setModeFilter("all"); }} className="h-8 rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Reset</button>
        <span className="ml-auto text-[12px] font-medium text-[#5b5b5b]">{filtered.length} shown</span>
      </div>

      <section className="grid min-h-[620px] lg:grid-cols-[minmax(0,800px)_351px]">
        <div className="min-w-0 overflow-x-auto lg:border-r lg:border-[#e2e2e2]">
          <table className="w-full min-w-[800px] table-fixed border-collapse text-left">
            <thead><tr className="h-9 border-b border-[#e2e2e2] text-[11px] font-medium text-[#737373]"><th className="w-[150px] px-3 font-medium">ORDER</th><th className="w-[170px] px-3 font-medium">ROUTE</th><th className="w-[150px] px-3 font-medium">CUSTOMER</th><th className="w-[90px] px-3 font-medium">MODE</th><th className="w-[120px] px-3 font-medium">STATE</th><th className="w-[100px] px-3 font-medium">PICKUP</th><th className="w-[120px] px-3 text-right font-medium">PROCUREMENT</th></tr></thead>
            <tbody>{filtered.length ? filtered.map((order) => {
              const chosen = selected?.id === order.id;
              return <tr key={order.id} onClick={() => setSelectedOrderId(order.id)} onDoubleClick={() => window.location.assign(`/admin/rating/${encodeURIComponent(order.id)}`)} className={`relative h-12 cursor-pointer border-b border-[#e2e2e2] text-[12px] transition hover:bg-[#fbfbf9] ${chosen ? "bg-[#fbfbf9]" : ""}`}>
                <td className="relative px-3 text-[13px] font-semibold">{chosen ? <span className="absolute inset-y-0 left-0 w-0.5 bg-[#dc143c]"/> : null}<span className="block truncate">{order.id}</span></td>
                <td className="px-3 text-[13px] text-[#5b5b5b]"><span className="block truncate">{order.origin} → {order.destination}</span></td>
                <td className="px-3 text-[13px] text-[#5b5b5b]"><span className="block truncate">{order.customer_name || "Not linked"}</span></td>
                <td className="px-3 text-[12px] font-medium text-[#5b5b5b]">{modeLabel(order.mode)}</td>
                <td className="px-3"><span className={`inline-flex rounded-[5px] px-[7px] py-[3px] text-[11px] font-medium leading-[15px] ${statusClasses(order.status)}`}>{statusLabels[order.status]}</span></td>
                <td className="px-3 text-[12px] font-medium text-[#5b5b5b]">{shortDate(order.pickup_date)}</td>
                <td className="px-3 text-right text-[12px] font-semibold tabular-nums text-[#141414]">{money(order.selected_cost, order.selected_currency)}</td>
              </tr>;
            }) : <tr><td colSpan={7} className="h-48 px-6 text-center"><p className="text-[14px] font-semibold">No transport orders match this view</p><p className="mt-1 text-[12px] text-[#737373]">Change the filters or reset the workspace.</p></td></tr>}</tbody>
          </table>
        </div>
        <aside className="min-h-[620px] bg-white px-6 py-5">
          {selected ? <OrderPeek order={selected}/> : <div className="grid h-full place-items-center text-center"><div><p className="text-[14px] font-semibold">No order selected</p><p className="mt-1 text-[12px] text-[#737373]">Choose a row to inspect the planning record.</p></div></div>}
        </aside>
      </section>
    </div>
  </main>;
}

function OrderPeek({ order }: { order: TmsOrder }) {
  const action = nextAction(order);
  return <div className="flex h-full flex-col">
    <div className="min-h-[108px]"><p className="text-[11px] font-medium leading-[15px] text-[#737373]">{order.id}</p><h2 className="mt-1 text-[18px] font-semibold leading-[26px]">{order.origin} → {order.destination}</h2><p className="mt-1 text-[12px] font-medium leading-[17px] text-[#5b5b5b]">{order.customer_name || "Customer not linked"} · {order.branch} · {modeLabel(order.mode)}</p><span className={`mt-2 inline-flex rounded-[5px] px-[7px] py-[3px] text-[11px] font-medium leading-[15px] ${statusClasses(order.status)}`}>{statusLabels[order.status]}</span></div>
    <div className="border-t border-[#e2e2e2] py-4"><p className="text-[11px] font-medium text-[#737373]">NEXT ACTION</p><p className="mt-1 text-[13px] font-semibold">{action.title}</p><p className="mt-1 text-[12px] leading-[18px] text-[#5b5b5b]">{action.detail}</p></div>
    <dl className="border-t border-[#e2e2e2] py-4 text-[12px]">
      <Row label="Pickup" value={shortDate(order.pickup_date)}/><Row label="Weight" value={`${order.weight_kg.toLocaleString()} kg`}/><Row label="Volume" value={`${order.volume_cbm.toLocaleString()} CBM`}/><Row label="Pieces" value={order.pieces.toLocaleString()}/><Row label="Equipment" value={order.equipment || "Not set"}/><Row label="Procurement" value={money(order.selected_cost, order.selected_currency)}/>
    </dl>
    <div className="mt-auto border-t border-[#e2e2e2] pt-4"><div className="flex flex-wrap gap-2"><Link href={`/admin/rating/${encodeURIComponent(order.id)}`} className="inline-flex h-8 items-center rounded-[6px] bg-[#dc143c] px-3 text-[12px] font-semibold text-white">Open order</Link>{["draft", "rated"].includes(order.status) ? <Link href={`/admin/rating?view=rate-desk&order=${encodeURIComponent(order.id)}`} className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Rate order</Link> : null}{["selected", "tendering"].includes(order.status) ? <Link href="/admin/tenders" className="inline-flex h-8 items-center rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[12px] font-semibold">Tender workspace</Link> : null}</div></div>
  </div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[92px_1fr] gap-3 py-[5px]"><dt className="text-[#737373]">{label}</dt><dd className="min-w-0 break-words font-medium text-[#141414]">{value}</dd></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-[#5b5b5b]"><span className="mb-1.5 block">{label}</span><span className="block [&_input]:h-8 [&_input]:w-full [&_input]:rounded-[6px] [&_input]:border [&_input]:border-[#e2e2e2] [&_input]:bg-white [&_input]:px-3 [&_input]:text-[12px] [&_input]:font-medium [&_input]:outline-none [&_select]:h-8 [&_select]:w-full [&_select]:rounded-[6px] [&_select]:border [&_select]:border-[#e2e2e2] [&_select]:bg-white [&_select]:px-3 [&_select]:text-[12px] [&_select]:font-medium [&_select]:outline-none">{children}</span></label>;
}
