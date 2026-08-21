import { createHash, randomBytes, randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { shipmentStatusLabels, shipmentStatuses, type ShipmentEvent, type ShipmentStatus } from "../../shipment-types";
import { defaultCustomsSteps, defaultDocumentRequirements, defaultWorkflowTasks } from "../workflow-defaults";
import { kcplBranches, type KcplBranch } from "../crm/crm-data";
import { listStaffProfiles } from "../staff-directory.server";
import type { KcplStaffProfile } from "../staff-directory";
import {
  shipmentImportHeaders,
  type ShipmentImportPreview,
  type ShipmentImportPreviewRow,
  type ShipmentImportRecordClass,
  type ShipmentImportResult,
} from "./shipment-import";

const MAX_ROWS = 200;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MODES = ["air", "sea", "road"] as const;

type Actor = { name: string; email: string };
type CustomerRecord = {
  id: string;
  name: string;
  normalizedName: string;
  primaryEmail: string;
  primaryPhone: string;
  preferredCurrency: string;
  archived: boolean;
};
type OwnerSnapshot = { uid: string | null; name: string | null; email: string | null; phone: string | null };
type PreparedShipment = {
  rowNumber: number;
  reference: string;
  recordClass: ShipmentImportRecordClass;
  customerId: string;
  customerName: string;
  primaryBranch: KcplBranch;
  handlingBranches: KcplBranch[];
  origin: string;
  destination: string;
  mode: string;
  status: ShipmentStatus;
  shipmentDate: string;
  deliveredDate: string | null;
  eta: string | null;
  currentLocation: string | null;
  carrier: string | null;
  carrierReference: string | null;
  cargoType: string | null;
  owner: OwnerSnapshot;
  legacyQuoteReference: string | null;
  legacyJobReference: string | null;
  internalNotes: string | null;
  preview: ShipmentImportPreviewRow;
};

type ExistingShipment = { reference: string; carrierKey: string | null };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (quoted) throw new Error("The CSV contains an unterminated quoted value.");
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function valueAt(cells: string[], indexes: Map<string, number>, header: string) {
  const index = indexes.get(header);
  return index === undefined ? "" : text(cells[index]);
}

function referenceValid(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(value);
}

function branchFrom(value: string): KcplBranch | null {
  return kcplBranches.find((branch) => branch.toLowerCase() === value.trim().toLowerCase()) ?? null;
}

function branchList(value: string) {
  const raw = value.split(/[;|]/).map((item) => item.trim()).filter(Boolean);
  const valid: KcplBranch[] = [];
  const invalid: string[] = [];
  for (const item of raw) {
    const branch = branchFrom(item);
    if (branch) valid.push(branch);
    else invalid.push(item);
  }
  return { valid: [...new Set(valid)], invalid };
}

function recordClassFrom(value: string): ShipmentImportRecordClass | null {
  const normalized = value.trim().toLowerCase();
  return normalized === "active" || normalized === "historical" ? normalized : null;
}

function modeFrom(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "ocean") return "sea";
  return ALLOWED_MODES.includes(normalized as (typeof ALLOWED_MODES)[number]) ? normalized : null;
}

function statusFrom(value: string): ShipmentStatus | null {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return shipmentStatuses.includes(normalized as ShipmentStatus) ? normalized as ShipmentStatus : null;
}

