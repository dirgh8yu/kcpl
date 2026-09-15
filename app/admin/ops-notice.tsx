"use client";

import { useEffect, useState, type ReactNode } from "react";

export function OpsNotice({
  children,
  tone = "neutral",
  onDismiss,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (tone !== "success") return;
    const timeout = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [children, onDismiss, tone]);

  if (!visible) return null;
  return (
    <div className="ops-notice" data-tone={tone} role={tone === "danger" ? "alert" : "status"} aria-live="polite">
      <span>{children}</span>
      {onDismiss ? <button type="button" onClick={onDismiss}>Dismiss</button> : null}
    </div>
  );
}
