"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { nepalOperationalDate } from "../../../invoice-effective-status";
import { crmCurrencies } from "../../crm/crm-data";
import { newPaymentKey } from "../../payment-key";
import { financePaymentMethodLabels } from "../finance-data";
import { refundMethods } from "../refund-policy";
import type { StaffAdvance } from "../staff-cash.server";
import { staffCashDaysOpen } from "../staff-cash-policy";
import { OpsBadge, OpsButton, OpsEmptyState, OpsField, OpsMetric, OpsMetricStrip, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../../operations-ui";
import { dateLabel, money, totalsByCurrency } from "../credits/credits-format";

type Person = { email: string; name: string; branch: string | null };

/** An advance out longer than this is cash nobody has accounted for. */
const STALE_DAYS = 14;

function settlementLabel(advance: StaffAdvance) {
  const settled = advance.status === "settled";
  if (advance.settlement.kind === "return") return `${money(advance.settlement.amount, advance.currency)} ${settled ? "came back" : "to come back"}`;
  if (advance.settlement.kind === "reimburse") return `${money(advance.settlement.amount, advance.currency)} ${settled ? "paid to" : "to pay"} ${advance.staff_name}`;
  return "Spent exactly";
}

export function StaffCashWorkspace({ open, settled, people, branches }: { open: StaffAdvance[]; settled: StaffAdvance[]; people: Person[]; branches: string[] }) {
  const today = nepalOperationalDate();
  const stale = open.filter((advance) => staffCashDaysOpen(advance.given_on, today) > STALE_DAYS);
  const unaccounted = open.map((advance) => ({ currency: advance.currency, amount: Math.max(0, advance.amount - advance.spent) }));
  return <OpsPage>
    <OpsPageHeader eyebrow="Finance" title="Staff cash" description="Cash handed to staff for fees paid on the spot. Enter the receipts they bring back, then settle: what's left comes back, or KCPL pays what they spent beyond it. Fees tied to a shipment become its Job File costs."/>
    <div className="ops-content-wide ops-stack">
      <OpsMetricStrip columns={3}>
        <OpsMetric label="Out with staff" value={open.length ? totalsByCurrency(open.map((advance) => ({ currency: advance.currency, amount: advance.amount }))) : "Nothing"} detail={`${open.length} open advance${open.length === 1 ? "" : "s"}`}/>
        <OpsMetric label="Without receipts yet" value={unaccounted.some((row) => row.amount > 0) ? totalsByCurrency(unaccounted.filter((row) => row.amount > 0)) : "Nothing"} detail="Given, less receipts entered"/>
        <OpsMetric label={`Open over ${STALE_DAYS} days`} value={String(stale.length)} detail={stale.length ? "Ask for the receipts" : "None"}/>
      </OpsMetricStrip>

      <OpsSurface title="Open advances" flush>
        {open.length ? <AdvanceTable advances={open} today={today}/> : <OpsEmptyState compact kind="healthy" icon={<Wallet size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No cash out with staff" description="Cash given to someone appears here until it is settled."/>}
      </OpsSurface>

      <GiveCash people={people} branches={branches}/>

      {settled.length ? <OpsSurface title="Settled recently" flush><AdvanceTable advances={settled} today={today}/></OpsSurface> : null}
    </div>
  </OpsPage>;
}

function AdvanceTable({ advances, today }: { advances: StaffAdvance[]; today: string }) {
  return <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table" data-row-link>
    <thead><tr><th>Given to</th><th>Given</th><th>Receipts</th><th>Settlement</th><th>Date</th></tr></thead>
    <tbody>{advances.map((advance) => {
      const days = staffCashDaysOpen(advance.given_on, today);
      return <tr key={advance.id}>
        <td data-cell="primary"><Link href={`/admin/finance/staff-cash/${encodeURIComponent(advance.id)}`} className="ops-cell-primary">{advance.staff_name}</Link><span className="ops-cell-secondary"><OpsMono>{advance.number}</OpsMono> · {advance.purpose}</span></td>
        <td data-cell="amount" data-label="Given" className="font-semibold tabular-nums text-[var(--admin-ink)]">{money(advance.amount, advance.currency)}</td>
        <td data-cell="meta" data-label="Receipts" className="tabular-nums">{advance.expenses.length ? <>{money(advance.spent, advance.currency)}<span className="ops-cell-secondary">{advance.expenses.length} receipt{advance.expenses.length === 1 ? "" : "s"}</span></> : "None yet"}</td>
        <td data-cell="meta" data-label="Settlement">{settlementLabel(advance)}</td>
        <td data-cell="meta" data-label="Date">{advance.status === "settled" ? dateLabel(advance.settled_on) : <>{dateLabel(advance.given_on)}{days > STALE_DAYS ? <> <OpsBadge tone="warning">{days} days</OpsBadge></> : null}</>}</td>
      </tr>;
    })}</tbody>
  </table></OpsTableWrap>;
}

function GiveCash({ people, branches }: { people: Person[]; branches: string[] }) {
  const router = useRouter();
  const [key, setKey] = useState(newPaymentKey);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const [form, setForm] = useState({ staffEmail: "", branch: branches[0] ?? "", currency: "NPR", amount: "", givenOn: nepalOperationalDate(), method: "cash", purpose: "" });

  function choosePerson(email: string) {
    const person = people.find((item) => item.email === email);
    setForm((current) => ({ ...current, staffEmail: email, branch: person?.branch ?? current.branch }));
  }

  async function give(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const person = people.find((item) => item.email === form.staffEmail);
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/finance/staff-cash", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify({ ...form, amount: Number(form.amount), staffName: person?.name ?? "" }) });
      const data = await response.json() as { error?: string; id?: string };
      if (!response.ok || !data.id) throw new Error(data.error || "The cash couldn't be recorded.");
      setKey(newPaymentKey());
      router.push(`/admin/finance/staff-cash/${encodeURIComponent(data.id)}`);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "The cash couldn't be recorded.", tone: "danger" });
      setBusy(false);
    }
  }

  return <OpsSurface title="Give cash" description="Each advance gets a numbered voucher (SA/…). Record it when the cash leaves the till.">
    {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
    <form onSubmit={give} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <OpsField label="Given to"><select required value={form.staffEmail} onChange={(event) => choosePerson(event.target.value)}>
        <option value="" disabled>Choose someone</option>
        {people.map((person) => <option key={person.email} value={person.email}>{person.name}</option>)}
      </select></OpsField>
      <OpsField label="Branch"><select value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })}>{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></OpsField>
      <OpsField label="Date given"><input type="date" required max={nepalOperationalDate()} value={form.givenOn} onChange={(event) => setForm({ ...form, givenOn: event.target.value })}/></OpsField>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,96px)] gap-2">
        <OpsField label="Amount"><input required inputMode="decimal" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></OpsField>
        <OpsField label="Currency"><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}>{crmCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></OpsField>
      </div>
      <OpsField label="Paid out by"><select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>{refundMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></OpsField>
      <OpsField label="What it's for" hint="e.g. Birgunj customs fees for this week"><input required minLength={3} maxLength={300} value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })}/></OpsField>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <OpsButton type="submit" variant="primary" disabled={busy || !people.length}><Wallet size={12}/>{busy ? "Recording…" : "Record cash given"}</OpsButton>
        {people.length ? null : <span className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">No active staff to choose from. Add them under <Link href="/admin/staff" className="ops-cell-link">Settings › People &amp; branches</Link> first.</span>}
      </div>
    </form>
  </OpsSurface>;
}
