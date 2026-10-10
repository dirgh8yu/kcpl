"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { OpsBadge, OpsButton, OpsField, OpsNotice, OpsSurface } from "../../operations-ui";
import { OpsFileDrop } from "../../ops-file-drop";
import {
  CLAIM_MAX_PHOTOS,
  claimCompensationLabels,
  claimCompensationMethods,
  claimBadge,
  claimKindLabels,
  claimKinds,
  claimNoticeDaysLeft,
  claimOpen,
  claimPartyLabels,
  claimParties,
  type CargoClaim,
} from "../../../cargo-claims";

/*
 * Cargo claims on the Job File: what the customer reported, giving notice to
 * whoever is liable before the deadline, and how it ended.
 */

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}
function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

async function send(url: string, method: "POST" | "PATCH", body: FormData | Record<string, unknown>) {
  const isForm = body instanceof FormData;
  const response = await fetch(url, { method, headers: isForm ? undefined : { "content-type": "application/json" }, body: isForm ? body : JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; number?: string };
  if (!response.ok || !data.ok) throw new Error(data.error || "That didn’t save. Try again.");
  return data;
}

type Form = "file" | "settle" | "reject" | "withdraw" | "notice";

export function ClaimControl({ reference, claims, canEdit, canFinance, today }: { reference: string; claims: CargoClaim[] | null; canEdit: boolean; canFinance: boolean; today: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [open, setOpen] = useState<{ id: string; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" } | null>(null);
  const list = claims ?? [];
  const base = `/api/admin/jobs/${encodeURIComponent(reference)}/claims`;
  const live = list.filter(claimOpen);

  async function run(action: () => Promise<string>) {
    setBusy(true); setNotice(null);
    try { setNotice({ text: await action(), tone: "success" }); router.refresh(); return true; }
    catch (error) { setNotice({ text: error instanceof Error ? error.message : "That didn’t save. Try again.", tone: "danger" }); return false; }
    finally { setBusy(false); }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.delete("photos");
    for (const photo of photos.slice(0, CLAIM_MAX_PHOTOS)) form.append("photos", photo);
    if (await run(async () => { const data = await send(base, "POST", form); return `Claim ${data.number ?? ""} opened.`.replace("  ", " "); })) { setAdding(false); setPhotos([]); }
  }

  async function move(event: FormEvent<HTMLFormElement>, claim: CargoClaim, action: string, done: string) {
    event.preventDefault();
    const body = { ...Object.fromEntries(new FormData(event.currentTarget)), action };
    if (await run(async () => { await send(`${base}/${encodeURIComponent(claim.id)}`, "PATCH", body); return done; })) setOpen(null);
  }

  if (!list.length && !canEdit) return null;
  const toggle = (claim: CargoClaim, form: Form) => setOpen(open?.id === claim.id && open.form === form ? null : { id: claim.id, form });

  return (
    <OpsSurface
      id="shipment-claims"
      title="Claims"
      description={live.length ? `${live.length} open` : undefined}
      priority={live.some((claim) => (claimNoticeDaysLeft(claim, today) ?? 99) <= 1) ? "danger" : live.length ? "warning" : "normal"}
      action={canEdit ? <OpsButton variant="secondary" size="xs" onClick={() => setAdding((value) => !value)} aria-expanded={adding}><Plus size={13} strokeWidth={1.75} aria-hidden="true"/>{adding ? "Close" : "Open a claim"}</OpsButton> : undefined}
    >
      {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</OpsNotice> : null}

      {adding && canEdit ? <form onSubmit={add} className="portal-form" aria-busy={busy}>
        <div className="portal-form-grid">
          <OpsField label="What happened"><select name="kind" defaultValue="damage">{claimKinds.map((kind) => <option key={kind} value={kind}>{claimKindLabels[kind]}</option>)}</select></OpsField>
          <OpsField label="Found on"><input type="date" name="noticedOn" max={today} defaultValue={today}/></OpsField>
          <OpsField label="Value claimed" hint="Optional"><input name="claimedAmount" inputMode="decimal"/></OpsField>
          <OpsField label="Currency"><input name="currency" maxLength={3} defaultValue="NPR" autoCapitalize="characters"/></OpsField>
        </div>
        <OpsField label="Description" hint="Which packages, what is wrong, what the delivery receipt says"><textarea name="description" required minLength={10} maxLength={2000} rows={3}/></OpsField>
        <OpsFileDrop prompt="Add photos" hint={`Up to ${CLAIM_MAX_PHOTOS}: the damage, the packaging, the receipt`} accept="image/jpeg,image/png,image/webp,application/pdf" multiple chosen={photos.length ? `${photos.length} chosen` : null} onFiles={(files) => setPhotos(files.slice(0, CLAIM_MAX_PHOTOS))}/>
        <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}><ShieldAlert size={14} strokeWidth={1.75} aria-hidden="true"/>{busy ? "Saving…" : "Open claim"}</OpsButton></div>
      </form> : null}

      {list.length ? <ul className="job-container-list">{list.map((claim) => {
        const badge = claimBadge(claim, today);
        const form = open?.id === claim.id ? open.form : null;
        const editable = canEdit && claimOpen(claim);
        return <li key={claim.id} className="job-container">
          <div className="job-container-head">
            <div className="min-w-0">
              <p className="job-container-number"><strong>{claimKindLabels[claim.kind]}</strong> <span>{claim.number}{claim.claimed_amount ? ` · ${money(claim.claimed_amount, claim.currency)} claimed` : ""}</span></p>
              <p className="job-container-dates">{claim.description}</p>
              <p className="job-container-dates">Found {dateLabel(claim.noticed_on)} · {claim.reported_source === "customer" ? `reported by ${claim.reported_by_name} in the portal` : `opened by ${claim.reported_by_name}`}{claim.status === "reported" && claim.notice_due ? ` · notice due ${dateLabel(claim.notice_due)}` : ""}</p>
              {claim.photo_document_ids.length ? <p className="job-container-dates">{claim.photo_document_ids.map((id, index) => <a key={id} className="ops-cell-link mr-3" href={`/api/admin/shipments/${encodeURIComponent(reference)}/documents/${id}`}>Photo {index + 1}</a>)}</p> : null}
              {claim.filed_on ? <p className="job-container-dates">Filed {dateLabel(claim.filed_on)} with {claim.against_name ?? (claim.against ? claimPartyLabels[claim.against].toLowerCase() : "—")}{claim.filed_reference ? ` · ${claim.filed_reference}` : ""}</p> : null}
              {claim.status === "settled" ? <p className="job-container-dates">{[claim.recovered_amount ? `${money(claim.recovered_amount, claim.currency)} recovered` : "", claim.compensation_method ? `${claim.compensation_amount ? `${money(claim.compensation_amount, claim.currency)} · ` : ""}${claimCompensationLabels[claim.compensation_method]}` : ""].filter(Boolean).join(" · ")}{claim.outcome_note ? ` · ${claim.outcome_note}` : ""}</p> : null}
              {claim.status === "rejected" || claim.status === "withdrawn" ? <p className="job-container-dates">{claim.outcome_note}</p> : null}
            </div>
            <div className="job-container-actions">
              <OpsBadge tone={badge.tone} dot>{badge.label}</OpsBadge>
              {editable && claim.status === "reported" ? <OpsButton variant="ghost" size="xs" onClick={() => toggle(claim, "file")} aria-expanded={form === "file"}>{form === "file" ? "Close" : "Filed"}</OpsButton> : null}
              {editable && canFinance ? <OpsButton variant="ghost" size="xs" onClick={() => toggle(claim, "settle")} aria-expanded={form === "settle"}>{form === "settle" ? "Close" : "Settle"}</OpsButton> : null}
              {editable ? <OpsButton variant="ghost" size="xs" onClick={() => toggle(claim, canFinance ? "reject" : "withdraw")} aria-expanded={form === "reject" || form === "withdraw"}>{form === "reject" || form === "withdraw" ? "Close" : "Close claim"}</OpsButton> : null}
            </div>
          </div>
          {form === "file" ? <form onSubmit={(event) => move(event, claim, "file", "Claim filed.")} className="portal-form" aria-busy={busy}>
            <div className="portal-form-grid">
              <OpsField label="Filed with"><select name="against" defaultValue="carrier">{claimParties.map((party) => <option key={party} value={party}>{claimPartyLabels[party]}</option>)}</select></OpsField>
              <OpsField label="Name"><input name="againstName" maxLength={120} placeholder="Line, insurer or agent"/></OpsField>
              <OpsField label="Notice given on"><input type="date" name="filedOn" min={claim.noticed_on} max={today} defaultValue={today}/></OpsField>
              <OpsField label="Their reference" hint="Optional"><input name="filedReference" maxLength={120}/></OpsField>
            </div>
            <div className="portal-form-actions">
              <OpsButton type="button" variant="ghost" size="sm" onClick={() => setOpen({ id: claim.id, form: "notice" })}>Change the notice deadline</OpsButton>
              <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Save</OpsButton>
            </div>
          </form> : null}
          {form === "notice" ? <form onSubmit={(event) => move(event, claim, "notice_due", "Notice deadline changed.")} className="portal-form" aria-busy={busy}>
            <OpsField label="Notice due by" hint="As the bill of lading, air waybill or policy says"><input type="date" name="noticeDue" required min={claim.noticed_on} defaultValue={claim.notice_due ?? ""}/></OpsField>
            <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Save deadline</OpsButton></div>
          </form> : null}
          {form === "settle" ? <form onSubmit={(event) => move(event, claim, "settle", "Claim settled.")} className="portal-form" aria-busy={busy}>
            <div className="portal-form-grid">
              <OpsField label={`Recovered from them (${claim.currency})`} hint="0 if nothing"><input name="recoveredAmount" inputMode="decimal" defaultValue="0"/></OpsField>
              <OpsField label={`To the customer (${claim.currency})`}><input name="compensationAmount" inputMode="decimal" defaultValue={claim.claimed_amount ?? ""}/></OpsField>
              <OpsField label="How"><select name="compensationMethod" defaultValue="credit_note">{claimCompensationMethods.map((method) => <option key={method} value={method}>{claimCompensationLabels[method]}</option>)}</select></OpsField>
              <OpsField label="Note" hint="Optional"><input name="outcomeNote" maxLength={500}/></OpsField>
            </div>
            <p className="portal-footnote m-0">A credit note or refund is issued from the customer’s invoice or credits as usual; this records the outcome.</p>
            <div className="portal-form-actions"><OpsButton type="submit" variant="primary" size="sm" disabled={busy}>Record settlement</OpsButton></div>
          </form> : null}
          {form === "reject" || form === "withdraw" ? <form onSubmit={(event) => move(event, claim, form, form === "reject" ? "Claim closed as not accepted." : "Claim withdrawn.")} className="portal-form" aria-busy={busy}>
            {canFinance ? <OpsField label="Close as"><select value={form} onChange={(event) => setOpen({ id: claim.id, form: event.target.value as Form })}><option value="reject">Not accepted</option><option value="withdraw">Withdrawn by the customer</option></select></OpsField> : null}
            <OpsField label={form === "reject" ? "Why not" : "Note"} hint={form === "reject" ? "The customer sees that it wasn’t accepted" : "Optional"}><input name="reason" required={form === "reject"} minLength={form === "reject" ? 10 : undefined} maxLength={500}/></OpsField>
            <div className="portal-form-actions"><OpsButton type="submit" variant={form === "reject" ? "danger" : "secondary"} size="sm" disabled={busy}>Close claim</OpsButton></div>
          </form> : null}
        </li>;
      })}</ul> : <p className="portal-footnote m-0">No claims. Open one if the customer reports damage, shortage, loss or a costly delay, so notice reaches the carrier or insurer in time.</p>}
    </OpsSurface>
  );
}
