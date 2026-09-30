"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, Send } from "lucide-react";
import type { ShipmentStatus } from "../../../shipment-types";
import { OpsButton, OpsField, OpsNotice, OpsSurface } from "../../operations-ui";

type Editor = null | "details" | "update";

/** Opens the "Post update" form from elsewhere on the Job File (its header). */
export const POST_UPDATE_EVENT = "kcpl:job-post-update";

const suggestedUpdates = ["Picked up", "Departed origin", "Arrived at border", "Crossed the border", "Arrived at destination depot", "Customs cleared"];

/** Where the shipment is and what the customer sees about it: ETA, carrier
 * and location, and tracking updates published to the customer. These used
 * to live only in the enquiry's shipment panel. */
export function MovementControl({
  reference,
  status,
  eta,
  currentLocation,
  carrier,
  carrierReference,
  onChanged,
}: {
  reference: string;
  status: ShipmentStatus;
  eta: string | null;
  currentLocation: string | null;
  carrier: string | null;
  carrierReference: string | null;
  onChanged: (message: string) => void;
}) {
  const [editor, setEditor] = useState<Editor>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const endpoint = `/api/admin/shipments/${encodeURIComponent(reference)}`;
  const updateTitle = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const open = () => setEditor("update");
    window.addEventListener(POST_UPDATE_EVENT, open);
    return () => window.removeEventListener(POST_UPDATE_EVENT, open);
  }, []);
  // The form opens ready to type in; no animation, it is a direct action.
  useEffect(() => { if (editor === "update") updateTitle.current?.focus(); }, [editor]);

  async function send(method: "PATCH" | "POST", body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "That couldn’t be saved. Try again.");
      setEditor(null);
      setTitle("");
      onChanged(message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That couldn’t be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // Status is sent unchanged: this saves details, it never moves the shipment.
    void send("PATCH", {
      status,
      eta: String(form.get("eta") || ""),
      currentLocation: String(form.get("currentLocation") || ""),
      carrier: String(form.get("carrier") || ""),
      carrierReference: String(form.get("carrierReference") || ""),
    }, "Shipment details saved.");
  }

  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void send("POST", {
      title: title.trim(),
      location: String(form.get("location") || ""),
      details: String(form.get("details") || ""),
      eventTime: String(form.get("eventTime") || ""),
    }, "Update published. The customer can see it on tracking.");
  }

  const delivered = status === "delivered";
  // ETA is stored as a date, though older records carry a full timestamp.
  const etaDay = eta ? eta.slice(0, 10) : "";
  const etaLabel = etaDay ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${etaDay}T00:00:00`)) : "";
  return <OpsSurface
    title="Where it is"
    description={[carrier, carrierReference, currentLocation ? `now at ${currentLocation}` : null, etaLabel ? `ETA ${etaLabel}` : null].filter(Boolean).join(" · ") || "No carrier, location or ETA recorded yet."}
    action={editor === null ? <div className="job-form-actions">
      {delivered ? null : <OpsButton variant="secondary" size="xs" onClick={() => setEditor("details")}><Pencil size={12} strokeWidth={1.75} aria-hidden="true"/>Edit details</OpsButton>}
      <OpsButton variant="primary" size="xs" onClick={() => setEditor("update")}><Send size={12} strokeWidth={1.75} aria-hidden="true"/>Post update</OpsButton>
    </div> : null}
  >
    {error ? <div className="mb-3"><OpsNotice tone="danger" onDismiss={() => setError("")}>{error}</OpsNotice></div> : null}

    {editor === "details" ? <form onSubmit={saveDetails} className="job-form job-form-grid job-form-grid-2">
      <OpsField label="Carrier"><input name="carrier" defaultValue={carrier ?? ""} placeholder="Airline, shipping line or transporter"/></OpsField>
      <OpsField label="Carrier reference" hint="AWB, BL, consignment or container number"><input name="carrierReference" defaultValue={carrierReference ?? ""}/></OpsField>
      <OpsField label="Current location"><input name="currentLocation" defaultValue={currentLocation ?? ""} placeholder="e.g. Birgunj ICD"/></OpsField>
      <OpsField label="ETA"><input name="eta" type="date" defaultValue={etaDay}/></OpsField>
      <div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Saving…" : "Save details"}</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setEditor(null)}>Cancel</OpsButton></div>
    </form> : null}

    {editor === "update" ? <form onSubmit={publish} className="job-form job-form-grid job-form-grid-2">
      <OpsField label="What happened" className="job-form-span-all"><input ref={updateTitle} name="title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Departed origin"/></OpsField>
      <div className="job-form-span-all ops-filter-choices" role="group" aria-label="Common updates">
        {suggestedUpdates.map((item) => <button key={item} type="button" className="ops-filter-choice" data-active={title === item || undefined} aria-pressed={title === item} onClick={() => setTitle(item)}>{item}</button>)}
      </div>
      <OpsField label="Where"><input name="location" defaultValue={currentLocation ?? ""}/></OpsField>
      <OpsField label="When" hint="Nepal time. Leave empty for now."><input name="eventTime" type="datetime-local"/></OpsField>
      <OpsField label="Note for the customer" className="job-form-span-all"><textarea name="details" placeholder="Optional. The customer sees this."/></OpsField>
      <div className="job-form-actions job-form-span-all"><OpsButton type="submit" variant="primary" size="sm" disabled={busy || !title.trim()}>{busy ? "Publishing…" : "Publish update"}</OpsButton><OpsButton type="button" variant="ghost" size="sm" onClick={() => setEditor(null)}>Cancel</OpsButton></div>
    </form> : null}

    {editor === null ? <p className="ops-inspector-hint">Updates you post appear on the customer’s tracking page and in this shipment’s History.</p> : null}
  </OpsSurface>;
}
