import type { Statement } from "./portal-statement";

/*
 * The statement as a PDF, written directly (no library), in the manner of
 * the freight documents (app/admin/freight-documents/freight-document-pdf.ts):
 * Helvetica, A4, and columns placed by position with amounts set right.
 */

type Cell = { text: string; x: number; right?: boolean; bold?: boolean };
type Row = { cells: Cell[]; size?: number; gapBefore?: number; rule?: boolean };

function ascii(value: string) {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "?");
}

function escapePdf(value: string) {
  return ascii(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

/** Helvetica advance widths (per 1000 em) for what statements print. */
function width(value: string, size: number, bold = false) {
  let units = 0;
  for (const char of ascii(value)) {
    if (/[0-9]/.test(char)) units += 556;
    else if (char === "," || char === "." || char === " ") units += 278;
    else if (char === "-") units += 333;
    else if (/[A-Z]/.test(char)) units += bold ? 722 : 667;
    else units += bold ? 556 : 500;
  }
  return (units / 1000) * size;
}

function money(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function date(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const RIGHT = 545;

function rows(statement: Statement, customerName: string, generatedAt: string): Row[] {
  const out: Row[] = [];
  const line = (text: string, size = 9, bold = false, gapBefore = 0) => out.push({ cells: [{ text, x: 50, bold }], size, gapBefore });
  line("KAPILESHWOR CARGO PVT. LTD. (KCPL)", 15, true);
  line("Statement of account", 13, true, 4);
  line(customerName, 11, true, 8);
  line(`As of ${date(statement.asOf)}  -  Activity from ${date(statement.since)}  -  Generated ${generatedAt}`, 8, false, 2);

  if (!statement.currencies.length) {
    line("Nothing is owed and no invoices or payments fall in this period.", 10, false, 16);
  }

  for (const currency of statement.currencies) {
    out.push({ cells: [{ text: `${currency.currency}`, x: 50, bold: true }], size: 12, gapBefore: 18, rule: true });
    const summary: Array<[string, number]> = [
      ["Owed now", currency.outstanding],
      ["Of which overdue", currency.overdue],
      ["Invoiced in the period", currency.invoiced],
      ["Received in the period", currency.received],
    ];
    for (const [label, amount] of summary) {
      out.push({ cells: [{ text: label, x: 50 }, { text: money(amount), x: 250, right: true, bold: label === "Owed now" }], size: 10, gapBefore: 2 });
    }

    // Ageing of what is owed.
    out.push({
      cells: [
        { text: "Not yet due", x: 150, right: true, bold: true },
        { text: "1-30 days", x: 240, right: true, bold: true },
        { text: "31-60 days", x: 330, right: true, bold: true },
        { text: "61-90 days", x: 420, right: true, bold: true },
        { text: "Over 90 days", x: RIGHT, right: true, bold: true },
      ],
      size: 8,
      gapBefore: 10,
    });
    const ageing = currency.ageing;
    out.push({
      cells: [
        { text: money(ageing.current), x: 150, right: true },
        { text: money(ageing.days1to30), x: 240, right: true },
        { text: money(ageing.days31to60), x: 330, right: true },
        { text: money(ageing.days61to90), x: 420, right: true },
        { text: money(ageing.over90), x: RIGHT, right: true },
      ],
      size: 9,
    });

    if (currency.open.length) {
      out.push({ cells: [{ text: "OPEN INVOICES", x: 50, bold: true }], size: 9, gapBefore: 12 });
      out.push({
        cells: [
          { text: "Invoice", x: 50, bold: true },
          { text: "Issued", x: 200, bold: true },
          { text: "Due", x: 280, bold: true },
          { text: "Total", x: 430, right: true, bold: true },
          { text: "Balance", x: RIGHT, right: true, bold: true },
        ],
        size: 8,
        gapBefore: 2,
      });
      for (const invoice of currency.open) {
        out.push({
          cells: [
            { text: invoice.invoice.slice(0, 28), x: 50 },
            { text: date(invoice.issued), x: 200 },
            { text: invoice.daysOverdue > 0 ? `${date(invoice.due)} (${invoice.daysOverdue} d late)` : date(invoice.due), x: 280 },
            { text: money(invoice.total), x: 430, right: true },
            { text: money(invoice.balance), x: RIGHT, right: true, bold: invoice.daysOverdue > 0 },
          ],
          size: 9,
        });
      }
    }

    if (currency.payments.length) {
      out.push({ cells: [{ text: "PAYMENTS RECEIVED", x: 50, bold: true }], size: 9, gapBefore: 12 });
      out.push({
        cells: [
          { text: "Date", x: 50, bold: true },
          { text: "Invoice", x: 140, bold: true },
          { text: "Method / reference", x: 280, bold: true },
          { text: "Amount", x: RIGHT, right: true, bold: true },
        ],
        size: 8,
        gapBefore: 2,
      });
      for (const payment of currency.payments) {
        out.push({
          cells: [
            { text: date(payment.date), x: 50 },
            { text: payment.invoice.slice(0, 24), x: 140 },
            { text: [payment.method.replace(/_/g, " "), payment.reference].filter(Boolean).join(" - ").slice(0, 40), x: 280 },
            { text: money(payment.amount), x: RIGHT, right: true },
          ],
          size: 9,
        });
      }
    }
  }

  line("This statement lists the invoices and payments on your KCPL account as of the date above. A payment made after", 8, false, 20);
  line("that date, or one still being matched by KCPL accounts, is not yet shown. Questions: contact your KCPL account manager.", 8);
  return out;
}

function paginate(all: Row[]) {
  const pages: Row[][] = [];
  let current: Row[] = [];
  let used = 0;
  for (const row of all) {
    const height = (row.size ?? 9) + 5 + (row.gapBefore ?? 0);
    if (current.length && used + height > 740) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += height;
  }
  if (current.length) pages.push(current);
  return pages.length ? pages : [[]];
}

function pageContent(page: Row[], pageNumber: number, pageCount: number) {
  const commands: string[] = ["0.2 w"];
  let y = 800;
  for (const row of page) {
    y -= row.gapBefore ?? 0;
    const size = row.size ?? 9;
    if (row.rule) commands.push(`45 ${(y + size + 4).toFixed(1)} m 550 ${(y + size + 4).toFixed(1)} l S`);
    for (const cell of row.cells) {
      const x = cell.right ? cell.x - width(cell.text, size, cell.bold) : cell.x;
      commands.push(`BT /${cell.bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${escapePdf(cell.text)}) Tj ET`);
    }
    y -= size + 5;
  }
  commands.push("45 30 m 550 30 l S");
  commands.push(`BT /F1 7 Tf 50 18 Td (${escapePdf(`KCPL statement of account - page ${pageNumber} of ${pageCount}`)}) Tj ET`);
  return commands.join("\n");
}

export function renderStatementPdf(statement: Statement, customerName: string, generatedAt: string) {
  const pages = paginate(rows(statement, customerName, generatedAt));
  const objects: string[] = [];
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = "";
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  const pageIds: number[] = [];
  for (let index = 0; index < pages.length; index += 1) {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const content = pageContent(pages[index], index + 1, pages.length);
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n%KCPL\n";
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets[i + 1] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
