"use client";

import { useEffect } from "react";

/** The header's two disclosures work without JavaScript. This adds what a native
 * <details> lacks: one open at a time, closing on Escape, on a click or focus
 * outside and on a link inside. It also steps the header aside on the way down
 * the page and brings it back on the way up. */
export function SiteMenus() {
  useEffect(() => {
    const open = () => [...document.querySelectorAll<HTMLDetailsElement>(".site-pop[open]")];
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const details of open()) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    const closeAllBut = (keep: Element | null) => {
      for (const details of open()) if (details !== keep) details.open = false;
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element;
      // A link to the page already open goes nowhere, so a menu closes itself on any link.
      closeAllBut(target.closest("a[href]") ? null : target.closest(".site-pop"));
    };
    // The menu fills the screen, so focus must not carry on into the page behind it.
    const onFocus = (event: FocusEvent) => closeAllBut((event.target as Element).closest(".site-pop"));
    const header = document.querySelector(".site-header");
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      header?.classList.toggle("is-away", y > last && y > 160);
      last = y;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    document.addEventListener("focusin", onFocus);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      document.removeEventListener("focusin", onFocus);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return null;
}
