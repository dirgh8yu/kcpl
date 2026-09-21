"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  OpsActiveFilters,
  OpsBadge,
  OpsButton,
  OpsEmptyState,
  OpsFact,
  OpsFacts,
  OpsField,
  OpsFilterChoices,
  OpsFilterMenu,
  OpsFilterSelect,
  OpsInspectorHeader,
  OpsInspectorNote,
  OpsInspectorSection,
  OpsKpiRail,
  OpsNotice,
  OpsPage,
  OpsPageHeader,
  OpsRailMetric,
  OpsRegisterToolbar,
  OpsScopeTabs,
  OpsSearch,
  OpsTableWrap,
  type OpsActiveFilter,
} from "../operations-ui";
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

const DATE_OPTIONS: Array<{ value: Exclude<DateFilter, "all">; label: string }> = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "unscheduled", label: "No date set" },
];

const DRIVER_OPTIONS: Array<{ value: DriverFilter; label: string }> = [
  { value: "all", label: "Any" },
  { value: "assigned", label: "Assigned" },
  { value: "unassigned", label: "Unassigned" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50].map((size) => ({ value: String(size), label: `${size} / page` }));

/** Docked beside the register while there is room; mirrors the .ops-register-layout query. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1180px), (min-width: 900px) and (max-width: 1023px)";

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

// Presentation only: colour follows urgency. Planned movement is blue, pending
// confirmation amber, completion green, a missed pickup red; the rest neutral.
function statusTone(row: PickupQueueRow): "neutral" | "info" | "warning" | "success" | "danger" {
  if (row.status === "picked_up") return "success";
  if (row.status === "missed") return "danger";
  if (row.status === "confirmed" || row.status === "driver_assigned") return "info";
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
  const inspectorRef = useRef<HTMLElement>(null);

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
  // With the inspector open the register loses ~390px. Every column dropped
  // here is already shown in the inspector, so the register keeps the columns
  // you steer by (reference, customer, window, status) instead of pushing
  // Status out of view behind a horizontal scrollbar.
  const compact = selected !== null;
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

  const filtered = (() => {
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
  })();

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const pageStart = (page - 1) * pageSize;
  const visibleRows = filtered.slice(pageStart, pageStart + pageSize);
  const menuFilterCount = [statusFilter, driverFilter].filter((value) => value !== "all").length;
  // Up to three page numbers, windowed around the current page.
  const pageWindowStart = Math.max(1, Math.min(page - 1, pageCount - 2));
  const pageWindow = Array.from({ length: Math.min(pageCount, 3) }, (_, index) => pageWindowStart + index);
  const activeFilters: OpsActiveFilter[] = [];
  if (originFilter !== "all") activeFilters.push({ key: "origin", label: originFilter, title: `Origin: ${originFilter}`, onRemove: () => updateFilters({ origin: null }) });
  if (dateFilter !== "all") activeFilters.push({ key: "date", label: DATE_OPTIONS.find((option) => option.value === dateFilter)?.label ?? dateFilter, title: `Date: ${dateFilter}`, onRemove: () => updateFilters({ date: null }) });
  if (partnerFilter !== "all") activeFilters.push({ key: "partner", label: partnerFilter, title: `Carrier: ${partnerFilter}`, onRemove: () => updateFilters({ partner: null }) });
  if (branchFilter !== "all") activeFilters.push({ key: "branch", label: branchFilter, title: `Branch: ${branchFilter}`, onRemove: () => updateFilters({ branch: null }) });
  if (statusFilter !== "all") activeFilters.push({ key: "status", label: statusLabel(statusFilter), title: `Status: ${statusLabel(statusFilter)}`, onRemove: () => updateFilters({ status: null }) });
  if (driverFilter !== "all") activeFilters.push({ key: "driver", label: driverFilter === "assigned" ? "Driver assigned" : "No driver", title: `Driver: ${driverFilter}`, onRemove: () => updateFilters({ driver: null }) });

  useEffect(() => {
    if (requestedPage > pageCount) workspace.update({ page: pageCount === 1 ? null : String(pageCount) });
  }, [pageCount, requestedPage, workspace]);

  // Escape closes an open editor first, then the inspector. Popovers and
  // dialogs handle their own Escape and mark the event, so they win.
  const hasSelection = selected !== null;
  const editorOpen = editor !== "details";
  useEffect(() => {
    if (!hasSelection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (editorOpen) setEditor("details");
      else {
        setSelectedReferenceState("");
        workspace.update({ shipment: null });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editorOpen, hasSelection, workspace]);

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

  function resetFilters() {
    workspace.update({ q: null, view: null, origin: null, partner: null, branch: null, date: null, status: null, driver: null, page: null });
  }

  function choose(row: PickupQueueRow, nextEditor: EditorPanel = "details") {
    setSelectedReferenceState(row.shipment_reference);
    loadSelectedFields(row);
    setEditor(nextEditor);
    setNotice(null);
    workspace.update({ shipment: row.shipment_reference });
    // When the inspector stacks under the register, bring it into view so the
    // selection visibly lands somewhere.
    window.requestAnimationFrame(() => {
      if (window.matchMedia(SIDE_BY_SIDE_QUERY).matches) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      inspectorRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    });
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
              <RefreshCw size={16} strokeWidth={1.75} className={busy ? "app-refreshing" : undefined} aria-hidden="true"/> Refresh
            </OpsButton>
            <OpsButton variant="primary" type="button" disabled={!hasSchedulable || busy} onClick={scheduleNext}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true"/>Schedule pickup
            </OpsButton>
          </div>
        )}
      />

      {/* One flat rail, not five metric cards. Each segment activates the scope
          it already mapped to; no new filtering logic. */}
      <div className="px-4 pt-3 md:px-6">
        <OpsKpiRail label="Pickup summary">
          <OpsRailMetric label="To schedule" value={tabCounts.pending} tone="warning" active={focus === "pending"} onClick={() => updateFilters({ view: "pending", date: null })}/>
          <OpsRailMetric label="Scheduled today" value={scheduledToday} tone="info" active={focus === "scheduled" && dateFilter === "today"} onClick={() => updateFilters({ view: "scheduled", date: "today" })}/>
          <OpsRailMetric label="Driver assigned" value={summary.driver_assigned} active={focus === "assigned"} onClick={() => updateFilters({ view: "assigned", date: null })}/>
          <OpsRailMetric label="Picked up" value={tabCounts.completed} tone="success" active={focus === "completed"} onClick={() => updateFilters({ view: "completed", date: null })}/>
          <OpsRailMetric label="Attention" value={tabCounts.attention} tone="danger" active={focus === "attention"} onClick={() => updateFilters({ view: "attention", date: null })} title="Missed or overdue pickups"/>
        </OpsKpiRail>
      </div>

      <div className="px-4 pb-8 pt-4 md:px-6">
        {notice ? <div className="mb-3"><OpsNotice tone={notice.tone}>{notice.text}</OpsNotice></div> : null}

        <OpsRegisterToolbar
          search={<OpsSearch value={query} onChange={(event) => updateFilters({ q: event.target.value || null })} placeholder="Search customer, address, reference…" aria-label="Search pickups"/>}
          actions={(
            <>
              <OpsFilterSelect label="Origin" value={originFilter} allLabel="All origins" options={origins.map((origin) => ({ value: origin, label: origin }))} onChange={(value) => updateFilters({ origin: value === "all" ? null : value })}/>
              <OpsFilterSelect label="Date" value={dateFilter} allLabel="Any date" options={DATE_OPTIONS} onChange={(value) => updateFilters({ date: value === "all" ? null : value })}/>
              <OpsFilterSelect label="Carrier" value={partnerFilter} allLabel="All carriers" options={partners.map((partner) => ({ value: partner, label: partner }))} onChange={(value) => updateFilters({ partner: value === "all" ? null : value })}/>
              <OpsFilterSelect label="Branch" value={branchFilter} allLabel="All branches" options={branches.map((branch) => ({ value: branch, label: branch }))} onChange={(value) => updateFilters({ branch: value === "all" ? null : value })}/>
              <OpsFilterMenu count={menuFilterCount} onClear={() => updateFilters({ status: null, driver: null })}>
                <OpsFilterChoices label="Status" value={statusFilter} options={[{ value: "all", label: "Any" }, ...pickupAppointmentStatuses.map((status) => ({ value: status, label: statusLabel(status) }))]} onChange={(value) => updateFilters({ status: value === "all" ? null : value })}/>
                <OpsFilterChoices label="Driver assignment" value={driverFilter} options={DRIVER_OPTIONS} onChange={(value) => updateFilters({ driver: value === "all" ? null : value })}/>
              </OpsFilterMenu>
              <span className="ops-toolbar-divider" aria-hidden="true"/>
              <span className="ops-result-count" aria-live="polite">{filtered.length === rows.length ? `${rows.length} pickups` : `${filtered.length} of ${rows.length}`}</span>
            </>
          )}
          tabs={<OpsScopeTabs label="Pickup status views" items={STATUS_TABS.map((item) => ({ ...item, count: tabCounts[item.value] }))} value={focus} onChange={(value) => updateFilters({ view: value === "all" ? null : value })}/>}
        />

        <OpsActiveFilters chips={activeFilters} onReset={resetFilters}/>

        <div className="ops-register-layout" data-inspector={selected ? "open" : undefined}>
          <section className="ops-surface" aria-label="Pickup register">
            {filtered.length ? (
              <OpsTableWrap>
                <table className="ops-table ops-register-table pickups-table" data-compact={compact || undefined} aria-label="Pickup appointments">
                  <thead>
                    <tr>
                      <th>Pickup</th>
                      <th>Customer · Pickup address</th>
                      <th aria-sort={sortDirection === "asc" ? "ascending" : "descending"}>
                        <button type="button" className="ops-sort-button" onClick={() => updateFilters({ sort: sortDirection === "asc" ? "desc" : "asc" })} aria-label={`Sort pickup window ${sortDirection === "asc" ? "descending" : "ascending"}`}>
                          Window{sortDirection === "asc" ? <ArrowUp size={12} strokeWidth={1.75} aria-hidden="true"/> : <ArrowDown size={12} strokeWidth={1.75} aria-hidden="true"/>}
                        </button>
                      </th>
                      {compact ? null : <th>Carrier</th>}
                      {compact ? null : <th>Driver</th>}
                      {compact ? null : <th>Shipment</th>}
                      <th>Status</th>
                      {compact ? null : <th>Updated</th>}
                      <th className="ops-cell-open"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const start = rowWindowStart(row);
                      const end = rowWindowEnd(row);
                      const attention = row.status !== "cancelled" && row.status !== "picked_up" && pickupNeedsAttention(row, nowIso);
                      const rowSelected = row.shipment_reference === selectedReference;
                      return (
                        <tr
                          key={row.id}
                          tabIndex={0}
                          data-selected={rowSelected || undefined}
                          aria-current={rowSelected || undefined}
                          aria-label={`Open pickup ${row.id}, ${row.customer_name}, ${statusLabel(row.status)}${attention ? ", needs attention" : ""}`}
                          onClick={() => choose(row)}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(row); } }}
                        >
                          <td>
                            <span className="ops-cell-primary ops-mono ops-cell-id">{row.id}</span>
                            <span className="ops-cell-secondary ops-mono">{row.booking_reference || row.provider_reference || "—"}</span>
                          </td>
                          <td>
                            <span className="ops-cell-primary ops-cell-clamp">{row.customer_name}</span>
                            <span className="ops-cell-secondary ops-cell-clamp">{row.pickup_location || row.origin}{row.pickup_location && row.origin && row.pickup_location !== row.origin ? ` · ${row.origin}` : ""}</span>
                          </td>
                          <td>
                            <span className="ops-cell-primary">{windowDayLabel(start, todayKey, tomorrowKey)}</span>
                            <span className="ops-cell-secondary">{start ? `${timeLabel(start)}${end ? `–${timeLabel(end)}` : ""} NPT` : "Awaiting appointment"}</span>
                          </td>
                          {compact ? null : <td><span className="ops-cell-muted">{row.partner_name || "—"}</span></td>}
                          {compact ? null : <td>{row.driver_name ? <span className="ops-cell-primary ops-cell-clamp">{row.driver_name}</span> : <span className="ops-cell-muted">—</span>}</td>}
                          {compact ? null : (
                            <td><Link href={`/admin/jobs/${encodeURIComponent(row.shipment_reference)}`} className="ops-cell-ref ops-mono" onClick={(event) => event.stopPropagation()}>{row.shipment_reference}</Link></td>
                          )}
                          <td>
                            <span className="pickups-status">
                              <OpsBadge tone={statusTone(row)}>{statusLabel(row.status)}</OpsBadge>
                              {attention ? <span className="pickups-attention" title="Needs attention"><AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/><span className="sr-only">Needs attention</span></span> : null}
                            </span>
                          </td>
                          {compact ? null : <td><span className="ops-cell-muted">{relativeAge(row.updated_at, nowIso)}</span></td>}
                          <td className="ops-cell-open">
                            <button type="button" className="ops-row-open" onClick={(event) => { event.stopPropagation(); choose(row); }} aria-label={`Open pickup ${row.id}`} tabIndex={-1}>
                              <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true"/>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </OpsTableWrap>
            ) : (
              <OpsEmptyState compact kind="search" title="No pickups" description="No pickups match the current search and filters." action={<OpsButton type="button" variant="secondary" size="sm" onClick={resetFilters}>Clear filters</OpsButton>}/>
            )}

            <footer className="ops-register-footer">
              <span>{filtered.length ? `${pageStart + 1}–${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length} pickups` : "No pickups to show"}</span>
              <nav className="ops-pager" aria-label="Pickup pages">
                <button type="button" className="ops-pager-button" disabled={page <= 1} onClick={() => workspace.update({ page: page - 1 <= 1 ? null : String(page - 1) })} aria-label="Previous page"><ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true"/></button>
                {pageWindow.map((pageNumber) => (
                  <button key={pageNumber} type="button" className="ops-pager-button" onClick={() => workspace.update({ page: pageNumber === 1 ? null : String(pageNumber) })} aria-current={pageNumber === page ? "page" : undefined} aria-label={`Page ${pageNumber}`}>{pageNumber}</button>
                ))}
                <button type="button" className="ops-pager-button" disabled={page >= pageCount} onClick={() => workspace.update({ page: String(page + 1) })} aria-label="Next page"><ChevronRight size={14} strokeWidth={1.75} aria-hidden="true"/></button>
                <OpsFilterSelect label="Rows per page" value={String(pageSize)} allValue={null} showValue align="end" options={PAGE_SIZE_OPTIONS} onChange={(value) => workspace.update({ pageSize: value === "10" ? null : value, page: null })}/>
              </nav>
            </footer>
          </section>

          {selected ? (
            <aside ref={inspectorRef} className="ops-inspector" aria-label={`Pickup ${selected.id}`}>
              <OpsInspectorHeader
                kicker={`${selected.id} · ${selected.shipment_reference}`}
                title={selected.customer_name}
                subtitle={`${selected.pickup_location || selected.origin} → ${selected.destination}`}
                actions={(
                  <>
                    <OpsBadge tone={statusTone(selected)}>{statusLabel(selected.status)}</OpsBadge>
                    <button type="button" className="ops-inspector-close" onClick={closeInspector} aria-label="Close pickup details"><X size={16} strokeWidth={1.75} aria-hidden="true"/></button>
                  </>
                )}
              />

              <div className="ops-inspector-scroll">
                <div className="ops-inspector-body">
                  {selected.status !== "picked_up" && selected.status !== "cancelled" ? (
                    <div className="ops-inspector-actions">
                      <OpsButton type="button" variant="secondary" onClick={() => openEditor("appointment")}><CalendarClock size={15} strokeWidth={1.75} aria-hidden="true"/>{selected.status === "unscheduled" ? "Schedule" : "Reschedule"}</OpsButton>
                      {selected.status === "confirmed" || selected.status === "requested" ? (
                        <OpsButton variant="primary" type="button" onClick={() => openEditor("driver")}><UserRound size={15} strokeWidth={1.75} aria-hidden="true"/>Assign driver</OpsButton>
                      ) : selected.status === "driver_assigned" ? (
                        <OpsButton variant="primary" type="button" onClick={() => openEditor("outcome")}><PackageCheck size={15} strokeWidth={1.75} aria-hidden="true"/>Pickup outcome</OpsButton>
                      ) : (
                        <OpsButton variant="primary" type="button" onClick={() => openEditor("appointment")}><CalendarClock size={15} strokeWidth={1.75} aria-hidden="true"/>Set appointment</OpsButton>
                      )}
                    </div>
                  ) : null}

                  {selected.status === "missed" || (pickupNeedsAttention(selected, nowIso) && selected.status !== "picked_up" && selected.status !== "cancelled") ? (
                    <OpsInspectorNote icon={<AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true"/>} title="Attention required">
                      {selected.status === "missed" ? selected.missed_reason || "This pickup was recorded as missed." : "The collection window is missing or overdue."}
                    </OpsInspectorNote>
                  ) : null}

                  {selected.status === "picked_up" || selected.status === "cancelled" ? (
                    <OpsInspectorNote tone={selected.status === "picked_up" ? "success" : "neutral"} icon={selected.status === "picked_up" ? <Check size={14} strokeWidth={1.75} aria-hidden="true"/> : undefined} title={selected.status === "picked_up" ? "Pickup completed" : "Pickup cancelled"}>
                      {selected.status === "picked_up" ? `${dateTime(selected.picked_up_at)}. Live Visibility now owns the movement timeline.` : "This pickup appointment is cancelled."}
                    </OpsInspectorNote>
                  ) : null}

                  {editor === "appointment" && selected.status !== "picked_up" && selected.status !== "cancelled" ? (
                    <OpsInspectorSection tinted title="Appointment" action={<EditorClose label="appointment" onClose={() => setEditor("details")}/>}>
                      <p className="ops-inspector-hint mb-3">Request or confirm the collection window. Times are saved and shown in Nepal time (NPT).</p>
                      <div className="ops-inspector-form">
                        <OpsField label="Window start" className="col-span-full"><input name="pickup-window-start" type="datetime-local" value={windowStart} onChange={(event) => setWindowStart(event.target.value)}/></OpsField>
                        <OpsField label="Window end" className="col-span-full"><input name="pickup-window-end" type="datetime-local" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)}/></OpsField>
                        <OpsField label="Pickup location"><input value={pickupLocation} onChange={(event) => setPickupLocation(event.target.value)} placeholder="Warehouse, factory, terminal…"/></OpsField>
                        <OpsField label="Request channel"><select value={channel} onChange={(event) => setChannel(event.target.value as PickupChannel)}>{pickupChannels.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></OpsField>
                        <OpsField label="Contact name"><input value={contactName} onChange={(event) => setContactName(event.target.value)}/></OpsField>
                        <OpsField label="Contact phone"><input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)}/></OpsField>
                        <OpsField label="Carrier reference"><input value={providerReference} onChange={(event) => setProviderReference(event.target.value)} placeholder="Appointment reference"/></OpsField>
                        <OpsField label="Instructions"><input value={notes} onChange={(event) => setNotes(event.target.value)}/></OpsField>
                      </div>
                      <div className="ops-inspector-actions mt-3">
                        <OpsButton type="button" variant="secondary" disabled={busy || !nepalInputToIso(windowStart) || !nepalInputToIso(windowEnd)} onClick={() => act("schedule", schedulePayload(false))}>Request pickup</OpsButton>
                        <OpsButton variant="primary" type="button" disabled={busy || !nepalInputToIso(windowStart) || !nepalInputToIso(windowEnd)} onClick={() => act(selected.status === "unscheduled" || selected.status === "missed" ? "schedule" : "confirm", selected.status === "unscheduled" || selected.status === "missed" ? schedulePayload(true) : { windowStart: nepalInputToIso(windowStart), windowEnd: nepalInputToIso(windowEnd), providerReference, notes })}>{selected.status === "confirmed" ? "Update appointment" : "Confirm appointment"}</OpsButton>
                      </div>
                    </OpsInspectorSection>
                  ) : null}

                  {editor === "driver" && selected.status !== "picked_up" && selected.status !== "cancelled" ? (
                    <OpsInspectorSection tinted title="Vehicle & driver" action={<EditorClose label="vehicle & driver" onClose={() => setEditor("details")}/>}>
                      <p className="ops-inspector-hint mb-3">Assign the collection resource once the appointment is ready.</p>
                      <div className="ops-inspector-form">
                        <OpsField label="Driver name"><input value={driverName} onChange={(event) => setDriverName(event.target.value)}/></OpsField>
                        <OpsField label="Driver phone"><input value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)}/></OpsField>
                        <OpsField label="Vehicle reference"><input value={vehicleReference} onChange={(event) => setVehicleReference(event.target.value)} placeholder="Truck / plate / vehicle"/></OpsField>
                      </div>
                      <div className="ops-inspector-actions mt-3"><OpsButton variant="primary" type="button" disabled={busy || driverName.trim().length < 2 || selected.status === "unscheduled"} onClick={() => act("assign_driver", { driverName, driverPhone, vehicleReference, notes })}><Truck size={15} strokeWidth={1.75} aria-hidden="true"/>Save driver assignment</OpsButton></div>
                    </OpsInspectorSection>
                  ) : null}

                  {editor === "outcome" && selected.status !== "picked_up" && selected.status !== "cancelled" ? (
                    <OpsInspectorSection tinted title="Pickup outcome" action={<EditorClose label="pickup outcome" onClose={() => setEditor("details")}/>}>
                      <p className="ops-inspector-hint mb-3">Complete the collection or record the operational exception.</p>
                      <div className="ops-inspector-actions">
                        <OpsButton variant="primary" type="button" disabled={busy || selected.status === "unscheduled"} onClick={() => act("picked_up", { eventTime: new Date().toISOString(), location: pickupLocation })}><Check size={15} strokeWidth={1.75} aria-hidden="true"/>Cargo picked up</OpsButton>
                        <OpsButton type="button" variant="danger" disabled={busy || selected.status === "unscheduled" || missedReason.trim().length < 6} onClick={() => act("missed", { reason: missedReason })}><AlertTriangle size={15} strokeWidth={1.75} aria-hidden="true"/>Mark missed</OpsButton>
                        <OpsButton type="button" variant="ghost" disabled={busy || selected.status === "unscheduled"} onClick={() => act("cancel", { note: notes })}>Cancel pickup</OpsButton>
                      </div>
                      <div className="ops-inspector-form mt-3"><OpsField label="Missed-pickup reason" className="col-span-full"><textarea className="ops-textarea" value={missedReason} onChange={(event) => setMissedReason(event.target.value)} placeholder="Carrier no-show, cargo not ready, warehouse closed, documents incomplete…"/></OpsField></div>
                    </OpsInspectorSection>
                  ) : null}

                  <OpsInspectorSection title="Location & route">
                    <OpsFacts>
                      <OpsFact label="Pickup">{selected.pickup_location || selected.origin}</OpsFact>
                      {selected.pickup_location && selected.origin && selected.pickup_location !== selected.origin ? <OpsFact label="Origin">{selected.origin}</OpsFact> : null}
                      <OpsFact label="Destination">{selected.destination}</OpsFact>
                    </OpsFacts>
                  </OpsInspectorSection>

                  <OpsInspectorSection
                    title="Pickup details"
                    action={<OpsButton type="button" size="xs" variant="ghost" onClick={() => openEditor("appointment")}><Pencil size={13} strokeWidth={1.75} aria-hidden="true"/>Edit</OpsButton>}
                  >
                    <OpsFacts>
                      <OpsFact label="Customer">{selected.customer_name}</OpsFact>
                      <OpsFact label="Date & time" warning={!selectedWindowStart}>{selectedWindowStart ? `${dateLabel(selectedWindowStart)} · ${timeLabel(selectedWindowStart)}${selectedWindowEnd ? `–${timeLabel(selectedWindowEnd)}` : ""} NPT` : "Not scheduled"}</OpsFact>
                      <OpsFact label="Carrier">{selected.partner_name || selected.channel.replaceAll("_", " ")}</OpsFact>
                      <OpsFact label="Driver / vehicle">{selected.driver_name ? `${selected.driver_name}${selected.vehicle_reference ? ` · ${selected.vehicle_reference}` : ""}` : "Not assigned"}</OpsFact>
                      <OpsFact label="Contact">{[selected.contact_name, selected.contact_phone].filter(Boolean).join(" · ") || "Not provided"}</OpsFact>
                      <OpsFact label="Reference">{selected.provider_reference || "—"}</OpsFact>
                      <OpsFact label="Instructions">{selected.notes || "—"}</OpsFact>
                      <OpsFact label="Shipment"><Link href={`/admin/jobs/${encodeURIComponent(selected.shipment_reference)}`} className="ops-mono">{selected.shipment_reference}</Link></OpsFact>
                    </OpsFacts>
                  </OpsInspectorSection>

                  <OpsInspectorSection title="Pickup timeline">
                    <ol className="ops-steps">
                      <PickupStep state={selected.status === "unscheduled" ? "current" : "done"} title="Appointment" detail={selectedWindowStart ? `${shortDateTime(selectedWindowStart)} NPT` : "Awaiting pickup window"}/>
                      <PickupStep state={selected.status === "confirmed" || selected.status === "requested" ? "current" : selected.driver_name || selected.status === "driver_assigned" || selected.status === "picked_up" ? "done" : "future"} title="Driver assigned" detail={selected.driver_name ? [selected.driver_name, selected.vehicle_reference].filter(Boolean).join(" · ") : "—"}/>
                      <PickupStep state={selected.status === "picked_up" ? "done" : selected.status === "missed" ? "danger" : selected.status === "driver_assigned" ? "current" : "future"} title="Cargo picked up" detail={selected.picked_up_at ? dateTime(selected.picked_up_at) : selected.status === "missed" ? selected.missed_reason || "Pickup missed" : "—"}/>
                      <PickupStep state={selected.status === "picked_up" ? "done" : "future"} title="Handoff to Live Visibility" detail={selected.status === "picked_up" ? "Movement milestone recorded" : "Begins after pickup completion"}/>
                    </ol>
                  </OpsInspectorSection>
                </div>
              </div>

              <footer className="ops-inspector-footer">
                <Link href={`/admin/jobs/${encodeURIComponent(selected.shipment_reference)}`} className="ops-button" data-variant="secondary" data-size="md"><ExternalLink size={15} strokeWidth={1.75} aria-hidden="true"/>View shipment</Link>
                <button type="button" className="ops-inspector-close" onClick={() => editor === "outcome" ? setEditor("details") : openEditor("outcome")} aria-label="More pickup actions" aria-expanded={editor === "outcome"}><MoreHorizontal size={16} strokeWidth={1.75} aria-hidden="true"/></button>
              </footer>
            </aside>
          ) : null}
        </div>
      </div>
    </OpsPage>
  );
}

function EditorClose({ label, onClose }: { label: string; onClose: () => void }) {
  return <button type="button" className="ops-inspector-close" onClick={onClose} aria-label={`Close ${label} editor`}><X size={14} strokeWidth={1.75} aria-hidden="true"/></button>;
}

const STEP_STATE_LABELS = { done: "Done", current: "Next", future: "", danger: "Missed" } as const;

function PickupStep({ state, title, detail }: { state: "done" | "current" | "future" | "danger"; title: string; detail: string }) {
  return (
    <li className="ops-step" data-state={state}>
      <span className="ops-step-dot" aria-hidden="true"/>
      <span className="ops-step-title">{title}</span>
      <span className="ops-step-state">{STEP_STATE_LABELS[state]}</span>
      <span className="ops-step-detail">{detail}</span>
    </li>
  );
}
