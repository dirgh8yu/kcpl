"use client";

import { useEffect, useState, type ReactNode } from "react";
import { humanErrorMessage, isLoadFailure } from "./human-error";

export function OpsNotice({
  children,
  tone = "neutral",
  onDismiss,
  onRetry,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  onDismiss?: () => void;
  /** Redo what failed. Without it, a failed load still offers a reload. */
  onRetry?: () => void;
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
  const text = typeof children === "string" ? humanErrorMessage(children) : children;
  const retry = onRetry ?? (typeof text === "string" && tone !== "success" && isLoadFailure(text) ? () => window.location.reload() : undefined);
  return (
    <div className="ops-notice" data-tone={tone} role={tone === "danger" ? "alert" : "status"} aria-live="polite">
      <span>{text}</span>
      {retry ? <button type="button" onClick={retry}>Try again</button> : null}
      {onDismiss ? <button type="button" onClick={onDismiss}>Dismiss</button> : null}
    </div>
  );
}
