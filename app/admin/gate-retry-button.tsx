"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

/** "Try again" on a page that could not load: re-runs the server render
 * without a full reload, so the menu and search stay put. */
export function GateRetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" className="ops-button" data-variant="primary" data-size="md" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
    <RefreshCw size={13} strokeWidth={1.75} aria-hidden="true"/>{pending ? "Trying…" : "Try again"}
  </button>;
}
