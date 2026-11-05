"use client";

import { useEffect } from "react";

/** The header's two disclosures work without JavaScript. This only adds what a
 * native <details> lacks: one open at a time, and closing on Escape or an
 * outside click. */
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
    const onClick = (event: MouseEvent) => {
      const inside = (event.target as Element).closest(".site-pop");
      for (const details of open()) if (details !== inside) details.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
