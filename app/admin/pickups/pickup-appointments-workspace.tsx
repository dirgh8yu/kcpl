"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, MapPin, Package, RefreshCw, Truck, User, X } from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMono, OpsNotice, OpsPage, OpsSearch } from "../operations-ui";
import { pickupAppointmentStatusLabels, pickupChannels, pickupNeedsAttention, type PickupChannel, type PickupQueueRow, type PickupSummary } from "./pickup-appointments";

type ApiResponse = { ok?: boolean; error?: string; rows?: PickupQueueRow[]; summary?: PickupSummary };
type Focus = "all" | "pending" | "confirmed" | "in_progress" | "completed" | "failed";

const STATUS_FILTERS: Array<{ label: string; value: Focus }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

function dateTime(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function shortDateTime(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kathmandu" }).format(date);
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function statusTone(row: PickupQueueRow): "neutral" | "info" | "warning" | "success" | "danger" {
  if (row.status === "picked_up") return "success";
  if (row.status === "missed" || pickupNeedsAttention(row, new Date().toISOString())) return "danger";
  if (row.status === "confirmed") return "info";
  if (row.status === "driver_assigned") return "success";
  if (row.status === "requested") return "warning";
  return "neutral";
}

function matchesFocus(row: PickupQueueRow, focus: Focus) {
  if (focus === "all") return true;
  if (focus === "pending") return row.status === "unscheduled" || row.status === "requested";
  if (focus === "confirmed") return row.status === "confirmed";
  if (focus === "in_progress") return row.status === "driver_assigned";
  if (focus === "completed") return row.status === "picked_up";
  return row.status === "missed" || row.status === "cancelled";
}

function primaryActionLabel(row: PickupQueueRow) {
  if (row.status === "unscheduled" || row.status === "requested") return "Confirm pickup";
  if (row.status === "confirmed") return "Assign driver";
  if (row.status === "driver_assigned") return "Open pickup";
  if (row.status === "missed") return "Resolve pickup";
  return "View pickup";
}

export function PickupAppointmentsWorkspace({ initialRows, initialSummary, initialReference = "" }: { initialRows: PickupQueueRow[]; initialSummary: PickupSummary; initialReference?: string }) {
  const initialSelected = initialReference ? initialRows.find((row) => row.shipment_reference === initialReference) ?? null : null;
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedReference, setSelectedReference] = useState(initialSelected?.shipment_reference ?? "");
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<Focus>("all");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const [windowStart, setWindowStart] = useState(toLocalInput(initialSelected?.confirmed_window_start ?? initialSelected?.requested_window_start ?? null));
  const [windowEnd, setWindowEnd] = useState(toLocalInput(initialSelected?.confirmed_window_end ?? initialSelected?.requested_window_end ?? null));
  const [pickupLocation, setPickupLocation] = useState(initialSelected?.pickup_location ?? "");
  const [contactName, setContactName] = useState(initialSelected?.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(initialSelected?.contact_phone ?? "");
  const [channel, setChannel] = useState<PickupChannel>(initialSelected?.channel ?? "manual");
  const [providerReference, setProviderReference] = useState(initialSelected?.provider_reference ?? "");
  const [driverName, setDriverName] = useState(initialSelected?.driver_name ?? "");
  const [driverPhone, setDriverPhone] = useState(initialSelected?.driver_phone ?? "");
  const [vehicleReference, setVehicleReference] = useState(initialSelected?.vehicle_reference ?? "");
  const [notes, setNotes] = useState(initialSelected?.notes ?? "");
  const [missedReason, setMissedReason] = useState("");

  const selected = rows.find((row) => row.shipment_reference === selectedReference) ?? null;
  const pendingCount = summary.unscheduled + summary.requested;
  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (!matchesFocus(row, focus)) return false;
      if (!terms.length) return true;
      const haystack = [row.shipment_reference, row.booking_reference ?? "", row.customer_name, row.partner_name ?? "", row.origin, row.destination, row.branch, row.pickup_location ?? "", row.driver_name ?? "", row.vehicle_reference ?? "", row.contact_name ?? "", row.contact_phone ?? "", row.status].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [focus, query, rows]);

  useEffect(() => {
    if (!selectedReference) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedReference("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedReference]);

  function choose(row: PickupQueueRow) {
    setSelectedReference(row.shipment_reference);
    setWindowStart(toLocalInput(row.confirmed_window_start ?? row.requested_window_start));
    setWindowEnd(toLocalInput(row.confirmed_window_end ?? row.requested_window_end));
    setPickupLocation(row.pickup_location ?? row.origin);
    setContactName(row.contact_name ?? "");
    setContactPhone(row.contact_phone ?? "");
    setChannel(row.channel);
    setProviderReference(row.provider_reference ?? "");
    setDriverName(row.driver_name ?? "");
    setDriverPhone(row.driver_phone ?? "");
    setVehicleReference(row.vehicle_reference ?? "");
    setNotes(row.notes ?? "");
    setMissedReason("");
    setNotice(null);
  }

  async function refresh(keepNotice = false) {
    const response = await fetch("/api/admin/pickups", { cache: "no-store" });
    const data = await response.json() as ApiResponse;
    if (!response.ok || !data.ok || !data.rows || !data.summary) throw new Error(data.error || "Pickup Scheduling could not be refreshed.");
    setRows(data.rows);
    setSummary(data.summary);
    if (selectedReference && !data.rows.some((row) => row.shipment_reference === selectedReference)) setSelectedReference("");
    if (!keepNotice) setNotice({ tone: "success", text: "Pickup Scheduling refreshed." });
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    try {
      const body: Record<string, unknown> = { action, reference: selected.shipment_reference, ...extra };
      const response = await fetch("/api/admin/pickups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Pickup action failed.");
      await refresh(true);
      const label = action === "schedule" ? "Pickup request saved." : action === "confirm" ? "Pickup appointment confirmed." : action === "assign_driver" ? "Driver assignment saved." : action === "picked_up" ? "Pickup completed and Live Visibility updated." : action === "missed" ? "Missed pickup recorded and an operational exception was raised." : "Pickup appointment cancelled.";
      setNotice({ tone: action === "missed" ? "warning" : "success", text: label });
      if (action === "missed") setMissedReason("");
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Pickup action failed." });
    } finally {
      setBusy(false);
    }
  }

  function handleRefresh() {
    setBusy(true);
    refresh().catch((error) => setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Refresh failed." })).finally(() => setBusy(false));
  }

  return (
    <OpsPage className="pickup-reference-layout">
      <div className="px-4 py-5 md:px-6 md:py-6">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="m-0">Pickups</h1>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Scheduled collection queue · {rows.length} pickup{rows.length === 1 ? "" : "s"} · {pendingCount} awaiting confirmation</p>
          </div>
          <div className="flex items-center gap-2">
            <OpsButton type="button" size="sm" variant="ghost" disabled={busy} onClick={handleRefresh}><RefreshCw size={14} strokeWidth={1.75} aria-hidden="true"/>Refresh</OpsButton>
            <Link href="/admin/visibility" className="ops-button" data-variant="secondary" data-size="sm">Live Visibility</Link>
          </div>
        </header>

        {notice && !selected ? <div className="mb-4"><OpsNotice tone={notice.tone}>{notice.text}</OpsNotice></div> : null}

        <div className="mb-4 flex flex-wrap items-center gap-2 border-y border-[var(--admin-line)] py-3">
          <div className="min-w-60 flex-1 basis-72 max-w-sm">
            <OpsSearch value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment, customer, route…" aria-label="Search pickups"/>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Pickup status filters">
            {STATUS_FILTERS.map((item) => {
              const active = focus === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFocus(item.value)}
                  aria-pressed={active}
                  className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors ${active ? "border-[var(--admin-crimson)] bg-[var(--admin-crimson)] text-white" : "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-muted)] hover:border-[var(--admin-line-strong)] hover:text-[var(--admin-ink)]"}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <span className="ml-auto whitespace-nowrap text-xs text-[var(--admin-muted)]">{filtered.length} pickup{filtered.length === 1 ? "" : "s"}</span>
        </div>

        <section className="space-y-3" aria-label="Pickup queue">
          {filtered.length ? filtered.map((row) => {
            const attention = pickupNeedsAttention(row, new Date().toISOString()) && row.status !== "picked_up" && row.status !== "cancelled";
            const windowStartValue = row.confirmed_window_start ?? row.requested_window_start;
            const windowEndValue = row.confirmed_window_end ?? row.requested_window_end;
            return (
              <article key={row.shipment_reference} className="ops-surface overflow-hidden">
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <OpsMono>{row.shipment_reference}</OpsMono>
                        {row.booking_reference ? <span className="text-xs text-[var(--admin-muted)]">Booking {row.booking_reference}</span> : null}
                        <OpsBadge tone={statusTone(row)}>{pickupAppointmentStatusLabels[row.status]}</OpsBadge>
                        {attention ? <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--admin-danger)]"><AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true"/>Needs attention</span> : null}
                      </div>

                      <h2 className="text-sm font-semibold text-[var(--admin-ink)]">{row.customer_name}</h2>
                      <div className="mt-1 flex items-start gap-1.5 text-sm text-[var(--admin-muted)]">
                        <MapPin size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true"/>
                        <span>{row.pickup_location || row.origin} · {row.origin} → {row.destination}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--admin-muted)]">
                        <span className="inline-flex items-center gap-1.5"><Clock size={13} strokeWidth={1.75} aria-hidden="true"/>{windowStartValue ? `${shortDateTime(windowStartValue)}${windowEndValue ? ` – ${shortDateTime(windowEndValue)}` : ""}` : "Pickup window not set"}</span>
                        <span className="inline-flex items-center gap-1.5"><Package size={13} strokeWidth={1.75} aria-hidden="true"/>{row.partner_name || row.channel.replaceAll("_", " ")}</span>
                        <span className="inline-flex items-center gap-1.5"><User size={13} strokeWidth={1.75} aria-hidden="true"/>{row.driver_name || "Driver not assigned"}{row.vehicle_reference ? ` · ${row.vehicle_reference}` : ""}</span>
                        {row.contact_name || row.contact_phone ? <span>{[row.contact_name, row.contact_phone].filter(Boolean).join(" · ")}</span> : null}
                      </div>
                    </div>

                    <OpsButton type="button" size="sm" variant={row.status === "unscheduled" || row.status === "requested" ? "primary" : "secondary"} onClick={() => choose(row)}>{primaryActionLabel(row)}</OpsButton>
                  </div>
                </div>
              </article>
            );
          }) : (
            <div className="ops-surface">
              <OpsEmptyState compact kind="search" title="No pickups" description={query || focus !== "all" ? "No pickups match the current search or status filter." : "Booked shipments will appear here automatically when pickup control becomes available."} action={query || focus !== "all" ? <OpsButton type="button" variant="secondary" onClick={() => { setQuery(""); setFocus("all"); }}>Clear filters</OpsButton> : undefined}/>
            </div>
          )}
        </section>
      </div>

      {selected ? (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default bg-black/20" onClick={() => setSelectedReference("")} aria-label="Close pickup panel"/>
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden border-l border-[var(--admin-line)] bg-[var(--admin-surface)] shadow-xl md:w-1/2 lg:max-w-xl" aria-label={`Pickup ${selected.shipment_reference}`}>
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
              <div className="min-w-0">
                <p className="ops-mono m-0 text-xs text-[var(--admin-muted)]">{selected.shipment_reference}{selected.booking_reference ? ` · ${selected.booking_reference}` : ""}</p>
                <h2 className="mt-1 text-base font-semibold leading-6">{selected.customer_name}</h2>
                <p className="mt-0.5 text-sm text-[var(--admin-muted)]">{selected.origin} → {selected.destination} · {selected.branch}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <OpsBadge tone={statusTone(selected)}>{pickupAppointmentStatusLabels[selected.status]}</OpsBadge>
                <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-[var(--admin-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-ink)]" onClick={() => setSelectedReference("")} aria-label="Close pickup panel"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {notice ? <div className="px-5 pt-4"><OpsNotice tone={notice.tone}>{notice.text}</OpsNotice></div> : null}

              {pickupNeedsAttention(selected, new Date().toISOString()) && selected.status !== "picked_up" && selected.status !== "cancelled" ? (
                <section className="border-b border-[var(--admin-line)] px-5 py-4">
                  <div className="flex items-start gap-2 rounded-md border border-[var(--admin-line)] bg-[var(--admin-danger-bg)] px-3 py-2.5 text-[var(--admin-danger)]">
                    <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true"/>
                    <div><strong className="block text-sm">Attention required</strong><span className="mt-0.5 block text-xs">{selected.status === "missed" ? selected.missed_reason || "This pickup was recorded as missed." : "The collection window is missing or overdue."}</span></div>
                  </div>
                </section>
              ) : null}

              <section className="border-b border-[var(--admin-line)] px-5 py-5">
                <h3 className="text-sm font-semibold">Pickup details</h3>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <Detail label="Pickup location">{selected.pickup_location || selected.origin}</Detail>
                  <Detail label="Channel">{selected.channel.replaceAll("_", " ")}</Detail>
                  <Detail label="Window start">{shortDateTime(selected.confirmed_window_start ?? selected.requested_window_start)}</Detail>
                  <Detail label="Window end">{shortDateTime(selected.confirmed_window_end ?? selected.requested_window_end)}</Detail>
                  <Detail label="Driver">{selected.driver_name || "Not assigned"}</Detail>
                  <Detail label="Vehicle">{selected.vehicle_reference || "Not assigned"}</Detail>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/admin/jobs/${encodeURIComponent(selected.shipment_reference)}`} className="ops-button" data-variant="secondary" data-size="sm">Open Job File</Link>
                  <Link href="/admin/visibility" className="ops-button" data-variant="ghost" data-size="sm">Live Visibility</Link>
                </div>
              </section>

              {selected.status !== "picked_up" && selected.status !== "cancelled" ? (
                <>
                  <section className="border-b border-[var(--admin-line)] px-5 py-5">
                    <StepNumber number="01" title="Appointment" detail="Request or confirm the collection window."/>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <OpsField label="Pickup window start"><input type="datetime-local" value={windowStart} onChange={(event) => setWindowStart(event.target.value)}/></OpsField>
                      <OpsField label="Pickup window end"><input type="datetime-local" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)}/></OpsField>
                      <OpsField label="Pickup location"><input value={pickupLocation} onChange={(event) => setPickupLocation(event.target.value)} placeholder="Warehouse, factory, terminal…"/></OpsField>
                      <OpsField label="Request channel"><select value={channel} onChange={(event) => setChannel(event.target.value as PickupChannel)}>{pickupChannels.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></OpsField>
                      <OpsField label="Contact name"><input value={contactName} onChange={(event) => setContactName(event.target.value)}/></OpsField>
                      <OpsField label="Contact phone"><input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)}/></OpsField>
                      <OpsField label="Carrier/vendor reference"><input value={providerReference} onChange={(event) => setProviderReference(event.target.value)} placeholder="Appointment / pickup reference"/></OpsField>
                      <OpsField label="Operational note"><input value={notes} onChange={(event) => setNotes(event.target.value)}/></OpsField>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <OpsButton variant="secondary" disabled={busy || !windowStart || !windowEnd} onClick={() => act("schedule", { windowStart, windowEnd, pickupLocation, contactName, contactPhone, channel, providerReference, notes, confirmed: false })}><CalendarClock size={13} strokeWidth={1.75} aria-hidden="true"/>Request pickup</OpsButton>
                      <OpsButton variant="primary" disabled={busy || !windowStart || !windowEnd} onClick={() => act(selected.status === "unscheduled" || selected.status === "missed" ? "schedule" : "confirm", selected.status === "unscheduled" || selected.status === "missed" ? { windowStart, windowEnd, pickupLocation, contactName, contactPhone, channel, providerReference, notes, confirmed: true } : { windowStart, windowEnd, providerReference, notes })}><CheckCircle2 size={13} strokeWidth={1.75} aria-hidden="true"/>Confirm appointment</OpsButton>
                    </div>
                  </section>

                  <section className="border-b border-[var(--admin-line)] px-5 py-5">
                    <StepNumber number="02" title="Vehicle & driver" detail="Assign the collection resource once the appointment is ready."/>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <OpsField label="Driver name"><input value={driverName} onChange={(event) => setDriverName(event.target.value)}/></OpsField>
                      <OpsField label="Driver phone"><input value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)}/></OpsField>
                      <OpsField label="Vehicle reference"><input value={vehicleReference} onChange={(event) => setVehicleReference(event.target.value)} placeholder="Truck / plate / vehicle"/></OpsField>
                    </div>
                    <div className="mt-4"><OpsButton variant="secondary" disabled={busy || driverName.trim().length < 2 || selected.status === "unscheduled"} onClick={() => act("assign_driver", { driverName, driverPhone, vehicleReference, notes })}><Truck size={13} strokeWidth={1.75} aria-hidden="true"/>Assign driver</OpsButton></div>
                  </section>

                  <section className="px-5 py-5">
                    <StepNumber number="03" title="Pickup outcome" detail="Complete the collection or record the operational exception."/>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <OpsButton variant="primary" disabled={busy || selected.status === "unscheduled"} onClick={() => act("picked_up", { eventTime: new Date().toISOString(), location: pickupLocation })}><CheckCircle2 size={13} strokeWidth={1.75} aria-hidden="true"/>Cargo picked up</OpsButton>
                      <OpsButton variant="danger" disabled={busy || selected.status === "unscheduled" || missedReason.trim().length < 6} onClick={() => act("missed", { reason: missedReason })}><AlertTriangle size={13} strokeWidth={1.75} aria-hidden="true"/>Mark missed</OpsButton>
                      <OpsButton variant="ghost" disabled={busy || selected.status === "unscheduled"} onClick={() => act("cancel", { note: notes })}>Cancel pickup</OpsButton>
                    </div>
                    <div className="mt-4"><OpsField label="Missed-pickup reason"><textarea className="ops-textarea min-h-20" value={missedReason} onChange={(event) => setMissedReason(event.target.value)} placeholder="Carrier no-show, cargo not ready, warehouse closed, documents incomplete…"/></OpsField></div>
                  </section>
                </>
              ) : (
                <div className="px-5 py-5"><OpsNotice tone={selected.status === "picked_up" ? "success" : "warning"}>{selected.status === "picked_up" ? `Pickup completed ${dateTime(selected.picked_up_at)}. Live Visibility now owns the movement timeline.` : "This pickup appointment is cancelled."}</OpsNotice></div>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </OpsPage>
  );
}

function StepNumber({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3"><span className="pt-0.5 text-xs font-medium text-[var(--admin-crimson)]">{number}</span><div><h3 className="text-sm font-medium">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--admin-muted)]">{detail}</p></div></div>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><span className="block text-xs uppercase tracking-wide text-[var(--admin-faint)]">{label}</span><div className="mt-1 text-sm text-[var(--admin-ink)]">{children}</div></div>;
}
