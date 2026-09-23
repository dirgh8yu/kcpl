"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseClientAuth } from "../firebase-client";

export function AdminLogin() {
  const router = useRouter();
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

      // The session cookie was just set server-side. `refresh()` clears the
      // client cache and re-renders the server components behind /admin so the
      // authenticated shell is what lands, without a full document reload.
      router.replace("/admin");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "KCPL sign-in failed.");
      // Only released on failure: on success the form stays disabled until the
      // navigation unmounts it, so the fields cannot flash back to editable.
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-5" aria-busy={busy}>
      <div className="grid gap-2">
        <label htmlFor="admin-email" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
          Staff email
        </label>
        <div className="group relative">
          <Mail aria-hidden="true" size={17} strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--admin-faint)] transition-colors group-focus-within:text-[var(--admin-crimson)]" />
          <input
            id="admin-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "admin-login-error" : undefined}
            placeholder="name@kapileshwor.com"
            className="h-[52px] w-full rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] pl-11 pr-4 text-[14px] font-medium text-[var(--admin-ink)] outline-none transition placeholder:text-[var(--admin-faint)] hover:border-[var(--admin-line-strong)] focus:border-[var(--admin-crimson)] focus:ring-4 focus:ring-[var(--admin-crimson)]/10 disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-muted)]"
            disabled={busy}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="admin-password" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
          Password
        </label>
        <div className="group relative">
          <LockKeyhole aria-hidden="true" size={17} strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--admin-faint)] transition-colors group-focus-within:text-[var(--admin-crimson)]" />
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "admin-login-error" : undefined}
            className="h-[52px] w-full rounded-[var(--app-radius)] border border-[var(--admin-line)] bg-[var(--admin-surface)] pl-11 pr-12 text-[14px] font-medium text-[var(--admin-ink)] outline-none transition hover:border-[var(--admin-line-strong)] focus:border-[var(--admin-crimson)] focus:ring-4 focus:ring-[var(--admin-crimson)]/10 disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-muted)]"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[var(--app-radius)] text-[var(--admin-muted)] transition hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-crimson)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
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
          <div id="admin-login-error" role="alert" className="rounded-[var(--app-radius)] border border-[var(--admin-crimson)]/20 bg-[var(--admin-crimson)]/[0.055] px-4 py-3 text-[12px] font-semibold leading-5 text-[var(--admin-crimson-dark)]">
            {error}
          </div>
        ) : null}
      </div>

      <button
        disabled={busy}
        type="submit"
        className="group flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[var(--app-radius)] bg-[var(--admin-crimson)] px-5 text-[13px] font-semibold text-[var(--admin-on-crimson)] shadow-[0_10px_28px_rgba(220,20,60,0.18)] transition hover:bg-[var(--admin-crimson-dark)] hover:shadow-[0_12px_32px_rgba(220,20,60,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-crimson)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
      >
        <span>{busy ? "Signing in…" : "Open KCPL Operations"}</span>
        {!busy ? <ArrowRight aria-hidden="true" size={16} className="transition-transform group-hover:translate-x-0.5" /> : null}
      </button>
    </form>
  );
}
