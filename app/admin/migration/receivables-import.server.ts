import { createHash, randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { crmCurrencies, kcplBranches, type CrmCurrency, type KcplBranch } from "../crm/crm-data";
import { recomputeCustomerFinance } from "../finance/finance.server";
import {
  receivablesImportHeaders,
  type ReceivablesImportPreview,
  type ReceivablesImportPreviewRow,
  type ReceivablesImportRecordType,
  type ReceivablesImportResult,
} from "./receivables-import";

const MAX_ROWS = 150;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Actor = { name: string; email: string };
type CustomerRecord = {
  id: string;
  name: string;
  normalizedName: string;
  branch: KcplBranch | null;
  archived: boolean;
};
type ShipmentRecord = { id: string; customerId: string | null; branch: KcplBranch | null; quoteReference: string | null };
type PreparedReceivable = {
  rowNumber: number;
  reference: string;
  recordType: ReceivablesImportRecordType;
  customerId: string;
  customerName: string;
  shipmentReference: string | null;
  quoteReference: string | null;
  externalInvoiceNumber: string | null;
  branch: KcplBranch;
  currency: CrmCurrency;
  issueDate: string;
  dueDate: string;
  asOfDate: string;
  invoiceTotal: number;
  amountPaid: number;
  balanceDue: number;
  description: string;
  notes: string | null;
  preview: ReceivablesImportPreviewRow;
};

type ExistingReceivableIndex = {
  references: Set<string>;
  invoiceKeys: Map<string, string[]>;
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

function branchValue(value: unknown): KcplBranch | null {
  return kcplBranches.includes(value as KcplBranch) ? value as KcplBranch : null;
}

function currencyFrom(value: string): CrmCurrency | null {
  const normalized = value.trim().toUpperCase();
  return crmCurrencies.includes(normalized as CrmCurrency) ? normalized as CrmCurrency : null;
}

function recordTypeFrom(value: string): ReceivablesImportRecordType | null {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "invoice" || normalized === "opening_balance" ? normalized : null;
}

function numeric(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function receivableReference(recordType: ReceivablesImportRecordType, customerId: string, externalInvoiceNumber: string | null, currency: CrmCurrency) {
  const key = recordType === "invoice"
    ? `${customerId}|${normalize(externalInvoiceNumber ?? "")}`
    : `${customerId}|${currency}|opening_balance`;
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 18).toUpperCase();
  return recordType === "invoice" ? `KCPL-MIG-I-${hash}` : `KCPL-OB-${hash}`;
}

function invoiceKey(customerId: string, externalInvoiceNumber: string) {
  return `${customerId.toUpperCase()}|${normalize(externalInvoiceNumber)}`;
}

function openingKey(customerId: string, currency: CrmCurrency) {
  return `${customerId.toUpperCase()}|${currency}`;
}

function childId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
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
      branch: branchValue(doc.get("primary_branch")),
      archived: doc.get("archived") === true,
    };
    byId.set(doc.id.toUpperCase(), record);
    if (!record.archived && record.normalizedName) {
      const rows = byName.get(record.normalizedName) ?? [];
      rows.push(record);
      byName.set(record.normalizedName, rows);
    }
  }
  return { byId, byName };
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
  } else issues.push("Customer ID or exact customer name is required.");
  if (customer && !customer.branch) issues.push(`${customer.name} has invalid or missing branch data. Repair the CRM record before importing finance data.`);
  return { customer, issues };
}

async function loadShipment(reference: string, cache: Map<string, ShipmentRecord | null>) {
  const id = reference.trim().toUpperCase();
  if (!id) return null;
  if (cache.has(id)) return cache.get(id) ?? null;
  const snapshot = await firebaseAdminDb().collection("shipments").doc(id).get();
  const row = snapshot.exists ? {
    id: snapshot.id,
    customerId: text(snapshot.get("customer_id")) || null,
    branch: branchValue(snapshot.get("primary_branch")),
    quoteReference: text(snapshot.get("quote_reference")) || null,
  } : null;
  cache.set(id, row);
  return row;
}

