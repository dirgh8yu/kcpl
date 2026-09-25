import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../firebase-admin.server";
import { validateShipmentDocumentBytes } from "../shipment-document-policy";
import { uploadShipmentDocument } from "../shipment-documents.server";
import type { AdminUser } from "./admin-auth";
import { canAccessBranchSet } from "./branch-access-policy";
import {
  OPS_FIELD_NOTE_MAX,
  OPS_FIELD_PHOTO_MAX_BYTES,
  opsFieldDocumentType,
  opsFieldPhotoExtensions,
  opsLookupKey,
  opsLookupScore,
  opsLookupUsable,
} from "./ops-field";
import { checkShipmentBranchAccess } from "./shipment-access.server";
import type { KcplStaffContext } from "./staff-directory.server";

/*
 * Field work from KCPL Ops: a note, with or without a photo, added to a job
 * from wherever the staff member is standing, and finding a job from a
 * scanned container number or barcode.
 *
 * A field note is Job File activity, the same record every other change to a
 * job leaves, so the web timeline shows it with no new surface. A photo is an
 * ordinary staff upload to the job's Document Vault, entering `received` like
 * any other file; the note only points at it. Neither writes shipment status.
 */

export type OpsFieldNote = {
  id: string;
  text: string;
  author: string | null;
  created_at: string;
  photo: { document_id: string | null; filename: string } | null;
};

type Result<T> = { kind: "ok"; value: T } | { kind: "refused"; status: number; code: string; error: string };

const refused = (status: number, code: string, error: string) => ({ kind: "refused" as const, status, code, error });

