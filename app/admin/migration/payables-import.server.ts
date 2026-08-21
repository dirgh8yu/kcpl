import { createHash, randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { recomputeCustomerFinance } from "../finance/finance.server";
import { jobCostCategories, type JobCostCategory } from "../job-file";
import { normalizeSupplierBillReference, supplierIdentityKey } from "../payables/payables-policy";
import {
  payablesImportHeaders,
  type PayablesImportPreview,
  type PayablesImportPreviewRow,
  type PayablesImportRecordType,
  type PayablesImportResult,
} from "./payables-import";

const MAX_ROWS = 150;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Actor = { name: string; email: string };
type PartnerRecord = {
  id: string;
  name: string;
  normalizedName: string;
  ownerBranch: string | null;
  status: string;
};
type ShipmentRecord = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  branch: KcplBranch | null;
};
type PreparedPayable = {
  rowNumber: number;
  reference: string;
  recordType: PayablesImportRecordType;
  supplierId: string;
  supplierName: string;
  supplierKey: string;
  shipmentReference: string | null;
  customerId: string | null;
  customerName: string | null;
  branch: KcplBranch;
  supplierBillReference: string | null;
  normalizedSupplierBillReference: string | null;
  currency: CrmCurrency;
  category: JobCostCategory;
  billDate: string;
  dueDate: string;
  asOfDate: string;
  billTotal: number;
  amountPaid: number;
  balanceDue: number;
  description: string;
  notes: string | null;
  preview: PayablesImportPreviewRow;
};
type ExistingPayablesIndex = {
  references: Set<string>;
  billKeys: Map<string, string[]>;
  openingKeys: Map<string, string[]>;
};

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
        if (source[index + 1] === '"') { cell += '"'; index += 1; }
        else quoted = false;
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

function dateValid(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function operationalDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function currencyFrom(value: string): CrmCurrency | null {
  const normalized = value.trim().toUpperCase();
  return crmCurrencies.includes(normalized as CrmCurrency) ? normalized as CrmCurrency : null;
}

function branchFrom(value: string): KcplBranch | null {
  const normalized = value.trim();
  return kcplBranches.includes(normalized as KcplBranch) ? normalized as KcplBranch : null;
}

function categoryFrom(value: string): JobCostCategory | null {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return jobCostCategories.includes(normalized as JobCostCategory) ? normalized as JobCostCategory : null;
}

function recordTypeFrom(value: string): PayablesImportRecordType | null {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "bill" || normalized === "supplier_bill") return "bill";
  if (normalized === "opening_balance") return "opening_balance";
  return null;
}

function numeric(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function payableReference(recordType: PayablesImportRecordType, supplierId: string, supplierBillReference: string | null, currency: CrmCurrency, branch: KcplBranch) {
  const key = recordType === "bill"
    ? `${supplierId}|${normalizeSupplierBillReference(supplierBillReference ?? "")}`
    : `${supplierId}|${currency}|${branch}|opening_balance`;
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 18).toUpperCase();
  return recordType === "bill" ? `KCPL-MIG-B-${hash}` : `KCPL-OBP-${hash}`;
}

function billKey(supplierKey: string, supplierBillReference: string) {
  return `${supplierKey}|${normalizeSupplierBillReference(supplierBillReference)}`;
}

function openingKey(supplierId: string, currency: CrmCurrency, branch: KcplBranch) {
  return `${supplierId.toUpperCase()}|${currency}|${branch}`;
}

function childId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

async function loadPartners() {
  const snapshot = await firebaseAdminDb().collection("partners").limit(5000).get();
  const byId = new Map<string, PartnerRecord>();
  const byName = new Map<string, PartnerRecord[]>();
  for (const doc of snapshot.docs) {
    const name = text(doc.get("display_name")) || doc.id;
    const record: PartnerRecord = {
      id: doc.id,
      name,
      normalizedName: text(doc.get("normalized_name")) || normalize(name),
      ownerBranch: text(doc.get("owner_branch")) || null,
      status: text(doc.get("status")) || "active",
    };
    byId.set(doc.id.toUpperCase(), record);
    if (record.normalizedName) {
      const rows = byName.get(record.normalizedName) ?? [];
      rows.push(record);
      byName.set(record.normalizedName, rows);
    }
  }
  return { byId, byName };
}

