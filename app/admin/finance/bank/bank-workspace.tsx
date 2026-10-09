"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Landmark, Upload } from "lucide-react";
import { crmCurrencies } from "../../crm/crm-data";
import type { BankLine, BankOverview } from "../bank-statement.server";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMetric, OpsMetricStrip, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface } from "../../operations-ui";
import { OpsFileDrop } from "../../ops-file-drop";

function money(amount: number, currency = "NPR") {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}
function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}

type Notice = { text: string; tone: "success" | "danger" | "warning" } | null;

async function patchLine(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/admin/finance/bank/lines/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as { error?: string; remaining?: number | null };
  if (!response.ok) throw new Error(data.error || "That didn't go through.");
  return data;
}

export function BankWorkspace({ overview }: { overview: BankOverview }) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState({ account: overview.accounts[0]?.account ?? "", currency: overview.accounts[0]?.currency ?? "NPR" });

  async function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy("import"); setNotice(null);
    try {
      const csv = await file.text();
      const response = await fetch("/api/admin/finance/bank/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ csv, ...upload }) });
      const data = await response.json() as { error?: string; added?: number; duplicates?: number; errors?: string[] };
      if (!response.ok) throw new Error(data.error || "The statement couldn't be read.");
      const skipped = data.errors?.length ? ` ${data.errors.length} row${data.errors.length === 1 ? "" : "s"} couldn't be read: ${data.errors.slice(0, 2).join(" ")}` : "";
      setNotice({ text: `${data.added ?? 0} new line${data.added === 1 ? "" : "s"} added${data.duplicates ? `, ${data.duplicates} already here` : ""}.${skipped}`, tone: data.errors?.length ? "warning" : "success" });
      setFile(null); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "The statement couldn't be read.", tone: "danger" }); }
    finally { setBusy(""); }
  }

  async function act(line: BankLine, body: Record<string, unknown>, success: string) {
    setBusy(line.id); setNotice(null);
    try { await patchLine(line.id, body); setNotice({ text: success, tone: "success" }); router.refresh(); }
    catch (error) { setNotice({ text: error instanceof Error ? error.message : "That didn't go through.", tone: "danger" }); }
    finally { setBusy(""); }
  }

  const waitingIn = overview.open_in.reduce((sum, line) => sum + (line.currency === "NPR" ? line.credit : 0), 0);
  return <OpsPage>
    <OpsPageHeader eyebrow="Finance" title="Bank" description="Upload the bank statement and match each receipt to its invoice. Matching records the payment, once, however often the same statement is uploaded."/>
    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}

      <OpsMetricStrip columns={Math.max(2, Math.min(4, overview.accounts.length + 1))}>
        <OpsMetric label="Receipts to match" value={String(overview.open_in.length)} detail={waitingIn ? money(waitingIn) : "Nothing waiting"}/>
        {overview.accounts.map((account) => <OpsMetric key={account.account} label={account.account} value={account.balance === null ? "—" : money(account.balance, account.currency)} detail={`Balance on ${dateLabel(account.as_of)}`}/>)}
      </OpsMetricStrip>

      <OpsSurface title="Upload a statement" description="A CSV export from the bank, one account at a time. Lines already uploaded are skipped.">
        <form onSubmit={importFile} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,140px)_minmax(0,1.4fr)_auto] lg:items-end">
          <OpsField label="Bank account" hint="As you call it, e.g. Nabil current"><input required list="kcpl-bank-accounts" maxLength={60} value={upload.account} onChange={(event) => setUpload({ ...upload, account: event.target.value })}/></OpsField>
          <datalist id="kcpl-bank-accounts">{overview.accounts.map((account) => <option key={account.account} value={account.account}/>)}</datalist>
          <OpsField label="Currency"><select value={upload.currency} onChange={(event) => setUpload({ ...upload, currency: event.target.value })}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></OpsField>
          <OpsFileDrop prompt="Choose the statement CSV" hint="Exported from internet banking" accept=".csv,text/csv" chosen={file?.name ?? null} onFiles={(files) => setFile(files[0] ?? null)}/>
          <OpsButton type="submit" variant="primary" disabled={!file || busy === "import"}><Upload size={12}/>{busy === "import" ? "Reading…" : "Upload"}</OpsButton>
        </form>
      </OpsSurface>

      <OpsSurface title="Money in to match" flush>
        {overview.open_in.length ? <ul className="divide-y divide-[var(--admin-line)]">{overview.open_in.map((line) => <ReceiptRow key={line.id} line={line} busy={busy === line.id} act={act}/>)}</ul>
          : <OpsEmptyState compact kind="healthy" icon={<ArrowDownLeft size={17} strokeWidth={1.75} aria-hidden="true"/>} title="Nothing to match" description="Receipts from an uploaded statement wait here until each is matched, kept as an advance or set aside."/>}
      </OpsSurface>

      {overview.open_out.length ? <OpsSurface title="Money out" description="For reference. Set each aside once you've checked it against the bills paid and refunds made." flush>
        <ul className="divide-y divide-[var(--admin-line)]">{overview.open_out.map((line) => <OutRow key={line.id} line={line} busy={busy === line.id} act={act}/>)}</ul>
      </OpsSurface> : null}

      {overview.recent.length ? <OpsSurface title="Dealt with recently" flush>
        <ul className="divide-y divide-[var(--admin-line)]">{overview.recent.map((line) => <li key={line.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0"><p className="font-semibold text-[var(--admin-ink)]">{line.credit ? money(line.credit, line.currency) : `−${money(line.debit, line.currency)}`} · {dateLabel(line.date)}</p><p className="mt-1 truncate text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{line.description}</p></div>
          <div className="flex items-center gap-2">{line.matched_link ? <Link href={line.matched_link} className="ops-cell-link text-[length:var(--app-label-size)]">{line.matched_label}</Link> : <span className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{line.matched_label}{line.note ? ` · ${line.note}` : ""}</span>}<OpsBadge tone={line.status === "ignored" ? "neutral" : "success"}><CheckCircle2 size={10}/>{line.status === "ignored" ? "Set aside" : "Done"}</OpsBadge></div>
        </li>)}</ul>
      </OpsSurface> : null}
    </div>
  </OpsPage>;
}

