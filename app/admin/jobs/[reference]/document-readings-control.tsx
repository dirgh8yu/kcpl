"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ScanText } from "lucide-react";
import { OpsBadge, OpsButton, OpsMono, OpsNotice } from "../../operations-ui";
import type { ShipmentDocument } from "../../../shipment-document-types";
import { READABLE_MAX_BYTES, readableContentTypes, readableDocumentTypeLabels } from "../../../document-reading";
import type { StoredReading } from "../../document-reading.server";

/*
 * Shipping documents read by Claude, under the Documents list: what was found
 * in each, and a short form to apply the parts staff agree with. Nothing is
 * written to the shipment until they press Apply.
 */

function readable(document: ShipmentDocument) {
  const type = document.content_type.split(";")[0].trim().toLowerCase();
  return (readableContentTypes as readonly string[]).includes(type) && document.size_bytes <= READABLE_MAX_BYTES && document.review_status !== "deleted";
}

export function DocumentReadingsControl({ reference, documents, readings, configured, canEdit }: {
  reference: string;
  documents: ShipmentDocument[];
  readings: StoredReading[];
  configured: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" | "warning" } | null>(null);
  const readIds = new Set(readings.map((reading) => reading.document_id));
  const candidates = documents.filter((document) => readable(document) && !readIds.has(document.id));
  const base = `/api/admin/jobs/${encodeURIComponent(reference)}/documents`;

  async function read(document: ShipmentDocument) {
    setBusy(document.id); setNotice(null);
    try {
      const response = await fetch(`${base}/${document.id}/read`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The document couldn’t be read.");
      setNotice({ text: `${document.filename} read. Check what was found below, then apply what’s right.`, tone: "success" });
      router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "The document couldn’t be read.", tone: "danger" }); }
    finally { setBusy(null); }
  }

  async function apply(event: FormEvent<HTMLFormElement>, reading: StoredReading) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { carrier: form.get("carrier") === "on", carrierReference: form.get("carrierReference") === "on", eta: form.get("eta") === "on", containers: form.get("containers") === "on" };
    if (!Object.values(body).some(Boolean)) { setNotice({ text: "Tick what to apply first.", tone: "warning" }); return; }
    setBusy(reading.document_id); setNotice(null);
    try {
      const response = await fetch(`${base}/${reading.document_id}/apply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; fields?: string[]; containersAdded?: number };
      if (!response.ok || !data.ok) throw new Error(data.error || "The details couldn’t be applied.");
      const parts = [...(data.fields ?? []).map((field) => field.replace("_", " ")), data.containersAdded ? `${data.containersAdded} container${data.containersAdded === 1 ? "" : "s"}` : ""].filter(Boolean);
      setNotice({ text: parts.length ? `Applied: ${parts.join(", ")}.` : "Nothing new to apply: the shipment already has these.", tone: "success" });
      router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "The details couldn’t be applied.", tone: "danger" }); }
    finally { setBusy(null); }
  }

  if (!readings.length && !candidates.length) return null;
  return <div className="doc-readings">
    <p className="ops-field-label">Read from documents</p>
    {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
    {!configured && canEdit && candidates.length ? <p className="ops-inspector-hint">Reading documents automatically isn’t set up on this server yet. Management can turn it on by adding an Anthropic API key to the server’s settings.</p> : null}
    {configured && canEdit && candidates.length ? <ul className="doc-readings-candidates">
      {candidates.slice(0, 6).map((document) => <li key={document.id}>
        <span className="min-w-0 truncate">{document.filename}</span>
        <OpsButton variant="secondary" size="xs" disabled={busy !== null} onClick={() => read(document)}><ScanText size={13} strokeWidth={1.75} aria-hidden="true"/>{busy === document.id ? "Reading…" : "Read it"}</OpsButton>
      </li>)}
    </ul> : null}

    {readings.map((reading) => {
      const invalid = reading.containers.filter((item) => !item.valid);
      const isTransport = reading.document_type !== "commercial_invoice" && reading.document_type !== "packing_list";
      return <details key={reading.document_id} className="doc-reading" open={!reading.applied_at}>
        <summary>
          <span className="min-w-0"><strong>{readableDocumentTypeLabels[reading.document_type]}</strong>{reading.document_number ? <> · <OpsMono>{reading.document_number}</OpsMono></> : null}<span className="doc-reading-file"> · {reading.filename}</span></span>
          <OpsBadge tone={reading.applied_at ? "success" : "info"}>{reading.applied_at ? "Applied" : "To review"}</OpsBadge>
        </summary>
        <dl className="doc-reading-fields">
          {[
            ["Shipper", reading.shipper], ["Consignee", reading.consignee], ["Carrier", reading.carrier],
            ["Vessel / voyage", [reading.vessel, reading.voyage].filter(Boolean).join(" / ") || null],
            ["From", reading.port_of_loading], ["To", reading.port_of_discharge ?? reading.place_of_delivery],
            ["Shipped on", reading.shipped_on], ["ETA", reading.eta],
            ["Packages", reading.packages !== null ? String(reading.packages) : null],
            ["Gross weight", reading.gross_weight_kg !== null ? `${reading.gross_weight_kg} kg` : null],
            ["Volume", reading.volume_cbm !== null ? `${reading.volume_cbm} m³` : null],
            ["Invoice", reading.invoice_total !== null ? `${reading.currency ?? ""} ${reading.invoice_total}${reading.incoterm ? ` ${reading.incoterm}` : ""}`.trim() : null],
            ["Goods", reading.goods_description],
          ].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {reading.containers.length ? <p className="doc-reading-line">Containers: {reading.containers.map((item) => <span key={item.number} className={item.valid ? undefined : "doc-reading-invalid"}><OpsMono>{item.number}</OpsMono>{item.size_type ? ` ${item.size_type}` : ""}{item.valid ? "" : " (check digit wrong)"} </span>)}</p> : null}
        {reading.lines.some((line) => line.hs_code) ? <p className="doc-reading-line">{reading.lines.filter((line) => line.hs_code).length} line{reading.lines.filter((line) => line.hs_code).length === 1 ? "" : "s"} with HS codes: the duty estimate under Customs starts from them.</p> : null}
        {reading.notes ? <p className="doc-reading-line">Note from the reader: {reading.notes}</p> : null}
        {invalid.length ? <OpsNotice tone="warning">{invalid.length} container number{invalid.length === 1 ? "" : "s"} failed the check digit and won’t be added. Check them against the document.</OpsNotice> : null}
        {canEdit ? <form className="doc-reading-apply" onSubmit={(event) => apply(event, reading)}>
          {reading.carrier ? <label><input type="checkbox" name="carrier" defaultChecked={!reading.applied_at}/>Carrier: {reading.carrier}</label> : null}
          {isTransport && reading.document_number ? <label><input type="checkbox" name="carrierReference" defaultChecked={!reading.applied_at}/>Carrier reference: {reading.document_number}</label> : null}
          {reading.eta ? <label><input type="checkbox" name="eta"/>ETA: {reading.eta}</label> : null}
          {reading.containers.some((item) => item.valid) ? <label><input type="checkbox" name="containers" defaultChecked={!reading.applied_at}/>Add {reading.containers.filter((item) => item.valid).length} container{reading.containers.filter((item) => item.valid).length === 1 ? "" : "s"}</label> : null}
          {reading.carrier || (isTransport && reading.document_number) || reading.eta || reading.containers.some((item) => item.valid)
            ? <OpsButton type="submit" variant="primary" size="xs" disabled={busy !== null}>{busy === reading.document_id ? "Applying…" : "Apply ticked"}</OpsButton>
            : <span className="ops-inspector-hint">Nothing here to put on the shipment.</span>}
          {configured ? <OpsButton type="button" variant="ghost" size="xs" disabled={busy !== null} onClick={() => { const document = documents.find((item) => item.id === reading.document_id); if (document) void read(document); }}>Read again</OpsButton> : null}
        </form> : null}
        <p className="ops-inspector-hint">Read by Claude for {reading.read_by_name}. Check against the document before applying.</p>
      </details>;
    })}
  </div>;
}
