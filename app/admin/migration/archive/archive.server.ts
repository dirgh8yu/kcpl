import { createHash, randomBytes, randomUUID } from "node:crypto";
import { firebaseAdminDb, firebaseAdminStorage, firebaseStorageBucketName } from "../../../firebase-admin.server";
import { compatibleRecordBranches } from "../../branch-access-policy";
import { kcplBranches, type KcplBranch } from "../../crm/crm-data";
import { partnerOwnerCompatibleWithBranch } from "../../partners/partner-policy";
import {
  archiveCategories,
  archiveEntityTypes,
  type ArchiveCategory,
  type ArchiveEntityType,
  type PaperArchiveDashboard,
  type PaperArchiveRecord,
} from "./archive-data";

export const PAPER_ARCHIVE_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const paperArchiveAllowedExtensions: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
};

type ArchiveActor = { name: string; email: string };
type ArchiveCreateInput = {
  title: string;
  category: ArchiveCategory;
  documentDate: string | null;
  branch: KcplBranch;
  physicalReference: string | null;
  notes: string | null;
  entityType: ArchiveEntityType;
  entityReference: string | null;
  filename: string;
  contentType: string;
  sizeBytes: number;
  data: ArrayBuffer;
};

type StoredArchiveRecord = PaperArchiveRecord & { storage_path: string };

function firebaseConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