function dateValid(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateIso(value: string) {
  return `${value}T00:00:00.000Z`;
}

function dateMs(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function carrierKey(carrier: string, reference: string) {
  const ref = normalize(reference);
  if (!ref) return null;
  const normalizedCarrier = normalize(carrier);
  return `${normalizedCarrier || "unknown"}:${ref}`;
}

function hiddenQuoteReference(reference: string) {
  const hash = createHash("sha1").update(reference.toUpperCase()).digest("hex").slice(0, 18).toUpperCase();
  return `MIG-Q-${hash}`;
}

async function loadCustomers() {
  const snapshot = await firebaseAdminDb().collection("customers").limit(5000).get();
  const byId = new Map<string, CustomerRecord>();
  const byName = new Map<string, CustomerRecord[]>();
  for (const doc of snapshot.docs) {
    const name = text(doc.get("display_name")) || doc.id;
    const record: CustomerRecord = {
      id: doc.id,
      name,
      normalizedName: text(doc.get("normalized_name")) || normalize(name),
      primaryEmail: text(doc.get("primary_email")),
      primaryPhone: text(doc.get("primary_phone")),
      preferredCurrency: text(doc.get("preferred_currency")) || "NPR",
      archived: doc.get("archived") === true,
    };
    byId.set(doc.id.toUpperCase(), record);
    if (!record.archived && record.normalizedName) {
      const matches = byName.get(record.normalizedName) ?? [];
      matches.push(record);
      byName.set(record.normalizedName, matches);
    }
  }
  return { byId, byName };
}

async function loadExistingShipments() {
  const snapshot = await firebaseAdminDb().collection("shipments").limit(5000).get();
  const byReference = new Set<string>();
  const byCarrier = new Map<string, ExistingShipment[]>();
  for (const doc of snapshot.docs) {
    const key = carrierKey(text(doc.get("carrier")), text(doc.get("carrier_reference")));
    const item = { reference: doc.id, carrierKey: key };
    byReference.add(doc.id.toUpperCase());
    if (key) {
      const rows = byCarrier.get(key) ?? [];
      rows.push(item);
      byCarrier.set(key, rows);
    }
  }
  return { byReference, byCarrier };
}

function profileMaps(profiles: KcplStaffProfile[]) {
  const byEmail = new Map<string, KcplStaffProfile>();
  const byName = new Map<string, KcplStaffProfile[]>();
  for (const profile of profiles) {
    if (profile.email) byEmail.set(profile.email.trim().toLowerCase(), profile);
    const name = normalize(profile.display_name);
    if (name) {
      const list = byName.get(name) ?? [];
      list.push(profile);
      byName.set(name, list);
    }
  }
  return { byEmail, byName };
}

function resolveCustomer(customerIdValue: string, customerNameValue: string, customers: Awaited<ReturnType<typeof loadCustomers>>) {
  const issues: string[] = [];
  const id = customerIdValue.trim().toUpperCase();
  const name = customerNameValue.trim();
  let customer: CustomerRecord | null = null;
  if (id) {
    customer = customers.byId.get(id) ?? null;
    if (!customer || customer.archived) issues.push(`Customer ${id} does not exist as an active CRM record.`);
    else if (name && normalize(name) !== customer.normalizedName) issues.push(`Customer name does not match ${id} (${customer.name}).`);
  } else if (name) {
    const matches = customers.byName.get(normalize(name)) ?? [];
    if (matches.length === 1) customer = matches[0];
    else if (matches.length > 1) issues.push(`Customer name is ambiguous. Use customer_id for ${name}.`);
    else issues.push(`No active CRM customer matches ${name}. Import the customer in Stage 1 first.`);
  } else {
    issues.push("Customer ID or exact customer name is required.");
  }
  return { customer, issues };
}

function resolveOwner(ownerEmailValue: string, ownerNameValue: string, recordClass: ShipmentImportRecordClass | null, primaryBranch: KcplBranch | null, maps: ReturnType<typeof profileMaps>) {
  const email = ownerEmailValue.trim().toLowerCase();
  const name = ownerNameValue.trim();
  const issues: string[] = [];
  let profile: KcplStaffProfile | null = null;
  if (email) profile = maps.byEmail.get(email) ?? null;
  else if (name) {
    const matches = maps.byName.get(normalize(name)) ?? [];
    if (matches.length === 1) profile = matches[0];
    else if (matches.length > 1 && recordClass === "active") issues.push(`Owner name is ambiguous. Use owner_email for ${name}.`);
  }

  if (recordClass === "active" && (email || name)) {
    if (!profile) issues.push("Active shipment owner must match an existing People & branches staff profile.");
    else if (!profile.active) issues.push(`${profile.display_name} is inactive and cannot own an active imported shipment.`);
    else if (primaryBranch && profile.branch_scope !== "all" && profile.role !== "management" && !profile.branches.includes(primaryBranch)) {
      issues.push(`${profile.display_name} is not assigned to ${primaryBranch}.`);
    }
  }

  return {
    owner: profile ? {
      uid: profile.uid || null,
      name: profile.display_name || null,
      email: profile.email || null,
      phone: profile.phone || null,
    } : {
      uid: null,
      name: name || null,
      email: email || null,
      phone: null,
    },
    issues,
  };
}

export function shipmentCsvTemplate() {
  return `${shipmentImportHeaders.join(",")}\n`;
}

export function shipmentImportLimits() {
  return { maxRows: MAX_ROWS, maxFileBytes: MAX_FILE_BYTES };
}

export async function prepareShipmentImport(filename: string, csv: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  let parsed: string[][];
  try { parsed = parseCsv(csv); }
  catch (error) { return { kind: "invalid_file" as const, error: error instanceof Error ? error.message : "The CSV could not be parsed." }; }
  if (!parsed.length) return { kind: "invalid_file" as const, error: "The CSV is empty." };

  const headers = parsed[0].map(normalizeHeader);
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const requiredHeaders = ["shipment_reference", "record_class", "customer_id", "customer_name", "primary_branch", "origin", "destination", "mode", "status", "shipment_date"];
  const missingHeaders = requiredHeaders.filter((header) => !indexes.has(header));
  if (missingHeaders.length) return { kind: "invalid_file" as const, error: `Missing required column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}.` };

  const dataRows = parsed.slice(1).filter((cells) => cells.some((cell) => cell.trim()));
  if (!dataRows.length) return { kind: "invalid_file" as const, error: "Add at least one shipment row beneath the CSV header." };
  if (dataRows.length > MAX_ROWS) return { kind: "invalid_file" as const, error: `Stage 2 accepts up to ${MAX_ROWS} shipment rows per batch. Split the file into smaller batches.` };

  const [customers, existing, profiles] = await Promise.all([loadCustomers(), loadExistingShipments(), listStaffProfiles()]);
  const staffMaps = profileMaps(profiles ?? []);
  const seenReferences = new Map<string, number>();
  const seenCarrier = new Map<string, number>();
  const prepared: PreparedShipment[] = [];

  dataRows.forEach((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const reference = valueAt(cells, indexes, "shipment_reference").toUpperCase();
    const recordClass = recordClassFrom(valueAt(cells, indexes, "record_class"));
    const primaryBranch = branchFrom(valueAt(cells, indexes, "primary_branch"));
    const handlingParsed = branchList(valueAt(cells, indexes, "handling_branches"));
    const origin = valueAt(cells, indexes, "origin");
    const destination = valueAt(cells, indexes, "destination");
    const mode = modeFrom(valueAt(cells, indexes, "mode"));
    const shipmentStatus = statusFrom(valueAt(cells, indexes, "status"));
    const shipmentDate = valueAt(cells, indexes, "shipment_date");
    const deliveredDate = valueAt(cells, indexes, "delivered_date");
    const eta = valueAt(cells, indexes, "eta");
    const carrier = valueAt(cells, indexes, "carrier");
    const carrierReference = valueAt(cells, indexes, "carrier_reference");
    const cargoType = valueAt(cells, indexes, "cargo_type");
    const customerResolved = resolveCustomer(valueAt(cells, indexes, "customer_id"), valueAt(cells, indexes, "customer_name"), customers);
    const ownerResolved = resolveOwner(valueAt(cells, indexes, "owner_email"), valueAt(cells, indexes, "owner_name"), recordClass, primaryBranch, staffMaps);
    const issues: string[] = [...customerResolved.issues, ...ownerResolved.issues];

    if (!reference || !referenceValid(reference)) issues.push("Shipment reference must be 3-80 characters using letters, numbers, dots, underscores or hyphens only.");
    if (!recordClass) issues.push("Record class must be active or historical.");
    if (!primaryBranch) issues.push(`Primary branch must be one of: ${kcplBranches.join(", ")}.`);
    if (handlingParsed.invalid.length) issues.push(`Unknown handling branch${handlingParsed.invalid.length === 1 ? "" : "es"}: ${handlingParsed.invalid.join(", ")}.`);
    if (!origin) issues.push("Origin is required.");
    if (!destination) issues.push("Destination is required.");
    if (!mode) issues.push("Mode must be air, sea/ocean or road.");
    if (!shipmentStatus) issues.push(`Status must be one of: ${shipmentStatuses.join(", ")}.`);
    if (!dateValid(shipmentDate)) issues.push("Shipment date must use YYYY-MM-DD.");
    if (eta && !dateValid(eta)) issues.push("ETA must use YYYY-MM-DD when supplied.");

    if (recordClass === "historical") {
      if (shipmentStatus && shipmentStatus !== "delivered") issues.push("Historical Stage 2 records must use status delivered. Non-delivered work belongs in record_class active.");
      if (!deliveredDate || !dateValid(deliveredDate)) issues.push("Historical records require delivered_date in YYYY-MM-DD format.");
      else if (dateValid(shipmentDate) && dateMs(deliveredDate) < dateMs(shipmentDate)) issues.push("Delivered date cannot be earlier than shipment date.");
    }
    if (recordClass === "active") {
      if (shipmentStatus === "delivered") issues.push("Delivered records must use record_class historical.");
      if (deliveredDate) issues.push("Active records must leave delivered_date blank.");
      if (eta && dateValid(eta) && dateValid(shipmentDate) && dateMs(eta) < dateMs(shipmentDate)) issues.push("ETA cannot be earlier than shipment date.");
    }

    const duplicateMatches: string[] = [];
    if (reference && existing.byReference.has(reference)) duplicateMatches.push(`Existing shipment ${reference}`);
    const earlierReferenceRow = reference ? seenReferences.get(reference) : undefined;
    if (earlierReferenceRow) duplicateMatches.push(`CSV row ${earlierReferenceRow} · matching shipment reference`);
    const cKey = carrierKey(carrier, carrierReference);
    if (cKey) {
      for (const match of existing.byCarrier.get(cKey) ?? []) duplicateMatches.push(`${match.reference} · matching carrier reference`);
      const earlierCarrierRow = seenCarrier.get(cKey);
      if (earlierCarrierRow) duplicateMatches.push(`CSV row ${earlierCarrierRow} · matching carrier reference`);
    }

    const status = issues.length ? "invalid" : duplicateMatches.length ? "duplicate" : "ready";
    const preview: ShipmentImportPreviewRow = {
      row_number: rowNumber,
      status,
      shipment_reference: reference || "Missing reference",
      record_class: recordClass,
      customer_id: customerResolved.customer?.id ?? null,
      customer_name: customerResolved.customer?.name || valueAt(cells, indexes, "customer_name") || "Unresolved customer",
      primary_branch: primaryBranch,
      origin,
      destination,
      mode: mode ?? valueAt(cells, indexes, "mode"),
      shipment_status: shipmentStatus,
      shipment_date: shipmentDate,
      delivered_date: deliveredDate,
      eta,
      carrier_reference: carrierReference,
      owner: ownerResolved.owner.name || ownerResolved.owner.email || "Unassigned",
      issues,
      duplicate_matches: [...new Set(duplicateMatches)],
    };

    if (status === "ready" && recordClass && customerResolved.customer && primaryBranch && mode && shipmentStatus) {
      const handlingBranches = [...new Set([primaryBranch, ...handlingParsed.valid])];
      prepared.push({
        rowNumber,
        reference,
        recordClass,
        customerId: customerResolved.customer.id,
        customerName: customerResolved.customer.name,
        primaryBranch,
        handlingBranches,
        origin,
        destination,
        mode,
        status: shipmentStatus,
        shipmentDate,
        deliveredDate: deliveredDate || null,
        eta: eta || null,
        currentLocation: valueAt(cells, indexes, "current_location") || null,
        carrier: carrier || null,
        carrierReference: carrierReference || null,
        cargoType: cargoType || null,
        owner: ownerResolved.owner,
        legacyQuoteReference: valueAt(cells, indexes, "legacy_quote_reference") || null,
        legacyJobReference: valueAt(cells, indexes, "legacy_job_reference") || null,
        internalNotes: valueAt(cells, indexes, "internal_notes") || null,
        preview,
      });
      seenReferences.set(reference, rowNumber);
      if (cKey) seenCarrier.set(cKey, rowNumber);
    } else {
      prepared.push({
        rowNumber,
        reference,
        recordClass: recordClass ?? "historical",
        customerId: customerResolved.customer?.id ?? "",
        customerName: customerResolved.customer?.name ?? "",
        primaryBranch: primaryBranch ?? "Kathmandu",
        handlingBranches: primaryBranch ? [primaryBranch, ...handlingParsed.valid.filter((branch) => branch !== primaryBranch)] : handlingParsed.valid,
        origin,
        destination,
        mode: mode ?? "",
        status: shipmentStatus ?? "booking_confirmed",
        shipmentDate,
        deliveredDate: deliveredDate || null,
        eta: eta || null,
        currentLocation: valueAt(cells, indexes, "current_location") || null,
        carrier: carrier || null,
        carrierReference: carrierReference || null,
        cargoType: cargoType || null,
        owner: ownerResolved.owner,
        legacyQuoteReference: valueAt(cells, indexes, "legacy_quote_reference") || null,
        legacyJobReference: valueAt(cells, indexes, "legacy_job_reference") || null,
        internalNotes: valueAt(cells, indexes, "internal_notes") || null,
        preview,
      });
    }
  });

  const rows = prepared.map((item) => item.preview);
  const preview: ShipmentImportPreview = {
    filename,
    total: rows.length,
    ready: rows.filter((row) => row.status === "ready").length,
    duplicates: rows.filter((row) => row.status === "duplicate").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    active: rows.filter((row) => row.status === "ready" && row.record_class === "active").length,
    historical: rows.filter((row) => row.status === "ready" && row.record_class === "historical").length,
    rows,
  };
  return { kind: "ready" as const, preview, prepared };
}

function hiddenQuoteDocument(row: PreparedShipment, batchId: string, actor: Actor, now: string, customer: CustomerRecord) {
  return {
    migration_hidden: true,
    migration_stage: 2,
    migration_batch_id: batchId,
    migration_source: "shipment_csv_stage_2",
    status: "won",
    origin: row.origin,
    destination: row.destination,
    mode: row.mode,
    cargo_type: row.cargoType,
    customer_id: row.customerId,
    contact_name: customer.name,
    contact_email: customer.primaryEmail || "",
    company_name: customer.name,
    phone: customer.primaryPhone || null,
    assigned_to_uid: row.owner.uid,
    assigned_to_name: row.owner.name,
    assigned_to_email: row.owner.email,
    assigned_to_phone: row.owner.phone,
    quote_currency: customer.preferredCurrency || "NPR",
    quoted_amount: null,
    internal_cost: null,
    valid_until: null,
    customer_quote_note: null,
    crm_match_state: "linked",
    crm_matches: [],
    note_count: 0,
    email_count: 0,
    last_customer_email_at: null,
    shipment_reference: row.reference,
    created_at: dateIso(row.shipmentDate),
    updated_at: now,
    created_by_name: actor.name,
    created_by_email: actor.email,
  };
}

function shipmentDocument(row: PreparedShipment, batchId: string, actor: Actor, now: string) {
  const historical = row.recordClass === "historical";
  const historicalAt = row.deliveredDate ? dateIso(row.deliveredDate) : now;
  return {
    reference: row.reference,
    quote_reference: hiddenQuoteReference(row.reference),
    customer_id: row.customerId,
    primary_branch: row.primaryBranch,
    handling_branches: row.handlingBranches,
    job_priority: "standard",
    job_assigned_to_uid: row.owner.uid,
    job_assigned_to_name: row.owner.name,
    job_assigned_to_email: row.owner.email,
    job_assigned_to_phone: row.owner.phone,
    internal_job_reference: row.legacyJobReference,
    internal_job_notes: row.internalNotes,
    workflow_version: 1,
    job_closed_at: historical ? historicalAt : null,
    job_closed_by_name: historical ? "KCPL Migration" : null,
    job_closed_by_email: historical ? actor.email : null,
    job_close_note: historical ? "Historical shipment imported as a completed Stage 2 migration record." : null,
    job_close_overridden: historical,
    created_at: dateIso(row.shipmentDate),
    updated_at: historical ? historicalAt : now,
    status_changed_at: historical ? historicalAt : now,
    status: row.status,
    eta: row.eta,
    current_location: row.currentLocation || (historical ? row.destination : row.origin),
    carrier: row.carrier,
    carrier_reference: row.carrierReference,
    customer_note: null,
    origin: row.origin,
    destination: row.destination,
    mode: row.mode,
    cargo_type: row.cargoType,
    migration_stage: 2,
    migration_batch_id: batchId,
    migration_source: "shipment_csv_stage_2",
    migration_record_class: row.recordClass,
    migration_historical: historical,
    migration_source_filename: null,
    migration_row_number: row.rowNumber,
    migration_legacy_quote_reference: row.legacyQuoteReference,
    migration_imported_at: now,
    migration_imported_by_name: actor.name,
    migration_imported_by_email: actor.email,
  };
}

export async function importShipmentCsv(filename: string, csv: string, actor: Actor) {
  const prepared = await prepareShipmentImport(filename, csv);
  if (prepared.kind !== "ready") return prepared;
  const readyRows = prepared.prepared.filter((row) => row.preview.status === "ready");
  const batchId = `MIG-SHIP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const db = firebaseAdminDb();
  const batchRef = db.collection("migration_batches").doc(batchId);
  const now = new Date().toISOString();
  const importedReferences: string[] = [];
  let activeImported = 0;
  let historicalImported = 0;

  const customersSnapshot = await db.collection("customers").limit(5000).get();
  const customers = new Map<string, CustomerRecord>();
  for (const doc of customersSnapshot.docs) {
    customers.set(doc.id, {
      id: doc.id,
      name: text(doc.get("display_name")) || doc.id,
      normalizedName: text(doc.get("normalized_name")) || normalize(text(doc.get("display_name"))),
      primaryEmail: text(doc.get("primary_email")),
      primaryPhone: text(doc.get("primary_phone")),
      preferredCurrency: text(doc.get("preferred_currency")) || "NPR",
      archived: doc.get("archived") === true,
    });
  }

  await batchRef.create({
    schema_version: 1,
    batch_id: batchId,
    stage: 2,
    type: "shipment_csv",
    status: "running",
    source_filename: filename,
    total_rows: prepared.preview.total,
    ready_rows: prepared.preview.ready,
    duplicate_rows: prepared.preview.duplicates,
    invalid_rows: prepared.preview.invalid,
    active_rows: prepared.preview.active,
    historical_rows: prepared.preview.historical,
    imported_count: 0,
    active_imported: 0,
    historical_imported: 0,
    created_shipment_references: [],
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: now,
    completed_at: null,
  });

  try {
    for (let index = 0; index < readyRows.length; index += 10) {
      const chunk = readyRows.slice(index, index + 10);
      const write = db.batch();
      const customerCounts = new Map<string, { active: number; completed: number }>();

      for (const row of chunk) {
        const customer = customers.get(row.customerId);
        if (!customer || customer.archived) throw new Error(`Customer ${row.customerId} became unavailable during import.`);
        const shipmentRef = db.collection("shipments").doc(row.reference);
        const quoteRef = db.collection("quotes").doc(hiddenQuoteReference(row.reference));
        const historical = row.recordClass === "historical";
        const statusTime = historical && row.deliveredDate ? dateIso(row.deliveredDate) : now;
        const eventId = Date.now() * 1000 + row.rowNumber;
        const event: ShipmentEvent = {
          id: eventId,
          shipment_reference: row.reference,
          title: shipmentStatusLabels[row.status],
          location: row.currentLocation || (historical ? row.destination : row.origin),
          details: historical
            ? `Historical shipment imported from KCPL records in migration batch ${batchId}.`
            : `Active shipment imported into KCPL Operations in migration batch ${batchId}.`,
          event_time: statusTime,
          created_at: now,
          author_name: actor.name || "KCPL Migration",
        };

        write.create(quoteRef, hiddenQuoteDocument(row, batchId, actor, now, customer));
        write.create(shipmentRef, { ...shipmentDocument(row, batchId, actor, now), migration_source_filename: filename });
        write.create(shipmentRef.collection("events").doc(String(eventId)), event);
        write.create(shipmentRef.collection("job_activity").doc(`migration-${randomUUID()}`), {
          type: historical ? "historical_shipment_imported" : "active_shipment_imported",
          title: historical ? "Historical shipment imported" : "Active shipment imported",
          detail: `Stage 2 migration batch ${batchId} · source row ${row.rowNumber}.`,
          actor_name: actor.name,
          actor_email: actor.email,
          created_at: now,
        });
        write.create(db.collection("customers").doc(row.customerId).collection("activity").doc(`migration-${batchId}-${row.rowNumber}`), {
          type: historical ? "historical_shipment_imported" : "active_shipment_imported",
          title: `${historical ? "Historical" : "Active"} shipment imported: ${row.reference}`,
          detail: `${row.origin} → ${row.destination} · ${row.mode}`,
          actor_name: actor.name,
          actor_email: actor.email,
          created_at: now,
        });

        if (!historical) {
          for (const task of defaultWorkflowTasks(row.mode, row.primaryBranch)) {
            write.create(shipmentRef.collection("job_tasks").doc(`task-${randomUUID()}`), {
              title: task.title,
              detail: task.detail,
              branch: task.branch,
              due_at: null,
              assigned_to_uid: row.owner.uid,
              assigned_to_name: row.owner.name,
              assigned_to_email: row.owner.email,
              assigned_to_phone: row.owner.phone,
              completed: false,
              completed_at: null,
              completed_by: null,
              created_at: now,
              created_by: actor.email || "migration@kcpl.internal",
              workflow_seeded: true,
              migration_seeded: true,
            });
          }
          for (const step of defaultCustomsSteps(row.mode, row.primaryBranch)) {
            write.create(shipmentRef.collection("customs_steps").doc(`customs-${randomUUID()}`), {
              title: step.title,
              detail: step.detail,
              branch: step.branch,
              required: step.required,
              completed: false,
              completed_at: null,
              completed_by: null,
              created_at: now,
              created_by: actor.email || "migration@kcpl.internal",
              workflow_seeded: true,
              migration_seeded: true,
            });
          }
          for (const requirement of defaultDocumentRequirements(row.mode)) {
            write.set(shipmentRef.collection("document_requirements").doc(requirement.documentType), {
              document_type: requirement.documentType,
              required: requirement.required,
              reason: requirement.reason,
              source: "workflow_default",
              migration_seeded: true,
              created_at: now,
              updated_at: now,
            });
          }
        }

        const counts = customerCounts.get(row.customerId) ?? { active: 0, completed: 0 };
        if (historical) counts.completed += 1;
        else counts.active += 1;
        customerCounts.set(row.customerId, counts);
        importedReferences.push(row.reference);
        if (historical) historicalImported += 1;
        else activeImported += 1;
      }

      for (const [customerId, counts] of customerCounts) {
        write.set(db.collection("customers").doc(customerId), {
          active_shipment_count: FieldValue.increment(counts.active),
          completed_shipment_count: FieldValue.increment(counts.completed),
          updated_at: now,
        }, { merge: true });
      }
      await write.commit();
      await batchRef.set({
        imported_count: importedReferences.length,
        active_imported: activeImported,
        historical_imported: historicalImported,
        created_shipment_references: importedReferences,
      }, { merge: true });
    }

    const completedAt = new Date().toISOString();
    await batchRef.set({
      status: "completed",
      imported_count: importedReferences.length,
      active_imported: activeImported,
      historical_imported: historicalImported,
      created_shipment_references: importedReferences,
      completed_at: completedAt,
    }, { merge: true });

    const result: ShipmentImportResult = {
      batch_id: batchId,
      filename,
      total: prepared.preview.total,
      imported: importedReferences.length,
      active_imported: activeImported,
      historical_imported: historicalImported,
      duplicates: prepared.preview.duplicates,
      invalid: prepared.preview.invalid,
      shipment_references: importedReferences,
    };
    return { kind: "imported" as const, result };
  } catch (error) {
    await batchRef.set({
      status: "partial_failure",
      imported_count: importedReferences.length,
      active_imported: activeImported,
      historical_imported: historicalImported,
      created_shipment_references: importedReferences,
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message.slice(0, 1000) : "Shipment migration failed.",
    }, { merge: true });
    throw error;
  }
}