function extension(filename: string) {
  return filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

export async function addOpsFieldNote(
  reference: string,
  form: FormData,
  { user, staff }: { user: AdminUser; staff: KcplStaffContext },
): Promise<Result<OpsFieldNote>> {
  const normalized = reference.trim().toUpperCase();
  const access = await checkShipmentBranchAccess(normalized, staff);
  if (access.kind === "unavailable") return refused(503, "unavailable", "Job storage is unavailable.");
  if (access.kind === "missing") return refused(404, "missing", "Shipment not found.");
  if (access.kind === "forbidden") return refused(403, "forbidden", "This shipment is outside your branch access.");

  const text = String(form.get("note") ?? "").trim().slice(0, OPS_FIELD_NOTE_MAX);
  const file = form.get("photo");
  const photo = file instanceof File && file.size > 0 ? file : null;
  if (!text && !photo) return refused(400, "invalid", "Write a note or add a photo.");

  let attached: OpsFieldNote["photo"] = null;
  if (photo) {
    const documentType = opsFieldDocumentType(form.get("documentType"));
    if (!documentType) return refused(400, "invalid", "Choose a valid document type.");
    const ext = extension(photo.name);
    const contentType = opsFieldPhotoExtensions[ext];
    if (!contentType) return refused(415, "unsupported", "Send a photo (JPEG, PNG or WEBP) or a PDF.");
    if (photo.size > OPS_FIELD_PHOTO_MAX_BYTES) return refused(413, "too_large", "Photos must be 15 MB or smaller.");
    const data = await photo.arrayBuffer();
    const signatureError = validateShipmentDocumentBytes(ext, new Uint8Array(data));
    if (signatureError) return refused(415, "unsupported", signatureError);

    const upload = await uploadShipmentDocument(normalized, {
      filename: photo.name.trim().slice(0, 240),
      contentType,
      sizeBytes: photo.size,
      documentType,
      uploadedBy: user.displayName,
      uploadedByEmail: user.email,
      data,
    });
    if (upload.kind === "unavailable") return refused(503, "unavailable", "Document storage is unavailable.");
    if (upload.kind === "missing") return refused(404, "missing", "Shipment not found.");
    if (upload.kind === "created" || upload.kind === "duplicate") {
      const document = upload.document as { id?: unknown } | undefined;
      attached = { document_id: document?.id === undefined ? null : String(document.id), filename: photo.name.trim().slice(0, 240) };
    } else {
      return refused(409, "conflict", "The photo could not be filed on this job.");
    }
  }

  if (!firebaseRuntimeConfigured()) return refused(503, "unavailable", "Job storage is unavailable.");
  const now = new Date().toISOString();
  const id = `field-note-${Date.now()}-${randomBytes(4).toString("hex")}`;
  await firebaseAdminDb().collection("shipments").doc(normalized).collection("job_activity").doc(id).create({
    type: "field_note",
    title: attached ? "Field note with photo" : "Field note",
    detail: text || null,
    photo_document_id: attached?.document_id ?? null,
    photo_filename: attached?.filename ?? null,
    source: "kcpl_ops_app",
    actor_name: user.displayName,
    actor_email: user.email,
    created_at: now,
  });
  return { kind: "ok", value: { id, text, author: user.displayName, created_at: now, photo: attached } };
}

/** The newest field notes on a job, for its detail screen. Branch access is
 * the caller's to have checked. */
export async function listOpsFieldNotes(reference: string, limit = 20): Promise<OpsFieldNote[]> {
  if (!firebaseRuntimeConfigured()) return [];
  try {
    // Equality only, so the single-field index serves it; sorted here.
    const snapshot = await firebaseAdminDb()
      .collection("shipments").doc(reference.trim().toUpperCase())
      .collection("job_activity").where("type", "==", "field_note").limit(100).get();
    const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
    return snapshot.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const filename = text(data.photo_filename);
        return {
          id: doc.id,
          text: text(data.detail) ?? "",
          author: text(data.actor_name),
          created_at: String(data.created_at ?? ""),
          photo: filename ? { document_id: text(data.photo_document_id), filename } : null,
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  } catch (error) {
    console.error("KCPL ops field notes could not be listed", error);
    return [];
  }
}

export type OpsLookupMatch = {
  reference: string;
  origin: string | null;
  destination: string | null;
  status: string | null;
  carrier_reference: string | null;
};

/**
 * Jobs a scanned or typed identifier could mean, within the caller's branches.
 * A shipment outside them is not reported at all, so a scan cannot be used to
 * learn that another branch's job exists.
 */
export async function lookupOpsJobs(query: string, staff: KcplStaffContext): Promise<Result<OpsLookupMatch[]>> {
  const key = opsLookupKey(query);
  if (!opsLookupUsable(key)) return refused(400, "invalid", "That is too short to look up.");
  if (!firebaseRuntimeConfigured()) return refused(503, "unavailable", "Job storage is unavailable.");

  const db = firebaseAdminDb();
  const shipments = db.collection("shipments");
  const raw = query.trim().toUpperCase().slice(0, 64);
  // Exact identifiers first (cheap, and they reach jobs of any age), then the
  // recent working set for identifiers stored with spaces or dashes.
  const [direct, byCarrier, byInternal, recent] = await Promise.all([
    shipments.doc(key).get(),
    shipments.where("carrier_reference", "in", [...new Set([raw, key])]).limit(10).get(),
    shipments.where("internal_job_reference", "in", [...new Set([raw, key])]).limit(10).get(),
    shipments.orderBy("updated_at", "desc").limit(450).get(),
  ]);

  const candidates = new Map<string, Record<string, unknown>>();
  for (const doc of [direct, ...byCarrier.docs, ...byInternal.docs, ...recent.docs]) {
    if (doc.exists) candidates.set(doc.id, doc.data() as Record<string, unknown>);
  }

  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const scored: Array<OpsLookupMatch & { score: number }> = [];
  for (const [reference, data] of candidates) {
    if (!canAccessBranchSet(staff, data.primary_branch, data.handling_branches)) continue;
    const score = opsLookupScore(key, {
      reference,
      carrierReference: data.carrier_reference,
      internalReference: data.internal_job_reference,
    });
    if (score === 0) continue;
    scored.push({
      reference,
      origin: text(data.origin),
      destination: text(data.destination),
      status: text(data.status),
      carrier_reference: text(data.carrier_reference),
      score,
    });
  }
  scored.sort((a, b) => b.score - a.score || a.reference.localeCompare(b.reference));
  return {
    kind: "ok",
    value: scored.slice(0, 8).map((match) => ({
      reference: match.reference,
      origin: match.origin,
      destination: match.destination,
      status: match.status,
      carrier_reference: match.carrier_reference,
    })),
  };
}
