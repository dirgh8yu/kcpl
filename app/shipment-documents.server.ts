import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseAdminStorage, firebaseStorageBucketName } from "./firebase-admin.server";
import { shipmentDocumentReviewStatusValue } from "./shipment-document-policy";
import {
  shipmentDocumentTypeLabels,
  type ShipmentDocument,
  type ShipmentDocumentReviewStatus,
  type ShipmentDocumentType,
} from "./shipment-document-types";

type DocumentActor = { name: string; email?: string };
type StoredShipmentDocument = ShipmentDocument & {
  storage_path?: string | null;
  storage_deleted_at?: string | null;
  storage_delete_pending?: boolean;
};

function configured() {
  return Boolean(
    (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
    firebaseStorageBucketName(),
  );
}

function safeFilename(filename: string) {
  const tail = filename.split(/[\\/]/).pop() || "document";
  const cleaned = tail
    .normalize("NFKD")
    .replace(/\p{Cc}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "document";
}

function normalizeReference(reference: string) {
  return reference.trim().toUpperCase();
}

function numericId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function activityId(prefix = "activity") {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shipmentDocumentFromSnapshot(snapshot: FirebaseFirestore.DocumentSnapshot): StoredShipmentDocument {
  const data = snapshot.data() as Record<string, unknown>;
  return {
    id: numberOrNull(data.id) ?? Number(snapshot.id),
    shipment_reference: typeof data.shipment_reference === "string" ? data.shipment_reference : "",
    filename: typeof data.filename === "string" ? data.filename : "Document",
    content_type: typeof data.content_type === "string" ? data.content_type : "application/octet-stream",
    size_bytes: typeof data.size_bytes === "number" ? data.size_bytes : Number(data.size_bytes) || 0,
    document_type: data.document_type as ShipmentDocumentType,
    uploaded_at: typeof data.uploaded_at === "string" ? data.uploaded_at : "",
    uploaded_by: typeof data.uploaded_by === "string" ? data.uploaded_by : "KCPL Staff",
    uploaded_by_email: nullableString(data.uploaded_by_email),
    review_status: shipmentDocumentReviewStatusValue(data.review_status),
    customer_safe: data.customer_safe === true,
    review_note: nullableString(data.review_note),
    reviewed_at: nullableString(data.reviewed_at),
    reviewed_by: nullableString(data.reviewed_by),
    reviewed_by_email: nullableString(data.reviewed_by_email),
    verified_at: nullableString(data.verified_at),
    verified_by: nullableString(data.verified_by),
    verified_by_email: nullableString(data.verified_by_email),
    expires_on: nullableString(data.expires_on),
    supersedes_document_id: numberOrNull(data.supersedes_document_id),
    superseded_by_document_id: numberOrNull(data.superseded_by_document_id),
    deleted_at: nullableString(data.deleted_at),
    deleted_by: nullableString(data.deleted_by),
    deleted_by_email: nullableString(data.deleted_by_email),
    sha256: nullableString(data.sha256),
    storage_path: nullableString(data.storage_path),
    storage_deleted_at: nullableString(data.storage_deleted_at),
    storage_delete_pending: data.storage_delete_pending === true,
  };
}

async function shipmentRef(reference: string) {
  const normalized = normalizeReference(reference);
  const ref = firebaseAdminDb().collection("shipments").doc(normalized);
  const snapshot = await ref.get();
  return snapshot.exists ? { normalized, ref } : null;
}

function storageBucket() {
  return firebaseAdminStorage().bucket(firebaseStorageBucketName());
}

export async function listShipmentDocuments(reference: string, options: { includeDeleted?: boolean } = {}) {
  if (!(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)) {
    return { kind: "unavailable" as const };
  }
  const shipment = await shipmentRef(reference);
  if (!shipment) return { kind: "missing" as const };

  const snapshot = await shipment.ref.collection("documents")
    .orderBy("uploaded_at", "desc")
    .limit(1500)
    .get();
  const documents = snapshot.docs
    .map((doc) => shipmentDocumentFromSnapshot(doc))
    .filter((document) => options.includeDeleted || document.review_status !== "deleted");
  return {
    kind: "ready" as const,
    documents,
    storageAvailable: configured(),
  };
}

export async function getShipmentDocumentMetadata(reference: string, id: number) {
  if (!(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)) return { kind: "unavailable" as const };
  const shipment = await shipmentRef(reference);
  if (!shipment) return { kind: "missing" as const };
  const snapshot = await shipment.ref.collection("documents").doc(String(id)).get();
  if (!snapshot.exists) return { kind: "missing" as const };
  return { kind: "ready" as const, document: shipmentDocumentFromSnapshot(snapshot) };
}

export async function uploadShipmentDocument(
  reference: string,
  values: {
    filename: string;
    contentType: string;
    sizeBytes: number;
    documentType: ShipmentDocumentType;
    uploadedBy: string;
    uploadedByEmail?: string;
    data: ArrayBuffer;
    supersedesDocumentId?: number | null;
  },
) {
  if (!configured()) return { kind: "unavailable" as const };
  const shipment = await shipmentRef(reference);
  if (!shipment) return { kind: "missing" as const };

  const bytes = Buffer.from(values.data);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existingDocuments = await shipment.ref.collection("documents").where("sha256", "==", sha256).limit(10).get();
  const duplicate = existingDocuments.docs
    .map((doc) => shipmentDocumentFromSnapshot(doc))
    .find((document) => !["deleted", "superseded"].includes(document.review_status ?? "received"));
  if (duplicate) return { kind: "duplicate" as const, document: duplicate };

  const id = numericId();
  let supersededSnapshot: FirebaseFirestore.DocumentSnapshot | null = null;
  if (values.supersedesDocumentId) {
    const candidate = await shipment.ref.collection("documents").doc(String(values.supersedesDocumentId)).get();
    if (!candidate.exists) return { kind: "supersedes_missing" as const };
    const oldDocument = shipmentDocumentFromSnapshot(candidate);
    if (oldDocument.document_type !== values.documentType) return { kind: "supersedes_type" as const };
    if (["deleted", "superseded"].includes(oldDocument.review_status ?? "received")) return { kind: "supersedes_inactive" as const };
    supersededSnapshot = candidate;
  }

  const key = `shipments/${shipment.normalized}/${crypto.randomUUID()}-${safeFilename(values.filename)}`;
  const file = storageBucket().file(key);
  await file.save(bytes, {
    resumable: false,
    metadata: {
      contentType: values.contentType,
      cacheControl: "private, no-store",
      metadata: {
        shipmentReference: shipment.normalized,
        originalFilename: values.filename.slice(0, 240),
        sha256,
      },
    },
  });

  const uploadedAt = new Date().toISOString();
  const document: ShipmentDocument = {
    id,
    shipment_reference: shipment.normalized,
    filename: values.filename,
    content_type: values.contentType,
    size_bytes: values.sizeBytes,
    document_type: values.documentType,
    uploaded_at: uploadedAt,
    uploaded_by: values.uploadedBy,
    uploaded_by_email: values.uploadedByEmail || null,
    review_status: "received",
    customer_safe: false,
    review_note: null,
    reviewed_at: null,
    reviewed_by: null,
    reviewed_by_email: null,
    verified_at: null,
    verified_by: null,
    verified_by_email: null,
    expires_on: null,
    supersedes_document_id: supersededSnapshot ? Number(supersededSnapshot.id) : null,
    superseded_by_document_id: null,
    deleted_at: null,
    deleted_by: null,
    deleted_by_email: null,
    sha256,
  };

  try {
    const batch = firebaseAdminDb().batch();
    batch.create(shipment.ref.collection("documents").doc(String(id)), {
      ...document,
      storage_path: key,
      storage_deleted_at: null,
      storage_delete_pending: false,
    });
    if (supersededSnapshot) {
      batch.update(supersededSnapshot.ref, {
        review_status: "superseded",
        superseded_by_document_id: id,
        reviewed_at: uploadedAt,
        reviewed_by: values.uploadedBy,
        reviewed_by_email: values.uploadedByEmail || null,
      });
    }
    batch.create(shipment.ref.collection("job_activity").doc(activityId("document-upload")), {
      type: supersededSnapshot ? "document_superseded" : "document_uploaded",
      title: supersededSnapshot
        ? `${shipmentDocumentTypeLabels[values.documentType]} replacement uploaded`
        : `${shipmentDocumentTypeLabels[values.documentType]} uploaded`,
      detail: values.filename,
      actor_name: values.uploadedBy,
      actor_email: values.uploadedByEmail || null,
      document_type: values.documentType,
      document_id: String(id),
      supersedes_document_id: supersededSnapshot?.id ?? null,
      created_at: uploadedAt,
    });
    batch.update(shipment.ref, { updated_at: uploadedAt });
    await batch.commit();
    return { kind: "created" as const, document };
  } catch (error) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }
}

export async function updateShipmentDocumentControl(reference: string, id: number, values: {
  status: ShipmentDocumentReviewStatus;
  customerSafe: boolean;
  reviewNote: string;
  expiresOn: string;
}, actor: DocumentActor) {
  const shipment = await shipmentRef(reference);
  if (!shipment) return { kind: "missing" as const };
  const ref = shipment.ref.collection("documents").doc(String(id));
  const snapshot = await ref.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const previous = shipmentDocumentFromSnapshot(snapshot);
  const now = new Date().toISOString();
  const verified = values.status === "verified";
  const update = {
    review_status: values.status,
    customer_safe: values.customerSafe,
    review_note: values.reviewNote.trim() || null,
    reviewed_at: now,
    reviewed_by: actor.name,
    reviewed_by_email: actor.email || null,
    verified_at: verified ? now : null,
    verified_by: verified ? actor.name : null,
    verified_by_email: verified ? actor.email || null : null,
    expires_on: values.expiresOn || null,
  };
  const batch = firebaseAdminDb().batch();
  batch.update(ref, update);
  batch.create(shipment.ref.collection("job_activity").doc(activityId("document-review")), {
    type: "document_reviewed",
    title: `${shipmentDocumentTypeLabels[previous.document_type]} ${values.status.replaceAll("_", " ")}`,
    detail: values.reviewNote.trim() || previous.filename,
    actor_name: actor.name,
    actor_email: actor.email || null,
    document_type: previous.document_type,
    document_id: String(id),
    from_status: previous.review_status ?? "received",
    to_status: values.status,
    expires_on: values.expiresOn || null,
    created_at: now,
  });
  batch.update(shipment.ref, { updated_at: now });
  await batch.commit();
  const saved = await ref.get();
  return { kind: "updated" as const, document: shipmentDocumentFromSnapshot(saved) };
}

export async function getShipmentDocumentFile(reference: string, id: number) {
  if (!configured()) return { kind: "unavailable" as const };
  const shipment = await shipmentRef(reference);
  if (!shipment) return { kind: "missing" as const };

  const snapshot = await shipment.ref.collection("documents").doc(String(id)).get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const document = shipmentDocumentFromSnapshot(snapshot);
  if (document.review_status === "deleted") return { kind: "missing" as const };
  if (!document.storage_path) return { kind: "object-missing" as const, document };

  const file = storageBucket().file(document.storage_path);
  const [exists] = await file.exists();
  if (!exists) return { kind: "object-missing" as const, document };
  const [bytes] = await file.download();
  return { kind: "ready" as const, document, bytes };
}

export async function deleteShipmentDocument(reference: string, id: number, actor?: DocumentActor) {
  if (!configured()) return { kind: "unavailable" as const };
  const shipment = await shipmentRef(reference);
  if (!shipment) return { kind: "missing" as const };

  const documentRef = shipment.ref.collection("documents").doc(String(id));
  const snapshot = await documentRef.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const document = shipmentDocumentFromSnapshot(snapshot);
  if (document.review_status === "deleted") return { kind: "deleted" as const, storageDeleted: Boolean(document.storage_deleted_at) };

  const now = new Date().toISOString();
  const batch = firebaseAdminDb().batch();
  batch.update(documentRef, {
    review_status: "deleted",
    deleted_at: now,
    deleted_by: actor?.name || "KCPL Staff",
    deleted_by_email: actor?.email || null,
    reviewed_at: now,
    reviewed_by: actor?.name || "KCPL Staff",
    reviewed_by_email: actor?.email || null,
    storage_delete_pending: true,
  });
  batch.create(shipment.ref.collection("job_activity").doc(activityId("document-delete")), {
    type: "document_deleted",
    title: `${shipmentDocumentTypeLabels[document.document_type]} deleted`,
    detail: document.filename,
    actor_name: actor?.name || "KCPL Staff",
    actor_email: actor?.email || null,
    document_type: document.document_type,
    document_id: String(id),
    created_at: now,
  });
  batch.update(shipment.ref, { updated_at: now });
  await batch.commit();

  let storageDeleted = !document.storage_path;
  if (document.storage_path) {
    try {
      await storageBucket().file(document.storage_path).delete({ ignoreNotFound: true });
      storageDeleted = true;
      await documentRef.update({ storage_deleted_at: new Date().toISOString(), storage_delete_pending: false });
    } catch (error) {
      console.error("KCPL shipment document blob cleanup is pending", error);
      await documentRef.update({ storage_delete_pending: true, storage_delete_failed_at: new Date().toISOString() }).catch(() => undefined);
    }
  }
  return { kind: "deleted" as const, storageDeleted };
}
