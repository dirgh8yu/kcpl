"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, ReceiptText, Trash2 } from "lucide-react";
import { nepalOperationalDate } from "../../../../invoice-effective-status";
import { jobCostCategories, jobCostCategoryLabels } from "../../../job-file";
import { newPaymentKey } from "../../../payment-key";
import { financePaymentMethodLabels } from "../../finance-data";
import { refundMethods } from "../../refund-policy";
import type { StaffAdvance } from "../../staff-cash.server";
import { staffCashDaysOpen } from "../../staff-cash-policy";
import { OpsBadge, OpsButton, OpsDetailGrid, OpsDetailItem, OpsEmptyState, OpsField, OpsMetric, OpsMetricStrip, OpsMono, OpsNotice, OpsPage, OpsPageHeader, OpsSurface, OpsTableWrap } from "../../../operations-ui";
import { dateLabel, money } from "../../credits/credits-format";

const blankExpense = () => ({ date: nepalOperationalDate(), description: "", amount: "", category: "customs", shipmentReference: "", receiptNumber: "" });

export function AdvanceWorkspace({ advance }: { advance: StaffAdvance }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const [expense, setExpense] = useState(blankExpense);
  const [expenseKey, setExpenseKey] = useState(newPaymentKey);
  const [settle, setSettle] = useState({ settledOn: nepalOperationalDate(), method: "cash", note: "" });
  const open = advance.status === "open";
  const base = `/api/admin/finance/staff-cash/${encodeURIComponent(advance.id)}`;

  async function send(url: string, method: "POST" | "DELETE", body: Record<string, unknown>, success: string, headers: Record<string, string> = {}) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(url, { method, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "That didn't go through.");
      setNotice({ text: success, tone: "success" });
      router.refresh();
      return true;
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "That didn't go through.", tone: "danger" });
      return false;
    } finally { setBusy(false); }
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await send(`${base}/expenses`, "POST", { ...expense, amount: Number(expense.amount) }, "Receipt added.", { "idempotency-key": expenseKey });
    if (ok) { setExpense((current) => ({ ...blankExpense(), date: current.date, category: current.category })); setExpenseKey(newPaymentKey()); }
  }

  async function settleAdvance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const outcome = advance.settlement.kind === "return" ? `${advance.staff_name} hands back ${money(advance.settlement.amount, advance.currency)}`
      : advance.settlement.kind === "reimburse" ? `KCPL pays ${advance.staff_name} ${money(advance.settlement.amount, advance.currency)}` : "Nothing changes hands";
    const costs = advance.expenses.filter((item) => item.shipment_reference).length;
    if (!window.confirm(`Settle ${advance.number}? ${outcome}.${costs ? ` ${costs} receipt${costs === 1 ? " becomes a Job File cost" : "s become Job File costs"}.` : ""} Receipts can't change after this.`)) return;
    await send(`${base}/settle`, "POST", settle, "Advance settled.");
  }

  const days = staffCashDaysOpen(advance.given_on, nepalOperationalDate());
  return <OpsPage>
    <OpsPageHeader eyebrow="Staff cash" title={`${advance.staff_name} · ${advance.number}`} description={advance.purpose}
      meta={<OpsBadge tone={open ? (days > 14 ? "warning" : "info") : "success"} dot>{open ? `Open ${days} day${days === 1 ? "" : "s"}` : "Settled"}</OpsBadge>}/>
    <div className="ops-content-wide ops-stack">
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}
      <OpsMetricStrip columns={3}>
        <OpsMetric label="Given" value={money(advance.amount, advance.currency)} detail={`${dateLabel(advance.given_on)} · ${financePaymentMethodLabels[advance.method as keyof typeof financePaymentMethodLabels] ?? advance.method}`}/>
        <OpsMetric label="Receipts" value={money(advance.spent, advance.currency)} detail={`${advance.expenses.length} entered`}/>
        <OpsMetric label={open ? "On settling" : "Settled"} value={advance.settlement.kind === "even" ? "Even" : money(advance.settlement.amount, advance.currency)} detail={advance.settlement.kind === "return" ? (open ? "To come back" : "Came back") : advance.settlement.kind === "reimburse" ? (open ? `To pay ${advance.staff_name}` : `Paid to ${advance.staff_name}`) : "Spent exactly what was given"}/>
      </OpsMetricStrip>

      <OpsSurface title="Receipts" flush>
        {advance.expenses.length ? <OpsTableWrap><table className="ops-table ops-register-table ops-stack-table">
          <thead><tr><th>Spent on</th><th>Amount</th><th>Shipment</th><th>Date</th>{open ? <th><span className="sr-only">Remove</span></th> : null}</tr></thead>
          <tbody>{advance.expenses.map((item) => <tr key={item.id}>
            <td data-cell="primary"><span className="ops-cell-primary">{item.description}</span><span className="ops-cell-secondary">{jobCostCategoryLabels[item.category]}{item.receipt_number ? ` · receipt ${item.receipt_number}` : ""}</span></td>
            <td data-cell="amount" data-label="Amount" className="font-semibold tabular-nums text-[var(--admin-ink)]">{money(item.amount, advance.currency)}</td>
            <td data-cell="meta" data-label="Shipment">{item.shipment_reference ? <Link href={`/admin/jobs/${encodeURIComponent(item.shipment_reference)}`} className="ops-cell-link"><OpsMono>{item.shipment_reference}</OpsMono></Link> : "Office expense"}</td>
            <td data-cell="meta" data-label="Date">{dateLabel(item.date)}</td>
            {open ? <td data-cell="actions"><OpsButton variant="ghost" disabled={busy} aria-label={`Remove ${item.description}`} onClick={() => { if (window.confirm(`Remove "${item.description}"?`)) void send(`${base}/expenses`, "DELETE", { expenseId: item.id }, "Receipt removed."); }}><Trash2 size={12}/></OpsButton></td> : null}
          </tr>)}</tbody>
        </table></OpsTableWrap> : <OpsEmptyState compact icon={<ReceiptText size={17} strokeWidth={1.75} aria-hidden="true"/>} title="No receipts yet" description={open ? "Enter each receipt the staff member brings back." : "Nothing was spent from this advance."}/>}
      </OpsSurface>

      {open ? <OpsSurface title="Add a receipt" description="Name the shipment when the fee was for one: it becomes that Job File's cost when the advance is settled.">
        <form onSubmit={addExpense} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OpsField label="What it was for"><input required minLength={3} maxLength={300} value={expense.description} onChange={(event) => setExpense({ ...expense, description: event.target.value })} placeholder="Port handling fee"/></OpsField>
          <OpsField label={`Amount (${advance.currency})`}><input required inputMode="decimal" type="number" min="0.01" step="0.01" value={expense.amount} onChange={(event) => setExpense({ ...expense, amount: event.target.value })}/></OpsField>
          <OpsField label="Date"><input type="date" required max={nepalOperationalDate()} value={expense.date} onChange={(event) => setExpense({ ...expense, date: event.target.value })}/></OpsField>
          <OpsField label="Kind of cost"><select value={expense.category} onChange={(event) => setExpense({ ...expense, category: event.target.value })}>{jobCostCategories.map((category) => <option key={category} value={category}>{jobCostCategoryLabels[category]}</option>)}</select></OpsField>
          <OpsField label="Shipment" hint="Leave blank for an office expense"><input maxLength={40} value={expense.shipmentReference} onChange={(event) => setExpense({ ...expense, shipmentReference: event.target.value })} placeholder="KCPL-S-…" autoCapitalize="characters"/></OpsField>
          <OpsField label="Receipt no." hint="Optional"><input maxLength={80} value={expense.receiptNumber} onChange={(event) => setExpense({ ...expense, receiptNumber: event.target.value })}/></OpsField>
          <div className="sm:col-span-2 lg:col-span-3"><OpsButton type="submit" variant="secondary" disabled={busy}><Plus size={12}/>Add receipt</OpsButton></div>
        </form>
      </OpsSurface> : null}

      {open ? <OpsSurface title="Settle" description={advance.settlement.kind === "return" ? `${advance.staff_name} hands back ${money(advance.settlement.amount, advance.currency)}, what's left after the receipts.` : advance.settlement.kind === "reimburse" ? `${advance.staff_name} spent ${money(advance.settlement.amount, advance.currency)} more than they were given. KCPL pays it back.` : "The receipts add up to exactly what was given."}>
        <form onSubmit={settleAdvance} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,180px)_minmax(0,180px)_minmax(0,1fr)_auto] lg:items-end">
          <OpsField label="Date"><input type="date" required max={nepalOperationalDate()} value={settle.settledOn} onChange={(event) => setSettle({ ...settle, settledOn: event.target.value })}/></OpsField>
          <OpsField label={advance.settlement.kind === "reimburse" ? "Paid back by" : "Returned by"}><select value={settle.method} onChange={(event) => setSettle({ ...settle, method: event.target.value })}>{refundMethods.map((method) => <option key={method} value={method}>{financePaymentMethodLabels[method]}</option>)}</select></OpsField>
          <OpsField label="Note"><input maxLength={300} value={settle.note} onChange={(event) => setSettle({ ...settle, note: event.target.value })} placeholder="Optional"/></OpsField>
          <OpsButton type="submit" variant="primary" disabled={busy}><CheckCircle2 size={12}/>Settle</OpsButton>
        </form>
      </OpsSurface> : null}

      <OpsSurface title="Details">
        <OpsDetailGrid columns={3}>
          <OpsDetailItem label="Voucher"><OpsMono>{advance.number}</OpsMono></OpsDetailItem>
          <OpsDetailItem label="Branch">{advance.branch}</OpsDetailItem>
          <OpsDetailItem label="Given by">{advance.given_by_name}</OpsDetailItem>
          {advance.status === "settled" ? <OpsDetailItem label="Settled">{dateLabel(advance.settled_on)}{advance.settled_by_name ? ` by ${advance.settled_by_name}` : ""}</OpsDetailItem> : null}
        </OpsDetailGrid>
      </OpsSurface>
    </div>
  </OpsPage>;
}
