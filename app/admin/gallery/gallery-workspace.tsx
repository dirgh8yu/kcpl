"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ExternalLink, ImagePlus, Trash2, Upload } from "lucide-react";
import type { GalleryEntry } from "../../site-gallery.server";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsFileDrop, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../operations-ui";
import { maxGalleryBatchSize, uploadGalleryBatch } from "./gallery-upload-queue";

type GalleryResponse = { ok: boolean; item?: GalleryEntry; error?: string };

async function responseData(response: Response): Promise<GalleryResponse> {
  try { return await response.json() as GalleryResponse; }
  catch { return { ok: false, error: "The gallery server did not respond." }; }
}

export function GalleryWorkspace({ initialItems }: { initialItems: GalleryEntry[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "warning" | "danger" } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [publishOnUpload, setPublishOnUpload] = useState(false);
  const [failedFiles, setFailedFiles] = useState<{ file: File; error: string }[]>([]);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function selectFiles(selection: File[]) {
    setFailedFiles([]);
    setProgress(null);
    if (selection.length > maxGalleryBatchSize) {
      setSelectedFiles([]);
      setNotice({ text: `Choose no more than ${maxGalleryBatchSize} images at a time.`, tone: "warning" });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSelectedFiles(selection);
    setNotice(null);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyId || !selectedFiles.length) return;
    const batch = selectedFiles;
    setBusyId("upload");
    setNotice(null);
    setProgress({ completed: 0, total: batch.length });
    try {
      const { uploaded, failed } = await uploadGalleryBatch(batch, async (file) => {
        const form = new FormData();
        form.append("file", file);
        if (publishOnUpload) form.append("published", "true");
        const response = await fetch("/api/admin/gallery", { method: "POST", body: form });
        const data = await responseData(response);
        if (!response.ok || !data.item) throw new Error(data.error || "The image could not be uploaded.");
        return data.item;
      }, (completed, total) => setProgress({ completed, total }));
      setItems((current) => [...uploaded.map(({ item }) => item).reverse(), ...current]);
      setFailedFiles(failed);
      setSelectedFiles(failed.map(({ file }) => file));
      if (inputRef.current) inputRef.current.value = "";
      setNotice(failed.length
        ? { text: `${uploaded.length} ${publishOnUpload ? "published" : "uploaded as drafts"}. ${failed.length} failed and can be retried below.`, tone: "warning" }
        : { text: `${uploaded.length} ${uploaded.length === 1 ? "image" : "images"} ${publishOnUpload ? "published" : "uploaded as drafts"}.`, tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "The images could not be uploaded.", tone: "danger" });
    } finally { setBusyId(null); }
  }

  async function update(item: GalleryEntry, values: { title: string; alt: string; published: boolean }) {
    if (busyId) return;
    setBusyId(item.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/gallery/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
      const data = await responseData(response);
      if (!response.ok || !data.item) throw new Error(data.error || "The image could not be updated.");
      setItems((current) => current.map((entry) => entry.id === item.id ? data.item! : entry));
      setNotice({ text: values.published !== item.published ? (values.published ? "Image published on the public gallery." : "Image removed from the public gallery.") : "Image details saved.", tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "The image could not be updated.", tone: "danger" });
    } finally { setBusyId(null); }
  }

  async function remove(item: GalleryEntry) {
    if (busyId || !window.confirm(`Delete ${item.title ? `“${item.title}”` : "this image"} permanently?`)) return;
    setBusyId(item.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/gallery/${item.id}`, { method: "DELETE" });
      const data = await responseData(response);
      if (!response.ok) throw new Error(data.error || "The image could not be deleted.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice({ text: "Image deleted.", tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "The image could not be deleted.", tone: "danger" });
    } finally { setBusyId(null); }
  }

  return <OpsPage>
    <OpsPageHeader title="Website gallery" description="Upload KCPL photography and choose what appears on the public site." actions={<Link className="ops-button" data-variant="secondary" data-size="md" href="/gallery" target="_blank" rel="noopener noreferrer">View public gallery<ExternalLink size={14} strokeWidth={1.75} aria-hidden="true"/></Link>} />
    <div className="ops-content ops-stack">
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
      <OpsSurface title="Upload images" description="JPG, PNG or WebP, each up to 10 MB and at least 400 × 300 pixels. Location metadata is removed.">
        <form onSubmit={upload} className="site-gallery-upload">
          <OpsFileDrop inputRef={inputRef} name="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busyId === "upload"} prompt="Choose images" hint={`JPG, PNG or WebP · up to ${maxGalleryBatchSize} at a time`} chosen={selectedFiles.length ? `${selectedFiles.length} ${selectedFiles.length === 1 ? "image" : "images"} chosen` : null} onFiles={(files) => selectFiles(files)}/>
          <div className="site-gallery-upload-actions">
            <label className="site-gallery-publish"><input type="checkbox" checked={publishOnUpload} disabled={busyId === "upload"} onChange={(event) => setPublishOnUpload(event.target.checked)} /> Publish immediately</label>
            <OpsButton variant="primary" type="submit" disabled={Boolean(busyId) || selectedFiles.length === 0}><Upload size={14} strokeWidth={1.75} aria-hidden="true"/>{busyId === "upload" ? "Uploading…" : failedFiles.length ? `Retry ${selectedFiles.length} failed` : selectedFiles.length ? `Upload ${selectedFiles.length} ${selectedFiles.length === 1 ? "image" : "images"}` : "Upload images"}</OpsButton>
          </div>
        </form>
        {busyId === "upload" && progress ? <div className="site-gallery-progress" role="status"><span>{progress.completed} of {progress.total} processed</span><progress value={progress.completed} max={progress.total} /></div> : null}
        {failedFiles.length ? <div className="site-gallery-failures"><p>Images needing another attempt</p><ul>{failedFiles.slice(0, 10).map(({ file, error }, index) => <li key={`${file.name}-${file.size}-${index}`}>{file.name}: {error}</li>)}</ul>{failedFiles.length > 10 ? <p>And {failedFiles.length - 10} more.</p> : null}</div> : null}
      </OpsSurface>
      <OpsSurface title="Images">
        {items.length ? <div className="site-gallery-list">{items.map((item) => <GalleryRow key={item.id} item={item} busy={Boolean(busyId)} active={busyId === item.id} onUpdate={update} onDelete={remove} />)}</div> : <OpsEmptyState icon={<ImagePlus size={16} strokeWidth={1.75} aria-hidden="true"/>} title="No gallery images yet" description="Upload the first KCPL photo to prepare it for publication." compact />}
      </OpsSurface>
    </div>
  </OpsPage>;
}

const galleryDate = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Asia/Kathmandu" });

function GalleryRow({ item, busy, active, onUpdate, onDelete }: { item: GalleryEntry; busy: boolean; active: boolean; onUpdate: (item: GalleryEntry, values: { title: string; alt: string; published: boolean }) => void; onDelete: (item: GalleryEntry) => void }) {
  const [title, setTitle] = useState(item.title);
  const [alt, setAlt] = useState(item.alt);
  const changed = title.trim() !== item.title || alt.trim() !== item.alt;
  return <article className="site-gallery-row">
    <div className="site-gallery-preview"><Image src={`/api/admin/gallery/${item.id}/image`} alt={item.alt} width={item.width} height={item.height} unoptimized /></div>
    <div className="site-gallery-row-main">
      <div className="site-gallery-row-heading"><OpsBadge tone={item.published ? "success" : "neutral"} dot>{item.published ? "Published" : "Draft"}</OpsBadge><time dateTime={item.created_at}>Uploaded {galleryDate.format(new Date(item.created_at))}</time></div>
      <div className="site-gallery-row-fields"><OpsField label="Caption (optional)"><input className="ops-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></OpsField><OpsField label="Image description (optional)"><input className="ops-input" value={alt} onChange={(event) => setAlt(event.target.value)} maxLength={220} /></OpsField></div>
      <div className="site-gallery-row-actions">
        <OpsButton size="sm" variant="secondary" disabled={busy || !changed} onClick={() => onUpdate(item, { title: title.trim(), alt: alt.trim(), published: item.published })}>Save details</OpsButton>
        <OpsButton size="sm" variant={item.published ? "secondary" : "primary"} disabled={busy || changed} onClick={() => onUpdate(item, { title: item.title, alt: item.alt, published: !item.published })}>{active ? "Saving…" : item.published ? "Unpublish" : "Publish"}</OpsButton>
        <OpsButton size="sm" variant="danger" disabled={busy} onClick={() => onDelete(item)}><Trash2 size={13} strokeWidth={1.75} aria-hidden="true"/>Delete</OpsButton>
      </div>
    </div>
  </article>;
}
