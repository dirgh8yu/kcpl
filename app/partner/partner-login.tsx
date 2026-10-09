"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { FirebaseError } from "firebase/app";
import { inMemoryPersistence, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseClientAuth } from "../firebase-client";

function signInError(reason: unknown) {
  if (!(reason instanceof FirebaseError)) return reason instanceof Error ? reason.message : "Sign-in didn’t work. Try again.";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(reason.code)) return "That email and password don’t match a KCPL partner login.";
  if (reason.code === "auth/too-many-requests") return "Too many attempts. Wait a few minutes, then try again.";
  if (reason.code === "auth/network-request-failed") return "No connection. Check your internet, then try again.";
  return "Sign-in isn’t available right now. Try again in a minute.";
}

/** Partner sign-in: the email KCPL invited, and the password set from the invitation. */
export function PartnerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const auth = firebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/partner/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
      const data = await response.json() as { ok?: boolean; error?: string };
      await signOut(auth).catch(() => undefined);
      if (!response.ok || !data.ok) throw new Error(data.error || "KCPL partner sign-in was not accepted.");
      router.replace("/partner");
      router.refresh();
    } catch (reason) {
      setError(signInError(reason));
      setBusy(false);
    }
  }

  async function reset() {
    if (!email.trim()) { setError("Enter your email first, then choose Forgot password."); return; }
    try { await sendPasswordResetEmail(firebaseClientAuth(), email.trim()); setNotice("If that address has a partner login, a reset link is on its way."); }
    catch { setNotice("If that address has a partner login, a reset link is on its way."); }
  }

  return (
    <form onSubmit={submit} className="sign-in-form" aria-busy={busy}>
      <label className="ops-field" htmlFor="partner-email">
        <span className="ops-field-label">Email</span>
        <input id="partner-email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy}/>
      </label>
      <div className="ops-field">
        <label className="ops-field-label" htmlFor="partner-password">Password</label>
        <span className="sign-in-password">
          <input id="partner-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy}/>
          <button type="button" className="sign-in-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={busy}>
            {showPassword ? <EyeOff aria-hidden="true" size={16} strokeWidth={1.75}/> : <Eye aria-hidden="true" size={16} strokeWidth={1.75}/>}
          </button>
        </span>
      </div>
      <div aria-live="polite" className="sign-in-messages">
        {error ? <p className="sign-in-error" role="alert">{error}</p> : null}
        {notice ? <p className="sign-in-notice">{notice}</p> : null}
      </div>
      <button type="submit" className="ops-button sign-in-submit" data-variant="primary" data-size="md" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <button type="button" className="sign-in-link" onClick={reset}>Forgot password?</button>
    </form>
  );
}
