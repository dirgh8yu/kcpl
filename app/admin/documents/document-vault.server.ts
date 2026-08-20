import { randomUUID } from "node:crypto";
import {
  firebaseAdminBucket,
  firebaseAdminDb,
  firebaseRuntimeConfigured,
  firebaseStorageBucketName,
} from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { getDigitalJobFile } from "../job-file.server";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import {
  DOCUMENT_MAX_BYTES,
  documentCategories,
  type KcplDocumentCategory,
  type VaultDocument,
} from "./document-vault";

type Actor = { name: string; email: string };

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function categoryValue(value: unknown): KcplDocumentCategory {
  return documentCategories.includes(value as KcplDocumentCategory)
    ? value as KcplDocumentCategory
    : "other";
}

function branchValue(value: unknown): KcplBranch {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : "Kathmandu";
}

function documentFromData(id: string, data: Record<string, unknown>): VaultDocument {
  return {
    id,
    file_name: text(data.file_name, "Document"),
    category: categoryValue(data.category),
    content_type: text(data.content_type, "application/octet-stream"),
    size_bytes: numberValue(data.size_bytes),
    shipment_reference: nullable(data.shipment_reference),
    customer_id: nullable(data.customer_id),
    customer_name: nullable(data.customer_name),
    branch: text(data.branch, "Kathmandu"),
    notes: nullable(data.notes),
    uploaded_at: text(data.uploaded_at),
    uploaded_by_name: text(data.uploaded_by_name, "KCPL Staff"),
    uploaded_by_email: text(data.uploaded_by_email),
    status: data.status === "deleted" ? "deleted" : "current",
    deleted_at: nullable(data.deleted_at),
    deleted_by: nullable(data.deleted_by),
  };
}

function safeFileName(input: string) {
  const normalized = input.normalize("NFKC").replace(/[\\/\u0000-\u001f\u007f]+/g, "-").trim();
  const safe = normalized.replace(/[^a-zA-Z0-9._()\- ]+/g, "-").replace(/\s+/g, " ").slice(0, 160);
  return safe || "document";
}

function cleanReference(value: string) {
  return value.trim().toUpperCase().slice(0, 120);
}

function storageReady() {
  return firebaseRuntimeConfigured() && Boolean(firebaseStorageBucketName());
}

export function documentVaultStorageConfigured() {
  return storageReady();
}

async function customerContext(customerId: string, context: KcplStaffContext) {
  const id = customerId.trim();
  if (!id) return { kind: "missing_customer" as const };
  const snapshot = await firebaseAdminDb().collection("customers").doc(id).get();
  if (!snapshot.exists) return { kind: "missing_customer" as const };
  const branch = branchValue(snapshot.get("primary_branch"));
  if (!staffCanAccessBranch(context, branch)) return { kind: "forbidden" as const };
  return {
    kind: "ready" as const,
    id,
    name: text(snapshot.get("display_name"), id),
    branch,
  };
}

export async function listVaultDocuments(
  context: KcplStaffContext,
  filters: { search?: string; shipment?: string; customer?: string; category?: string } = {},
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const, documents: [] as VaultDocument[] };
  const snapshot = await firebaseAdminDb().collection("documents").orderBy("uploaded_at", "desc").limit(500).get();
  const search = filters.search?.trim().toLowerCase() || "";
  const shipment = cleanReference(filters.shipment || "");
  const customer = filters.customer?.trim() || "";
  const category = documentCategories.includes(filters.category as KcplDocumentCategory)
    ? filters.category as KcplDocumentCategory
    : null;

  const documents = snapshot.docs
    .map((doc) => documentFromData(doc.id, doc.data() as Record<string, unknown>))
    .filter((document) => document.status === "current")
    .filter((document) => staffCanAccessBranch(context, document.branch))
    .filter((document) => !shipment || document.shipment_reference === shipment)
    .filter((document) => !customer || document.customer_id === customer)
    .filter((document) => !category || document.category === category)
    .filter((document) => {
      if (!search) return true;
      return [
        document.file_name,
        document.shipment_reference,
        document.customer_id,
        document.customer_name,
        document.branch,
        document.notes,
        document.uploaded_by_name,
        document.uploaded_by_email,
      ].some((value) => value?.toLowerCase().includes(search));
    });

  return { kind: "ready" as const, documents };
}

