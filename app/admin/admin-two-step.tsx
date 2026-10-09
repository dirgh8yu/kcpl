"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

type Setup = { qrSvg: string; secret: string; uri: string };

async function send(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/two-step", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || data.ok !== true) throw new Error(typeof data.error === "string" ? data.error : "That didn’t work. Try again.");
  return data;
}

/** The key in groups of four, as authenticator apps show it. */
function groups(secret: string) {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

export function AdminTwoStep({ step }: { step: "enrol" | "verify" }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (step !== "enrol") return;
    let cancelled = false;
    send({ action: "start" })
      .then((data) => { if (!cancelled) setSetup({ qrSvg: String(data.qrSvg), secret: String(data.secret), uri: String(data.uri) }); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Setup isn’t available right now."); });
    return () => { cancelled = true; };
  }, [step]);

  function enter() {
    router.replace("/admin");
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const data = await send({ action: step === "enrol" ? "confirm" : "verify", code, trust });
      if (step === "enrol" && Array.isArray(data.recoveryCodes)) {
        setRecoveryCodes(data.recoveryCodes.map(String));
        setBusy(false);
        return;
      }
      enter();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That didn’t work. Try again.");
      setBusy(false);
    }
  }

  async function copyCodes() {
    if (!recoveryCodes) return;
    try { await navigator.clipboard.writeText(recoveryCodes.join("\n")); setCopied(true); }
    catch { setCopied(false); }
  }

  if (recoveryCodes) {
    return <div className="sign-in-form">
      <p className="sign-in-notice" role="status">Two-step sign-in is on.</p>
      <p className="two-step-text">Keep these recovery codes somewhere safe, away from your phone. Each one signs you in once if the phone is lost. They aren’t shown again.</p>
      <ol className="two-step-codes" aria-label="Recovery codes">{recoveryCodes.map((item) => <li key={item}>{item}</li>)}</ol>
      <button type="button" className="ops-button" data-variant="secondary" data-size="md" onClick={copyCodes}><Copy size={14} aria-hidden="true"/>{copied ? "Copied" : "Copy the codes"}</button>
      <button type="button" className="ops-button sign-in-submit" data-variant="primary" data-size="md" onClick={enter}>I’ve kept them, continue</button>
    </div>;
  }

  return <form onSubmit={submit} className="sign-in-form" aria-busy={busy}>
    {step === "enrol" ? <ol className="two-step-steps">
      <li>Install an authenticator app on your phone: Google Authenticator, Microsoft Authenticator or 1Password.</li>
      <li>
        Scan this code with it.
        {setup ? <>
          {/* The QR code is an SVG drawn on KCPL's server, by the qrcode library, from the key below. */}
          <span className="two-step-qr" role="img" aria-label="QR code to scan with your authenticator app" dangerouslySetInnerHTML={{ __html: setup.qrSvg }}/>
          <span className="two-step-text">Can’t scan it? Choose to enter a key and type <code className="two-step-key">{groups(setup.secret)}</code></span>
          <a className="sign-in-link" href={setup.uri}>On this phone? Open the authenticator app</a>
        </> : <span className="two-step-text">{error ? "" : "Getting the code…"}</span>}
      </li>
      <li>Enter the 6-digit code the app shows.</li>
    </ol> : null}

    <label className="ops-field" htmlFor="two-step-code">
      <span className="ops-field-label">{useRecovery ? "Recovery code" : "6-digit code"}</span>
      <input
        id="two-step-code"
        name="code"
        required
        value={code}
        onChange={(event) => setCode(event.target.value)}
        inputMode={useRecovery ? "text" : "numeric"}
        autoComplete={useRecovery ? "off" : "one-time-code"}
        autoCapitalize={useRecovery ? "characters" : "none"}
        spellCheck={false}
        maxLength={useRecovery ? 12 : 7}
        placeholder={useRecovery ? "XXXX-XXXX" : "123456"}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? "two-step-error" : undefined}
        disabled={busy || (step === "enrol" && !setup)}
      />
    </label>

    <label className="two-step-trust">
      <input type="checkbox" checked={trust} onChange={(event) => setTrust(event.target.checked)} disabled={busy}/>
      <span>Trust this browser for 30 days. Only on your own computer.</span>
    </label>

    <div aria-live="polite" className="sign-in-messages">
      {error ? <p id="two-step-error" className="sign-in-error" role="alert">{error}</p> : null}
    </div>

    <button type="submit" className="ops-button sign-in-submit" data-variant="primary" data-size="md" disabled={busy || (step === "enrol" && !setup)}>
      {busy ? "Checking…" : step === "enrol" ? "Turn on two-step sign-in" : "Continue"}
    </button>
    {step === "verify" ? <button type="button" className="sign-in-link" onClick={() => { setUseRecovery((value) => !value); setCode(""); setError(""); }}>
      {useRecovery ? "Use the code from the app instead" : "Use a recovery code instead"}
    </button> : null}
  </form>;
}