function resolvePartner(supplierIdValue: string, supplierNameValue: string, partners: Awaited<ReturnType<typeof loadPartners>>) {
  const issues: string[] = [];
  const id = supplierIdValue.trim().toUpperCase();
  const name = supplierNameValue.trim();
  let partner: PartnerRecord | null = null;
  if (id) {
    partner = partners.byId.get(id) ?? null;
    if (!partner) issues.push(`Partner ${id} does not exist. Register the supplier in Partners first.`);
    else if (name && normalize(name) !== partner.normalizedName) issues.push(`Supplier name does not match ${id} (${partner.name}).`);
  } else if (name) {
    const matches = partners.byName.get(normalize(name)) ?? [];
    if (matches.length === 1) partner = matches[0];
    else if (matches.length > 1) issues.push(`Supplier name is ambiguous. Use supplier_id for ${name}.`);
    else issues.push(`No Partner matches ${name}. Register the supplier in Partners first.`);
  } else issues.push("Supplier ID or exact Partner name is required.");
  return { partner, issues };
}

async function loadShipment(reference: string, cache: Map<string, ShipmentRecord | null>) {
  const id = reference.trim().toUpperCase();
  if (!id) return null;
  if (cache.has(id)) return cache.get(id) ?? null;
  const snapshot = await firebaseAdminDb().collection("shipments").doc(id).get();
  let row: ShipmentRecord | null = null;
  if (snapshot.exists) {
    const customerId = text(snapshot.get("customer_id")) || null;
    let customerName: string | null = null;
    if (customerId) {
      const customer = await firebaseAdminDb().collection("customers").doc(customerId).get();
      customerName = customer.exists ? text(customer.get("display_name")) || customerId : customerId;
    }
    row = { id: snapshot.id, customerId, customerName, branch: branchFrom(text(snapshot.get("primary_branch"))) };
  }
  cache.set(id, row);
  return row;
}

async function loadExistingPayables(): Promise<ExistingPayablesIndex> {
  const snapshot = await firebaseAdminDb().collection("payables").limit(8000).get();
  const references = new Set<string>();
  const billKeys = new Map<string, string[]>();
  const openingKeys = new Map<string, string[]>();
  for (const doc of snapshot.docs) {
    references.add(doc.id.toUpperCase());
    if (text(doc.get("status")) === "void") continue;
    const supplierId = text(doc.get("supplier_id")).toUpperCase();
    const supplierName = text(doc.get("supplier_name"));
    const supplierKey = text(doc.get("supplier_key")) || supplierIdentityKey(supplierId, supplierName);
    const recordType = text(doc.get("record_type")) || text(doc.get("migration_record_type"));
    if (recordType === "opening_balance" && supplierId) {
      const currency = currencyFrom(text(doc.get("currency")));
      const branch = branchFrom(text(doc.get("branch")));
      if (currency && branch) {
        const key = openingKey(supplierId, currency, branch);
        const rows = openingKeys.get(key) ?? [];
        rows.push(doc.id);
        openingKeys.set(key, rows);
      }
      continue;
    }
    const external = text(doc.get("supplier_bill_reference")) || text(doc.get("migration_source_bill_number"));
    if (supplierKey && external) {
      const key = billKey(supplierKey, external);
      const rows = billKeys.get(key) ?? [];
      rows.push(doc.id);
      billKeys.set(key, rows);
    }
  }
  return { references, billKeys, openingKeys };
}

export function payablesCsvTemplate() {
  return `${payablesImportHeaders.join(",")}\n`;
}

export function payablesImportLimits() {
  return { maxRows: MAX_ROWS, maxFileBytes: MAX_FILE_BYTES };
}

