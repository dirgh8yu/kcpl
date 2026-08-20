import { firebaseAdminDb, firebaseAdminStorage, firebaseStorageBucketName } from "./firebase-admin.server";
import type { ShipmentDocument, ShipmentDocumentType } from "./shipment-document-types";

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

async function shipmentRef(reference: string) {
  const normalized = normalizeReference(reference);
  const ref = firebaseAdminDb().collection("shipments").doc(normalized);
  const snapshot = await ref.get();
  return snapshot.exists ? { normalized, ref } : null;
}

function storageBucket() {
  return firebaseAdminStorage().bucket(firebaseStorageBucketName());
}

export async function listShipmentDocuments(reference: string) {
  if (!(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)) {
    return { kind: "unavailable" as const };
  }
  const shipment = await shipmentRef(reference);
  if (!shipment) return { kind: "missing" as const };

  const snapshot = await shipment.ref.collection("documents")
    .orderBy("uploaded_at", "desc")
    .limit(1000)
    .get();
  return {
    kind: "ready" as const,
    documents: snapshot.docs.map((doc) => doc.data() as ShipmentDocument),
    storageAvailable: configured(),
  };
}

export async function uploadShipmentDocument(
  reference: string,
  values: {
    filename: string;
    contentType: string;
    sizeBytes: number;
    documentType: ShipmentDocumentType;
    uploadedBy: string;
    data: ArrayBuffer;
  },
) {
  if (!configured()) return { kind: "unavailable" as const };
  const shipment = await shipmentRef(reference);
  if (!shipment) return { kind: "missing" as const };

  const id = numericId();
  const key = `shipments/${shipment.normalized}/${crypto.randomUUID()}-${safeFilename(values.filename)}`;
  const file = storageBucket().file(key);
  await file.save(Buffer.from(values.data), {
    resumable: false,
    metadata: {
      contentType: values.contentType,
      cacheControl: "private, no-store",
      metadata: {
        shipmentReference: shipment.normalized,
        originalFilename: values.filename.slice(0, 240),
      },
    },
  });

  const document: ShipmentDocument = {
    id,
    shipment_reference: shipment.normalized,
    filename: values.filename,
    content_type: values.contentType,
    size_bytes: values.sizeBytes,
    document_type: values.documentType,
    uploaded_at: new Date().toISOString(),
    uploaded_by: values.uploadedBy,
  };

  try {
    await shipment.ref.collection("documents").doc(String(id)).create({ ...document, storage_path: key });
    return { kind: "created" as const, document };
  } catch (error) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }
}

export async function getShipmentDocumentFile(reference: string, id: number) {
  if (!configured()) return { kind: "unavailable" as const };
  const shipment = await shipmentRef(reference);
  if (!shipment) return { kind: "missing" as const };

  const snapshot = await shipment.ref.collection("documents").doc(String(id)).get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const document = snapshot.data() as ShipmentDocument & { storage_path: string };

  const file = storageBucket().file(document.storage_path);
  const [exists] = await file.exists();
  if (!exists) return { kind: "object-missing" as const, document };
  const [bytes] = await file.download();
  return { kind: "ready" as const, document, bytes };
}

export async function deleteShipmentDocument(reference: string, id: number) {
  if (!configured()) return { kind: "unavailable" as const };
  const shipment = await shipmentRef(reference);
  if (!shipment) return { kind: "missing" as const };

  const documentRef = shipment.ref.collection("documents").doc(String(id));
  const snapshot = await documentRef.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const document = snapshot.data() as ShipmentDocument & { storage_path: string };

  await storageBucket().file(document.storage_path).delete({ ignoreNotFound: true });
  await documentRef.delete();
  return { kind: "deleted" as const };
}
