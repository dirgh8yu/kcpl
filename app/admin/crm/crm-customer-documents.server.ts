import { firebaseAdminDb, firebaseAdminStorage, firebaseStorageBucketName } from "../../firebase-admin.server";
import type { CrmCustomerDocument, CrmCustomerDocumentType } from "./crm-customer-document-types";

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

function numericId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function storageBucket() {
  return firebaseAdminStorage().bucket(firebaseStorageBucketName());
}

async function customerRef(customerId: string) {
  const id = customerId.trim().toUpperCase();
  const ref = firebaseAdminDb().collection("customers").doc(id);
  const snapshot = await ref.get();
  return snapshot.exists && snapshot.get("archived") !== true ? { id, ref } : null;
}

export async function listCrmCustomerDocuments(customerId: string) {
  if (!(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)) return { kind: "unavailable" as const };
  const customer = await customerRef(customerId);
  if (!customer) return { kind: "missing" as const };
  const snapshot = await customer.ref.collection("documents").orderBy("uploaded_at", "desc").limit(500).get();
  return {
    kind: "ready" as const,
    documents: snapshot.docs.map((doc) => doc.data() as CrmCustomerDocument),
    storageAvailable: configured(),
  };
}

export async function uploadCrmCustomerDocument(
  customerId: string,
  values: {
    filename: string;
    contentType: string;
    sizeBytes: number;
    documentType: CrmCustomerDocumentType;
    uploadedBy: string;
    uploadedByEmail: string;
    data: ArrayBuffer;
  },
) {
  if (!configured()) return { kind: "unavailable" as const };
  const customer = await customerRef(customerId);
  if (!customer) return { kind: "missing" as const };

  const id = numericId();
  const now = new Date().toISOString();
  const key = `customers/${customer.id}/${crypto.randomUUID()}-${safeFilename(values.filename)}`;
  const file = storageBucket().file(key);
  await file.save(Buffer.from(values.data), {
    resumable: false,
    metadata: {
      contentType: values.contentType,
      cacheControl: "private, no-store",
      metadata: {
        customerId: customer.id,
        originalFilename: values.filename.slice(0, 240),
      },
    },
  });

  const document: CrmCustomerDocument = {
    id,
    customer_id: customer.id,
    filename: values.filename,
    content_type: values.contentType,
    size_bytes: values.sizeBytes,
    document_type: values.documentType,
    uploaded_at: now,
    uploaded_by: values.uploadedBy,
  };

  try {
    const batch = firebaseAdminDb().batch();
    batch.create(customer.ref.collection("documents").doc(String(id)), { ...document, storage_path: key });
    batch.update(customer.ref, { updated_at: now });
    batch.create(customer.ref.collection("activity").doc(`activity-${id}`), {
      type: "customer_document_uploaded",
      title: `Document uploaded: ${values.filename}`,
      detail: values.documentType.replaceAll("_", " "),
      actor_name: values.uploadedBy,
      actor_email: values.uploadedByEmail,
      created_at: now,
    });
    await batch.commit();
    return { kind: "created" as const, document };
  } catch (error) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }
}

export async function getCrmCustomerDocumentFile(customerId: string, id: number) {
  if (!configured()) return { kind: "unavailable" as const };
  const customer = await customerRef(customerId);
  if (!customer) return { kind: "missing" as const };
  const snapshot = await customer.ref.collection("documents").doc(String(id)).get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const document = snapshot.data() as CrmCustomerDocument & { storage_path: string };
  const file = storageBucket().file(document.storage_path);
  const [exists] = await file.exists();
  if (!exists) return { kind: "object-missing" as const, document };
  const [bytes] = await file.download();
  return { kind: "ready" as const, document, bytes };
}

export async function deleteCrmCustomerDocument(customerId: string, id: number, actor: { name: string; email: string }) {
  if (!configured()) return { kind: "unavailable" as const };
  const customer = await customerRef(customerId);
  if (!customer) return { kind: "missing" as const };
  const documentRef = customer.ref.collection("documents").doc(String(id));
  const snapshot = await documentRef.get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const document = snapshot.data() as CrmCustomerDocument & { storage_path: string };
  const now = new Date().toISOString();

  await storageBucket().file(document.storage_path).delete({ ignoreNotFound: true });
  const batch = firebaseAdminDb().batch();
  batch.delete(documentRef);
  batch.update(customer.ref, { updated_at: now });
  batch.create(customer.ref.collection("activity").doc(`activity-delete-${id}-${Date.now()}`), {
    type: "customer_document_deleted",
    title: `Document deleted: ${document.filename}`,
    detail: document.document_type.replaceAll("_", " "),
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  await batch.commit();
  return { kind: "deleted" as const };
}
