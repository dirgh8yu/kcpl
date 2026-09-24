"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ExternalLink, ImagePlus, Trash2, Upload } from "lucide-react";
import type { GalleryEntry } from "../../site-gallery.server";
import { OpsButton, OpsEmptyState, OpsField, OpsPage, OpsPageHeader, OpsSurface } from "../operations-ui";

type GalleryResponse = { ok: boolean; item?: GalleryEntry; error?: string };

async function responseData(response: Response): Promise<GalleryResponse> {
  try { return await response.json() as GalleryResponse; }
  catch { return { ok: false, error: "The gallery server did not respond." }; }
}

export function GalleryWorkspace({ initialItems }: { initialItems: GalleryEntry[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyId) return;
    const form = new FormData(event.currentTarget);
    setBusyId("upload");
    setNotice("");
    try {
      const response = await fetch("/api/admin/gallery", { method: "POST", body: form });
      const data = await responseData(response);
      if (!response.ok || !data.item) throw new Error(data.error || "The image could not be uploaded.");
      setItems((current) => [data.item!, ...current]);
      formRef.current?.reset();
      setNotice("Image uploaded as a draft. Review it below, then publish it.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The image could not be uploaded.");
    } finally { setBusyId(null); }
  }

  async function update(item: GalleryEntry, values: { title: string; alt: string; published: boolean }) {
    if (busyId) return;
    setBusyId(item.id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/gallery/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
      const data = await responseData(response);
      if (!response.ok || !data.item) throw new Error(data.error || "The image could not be updated.");
      setItems((current) => current.map((entry) => entry.id === item.id ? data.item! : entry));
      setNotice(values.published !== item.published ? (values.published ? "Image published on the public gallery." : "Image removed from the public gallery.") : "Image details saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The image could not be updated.");
    } finally { setBusyId(null); }
  }

  async function remove(item: GalleryEntry) {
    if (busyId || !window.confirm(`Delete “${item.title}” permanently?`)) return;
    setBusyId(item.id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/gallery/${item.id}`, { method: "DELETE" });
      const data = await responseData(response);
      if (!response.ok) throw new Error(data.error || "The image could not be deleted.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice("Image deleted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The image could not be deleted.");
    } finally { setBusyId(null); }
  }

  return <OpsPage className="site-gallery-workspace">
    <OpsPageHeader eyebrow="Website" title="Gallery" description="Upload KCPL photography and choose what appears on the public site." actions={<Link className="ops-button" data-variant="secondary" data-size="md" href="/gallery" target="_blank" rel="noopener noreferrer">View public gallery <ExternalLink size={14} /></Link>} />
    <OpsSurface title="Upload image" description="New images start as drafts. JPG, PNG or WebP, up to 10 MB. Location metadata is removed on upload.">
      <form ref={formRef} onSubmit={upload} className="site-gallery-upload">
        <OpsField label="Image" hint="At least 400 × 300 pixels"><input className="ops-input" name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></OpsField>
        <OpsField label="Caption"><input className="ops-input" name="title" type="text" maxLength={120} minLength={2} placeholder="e.g. Project cargo at Kathmandu" required /></OpsField>
        <OpsField label="Image description" hint="Describe what is visible for screen readers and search"><input className="ops-input" name="alt" type="text" maxLength={220} minLength={8} placeholder="e.g. Cargo being secured for road transport" required /></OpsField>
        <OpsButton variant="primary" type="submit" disabled={Boolean(busyId)}><Upload size={14} />{busyId === "upload" ? "Uploading…" : "Upload draft"}</OpsButton>
      </form>
    </OpsSurface>
    {notice ? <p className="site-gallery-notice" role="status">{notice}</p> : null}
    <OpsSurface title="Images" description={`${items.filter((item) => item.published).length} published · ${items.filter((item) => !item.published).length} drafts`}>
      {items.length ? <div className="site-gallery-list">{items.map((item) => <GalleryRow key={item.id} item={item} busy={Boolean(busyId)} active={busyId === item.id} onUpdate={update} onDelete={remove} />)}</div> : <OpsEmptyState icon={<ImagePlus size={20} />} title="No gallery images yet" description="Upload the first KCPL photo to prepare it for publication." compact />}
    </OpsSurface>
  </OpsPage>;
}

function GalleryRow({ item, busy, active, onUpdate, onDelete }: { item: GalleryEntry; busy: boolean; active: boolean; onUpdate: (item: GalleryEntry, values: { title: string; alt: string; published: boolean }) => void; onDelete: (item: GalleryEntry) => void }) {
  const [title, setTitle] = useState(item.title);
  const [alt, setAlt] = useState(item.alt);
  const changed = title.trim() !== item.title || alt.trim() !== item.alt;
  return <article className="site-gallery-row">
    <div className="site-gallery-preview"><Image src={`/api/admin/gallery/${item.id}/image`} alt={item.alt} width={item.width} height={item.height} unoptimized /></div>
    <div className="site-gallery-row-main">
      <div className="site-gallery-row-heading"><span className="site-gallery-state" data-published={item.published}>{item.published ? "Published" : "Draft"}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString("en-NP", { year: "numeric", month: "short", day: "numeric" })}</time></div>
      <div className="site-gallery-row-fields"><OpsField label="Caption"><input className="ops-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></OpsField><OpsField label="Image description"><input className="ops-input" value={alt} onChange={(event) => setAlt(event.target.value)} maxLength={220} /></OpsField></div>
      <div className="site-gallery-row-actions">
        <OpsButton size="sm" variant="secondary" disabled={busy || !changed} onClick={() => onUpdate(item, { title: title.trim(), alt: alt.trim(), published: item.published })}>Save details</OpsButton>
        <OpsButton size="sm" variant={item.published ? "secondary" : "primary"} disabled={busy || changed} onClick={() => onUpdate(item, { title: item.title, alt: item.alt, published: !item.published })}>{active ? "Saving…" : item.published ? "Unpublish" : "Publish"}</OpsButton>
        <OpsButton size="sm" variant="danger" disabled={busy} onClick={() => onDelete(item)}><Trash2 size={13} />Delete</OpsButton>
      </div>
    </div>
  </article>;
}
