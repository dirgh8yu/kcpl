/*
 * Vouchers for Tally, as the XML Tally imports (Gateway of Tally > Import >
 * Vouchers). Each voucher's entries balance: debits equal credits. Ledger
 * names come from KCPL's settings so they match the ledgers already in its
 * Tally company; customers and suppliers are named as they are in KCPL.
 *
 * Pure: the server gathers the month's documents into vouchers; this only
 * checks and writes them.
 */

export type TallyLedgerSettings = {
  company: string;
  sales: string;
  vat_output: string;
  vat_input: string;
  disbursements: string;
  tds_receivable: string;
  tds_payable: string;
  purchases: string;
  bank: string;
  cash: string;
  staff_advances: string;
  debtors_group: string;
  creditors_group: string;
};

export const defaultTallyLedgers: TallyLedgerSettings = {
  company: "Kapileshwor Cargo Pvt. Ltd.",
  sales: "Freight & Logistics Income",
  vat_output: "VAT Output 13%",
  vat_input: "VAT Input 13%",
  disbursements: "Customs Duty & Charges Recoverable",
  tds_receivable: "TDS Receivable",
  tds_payable: "TDS Payable",
  purchases: "Freight & Logistics Costs",
  bank: "Bank",
  cash: "Cash",
  staff_advances: "Staff Advances",
  debtors_group: "Sundry Debtors",
  creditors_group: "Sundry Creditors",
};

export const tallyLedgerLabels: Record<keyof TallyLedgerSettings, string> = {
  company: "Tally company name",
  sales: "Sales (KCPL's charges)",
  vat_output: "VAT on sales",
  vat_input: "VAT on purchases",
  disbursements: "Paid on behalf of customers",
  tds_receivable: "TDS customers withheld",
  tds_payable: "TDS KCPL withheld",
  purchases: "Supplier costs",
  bank: "Bank",
  cash: "Cash",
  staff_advances: "Staff cash advances",
  debtors_group: "Group for customers",
  creditors_group: "Group for suppliers",
};

/** Settings as stored, with blanks filled from the defaults and names trimmed to what Tally accepts. */
export function tallyLedgers(stored: Partial<Record<keyof TallyLedgerSettings, unknown>> | null | undefined): TallyLedgerSettings {
  const out = { ...defaultTallyLedgers };
  for (const key of Object.keys(defaultTallyLedgers) as Array<keyof TallyLedgerSettings>) {
    const value = stored?.[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, 120);
  }
  return out;
}

export type TallyVoucherType = "Sales" | "Credit Note" | "Receipt" | "Payment" | "Journal" | "Purchase";

export type TallyVoucher = {
  type: TallyVoucherType;
  /** YYYY-MM-DD. */
  date: string;
  number: string;
  narration: string;
  party: string | null;
  /** Positive is a debit, negative a credit. They must add up to nothing. */
  entries: Array<{ ledger: string; amount: number }>;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function voucherBalances(voucher: TallyVoucher) {
  return Math.abs(round(voucher.entries.reduce((sum, entry) => sum + entry.amount, 0))) < 0.005;
}

function xml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char)
    // Characters XML can't carry at all.
    .split("").filter((char) => { const code = char.charCodeAt(0); return code >= 32 || code === 9 || code === 10 || code === 13; }).join("");
}

function tallyAmount(debit: number) {
  // Tally writes a debit as a negative amount marked "deemed positive".
  return (-debit).toFixed(2);
}

function envelope(reportName: "All Masters" | "Vouchers", company: string, messages: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>${reportName}</REPORTNAME>
    <STATICVARIABLES><SVCURRENTCOMPANY>${xml(company)}</SVCURRENTCOMPANY></STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>${messages}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>
`;
}

/**
 * The customers' and suppliers' ledgers, imported before the vouchers so
 * none of them refers to a ledger Tally doesn't have. Ones that already
 * exist are reported by Tally and left as they are.
 */
export function tallyMastersXml(parties: Array<{ name: string; group: "debtors" | "creditors" }>, settings: TallyLedgerSettings) {
  const seen = new Set<string>();
  const messages = parties.filter((party) => party.name.trim() && !seen.has(party.name) && Boolean(seen.add(party.name))).map((party) => `
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER NAME="${xml(party.name)}" ACTION="Create">
     <NAME.LIST><NAME>${xml(party.name)}</NAME></NAME.LIST>
     <PARENT>${xml(party.group === "debtors" ? settings.debtors_group : settings.creditors_group)}</PARENT>
     <ISBILLWISEON>Yes</ISBILLWISEON>
    </LEDGER>
   </TALLYMESSAGE>`).join("");
  return { file: envelope("All Masters", settings.company, messages), count: seen.size };
}

/**
 * The vouchers file. Vouchers that don't balance or have no entries are left
 * out and returned, so the caller can say what wasn't exported rather than
 * hand Tally something it would reject halfway through.
 */
export function tallyVouchersXml(vouchers: TallyVoucher[], settings: TallyLedgerSettings) {
  const skipped = vouchers.filter((voucher) => !voucher.entries.length || !voucherBalances(voucher));
  const ready = vouchers.filter((voucher) => voucher.entries.length && voucherBalances(voucher));
  const messages = ready.map((voucher) => `
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="${xml(voucher.type)}" ACTION="Create">
     <DATE>${voucher.date.replaceAll("-", "")}</DATE>
     <VOUCHERTYPENAME>${xml(voucher.type)}</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${xml(voucher.number)}</VOUCHERNUMBER>${voucher.party ? `
     <PARTYLEDGERNAME>${xml(voucher.party)}</PARTYLEDGERNAME>` : ""}
     <NARRATION>${xml(voucher.narration)}</NARRATION>${voucher.entries.filter((entry) => Math.abs(entry.amount) >= 0.005).map((entry) => `
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${xml(entry.ledger)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>${entry.amount > 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
      <AMOUNT>${tallyAmount(entry.amount)}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>`).join("")}
    </VOUCHER>
   </TALLYMESSAGE>`).join("");
  return { file: envelope("Vouchers", settings.company, messages), exported: ready.length, skipped };
}

/** The bank or cash ledger a payment method moves money through. */
export function moneyLedger(method: string, settings: TallyLedgerSettings) {
  return method === "cash" ? settings.cash : settings.bank;
}