type Act = (line: BankLine, body: Record<string, unknown>, success: string) => Promise<void>;

function ReceiptRow({ line, busy, act }: { line: BankLine; busy: boolean; act: Act }) {
  const best = line.suggestions[0];
  const [invoice, setInvoice] = useState(best?.reference ?? "");
  const [keepExtra, setKeepExtra] = useState(false);
  const [customer, setCustomer] = useState(best?.customer_id ?? "");
  const [note, setNote] = useState("");
  const chosen = line.suggestions.find((item) => item.reference === invoice.trim().toUpperCase());
  const over = chosen ? line.credit - chosen.balance_due : 0;
  return <li className="grid gap-3 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-[var(--admin-ink)]">{money(line.credit, line.currency)} · {dateLabel(line.date)}</p>
        <p className="mt-1 break-words text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{line.description}{line.reference ? ` · ${line.reference}` : ""} · {line.account}</p>
      </div>
      <OpsBadge tone={best ? "info" : "warning"} dot>{best ? `${line.suggestions.length} likely invoice${line.suggestions.length === 1 ? "" : "s"}` : "No likely invoice"}</OpsBadge>
    </div>
    {line.suggestions.length ? <div className="grid gap-2">{line.suggestions.map((item) => <label key={item.reference} className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--app-radius)] border border-[var(--admin-line)] px-3 py-2 text-[length:var(--app-label-size)]" data-selected={invoice === item.reference || undefined}>
      <input type="radio" name={`match-${line.id}`} checked={invoice === item.reference} onChange={() => { setInvoice(item.reference); setCustomer(item.customer_id); }}/>
      <OpsMono>{item.number}</OpsMono>
      <span className="text-[var(--admin-ink)]">{item.customer_name}</span>
      <span className="text-[var(--admin-muted)]">owes {money(item.balance_due, item.currency)} · {item.reasons.join(", ").toLowerCase()}</span>
    </label>)}</div> : null}
    <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void act(line, { action: "match", invoiceReference: invoice, keepExcessAsCredit: keepExtra }, "Payment recorded from the bank line."); }}>
      <OpsField label="Invoice reference" hint="Pick above, or type the KCPL invoice reference"><input required value={invoice} onChange={(event) => setInvoice(event.target.value)} placeholder="KCPL-I-…"/></OpsField>
      <OpsButton type="submit" variant="primary" disabled={busy}><Landmark size={12}/>Record payment</OpsButton>
      {over > 0.005 ? <label className="flex items-start gap-2 text-[length:var(--app-label-size)] text-[var(--admin-ink)] sm:col-span-2"><input type="checkbox" className="mt-0.5" checked={keepExtra} onChange={(event) => setKeepExtra(event.target.checked)}/><span>{money(over, line.currency)} more than the invoice owes: keep it as the customer&apos;s credit.</span></label> : null}
    </form>
    <details>
      <summary className="cursor-pointer text-[length:var(--app-label-size)] font-semibold text-[var(--admin-ink)]">Not for an invoice?</summary>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void act(line, { action: "advance", customerId: customer }, "Kept as the customer's advance."); }}>
          <OpsField label="Customer reference" hint="An advance, held as their credit"><input required value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="KCPL-C-…"/></OpsField>
          <OpsButton type="submit" variant="secondary" disabled={busy}>Keep as advance</OpsButton>
        </form>
        <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void act(line, { action: "ignore", note }, "Line set aside."); }}>
          <OpsField label="What it is" hint="Interest, a transfer between KCPL's accounts…"><input required minLength={3} maxLength={200} value={note} onChange={(event) => setNote(event.target.value)}/></OpsField>
          <OpsButton type="submit" variant="ghost" disabled={busy}>Set aside</OpsButton>
        </form>
      </div>
    </details>
  </li>;
}

function OutRow({ line, busy, act }: { line: BankLine; busy: boolean; act: Act }) {
  const [note, setNote] = useState("");
  return <li className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,260px)_auto] sm:items-end">
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 font-semibold text-[var(--admin-ink)]"><ArrowUpRight size={13} aria-hidden="true"/>−{money(line.debit, line.currency)} · {dateLabel(line.date)}</p>
      <p className="mt-1 break-words text-[length:var(--app-label-size)] text-[var(--admin-muted)]">{line.description}{line.reference ? ` · ${line.reference}` : ""} · {line.account}</p>
    </div>
    <OpsField label="What it is"><input maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Supplier payment, bank charge…"/></OpsField>
    <OpsButton variant="ghost" disabled={busy || note.trim().length < 3} onClick={() => act(line, { action: "ignore", note }, "Line set aside.")}>Set aside</OpsButton>
  </li>;
}
