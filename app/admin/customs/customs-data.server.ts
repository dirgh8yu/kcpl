import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { shipmentDocumentTypeLabels, type ShipmentDocumentType } from "../../shipment-document-types";
import { shipmentStatuses, type ShipmentStatus } from "../../shipment-types";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { staffCanAccessBranch, type KcplStaffContext } from "../staff-directory.server";
import { defaultDocumentRequirements } from "../workflow-defaults";

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
  open_steps: CustomsDeskStep[];
  missing_documents: { type: ShipmentDocumentType; label: string }[];
  document_required: number;
  document_present: number;
  state: "blocked" | "in_progress" | "ready" | "clear";
  risk: "critical" | "warning" | "normal";
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullable(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function branchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
}

function branchList(value: unknown) {
  if (!Array.isArray(value)) return [] as KcplBranch[];
  return [...new Set(value.filter((item): item is KcplBranch => kcplBranches.includes(item as KcplBranch)))];
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
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function daysUntil(value: string | null, today: string) {
  if (!value) return null;
  const target = dateOnlyMs(value.slice(0, 10));
  const current = dateOnlyMs(today);
  return Number.isFinite(target) && Number.isFinite(current) ? Math.round((target - current) / 86_400_000) : null;
}

export async function listCustomsDeskRows(context: KcplStaffContext): Promise<CustomsDeskRow[] | null> {
  if (!firebaseRuntimeConfigured()) return null;
  const db = firebaseAdminDb();
  const [shipmentsSnapshot, quotesSnapshot, customersSnapshot, customsSnapshot, documentsSnapshot, requirementsSnapshot] = await Promise.all([
    db.collection("shipments").limit(2500).get(),
    db.collection("quotes").limit(3000).get(),
    db.collection("customers").limit(3000).get(),
    db.collectionGroup("customs_steps").limit(10000).get(),
    db.collectionGroup("documents").limit(15000).get(),
    db.collectionGroup("document_requirements").limit(5000).get(),
  ]);

  const quotes = new Map(quotesSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const customers = new Map(customersSnapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  const customs = new Map<string, CustomsDeskStep[]>();
  for (const doc of customsSnapshot.docs) {
    if (doc.get("required") === false) continue;
    const reference = shipmentIdFromChild(doc.ref);
    if (!reference) continue;
    const branch = branchValue(doc.get("branch"));
    if (!branch) continue;
    const steps = customs.get(reference) ?? [];
    steps.push({
      id: doc.id,
      title: text(doc.get("title"), "Customs step"),
      detail: nullable(doc.get("detail")),
      branch,
      completed: doc.get("completed") === true,
    });
    customs.set(reference, steps);
  }

  const documents = new Map<string, Set<ShipmentDocumentType>>();
  for (const doc of documentsSnapshot.docs) {
    const reference = shipmentIdFromChild(doc.ref);
    const type = doc.get("document_type") as ShipmentDocumentType;
    if (!reference || !shipmentDocumentTypeLabels[type]) continue;
    const set = documents.get(reference) ?? new Set<ShipmentDocumentType>();
    set.add(type);
    documents.set(reference, set);
  }

  const overrides = new Map<string, Map<ShipmentDocumentType, boolean>>();
  for (const doc of requirementsSnapshot.docs) {
    const reference = shipmentIdFromChild(doc.ref);
    const type = (doc.get("document_type") || doc.id) as ShipmentDocumentType;
    if (!reference || !shipmentDocumentTypeLabels[type]) continue;
    const map = overrides.get(reference) ?? new Map<ShipmentDocumentType, boolean>();
    map.set(type, doc.get("required") === true);
    overrides.set(reference, map);
  }

  const today = operationalDate();
  const rows: CustomsDeskRow[] = [];
  for (const shipment of shipmentsSnapshot.docs) {
    const data = shipment.data() as Record<string, unknown>;
    const status = statusValue(data.status);
    if (status === "delivered") continue;
    const customerId = nullable(data.customer_id);
    const customer = customerId ? customers.get(customerId) : undefined;
    const primary = branchValue(data.primary_branch) ?? branchValue(customer?.primary_branch);
    const handling = branchList(data.handling_branches);
    const accessBranches = [...new Set([...(primary ? [primary] : []), ...handling])];
    if (!context.can_access_all_branches && !accessBranches.some((branch) => staffCanAccessBranch(context, branch))) continue;

    const reference = shipment.id;
    const steps = customs.get(reference) ?? [];
    if (!steps.length && status !== "customs_clearance") continue;
    const openSteps = steps.filter((step) => !step.completed);
    const quoteReference = text(data.quote_reference);
    const quote = quotes.get(quoteReference);
    const mode = text(quote?.mode);
    const presentDocs = documents.get(reference) ?? new Set<ShipmentDocumentType>();
    const requirements = new Map(defaultDocumentRequirements(mode).map((item) => [item.documentType, item.required]));
    for (const [type, required] of overrides.get(reference) ?? []) requirements.set(type, required);
    const requiredTypes = [...requirements.entries()].filter(([, required]) => required).map(([type]) => type);
    const missing = requiredTypes.filter((type) => !presentDocs.has(type));
    const eta = nullable(data.eta);
    const etaDistance = daysUntil(eta, today);

    let state: CustomsDeskRow["state"] = "clear";
    if (openSteps.length && missing.length) state = "blocked";
    else if (openSteps.length) state = "in_progress";
    else if (steps.length && !missing.length) state = "ready";

    let risk: CustomsDeskRow["risk"] = "normal";
    if (status === "out_for_delivery" && openSteps.length) risk = "critical";
    else if (etaDistance !== null && etaDistance <= 0 && (openSteps.length || missing.length)) risk = "critical";
    else if (status === "customs_clearance" || (etaDistance !== null && etaDistance <= 2 && (openSteps.length || missing.length))) risk = "warning";

    rows.push({
      reference,
      quote_reference: quoteReference,
      customer_name: text(customer?.display_name, text(quote?.company_name, text(quote?.contact_name, "Customer"))),
      origin: text(quote?.origin, "Origin"),
      destination: text(quote?.destination, "Destination"),
      mode: mode || "Not set",
      status,
      eta,
      current_location: nullable(data.current_location),
      branch: primary ?? handling[0] ?? null,
      handling_branches: accessBranches,
      assigned_to_name: nullable(data.job_assigned_to_name),
      assigned_to_email: nullable(data.job_assigned_to_email),
      customs_required: steps.length,
      customs_completed: steps.length - openSteps.length,
      customs_open: openSteps.length,
      open_steps: openSteps,
      missing_documents: missing.map((type) => ({ type, label: shipmentDocumentTypeLabels[type] })),
      document_required: requiredTypes.length,
      document_present: requiredTypes.length - missing.length,
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