export async function preparePayablesImport(filename: string, csv: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  let parsed: string[][];
  try { parsed = parseCsv(csv); }
  catch (error) { return { kind: "invalid_file" as const, error: error instanceof Error ? error.message : "The CSV could not be parsed." }; }
  if (!parsed.length) return { kind: "invalid_file" as const, error: "The CSV is empty." };

  const headers = parsed[0].map(normalizeHeader);
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const missingHeaders = payablesImportHeaders.filter((header) => !indexes.has(header));
  if (missingHeaders.length) return { kind: "invalid_file" as const, error: `Missing required column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}.` };

  const dataRows = parsed.slice(1).filter((cells) => cells.some((cell) => cell.trim()));
  if (!dataRows.length) return { kind: "invalid_file" as const, error: "Add at least one payable row beneath the CSV header." };
  if (dataRows.length > MAX_ROWS) return { kind: "invalid_file" as const, error: `Stage 3B accepts up to ${MAX_ROWS} payable rows per batch. Split this file into smaller batches.` };

  const [partners, existing] = await Promise.all([loadPartners(), loadExistingPayables()]);
  const shipmentCache = new Map<string, ShipmentRecord | null>();
  const seenBills = new Map<string, number>();
  const seenOpenings = new Map<string, number>();
  const prepared: PreparedPayable[] = [];
  const today = operationalDate();

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
    const cells = dataRows[rowIndex];
    const rowNumber = rowIndex + 2;
    const recordType = recordTypeFrom(valueAt(cells, indexes, "record_type"));
    const resolved = resolvePartner(valueAt(cells, indexes, "supplier_id"), valueAt(cells, indexes, "supplier_name"), partners);
    const shipmentReference = valueAt(cells, indexes, "shipment_reference").toUpperCase();
    const branchRaw = valueAt(cells, indexes, "branch");
    const branch = branchFrom(branchRaw);
    const supplierBillReference = valueAt(cells, indexes, "supplier_bill_reference");
    const billDateRaw = valueAt(cells, indexes, "bill_date");
    const dueDateRaw = valueAt(cells, indexes, "due_date");
    const asOfDateRaw = valueAt(cells, indexes, "as_of_date");
    const currency = currencyFrom(valueAt(cells, indexes, "currency"));
    const billTotalRaw = numeric(valueAt(cells, indexes, "bill_total"));
    const amountPaidRaw = numeric(valueAt(cells, indexes, "amount_paid"));
    const balanceDueRaw = numeric(valueAt(cells, indexes, "balance_due"));
    const categoryRaw = valueAt(cells, indexes, "category");
    const category = categoryFrom(categoryRaw);
    const descriptionRaw = valueAt(cells, indexes, "description");
    const notesRaw = valueAt(cells, indexes, "notes");
    const issues = [...resolved.issues];
    const duplicateMatches: string[] = [];

    if (!recordType) issues.push("Record type must be bill or opening_balance.");
    if (!branch) issues.push(`Branch must be one of: ${kcplBranches.join(", ")}.`);
    if (!currency) issues.push(`Currency must be one of: ${crmCurrencies.join(", ")}.`);
    if (!dateValid(asOfDateRaw)) issues.push("As-of date must use YYYY-MM-DD.");
    else if (asOfDateRaw > today) issues.push("As-of date cannot be in the future.");
    if (!dateValid(dueDateRaw)) issues.push("Due date must use YYYY-MM-DD.");

    let shipment: ShipmentRecord | null = null;
    if (shipmentReference) {
      shipment = await loadShipment(shipmentReference, shipmentCache);
      if (!shipment) issues.push(`Shipment ${shipmentReference} does not exist.`);
      else {
        if (!shipment.branch) issues.push(`Shipment ${shipmentReference} has invalid or missing branch data.`);
        if (branch && shipment.branch && branch !== shipment.branch) issues.push(`Branch must match shipment ${shipmentReference} (${shipment.branch}).`);
      }
    }

    if (recordType === "bill") {
      if (!supplierBillReference) issues.push("Supplier bill reference is required for bill rows.");
      if (supplierBillReference.length > 120) issues.push("Supplier bill reference must be 120 characters or fewer.");
      if (!dateValid(billDateRaw)) issues.push("Bill date must use YYYY-MM-DD for bill rows.");
      else if (dateValid(asOfDateRaw) && billDateRaw > asOfDateRaw) issues.push("Bill date cannot be after the as-of date.");
      if (dateValid(billDateRaw) && dateValid(dueDateRaw) && dueDateRaw < billDateRaw) issues.push("Due date cannot be before bill date.");
      if (billTotalRaw === null || billTotalRaw <= 0) issues.push("Bill total must be greater than zero.");
      if (amountPaidRaw === null || amountPaidRaw < 0) issues.push("Amount paid must be zero or greater.");
      if (balanceDueRaw === null || balanceDueRaw <= 0) issues.push("Stage 3B imports open payables only, so balance due must be greater than zero.");
      if (billTotalRaw !== null && amountPaidRaw !== null && balanceDueRaw !== null && Math.abs(billTotalRaw - amountPaidRaw - balanceDueRaw) > 0.011) issues.push("Bill total minus amount paid must equal balance due.");
      if (!category) issues.push(`Category must be one of: ${jobCostCategories.join(", ")}.`);
    }

    if (recordType === "opening_balance") {
      if (shipmentReference) issues.push("Supplier opening balances are ledger-level and cannot be linked to a shipment.");
      if (supplierBillReference) issues.push("Opening balance rows must not contain a supplier bill reference.");
      if (billDateRaw) issues.push("Opening balance rows do not use bill_date. Leave it blank.");
      if (billTotalRaw !== null && Math.abs(billTotalRaw) > 0.001) issues.push("Opening balance rows do not use bill_total. Leave it blank or zero.");
      if (amountPaidRaw !== null && Math.abs(amountPaidRaw) > 0.001) issues.push("Opening balance rows do not use amount_paid. Leave it blank or zero.");
      if (balanceDueRaw === null || balanceDueRaw <= 0) issues.push("Supplier opening balance must be greater than zero.");
      if (!descriptionRaw) issues.push("Opening balance rows require a short source-ledger description.");
      if (categoryRaw && categoryRaw.toLowerCase() !== "other") issues.push("Opening balance rows should leave category blank or use other because they are not job costs.");
    }

    const supplierId = resolved.partner?.id ?? "";
    const supplierName = resolved.partner?.name ?? (valueAt(cells, indexes, "supplier_name") || "Unresolved supplier");
    const supplierKey = supplierId ? supplierIdentityKey(supplierId, supplierName) : "";
    const normalizedBillReference = supplierBillReference ? normalizeSupplierBillReference(supplierBillReference) : null;

    if (!issues.length && recordType && currency && branch && supplierId) {
      if (recordType === "bill") {
        const key = billKey(supplierKey, supplierBillReference);
        for (const ref of existing.billKeys.get(key) ?? []) duplicateMatches.push(`${ref} · same supplier and supplier bill reference`);
        const earlier = seenBills.get(key);
        if (earlier) duplicateMatches.push(`CSV row ${earlier} · same supplier and supplier bill reference`);
        const reference = payableReference(recordType, supplierId, supplierBillReference, currency, branch);
        if (existing.references.has(reference)) duplicateMatches.push(`${reference} · deterministic migration reference already exists`);
      } else {
        const key = openingKey(supplierId, currency, branch);
        for (const ref of existing.openingKeys.get(key) ?? []) duplicateMatches.push(`${ref} · opening balance already exists for this supplier, currency and branch`);
        const earlier = seenOpenings.get(key);
        if (earlier) duplicateMatches.push(`CSV row ${earlier} · opening balance already supplied for this supplier, currency and branch`);
        const reference = payableReference(recordType, supplierId, null, currency, branch);
        if (existing.references.has(reference)) duplicateMatches.push(`${reference} · deterministic opening balance reference already exists`);
      }
    }

    const status = issues.length ? "invalid" : duplicateMatches.length ? "duplicate" : "ready";
    const billTotal = recordType === "opening_balance" ? balanceDueRaw ?? 0 : billTotalRaw ?? 0;
    const amountPaid = recordType === "opening_balance" ? 0 : amountPaidRaw ?? 0;
    const balanceDue = balanceDueRaw ?? 0;
    const billDate = recordType === "opening_balance" ? asOfDateRaw : billDateRaw;
    const effectiveCategory = recordType === "opening_balance" ? "other" : category ?? "other";
    const reference = recordType && currency && branch && supplierId
      ? payableReference(recordType, supplierId, recordType === "bill" ? supplierBillReference : null, currency, branch)
      : `INVALID-${rowNumber}`;
    const preview: PayablesImportPreviewRow = {
      row_number: rowNumber,
      status,
      record_type: recordType,
      supplier_id: supplierId || null,
      supplier_name: supplierName,
      shipment_reference: shipmentReference || null,
      branch,
      supplier_bill_reference: supplierBillReference || null,
      currency,
      category: recordType === "opening_balance" ? "other" : category,
      bill_date: billDate || null,
      due_date: dueDateRaw || null,
      as_of_date: asOfDateRaw || null,
      bill_total: recordType === "opening_balance" ? null : billTotalRaw,
      amount_paid: recordType === "opening_balance" ? null : amountPaidRaw,
      balance_due: balanceDueRaw,
      issues,
      duplicate_matches: [...new Set(duplicateMatches)],
    };

    prepared.push({
      rowNumber,
      reference,
      recordType: recordType ?? "bill",
      supplierId,
      supplierName,
      supplierKey,
      shipmentReference: shipmentReference || null,
      customerId: shipment?.customerId ?? null,
      customerName: shipment?.customerName ?? null,
      branch: branch ?? "Kathmandu",
      supplierBillReference: recordType === "bill" ? supplierBillReference || null : null,
      normalizedSupplierBillReference: recordType === "bill" ? normalizedBillReference : null,
      currency: currency ?? "NPR",
      category: effectiveCategory,
      billDate: billDate || today,
      dueDate: dueDateRaw || today,
      asOfDate: asOfDateRaw || today,
      billTotal,
      amountPaid,
      balanceDue,
      description: descriptionRaw || (recordType === "bill" ? `Imported supplier bill ${supplierBillReference}` : `Supplier opening balance as at ${asOfDateRaw}`),
      notes: notesRaw || null,
      preview,
    });

    if (status === "ready" && recordType && currency && branch && supplierId) {
      if (recordType === "bill") seenBills.set(billKey(supplierKey, supplierBillReference), rowNumber);
      else seenOpenings.set(openingKey(supplierId, currency, branch), rowNumber);
    }
  }

  const rows = prepared.map((row) => row.preview);
  const preview: PayablesImportPreview = {
    filename,
    total: rows.length,
    ready: rows.filter((row) => row.status === "ready").length,
    duplicates: rows.filter((row) => row.status === "duplicate").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    bill_rows: rows.filter((row) => row.record_type === "bill").length,
    opening_balance_rows: rows.filter((row) => row.record_type === "opening_balance").length,
    rows,
  };
  return { kind: "ready" as const, preview, prepared };
}

