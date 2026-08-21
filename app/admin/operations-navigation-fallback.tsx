"use client";

import { useEffect } from "react";

/**
 * KCPL's admin workspaces are server-heavy pages. In App Hosting, a soft
 * Next.js navigation can occasionally leave the current workspace mounted
 * when the RSC transition fails, even though a normal document navigation to
 * the same URL succeeds. Cmd/Ctrl+K already uses a document navigation, so the
 * desktop sidebar should use the same reliable path.
 *
 * Keep modifier-clicks and external links untouched so normal browser
 * behaviour (new tab, etc.) still works.
 */
export function OperationsNavigationFallback() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest<HTMLAnchorElement>(".kcpl-ops aside a[href]");
      if (!link) return;

      const href = link.getAttribute("href")?.trim() ?? "";
      if (!href.startsWith("/admin")) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(href);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
