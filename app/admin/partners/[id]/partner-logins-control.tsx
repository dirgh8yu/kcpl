"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { OpsBadge, OpsButton, OpsField, OpsNotice, OpsSurface } from "../../operations-ui";
import type { PartnerLogin } from "../../../partner/partner-accounts.server";

/** The people at this partner who sign in to the partner portal. */
export function PartnerLoginsControl({ partnerId, logins, canEdit }: { partnerId: string; logins: PartnerLogin[] | null; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "danger" | "warning"; link?: string } | null>(null);
  const base = `/api/admin/partners/${encodeURIComponent(partnerId)}/logins`;

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; sent?: boolean; link?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "The invitation couldn’t be sent.");
      setNotice(data.sent ? { text: `Invitation sent to ${String(form.email)}.`, tone: "success" } : { text: "No email service is set up, so send them this link to set their password:", tone: "warning", link: data.link });
      setOpen(false); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "The invitation couldn’t be sent.", tone: "danger" }); }
    finally { setBusy(false); }
  }

  async function toggle(login: PartnerLogin) {
    if (login.active && !window.confirm(`Switch off ${login.email}? They’re signed out straight away.`)) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(base, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: login.email, active: !login.active }) });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "That didn’t save.");
      router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "That didn’t save.", tone: "danger" }); }
    finally { setBusy(false); }
  }

  if (logins === null) return null;
  return <OpsSurface title="Partner portal logins" description="They see only the shipments you put this partner on, from the Job File." action={canEdit ? <OpsButton variant="secondary" size="xs" onClick={() => setOpen((value) => !value)} aria-expanded={open}><KeyRound size={13} strokeWidth={1.75} aria-hidden="true"/>{open ? "Close" : "Add"}</OpsButton> : undefined}>
    {notice ? <OpsNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}{notice.link ? <> <code className="partner-invite-link">{notice.link}</code></> : null}</OpsNotice> : null}
    {open && canEdit ? <form onSubmit={invite} className="grid gap-3">
      <OpsField label="Their email"><input type="email" name="email" required autoComplete="off"/></OpsField>
      <OpsField label="Their name" hint="Optional"><input name="name" maxLength={120}/></OpsField>
      <OpsButton type="submit" variant="primary" size="sm" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</OpsButton>
    </form> : null}
    {logins.length ? <ul className="grid gap-2">{logins.map((login) => <li key={login.email} className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--app-label-size)]">
      <span className="min-w-0"><span className="block truncate text-[var(--admin-ink)]">{login.name || login.email}</span>{login.name ? <span className="block truncate text-[var(--admin-muted)]">{login.email}</span> : null}</span>
      <span className="flex items-center gap-2"><OpsBadge tone={login.active ? (login.last_sign_in_at ? "success" : "info") : "neutral"}>{login.active ? (login.last_sign_in_at ? "Active" : "Invited") : "Switched off"}</OpsBadge>{canEdit ? <OpsButton variant="ghost" size="xs" disabled={busy} onClick={() => toggle(login)}>{login.active ? "Switch off" : "Switch on"}</OpsButton> : null}</span>
    </li>)}</ul> : !open ? <p className="text-[length:var(--app-label-size)] text-[var(--admin-muted)]">No logins yet. Add the people at this partner who should post milestones and upload documents.</p> : null}
  </OpsSurface>;
}
