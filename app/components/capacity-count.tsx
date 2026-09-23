"use client";

import { useEffect, useRef } from "react";
import { animate } from "motion";
import type { SiteLocale } from "../site-i18n";

export function CapacityCount({ value, locale }: { value: number; locale: SiteLocale }) {
  const numberRef = useRef<HTMLSpanElement>(null);
  const formatter = new Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-US");
  const finalValue = `${formatter.format(value)}+`;

  useEffect(() => {
    const number = numberRef.current;
    if (!number || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const numberFormat = new Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-US");
    number.textContent = `${numberFormat.format(0)}+`;
    let stopAnimation = () => {};
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const animation = animate(0, value, {
        duration: 1.2,
        ease: [0.23, 1, 0.32, 1],
        onUpdate: (latest) => {
          number.textContent = `${numberFormat.format(Math.round(latest))}+`;
        },
      });
      stopAnimation = () => animation.stop();
    }, { threshold: 0.5 });
    observer.observe(number);

    return () => {
      observer.disconnect();
      stopAnimation();
    };
  }, [locale, value]);

  return <strong aria-label={finalValue}><span ref={numberRef} aria-hidden="true">{finalValue}</span></strong>;
}
