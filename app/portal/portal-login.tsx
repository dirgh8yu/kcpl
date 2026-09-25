"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  OAuthProvider,
  inMemoryPersistence,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type AuthCredential,
  type User,
} from "firebase/auth";
import { firebaseClientAuth } from "../firebase-client";
import { portalSignInProviderNames as providerNames, portalSignInProviders, type PortalSignInProvider as Provider } from "./portal-sign-in-providers";

/**
 * Customer sign-in: Continue with Apple or Google, with email and password
 * kept as a quieter fallback.
 *
 * The provider only proves who the person is. Access is still decided by
 * the server against the portal account provisioned for that email, so a
 * Google or Apple sign-in grants nothing a password sign-in would not.
 *
 * An unverified address never reaches the session route: a Firebase password
 * account can be created for any email, so verification is what proves the
 * person controls the address the portal account is provisioned against.
 * Google and Apple addresses arrive verified. The client signs out again
 * immediately either way -- the httpOnly session cookie the server sets is the
 * only credential the portal keeps.
 */
export function PortalLogin() {
  const router = useRouter();
  const providers = portalSignInProviders();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showEmail, setShowEmail] = useState(providers.length === 0);
  const [busy, setBusy] = useState<Provider | "email" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // A Google or Apple sign-in for an address that already has a password
  // login: once that password is entered, the provider is linked to it.
  const [pendingLink, setPendingLink] = useState<{ credential: AuthCredential; provider: Provider } | null>(null);

  /** Exchanges a signed-in Firebase user for the portal's session cookie. */
  async function establish(user: User) {
    const auth = firebaseClientAuth();
    const idToken = await user.getIdToken(true);
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
  }

  async function continueWith(provider: Provider) {
    if (busy) return;
    setBusy(provider);
    setError("");
    setNotice("");
    const auth = firebaseClientAuth();
    try {
      await setPersistence(auth, inMemoryPersistence);
      const authProvider = provider === "google" ? new GoogleAuthProvider() : new OAuthProvider("apple.com");
      if (authProvider instanceof GoogleAuthProvider) {
        authProvider.setCustomParameters({ prompt: "select_account" });
      } else {
        authProvider.addScope("email");
        authProvider.addScope("name");
      }
      const credential = await signInWithPopup(auth, authProvider);
      await establish(credential.user);
    } catch (reason) {
      const code = reason instanceof FirebaseError ? reason.code : "";
      setBusy(null);
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled") return;
      if (code === "auth/account-exists-with-different-credential" && reason instanceof FirebaseError) {
        const credential = provider === "google" ? GoogleAuthProvider.credentialFromError(reason) : OAuthProvider.credentialFromError(reason);
        const existing = typeof reason.customData?.email === "string" ? reason.customData.email : "";
        if (credential) setPendingLink({ credential, provider });
        if (existing) setEmail(existing);
        setShowEmail(true);
        setNotice(`This email already has a KCPL password. Sign in with it once and ${providerNames[provider]} will be connected for next time.`);
        return;
      }
      await signOut(auth).catch(() => undefined);
      if (code === "auth/popup-blocked") {
        setError("Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.");
      } else if (code === "auth/operation-not-allowed" || code === "auth/unauthorized-domain") {
        setError(`${providerNames[provider]} sign-in is not switched on for the KCPL portal yet. Use your email and password.`);
        setShowEmail(true);
      } else if (code === "auth/network-request-failed") {
        setError("KCPL could not be reached. Check your connection and try again.");
      } else {
        setError(reason instanceof Error && !code ? reason.message : "Sign-in failed. Try again, or use your email and password.");
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("email");
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
        setBusy(null);
        return;
      }

      // Connect the provider that led here, so next time one tap does it.
      // Best effort: the sign-in itself does not depend on it.
      if (pendingLink) {
        await linkWithCredential(credential.user, pendingLink.credential).catch(() => undefined);
        setPendingLink(null);
      }

      await establish(credential.user);
    } catch (reason) {
      setError(reason instanceof Error && !(reason instanceof FirebaseError) ? reason.message : "Sign-in failed. Check your details and try again.");
      setBusy(null);
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

  const messages = (
    <div aria-live="polite" className="portal-login-messages">
      {error ? <p className="portal-login-error" role="alert">{error}</p> : null}
      {notice ? <p className="portal-login-notice">{notice}</p> : null}
    </div>
  );

  return (
    <div className="portal-login-form" aria-busy={Boolean(busy)}>
      {providers.length > 0 ? (
        <div className="portal-login-providers">
          {providers.map((provider) => (
            <button
              key={provider}
              type="button"
              className="portal-login-provider"
              data-provider={provider}
              onClick={() => continueWith(provider)}
              disabled={Boolean(busy)}
            >
              {provider === "apple" ? <AppleMark/> : <GoogleMark/>}
              <span>{busy === provider ? "Signing in…" : `Continue with ${providerNames[provider]}`}</span>
            </button>
          ))}
        </div>
      ) : null}

      {showEmail ? null : messages}

      {providers.length > 0 && !showEmail ? (
        <button type="button" className="portal-login-link" onClick={() => setShowEmail(true)} disabled={Boolean(busy)}>
          Sign in with email
        </button>
      ) : null}

      {showEmail ? (
        <form onSubmit={submit} className="portal-login-email">
          {providers.length > 0 ? <p className="portal-login-divider"><span>or with your email</span></p> : null}
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
              disabled={Boolean(busy)}
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
                disabled={Boolean(busy)}
              />
              <button
                type="button"
                className="portal-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={Boolean(busy)}
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true"/> : <Eye size={16} aria-hidden="true"/>}
              </button>
            </span>
          </label>

          {messages}

          <button type="submit" className="ops-button portal-login-submit" data-variant="primary" data-size="md" disabled={Boolean(busy)}>
            <span>{busy === "email" ? "Signing in…" : "Sign in"}</span>
            {busy === "email" ? null : <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true"/>}
          </button>

          <button type="button" className="portal-login-link" onClick={resetPassword} disabled={Boolean(busy)}>
            Reset password
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** Google's "G", in its own colours, as its branding guidelines require. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

/** The Apple logo, as Sign in with Apple's guidelines require. */
function AppleMark() {
  return (
    <svg width="16" height="18" viewBox="0 0 814 1000" aria-hidden="true">
      <path
        fill="currentColor"
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
      />
    </svg>
  );
}
