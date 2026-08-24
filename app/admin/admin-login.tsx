"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseClientAuth } from "../firebase-client";
import { safeAdminNext } from "./admin-entry";

function friendlySignInError(reason: unknown) {
  const code = typeof reason === "object" && reason && "code" in reason ? String((reason as { code?: unknown }).code ?? "") : "";
  if (["auth/invalid-credential", "auth/invalid-login-credentials", "auth/user-not-found", "auth/wrong-password"].includes(code)) {
    return "The email or password is incorrect.";
  }
  if (code === "auth/too-many-requests") return "Too many sign-in attempts. Wait a moment and try again.";
  if (code === "auth/network-request-failed") return "KCPL could not reach Firebase. Check your connection and try again.";
  if (code === "auth/user-disabled") return "This Firebase account is disabled. Contact KCPL Management.";
  if (reason instanceof Error) {
    if (reason.message.startsWith("Firebase:")) return "KCPL sign-in could not be completed. Try again.";
    return reason.message;
  }
  return "KCPL sign-in could not be completed. Try again.";
}

export function AdminLogin({ nextPath }: { nextPath?: string }) {
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

    const normalizedEmail = email.trim().toLowerCase();
    try {
      const auth = firebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/admin/session", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      await signOut(auth).catch(() => undefined);
      if (!response.ok || !data.ok) throw new Error(data.error || "KCPL sign-in was not accepted.");
      window.location.assign(safeAdminNext(nextPath));
    } catch (reason) {
      setError(friendlySignInError(reason));
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="mt-8 grid gap-5" noValidate>
    <label className="block">
      <span className="mb-2 block text-[8px] font-semibold uppercase tracking-[.06em] text-[#737373]">Staff email</span>
      <input
        id="admin-email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        disabled={busy}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="staff@kcpl.com.np"
        className="h-[38px] w-full rounded-[6px] border border-[#e2e2e2] bg-white px-3 text-[11px] font-medium text-[#141414] outline-none transition placeholder:text-[#a3a3a3] focus:border-[#b8b8b8] focus:ring-2 focus:ring-[#141414]/5 disabled:bg-[#fafafa] disabled:text-[#737373]"
      />
    </label>

    <label className="block">
      <span className="mb-2 block text-[8px] font-semibold uppercase tracking-[.06em] text-[#737373]">Password</span>
      <span className="relative block">
        <input
          id="admin-password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          disabled={busy}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-[38px] w-full rounded-[6px] border border-[#e2e2e2] bg-white px-3 pr-10 text-[11px] font-medium text-[#141414] outline-none transition focus:border-[#b8b8b8] focus:ring-2 focus:ring-[#141414]/5 disabled:bg-[#fafafa] disabled:text-[#737373]"
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          disabled={busy}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-[#737373] hover:text-[#141414] disabled:opacity-40"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff size={14}/> : <Eye size={14}/>} 
        </button>
      </span>
    </label>

    {error ? <div role="alert" aria-live="polite" className="rounded-[7px] border border-[#efc9d0] bg-[#fff0f2] px-3.5 py-3 text-[#c6283c]">
      <p className="text-[8px] font-bold uppercase tracking-[.06em]">Sign-in failed</p>
      <p className="mt-1.5 text-[10px] leading-[16px]">{error}</p>
    </div> : null}

    <button
      disabled={busy || !email.trim() || !password}
      type="submit"
      className="flex h-[34px] w-full items-center justify-center rounded-[6px] border border-[#dc143c] bg-[#dc143c] px-4 text-[10px] font-medium text-white transition hover:bg-[#c81035] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {busy ? "Signing in…" : "Open KCPL Operations"}
    </button>
  </form>;
}