export function paperArchiveStorageAvailable() {
  return Boolean(firebaseConfigured() && firebaseStorageBucketName());
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function entityType(value: unknown): ArchiveEntityType | null {
  return archiveEntityTypes.includes(value as ArchiveEntityType) ? value as ArchiveEntityType : null;
}

function safeFilename(filename: string) {
  const tail = filename.split(/[\\/]/).pop() || "archive-document";
  const cleaned = tail.normalize("NFKD").replace(/\p{Cc}/gu, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140);
  return cleaned || "archive-document";
}

function validDate(value: string | null) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function recordFromSnapshot(id: string, data: FirebaseFirestore.DocumentData): PaperArchiveRecord {
  return {
    id,
    title: text(data.title) || id,
    category: archiveCategories.includes(data.category as ArchiveCategory) ? data.category as ArchiveCategory : "other",
    document_date: text(data.document_date) || null,
    branch: kcplBranches.includes(data.branch as KcplBranch) ? data.branch as KcplBranch : "Kathmandu",
    physical_reference: text(data.physical_reference) || null,
    notes: text(data.notes) || null,
    entity_type: entityType(data.entity_type) ?? "general",
    entity_reference: text(data.entity_reference) || null,
    entity_label: text(data.entity_label) || null,
    filename: text(data.filename) || "Archived document",
    content_type: text(data.content_type) || "application/octet-stream",
    size_bytes: typeof data.size_bytes === "number" ? data.size_bytes : 0,
    sha256: text(data.sha256),
    uploaded_at: text(data.uploaded_at),
    uploaded_by_name: text(data.uploaded_by_name) || "KCPL Management",
    uploaded_by_email: text(data.uploaded_by_email),
    recovery_id: text(data.recovery_id) || null,
    recovery_original_entity_type: entityType(data.recovery_original_entity_type),
    recovery_original_entity_reference: text(data.recovery_original_entity_reference) || null,
    recovery_original_entity_label: text(data.recovery_original_entity_label) || null,
    recovery_relinked_at: text(data.recovery_relinked_at) || null,
    recovery_relinked_by_name: text(data.recovery_relinked_by_name) || null,
    recovery_relinked_by_email: text(data.recovery_relinked_by_email) || null,
  };
}

export async function listPaperArchive(): Promise<PaperArchiveDashboard | null> {
  if (!firebaseConfigured()) return null;
  const snapshot = await firebaseAdminDb().collection("paper_archive").orderBy("uploaded_at", "desc").limit(500).get();
  const records = snapshot.docs.map((doc) => recordFromSnapshot(doc.id, doc.data()));
  return { records, storage_available: paperArchiveStorageAvailable(), total: records.length };
}

async function resolveEntity(entityTypeValue: ArchiveEntityType, rawReference: string | null, archiveBranch: KcplBranch) {
  if (entityTypeValue === "general") return { reference: null, label: null };
  const reference = text(rawReference);
  if (!reference) throw new Error("Choose a linked record reference for this archive item.");

  const collection = entityTypeValue === "customer" ? "customers"
    : entityTypeValue === "shipment" ? "shipments"
      : entityTypeValue === "partner" ? "partners"
        : entityTypeValue === "receivable" ? "invoices"
          : entityTypeValue === "payable" ? "payables"
            : "migration_batches";

  const candidates = [...new Set([reference, reference.toUpperCase()])];
  let snapshot: FirebaseFirestore.DocumentSnapshot | null = null;
  for (const candidate of candidates) {
    const current = await firebaseAdminDb().collection(collection).doc(candidate).get();
    if (current.exists) { snapshot = current; break; }
  }
  if (!snapshot?.exists) throw new Error(`Linked ${entityTypeValue.replaceAll("_", " ")} record ${reference} was not found.`);

  const data = snapshot.data() ?? {};
  const branchCompatible = entityTypeValue === "customer"
    ? compatibleRecordBranches(archiveBranch, data.primary_branch)
    : entityTypeValue === "shipment"
      ? compatibleRecordBranches(archiveBranch, data.primary_branch)
      : entityTypeValue === "partner"
        ? partnerOwnerCompatibleWithBranch(data.owner_branch, archiveBranch)
        : compatibleRecordBranches(archiveBranch, data.branch);
  if (!branchCompatible) throw new Error(`Linked ${entityTypeValue.replaceAll("_", " ")} record ${snapshot.id} belongs to a different or invalid branch.`);

  const label = entityTypeValue === "customer" || entityTypeValue === "partner"
    ? text(data.display_name) || snapshot.id
    : entityTypeValue === "receivable"
      ? text(data.external_invoice_number) || text(data.reference) || snapshot.id
      : entityTypeValue === "payable"
        ? text(data.supplier_bill_reference) || text(data.reference) || snapshot.id
        : entityTypeValue === "migration_batch"
          ? text(data.batch_id) || snapshot.id
          : text(data.reference) || snapshot.id;
  return { reference: snapshot.id, label };
}

export function validatePaperArchiveInput(input: Omit<ArchiveCreateInput, "data">) {
  if (!input.title.trim()) return "Archive title is required.";
  if (input.title.trim().length > 160) return "Archive title must be 160 characters or fewer.";
  if (!archiveCategories.includes(input.category)) return "Choose a valid archive category.";
  if (!archiveEntityTypes.includes(input.entityType)) return "Choose a valid linked-record type.";
  if (!kcplBranches.includes(input.branch)) return "Choose a valid KCPL branch.";
  if (!validDate(input.documentDate)) return "Document date must use YYYY-MM-DD.";
  if (input.filename.length > 240) return "The file name is too long.";
  if (input.sizeBytes <= 0) return "The selected file is empty.";
  if (input.sizeBytes > PAPER_ARCHIVE_MAX_FILE_BYTES) return "Archive files must be 20 MB or smaller.";
  return null;
}

export async function createPaperArchiveRecord(input: ArchiveCreateInput, actor: ArchiveActor) {
  if (!paperArchiveStorageAvailable()) return { kind: "unavailable" as const };
  const validation = validatePaperArchiveInput(input);
  if (validation) return { kind: "invalid" as const, error: validation };

  const linked = await resolveEntity(input.entityType, input.entityReference, input.branch);
  const now = new Date().toISOString();
  const id = `ARC-${now.slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const storagePath = `migration-archive/${id}/${randomUUID()}-${safeFilename(input.filename)}`;
  const file = firebaseAdminStorage().bucket(firebaseStorageBucketName()).file(storagePath);
  const bytes = Buffer.from(input.data);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  await file.save(bytes, {
    resumable: false,
    metadata: {
      contentType: input.contentType,
      cacheControl: "private, no-store",
      metadata: { archiveId: id, originalFilename: input.filename.slice(0, 240), sha256 },
    },
  });

  const stored: StoredArchiveRecord = {
    id,
    title: input.title.trim(),
    category: input.category,
    document_date: input.documentDate,
    branch: input.branch,
    physical_reference: input.physicalReference?.trim() || null,
    notes: input.notes?.trim() || null,
    entity_type: input.entityType,
    entity_reference: linked.reference,
    entity_label: linked.label,
    filename: input.filename,
    content_type: input.contentType,
    size_bytes: input.sizeBytes,
    sha256,
    storage_path: storagePath,
    uploaded_at: now,
    uploaded_by_name: actor.name || "KCPL Management",
    uploaded_by_email: actor.email,
    recovery_id: null,
    recovery_original_entity_type: null,
    recovery_original_entity_reference: null,
    recovery_original_entity_label: null,
    recovery_relinked_at: null,
    recovery_relinked_by_name: null,
    recovery_relinked_by_email: null,
  };

  try {
    await firebaseAdminDb().collection("paper_archive").doc(id).create(stored);
    return { kind: "created" as const, record: recordFromSnapshot(id, stored) };
  } catch (error) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }
}

export async function getPaperArchiveFile(id: string) {
  if (!paperArchiveStorageAvailable()) return { kind: "unavailable" as const };
  const normalized = id.trim().toUpperCase();
  const snapshot = await firebaseAdminDb().collection("paper_archive").doc(normalized).get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const data = snapshot.data() as StoredArchiveRecord;
  if (!data.storage_path) return { kind: "object-missing" as const, record: recordFromSnapshot(snapshot.id, data) };
  const file = firebaseAdminStorage().bucket(firebaseStorageBucketName()).file(data.storage_path);
  const [exists] = await file.exists();
  if (!exists) return { kind: "object-missing" as const, record: recordFromSnapshot(snapshot.id, data) };
  const [bytes] = await file.download();
  return { kind: "ready" as const, record: recordFromSnapshot(snapshot.id, data), bytes };
}