async function loadExistingReceivables(): Promise<ExistingReceivableIndex> {
  const snapshot = await firebaseAdminDb().collection("invoices").limit(6000).get();
  const references = new Set<string>();
  const invoiceKeys = new Map<string, string[]>();
  const openingKeys = new Map<string, string[]>();
  for (const doc of snapshot.docs) {
    references.add(doc.id.toUpperCase());
    if (text(doc.get("status")) === "void") continue;
    const customerId = text(doc.get("customer_id")).toUpperCase();
    const recordType = text(doc.get("record_type")) || text(doc.get("migration_record_type"));
    if (recordType === "opening_balance" && customerId) {
      const currency = currencyFrom(text(doc.get("currency")));
      if (currency) {
        const key = openingKey(customerId, currency);
        const rows = openingKeys.get(key) ?? [];
        rows.push(doc.id);
        openingKeys.set(key, rows);
      }
      continue;
    }
    const external = text(doc.get("external_invoice_number")) || text(doc.get("migration_source_invoice_number"));
    if (customerId && external) {
      const key = invoiceKey(customerId, external);
      const rows = invoiceKeys.get(key) ?? [];
      rows.push(doc.id);
      invoiceKeys.set(key, rows);
    }
  }
  return { references, invoiceKeys, openingKeys };
}

export function receivablesCsvTemplate() {
  return `${receivablesImportHeaders.join(",")}\n`;
}

export function receivablesImportLimits() {
  return { maxRows: MAX_ROWS, maxFileBytes: MAX_FILE_BYTES };
}