export async function uploadVaultDocument(
  input: {
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
    category: string;
    shipmentReference: string;
    customerId: string;
    branch: string;
    notes: string;
  },
  actor: Actor,
  context: KcplStaffContext,
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!storageReady()) return { kind: "storage_unconfigured" as const };
  if (!input.bytes.byteLength || input.bytes.byteLength > DOCUMENT_MAX_BYTES) return { kind: "invalid_size" as const };

  const contentType = input.contentType.trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) return { kind: "invalid_type" as const };
  const category = categoryValue(input.category);
  const shipmentReference = cleanReference(input.shipmentReference);
  const requestedCustomerId = input.customerId.trim();

  let branch: KcplBranch;
  let customerId: string | null = null;
  let customerName: string | null = null;

  if (shipmentReference) {
    if (!context.permissions.canManageJobFile) return { kind: "forbidden" as const };
    const loaded = await getDigitalJobFile(shipmentReference, context);
    if (loaded.kind !== "ready") return loaded;
    branch = loaded.job.primary_branch;
    customerId = loaded.job.customer_id;
    customerName = loaded.job.customer_name;
  } else if (requestedCustomerId) {
    if (!context.permissions.canManageCustomerDocuments) return { kind: "forbidden" as const };
    const customer = await customerContext(requestedCustomerId, context);
    if (customer.kind !== "ready") return customer;
    branch = customer.branch;
    customerId = customer.id;
    customerName = customer.name;
  } else {
    if (!context.permissions.canManageCustomerDocuments) return { kind: "forbidden" as const };
    branch = branchValue(input.branch);
    if (!staffCanAccessBranch(context, branch)) return { kind: "forbidden" as const };
  }

  const db = firebaseAdminDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const fileName = safeFileName(input.fileName);
  const storagePath = `kcpl-documents/${now.slice(0, 4)}/${id}/${fileName}`;
  const bucketFile = firebaseAdminBucket().file(storagePath);

  try {
    await bucketFile.save(Buffer.from(input.bytes), {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: "private, max-age=0, no-store",
        metadata: {
          kcplDocumentId: id,
          shipmentReference: shipmentReference || "",
          customerId: customerId || "",
          branch,
        },
      },
    });
  } catch (error) {
    console.error("KCPL document storage upload failed", error);
    return { kind: "storage_error" as const };
  }

  const documentData = {
    file_name: fileName,
    category,
    content_type: contentType,
    size_bytes: input.bytes.byteLength,
    shipment_reference: shipmentReference || null,
    customer_id: customerId,
    customer_name: customerName,
    branch,
    notes: input.notes.trim().slice(0, 1200) || null,
    storage_path: storagePath,
    storage_bucket: firebaseStorageBucketName(),
    uploaded_at: now,
    uploaded_by_name: actor.name,
    uploaded_by_email: actor.email,
    status: "current",
    deleted_at: null,
    deleted_by: null,
  };

  const documentRef = db.collection("documents").doc(id);
  try {
    await documentRef.create(documentData);
    await documentRef.collection("activity").doc(randomUUID()).create({
      type: "uploaded",
      detail: `Uploaded ${fileName}`,
      actor_name: actor.name,
      actor_email: actor.email,
      created_at: now,
    });

    if (shipmentReference) {
      await db.collection("shipments").doc(shipmentReference).collection("job_activity").doc(randomUUID()).create({
        type: "document_uploaded",
        title: "Document uploaded",
        detail: `${fileName} added to the Digital Job File.`,
        document_id: id,
        created_at: now,
        actor_name: actor.name,
        actor_email: actor.email,
      });
    }
  } catch (error) {
    console.error("KCPL document metadata write failed", error);
    await bucketFile.delete().catch(() => undefined);
    return { kind: "metadata_error" as const };
  }

  return { kind: "created" as const, document: documentFromData(id, documentData) };
}

async function accessibleDocument(id: string, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const ref = firebaseAdminDb().collection("documents").doc(id.trim());
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const data = snapshot.data() as Record<string, unknown>;
  const document = documentFromData(snapshot.id, data);
  if (document.status !== "current") return { kind: "missing" as const };
  if (!staffCanAccessBranch(context, document.branch)) return { kind: "forbidden" as const };
  const storagePath = text(data.storage_path);
  if (!storagePath) return { kind: "missing_blob" as const };
  return { kind: "ready" as const, ref, document, storagePath };
}

export async function downloadVaultDocument(id: string, context: KcplStaffContext) {
  if (!storageReady()) return { kind: "storage_unconfigured" as const };
  const loaded = await accessibleDocument(id, context);
  if (loaded.kind !== "ready") return loaded;
  try {
    const [buffer] = await firebaseAdminBucket().file(loaded.storagePath).download();
    return { kind: "ready" as const, document: loaded.document, bytes: new Uint8Array(buffer) };
  } catch (error) {
    console.error("KCPL document download failed", error);
    return { kind: "missing_blob" as const };
  }
}

export async function deleteVaultDocument(id: string, actor: Actor, context: KcplStaffContext) {
  if (!context.permissions.canManageCustomerDocuments && context.permissions.role !== "management") {
    return { kind: "forbidden" as const };
  }
  const loaded = await accessibleDocument(id, context);
  if (loaded.kind !== "ready") return loaded;
  const now = new Date().toISOString();

  try {
    const file = firebaseAdminBucket().file(loaded.storagePath);
    const [exists] = await file.exists();
    if (exists) await file.delete();
  } catch (error) {
    console.error("KCPL document delete failed", error);
    return { kind: "storage_error" as const };
  }

  await loaded.ref.update({ status: "deleted", deleted_at: now, deleted_by: actor.email });
  await loaded.ref.collection("activity").doc(randomUUID()).create({
    type: "deleted",
    detail: `Deleted ${loaded.document.file_name}`,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });

  if (loaded.document.shipment_reference) {
    await firebaseAdminDb().collection("shipments").doc(loaded.document.shipment_reference).collection("job_activity").doc(randomUUID()).create({
      type: "document_deleted",
      title: "Document deleted",
      detail: `${loaded.document.file_name} removed from the Digital Job File.`,
      document_id: loaded.document.id,
      created_at: now,
      actor_name: actor.name,
      actor_email: actor.email,
    });
  }

  return { kind: "deleted" as const };
}
