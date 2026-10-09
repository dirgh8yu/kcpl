"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Flag, Upload } from "lucide-react";
import { OpsButton, OpsField, OpsNotice, OpsSurface } from "../../../admin/operations-ui";
import { OpsFileDrop } from "../../../admin/ops-file-drop";
import { partnerMilestonePresets } from "../../partner-access-policy";
import { shipmentDocumentTypeLabels, shipmentDocumentTypes } from "../../../shipment-document-types";

/** What a partner does on a shipment: post where it is, and send its papers. */
export function PartnerShipmentActions({ reference }: { reference: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"milestone" | "document" | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const [title, setTitle] = useState<string>(partnerMilestonePresets[0]);
  const [file, setFile] = useState<File | null>(null);
  const base = `/api/partner/shipments/${encodeURIComponent(reference)}`;

  async function milestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy("milestone"); setNotice(null);
    try {
      const response = await fetch(`${base}/milestones`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, title: title === "other" ? data.customTitle : title }) });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "The milestone didn’t save.");
      setNotice({ text: "Milestone posted. KCPL and the customer can see it.", tone: "success" });
      form.reset(); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "The milestone didn’t save.", tone: "danger" }); }
    finally { setBusy(null); }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData(event.currentTarget);
    form.set("file", file);
    setBusy("document"); setNotice(null);
    try {
      const response = await fetch(`${base}/documents`, { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "The document didn’t upload.");
      setNotice({ text: `${file.name} sent to KCPL.`, tone: "success" });
      setFile(null); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "The document didn’t upload.", tone: "danger" }); }
    finally { setBusy(null); }
  }

  return <OpsSurface title="Update KCPL">
    {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={milestone} className="portal-form" aria-busy={busy === "milestone"}>
        <OpsField label="Milestone"><select value={title} onChange={(event) => setTitle(event.target.value)}>{partnerMilestonePresets.map((preset) => <option key={preset} value={preset}>{preset}</option>)}<option value="other">Something else…</option></select></OpsField>
        {title === "other" ? <OpsField label="What happened"><input name="customTitle" required minLength={3} maxLength={120}/></OpsField> : null}
        <div className="portal-form-grid">
          <OpsField label="Where"><input name="location" maxLength={180} placeholder="Port of Kolkata"/></OpsField>
          <OpsField label="When" hint="Leave blank for now"><input type="datetime-local" name="eventTime"/></OpsField>
        </div>
        <OpsField label="Note" hint="Optional, seen by KCPL and the customer"><input name="details" maxLength={600}/></OpsField>
        <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy !== null}><Flag size={13} aria-hidden="true"/>{busy === "milestone" ? "Posting…" : "Post milestone"}</OpsButton></div>
      </form>
      <form onSubmit={upload} className="portal-form" aria-busy={busy === "document"}>
        <OpsField label="Document type"><select name="documentType" defaultValue="bill_of_lading">{shipmentDocumentTypes.map((type) => <option key={type} value={type}>{shipmentDocumentTypeLabels[type]}</option>)}</select></OpsField>
        <OpsFileDrop prompt="Choose the file" hint="PDF or photo, up to 15 MB" accept="application/pdf,image/jpeg,image/png,image/webp" chosen={file?.name ?? null} onFiles={(files) => setFile(files[0] ?? null)}/>
        <div className="portal-form-actions"><OpsButton type="submit" variant="secondary" size="sm" disabled={busy !== null || !file}><Upload size={13} aria-hidden="true"/>{busy === "document" ? "Sending…" : "Send to KCPL"}</OpsButton></div>
      </form>
    </div>
  </OpsSurface>;
}
