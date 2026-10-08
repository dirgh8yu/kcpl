"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, CalendarClock, Check } from "lucide-react";
import { OpsButton, OpsField, OpsNotice, OpsSurface } from "../../operations-ui";
import { nepalDateTime, nepalInputToIso } from "../../nepal-time";
import { pickupAppointmentStatusLabels } from "../../pickups/pickup-appointments";
import type { JobPickup } from "./job-step-context.server";

type Editor = null | "book" | "driver" | "missed";

/** The Pickup step in the Job File: book it, confirm it, give it a driver,
 * mark it collected. The Pickups page keeps the full desk (channels, provider
 * references, cancellations); this covers the everyday path in place. */
export function PickupControl({ reference, pickup, stepDone, onChanged }: { reference: string; pickup: JobPickup | null; stepDone: boolean; onChanged: (message: string) => void }) {
  // The booking form opens by itself only while pickup is still to be done.
  const [editor, setEditor] = useState<Editor>(pickup || stepDone ? null : "book");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = pickup?.status ?? null;
  const open = status === "requested" || status === "confirmed" || status === "driver_assigned";
  const canBook = !status || status === "unscheduled" || status === "missed";

  async function act(action: string, extra: Record<string, unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/pickups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reference, ...extra }),
      });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The pickup couldn’t be saved. Try again.");
      setEditor(null);
      onChanged(message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The pickup couldn’t be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const day = String(form.get("day") || "");
    const windowStart = nepalInputToIso(`${day}T${String(form.get("from") || "")}`);
    const windowEnd = nepalInputToIso(`${day}T${String(form.get("to") || "")}`);
    if (!windowStart || !windowEnd || windowEnd <= windowStart) { setError("Choose a day and a time window that ends after it starts."); return; }
    const confirmed = form.get("confirmed") === "on";
    void act("schedule", {
      windowStart,
      windowEnd,
      pickupLocation: String(form.get("location") || ""),
      contactName: String(form.get("contactName") || ""),
      contactPhone: String(form.get("contactPhone") || ""),
      notes: String(form.get("notes") || ""),
      channel: "manual",
      confirmed,
    }, confirmed ? "Pickup booked and confirmed." : "Pickup requested.");
  }

  function driver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void act("assign_driver", {
      driverName: String(form.get("driverName") || ""),
      driverPhone: String(form.get("driverPhone") || ""),
      vehicleReference: String(form.get("vehicle") || ""),
    }, "Driver saved.");
  }

  function missed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") || "").trim();
    if (reason.length < 4) { setError("Say briefly why the pickup was missed."); return; }
    void act("missed", { reason }, "Missed pickup recorded. A problem was opened so it gets followed up.");
  }

  return <OpsSurface
    title="Pickup"
    description={status ? pickupAppointmentStatusLabels[status] : stepDone ? "The cargo is already moving; no pickup was booked here." : undefined}
    action={<Link className="ops-button" data-variant="ghost" data-size="xs" href={`/admin/pickups?shipment=${encodeURIComponent(reference)}`}>All pickup options<ArrowRight size={12} strokeWidth={1.75} aria-hidden="true"/></Link>}
  >
    {pickup && status !== "unscheduled" ? <dl className="job-pickup-facts">
      {pickup.window_start ? <div><dt>When</dt><dd>{nepalDateTime(pickup.window_start)}{pickup.window_end ? ` – ${nepalDateTime(pickup.window_end).split(", ").pop()}` : ""}</dd></div> : null}
      {pickup.location ? <div><dt>From</dt><dd>{pickup.location}</dd></div> : null}
      {pickup.contact_name || pickup.contact_phone ? <div><dt>Contact</dt><dd>{[pickup.contact_name, pickup.contact_phone].filter(Boolean).join(" · ")}</dd></div> : null}
      {pickup.driver_name ? <div><dt>Driver</dt><dd>{[pickup.driver_name, pickup.driver_phone, pickup.vehicle_reference].filter(Boolean).join(" · ")}</dd></div> : null}
      {status === "missed" && pickup.missed_reason ? <div><dt>Missed</dt><dd>{pickup.missed_reason}</dd></div> : null}
    </dl> : null}

    {error ? <div className="mb-3"><OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice></div> : null}

    {open && editor === null ? <div className="job-form-actions">
      {status === "requested" ? <OpsButton variant="primary" size="sm" disabled={busy} onClick={() => void act("confirm", { windowStart: pickup?.window_start ?? "", windowEnd: pickup?.window_end ?? "" }, "Pickup confirmed.")}><Check size={13} strokeWidth={1.75} aria-hidden="true"/>Mark confirmed</OpsButton> : null}
      {status !== "requested" ? <OpsButton variant="primary" size="sm" disabled={busy} onClick={() => void act("picked_up", { location: pickup?.location ?? "" }, "Picked up. Tracking is updated.")}><Check size={13} strokeWidth={1.75} aria-hidden="true"/>Mark picked up</OpsButton> : null}
      <OpsButton variant="secondary" size="sm" disabled={busy} onClick={() => setEditor("driver")}>{pickup?.driver_name ? "Change driver" : "Assign driver"}</OpsButton>
      <OpsButton variant="ghost" size="sm" disabled={busy} onClick={() => setEditor("missed")}>Missed…</OpsButton>
    </div> : null}

    {canBook && editor === null ? <OpsButton variant={stepDone ? "secondary" : "primary"} size="sm" onClick={() => setEditor("book")}><CalendarClock size={13} strokeWidth={1.75} aria-hidden="true"/>{status === "missed" ? "Book it again" : "Book a pickup"}</OpsButton> : null}

    {editor === "book" && canBook ? <form onSubmit={book} className="job-form job-form-grid">
      <OpsField label="Day"><input name="day" type="date" required/></OpsField>
      <OpsField label="From"><input name="from" type="time" required defaultValue="10:00"/></OpsField>
      <OpsField label="To"><input name="to" type="time" required defaultValue="13:00"/></OpsField>
      <OpsField label="Pick up from" className="job-form-span-all"><input name="location" required defaultValue={pickup?.location ?? ""} placeholder="Factory or warehouse address"/></OpsField>
      <OpsField label="Contact at pickup"><input name="contactName" defaultValue={pickup?.contact_name ?? ""}/></OpsField>
      <OpsField label="Contact phone"><input name="contactPhone" type="tel" defaultValue={pickup?.contact_phone ?? ""}/></OpsField>
      <OpsField label="Notes" className="job-form-span-all"><textarea name="notes" placeholder="Gate pass, loading bay, anything the driver should know"/></OpsField>
      <label className="job-form-check job-form-span-all"><input name="confirmed" type="checkbox"/> Already confirmed with the shipper</label>
      <p className="ops-inspector-hint job-form-span-all">Times are Nepal time.</p>
      <div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Saving…" : "Book pickup"}</OpsButton>{pickup ? <OpsButton type="button" variant="ghost" size="sm" onClick={() => setEditor(null)}>Cancel</OpsButton> : null}</div>
    </form> : null}

    {editor === "driver" ? <form onSubmit={driver} className="job-form job-form-grid">
      <OpsField label="Driver"><input name="driverName" required defaultValue={pickup?.driver_name ?? ""}/></OpsField>
      <OpsField label="Driver phone"><input name="driverPhone" type="tel" defaultValue={pickup?.driver_phone ?? ""}/></OpsField>
      <OpsField label="Vehicle"><input name="vehicle" defaultValue={pickup?.vehicle_reference ?? ""} placeholder="Number plate"/></OpsField>
      <div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Saving…" : "Save driver"}</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setEditor(null)}>Cancel</OpsButton></div>
    </form> : null}

    {editor === "missed" ? <form onSubmit={missed} className="job-form">
      <OpsField label="Why was it missed?"><input name="reason" required placeholder="e.g. Cargo not ready, gate closed"/></OpsField>
      <div className="job-form-actions mt-2"><OpsButton type="submit" variant="danger" size="sm" disabled={busy}>{busy ? "Saving…" : "Record missed pickup"}</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setEditor(null)}>Cancel</OpsButton></div>
    </form> : null}
  </OpsSurface>;
}
