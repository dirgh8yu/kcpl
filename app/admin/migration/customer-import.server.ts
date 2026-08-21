import { randomBytes } from "node:crypto";
import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import {
  crmAccountStatuses,
  crmCurrencies,
  crmEntityKinds,
  crmLeadSources,
  crmLeadStages,
  kcplBranches,
  type CrmAccountStatus,
  type CrmCreateCustomerInput,
  type CrmCurrency,
  type CrmEntityKind,
  type CrmLeadSource,
  type CrmLeadStage,
  type KcplBranch,
} from "../crm/crm-data";
import { createCrmCustomer } from "../crm/crm-data.server";
import { customerImportHeaders, type CustomerImportPreview, type CustomerImportPreviewRow, type CustomerImportResult } from "./customer-import";

const MAX_ROWS = 250;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Actor = { name: string; email: string };
type PreparedRow = { rowNumber: number; input: CrmCreateCustomerInput; preview: CustomerImportPreviewRow };

type ExistingMatch = { id: string; name: string; reason: "name" | "email" | "phone" | "tax ID" };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
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
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (quoted) throw new Error("The CSV contains an unterminated quoted value.");
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function emailValid(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function enumOrDefault<T extends readonly string[]>(value: string, values: T, fallback: T[number]) {
  const normalized = value.trim().toLowerCase();
  return (values.includes(normalized as T[number]) ? normalized : fallback) as T[number];
}

function branchFrom(value: string): KcplBranch | null {
  const match = kcplBranches.find((branch) => branch.toLowerCase() === value.trim().toLowerCase());
  return match ?? null;
}

function keyPairs(input: Pick<CrmCreateCustomerInput, "displayName" | "primaryEmail" | "primaryPhone" | "taxId">) {
  return [
    ["name", normalize(input.displayName)],
    ["email", normalize(input.primaryEmail)],
    ["phone", normalizePhone(input.primaryPhone)],
    ["tax ID", normalize(input.taxId)],
  ] as const;
}

async function existingMatches() {
  const map = new Map<string, ExistingMatch[]>();
  const snapshot = await firebaseAdminDb().collection("customers").limit(5000).get();
  for (const doc of snapshot.docs) {
    if (doc.get("archived") === true) continue;
    const name = text(doc.get("display_name")) || doc.id;
    const values = [
      ["name", text(doc.get("normalized_name")) || normalize(text(doc.get("display_name")))],
      ["email", text(doc.get("normalized_email")) || normalize(text(doc.get("primary_email")))],
      ["phone", text(doc.get("normalized_phone")) || normalizePhone(text(doc.get("primary_phone")))],
      ["tax ID", text(doc.get("normalized_tax_id")) || normalize(text(doc.get("tax_id")))],
    ] as const;
    for (const [reason, value] of values) {
      if (!value) continue;
      const key = `${reason}:${value}`;
      const matches = map.get(key) ?? [];
      matches.push({ id: doc.id, name, reason });
      map.set(key, matches);
    }
  }
  return map;
}

function valueAt(cells: string[], indexes: Map<string, number>, header: string) {
  const index = indexes.get(header);
  return index === undefined ? "" : text(cells[index]);
}

function listValue(value: string) {
  return value.split(/[;|]/).map((item) => item.trim()).filter(Boolean).slice(0, 30);
}

function makeInput(cells: string[], indexes: Map<string, number>) {
  const branch = branchFrom(valueAt(cells, indexes, "primary_branch"));
  const entityKind = enumOrDefault(valueAt(cells, indexes, "entity_kind"), crmEntityKinds, "company") as CrmEntityKind;
  const accountStatus = enumOrDefault(valueAt(cells, indexes, "account_status"), crmAccountStatuses, "prospect") as CrmAccountStatus;
  const leadStage = enumOrDefault(valueAt(cells, indexes, "lead_stage"), crmLeadStages, "new_lead") as CrmLeadStage;
  const rawLeadSource = valueAt(cells, indexes, "lead_source").toLowerCase();
  const leadSource = rawLeadSource && crmLeadSources.includes(rawLeadSource as CrmLeadSource) ? rawLeadSource as CrmLeadSource : "";
  const preferredCurrency = enumOrDefault(valueAt(cells, indexes, "preferred_currency"), crmCurrencies, "NPR") as CrmCurrency;

  const input: CrmCreateCustomerInput = {
    entityKind,
    displayName: valueAt(cells, indexes, "display_name"),
    legalName: valueAt(cells, indexes, "legal_name"),
    tradingName: valueAt(cells, indexes, "trading_name"),
    relationshipTypes: ["customer"],
    accountStatus,
    leadStage,
    leadSource,
    primaryEmail: valueAt(cells, indexes, "primary_email").toLowerCase(),
    primaryPhone: valueAt(cells, indexes, "primary_phone"),
    website: valueAt(cells, indexes, "website"),
    industry: valueAt(cells, indexes, "industry"),
    taxId: valueAt(cells, indexes, "tax_id"),
    country: valueAt(cells, indexes, "country") || "Nepal",
    primaryBranch: branch ?? "Kathmandu",
    accountManagerName: "",
    accountManagerEmail: "",
    accountManagerPhone: "",
    billingEmail: valueAt(cells, indexes, "billing_email").toLowerCase(),
    preferredCurrency,
    paymentTermsDays: "",
    creditLimit: "",
    outstandingBalance: "",
    pricingNotes: "",
    markupPercent: "",
    preferredCarriers: [],
    transportPreferences: [],
    tags: listValue(valueAt(cells, indexes, "tags")),
    internalSummary: valueAt(cells, indexes, "internal_summary"),
  };
  return { input, branch, raw: {
    entityKind: valueAt(cells, indexes, "entity_kind"),
    accountStatus: valueAt(cells, indexes, "account_status"),
    leadStage: valueAt(cells, indexes, "lead_stage"),
    leadSource: valueAt(cells, indexes, "lead_source"),
    preferredCurrency: valueAt(cells, indexes, "preferred_currency"),
  } };
}

function enumIssue(value: string, allowed: readonly string[], label: string) {
  if (!value) return null;
  return allowed.includes(value.toLowerCase()) ? null : `${label} must be one of: ${allowed.join(", ")}.`;
}

export function customerCsvTemplate() {
  return `${customerImportHeaders.join(",")}\n`;
}

export function customerImportLimits() {
  return { maxRows: MAX_ROWS, maxFileBytes: MAX_FILE_BYTES };
}

export async function prepareCustomerImport(filename: string, csv: string) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const parsed = parseCsv(csv);
  if (!parsed.length) return { kind: "invalid_file" as const, error: "The CSV is empty." };
  const headers = parsed[0].map(normalizeHeader);
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const missingHeaders = ["display_name", "primary_branch"].filter((header) => !indexes.has(header));
  if (missingHeaders.length) return { kind: "invalid_file" as const, error: `Missing required column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}.` };

  const dataRows = parsed.slice(1).filter((cells) => cells.some((cell) => cell.trim()));
  if (!dataRows.length) return { kind: "invalid_file" as const, error: "Add at least one customer row beneath the CSV header." };
  if (dataRows.length > MAX_ROWS) return { kind: "invalid_file" as const, error: `Stage 1 accepts up to ${MAX_ROWS} customer rows per batch. Split this file into smaller batches.` };

  const existing = await existingMatches();
  const seen = new Map<string, number>();
  const prepared: PreparedRow[] = [];

  dataRows.forEach((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const { input, branch, raw } = makeInput(cells, indexes);
    const issues: string[] = [];
    if (!input.displayName) issues.push("Display name is required.");
    if (!branch) issues.push(`Primary branch must be one of: ${kcplBranches.join(", ")}.`);
    if (!emailValid(input.primaryEmail)) issues.push("Primary email is not valid.");
    if (!emailValid(input.billingEmail)) issues.push("Billing email is not valid.");
    for (const issue of [
      enumIssue(raw.entityKind, crmEntityKinds, "Entity kind"),
      enumIssue(raw.accountStatus, crmAccountStatuses, "Account status"),
      enumIssue(raw.leadStage, crmLeadStages, "Lead stage"),
      enumIssue(raw.leadSource, crmLeadSources, "Lead source"),
      enumIssue(raw.preferredCurrency, crmCurrencies, "Preferred currency"),
    ]) if (issue) issues.push(issue);

    const duplicateMatches: string[] = [];
    if (!issues.length) {
      for (const [reason, keyValue] of keyPairs(input)) {
        if (!keyValue) continue;
        const key = `${reason}:${keyValue}`;
        for (const match of existing.get(key) ?? []) duplicateMatches.push(`${match.id} · ${match.name} · matching ${match.reason}`);
        const earlierRow = seen.get(key);
        if (earlierRow) duplicateMatches.push(`CSV row ${earlierRow} · matching ${reason}`);
      }
    }

    const status = issues.length ? "invalid" : duplicateMatches.length ? "duplicate" : "ready";
    const preview: CustomerImportPreviewRow = {
      row_number: rowNumber,
      status,
      display_name: input.displayName || "Unnamed row",
      primary_branch: branch,
      primary_email: input.primaryEmail,
      primary_phone: input.primaryPhone,
      tax_id: input.taxId,
      issues,
      duplicate_matches: [...new Set(duplicateMatches)],
    };
    prepared.push({ rowNumber, input, preview });

    if (status === "ready") {
      for (const [reason, keyValue] of keyPairs(input)) if (keyValue) seen.set(`${reason}:${keyValue}`, rowNumber);
    }
  });

  const rows = prepared.map((row) => row.preview);
  const preview: CustomerImportPreview = {
    filename,
    total: rows.length,
    ready: rows.filter((row) => row.status === "ready").length,
    duplicates: rows.filter((row) => row.status === "duplicate").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    rows,
  };
  return { kind: "ready" as const, preview, prepared };
}

