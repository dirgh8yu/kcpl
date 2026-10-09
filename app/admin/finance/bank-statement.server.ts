import { firebaseAdminDb, firebaseRuntimeConfigured } from "../../firebase-admin.server";
import { crmCurrencies, type CrmCurrency } from "../crm/crm-data";
import { recordReceivablePaymentWithSettlementIntegrity } from "../financial-settlement/receivables-settlement.server";
import { readAllDocuments } from "../firestore-scan";
import { qaMockDataEnabled } from "../qa-fixtures";
import type { KcplStaffContext } from "../staff-directory.server";
import { bankAccountKey, parseStatement, suggestMatches, type MatchCandidate, type MatchSuggestion } from "./bank-statement";
import { recordAdvance } from "./customer-credits.server";

/*
 * Bank statement lines, kept so an upload never repeats and each line is
 * worked once: matched to an invoice (the payment is recorded from it),
 * kept as a customer's advance, or set aside (bank charges, interest,
 * transfers between KCPL's own accounts).
 */

const BANK_LINES = "bank_lines";
type Actor = { name: string; email: string };

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullable(value: unknown) { const output = text(value).trim(); return output || null; }
function num(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }

export type BankLine = {
  id: string;
  account: string;
  currency: string;
  date: string;
  description: string;
  reference: string | null;
  credit: number;
  debit: number;
  balance: number | null;
  /** Order within the statement, earliest first, so a day's last balance is known. */
  position: number;
  status: "open" | "matched" | "advance" | "ignored";
  matched_label: string | null;
  matched_link: string | null;
  note: string | null;
  worked_by_name: string | null;
  suggestions: MatchSuggestion[];
};

function lineFromDoc(doc: FirebaseFirestore.DocumentSnapshot): BankLine {
  const data = (doc.data() ?? {}) as Record<string, unknown>;
  const status = text(data.status);
  return {
    id: doc.id,
    account: text(data.account),
    currency: text(data.currency, "NPR"),
    date: text(data.date),
    description: text(data.description),
    reference: nullable(data.reference),
    credit: num(data.credit),
    debit: num(data.debit),
    balance: data.balance === null || data.balance === undefined ? null : num(data.balance),
    position: num(data.position),
    status: status === "matched" || status === "advance" || status === "ignored" ? status : "open",
    matched_label: nullable(data.matched_label),
    matched_link: nullable(data.matched_link),
    note: nullable(data.note),
    worked_by_name: nullable(data.worked_by_name),
    suggestions: [],
  };
}

export async function importStatement(input: { csv: string; account: string; currency: string }, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const account = input.account.trim().slice(0, 60);
  if (!account) return { kind: "account_required" as const };
  const currency = input.currency.trim().toUpperCase();
  if (!crmCurrencies.includes(currency as CrmCurrency)) return { kind: "invalid_currency" as const };
  if (input.csv.length > 3_000_000) return { kind: "too_large" as const };
  const parsed = parseStatement(input.csv);
  if (!parsed.lines.length) return { kind: "nothing_read" as const, errors: parsed.errors };
  const db = firebaseAdminDb();
  const key = bankAccountKey(account);
  const refs = parsed.lines.map((line) => db.collection(BANK_LINES).doc(`${key}-${line.id}`));
  const existing = new Set<string>();
  for (let index = 0; index < refs.length; index += 300) {
    const snapshots = await db.getAll(...refs.slice(index, index + 300));
    for (const snapshot of snapshots) if (snapshot.exists) existing.add(snapshot.id);
  }
  const now = new Date().toISOString();
  // Banks export newest first or oldest first; a line's position counts from the earliest either way.
  const newestFirst = parsed.lines.length > 1 && parsed.lines[0].date > parsed.lines[parsed.lines.length - 1].date;
  let added = 0;
  for (let index = 0; index < parsed.lines.length; index += 400) {
    const batch = db.batch();
    for (const [offset, line] of parsed.lines.slice(index, index + 400).entries()) {
      const ref = refs[index + offset];
      if (existing.has(ref.id)) continue;
      batch.create(ref, {
        account, account_key: key, currency, date: line.date, description: line.description, reference: line.reference,
        credit: line.credit, debit: line.debit, balance: line.balance,
        position: newestFirst ? parsed.lines.length - 1 - (index + offset) : index + offset,
        // Money out is listed for reference; only money in waits to be matched.
        status: "open", direction: line.credit > 0 ? "in" : "out",
        imported_by_name: actor.name, imported_by_email: actor.email, imported_at: now, updated_at: now,
      });
      added += 1;
    }
    await batch.commit();
  }
  return { kind: "imported" as const, added, duplicates: parsed.lines.length - added, errors: parsed.errors };
}