function statusFor(dueDate: string, amountPaid: number) {
  if (dueDate < operationalDate()) return "overdue" as const;
  return amountPaid > 0 ? "partially_paid" as const : "approved" as const;
}

export async function importPayablesCsv(filename: string, csv: string, actor: Actor) {
  const prepared = await preparePayablesImport(filename, csv);
  if (prepared.kind !== "ready") return prepared;

  const readyRows = prepared.prepared.filter((row) => row.preview.status === "ready");
  const batchId = `MIG-AP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const db = firebaseAdminDb();
  const batchRef = db.collection("migration_batches").doc(batchId);
  const startedAt = new Date().toISOString();
  const createdReferences: string[] = [];
  const affectedCustomers = new Set<string>();
  let billRowsImported = 0;
  let openingBalanceRowsImported = 0;

  await batchRef.create({
    schema_version: 1,
    batch_id: batchId,
    stage: 3,
    phase: "3b",
    type: "payables_csv",
    status: "running",
    source_filename: filename,
    total_rows: prepared.preview.total,
    ready_rows: prepared.preview.ready,
    duplicate_rows: prepared.preview.duplicates,
    invalid_rows: prepared.preview.invalid,
    bill_rows: prepared.preview.bill_rows,
    opening_balance_rows: prepared.preview.opening_balance_rows,
    imported_count: 0,
    created_payable_references: [],
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: startedAt,
    completed_at: null,
  });

  try {
    for (let index = 0; index < readyRows.length; index += 15) {
      const chunk = readyRows.slice(index, index + 15);
      const batch = db.batch();
      const now = new Date().toISOString();
      for (const row of chunk) {
        const payableRef = db.collection("payables").doc(row.reference);
        const status = statusFor(row.dueDate, row.amountPaid);
        batch.create(payableRef, {
          reference: row.reference,
          record_type: row.recordType,
          supplier_id: row.supplierId,
          supplier_key: row.supplierKey,
          supplier_name: row.supplierName,
          supplier_bill_reference: row.supplierBillReference,
          normalized_supplier_bill_reference: row.normalizedSupplierBillReference,
          shipment_reference: row.shipmentReference,
          customer_id: row.customerId,
          customer_name: row.customerName,
          branch: row.branch,
          category: row.category,
          status,
          bill_date: row.billDate,
          due_date: row.dueDate,
          currency: row.currency,
          description: row.description,
          subtotal: row.billTotal,
          tax_rate: 0,
          tax_total: 0,
          total: row.billTotal,
          amount_paid: row.amountPaid,
          balance_due: row.balanceDue,
          notes: row.notes,
          approved_at: row.recordType === "bill" ? `${row.billDate}T00:00:00.000Z` : `${row.asOfDate}T00:00:00.000Z`,
          migration_batch_id: batchId,
          migration_stage: "3b",
          migration_record_type: row.recordType,
          migration_source: "payables_csv_stage_3b",
          migration_source_filename: filename,
          migration_row_number: row.rowNumber,
          migration_as_of_date: row.asOfDate,
          migration_source_bill_number: row.supplierBillReference,
          created_by_name: actor.name,
          created_by_email: actor.email,
          created_at: now,
          updated_at: now,
        });

        if (row.amountPaid > 0) {
          batch.create(payableRef.collection("payments").doc(`migration-adjustment-${batchId}-${row.rowNumber}`), {
            payable_reference: row.reference,
            amount: row.amountPaid,
            currency: row.currency,
            payment_date: row.asOfDate,
            method: "adjustment",
            reference: `Stage 3B ${batchId}`,
            notes: `Aggregate pre-KCPL-digital supplier payments recorded as at ${row.asOfDate}. This is a migration opening adjustment, not reconstructed settlement history.`,
            recorded_by_name: actor.name,
            recorded_by_email: actor.email,
            created_at: now,
            migration_batch_id: batchId,
          });
        }

        batch.create(db.collection("partners").doc(row.supplierId).collection("activity").doc(childId("activity")), {
          type: "payables_migration",
          title: row.recordType === "opening_balance" ? `Opening payable imported: ${row.reference}` : `Supplier bill imported: ${row.supplierBillReference}`,
          detail: `${row.currency} ${row.balanceDue.toFixed(2)} outstanding as at ${row.asOfDate} · ${row.branch} · migration batch ${batchId}`,
          actor_name: actor.name,
          actor_email: actor.email,
          created_at: now,
          migration_batch_id: batchId,
        });

        if (row.recordType === "bill" && row.shipmentReference) {
          const shipmentRef = db.collection("shipments").doc(row.shipmentReference);
          batch.create(shipmentRef.collection("job_activity").doc(childId("activity")), {
            type: "payables_migration",
            title: `Historical supplier bill linked: ${row.supplierBillReference}`,
            detail: `${row.currency} ${row.billTotal.toFixed(2)} supplier cost · migration batch ${batchId}`,
            actor_name: actor.name,
            actor_email: actor.email,
            created_at: now,
            migration_batch_id: batchId,
          });
          batch.set(shipmentRef.collection("job_costs").doc(`payable_${row.reference}`), {
            category: row.category,
            label: row.description,
            vendor: row.supplierName,
            partner_id: row.supplierId,
            amount: row.billTotal,
            currency: row.currency,
            notes: row.supplierBillReference ? `Historical supplier bill ${row.supplierBillReference} · Stage 3B ${batchId}` : `Stage 3B ${batchId}`,
            source_type: "payable",
            source_reference: row.reference,
            locked: true,
            created_at: now,
            created_by: actor.email,
            updated_at: now,
            migration_batch_id: batchId,
          }, { merge: true });
        }
      }
      await batch.commit();

      for (const row of chunk) {
        createdReferences.push(row.reference);
        if (row.customerId && row.recordType === "bill" && row.shipmentReference) affectedCustomers.add(row.customerId);
        if (row.recordType === "bill") billRowsImported += 1;
        else openingBalanceRowsImported += 1;
      }
      await batchRef.set({
        imported_count: createdReferences.length,
        bill_rows_imported: billRowsImported,
        opening_balance_rows_imported: openingBalanceRowsImported,
        created_payable_references: createdReferences,
      }, { merge: true });
    }

    for (const customerId of affectedCustomers) await recomputeCustomerFinance(customerId);

    await batchRef.set({
      status: "completed",
      imported_count: createdReferences.length,
      bill_rows_imported: billRowsImported,
      opening_balance_rows_imported: openingBalanceRowsImported,
      created_payable_references: createdReferences,
      completed_at: new Date().toISOString(),
    }, { merge: true });

    const result: PayablesImportResult = {
      batch_id: batchId,
      filename,
      total: prepared.preview.total,
      imported: createdReferences.length,
      bill_rows_imported: billRowsImported,
      opening_balance_rows_imported: openingBalanceRowsImported,
      duplicates: prepared.preview.duplicates,
      invalid: prepared.preview.invalid,
      payable_references: createdReferences,
    };
    return { kind: "imported" as const, result };
  } catch (error) {
    await batchRef.set({
      status: "partial_failure",
      imported_count: createdReferences.length,
      bill_rows_imported: billRowsImported,
      opening_balance_rows_imported: openingBalanceRowsImported,
      created_payable_references: createdReferences,
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message.slice(0, 1000) : "Payables migration failed.",
    }, { merge: true });
    throw error;
  }
}
