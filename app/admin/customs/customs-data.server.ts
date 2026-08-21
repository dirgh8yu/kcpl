import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../../shipment-document-types";
import { shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import { branchAccessSet, canAccessBranchSet, strictBranchValue } from "../branch-access-policy";
import type { KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { buildDocumentIntelligence, type WorkflowDocumentDirection } from "../workflow-defaults";
import { customsDeskRisk, customsDeskState } from "./customs-policy";

export type CustomsDeskStep = {
  id: string;
  title: string;
  detail: string | null;
  branch: KcplBranch;
  completed: boolean;
};

export type CustomsDeskRow = {
  reference: string;
  quote_reference: string;
  customer_name: string;
  origin: string;
  destination: string;
  mode: string;
  status: ShipmentStatus;
  eta: string | null;
  current_location: string | null;
  branch: KcplBranch | null;
  handling_branches: KcplBranch[];
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  customs_required: number;
  customs_completed: number;
  customs_open: number;
  customs_other_branch_open: number;
  open_steps: CustomsDeskStep[];
  customs_integrity_warnings: string[];
  missing_documents: { type: ShipmentDocumentType; label: string; reason: string }[];
  document_required: number;
  document_present: number;
  document_direction: WorkflowDocumentDirection;
  document_advisories: string[];
  state: "blocked" | "in_progress" | "ready" | "clear";
  risk: "critical" | "warning" | "normal";
};

type RawCustomsStep = {
  id: string;
  title: string;
  detail: string | null;
  branch: KcplBranch | null;
  required: boolean;
  completed: boolean;
};

type ShipmentChildren = {
  documents: Set<ShipmentDocumentType>;
  requirements: Map<ShipmentDocumentType, { required: boolean; reason: string }>;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function statusValue(value: unknown): ShipmentStatus {
  return shipmentStatuses.includes(value as ShipmentStatus) ? value as ShipmentStatus : "booking_confirmed";
}

function shipmentIdFromChild(ref: FirebaseFirestore.DocumentReference) {
  return ref.parent.parent?.id ?? "";
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateOnlyMs(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3])
    ? date.getTime()
    : Number.NaN;
}

function daysUntil(value: string | null, today: string) {
  if (!value) return null;
  const target = dateOnlyMs(value.slice(0, 10));
  const current = dateOnlyMs(today);
  return Number.isFinite(target) && Number.isFinite(current) ? Math.round((target - current) / 86_400_000) : null;
}

async function getAllInChunks(refs: FirebaseFirestore.DocumentReference[], size = 200) {
  const db = firebaseAdminDb();
  const snapshots: FirebaseFirestore.DocumentSnapshot[] = [];
  for (let index = 0; index < refs.length; index += size) {
    snapshots.push(...await db.getAll(...refs.slice(index, index + size)));
  }
  return snapshots;
}

async function loadDocumentsAndOverrides(shipmentRefs: FirebaseFirestore.DocumentReference[]) {
  const result = new Map<string, ShipmentChildren>();
  const chunkSize = 30;
  for (let index = 0; index < shipmentRefs.length; index += chunkSize) {
    const chunk = shipmentRefs.slice(index, index + chunkSize);
    const rows = await Promise.all(chunk.map(async (ref) => {
      const [documentsSnapshot, requirementsSnapshot] = await Promise.all([
        ref.collection("documents").get(),
        ref.collection("document_requirements").get(),
      ]);
      const documents = new Set<ShipmentDocumentType>();
      for (const doc of documentsSnapshot.docs) {
        const type = doc.get("document_type") as ShipmentDocumentType;
        if (shipmentDocumentTypeLabels[type]) documents.add(type);
      }
      const requirements = new Map<ShipmentDocumentType, { required: boolean; reason: string }>();
      for (const doc of requirementsSnapshot.docs) {
        const type = (doc.get("document_type") || doc.id) as ShipmentDocumentType;
        if (!shipmentDocumentTypeLabels[type]) continue;
        const source = text(doc.get("source"));
        if (source === "workflow_default" || source === "smart_rule") continue;
        requirements.set(type, {
          required: doc.get("required") === true,
          reason: text(doc.get("reason"), "Shipment-specific requirement"),
        });
      }
      return { id: ref.id, documents, requirements };
    }));
    for (const row of rows) result.set(row.id, { documents: row.documents, requirements: row.requirements });
  }
  return result;
}

export async function listCustomsDeskRows(context: KcplStaffContext): Promise<CustomsDeskRow[] | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const db = firebaseAdminDb();

  const [customsSnapshot, inCustomsSnapshot] = await Promise.all([
    db.collectionGroup("customs_steps").get(),
    db.collection("shipments").where("status", "==", "customs_clearance").get(),
  ]);

  const customs = new Map<string, RawCustomsStep[]>();
  const candidateIds = new Set<string>(inCustomsSnapshot.docs.map((doc) => doc.id));
  for (const doc of customsSnapshot.docs) {
    if (doc.get("required") === false) continue;
    const reference = shipmentIdFromChild(doc.ref);
    if (!reference) continue;
    candidateIds.add(reference);
    const steps = customs.get(reference) ?? [];
    steps.push({
      id: doc.id,
      title: text(doc.get("title"), "Customs step"),
      detail: nullable(doc.get("detail")),
      branch: strictBranchValue(doc.get("branch")),
      required: true,
      completed: doc.get("completed") === true,
    });
    customs.set(reference, steps);
  }

  if (!candidateIds.size) return [];
  const knownCustomsShipments = new Map(inCustomsSnapshot.docs.map((doc) => [doc.id, doc as FirebaseFirestore.DocumentSnapshot]));
  const missingRefs = [...candidateIds]
    .filter((id) => !knownCustomsShipments.has(id))
    .map((id) => db.collection("shipments").doc(id));
  for (const snapshot of await getAllInChunks(missingRefs)) if (snapshot.exists) knownCustomsShipments.set(snapshot.id, snapshot);

  const accessibleShipments = [...knownCustomsShipments.values()].filter((shipment) => {
    if (!shipment.exists) return false;
    const status = statusValue(shipment.get("status"));
    if (status === "delivered") return false;
    return canAccessBranchSet(context, shipment.get("primary_branch"), shipment.get("handling_branches"));
  });
  if (!accessibleShipments.length) return [];

  const quoteIds = [...new Set(accessibleShipments.map((shipment) => nullable(shipment.get("quote_reference"))).filter((value): value is string => Boolean(value)))];
  const customerIds = [...new Set(accessibleShipments.map((shipment) => nullable(shipment.get("customer_id"))).filter((value): value is string => Boolean(value)))];
  const [quoteSnapshots, customerSnapshots, childData] = await Promise.all([
    getAllInChunks(quoteIds.map((id) => db.collection("quotes").doc(id))),
    getAllInChunks(customerIds.map((id) => db.collection("customers").doc(id))),
    loadDocumentsAndOverrides(accessibleShipments.map((shipment) => shipment.ref)),
  ]);
  const quotes = new Map(quoteSnapshots.filter((doc) => doc.exists).map((doc) => [doc.id, doc]));
  const customers = new Map(customerSnapshots.filter((doc) => doc.exists).map((doc) => [doc.id, doc]));

  const today = operationalDate();
  const rows: CustomsDeskRow[] = [];
  for (const shipment of accessibleShipments) {
    const status = statusValue(shipment.get("status"));
    const reference = shipment.id;
    const allSteps = customs.get(reference) ?? [];
    if (!allSteps.length && status !== "customs_clearance") continue;

    const invalidRequiredSteps = allSteps.filter((step) => step.required && !step.branch);
    const openAll = allSteps.filter((step) => step.required && !step.completed);
    const visibleOpen = openAll.filter((step): step is RawCustomsStep & { branch: KcplBranch } => Boolean(
      step.branch && (context.can_access_all_branches || staffCanAccessBranch(context, step.branch)),
    ));
    const hiddenOpen = openAll.filter((step) => step.branch && !visibleOpen.some((visible) => visible.id === step.id)).length;
    const openSteps: CustomsDeskStep[] = visibleOpen.map((step) => ({
      id: step.id,
      title: step.title,
      detail: step.detail,
      branch: step.branch,
      completed: false,
    }));
    const integrityWarnings: string[] = [];
    if (invalidRequiredSteps.length) integrityWarnings.push(`${invalidRequiredSteps.length} required customs step${invalidRequiredSteps.length === 1 ? " has" : "s have"} an invalid or missing branch assignment.`);

    const quoteReference = text(shipment.get("quote_reference"));
    const quote = quotes.get(quoteReference);
    const customerId = nullable(shipment.get("customer_id"));
    const customer = customerId ? customers.get(customerId) : undefined;
    const primary = strictBranchValue(shipment.get("primary_branch"));
    const accessBranches = branchAccessSet(shipment.get("primary_branch"), shipment.get("handling_branches"));
    if (!primary && !accessBranches.length) integrityWarnings.push("Shipment branch ownership is missing or invalid. Management should repair the Job File branch assignment.");

    const mode = text(quote?.get("mode"));
    const origin = text(quote?.get("origin"), "Origin");
    const destination = text(quote?.get("destination"), "Destination");
    const intelligence = buildDocumentIntelligence({
      mode,
      origin,
      destination,
      cargoType: nullable(quote?.get("cargo_type")),
      requirements: nullable(quote?.get("requirements")),
      primaryBranch: primary,
    });
    const child = childData.get(reference) ?? { documents: new Set<ShipmentDocumentType>(), requirements: new Map<ShipmentDocumentType, { required: boolean; reason: string }>() };
    const requirements = new Map(intelligence.requirements.map((item) => [item.documentType, { required: item.required, reason: item.reason }]));
    for (const [type, override] of child.requirements) requirements.set(type, override);
    const requiredEntries = [...requirements.entries()].filter(([, rule]) => rule.required);
    const missing = requiredEntries.filter(([type]) => !child.documents.has(type));
    const eta = nullable(shipment.get("eta"));
    const etaDistance = daysUntil(eta, today);
    if (eta && etaDistance === null) integrityWarnings.push("ETA is invalid and cannot be used for customs urgency calculations.");

    const state = customsDeskState({
      requiredSteps: allSteps.filter((step) => step.required).length,
      openSteps: openAll.length,
      missingDocuments: missing.length,
      integrityIssues: integrityWarnings.length,
      shipmentInCustoms: status === "customs_clearance",
    });
    const risk = customsDeskRisk({
      status,
      openSteps: openAll.length,
      missingDocuments: missing.length,
      integrityIssues: integrityWarnings.length,
      etaDays: etaDistance,
    });

    rows.push({
      reference,
      quote_reference: quoteReference,
      customer_name: text(customer?.get("display_name"), text(quote?.get("company_name"), text(quote?.get("contact_name"), "Customer"))),
      origin,
      destination,
      mode: mode || "Not set",
      status,
      eta,
      current_location: nullable(shipment.get("current_location")),
      branch: primary ?? accessBranches[0] ?? null,
      handling_branches: accessBranches,
      assigned_to_name: nullable(shipment.get("job_assigned_to_name")),
      assigned_to_email: nullable(shipment.get("job_assigned_to_email")),
      customs_required: allSteps.filter((step) => step.required).length,
      customs_completed: allSteps.filter((step) => step.required && step.completed).length,
      customs_open: openAll.length,
      customs_other_branch_open: hiddenOpen,
      open_steps: openSteps,
      customs_integrity_warnings: integrityWarnings,
      missing_documents: missing.map(([type, rule]) => ({ type, label: shipmentDocumentTypeLabels[type], reason: rule.reason })),
      document_required: requiredEntries.length,
      document_present: requiredEntries.length - missing.length,
      document_direction: intelligence.direction,
      document_advisories: intelligence.advisories,
      state,
      risk,
    });
  }

  const riskOrder = { critical: 3, warning: 2, normal: 1 } as const;
  return rows.sort((a, b) => riskOrder[b.risk] - riskOrder[a.risk]
    || b.customs_open - a.customs_open
    || (a.eta ?? "9999-12-31").localeCompare(b.eta ?? "9999-12-31")
    || a.reference.localeCompare(b.reference));
}
