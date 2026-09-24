"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const revealSelector = [
  ".section-title",
  ".proof-story",
  ".work-record",
  ".sector-row",
  ".service-row",
].join(", ");

export function SiteMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector(".site-root");
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!root || motionPreference.matches || !window.IntersectionObserver) return;

    const targets = [...root.querySelectorAll<HTMLElement>(revealSelector)];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove("motion-pending");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 });

    for (const element of targets) {
      element.classList.add("motion-reveal");
      // Content already in view stays visible, avoiding a flash after hydration.
      if (element.getBoundingClientRect().top < window.innerHeight * 0.92) continue;
      element.classList.add("motion-pending");
      observer.observe(element);
    }

    const revealAll = () => {
      if (!motionPreference.matches) return;
      observer.disconnect();
      for (const element of targets) element.classList.remove("motion-pending", "motion-reveal");
    };
    motionPreference.addEventListener("change", revealAll);

    return () => {
      observer.disconnect();
      motionPreference.removeEventListener("change", revealAll);
      for (const element of targets) element.classList.remove("motion-pending", "motion-reveal");
    };
  }, [pathname]);

  return null;
}
