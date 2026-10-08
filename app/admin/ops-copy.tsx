"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Copies a reference beside where it is shown. Staff paste shipment, invoice
 * and order numbers into emails, carrier portals and chats all day; selecting
 * a monospace reference by hand picks up the badge next to it.
 */
export function OpsCopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return; // No clipboard (an insecure origin, a denied permission): nothing to confirm.
    }
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button type="button" className="ops-copy" data-copied={copied ? "true" : undefined} onClick={() => void copy()} aria-label={`Copy ${label}`} title="Copy">
      {copied ? <Check size={13} strokeWidth={2} aria-hidden="true"/> : <Copy size={13} strokeWidth={1.75} aria-hidden="true"/>}
      <span className="ops-copy-status" role="status">{copied ? "Copied" : ""}</span>
    </button>
  );
}
