"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseClientAuth } from "../firebase-client";

export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const auth = firebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
      const data = await response.json() as { ok?: boolean; error?: string };
      await signOut(auth).catch(() => undefined);
      if (!response.ok || !data.ok) throw new Error(data.error || "KCPL sign-in was not accepted.");
      window.location.assign("/admin");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "KCPL sign-in failed."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="mt-7 grid gap-4">
    <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#776d65]"><Mail size={11}/>Staff email</span><input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-[12px] border border-[#e2d9d2] bg-[#faf7f4] px-3.5 text-[12px] text-[#443b35] outline-none transition focus:border-[#e1a592] focus:bg-white focus:shadow-[0_0_0_4px_rgba(232,117,93,.07)]"/></label>
    <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#776d65]"><LockKeyhole size={11}/>Password</span><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-[12px] border border-[#e2d9d2] bg-[#faf7f4] px-3.5 text-[12px] text-[#443b35] outline-none transition focus:border-[#e1a592] focus:bg-white focus:shadow-[0_0_0_4px_rgba(232,117,93,.07)]"/></label>
    {error ? <div className="rounded-[11px] border border-[#efd0d1] bg-[#fff1f1] px-3 py-2.5 text-[9px] font-semibold leading-4 text-[#a14f52]">{error}</div> : null}
    <button disabled={busy} type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#e8755d] px-4 text-[10px] font-bold text-white shadow-[0_8px_20px_rgba(191,91,68,.14)] transition hover:bg-[#d96851] disabled:opacity-50">{busy ? "Signing in…" : <>Open KCPL Operations <ArrowRight size={12}/></>}</button>
  </form>;
}