export async function prepareReceivablesImport(filename: string, csv: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  let parsed: string[][];
  try { parsed = parseCsv(csv); }
  catch (error) { return { kind: "invalid_file" as const, error: error instanceof Error ? error.message : "The CSV could not be parsed." }; }
  if (!parsed.length) return { kind: "invalid_file" as const, error: "The CSV is empty." };

  const headers = parsed[0].map(normalizeHeader);
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const requiredHeaders = ["record_type", "customer_id", "customer_name", "shipment_reference", "external_invoice_number", "issue_date", "due_date", "as_of_date", "currency", "invoice_total", "amount_paid", "balance_due", "description", "notes"];
  const missingHeaders = requiredHeaders.filter((header) => !indexes.has(header));
  if (missingHeaders.length) return { kind: "invalid_file" as const, error: `Missing required column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}.` };

  const dataRows = parsed.slice(1).filter((cells) => cells.some((cell) => cell.trim()));
  if (!dataRows.length) return { kind: "invalid_file" as const, error: "Add at least one receivable row beneath the CSV header." };
  if (dataRows.length > MAX_ROWS) return { kind: "invalid_file" as const, error: `Stage 3A accepts up to ${MAX_ROWS} receivable rows per batch. Split this file into smaller batches.` };

  const [customers, existing] = await Promise.all([loadCustomers(), loadExistingReceivables()]);
  const shipmentCache = new Map<string, ShipmentRecord | null>();
  const seenInvoices = new Map<string, number>();
  const seenOpenings = new Map<string, number>();
  const prepared: PreparedReceivable[] = [];
  const today = operationalDate();

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
    const cells = dataRows[rowIndex];
    const rowNumber = rowIndex + 2;
    const recordType = recordTypeFrom(valueAt(cells, indexes, "record_type"));
    const resolved = resolveCustomer(valueAt(cells, indexes, "customer_id"), valueAt(cells, indexes, "customer_name"), customers);
    const externalInvoiceNumber = valueAt(cells, indexes, "external_invoice_number");
    const shipmentReference = valueAt(cells, indexes, "shipment_reference").toUpperCase();
    const issueDateRaw = valueAt(cells, indexes, "issue_date");
    const dueDateRaw = valueAt(cells, indexes, "due_date");
    const asOfDateRaw = valueAt(cells, indexes, "as_of_date");
    const currency = currencyFrom(valueAt(cells, indexes, "currency"));
    const invoiceTotalRaw = numeric(valueAt(cells, indexes, "invoice_total"));
    const amountPaidRaw = numeric(valueAt(cells, indexes, "amount_paid"));
    const balanceDueRaw = numeric(valueAt(cells, indexes, "balance_due"));
    const descriptionRaw = valueAt(cells, indexes, "description");
    const notesRaw = valueAt(cells, indexes, "notes");
    const issues = [...resolved.issues];
    const duplicateMatches: string[] = [];

    if (!recordType) issues.push("Record type must be invoice or opening_balance.");
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
        if (resolved.customer && shipment.customerId?.toUpperCase() !== resolved.customer.id.toUpperCase()) issues.push(`Shipment ${shipmentReference} belongs to a different customer.`);
      }
    }

    if (recordType === "invoice") {
      if (!externalInvoiceNumber) issues.push("External invoice number is required for invoice rows.");
      if (externalInvoiceNumber.length > 120) issues.push("External invoice number must be 120 characters or fewer.");
      if (!dateValid(issueDateRaw)) issues.push("Issue date must use YYYY-MM-DD for invoice rows.");
      else if (dateValid(asOfDateRaw) && issueDateRaw > asOfDateRaw) issues.push("Issue date cannot be after the as-of date.");
      if (dateValid(issueDateRaw) && dateValid(dueDateRaw) && dueDateRaw < issueDateRaw) issues.push("Due date cannot be before issue date.");
      if (invoiceTotalRaw === null || invoiceTotalRaw <= 0) issues.push("Invoice total must be greater than zero.");
      if (amountPaidRaw === null || amountPaidRaw < 0) issues.push("Amount paid must be zero or greater.");
      if (balanceDueRaw === null || balanceDueRaw <= 0) issues.push("Stage 3A imports open receivables only, so balance due must be greater than zero.");
      if (invoiceTotalRaw !== null && amountPaidRaw !== null && balanceDueRaw !== null && Math.abs(invoiceTotalRaw - amountPaidRaw - balanceDueRaw) > 0.011) issues.push("Invoice total minus amount paid must equal balance due.");
    }

    if (recordType === "opening_balance") {
      if (shipmentReference) issues.push("Opening balance rows are customer-level receivables and cannot be linked to a shipment.");
      if (externalInvoiceNumber) issues.push("Opening balance rows must not contain an external invoice number.");
      if (issueDateRaw) issues.push("Opening balance rows do not use issue_date. Leave it blank.");
      if (invoiceTotalRaw !== null && Math.abs(invoiceTotalRaw) > 0.001) issues.push("Opening balance rows do not use invoice_total. Leave it blank or zero.");
      if (amountPaidRaw !== null && Math.abs(amountPaidRaw) > 0.001) issues.push("Opening balance rows do not use amount_paid. Leave it blank or zero.");
      if (balanceDueRaw === null || balanceDueRaw <= 0) issues.push("Opening balance must be greater than zero.");
      if (!descriptionRaw) issues.push("Opening balance rows require a short description of the source ledger or paper balance.");
    }

    const customerId = resolved.customer?.id ?? "";
    const customerName = resolved.customer?.name ?? (valueAt(cells, indexes, "customer_name") || "Unresolved customer");
    const branch = shipment?.branch ?? resolved.customer?.branch ?? null;

    if (!issues.length && recordType && currency && customerId) {
      if (recordType === "invoice") {
        const key = invoiceKey(customerId, externalInvoiceNumber);
        for (const ref of existing.invoiceKeys.get(key) ?? []) duplicateMatches.push(`${ref} · same customer and external invoice number`);
        const earlier = seenInvoices.get(key);
        if (earlier) duplicateMatches.push(`CSV row ${earlier} · same customer and external invoice number`);
        const reference = receivableReference(recordType, customerId, externalInvoiceNumber, currency);
        if (existing.references.has(reference)) duplicateMatches.push(`${reference} · deterministic migration reference already exists`);
      } else {
        const key = openingKey(customerId, currency);
        for (const ref of existing.openingKeys.get(key) ?? []) duplicateMatches.push(`${ref} · opening balance already exists for this customer and currency`);
        const earlier = seenOpenings.get(key);
        if (earlier) duplicateMatches.push(`CSV row ${earlier} · opening balance already supplied for this customer and currency`);
        const reference = receivableReference(recordType, customerId, null, currency);
        if (existing.references.has(reference)) duplicateMatches.push(`${reference} · deterministic opening balance reference already exists`);
      }
    }

    const status = issues.length ? "invalid" : duplicateMatches.length ? "duplicate" : "ready";
    const invoiceTotal = recordType === "opening_balance" ? balanceDueRaw ?? 0 : invoiceTotalRaw ?? 0;
    const amountPaid = recordType === "opening_balance" ? 0 : amountPaidRaw ?? 0;
    const balanceDue = balanceDueRaw ?? 0;
    const issueDate = recordType === "opening_balance" ? asOfDateRaw : issueDateRaw;
    const reference = recordType && currency && customerId ? receivableReference(recordType, customerId, recordType === "invoice" ? externalInvoiceNumber : null, currency) : `INVALID-${rowNumber}`;
    const preview: ReceivablesImportPreviewRow = {
      row_number: rowNumber,
      status,
      record_type: recordType,
      customer_id: customerId || null,
      customer_name: customerName,
      shipment_reference: shipmentReference || null,
      external_invoice_number: externalInvoiceNumber || null,
      branch,
      currency,
      issue_date: issueDate || null,
      due_date: dueDateRaw || null,
      as_of_date: asOfDateRaw || null,
      invoice_total: recordType === "opening_balance" ? null : invoiceTotalRaw,
      amount_paid: recordType === "opening_balance" ? null : amountPaidRaw,
      balance_due: balanceDueRaw,
      issues,
      duplicate_matches: [...new Set(duplicateMatches)],
    };

    if (recordType && currency && customerId && branch) {
      prepared.push({
        rowNumber,
        reference,
        recordType,
        customerId,
        customerName,
        shipmentReference: shipmentReference || null,
        quoteReference: shipment?.quoteReference ?? null,
        externalInvoiceNumber: recordType === "invoice" ? externalInvoiceNumber : null,
        branch,
        currency,
        issueDate,
        dueDate: dueDateRaw,
        asOfDate: asOfDateRaw,
        invoiceTotal,
        amountPaid,
        balanceDue,
        description: descriptionRaw || (recordType === "invoice" ? `Imported receivable ${externalInvoiceNumber}` : `Opening receivable balance as at ${asOfDateRaw}`),
        notes: notesRaw || null,
        preview,
      });
    } else {
      prepared.push({
        rowNumber,
        reference,
        recordType: recordType ?? "invoice",
        customerId,
        customerName,
        shipmentReference: shipmentReference || null,
        quoteReference: shipment?.quoteReference ?? null,
        externalInvoiceNumber: externalInvoiceNumber || null,
        branch: branch ?? "Kathmandu",
        currency: currency ?? "NPR",
        issueDate: issueDate || today,
        dueDate: dueDateRaw || today,
        asOfDate: asOfDateRaw || today,
        invoiceTotal,
        amountPaid,
        balanceDue,
        description: descriptionRaw,
        notes: notesRaw || null,
        preview,
      });
    }

    if (status === "ready" && recordType && currency && customerId) {
      if (recordType === "invoice") seenInvoices.set(invoiceKey(customerId, externalInvoiceNumber), rowNumber);
      else seenOpenings.set(openingKey(customerId, currency), rowNumber);
    }
  }

  const rows = prepared.map((row) => row.preview);
  const preview: ReceivablesImportPreview = {
    filename,
    total: rows.length,
    ready: rows.filter((row) => row.status === "ready").length,
    duplicates: rows.filter((row) => row.status === "duplicate").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    invoice_rows: rows.filter((row) => row.record_type === "invoice").length,
    opening_balance_rows: rows.filter((row) => row.record_type === "opening_balance").length,
    rows,
  };
  return { kind: "ready" as const, preview, prepared };
}

