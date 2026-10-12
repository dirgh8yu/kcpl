"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const revealSelector = [
  ".section-title",
  ".tile",
  ".work-record",
  ".sector-row",
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

  // The phone menu and the language list are native disclosures, which do not
  // close on Escape by themselves. Escape closes whichever is open and returns
  // focus to its button; choosing a link in the menu closes it too, which
  // matters when the link is the page already showing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const details of document.querySelectorAll<HTMLDetailsElement>(".site-menu[open], .site-lang[open]")) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest(".site-menu-panel a") : null;
      link?.closest("details")?.removeAttribute("open");
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  // The footer's link lists fold on a phone and stand open, not toggleable,
  // on anything wider. They are rendered open so the links are there without
  // JavaScript.
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 760px)");
    const folds = [...document.querySelectorAll<HTMLDetailsElement>(".site-footer-fold")];
    const sync = () => {
      for (const details of folds) {
        details.open = !phone.matches;
        const summary = details.querySelector("summary");
        if (summary) summary.tabIndex = phone.matches ? 0 : -1;
      }
    };
    const keepOpen = (event: MouseEvent) => {
      if (!phone.matches && event.target instanceof Element && event.target.closest(".site-footer-summary")) event.preventDefault();
    };
    sync();
    phone.addEventListener("change", sync);
    document.addEventListener("click", keepOpen);
    return () => {
      phone.removeEventListener("change", sync);
      document.removeEventListener("click", keepOpen);
    };
  }, [pathname]);

  return null;
}