export type BankOverview = {
  open_in: BankLine[];
  open_out: BankLine[];
  recent: BankLine[];
  accounts: Array<{ account: string; currency: string; balance: number | null; as_of: string }>;
};

/** Each account's latest known balance: the last line, on the latest date, that carries one. */
function latestBalances(lines: BankLine[]) {
  const accounts = new Map<string, { account: string; currency: string; balance: number | null; as_of: string }>();
  for (const line of [...lines].sort((a, b) => b.date.localeCompare(a.date) || b.position - a.position)) {
    if (!accounts.has(line.account) && line.balance !== null) accounts.set(line.account, { account: line.account, currency: line.currency, balance: line.balance, as_of: line.date });
  }
  return [...accounts.values()];
}

/** The balance in each bank account, from the newest statement lines uploaded. */
export async function bankBalances() {
  const snapshot = await firebaseAdminDb().collection(BANK_LINES).orderBy("date", "desc").limit(500).get();
  return latestBalances(snapshot.docs.map(lineFromDoc));
}

async function openInvoiceCandidates(context: KcplStaffContext): Promise<MatchCandidate[]> {
  const snapshot = await readAllDocuments(firebaseAdminDb().collection("invoices").where("status", "in", ["issued", "partially_paid", "overdue"]));
  return snapshot.docs
    .filter((doc) => context.can_access_all_branches || context.branches.includes(text(doc.get("branch")) as never))
    .map((doc) => ({
      reference: doc.id,
      number: text(doc.get("tax_invoice_number")) || text(doc.get("external_invoice_number")) || doc.id,
      customer_id: text(doc.get("customer_id")),
      customer_name: text(doc.get("customer_name"), "Customer"),
      currency: text(doc.get("currency"), "NPR"),
      balance_due: num(doc.get("balance_due")),
      total: num(doc.get("total")),
    }));
}

export async function listBankLines(context: KcplStaffContext): Promise<{ kind: "ready"; overview: BankOverview; candidates: MatchCandidate[] } | { kind: "forbidden" } | { kind: "unavailable" }> {
  if (!context.permissions.canManageFinance) return { kind: "forbidden" };
  if (qaMockDataEnabled()) return { kind: "ready", overview: { open_in: [], open_out: [], recent: [], accounts: [] }, candidates: [] };
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" };
  try {
    const db = firebaseAdminDb();
    const [open, recent, candidates] = await Promise.all([
      readAllDocuments(db.collection(BANK_LINES).where("status", "==", "open")),
      db.collection(BANK_LINES).orderBy("updated_at", "desc").limit(40).get(),
      openInvoiceCandidates(context),
    ]);
    const lines = open.docs.map(lineFromDoc).sort((a, b) => b.date.localeCompare(a.date));
    for (const line of lines) if (line.credit > 0) line.suggestions = suggestMatches(line, candidates, line.currency);
    const accounts = latestBalances([...lines, ...recent.docs.map(lineFromDoc)]);
    return {
      kind: "ready",
      overview: {
        open_in: lines.filter((line) => line.credit > 0),
        open_out: lines.filter((line) => line.debit > 0),
        recent: recent.docs.map(lineFromDoc).filter((line) => line.status !== "open").slice(0, 20),
        accounts: [...accounts.values()],
      },
      candidates,
    };
  } catch (error) {
    console.error("KCPL bank lines failed", error);
    return { kind: "unavailable" };
  }
}