function statusFor(dueDate: string, amountPaid: number) {
  if (dueDate < operationalDate()) return "overdue" as const;
  return amountPaid > 0 ? "partially_paid" as const : "issued" as const;
}

export async function importReceivablesCsv(filename: string, csv: string, actor: Actor) {
  const prepared = await prepareReceivablesImport(filename, csv);
  if (prepared.kind !== "ready") return prepared;

  const readyRows = prepared.prepared.filter((row) => row.preview.status === "ready");
  const batchId = `MIG-AR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const db = firebaseAdminDb();
  const batchRef = db.collection("migration_batches").doc(batchId);
  const startedAt = new Date().toISOString();
  const createdReferences: string[] = [];
  const affectedCustomers = new Set<string>();
  let invoiceRowsImported = 0;
  let openingBalanceRowsImported = 0;

  await batchRef.create({
    schema_version: 1,
    batch_id: batchId,
    stage: 3,
    phase: "3a",
    type: "receivables_csv",
    status: "running",
    source_filename: filename,
    total_rows: prepared.preview.total,
    ready_rows: prepared.preview.ready,
    duplicate_rows: prepared.preview.duplicates,
    invalid_rows: prepared.preview.invalid,
    invoice_rows: prepared.preview.invoice_rows,
    opening_balance_rows: prepared.preview.opening_balance_rows,
    imported_count: 0,
    created_receivable_references: [],
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: startedAt,
    completed_at: null,
  });

  try {
    for (let index = 0; index < readyRows.length; index += 20) {
      const chunk = readyRows.slice(index, index + 20);
      const batch = db.batch();
      const now = new Date().toISOString();
      for (const row of chunk) {
        const invoiceRef = db.collection("invoices").doc(row.reference);
        const lineId = childId("line");
        const status = statusFor(row.dueDate, row.amountPaid);
        const recordLabel = row.recordType === "opening_balance" ? "Opening receivable balance" : row.description;
        batch.create(invoiceRef, {
          reference: row.reference,
          record_type: row.recordType,
          external_invoice_number: row.externalInvoiceNumber,
          customer_id: row.customerId,
          customer_name: row.customerName,
          shipment_reference: row.shipmentReference,
          quote_reference: row.quoteReference,
          branch: row.branch,
          status,
          issue_date: row.issueDate,
          due_date: row.dueDate,
          currency: row.currency,
          line_items: [{
            id: lineId,
            description: recordLabel,
            quantity: 1,
            unit_price: row.invoiceTotal,
            tax_rate: 0,
            subtotal: row.invoiceTotal,
            tax_amount: 0,
            total: row.invoiceTotal,
          }],
          subtotal: row.invoiceTotal,
          tax_total: 0,
          total: row.invoiceTotal,
          amount_paid: row.amountPaid,
          balance_due: row.balanceDue,
          notes: row.notes,
          issued_at: row.recordType === "invoice" ? `${row.issueDate}T00:00:00.000Z` : null,
          migration_batch_id: batchId,
          migration_stage: "3a",
          migration_source: "receivables_csv_stage_3a",
          migration_source_filename: filename,
          migration_row_number: row.rowNumber,
          migration_as_of_date: row.asOfDate,
          migration_source_invoice_number: row.externalInvoiceNumber,
          created_by_name: actor.name,
          created_by_email: actor.email,
          created_at: now,
          updated_at: now,
        });

        if (row.amountPaid > 0) {
          batch.create(invoiceRef.collection("payments").doc(`migration-adjustment-${batchId}-${row.rowNumber}`), {
            invoice_reference: row.reference,
            amount: row.amountPaid,
            currency: row.currency,
            payment_date: row.asOfDate,
            method: "adjustment",
            reference: `Stage 3A ${batchId}`,
            notes: `Aggregate pre-KCPL-digital collections recorded as at ${row.asOfDate}. This is a migration opening adjustment, not a reconstructed payment history.`,
            recorded_by_name: actor.name,
            recorded_by_email: actor.email,
            created_at: now,
            migration_batch_id: batchId,
          });
        }

        batch.create(db.collection("customers").doc(row.customerId).collection("activity").doc(childId("activity")), {
          type: "finance_migration",
          title: row.recordType === "opening_balance" ? `Opening receivable imported: ${row.reference}` : `Receivable imported: ${row.externalInvoiceNumber}`,
          detail: `${row.currency} ${row.balanceDue.toFixed(2)} outstanding as at ${row.asOfDate} · migration batch ${batchId}`,
          actor_name: actor.name,
          actor_email: actor.email,
          created_at: now,
          migration_batch_id: batchId,
        });

        if (row.shipmentReference) {
          batch.create(db.collection("shipments").doc(row.shipmentReference).collection("job_activity").doc(childId("activity")), {
            type: "finance_migration",
            title: `Historical receivable linked: ${row.externalInvoiceNumber}`,
            detail: `${row.currency} ${row.balanceDue.toFixed(2)} outstanding · migration batch ${batchId}`,
            actor_name: actor.name,
            actor_email: actor.email,
            created_at: now,
            migration_batch_id: batchId,
          });
        }
      }
      await batch.commit();

      for (const row of chunk) {
        createdReferences.push(row.reference);
        affectedCustomers.add(row.customerId);
        if (row.recordType === "invoice") invoiceRowsImported += 1;
        else openingBalanceRowsImported += 1;
      }
      await batchRef.set({
        imported_count: createdReferences.length,
        invoice_rows_imported: invoiceRowsImported,
        opening_balance_rows_imported: openingBalanceRowsImported,
        created_receivable_references: createdReferences,
      }, { merge: true });
    }

    for (const customerId of affectedCustomers) await recomputeCustomerFinance(customerId);

    const completedAt = new Date().toISOString();
    await batchRef.set({
      status: "completed",
      imported_count: createdReferences.length,
      invoice_rows_imported: invoiceRowsImported,
      opening_balance_rows_imported: openingBalanceRowsImported,
      created_receivable_references: createdReferences,
      completed_at: completedAt,
    }, { merge: true });

    const result: ReceivablesImportResult = {
      batch_id: batchId,
      filename,
      total: prepared.preview.total,
      imported: createdReferences.length,
      invoice_rows_imported: invoiceRowsImported,
      opening_balance_rows_imported: openingBalanceRowsImported,
      duplicates: prepared.preview.duplicates,
      invalid: prepared.preview.invalid,
      receivable_references: createdReferences,
    };
    return { kind: "imported" as const, result };
  } catch (error) {
    await batchRef.set({
      status: "partial_failure",
      imported_count: createdReferences.length,
      invoice_rows_imported: invoiceRowsImported,
      opening_balance_rows_imported: openingBalanceRowsImported,
      created_receivable_references: createdReferences,
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message.slice(0, 1000) : "Receivables migration failed.",
    }, { merge: true });
    throw error;
  }
}
