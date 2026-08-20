"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseClientAuth } from "../firebase-client";

export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

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
    } catch (reason) {
      console.warn("KCPL staff sign-in was not accepted", reason);
      setError("Sign-in was not accepted. Check your KCPL staff email and password, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <label className="block" htmlFor="admin-email"><span className="mb-1.5 block text-[11px] font-medium text-[#59616a]">Staff email</span><span className="flex h-10 items-center gap-2 rounded-lg border border-[#dfe2e6] bg-[#fbfbfb] px-3 focus-within:border-[#9aa6e5] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#5367d9]/[.06]"><Mail size={14} className="text-[#8c939a]"/><input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[#252a30] outline-none"/></span></label>
      <label className="block" htmlFor="admin-password"><span className="mb-1.5 block text-[11px] font-medium text-[#59616a]">Password</span><span className="flex h-10 items-center gap-2 rounded-lg border border-[#dfe2e6] bg-[#fbfbfb] px-3 focus-within:border-[#9aa6e5] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#5367d9]/[.06]"><LockKeyhole size={14} className="text-[#8c939a]"/><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[#252a30] outline-none"/></span></label>
      {error ? <div role="alert" className="rounded-lg border border-[#ecd8da] bg-[#fbf3f4] px-3 py-2.5 text-[11px] leading-5 text-[#8c4a52]">{error}</div> : null}
      <button disabled={busy} type="submit" className="flex h-10 w-full items-center justify-center rounded-lg bg-[#283a77] px-4 text-xs font-semibold text-white transition hover:bg-[#223366] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Signing in…" : "Open KCPL Operations"}</button>
      <p className="text-center text-[10px] leading-4 text-[#9299a0]">Authorised KCPL staff only. Sessions are established server-side after Firebase authentication.</p>
    </form>
  );
}
