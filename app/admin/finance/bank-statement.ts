/*
 * Bank statements, read and matched. A CSV exported from the bank is turned
 * into lines; each money-in line is offered the open invoices it most likely
 * pays. Accounts confirm a match and the payment is recorded through the
 * usual settlement, keyed by the line so a statement uploaded twice never
 * records anything twice.
 *
 * Pure: no Firebase, no node: modules (the page shows the same suggestions).
 */

export type StatementLine = {
  /** Stable for the same line in the same account, however often it is uploaded. */
  id: string;
  date: string;
  description: string;
  reference: string | null;
  credit: number;
  debit: number;
  balance: number | null;
};

export type ParsedStatement = { lines: StatementLine[]; errors: string[]; columns: Record<string, string | null> };

/** RFC 4180 CSV, with the quirks of bank exports: a BOM, CRLF, blank lines. */
export function parseCsv(source: string) {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function isoDate(year: number, month: number, day: number) {
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * A statement date. Nepali and Indian banks write the day first, so
 * 03/10/2026 is the 3rd of October. Times after the date are ignored.
 */
export function parseStatementDate(value: string) {
  const raw = value.trim().split(/[ T](?=\d{1,2}:)/)[0].trim();
  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (match) return isoDate(Number(match[3]), Number(match[2]), Number(match[1]));
  match = raw.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,4})[-/. ,]+(\d{2,4})$/);
  if (match && MONTHS[match[2].toLowerCase()]) return isoDate(Number(match[3]), MONTHS[match[2].toLowerCase()], Number(match[1]));
  match = raw.match(/^([A-Za-z]{3,4})[-/. ](\d{1,2})[-/. ,]+(\d{2,4})$/);
  if (match && MONTHS[match[1].toLowerCase()]) return isoDate(Number(match[3]), MONTHS[match[1].toLowerCase()], Number(match[2]));
  return null;
}

/** "1,13,000.00", "(500.00)", "2,500.00 Cr", "NPR 75.5": the number, signed. Blank is zero; unreadable is null. */
export function parseAmount(value: string) {
  const raw = value.trim();
  if (!raw || raw === "-") return 0;
  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw) || /\bdr\.?$/i.test(raw);
  const digits = raw.replace(/[()]/g, "").replace(/\b(cr|dr)\.?$/i, "").replace(/[A-Za-z₹]/g, "").replace(/,/g, "").replace(/^-/, "").trim();
  if (!/^\d+(\.\d+)?$/.test(digits)) return null;
  const amount = Math.round(Number(digits) * 100) / 100;
  return negative ? -amount : amount;
}

const HEADERS: Record<string, RegExp> = {
  date: /^(txn |tran(saction)? |value |posting )?date$|^date$|^txn date|^tran date|^transaction date/i,
  description: /description|narration|particular|remarks|details/i,
  reference: /ref|cheque|chq|instrument/i,
  credit: /^credit|deposit|^cr( amount)?$|money in|^paid in/i,
  debit: /^debit|withdraw|^dr( amount)?$|money out|^paid out/i,
  amount: /^amount$|^txn amount|^transaction amount/i,
  balance: /balance/i,
};

function findColumn(header: string[], kind: keyof typeof HEADERS, taken: Set<number>) {
  const index = header.findIndex((cell, position) => !taken.has(position) && HEADERS[kind].test(cell.trim()));
  if (index >= 0) taken.add(index);
  return index;
}

