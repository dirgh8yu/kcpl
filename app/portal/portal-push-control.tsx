"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing } from "lucide-react";
import { OpsButton, OpsSurface } from "../admin/operations-ui";
import { portalTranslator, type PortalLocale } from "./portal-i18n";

type PushState = "checking" | "unsupported" | "blocked" | "off" | "on" | "busy";

function urlBase64ToUint8Array(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

/**
 * Push notifications on this device.
 *
 * Deliberately per-device rather than per-account: a subscription belongs to
 * one browser, and a customer who turns push on at the office has not asked
 * for it on the phone they left at home. The topic preferences above decide
 * *what* KCPL sends; this decides whether this browser is one of the places
 * it arrives.
 *
 * The browser's permission prompt is only raised from the button, never on
 * page load. A permission asked for unprompted is the fastest way to have it
 * denied permanently, and a denied permission cannot be re-requested.
 */
export function PortalPushControl({ publicKey, locale }: { publicKey: string; locale: PortalLocale }) {
  const t = portalTranslator(locale);
  const [state, setState] = useState<PushState>("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register("/portal-sw.js", { scope: "/portal/" });
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) setState(existing ? "on" : "off");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function enable() {
    setState("busy");
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/portal-sw.js", { scope: "/portal/" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const response = await fetch("/api/portal/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        // Registered with the browser but not with KCPL is a subscription
        // that would never be pushed to; undo it rather than leave it.
        await subscription.unsubscribe();
        throw new Error(data.error || t("push.failed"));
      }
      setState("on");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("push.failed"));
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    setError("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/portal/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/portal/push", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("push.failed"));
      setState("on");
    }
  }

  if (state === "checking") return null;

  return (
    <OpsSurface
      eyebrow={t("push.eyebrow")}
      title={t("push.title")}
      description={t("push.description")}
    >
      <div className="portal-push-control">
        {state === "unsupported" ? (
          <p className="portal-footnote">{t("push.unsupported")}</p>
        ) : state === "blocked" ? (
          // A denied permission cannot be re-requested from script; the only
          // honest thing to do is say where it is changed.
          <p className="portal-footnote">{t("push.blocked")}</p>
        ) : (
          <OpsButton
            variant={state === "on" ? "secondary" : "primary"}
            size="sm"
            disabled={state === "busy"}
            onClick={() => void (state === "on" ? disable() : enable())}
          >
            {state === "on"
              ? <><BellOff size={14} strokeWidth={1.75} aria-hidden="true"/><span>{t("push.turn_off")}</span></>
              : <><BellRing size={14} strokeWidth={1.75} aria-hidden="true"/><span>{state === "busy" ? t("push.working") : t("push.turn_on")}</span></>}
          </OpsButton>
        )}
        {state === "on" ? <p className="portal-footnote">{t("push.on_note")}</p> : null}
        {error ? <p className="portal-footnote" role="alert">{error}</p> : null}
      </div>
    </OpsSurface>
  );
}
