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
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const stored = window.localStorage.getItem(consentKey);
    if (stored !== "granted" && stored !== "denied") return;
    const timeout = window.setTimeout(() => setConsent(stored), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!enabled || consent !== "granted" || !measurementId) return;
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
  }, [consent]);

  useEffect(() => {
    if (consent !== "granted" || !window.gtag) return;
    const query = searchParams.toString();
    window.gtag("event", "page_view", { page_path: `${pathname}${query ? `?${query}` : ""}` });
  }, [consent, pathname, searchParams]);

  useEffect(() => {
    if (consent !== "granted") return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-analytics-event]") : null;
      if (target?.dataset.analyticsEvent) trackAnalyticsEvent(target.dataset.analyticsEvent);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [consent]);

  if (!enabled || consent !== null) return null;

  function choose(next: "granted" | "denied") {
    window.localStorage.setItem(consentKey, next);
    setConsent(next);
  }

  return <aside className="analytics-consent" aria-label="Analytics preference">
    <p><strong>Privacy choice</strong><span>KCPL can use anonymous analytics to understand site use. No form contents are sent to analytics.</span></p>
    <div><button type="button" onClick={() => choose("granted")}>Allow analytics</button><button type="button" onClick={() => choose("denied")}>Decline</button><Link href="/privacy">Privacy</Link></div>
  </aside>;
}
