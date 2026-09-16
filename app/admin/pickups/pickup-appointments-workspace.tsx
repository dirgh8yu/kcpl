"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsKpiCard, OpsKpiStrip, OpsNotice, OpsPage, OpsPageHeader, OpsSearch } from "../operations-ui";
import { useWorkspaceQuery } from "../use-workspace-query";
import {
  pickupAppointmentStatuses,
  pickupChannels,
  pickupNeedsAttention,
  type PickupAppointmentStatus,
  type PickupChannel,
  type PickupQueueRow,
  type PickupSummary,
} from "./pickup-appointments";

type ApiResponse = { ok?: boolean; error?: string; rows?: PickupQueueRow[]; summary?: PickupSummary };
type Focus = "all" | "pending" | "scheduled" | "assigned" | "completed" | "attention" | "cancelled";
type DateFilter = "all" | "today" | "upcoming" | "overdue" | "unscheduled";
type DriverFilter = "all" | "assigned" | "unassigned";
type SortDirection = "asc" | "desc";
type EditorPanel = "details" | "appointment" | "driver" | "outcome";

const STATUS_TABS: Array<{ label: string; value: Focus }> = [
  { label: "All", value: "all" },
  { label: "To schedule", value: "pending" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Driver assigned", value: "assigned" },
  { label: "Picked up", value: "completed" },
  { label: "Needs attention", value: "attention" },
  { label: "Cancelled", value: "cancelled" },
];

const filterControlClass = "min-h-10 rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-ink)] outline-none transition-colors hover:border-[var(--admin-line-strong)] focus:border-[var(--app-focus)]";
const iconButtonClass = "inline-grid min-h-10 min-w-10 place-items-center rounded-md border border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-muted)] transition-colors hover:border-[var(--admin-line-strong)] hover:text-[var(--admin-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-focus)] disabled:cursor-not-allowed disabled:opacity-50";

function dateTime(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kathmandu" }).format(date)} NPT`;
}

function dateLabel(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kathmandu" }).format(date);
}

function timeLabel(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kathmandu" }).format(date);
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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function nepalInputToIso(value: string) {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/.exec(value);
  if (!match) return "";
  const parsed = new Date(`${match[1]}:00+05:45`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function rowWindowStart(row: PickupQueueRow) {
  return row.confirmed_window_start ?? row.requested_window_start;
}

function rowWindowEnd(row: PickupQueueRow) {
  return row.confirmed_window_end ?? row.requested_window_end;
}

function kathmanduDateKey(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kathmandu" }).format(date);
}

function relativeAge(value: string | null, nowIso: string) {
  if (!value) return "—";
  const time = Date.parse(value);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(time) || !Number.isFinite(now)) return "—";
  const minutes = Math.max(0, Math.round((now - time) / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function windowDayLabel(value: string | null, todayKey: string, tomorrowKey: string) {
  if (!value) return "Not scheduled";
  const key = kathmanduDateKey(value);
  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "Asia/Kathmandu" }).format(new Date(value));
}

function statusTone(row: PickupQueueRow): "neutral" | "info" | "warning" | "success" | "danger" | "violet" {
  if (row.status === "picked_up") return "success";
  if (row.status === "missed") return "danger";
  if (row.status === "confirmed") return "info";
  if (row.status === "driver_assigned") return "violet";
  if (row.status === "requested") return "warning";
  return "neutral";
}

function statusLabel(status: PickupAppointmentStatus) {
  if (status === "unscheduled") return "To schedule";
  if (status === "requested") return "Requested";
  if (status === "confirmed") return "Scheduled";
  if (status === "driver_assigned") return "Driver assigned";
  if (status === "picked_up") return "Picked up";
  if (status === "missed") return "Missed";
  return "Cancelled";
}

function matchesFocus(row: PickupQueueRow, focus: Focus, nowIso: string) {
  if (focus === "all") return true;
  if (focus === "pending") return row.status === "unscheduled" || row.status === "requested";
  if (focus === "scheduled") return row.status === "confirmed";
  if (focus === "assigned") return row.status === "driver_assigned";
  if (focus === "completed") return row.status === "picked_up";
  if (focus === "attention") return row.status === "missed" || pickupNeedsAttention(row, nowIso);
  return row.status === "cancelled";
}

function validFocus(value: string | null): Focus {
  return STATUS_TABS.some((item) => item.value === value) ? value as Focus : "all";
}

function validDateFilter(value: string | null): DateFilter {
  return ["today", "upcoming", "overdue", "unscheduled"].includes(value ?? "") ? value as DateFilter : "all";
}

function validDriverFilter(value: string | null): DriverFilter {
  return value === "assigned" || value === "unassigned" ? value : "all";
}

function validStatus(value: string | null): "all" | PickupAppointmentStatus {
  return pickupAppointmentStatuses.includes(value as PickupAppointmentStatus) ? value as PickupAppointmentStatus : "all";
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))).sort((a, b) => a.localeCompare(b));
}

export function PickupAppointmentsWorkspace({ initialRows, initialSummary, initialReference = "" }: { initialRows: PickupQueueRow[]; initialSummary: PickupSummary; initialReference?: string }) {
  const workspace = useWorkspaceQuery();
  const initialSelected = initialRows.find((row) => row.shipment_reference === initialReference) ?? initialRows[0] ?? null;
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedReferenceState, setSelectedReferenceState] = useState(initialSelected?.shipment_reference ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [editor, setEditor] = useState<EditorPanel>("details");
  const [windowStart, setWindowStart] = useState(toLocalInput(initialSelected?.confirmed_window_start ?? initialSelected?.requested_window_start ?? null));
  const [windowEnd, setWindowEnd] = useState(toLocalInput(initialSelected?.confirmed_window_end ?? initialSelected?.requested_window_end ?? null));
  const [pickupLocation, setPickupLocation] = useState(initialSelected?.pickup_location ?? initialSelected?.origin ?? "");
  const [contactName, setContactName] = useState(initialSelected?.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(initialSelected?.contact_phone ?? "");
  const [channel, setChannel] = useState<PickupChannel>(initialSelected?.channel ?? "manual");
  const [providerReference, setProviderReference] = useState(initialSelected?.provider_reference ?? "");
  const [driverName, setDriverName] = useState(initialSelected?.driver_name ?? "");
  const [driverPhone, setDriverPhone] = useState(initialSelected?.driver_phone ?? "");
  const [vehicleReference, setVehicleReference] = useState(initialSelected?.vehicle_reference ?? "");
  const [notes, setNotes] = useState(initialSelected?.notes ?? "");
  const [missedReason, setMissedReason] = useState("");

  const params = workspace.params;
  const query = params.get("q") ?? "";
  const focus = validFocus(params.get("view"));
  const originFilter = params.get("origin") ?? "all";
  const partnerFilter = params.get("partner") ?? "all";
  const branchFilter = params.get("branch") ?? "all";
  const dateFilter = validDateFilter(params.get("date"));
  const statusFilter = validStatus(params.get("status"));
  const driverFilter = validDriverFilter(params.get("driver"));
  const sortDirection: SortDirection = params.get("sort") === "asc" ? "asc" : "desc";
  const requestedPage = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const requestedPageSize = Number.parseInt(params.get("pageSize") ?? "10", 10);
  const pageSize = [10, 20, 50].includes(requestedPageSize) ? requestedPageSize : 10;
  const shipmentParam = (params.get("shipment") ?? "").trim().toUpperCase();
  const selectedReference = shipmentParam && rows.some((row) => row.shipment_reference === shipmentParam) ? shipmentParam : selectedReferenceState;
  const nowIso = new Date().toISOString();
  const todayKey = kathmanduDateKey(nowIso);
  const tomorrowKey = kathmanduDateKey(new Date(Date.parse(nowIso) + 86_400_000).toISOString());

  const selected = rows.find((row) => row.shipment_reference === selectedReference) ?? null;
  const selectedWindowStart = selected ? rowWindowStart(selected) : null;
  const selectedWindowEnd = selected ? rowWindowEnd(selected) : null;
  const origins = useMemo(() => uniqueValues(rows.map((row) => row.origin)), [rows]);
  const partners = useMemo(() => uniqueValues(rows.map((row) => row.partner_name)), [rows]);
  const branches = useMemo(() => uniqueValues(rows.map((row) => row.branch)), [rows]);

  const tabCounts: Record<Focus, number> = {
    all: rows.length,
    pending: summary.unscheduled + summary.requested,
    scheduled: summary.confirmed,
    assigned: summary.driver_assigned,
    completed: rows.filter((row) => row.status === "picked_up").length,
    attention: summary.missed,
    cancelled: rows.filter((row) => row.status === "cancelled").length,
  };

  const scheduledToday = rows.filter((row) => row.status === "confirmed" && kathmanduDateKey(rowWindowStart(row)) === todayKey).length;
  const hasSchedulable = rows.some((row) => row.status === "unscheduled" || row.status === "requested");

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (!matchesFocus(row, focus, nowIso)) return false;
      if (originFilter !== "all" && row.origin !== originFilter) return false;
      if (partnerFilter !== "all" && row.partner_name !== partnerFilter) return false;
      if (branchFilter !== "all" && row.branch !== branchFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (driverFilter === "assigned" && !row.driver_name) return false;
      if (driverFilter === "unassigned" && row.driver_name) return false;
      const start = rowWindowStart(row);
      if (dateFilter === "today" && kathmanduDateKey(start) !== todayKey) return false;
      if (dateFilter === "upcoming" && (!start || kathmanduDateKey(start) < todayKey)) return false;
      if (dateFilter === "overdue" && !pickupNeedsAttention(row, nowIso)) return false;
      if (dateFilter === "unscheduled" && start) return false;
      if (!terms.length) return true;
      const haystack = [row.id, row.shipment_reference, row.booking_reference ?? "", row.customer_name, row.partner_name ?? "", row.origin, row.destination, row.branch, row.pickup_location ?? "", row.driver_name ?? "", row.vehicle_reference ?? "", row.contact_name ?? "", row.contact_phone ?? "", row.status].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).sort((a, b) => {
      const aTime = Date.parse(rowWindowStart(a) ?? "");
      const bTime = Date.parse(rowWindowStart(b) ?? "");
      const aValue = Number.isFinite(aTime) ? aTime : sortDirection === "asc" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
      const bValue = Number.isFinite(bTime) ? bTime : sortDirection === "asc" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [branchFilter, dateFilter, driverFilter, focus, nowIso, originFilter, partnerFilter, query, rows, sortDirection, statusFilter, todayKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const pageStart = (page - 1) * pageSize;
  const visibleRows = filtered.slice(pageStart, pageStart + pageSize);
  const activeFilterCount = [originFilter, partnerFilter, branchFilter, dateFilter, statusFilter, driverFilter].filter((value) => value !== "all").length;

  useEffect(() => {
    if (requestedPage > pageCount) workspace.update({ page: pageCount === 1 ? null : String(pageCount) });
  }, [pageCount, requestedPage, workspace]);

  function loadSelectedFields(row: PickupQueueRow) {
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
  }

  function updateFilters(values: Record<string, string | null>) {
    workspace.update({ ...values, page: null });
  }

  function choose(row: PickupQueueRow, nextEditor: EditorPanel = "details") {
    setSelectedReferenceState(row.shipment_reference);
    loadSelectedFields(row);
    setEditor(nextEditor);
    setNotice(null);
    workspace.update({ shipment: row.shipment_reference });
  }

  function openEditor(nextEditor: EditorPanel) {
    if (!selected) return;
    loadSelectedFields(selected);
    setEditor(nextEditor);
    setNotice(null);
  }

  function closeInspector() {
    setSelectedReferenceState("");
    setEditor("details");
    workspace.update({ shipment: null });
  }

  async function refresh(keepNotice = false) {
    const response = await fetch("/api/admin/pickups", { cache: "no-store" });
    const data = await response.json() as ApiResponse;
    if (!response.ok || !data.ok || !data.rows || !data.summary) throw new Error(data.error || "Pickup Scheduling could not be refreshed.");
    setRows(data.rows);
    setSummary(data.summary);
    if (selectedReference && !data.rows.some((row) => row.shipment_reference === selectedReference)) closeInspector();
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
      setEditor("details");
      if (action === "missed") setMissedReason("");
    } catch (error) {
      setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Pickup action failed." });
    } finally {
      setBusy(false);
    }
  }

  function schedulePayload(confirmed: boolean) {
    return {
      windowStart: nepalInputToIso(windowStart),
      windowEnd: nepalInputToIso(windowEnd),
      pickupLocation,
      contactName,
      contactPhone,
      channel,
      providerReference,
      notes,
      confirmed,
    };
  }

  function handleRefresh() {
    setBusy(true);
    refresh().catch((error) => setNotice({ tone: "danger", text: error instanceof Error ? error.message : "Refresh failed." })).finally(() => setBusy(false));
  }

  function scheduleNext() {
    const next = rows.find((row) => row.status === "unscheduled" || row.status === "requested") ?? null;
    if (!next) return;
    updateFilters({ view: "pending" });
    choose(next, "appointment");
  }

  return (
    <OpsPage className="pickups-workspace">
      <OpsPageHeader
        title="Pickup scheduling"
        description="Plan and manage cargo pickups from origin to keep shipments moving."
        actions={(
          <div className="pickups-actions">
            <OpsButton variant="secondary" onClick={handleRefresh} disabled={busy}>
              <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true"/> Refresh
            </OpsButton>
            <PrimaryButton type="button" disabled={!hasSchedulable || busy} onClick={scheduleNext}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true"/>Schedule pickup
            </PrimaryButton>
          </div>
        )}
      />

      <div className="px-4 pt-4 md:px-6">
        <OpsKpiStrip>
          <OpsKpiCard icon={<CalendarClock size={18} strokeWidth={1.9} aria-hidden="true"/>} label="To schedule" value={tabCounts.pending} tone="info" active={focus === "pending"} onClick={() => updateFilters({ view: "pending", date: null })}/>
          <OpsKpiCard icon={<Clock3 size={18} strokeWidth={1.9} aria-hidden="true"/>} label="Scheduled today" value={scheduledToday} tone="warning" active={focus === "scheduled" && dateFilter === "today"} onClick={() => updateFilters({ view: "scheduled", date: "today" })}/>
          <OpsKpiCard icon={<Users size={18} strokeWidth={1.9} aria-hidden="true"/>} label="Driver assigned" value={summary.driver_assigned} tone="accent" active={focus === "assigned"} onClick={() => updateFilters({ view: "assigned", date: null })}/>
          <OpsKpiCard icon={<PackageCheck size={18} strokeWidth={1.9} aria-hidden="true"/>} label="Picked up" value={tabCounts.completed} tone="success" active={focus === "completed"} onClick={() => updateFilters({ view: "completed", date: null })}/>
          <OpsKpiCard icon={<AlertTriangle size={18} strokeWidth={1.9} aria-hidden="true"/>} label="Needs attention" value={tabCounts.attention} tone="danger" active={focus === "attention"} onClick={() => updateFilters({ view: "attention", date: null })}/>
        </OpsKpiStrip>
      </div>

      <div className="px-4 py-4 md:px-6">
        {notice ? <div className="mb-4"><OpsNotice tone={notice.tone}>{notice.text}</OpsNotice></div> : null}

        <div className={`grid min-h-0 gap-4 ${selected ? "xl:grid-cols-[minmax(0,1fr)_minmax(330px,390px)]" : "grid-cols-1"}`}>
          <section className="min-w-0 overflow-hidden rounded-lg border border-[var(--admin-line)] bg-[var(--admin-surface)]" aria-label="Pickup register">
            <div className="overflow-x-auto border-b border-[var(--admin-line)]" role="group" aria-label="Pickup status views">
              <div className="flex min-w-max items-stretch px-2">
                {STATUS_TABS.map((item) => {
                  const active = focus === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => updateFilters({ view: item.value === "all" ? null : item.value })}
                      aria-pressed={active}
                      className={`relative inline-flex min-h-12 items-center gap-2 px-4 text-sm font-medium transition-colors ${active ? "text-[var(--admin-ink)]" : "text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"}`}
                    >
                      {item.label}
                      <span className="inline-flex min-w-5 justify-center rounded-md bg-[var(--admin-surface-muted)] px-1.5 py-0.5 text-xs text-[var(--admin-muted)]">{tabCounts[item.value]}</span>
                      {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 bg-[var(--admin-crimson)]" aria-hidden="true"/> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-b border-[var(--admin-line)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-56 flex-1 basis-64">
                  <OpsSearch value={query} onChange={(event) => updateFilters({ q: event.target.value || null })} placeholder="Search by customer, address, reference…" aria-label="Search pickups"/>
                </div>
                <FilterSelect value={originFilter} ariaLabel="Filter by origin" onChange={(value) => updateFilters({ origin: value === "all" ? null : value })}>
                  <option value="all">Origin</option>
                  {origins.map((origin) => <option key={origin} value={origin}>{origin}</option>)}
                </FilterSelect>
                <FilterSelect value={dateFilter} ariaLabel="Filter by date" onChange={(value) => updateFilters({ date: value === "all" ? null : value })}>
                  <option value="all">Date range</option>
                  <option value="today">Today</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="overdue">Overdue</option>
                  <option value="unscheduled">No date set</option>
                </FilterSelect>
                <FilterSelect value={statusFilter} ariaLabel="Filter by status" onChange={(value) => updateFilters({ status: value === "all" ? null : value })}>
                  <option value="all">Status</option>
                  {pickupAppointmentStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                </FilterSelect>
                <FilterSelect value={partnerFilter} ariaLabel="Filter by carrier or partner" onChange={(value) => updateFilters({ partner: value === "all" ? null : value })}>
                  <option value="all">Carrier</option>
                  {partners.map((partner) => <option key={partner} value={partner}>{partner}</option>)}
                </FilterSelect>
                <FilterSelect value={branchFilter} ariaLabel="Filter by branch" onChange={(value) => updateFilters({ branch: value === "all" ? null : value })}>
                  <option value="all">Branch</option>
                  {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                </FilterSelect>
                <button type="button" className={`${filterControlClass} inline-flex items-center gap-2`} onClick={() => setShowMoreFilters((value) => !value)} aria-expanded={showMoreFilters}>
                  <SlidersHorizontal size={15} strokeWidth={1.75} aria-hidden="true"/>More filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}
                </button>
              </div>
              {showMoreFilters ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--admin-line)] pt-3">
                  <FilterSelect value={driverFilter} ariaLabel="Filter by driver assignment" onChange={(value) => updateFilters({ driver: value === "all" ? null : value })}>
                    <option value="all">Driver assignment</option>
                    <option value="assigned">Assigned</option>
                    <option value="unassigned">Unassigned</option>
                  </FilterSelect>
                  <OpsButton type="button" variant="ghost" size="sm" onClick={() => workspace.update({ q: null, view: null, origin: null, partner: null, branch: null, date: null, status: null, driver: null, page: null })}>Reset filters</OpsButton>
                  <span className="ml-auto text-xs text-[var(--admin-muted)]">{filtered.length} pickup{filtered.length === 1 ? "" : "s"} in this view</span>
                </div>
              ) : null}
            </div>

            {filtered.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--admin-surface-muted)] text-xs font-medium text-[var(--admin-muted)]">
                    <tr>
                      <th className="whitespace-nowrap border-b border-[var(--admin-line)] px-4 py-3">Pickup / Reference</th>
                      <th className="whitespace-nowrap border-b border-[var(--admin-line)] px-4 py-3">Customer</th>
                      <th className="whitespace-nowrap border-b border-[var(--admin-line)] px-4 py-3">Pickup address</th>
                      <th className="whitespace-nowrap border-b border-[var(--admin-line)] px-4 py-3">
                        <button type="button" className="inline-flex items-center gap-1 text-inherit" onClick={() => updateFilters({ sort: sortDirection === "asc" ? "desc" : "asc" })} aria-label={`Sort pickup window ${sortDirection === "asc" ? "descending" : "ascending"}`}>
                          Pickup window{sortDirection === "asc" ? <ArrowUp size={13} strokeWidth={1.75} aria-hidden="true"/> : <ArrowDown size={13} strokeWidth={1.75} aria-hidden="true"/>}
                        </button>
                      </th>
                      <th className="whitespace-nowrap border-b border-[var(--admin-line)] px-4 py-3">Carrier</th>
                      <th className="whitespace-nowrap border-b border-[var(--admin-line)] px-4 py-3">Driver</th>
                      <th className="whitespace-nowrap border-b border-[var(--admin-line)] px-4 py-3">Linked shipment</th>
                      <th className="whitespace-nowrap border-b border-[var(--admin-line)] px-4 py-3">Status</th>
                      <th className="whitespace-nowrap border-b border-[var(--admin-line)] px-4 py-3">Updated</th>
                      <th className="whitespace-nowrap border-b border-[var(--admin-line)] px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const start = rowWindowStart(row);
                      const end = rowWindowEnd(row);
                      const attention = row.status !== "cancelled" && row.status !== "picked_up" && pickupNeedsAttention(row, nowIso);
                      const rowSelected = row.shipment_reference === selectedReference;
                      return (
                        <tr key={row.id} className={`cursor-pointer border-b border-[var(--admin-line)] transition-colors last:border-b-0 ${rowSelected ? "bg-[var(--admin-surface-muted)]" : "hover:bg-[var(--admin-canvas)]"}`} aria-selected={rowSelected || undefined} onClick={() => choose(row)}>
                          <td className="whitespace-nowrap px-4 py-3 align-top">
                            <span className="block font-medium text-[var(--admin-ink)]">{row.id}</span>
                            <span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{row.booking_reference || row.provider_reference || "—"}</span>
                          </td>
                          <td className="px-4 py-3 align-top text-[var(--admin-ink)]">{row.customer_name}</td>
                          <td className="px-4 py-3 align-top">
                            <span className="block text-[var(--admin-ink)]">{row.pickup_location || row.origin}</span>
                            {row.pickup_location && row.origin && row.pickup_location !== row.origin ? <span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{row.origin}</span> : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top">
                            <span className="block text-[var(--admin-ink)]">{windowDayLabel(start, todayKey, tomorrowKey)}</span>
                            <span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{start ? `${timeLabel(start)}${end ? ` – ${timeLabel(end)}` : ""}` : "Awaiting appointment"}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top text-[var(--admin-muted)]">{row.partner_name || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 align-top text-[var(--admin-ink)]">{row.driver_name || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 align-top">
                            <Link href={`/admin/jobs/${encodeURIComponent(row.shipment_reference)}`} className="font-medium text-[var(--admin-info)] hover:underline" onClick={(event) => event.stopPropagation()}>{row.shipment_reference}</Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top">
                            <div className="flex items-center gap-2">
                              <OpsBadge tone={statusTone(row)}>{statusLabel(row.status)}</OpsBadge>
                              {attention ? <span title="Needs attention"><AlertTriangle size={15} strokeWidth={1.75} className="text-[var(--admin-danger)]" aria-label="Needs attention"/></span> : null}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-top text-[var(--admin-muted)]">{relativeAge(row.updated_at, nowIso)}</td>
                          <td className="px-4 py-3 text-right align-top">
                            <button type="button" className="inline-grid min-h-9 min-w-9 place-items-center rounded-md text-[var(--admin-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-ink)]" onClick={(event) => { event.stopPropagation(); choose(row); }} aria-label={`Open pickup ${row.id}`}>
                              <MoreHorizontal size={17} strokeWidth={1.75} aria-hidden="true"/>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <OpsEmptyState compact kind="search" title="No pickups" description="No pickups match the current search and filters." action={<OpsButton type="button" variant="secondary" onClick={() => workspace.update({ q: null, view: null, origin: null, partner: null, branch: null, date: null, status: null, driver: null, page: null })}>Clear filters</OpsButton>}/>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-line)] px-4 py-3 text-xs text-[var(--admin-muted)]">
              <span>{filtered.length ? `Showing ${pageStart + 1}–${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length} pickups` : "No pickups to show"}</span>
              <div className="flex items-center gap-2">
                <button type="button" className={iconButtonClass} disabled={page <= 1} onClick={() => workspace.update({ page: page - 1 <= 1 ? null : String(page - 1) })} aria-label="Previous page"><ChevronLeft size={15} strokeWidth={1.75} aria-hidden="true"/></button>
                {Array.from({ length: Math.min(pageCount, 3) }, (_, index) => index + 1).map((pageNumber) => (
                  <button key={pageNumber} type="button" className={`min-h-10 min-w-10 rounded-md border px-3 text-sm font-medium ${pageNumber === page ? "border-[var(--admin-crimson)] bg-[var(--admin-crimson)] text-white" : "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-ink)] hover:border-[var(--admin-line-strong)]"}`} onClick={() => workspace.update({ page: pageNumber === 1 ? null : String(pageNumber) })} aria-current={pageNumber === page ? "page" : undefined}>{pageNumber}</button>
                ))}
                <button type="button" className={iconButtonClass} disabled={page >= pageCount} onClick={() => workspace.update({ page: String(page + 1) })} aria-label="Next page"><ChevronRight size={15} strokeWidth={1.75} aria-hidden="true"/></button>
                <FilterSelect value={String(pageSize)} ariaLabel="Rows per page" onChange={(value) => workspace.update({ pageSize: value === "10" ? null : value, page: null })}>
                  <option value="10">10 / page</option>
                  <option value="20">20 / page</option>
                  <option value="50">50 / page</option>
                </FilterSelect>
              </div>
            </footer>
          </section>

          {selected ? (
            <aside className="min-w-0 self-start overflow-hidden rounded-lg border border-[var(--admin-line)] bg-[var(--admin-surface)] xl:sticky xl:top-4" aria-label={`Pickup ${selected.id}`}>
              <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-line)] px-4 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-[var(--admin-ink)]">{selected.id}</h2>
                    <OpsBadge tone={statusTone(selected)}>{statusLabel(selected.status)}</OpsBadge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--admin-muted)]">For shipment <Link href={`/admin/jobs/${encodeURIComponent(selected.shipment_reference)}`} className="font-medium text-[var(--admin-ink)] hover:underline">{selected.shipment_reference}</Link></p>
                </div>
                <button type="button" className="inline-grid min-h-9 min-w-9 place-items-center rounded-md text-[var(--admin-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-ink)]" onClick={closeInspector} aria-label="Close pickup details"><X size={17} strokeWidth={1.75} aria-hidden="true"/></button>
              </header>

              <div className="max-h-[calc(100dvh-150px)] overflow-y-auto">
                {selected.status !== "picked_up" && selected.status !== "cancelled" ? (
                  <div className="grid grid-cols-2 gap-2 border-b border-[var(--admin-line)] p-4">
                    <OpsButton type="button" variant="secondary" onClick={() => openEditor("appointment")}><CalendarClock size={15} strokeWidth={1.75} aria-hidden="true"/>{selected.status === "unscheduled" ? "Schedule" : "Reschedule"}</OpsButton>
                    {selected.status === "confirmed" || selected.status === "requested" ? (
                      <PrimaryButton type="button" onClick={() => openEditor("driver")}><UserRound size={15} strokeWidth={1.75} aria-hidden="true"/>Assign driver</PrimaryButton>
                    ) : selected.status === "driver_assigned" ? (
                      <PrimaryButton type="button" onClick={() => openEditor("outcome")}><PackageCheck size={15} strokeWidth={1.75} aria-hidden="true"/>Pickup outcome</PrimaryButton>
                    ) : (
                      <PrimaryButton type="button" onClick={() => openEditor("appointment")}><CalendarClock size={15} strokeWidth={1.75} aria-hidden="true"/>Set appointment</PrimaryButton>
                    )}
                  </div>
                ) : null}

                {selected.status === "missed" || (pickupNeedsAttention(selected, nowIso) && selected.status !== "picked_up" && selected.status !== "cancelled") ? (
                  <div className="border-b border-[var(--admin-line)] px-4 py-3">
                    <div className="flex items-start gap-2 rounded-md bg-[var(--admin-danger-bg)] px-3 py-2.5 text-[var(--admin-danger)]">
                      <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true"/>
                      <div><strong className="block text-sm">Attention required</strong><span className="mt-0.5 block text-xs">{selected.status === "missed" ? selected.missed_reason || "This pickup was recorded as missed." : "The collection window is missing or overdue."}</span></div>
                    </div>
                  </div>
                ) : null}

                <section className="border-b border-[var(--admin-line)] px-4 py-4">
                  <h3 className="text-sm font-semibold text-[var(--admin-ink)]">Location &amp; route</h3>
                  <div className="mt-3 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-canvas)] p-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                      <RoutePoint icon={<MapPin size={15} strokeWidth={1.75}/>} label="Pickup" value={selected.pickup_location || selected.origin}/>
                      <div className="flex items-center gap-1 text-[var(--admin-line-strong)]" aria-hidden="true"><span className="h-px w-6 bg-[var(--admin-line-strong)]"/><Truck size={16} strokeWidth={1.75}/><span className="h-px w-6 bg-[var(--admin-line-strong)]"/></div>
                      <RoutePoint align="right" icon={<MapPin size={15} strokeWidth={1.75}/>} label="Destination" value={selected.destination}/>
                    </div>
                  </div>
                </section>

                <section className="border-b border-[var(--admin-line)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[var(--admin-ink)]">Pickup details</h3>
                    <button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--admin-line)] px-2.5 text-xs font-medium text-[var(--admin-ink)] hover:border-[var(--admin-line-strong)]" onClick={() => openEditor("appointment")}><Pencil size={13} strokeWidth={1.75} aria-hidden="true"/>Edit</button>
                  </div>
                  <dl className="mt-3 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                    <DetailRow label="Customer">{selected.customer_name}</DetailRow>
                    <DetailRow label="Pickup address">{selected.pickup_location || selected.origin}</DetailRow>
                    <DetailRow label="Date & time">{selectedWindowStart ? `${dateLabel(selectedWindowStart)} · ${timeLabel(selectedWindowStart)}${selectedWindowEnd ? ` – ${timeLabel(selectedWindowEnd)}` : ""}` : "Not scheduled"}</DetailRow>
                    <DetailRow label="Carrier">{selected.partner_name || selected.channel.replaceAll("_", " ")}</DetailRow>
                    <DetailRow label="Driver / vehicle">{selected.driver_name ? `${selected.driver_name}${selected.vehicle_reference ? ` · ${selected.vehicle_reference}` : ""}` : "Not assigned"}</DetailRow>
                    <DetailRow label="Contact">{[selected.contact_name, selected.contact_phone].filter(Boolean).join(" · ") || "Not provided"}</DetailRow>
                    <DetailRow label="Reference">{selected.provider_reference || "—"}</DetailRow>
                    <DetailRow label="Instructions">{selected.notes || "—"}</DetailRow>
                  </dl>
                </section>

                {editor === "appointment" && selected.status !== "picked_up" && selected.status !== "cancelled" ? (
                  <section className="border-b border-[var(--admin-line)] bg-[var(--admin-canvas)] px-4 py-4">
                    <EditorHeading title="Appointment" detail="Request or confirm the collection window." onClose={() => setEditor("details")}/>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <OpsField label="Window start"><input name="pickup-window-start" type="datetime-local" value={windowStart} onChange={(event) => setWindowStart(event.target.value)}/></OpsField>
                      <OpsField label="Window end"><input name="pickup-window-end" type="datetime-local" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)}/></OpsField>
                      <OpsField label="Pickup location"><input value={pickupLocation} onChange={(event) => setPickupLocation(event.target.value)} placeholder="Warehouse, factory, terminal…"/></OpsField>
                      <OpsField label="Request channel"><select value={channel} onChange={(event) => setChannel(event.target.value as PickupChannel)}>{pickupChannels.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></OpsField>
                      <OpsField label="Contact name"><input value={contactName} onChange={(event) => setContactName(event.target.value)}/></OpsField>
                      <OpsField label="Contact phone"><input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)}/></OpsField>
                      <OpsField label="Carrier reference"><input value={providerReference} onChange={(event) => setProviderReference(event.target.value)} placeholder="Appointment reference"/></OpsField>
                      <OpsField label="Instructions"><input value={notes} onChange={(event) => setNotes(event.target.value)}/></OpsField>
                    </div>
                    <p className="mt-3 text-xs text-[var(--admin-muted)]">Times are saved and displayed in Nepal time (NPT).</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <OpsButton type="button" variant="secondary" disabled={busy || !nepalInputToIso(windowStart) || !nepalInputToIso(windowEnd)} onClick={() => act("schedule", schedulePayload(false))}>Request pickup</OpsButton>
                      <PrimaryButton type="button" disabled={busy || !nepalInputToIso(windowStart) || !nepalInputToIso(windowEnd)} onClick={() => act(selected.status === "unscheduled" || selected.status === "missed" ? "schedule" : "confirm", selected.status === "unscheduled" || selected.status === "missed" ? schedulePayload(true) : { windowStart: nepalInputToIso(windowStart), windowEnd: nepalInputToIso(windowEnd), providerReference, notes })}>{selected.status === "confirmed" ? "Update appointment" : "Confirm appointment"}</PrimaryButton>
                    </div>
                  </section>
                ) : null}

                {editor === "driver" && selected.status !== "picked_up" && selected.status !== "cancelled" ? (
                  <section className="border-b border-[var(--admin-line)] bg-[var(--admin-canvas)] px-4 py-4">
                    <EditorHeading title="Vehicle & driver" detail="Assign the collection resource once the appointment is ready." onClose={() => setEditor("details")}/>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <OpsField label="Driver name"><input value={driverName} onChange={(event) => setDriverName(event.target.value)}/></OpsField>
                      <OpsField label="Driver phone"><input value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)}/></OpsField>
                      <OpsField label="Vehicle reference"><input value={vehicleReference} onChange={(event) => setVehicleReference(event.target.value)} placeholder="Truck / plate / vehicle"/></OpsField>
                    </div>
                    <div className="mt-4"><PrimaryButton type="button" disabled={busy || driverName.trim().length < 2 || selected.status === "unscheduled"} onClick={() => act("assign_driver", { driverName, driverPhone, vehicleReference, notes })}><Truck size={15} strokeWidth={1.75} aria-hidden="true"/>Save driver assignment</PrimaryButton></div>
                  </section>
                ) : null}

                {editor === "outcome" && selected.status !== "picked_up" && selected.status !== "cancelled" ? (
                  <section className="border-b border-[var(--admin-line)] bg-[var(--admin-canvas)] px-4 py-4">
                    <EditorHeading title="Pickup outcome" detail="Complete the collection or record the operational exception." onClose={() => setEditor("details")}/>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <PrimaryButton type="button" disabled={busy || selected.status === "unscheduled"} onClick={() => act("picked_up", { eventTime: new Date().toISOString(), location: pickupLocation })}><Check size={15} strokeWidth={1.75} aria-hidden="true"/>Cargo picked up</PrimaryButton>
                      <OpsButton type="button" variant="danger" disabled={busy || selected.status === "unscheduled" || missedReason.trim().length < 6} onClick={() => act("missed", { reason: missedReason })}><AlertTriangle size={15} strokeWidth={1.75} aria-hidden="true"/>Mark missed</OpsButton>
                      <OpsButton type="button" variant="ghost" disabled={busy || selected.status === "unscheduled"} onClick={() => act("cancel", { note: notes })}>Cancel pickup</OpsButton>
                    </div>
                    <div className="mt-4"><OpsField label="Missed-pickup reason"><textarea className="ops-textarea min-h-20" value={missedReason} onChange={(event) => setMissedReason(event.target.value)} placeholder="Carrier no-show, cargo not ready, warehouse closed, documents incomplete…"/></OpsField></div>
                  </section>
                ) : null}

                <section className="border-b border-[var(--admin-line)] px-4 py-4">
                  <h3 className="text-sm font-semibold text-[var(--admin-ink)]">Pickup timeline</h3>
                  <div className="mt-4 space-y-0">
                    <TimelineItem state={selected.status === "unscheduled" ? "current" : "done"} title="Appointment" detail={selectedWindowStart ? shortDateTime(selectedWindowStart) : "Awaiting pickup window"}/>
                    <TimelineItem state={selected.status === "confirmed" || selected.status === "requested" ? "current" : selected.driver_name || selected.status === "driver_assigned" || selected.status === "picked_up" ? "done" : "future"} title="Driver assigned" detail={selected.driver_name ? [selected.driver_name, selected.vehicle_reference].filter(Boolean).join(" · ") : "—"}/>
                    <TimelineItem state={selected.status === "picked_up" ? "done" : selected.status === "missed" ? "danger" : selected.status === "driver_assigned" ? "current" : "future"} title="Cargo picked up" detail={selected.picked_up_at ? dateTime(selected.picked_up_at) : selected.status === "missed" ? selected.missed_reason || "Pickup missed" : "—"}/>
                    <TimelineItem state={selected.status === "picked_up" ? "done" : "future"} title="Handoff to Live Visibility" detail={selected.status === "picked_up" ? "Movement milestone recorded" : "Begins after pickup completion"} last/>
                  </div>
                </section>

                {selected.status === "picked_up" || selected.status === "cancelled" ? (
                  <div className="border-b border-[var(--admin-line)] px-4 py-4"><OpsNotice tone={selected.status === "picked_up" ? "success" : "warning"}>{selected.status === "picked_up" ? `Pickup completed ${dateTime(selected.picked_up_at)}. Live Visibility now owns the movement timeline.` : "This pickup appointment is cancelled."}</OpsNotice></div>
                ) : null}
              </div>

              <footer className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 p-4">
                <Link href={`/admin/jobs/${encodeURIComponent(selected.shipment_reference)}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[var(--admin-line)] px-3 text-sm font-medium text-[var(--admin-ink)] hover:border-[var(--admin-line-strong)]"><ExternalLink size={15} strokeWidth={1.75} aria-hidden="true"/>View shipment</Link>
                <button type="button" className={iconButtonClass} onClick={() => editor === "outcome" ? setEditor("details") : openEditor("outcome")} aria-label="More pickup actions"><MoreHorizontal size={17} strokeWidth={1.75} aria-hidden="true"/></button>
              </footer>
            </aside>
          ) : null}
        </div>
      </div>
    </OpsPage>
  );
}

function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[var(--admin-crimson)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-focus)] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>{children}</button>;
}

function FilterSelect({ value, ariaLabel, onChange, children }: { value: string; ariaLabel: string; onChange: (value: string) => void; children: ReactNode }) {
  return <select className={filterControlClass} value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel}>{children}</select>;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <><dt className="text-[var(--admin-muted)]">{label}</dt><dd className="m-0 min-w-0 text-[var(--admin-ink)]">{children}</dd></>;
}

function RoutePoint({ icon, label, value, align = "left" }: { icon: ReactNode; label: string; value: string; align?: "left" | "right" }) {
  return <div className={align === "right" ? "text-right" : "text-left"}><span className={`inline-flex items-center gap-1.5 text-xs font-medium text-[var(--admin-muted)] ${align === "right" ? "flex-row-reverse" : ""}`}>{icon}{label}</span><strong className="mt-1 block text-sm font-medium text-[var(--admin-ink)]">{value}</strong></div>;
}

function EditorHeading({ title, detail, onClose }: { title: string; detail: string; onClose: () => void }) {
  return <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-[var(--admin-ink)]">{title}</h3><p className="mt-1 text-xs text-[var(--admin-muted)]">{detail}</p></div><button type="button" className="inline-grid min-h-8 min-w-8 place-items-center rounded-md text-[var(--admin-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-ink)]" onClick={onClose} aria-label={`Close ${title.toLowerCase()} editor`}><X size={15} strokeWidth={1.75} aria-hidden="true"/></button></div>;
}

function TimelineItem({ state, title, detail, last = false }: { state: "done" | "current" | "future" | "danger"; title: string; detail: string; last?: boolean }) {
  const icon = state === "done" ? <Check size={14} strokeWidth={2} aria-hidden="true"/> : state === "danger" ? <AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/> : state === "current" ? <Clock3 size={14} strokeWidth={1.75} aria-hidden="true"/> : <Circle size={10} strokeWidth={1.75} aria-hidden="true"/>;
  const iconClass = state === "done" ? "bg-[var(--admin-success-bg)] text-[var(--admin-success)]" : state === "danger" ? "bg-[var(--admin-danger-bg)] text-[var(--admin-danger)]" : state === "current" ? "bg-[var(--admin-ink)] text-white" : "bg-[var(--admin-surface-muted)] text-[var(--admin-muted)]";
  return <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3"><div className="flex flex-col items-center"><span className={`grid h-8 w-8 place-items-center rounded-[var(--app-dialog-radius)] ${iconClass}`}>{icon}</span>{!last ? <span className="min-h-7 w-px flex-1 bg-[var(--admin-line)]" aria-hidden="true"/> : null}</div><div className="pb-4 pt-1"><strong className="block text-sm font-medium text-[var(--admin-ink)]">{title}</strong><span className="mt-0.5 block text-xs text-[var(--admin-muted)]">{detail}</span></div></div>;
}
