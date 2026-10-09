import { getAdminAccess } from "../../../../../admin/admin-auth";
import { getStaffContext } from "../../../../../admin/staff-directory.server";
import { loadTaxMonth, tallyMonth } from "../../../../../admin/finance/tax-books.server";
import { purchaseBookCsv, salesBookCsv } from "../../../../../admin/finance/tax-books";
import { tallyMastersXml, tallyVouchersXml } from "../../../../../admin/finance/tally-export";
import { csvRow } from "../../../../../admin/management/csv-export-policy";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function file(body: string, filename: string, type: string) {
  return new Response(body, { headers: { "content-type": type, "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" } });
}

/** The month's books as files: sales and purchase books and TDS as CSV, and Tally import files. */
export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (access.kind !== "authorized") return json({ ok: false, error: "Sign in is required." }, 401);
  const staff = await getStaffContext(access.user);
  if (!staff.permissions.canManageFinance) return json({ ok: false, error: "Finance access is restricted to Management and Accounts." }, 403);
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("y"));
  const month = Number(url.searchParams.get("m"));
  const kind = url.searchParams.get("kind") ?? "";
  const stamp = `${year}-${String(month).padStart(2, "0")}`;

  if (kind === "tally-masters" || kind === "tally-vouchers") {
    const tally = await tallyMonth(staff, year, month);
    if (!tally) return json({ ok: false, error: "Choose a Nepali month." }, 400);
    if (kind === "tally-masters") return file(tallyMastersXml(tally.parties, tally.settings).file, `KCPL-tally-ledgers-${stamp}.xml`, "application/xml; charset=utf-8");
    return file(tallyVouchersXml(tally.vouchers, tally.settings).file, `KCPL-tally-vouchers-${stamp}.xml`, "application/xml; charset=utf-8");
  }

  const result = await loadTaxMonth(staff, year, month);
  if (result.kind === "invalid") return json({ ok: false, error: "Choose a Nepali month." }, 400);
  if (result.kind !== "ready") return json({ ok: false, error: "The books couldn't be read." }, result.kind === "forbidden" ? 403 : 503);
  const csv = "text/csv; charset=utf-8";
  if (kind === "sales") return file(salesBookCsv(result.month.sales), `KCPL-sales-book-${stamp}.csv`, csv);
  if (kind === "purchases") return file(purchaseBookCsv(result.month.purchases), `KCPL-purchase-book-${stamp}.csv`, csv);
  if (kind === "tds") {
    const rows = result.month.tds_by_kcpl;
    const body = [csvRow(["Paid on", "Supplier", "Supplier PAN", "Bill", "Currency", "Paid and withheld", "TDS", "Rate %", "Status", "Deposit reference"]),
      ...rows.map((row) => csvRow([row.withheld_on, row.counterparty_name, row.counterparty_pan ?? "", row.document_number, row.currency, row.settled_amount, row.amount, row.rate ?? "", row.status_label, row.deposit_reference ?? ""]))].join("\r\n") + "\r\n";
    return file(body, `KCPL-tds-withheld-${stamp}.csv`, csv);
  }
  return json({ ok: false, error: "Unknown export." }, 400);
}
