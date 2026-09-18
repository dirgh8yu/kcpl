// Cell policy for management CSV exports (#65 item 4).
//
// Quoting commas, quotes and newlines is not enough. A spreadsheet treats a cell
// beginning with `=`, `+`, `-`, `@`, a tab or a carriage return as a formula, so a
// customer name, an origin or a staff value supplied by a user becomes executable
// content the moment Management opens the export in Excel or Sheets. A text cell
// is therefore neutralised with a leading apostrophe, which spreadsheet software
// reads as "this is text" and does not display.
//
// The distinction that makes this usable rather than destructive: `-1234.5` in a
// revenue column is a number, not a formula, and must stay one. Only genuine JS
// numbers are emitted bare; every string is treated as text, including one that
// merely looks numeric, because a string reaching this module came from data KCPL
// does not control.
//
// Dependency-free so `tests/csv-export-policy.test.mjs` can exercise it directly.

/** Characters a spreadsheet interprets as the start of a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function hasFormulaPrefix(text: string): boolean {
  return FORMULA_PREFIX.test(text);
}

/**
 * A text cell: neutralised if it could be read as a formula, then quoted if it
 * contains a delimiter or a line break.
 */
export function csvTextCell(text: string): string {
  const neutralised = hasFormulaPrefix(text) ? `'${text}` : text;
  return /[",\n\r]/.test(neutralised) ? `"${neutralised.replaceAll('"', '""')}"` : neutralised;
}

/** A cell whose column is known to be numeric. Anything else falls back to text. */
export function csvCell(value: unknown): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value === null || value === undefined) return "";
  return csvTextCell(String(value));
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}
