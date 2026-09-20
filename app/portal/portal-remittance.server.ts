import { createHash } from "node:crypto";
import { firebaseAdminDb, firebaseAdminStorage, firebaseStorageBucketName } from "../firebase-admin.server";

/*
 * Payment remittances.
 *
 * A remittance is finance evidence about an invoice, not shipment paperwork,
 * so it lives under the invoice rather than in the shipment Document Vault.
 * Keeping the two apart matters: the vault's `customer_safe` flag governs what
 * KCPL releases *to* a customer, and a bank receipt flowing the other way has
 * no business inheriting those semantics.
 *
 * Like customer document uploads, a remittance is a claim awaiting review. It
 * never touches the invoice's `amount_paid`, `balance_due` or status -- money
 * is applied by KCPL accounts through the payments path, and a customer saying
 * "I paid" is a document to check, not a ledger entry.
 */

export const REMITTANCE_MAX_BYTES = 10 * 1024 * 1024;

export type PortalRemittance = {
  id: string;
  invoice_reference: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  amount: number | null;
  currency: string | null;
  paid_on: string | null;
  note: string | null;
  uploaded_at: string;
  uploaded_by_email: string;
  review_state: "received" | "acknowledged";
};

function configured() {
  return Boolean(
    (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) && firebaseStorageBucketName(),
  );
}

function storageBucket() {
  return firebaseAdminStorage().bucket(firebaseStorageBucketName());
}

function safeFilename(filename: string) {
  const tail = filename.split(/[\\/]/).pop() || "remittance";
  return tail
    .normalize("NFKD")
    .replace(/\p{Cc}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "remittance";
}

function remittanceFromSnapshot(snapshot: FirebaseFirestore.DocumentSnapshot): PortalRemittance {
  const data = snapshot.data() as Record<string, unknown>;
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
  const amount = typeof data.amount === "number" && Number.isFinite(data.amount) ? data.amount : null;
  return {
    id: snapshot.id,
    invoice_reference: String(data.invoice_reference ?? ""),
    filename: String(data.filename ?? "Remittance"),
    content_type: String(data.content_type ?? "application/octet-stream"),
    size_bytes: typeof data.size_bytes === "number" ? data.size_bytes : 0,
    amount,
    currency: text(data.currency),
    paid_on: text(data.paid_on),
    note: text(data.note),
    uploaded_at: String(data.uploaded_at ?? ""),
    uploaded_by_email: String(data.uploaded_by_email ?? ""),
    review_state: data.review_state === "acknowledged" ? "acknowledged" : "received",
  };
}

export async function listInvoiceRemittances(invoiceReference: string) {
  if (!configured()) return { kind: "unavailable" as const };
  const snapshot = await firebaseAdminDb().collection("invoices").doc(invoiceReference)
    .collection("remittances")
    .limit(50)
    .get();
  const remittances = snapshot.docs
    .map(remittanceFromSnapshot)
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  return { kind: "ready" as const, remittances };
}

export async function saveInvoiceRemittance(input: {
  invoiceReference: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  data: ArrayBuffer;
  amount: number | null;
  currency: string | null;
  paidOn: string | null;
  note: string | null;
  uploadedByEmail: string;
  customerId: string;
}) {
  if (!configured()) return { kind: "unavailable" as const };

  const bytes = Buffer.from(input.data);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const invoiceRef = firebaseAdminDb().collection("invoices").doc(input.invoiceReference);

  // The same file twice is a double submit, not a second payment.
  const duplicate = await invoiceRef.collection("remittances").where("sha256", "==", sha256).limit(1).get();
  if (!duplicate.empty) return { kind: "duplicate" as const, remittance: remittanceFromSnapshot(duplicate.docs[0]) };

  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const key = `invoices/${input.invoiceReference}/remittances/${id}-${safeFilename(input.filename)}`;
  const file = storageBucket().file(key);
  await file.save(bytes, {
    resumable: false,
    metadata: {
      contentType: input.contentType,
      cacheControl: "private, no-store",
      metadata: { invoiceReference: input.invoiceReference, sha256 },
    },
  });

  const uploadedAt = new Date().toISOString();
  try {
    await invoiceRef.collection("remittances").doc(id).create({
      invoice_reference: input.invoiceReference,
      customer_id: input.customerId,
      filename: input.filename,
      content_type: input.contentType,
      size_bytes: input.sizeBytes,
      amount: input.amount,
      currency: input.currency,
      paid_on: input.paidOn,
      note: input.note,
      uploaded_at: uploadedAt,
      uploaded_by_email: input.uploadedByEmail,
      review_state: "received",
      storage_path: key,
      sha256,
    });
    return { kind: "created" as const, id };
  } catch (error) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }
}

export async function invoiceRemittanceFile(invoiceReference: string, id: string) {
  if (!configured()) return { kind: "unavailable" as const };
  const snapshot = await firebaseAdminDb().collection("invoices").doc(invoiceReference)
    .collection("remittances").doc(id).get();
  if (!snapshot.exists) return { kind: "missing" as const };
  const remittance = remittanceFromSnapshot(snapshot);
  const path = snapshot.get("storage_path");
  if (typeof path !== "string" || !path) return { kind: "missing" as const };

  const file = storageBucket().file(path);
  const [exists] = await file.exists();
  if (!exists) return { kind: "missing" as const };
  const [bytes] = await file.download();
  return { kind: "ready" as const, remittance, bytes, customerId: String(snapshot.get("customer_id") ?? "") };
}
