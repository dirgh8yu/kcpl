"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseClientAuth } from "../firebase-client";

export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const auth = firebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      await signOut(auth).catch(() => undefined);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "KCPL sign-in was not accepted.");
      }

      window.location.assign("/admin");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "KCPL sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-5" aria-busy={busy}>
      <div className="grid gap-2">
        <label htmlFor="admin-email" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5F5F5F]">
          Staff email
        </label>
        <div className="group relative">
          <Mail aria-hidden="true" size={17} strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7B7B7B] transition-colors group-focus-within:text-[#DC143C]" />
          <input
            id="admin-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "admin-login-error" : undefined}
            placeholder="name@kapileshwor.com"
            className="h-[52px] w-full rounded-xl border border-[#D9D9D5] bg-white pl-11 pr-4 text-[14px] font-medium text-[#101010] outline-none transition placeholder:text-[#A0A09B] hover:border-[#BDBDB8] focus:border-[#DC143C] focus:ring-4 focus:ring-[#DC143C]/10 disabled:cursor-not-allowed disabled:bg-[#F1F1EE]"
            disabled={busy}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="admin-password" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5F5F5F]">
          Password
        </label>
        <div className="group relative">
          <LockKeyhole aria-hidden="true" size={17} strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7B7B7B] transition-colors group-focus-within:text-[#DC143C]" />
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "admin-login-error" : undefined}
            className="h-[52px] w-full rounded-xl border border-[#D9D9D5] bg-white pl-11 pr-12 text-[14px] font-medium text-[#101010] outline-none transition hover:border-[#BDBDB8] focus:border-[#DC143C] focus:ring-4 focus:ring-[#DC143C]/10 disabled:cursor-not-allowed disabled:bg-[#F1F1EE]"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#73736E] transition hover:bg-[#F1F1EE] hover:text-[#101010] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC143C] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            disabled={busy}
          >
            {showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="min-h-[1px]">
        {error ? (
          <div id="admin-login-error" role="alert" className="rounded-xl border border-[#DC143C]/20 bg-[#DC143C]/[0.055] px-4 py-3 text-[12px] font-semibold leading-5 text-[#A70F2E]">
            {error}
          </div>
        ) : null}
      </div>

      <button
        disabled={busy}
        type="submit"
        className="group flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#DC143C] px-5 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgba(220,20,60,0.18)] transition hover:bg-[#C41235] hover:shadow-[0_12px_32px_rgba(220,20,60,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC143C] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
      >
        <span>{busy ? "Signing in…" : "Open KCPL Operations"}</span>
        {!busy ? <ArrowRight aria-hidden="true" size={16} className="transition-transform group-hover:translate-x-0.5" /> : null}
      </button>
    </form>
  );
}
