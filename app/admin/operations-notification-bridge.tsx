"use client";

import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { OperationsNotificationCentre } from "./operations-notification-centre";

type AnchorBox = { top: number; left: number; width: number; height: number };

function findBellAnchor() {
  return document.querySelector<HTMLAnchorElement>('a[aria-label="Open tasks and alerts"][href="/admin/alerts"]');
}

export function OperationsNotificationBridge() {
  const pathname = usePathname();
  const [box, setBox] = useState<AnchorBox | null>(null);

  useEffect(() => {
    let anchor: HTMLAnchorElement | null = null;
    function sync() {
      const next = findBellAnchor();
      if (anchor && anchor !== next) anchor.style.visibility = "";
      anchor = next;
      if (!anchor) { setBox(null); return; }
      anchor.style.visibility = "hidden";
      const rect = anchor.getBoundingClientRect();
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    }
    const frame = window.requestAnimationFrame(sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
      if (anchor) anchor.style.visibility = "";
    };
  }, [pathname]);

  if (!box) return null;
  return createPortal(
    <div className="fixed z-[75]" style={{ top: box.top, left: box.left, width: box.width, height: box.height }}>
      <OperationsNotificationCentre />
    </div>,
    document.body,
  );
}
