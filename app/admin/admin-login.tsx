"use client";

import { FormEvent, useState } from "react";
import { inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseClientAuth, firebaseClientConfigured } from "../firebase-client";

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
      if (!firebaseClientConfigured()) throw new Error("Firebase web app configuration is missing.");
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
      if (!response.ok || !data.ok) throw new Error(data.error || "KCPL sign-in was not accepted.");
      window.location.assign("/admin");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "KCPL sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <label className="block text-sm font-bold" htmlFor="admin-email">Staff email</label>
      <input
        id="admin-email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:border-[#b78a3e]"
      />
      <label className="block text-sm font-bold" htmlFor="admin-password">Password</label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:border-[#b78a3e]"
      />
      {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
      <button disabled={busy} type="submit" className="w-full rounded-xl bg-[#10263f] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
        {busy ? "Signing in…" : "Open operations dashboard"}
      </button>
    </form>
  );
}
