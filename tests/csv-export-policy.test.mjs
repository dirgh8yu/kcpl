import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { csvCell, csvRow, csvTextCell, hasFormulaPrefix } from "../app/admin/management/csv-export-policy.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, "utf8");
const exportRoute = source("app/api/admin/management/export/route.ts");
const policySource = source("app/admin/management/csv-export-policy.ts");

// The cell as a spreadsheet reads it once CSV quoting is removed, so a leader that also
// forces quoting (a carriage return) is checked for neutralisation rather than for a prefix.
const cellContent = (cell) =>
  cell.startsWith('"') && cell.endsWith('"') ? cell.slice(1, -1).replaceAll('""', '"') : cell;

test("a text cell that a spreadsheet would execute is neutralised", () => {
  // The classic payload: opening the export in Excel must not run this.
  const payload = "=cmd|' /C calc'!A0";
  assert.equal(hasFormulaPrefix(payload), true);
  assert.equal(csvTextCell(payload), `'${payload}`);
  assert.equal(csvCell(payload), `'${payload}`);
});

test("every formula leader a spreadsheet honours is neutralised", () => {
  for (const leader of ["=", "+", "-", "@", "\t", "\r"]) {
    const value = `${leader}1+1`;
    assert.equal(hasFormulaPrefix(value), true, `${JSON.stringify(leader)} must be treated as a formula leader`);
    assert.equal(cellContent(csvCell(value)).startsWith("'"), true, `${JSON.stringify(leader)} value must be neutralised`);
  }
});

test("ordinary text is emitted untouched", () => {
  assert.equal(csvCell("Kathmandu"), "Kathmandu");
  assert.equal(csvCell("Sea freight"), "Sea freight");
  assert.equal(csvCell("USD"), "USD");
  assert.equal(hasFormulaPrefix("Kathmandu"), false);
});

test("numeric columns stay numeric so spreadsheets can sum them", () => {
  // The requirement that makes the fix usable: a negative number is not a formula.
  assert.equal(csvCell(-1234.5), "-1234.5");
  assert.equal(csvCell(0), "0");
  assert.equal(csvCell(42), "42");
  assert.equal(csvCell(12.5), "12.5");
});

test("a string that merely looks numeric is still treated as text", () => {
  // Data KCPL does not control reaching a text column must not be trusted as a number.
  assert.equal(csvCell("-1234.5"), "'-1234.5");
  assert.equal(csvCell("+91 98110 00000"), "'+91 98110 00000");
});

test("delimiters, quotes and line breaks are still quoted and escaped", () => {
  assert.equal(csvCell("Kathmandu, Nepal"), '"Kathmandu, Nepal"');
  assert.equal(csvCell('Say "hi"'), '"Say ""hi"""');
  assert.equal(csvCell("line\nbreak"), '"line\nbreak"');
  assert.equal(csvCell("carriage\rreturn"), '"carriage\rreturn"');
  // A neutralised cell that also needs quoting gets both treatments.
  assert.equal(csvCell("=a,b"), '"\'=a,b"');
});

test("empty cells export as empty, not as the string null", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
  assert.equal(csvCell(""), "");
  assert.equal(csvCell(Number.NaN), "");
  assert.equal(csvCell(Number.POSITIVE_INFINITY), "");
});

test("booleans export as spreadsheet booleans", () => {
  assert.equal(csvCell(true), "TRUE");
  assert.equal(csvCell(false), "FALSE");
});

test("a row joins cells with commas", () => {
  assert.equal(csvRow(["Kathmandu", -5, null, "a,b"]), 'Kathmandu,-5,,"a,b"');
});

test("the export route uses the shared cell policy instead of its own quoting", () => {
  assert.match(exportRoute, /from "\.\.\/\.\.\/\.\.\/\.\.\/admin\/management\/csv-export-policy"/);
  assert.match(exportRoute, /csvRow as row/);
  // The route must not carry a second, unneutralised implementation.
  assert.doesNotMatch(exportRoute, /function csvCell/);
  assert.doesNotMatch(exportRoute, /replaceAll\('"', '""'\)/);
});

test("the policy stays dependency-free so it can be tested and reused", () => {
  assert.doesNotMatch(policySource, /^import /m);
  assert.doesNotMatch(policySource, /require\(/);
});
