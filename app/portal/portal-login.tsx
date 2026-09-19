"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import {
  inMemoryPersistence,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { firebaseClientAuth } from "../firebase-client";

/**
 * Customer sign-in.
 *
 * An unverified address never reaches the session route: a Firebase password
 * account can be created for any email, so verification is what proves the
 * person controls the address the portal account is provisioned against. The
 * client signs out again immediately either way -- the httpOnly session cookie
 * the server sets is the only credential the portal keeps.
 */
export function PortalLogin() {
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
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const auth = firebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);

      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user).catch(() => undefined);
        await signOut(auth).catch(() => undefined);
        setNotice("Confirm your email address first. We have sent a new verification link to your inbox.");
        setBusy(false);
        return;
      }

      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/portal/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      await signOut(auth).catch(() => undefined);
      if (!response.ok || !data.ok) throw new Error(data.error || "Sign-in was not accepted.");

      router.replace("/portal");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed. Check your details and try again.");
      setBusy(false);
    }
  }

  async function resetPassword() {
    const address = email.trim();
    if (!address) {
      setError("Enter your email address first, then choose Reset password.");
      return;
    }
    setError("");
    // Always reports success: whether an address has an account is not something
    // an unauthenticated caller should be able to probe.
    await sendPasswordResetEmail(firebaseClientAuth(), address).catch(() => undefined);
    setNotice("If that address has KCPL portal access, a password reset link is on its way.");
  }

  return (
    <form onSubmit={submit} className="portal-login-form" aria-busy={busy}>
      <label className="ops-field" htmlFor="portal-email">
        <span className="ops-field-label">Email address</span>
        <input
          id="portal-email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error) || undefined}
          placeholder="you@company.com"
          disabled={busy}
        />
      </label>

      <label className="ops-field" htmlFor="portal-password">
        <span className="ops-field-label">Password</span>
        <span className="portal-password-control">
          <input
            id="portal-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error) || undefined}
            disabled={busy}
          />
          <button
            type="button"
            className="portal-password-toggle"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            disabled={busy}
          >
            {showPassword ? <EyeOff size={16} aria-hidden="true"/> : <Eye size={16} aria-hidden="true"/>}
          </button>
        </span>
      </label>

      <div aria-live="polite" className="portal-login-messages">
        {error ? <p className="portal-login-error" role="alert">{error}</p> : null}
        {notice ? <p className="portal-login-notice">{notice}</p> : null}
      </div>

      <button type="submit" className="ops-button portal-login-submit" data-variant="primary" data-size="md" disabled={busy}>
        <span>{busy ? "Signing in…" : "Sign in"}</span>
        {busy ? null : <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true"/>}
      </button>

      <button type="button" className="portal-login-link" onClick={resetPassword} disabled={busy}>
        Reset password
      </button>
    </form>
  );
}
