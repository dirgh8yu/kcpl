"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Landmark, Plus } from "lucide-react";
import { OpsBadge, OpsButton, OpsField, OpsMono, OpsNotice, OpsSurface } from "../../operations-ui";
import type { ShipmentContainer } from "../../../shipment-containers";
import {
  depositDeductionReasonLabels,
  depositDeductionReasons,
  depositPayerLabels,
  depositPayers,
  depositStage,
  depositStageBadge,
  expectedDepositDeduction,
  type ContainerDeposit,
} from "../../../container-deposits";

/*
 * Container deposits on the Job File: what was paid to the line, which boxes
 * it covers, and getting it back once the empties are returned.
 */

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}
function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

async function send(url: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
  const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
  if (!response.ok || !data.ok) throw new Error(data.error || "That didn’t save. Try again.");
  return data;
}

export function DepositControl({ reference, deposits, containers, canEdit, canFinance, isManagement, today, defaultLine }: {
  reference: string;
  deposits: ContainerDeposit[] | null;
  containers: ShipmentContainer[];
  canEdit: boolean;
  canFinance: boolean;
  isManagement: boolean;
  today: string;
  defaultLine: string | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<{ id: string; form: "claim" | "refund" | "write_off" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const list = deposits ?? [];
  const base = `/api/admin/jobs/${encodeURIComponent(reference)}/deposits`;
  const held = list.filter((deposit) => deposit.status === "held" || deposit.status === "claimed");

  async function run(action: () => Promise<string>) {
    setBusy(true); setNotice(null);
    try { setNotice({ text: await action(), tone: "success" }); router.refresh(); return true; }
    catch (error) { setNotice({ text: error instanceof Error ? error.message : "That didn’t save. Try again.", tone: "danger" }); return false; }
    finally { setBusy(false); }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { ...Object.fromEntries(form), containerNumbers: form.getAll("containerNumbers") };
    if (await run(async () => { await send(base, "POST", body); return "Deposit recorded."; })) setAdding(false);
  }

  async function move(event: FormEvent<HTMLFormElement>, deposit: ContainerDeposit, action: string, done: string) {
    event.preventDefault();
    const body = { ...Object.fromEntries(new FormData(event.currentTarget)), action };
    if (await run(async () => { await send(`${base}/${encodeURIComponent(deposit.id)}`, "PATCH", body); return done; })) setOpen(null);
  }

  // Nothing to show on a shipment with no deposits and no one who could add one.
  if (!list.length && !canEdit) return null;
  const outstanding = held.reduce((map, deposit) => map.set(deposit.currency, (map.get(deposit.currency) ?? 0) + deposit.amount), new Map<string, number>());

  return (
    <OpsSurface
      id="shipment-deposits"
      title="Container deposits"
      description={held.length ? `${[...outstanding.entries()].map(([currency, amount]) => money(amount, currency)).join(" + ")} with the line` : undefined}
      action={canEdit ? <OpsButton variant="secondary" size="xs" onClick={() => setAdding((value) => !value)} aria-expanded={adding}><Plus size={13} strokeWidth={1.75} aria-hidden="true"/>{adding ? "Close" : "Add"}</OpsButton> : undefined}
    >
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}

      {adding && canEdit ? <form onSubmit={add} className="portal-form" aria-busy={busy}>
        <div className="portal-form-grid">
          <OpsField label="Paid to"><input name="shippingLine" required minLength={2} maxLength={120} defaultValue={defaultLine ?? ""} placeholder="Shipping line or its agent"/></OpsField>
          <OpsField label="Bill of lading"><input name="blNumber" maxLength={60} spellCheck={false} autoCapitalize="characters"/></OpsField>
          <OpsField label="Amount"><input name="amount" required inputMode="decimal" placeholder="100000"/></OpsField>
          <OpsField label="Currency"><input name="currency" maxLength={3} defaultValue="NPR" autoCapitalize="characters"/></OpsField>
          <OpsField label="Paid on"><input type="date" name="paidOn" max={today} defaultValue={today}/></OpsField>
          <OpsField label="Who paid"><select name="paidBy" defaultValue="kcpl">{depositPayers.map((payer) => <option key={payer} value={payer}>{depositPayerLabels[payer]}</option>)}</select></OpsField>
          <OpsField label="Payment reference" hint="Cheque, transfer or receipt number"><input name="paymentReference" maxLength={120}/></OpsField>
        </div>
        {containers.length > 1 ? <fieldset className="job-deposit-boxes">
          <legend className="ops-field-label">Containers it covers</legend>
          {containers.map((container) => <label key={container.id}><input type="checkbox" name="containerNumbers" value={container.number} defaultChecked/><OpsMono>{container.number}</OpsMono></label>)}
        </fieldset> : null}
        <OpsField label="Note" hint="Internal"><input name="note" maxLength={300}/></OpsField>
        <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}><Landmark size={14} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Saving…" : "Record deposit"}</OpsButton></div>
      </form> : null}

      {list.length ? <ul className="job-container-list">
        {list.map((deposit) => {
          const stage = depositStage(deposit, containers, today);
          const badge = depositStageBadge(stage);
          const expected = expectedDepositDeduction(deposit, containers, today);
          const form = open?.id === deposit.id ? open.form : null;
          const boxes = deposit.container_numbers.length ? deposit.container_numbers.join(", ") : "Every container on the shipment";
          const live = deposit.status === "held" || deposit.status === "claimed";
          return <li key={deposit.id} className="job-container">
            <div className="job-container-head">
              <div className="min-w-0">
                <p className="job-container-number"><strong>{money(deposit.amount, deposit.currency)}</strong> <span>to {deposit.shipping_line}{deposit.bl_number ? ` · BL ${deposit.bl_number}` : ""}</span></p>
                <p className="job-container-dates">Paid {dateLabel(deposit.paid_on)} · {depositPayerLabels[deposit.paid_by]}{deposit.payment_reference ? ` · ${deposit.payment_reference}` : ""}</p>
                <p className="job-container-dates">{boxes}</p>
                {live && expected.deduction > 0 ? <p className="job-container-dates">Expect {money(expected.expected_back, deposit.currency)} back: {money(expected.deduction, deposit.currency)} detention so far</p> : null}
                {live && expected.other.length ? <p className="job-container-dates">Detention in other currencies may also come off: {expected.other.map((item) => money(item.amount, item.currency)).join(" + ")}</p> : null}
                {deposit.status === "claimed" ? <p className="job-container-dates">Claimed {dateLabel(deposit.claimed_on)}{deposit.claim_reference ? ` · ${deposit.claim_reference}` : ""}</p> : null}
                {deposit.status === "refunded" ? <p className="job-container-dates">{money(deposit.amount_refunded ?? 0, deposit.currency)} back {dateLabel(deposit.refunded_on)}{deposit.deduction ? ` · ${money(deposit.deduction, deposit.currency)} kept for ${depositDeductionReasonLabels[deposit.deduction_reason ?? "other"].toLowerCase()}` : ""}{deposit.closed_note ? ` · ${deposit.closed_note}` : ""}</p> : null}
                {deposit.status === "written_off" ? <p className="job-container-dates">Written off: {deposit.closed_note}</p> : null}
              </div>
              <div className="job-container-actions">
                <OpsBadge tone={badge.tone} dot>{badge.label}</OpsBadge>
                {canEdit && deposit.status === "held" ? <OpsButton variant="ghost" size="xs" onClick={() => setOpen(form === "claim" ? null : { id: deposit.id, form: "claim" })} aria-expanded={form === "claim"}>{form === "claim" ? "Close" : "Claimed"}</OpsButton> : null}
                {canFinance && live ? <OpsButton variant="ghost" size="xs" onClick={() => setOpen(form === "refund" ? null : { id: deposit.id, form: "refund" })} aria-expanded={form === "refund"}>{form === "refund" ? "Close" : "Refund in"}</OpsButton> : null}
              </div>
            </div>
            {form === "claim" ? <form onSubmit={(event) => move(event, deposit, "claim", "Claim recorded.")} className="portal-form" aria-busy={busy}>
              <div className="portal-form-grid">
                <OpsField label="Claimed on"><input type="date" name="claimedOn" min={deposit.paid_on} max={today} defaultValue={today}/></OpsField>
                <OpsField label="Claim reference" hint="Optional"><input name="claimReference" maxLength={120}/></OpsField>
              </div>
              <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Save claim</OpsButton></div>
            </form> : null}
            {form === "refund" ? <form onSubmit={(event) => move(event, deposit, "refund", "Refund recorded. The deposit is closed.")} className="portal-form" aria-busy={busy}>
              <div className="portal-form-grid">
                <OpsField label="Received on"><input type="date" name="receivedOn" min={deposit.paid_on} max={today} defaultValue={today}/></OpsField>
                <OpsField label={`Amount back (${deposit.currency})`}><input name="amountReceived" required inputMode="decimal" defaultValue={expected.expected_back}/></OpsField>
                <OpsField label="If less, why"><select name="deductionReason" defaultValue={expected.deduction > 0 ? "detention" : ""}><option value="">Nothing kept</option>{depositDeductionReasons.map((reason) => <option key={reason} value={reason}>{depositDeductionReasonLabels[reason]}</option>)}</select></OpsField>
                <OpsField label="Note" hint="Optional"><input name="note" maxLength={300}/></OpsField>
              </div>
              <div className="portal-form-actions">
                {deposit.status === "claimed" && canEdit ? <OpsButton type="button" variant="ghost" size="sm" disabled={busy} onClick={() => run(async () => { await send(`${base}/${encodeURIComponent(deposit.id)}`, "PATCH", { action: "reopen" }); setOpen(null); return "Claim taken back."; })}>Not claimed yet</OpsButton> : null}
                {isManagement ? <OpsButton type="button" variant="ghost" size="sm" onClick={() => setOpen({ id: deposit.id, form: "write_off" })}>Write off instead</OpsButton> : null}
                <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Record refund</OpsButton>
              </div>
            </form> : null}
            {form === "write_off" ? <form onSubmit={(event) => move(event, deposit, "write_off", "Deposit written off.")} className="portal-form" aria-busy={busy}>
              <OpsField label="Why it won’t come back" hint="Stays on the record"><input name="reason" required minLength={10} maxLength={300}/></OpsField>
              <div className="portal-form-actions"><OpsButton type="submit" variant="danger" size="sm" disabled={busy}>Write off</OpsButton></div>
            </form> : null}
          </li>;
        })}
      </ul> : <p className="portal-footnote m-0">No deposits recorded. If the line took a deposit to release the boxes, record it to get it back after the empties are returned.</p>}
    </OpsSurface>
  );
}
