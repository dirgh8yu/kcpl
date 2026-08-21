import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import {
  effectiveShipmentDocumentStatus,
  shipmentDocumentReviewStatusValue,
} from "../../shipment-document-policy";
import {
  shipmentDocumentTypeLabels,
  type ShipmentDocumentEffectiveStatus,
  type ShipmentDocumentReviewStatus,
  type ShipmentDocumentType,
} from "../../shipment-document-types";
import { shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import { branchAccessSet, canAccessBranchSet, strictBranchValue } from "../branch-access-policy";
import type { KcplBranch } from "../crm/crm-data";
import type { KcplStaffContext } from "../staff-directory.server";

export type DocumentVaultRow = {
  id: number;
  shipment_reference: string;
  customer_id: string | null;
  customer_name: string;
  branch: KcplBranch | null;
  handling_branches: KcplBranch[];
  shipment_status: ShipmentStatus;
  origin: string;
  destination: string;
  mode: string;
  filename: string;
  document_type: ShipmentDocumentType;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_email: string | null;
  review_status: ShipmentDocumentReviewStatus;
  effective_status: ShipmentDocumentEffectiveStatus;
  customer_safe: boolean;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  verified_at: string | null;
  verified_by: string | null;
  verified_by_email: string | null;
  expires_on: string | null;
  supersedes_document_id: number | null;
  superseded_by_document_id: number | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_by_email: string | null;
  sha256: string | null;
  storage_delete_pending: boolean;
};

export type DocumentVaultDashboard = {
  generated_at: string;
  rows: DocumentVaultRow[];
  active_count: number;
  verified_count: number;
  review_count: number;
  rejected_count: number;
  expired_count: number;
  deleted_count: number;
  cleanup_pending_count: number;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const output = text(value).trim();
  return output || null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusValue(value: unknown): ShipmentStatus {
  return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : "booking_confirmed";
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function getAllInChunks(refs: FirebaseFirestore.DocumentReference[], size = 200) {
  const db = firebaseAdminDb();
  const snapshots: FirebaseFirestore.DocumentSnapshot[] = [];
  for (let index = 0; index < refs.length; index += size) {
    snapshots.push(...await db.getAll(...refs.slice(index, index + size)));
  }
  return snapshots;
}

export async function listDocumentVault(context: KcplStaffContext): Promise<DocumentVaultDashboard | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const db = firebaseAdminDb();
  const documentsSnapshot = await db.collectionGroup("documents").get();
  const shipmentDocumentDocs = documentsSnapshot.docs.filter((doc) => doc.ref.parent.parent?.parent.id === "shipments");
  if (!shipmentDocumentDocs.length) {
    return {
      generated_at: new Date().toISOString(),
      rows: [],
      active_count: 0,
      verified_count: 0,
      review_count: 0,
      rejected_count: 0,
      expired_count: 0,
      deleted_count: 0,
      cleanup_pending_count: 0,
    };
  }

  const shipmentIds = [...new Set(shipmentDocumentDocs.map((doc) => doc.ref.parent.parent?.id).filter((id): id is string => Boolean(id)))];
  const shipmentSnapshots = await getAllInChunks(shipmentIds.map((id) => db.collection("shipments").doc(id)));
  const accessibleShipments = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  for (const shipment of shipmentSnapshots) {
    if (!shipment.exists) continue;
    if (!canAccessBranchSet(context, shipment.get("primary_branch"), shipment.get("handling_branches"))) continue;
    accessibleShipments.set(shipment.id, shipment);
  }
  if (!accessibleShipments.size) {
    return {
      generated_at: new Date().toISOString(),
      rows: [],
      active_count: 0,
      verified_count: 0,
      review_count: 0,
      rejected_count: 0,
      expired_count: 0,
      deleted_count: 0,
      cleanup_pending_count: 0,
    };
  }

  const customerIds = [...new Set([...accessibleShipments.values()].map((shipment) => nullable(shipment.get("customer_id"))).filter((value): value is string => Boolean(value)))];
  const quoteIds = [...new Set([...accessibleShipments.values()].map((shipment) => nullable(shipment.get("quote_reference"))).filter((value): value is string => Boolean(value)))];
  const [customerSnapshots, quoteSnapshots] = await Promise.all([
    getAllInChunks(customerIds.map((id) => db.collection("customers").doc(id))),
    getAllInChunks(quoteIds.map((id) => db.collection("quotes").doc(id))),
  ]);
  const customers = new Map(customerSnapshots.filter((doc) => doc.exists).map((doc) => [doc.id, doc]));
  const quotes = new Map(quoteSnapshots.filter((doc) => doc.exists).map((doc) => [doc.id, doc]));
  const today = operationalDate();

  const rows: DocumentVaultRow[] = [];
  for (const doc of shipmentDocumentDocs) {
    const shipmentReference = doc.ref.parent.parent?.id ?? "";
    const shipment = accessibleShipments.get(shipmentReference);
    if (!shipment) continue;
    const type = doc.get("document_type") as ShipmentDocumentType;
    if (!shipmentDocumentTypeLabels[type]) continue;
    const reviewStatus = shipmentDocumentReviewStatusValue(doc.get("review_status"));
    const expiresOn = nullable(doc.get("expires_on"));
    const customerId = nullable(shipment.get("customer_id"));
    const quoteReference = nullable(shipment.get("quote_reference"));
    const customer = customerId ? customers.get(customerId) : undefined;
    const quote = quoteReference ? quotes.get(quoteReference) : undefined;
    const branches = branchAccessSet(shipment.get("primary_branch"), shipment.get("handling_branches"));
    rows.push({
      id: numberValue(doc.get("id")) || Number(doc.id),
      shipment_reference: shipmentReference,
      customer_id: customerId,
      customer_name: text(customer?.get("display_name"), text(quote?.get("company_name"), text(quote?.get("contact_name"), "Customer"))),
      branch: strictBranchValue(shipment.get("primary_branch")) ?? branches[0] ?? null,
      handling_branches: branches,
      shipment_status: statusValue(shipment.get("status")),
      origin: text(quote?.get("origin"), "Origin"),
      destination: text(quote?.get("destination"), "Destination"),
      mode: text(quote?.get("mode"), "Not set"),
      filename: text(doc.get("filename"), "Document"),
      document_type: type,
      content_type: text(doc.get("content_type"), "application/octet-stream"),
      size_bytes: numberValue(doc.get("size_bytes")),
      uploaded_at: text(doc.get("uploaded_at")),
      uploaded_by: text(doc.get("uploaded_by"), "KCPL Staff"),
      uploaded_by_email: nullable(doc.get("uploaded_by_email")),
      review_status: reviewStatus,
      effective_status: effectiveShipmentDocumentStatus({ status: reviewStatus, expiresOn, today }),
      customer_safe: doc.get("customer_safe") === true,
      review_note: nullable(doc.get("review_note")),
      reviewed_at: nullable(doc.get("reviewed_at")),
      reviewed_by: nullable(doc.get("reviewed_by")),
      reviewed_by_email: nullable(doc.get("reviewed_by_email")),
      verified_at: nullable(doc.get("verified_at")),
      verified_by: nullable(doc.get("verified_by")),
      verified_by_email: nullable(doc.get("verified_by_email")),
      expires_on: expiresOn,
      supersedes_document_id: numberOrNull(doc.get("supersedes_document_id")),
      superseded_by_document_id: numberOrNull(doc.get("superseded_by_document_id")),
      deleted_at: nullable(doc.get("deleted_at")),
      deleted_by: nullable(doc.get("deleted_by")),
      deleted_by_email: nullable(doc.get("deleted_by_email")),
      sha256: nullable(doc.get("sha256")),
      storage_delete_pending: doc.get("storage_delete_pending") === true,
    });
  }

  rows.sort((a, b) => (b.uploaded_at || "").localeCompare(a.uploaded_at || "") || a.shipment_reference.localeCompare(b.shipment_reference));
  const active = rows.filter((row) => !["deleted", "superseded"].includes(row.review_status));
  return {
    generated_at: new Date().toISOString(),
    rows,
    active_count: active.length,
    verified_count: rows.filter((row) => row.effective_status === "verified").length,
    review_count: rows.filter((row) => row.effective_status === "received" || row.effective_status === "under_review").length,
    rejected_count: rows.filter((row) => row.effective_status === "rejected").length,
    expired_count: rows.filter((row) => row.effective_status === "expired").length,
    deleted_count: rows.filter((row) => row.effective_status === "deleted").length,
    cleanup_pending_count: rows.filter((row) => row.storage_delete_pending).length,
  };
}
