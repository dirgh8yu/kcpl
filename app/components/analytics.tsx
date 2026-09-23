"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const enabled = process.env.NODE_ENV === "production" && Boolean(measurementId);
const consentKey = "kcpl-analytics-consent";

export function trackAnalyticsEvent(name: string) {
  if (typeof window !== "undefined" && window.gtag) window.gtag("event", name);
}

export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Private product surfaces are never measured: the staff operations system
  // and the authenticated customer portal both carry customer data in the URL
  // and in the page, and neither is a marketing page.
  const internalRoute = pathname.startsWith("/admin") || pathname.startsWith("/portal");
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);

  useEffect(() => {
    if (!enabled || internalRoute) return;
    const stored = window.localStorage.getItem(consentKey);
    if (stored !== "granted" && stored !== "denied") return;
    const timeout = window.setTimeout(() => setConsent(stored), 0);
    return () => window.clearTimeout(timeout);
  }, [internalRoute]);

  useEffect(() => {
    if (!enabled || internalRoute || consent !== "granted" || !measurementId) return;
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = window.gtag ?? function gtag(...args: unknown[]) { window.dataLayer?.push(args); };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { send_page_view: false, anonymize_ip: true });

    if (!document.querySelector(`script[data-kcpl-ga="${measurementId}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      script.dataset.kcplGa = measurementId;
      document.head.appendChild(script);
    }
  }, [consent, internalRoute]);

  useEffect(() => {
    if (internalRoute || consent !== "granted" || !window.gtag) return;
    const query = searchParams.toString();
    window.gtag("event", "page_view", { page_path: `${pathname}${query ? `?${query}` : ""}` });
  }, [consent, internalRoute, pathname, searchParams]);

  useEffect(() => {
    if (internalRoute || consent !== "granted") return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-analytics-event]") : null;
      if (target?.dataset.analyticsEvent) trackAnalyticsEvent(target.dataset.analyticsEvent);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [consent, internalRoute]);

  if (!enabled || internalRoute || consent !== null) return null;

  function choose(next: "granted" | "denied") {
    window.localStorage.setItem(consentKey, next);
    setConsent(next);
  }

  return <aside className="cookie-notice" aria-label="Analytics preference">
    <div className="cookie-notice-copy">
      <p className="cookie-notice-title">Analytics</p>
      <p className="cookie-notice-text">KCPL can measure page visits to see which services people look for. Nothing you type into the quote form is sent to analytics.</p>
    </div>
    <div className="cookie-notice-actions">
      <button type="button" className="cookie-notice-accept" onClick={() => choose("granted")}>Allow</button>
      <button type="button" className="cookie-notice-decline" onClick={() => choose("denied")}>Decline</button>
      <Link href="/privacy" className="cookie-notice-link">Privacy</Link>
    </div>
  </aside>;
}