export async function importCustomerCsv(filename: string, csv: string, actor: Actor) {
  const prepared = await prepareCustomerImport(filename, csv);
  if (prepared.kind !== "ready") return prepared;

  const readyRows = prepared.prepared.filter((row) => row.preview.status === "ready");
  const batchId = `MIG-CUST-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const db = firebaseAdminDb();
  const batchRef = db.collection("migration_batches").doc(batchId);
  const startedAt = new Date().toISOString();
  const customerIds: string[] = [];

  await batchRef.create({
    schema_version: 1,
    batch_id: batchId,
    stage: 1,
    type: "customer_csv",
    status: "running",
    source_filename: filename,
    total_rows: prepared.preview.total,
    ready_rows: prepared.preview.ready,
    duplicate_rows: prepared.preview.duplicates,
    invalid_rows: prepared.preview.invalid,
    imported_count: 0,
    created_customer_ids: [],
    created_by_name: actor.name,
    created_by_email: actor.email,
    created_at: startedAt,
    completed_at: null,
  });

  try {
    for (let index = 0; index < readyRows.length; index += 10) {
      const chunk = readyRows.slice(index, index + 10);
      const results = await Promise.all(chunk.map(async (row) => ({ row, result: await createCrmCustomer(row.input, actor) })));
      const linkBatch = db.batch();
      for (const { row, result } of results) {
        if (result.kind !== "created") throw new Error("Customer storage became unavailable during the migration batch.");
        customerIds.push(result.customer.id);
        linkBatch.set(db.collection("customers").doc(result.customer.id), {
          migration_batch_id: batchId,
          migration_source: "customer_csv_stage_1",
          migration_source_filename: filename,
          migration_row_number: row.rowNumber,
          migration_imported_at: new Date().toISOString(),
        }, { merge: true });
      }
      await linkBatch.commit();
      await batchRef.set({ imported_count: customerIds.length, created_customer_ids: customerIds }, { merge: true });
    }

    const completedAt = new Date().toISOString();
    await batchRef.set({ status: "completed", imported_count: customerIds.length, created_customer_ids: customerIds, completed_at: completedAt }, { merge: true });
    const result: CustomerImportResult = {
      batch_id: batchId,
      filename,
      total: prepared.preview.total,
      imported: customerIds.length,
      duplicates: prepared.preview.duplicates,
      invalid: prepared.preview.invalid,
      customer_ids: customerIds,
    };
    return { kind: "imported" as const, result };
  } catch (error) {
    await batchRef.set({
      status: "partial_failure",
      imported_count: customerIds.length,
      created_customer_ids: customerIds,
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message.slice(0, 1000) : "Customer migration failed.",
    }, { merge: true });
    throw error;
  }
}