/** A short stable fingerprint for a line's text (cyrb53: 53 bits, no BigInt needed). */
function fingerprint(value: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function parseStatement(csv: string): ParsedStatement {
  const rows = parseCsv(csv);
  const errors: string[] = [];
  // The header is the first row that names a date and a description; banks put a few lines of account details above it.
  const headerIndex = rows.findIndex((row) => row.some((cell) => HEADERS.date.test(cell.trim())) && row.some((cell) => HEADERS.description.test(cell.trim())));
  if (headerIndex < 0) return { lines: [], errors: ["No header row with a date and a description was found. Export the statement as CSV with its column headings."], columns: {} };
  const header = rows[headerIndex];
  const taken = new Set<number>();
  const date = findColumn(header, "date", taken);
  const description = findColumn(header, "description", taken);
  const credit = findColumn(header, "credit", taken);
  const debit = findColumn(header, "debit", taken);
  const amount = credit < 0 && debit < 0 ? findColumn(header, "amount", taken) : -1;
  const balance = findColumn(header, "balance", taken);
  const reference = findColumn(header, "reference", taken);
  const columns = { date: header[date] ?? null, description: header[description] ?? null, credit: header[credit] ?? null, debit: header[debit] ?? null, amount: header[amount] ?? null, balance: header[balance] ?? null, reference: header[reference] ?? null };
  if (credit < 0 && debit < 0 && amount < 0) return { lines: [], errors: ["No credit, debit or amount column was found."], columns };

  const lines: StatementLine[] = [];
  const occurrences = new Map<string, number>();
  for (const [offset, row] of rows.slice(headerIndex + 1).entries()) {
    const rowNumber = headerIndex + offset + 2;
    const when = parseStatementDate(row[date] ?? "");
    if (!when) {
      // Opening and closing balance rows and totals have words where the date goes; skip them quietly.
      if (/\d/.test(row[date] ?? "")) errors.push(`Row ${rowNumber}: the date "${(row[date] ?? "").trim()}" couldn't be read.`);
      continue;
    }
    let inAmount = 0;
    let outAmount = 0;
    if (amount >= 0) {
      const signed = parseAmount(row[amount] ?? "");
      if (signed === null) { errors.push(`Row ${rowNumber}: the amount couldn't be read.`); continue; }
      if (signed >= 0) inAmount = signed; else outAmount = -signed;
    } else {
      const inValue = credit >= 0 ? parseAmount(row[credit] ?? "") : 0;
      const outValue = debit >= 0 ? parseAmount(row[debit] ?? "") : 0;
      if (inValue === null || outValue === null) { errors.push(`Row ${rowNumber}: an amount couldn't be read.`); continue; }
      inAmount = Math.abs(inValue);
      outAmount = Math.abs(outValue);
    }
    if (inAmount <= 0 && outAmount <= 0) continue;
    const balanceValue = balance >= 0 ? parseAmount(row[balance] ?? "") : null;
    const text = (row[description] ?? "").trim().replace(/\s+/g, " ");
    const ref = reference >= 0 ? (row[reference] ?? "").trim() || null : null;
    const key = `${when}|${inAmount}|${outAmount}|${text}|${ref ?? ""}|${balanceValue ?? ""}`;
    // Two identical lines on the same day (no balance column to tell them apart) are still two lines.
    const seen = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, seen);
    lines.push({
      id: `${when}-${Math.round((inAmount || outAmount) * 100)}-${fingerprint(`${key}|${seen}`)}`,
      date: when,
      description: text.slice(0, 400),
      reference: ref?.slice(0, 120) ?? null,
      credit: inAmount,
      debit: outAmount,
      balance: balanceValue,
    });
  }
  return { lines, errors: errors.slice(0, 20), columns };
}

export type MatchCandidate = {
  reference: string;
  number: string;
  customer_id: string;
  customer_name: string;
  currency: string;
  balance_due: number;
  total: number;
};

export type MatchSuggestion = MatchCandidate & { score: number; reasons: string[] };

function words(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((word) => word.length >= 4 && !["private", "limited", "pvt", "ltd", "company", "trading", "traders", "nepal", "transfer", "payment"].includes(word));
}

/**
 * The open invoices a money-in line most likely pays, best first. An exact
 * balance, the invoice number in the narration and the customer's name each
 * count; a suggestion below 40 is too weak to offer.
 */
export function suggestMatches(line: Pick<StatementLine, "credit" | "description" | "reference">, candidates: MatchCandidate[], currency = "NPR", limit = 3): MatchSuggestion[] {
  if (line.credit <= 0) return [];
  const narration = `${line.description} ${line.reference ?? ""}`;
  const compact = narration.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const narrationWords = new Set(words(narration));
  const scored: MatchSuggestion[] = [];
  for (const candidate of candidates) {
    if (candidate.currency !== currency || candidate.balance_due <= 0.005) continue;
    let score = 0;
    const reasons: string[] = [];
    if (Math.abs(candidate.balance_due - line.credit) < 0.005) { score += 50; reasons.push("Same as the balance due"); }
    else if (Math.abs(candidate.total - line.credit) < 0.005) { score += 25; reasons.push("Same as the invoice total"); }
    const numbers = [candidate.number, candidate.reference].map((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter((value) => value.length >= 5);
    if (numbers.some((value) => compact.includes(value))) { score += 60; reasons.push("Invoice number in the narration"); }
    else {
      // Banks often cut a number short: the series and sequence alone ("00012") still count when paired with the year.
      const tail = candidate.number.match(/(\d{4}-\d{2})\/(\d{3,})$/);
      if (tail && compact.includes(tail[2]) && compact.includes(tail[1].replace("-", ""))) { score += 40; reasons.push("Invoice number in the narration"); }
    }
    const nameWords = words(candidate.customer_name);
    if (nameWords.length && nameWords.some((word) => narrationWords.has(word))) { score += 25; reasons.push("Customer's name in the narration"); }
    if (line.credit - candidate.balance_due > 0.005 && score < 60) score -= 10;
    if (score >= 40) scored.push({ ...candidate, score, reasons });
  }
  return scored.sort((a, b) => b.score - a.score || a.balance_due - b.balance_due).slice(0, limit);
}

export function bankAccountKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "bank";
}
