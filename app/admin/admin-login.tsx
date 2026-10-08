"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { firebaseClientAuth } from "../firebase-client";

/** What went wrong, in words. Firebase's own messages ("Firebase: Error
 *  (auth/invalid-credential).") are for developers; the session route's are
 *  already written for staff and pass through. */
function signInError(reason: unknown) {
  if (!(reason instanceof FirebaseError)) return reason instanceof Error ? reason.message : "Sign-in didn’t work. Try again.";
  switch (reason.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "That email and password don’t match a KCPL staff account.";
    case "auth/user-disabled":
      return "This account has been switched off. Ask a manager.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, then try again.";
    case "auth/network-request-failed":
      return "No connection. Check your internet, then try again.";
    default:
      return "Sign-in isn’t available right now. Try again in a minute.";
  }
}

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
      setError(signInError(reason));
      // Only released on failure: on success the form stays disabled until the
      // navigation unmounts it, so the fields cannot flash back to editable.
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="sign-in-form admin-login-form" aria-busy={busy}>
      <label className="ops-field" htmlFor="admin-email">
        <span className="ops-field-label">Email</span>
        <input
          id="admin-email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "admin-login-error" : undefined}
          disabled={busy}
        />
      </label>

      <div className="ops-field">
        <label className="ops-field-label" htmlFor="admin-password">Password</label>
        <span className="sign-in-password">
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "admin-login-error" : undefined}
            disabled={busy}
          />
          <button
            type="button"
            className="sign-in-password-toggle"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            disabled={busy}
          >
            {showPassword ? <EyeOff aria-hidden="true" size={16} strokeWidth={1.75}/> : <Eye aria-hidden="true" size={16} strokeWidth={1.75}/>}
          </button>
        </span>
      </div>

      <div aria-live="polite" className="sign-in-messages">
        {error ? <p id="admin-login-error" className="sign-in-error" role="alert">{error}</p> : null}
      </div>

      <button type="submit" className="ops-button sign-in-submit" data-variant="primary" data-size="md" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
