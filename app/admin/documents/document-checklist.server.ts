import { randomUUID } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import {
  documentCategories,
  documentCategoryLabels,
  type KcplDocumentCategory,
} from "./document-vault";
import {
  defaultDocumentRequirements,
  type DocumentChecklistAlertRow,
  type DocumentChecklistItem,
  type DocumentChecklistSeverity,
  type ShipmentDocumentChecklist,
} from "./document-checklist";

type Actor = { name: string; email: string };

type ShipmentSource = {
  reference: string;
  data: Record<string, unknown>;
  quote: Record<string, unknown>;
  customer: Record<string, unknown>;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function branchValue(value: unknown, fallback: KcplBranch = "Kathmandu"): KcplBranch {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : fallback;
}

function categoryValue(value: unknown): KcplDocumentCategory | null {
  return documentCategories.includes(value as KcplDocumentCategory)
    ? value as KcplDocumentCategory
    : null;
}

function shipmentIdFromChild(ref: FirebaseFirestore.DocumentReference) {
  return ref.parent.parent?.id ?? "";
}

function severityForChecklist(status: string, eta: string | null, missingCount: number): DocumentChecklistSeverity {
  if (!missingCount) return "info";
  const normalizedStatus = status.trim().toLowerCase();
  if (["exception", "customs_clearance", "out_for_delivery", "delivered"].includes(normalizedStatus)) return "critical";
  if (eta) {
    const etaMs = new Date(eta).getTime();
    if (Number.isFinite(etaMs) && etaMs <= Date.now() + 36 * 60 * 60 * 1000) return "critical";
  }
  return "warning";
}

function buildChecklist(
  source: ShipmentSource,
  documentCounts: Map<KcplDocumentCategory, number>,
  overrides: Map<KcplDocumentCategory, boolean>,
): ShipmentDocumentChecklist {
  const status = text(source.data.status, "booking_confirmed");
  const mode = text(source.quote.mode, "Freight");
  const customerId = nullable(source.data.customer_id);
  const branch = branchValue(source.data.primary_branch, branchValue(source.customer.primary_branch));
  const defaults = defaultDocumentRequirements(mode, status);

  const items: DocumentChecklistItem[] = documentCategories.map((category) => {
    const defaultRequired = defaults.has(category);
    const overridden = overrides.has(category);
    const required = overridden ? overrides.get(category) === true : defaultRequired;
    const count = documentCounts.get(category) ?? 0;
    return {
      category,
      label: documentCategoryLabels[category],
      required,
      default_required: defaultRequired,
      overridden,
      present: count > 0,
      document_count: count,
    };
  });

  const requiredItems = items.filter((item) => item.required);
  const presentRequired = requiredItems.filter((item) => item.present);
  const missing = requiredItems.filter((item) => !item.present);
  const completionPercent = requiredItems.length
    ? Math.round((presentRequired.length / requiredItems.length) * 100)
    : 100;

  return {
    shipment_reference: source.reference,
    customer_id: customerId,
    customer_name: nullable(source.customer.display_name) ?? customerId,
    branch,
    mode,
    status,
    eta: nullable(source.data.eta),
    required_count: requiredItems.length,
    present_required_count: presentRequired.length,
    missing_count: missing.length,
    completion_percent: completionPercent,
    severity: severityForChecklist(status, nullable(source.data.eta), missing.length),
    missing_labels: missing.map((item) => item.label),
    items,
  };
}

async function loadSingleShipment(reference: string, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const db = firebaseAdminDb();
  const id = reference.trim().toUpperCase();
  const shipment = await db.collection("shipments").doc(id).get();
  if (!shipment.exists) return { kind: "missing" as const };
  const data = shipment.data() as Record<string, unknown>;
  const quoteReference = text(data.quote_reference);
  const customerId = text(data.customer_id);
  const [quote, customer] = await Promise.all([
    quoteReference ? db.collection("quotes").doc(quoteReference).get() : Promise.resolve(null),
    customerId ? db.collection("customers").doc(customerId).get() : Promise.resolve(null),
  ]);
  const quoteData = quote?.exists ? quote.data() as Record<string, unknown> : {};
  const customerData = customer?.exists ? customer.data() as Record<string, unknown> : {};
  const branch = branchValue(data.primary_branch, branchValue(customerData.primary_branch));
  if (!staffCanAccessBranch(context, branch)) return { kind: "forbidden" as const };
  return {
    kind: "ready" as const,
    source: { reference: id, data, quote: quoteData, customer: customerData } satisfies ShipmentSource,
  };
}

export async function getShipmentDocumentChecklist(reference: string, context: KcplStaffContext) {
  const loaded = await loadSingleShipment(reference, context);
  if (loaded.kind !== "ready") return loaded;
  const db = firebaseAdminDb();
  const [documentsSnapshot, requirementsSnapshot] = await Promise.all([
    db.collection("documents").where("shipment_reference", "==", loaded.source.reference).limit(1000).get(),
    db.collection("shipments").doc(loaded.source.reference).collection("document_requirements").limit(100).get(),
  ]);

  const documentCounts = new Map<KcplDocumentCategory, number>();
  for (const doc of documentsSnapshot.docs) {
    if (doc.get("status") === "deleted") continue;
    const category = categoryValue(doc.get("category"));
    if (!category) continue;
    documentCounts.set(category, (documentCounts.get(category) ?? 0) + 1);
  }

  const overrides = new Map<KcplDocumentCategory, boolean>();
  for (const doc of requirementsSnapshot.docs) {
    const category = categoryValue(doc.get("category") || doc.id);
    if (!category) continue;
    overrides.set(category, doc.get("required") === true);
  }

  return { kind: "ready" as const, checklist: buildChecklist(loaded.source, documentCounts, overrides) };
}

export async function listDocumentChecklistAlerts(
  context: KcplStaffContext,
  filters: { search?: string; includeComplete?: boolean } = {},
) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const, rows: [] as DocumentChecklistAlertRow[] };
  const db = firebaseAdminDb();
  const [shipmentsSnapshot, quotesSnapshot, customersSnapshot, documentsSnapshot, requirementsSnapshot] = await Promise.all([
    db.collection("shipments").limit(2500).get(),
    db.collection("quotes").limit(3000).get(),
    db.collection("customers").limit(3000).get(),
    db.collection("documents").limit(12000).get(),
    db.collectionGroup("document_requirements").limit(10000).get(),
  ]);

  const quotes = new Map(quotesSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const customers = new Map(customersSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const documentCounts = new Map<string, Map<KcplDocumentCategory, number>>();
  for (const doc of documentsSnapshot.docs) {
    if (doc.get("status") === "deleted") continue;
    const shipmentReference = text(doc.get("shipment_reference")).trim().toUpperCase();
    const category = categoryValue(doc.get("category"));
    if (!shipmentReference || !category) continue;
    const shipmentCounts = documentCounts.get(shipmentReference) ?? new Map<KcplDocumentCategory, number>();
    shipmentCounts.set(category, (shipmentCounts.get(category) ?? 0) + 1);
    documentCounts.set(shipmentReference, shipmentCounts);
  }

  const overridesByShipment = new Map<string, Map<KcplDocumentCategory, boolean>>();
  for (const doc of requirementsSnapshot.docs) {
    const shipmentReference = shipmentIdFromChild(doc.ref);
    const category = categoryValue(doc.get("category") || doc.id);
    if (!shipmentReference || !category) continue;
    const overrides = overridesByShipment.get(shipmentReference) ?? new Map<KcplDocumentCategory, boolean>();
    overrides.set(category, doc.get("required") === true);
    overridesByShipment.set(shipmentReference, overrides);
  }

  const needle = filters.search?.trim().toLowerCase() || "";
  const rows: DocumentChecklistAlertRow[] = [];
  for (const shipment of shipmentsSnapshot.docs) {
    const data = shipment.data() as Record<string, unknown>;
    const quoteReference = text(data.quote_reference);
    const customerId = text(data.customer_id);
    const quote = quotes.get(quoteReference) ?? {};
    const customer = customers.get(customerId) ?? {};
    const branch = branchValue(data.primary_branch, branchValue(customer.primary_branch));
    if (!staffCanAccessBranch(context, branch)) continue;

    const checklist = buildChecklist(
      { reference: shipment.id, data, quote, customer },
      documentCounts.get(shipment.id) ?? new Map<KcplDocumentCategory, number>(),
      overridesByShipment.get(shipment.id) ?? new Map<KcplDocumentCategory, boolean>(),
    );
    if (!filters.includeComplete && checklist.missing_count === 0) continue;
    if (needle && ![
      checklist.shipment_reference,
      checklist.customer_name,
      checklist.customer_id,
      checklist.branch,
      checklist.mode,
      checklist.status,
      ...checklist.missing_labels,
    ].some((value) => value?.toLowerCase().includes(needle))) continue;

    rows.push({
      shipment_reference: checklist.shipment_reference,
      customer_id: checklist.customer_id,
      customer_name: checklist.customer_name,
      branch: checklist.branch,
      mode: checklist.mode,
      status: checklist.status,
      eta: checklist.eta,
      required_count: checklist.required_count,
      present_required_count: checklist.present_required_count,
      missing_count: checklist.missing_count,
      completion_percent: checklist.completion_percent,
      severity: checklist.severity,
      missing_labels: checklist.missing_labels,
    });
  }

  const severityScore = (value: DocumentChecklistSeverity) => value === "critical" ? 3 : value === "warning" ? 2 : 1;
  rows.sort((a, b) => severityScore(b.severity) - severityScore(a.severity) || b.missing_count - a.missing_count || a.shipment_reference.localeCompare(b.shipment_reference));
  return { kind: "ready" as const, rows };
}

export async function setShipmentDocumentRequirement(
  reference: string,
  categoryInput: string,
  required: boolean,
  actor: Actor,
  context: KcplStaffContext,
) {
  if (!context.permissions.canManageJobFile) return { kind: "forbidden" as const };
  const category = categoryValue(categoryInput);
  if (!category) return { kind: "invalid_category" as const };
  const loaded = await loadSingleShipment(reference, context);
  if (loaded.kind !== "ready") return loaded;

  const db = firebaseAdminDb();
  const shipmentRef = db.collection("shipments").doc(loaded.source.reference);
  const now = new Date().toISOString();
  await shipmentRef.collection("document_requirements").doc(category).set({
    category,
    required,
    updated_at: now,
    updated_by_name: actor.name,
    updated_by_email: actor.email,
  }, { merge: true });
  await shipmentRef.collection("job_activity").doc(randomUUID()).create({
    type: "document_requirement_updated",
    title: required ? "Document marked required" : "Document marked not required",
    detail: `${documentCategoryLabels[category]} requirement updated by ${actor.name}.`,
    category,
    required,
    actor_name: actor.name,
    actor_email: actor.email,
    created_at: now,
  });
  return getShipmentDocumentChecklist(loaded.source.reference, context);
}