/** Claim an open line in a transaction, so two people can't work it at once. */
async function claimLine(id: string) {
  const db = firebaseAdminDb();
  const ref = db.collection(BANK_LINES).doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { kind: "missing" as const };
    if (snapshot.get("status") !== "open" && snapshot.get("status") !== "working") return { kind: "already_worked" as const };
    transaction.update(ref, { status: "working", updated_at: new Date().toISOString() });
    return { kind: "claimed" as const, line: lineFromDoc(snapshot) };
  });
}

async function finishLine(id: string, values: Record<string, unknown>, actor: Actor) {
  await firebaseAdminDb().collection(BANK_LINES).doc(id).update({ ...values, worked_by_name: actor.name, worked_by_email: actor.email, updated_at: new Date().toISOString() });
}

async function releaseLine(id: string) {
  await firebaseAdminDb().collection(BANK_LINES).doc(id).update({ status: "open", updated_at: new Date().toISOString() }).catch(() => undefined);
}

/**
 * Record a money-in line as a payment on an invoice. The payment's key is the
 * line, so doing it twice (two tabs, a retry) records it once.
 */
export async function matchBankLine(id: string, input: { invoiceReference: string; keepExcessAsCredit: boolean }, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const claim = await claimLine(id);
  if (claim.kind !== "claimed") return claim;
  const line = claim.line;
  if (line.credit <= 0) { await releaseLine(id); return { kind: "not_money_in" as const }; }
  const result = await recordReceivablePaymentWithSettlementIntegrity(input.invoiceReference, {
    amount: line.credit, paymentDate: line.date, method: "bank_transfer", reference: (line.reference || line.description).slice(0, 120),
    notes: `From ${line.account} statement`, currency: line.currency, idempotencyKey: `bank-${id}`, keepExcessAsCredit: input.keepExcessAsCredit,
  }, actor, context);
  if (result.kind !== "updated" && result.kind !== "idempotent") { await releaseLine(id); return result; }
  await finishLine(id, { status: "matched", matched_label: `Payment on ${input.invoiceReference.trim().toUpperCase()}`, matched_link: `/admin/finance/invoices/${encodeURIComponent(input.invoiceReference.trim().toUpperCase())}`, matched_invoice: input.invoiceReference.trim().toUpperCase() }, actor);
  return { kind: "matched" as const, remaining: result.remaining };
}

/** Keep a money-in line as a customer's advance, when it isn't for an invoice yet. */
export async function bankLineAsAdvance(id: string, customerId: string, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  const claim = await claimLine(id);
  if (claim.kind !== "claimed") return claim;
  const line = claim.line;
  const result = await recordAdvance({
    customerId, currency: line.currency, amount: line.credit, receivedOn: line.date, method: "bank_transfer",
    reference: (line.reference || line.description).slice(0, 120), notes: `From ${line.account} statement`, forInvoiceReference: "", idempotencyKey: `bank-${id}`,
  }, actor, context);
  if (result.kind !== "created" && result.kind !== "idempotent") { await releaseLine(id); return result; }
  await finishLine(id, { status: "advance", matched_label: `Advance ${result.receiptNumber}`, matched_link: `/admin/finance/credits/${encodeURIComponent(result.creditId)}` }, actor);
  return { kind: "matched" as const, remaining: null };
}

/** Set a line aside: bank charges, interest, a transfer between KCPL's own accounts. */
export async function ignoreBankLine(id: string, note: string, actor: Actor, context: KcplStaffContext) {
  if (!firebaseRuntimeConfigured()) return { kind: "unavailable" as const };
  if (!context.permissions.canManageFinance) return { kind: "forbidden" as const };
  const reason = note.trim().slice(0, 200);
  if (reason.length < 3) return { kind: "note_required" as const };
  const claim = await claimLine(id);
  if (claim.kind !== "claimed") return claim;
  await finishLine(id, { status: "ignored", note: reason, matched_label: "Set aside" }, actor);
  return { kind: "matched" as const, remaining: null };
}
