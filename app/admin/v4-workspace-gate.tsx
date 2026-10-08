import Link from "next/link";
import type { ReactNode } from "react";
import { GateRetryButton } from "./gate-retry-button";
import { isLoadFailure } from "./human-error";

export type V4WorkspaceGateAction = {
  href: string;
  label: string;
  primary?: boolean;
};

export function V4WorkspaceGate({
  eyebrow = "KCPL Operations",
  title,
  detail,
  embedded = false,
  actions = [
    { href: "/admin/command-centre", label: "Overview", primary: true },
    { href: "/admin/shipments", label: "Shipments" },
  ],
  children,
}: {
  eyebrow?: string;
  title: string;
  detail: string;
  embedded?: boolean;
  actions?: V4WorkspaceGateAction[];
  children?: ReactNode;
}) {
  // One button, never a menu of destinations: a page that failed to load
  // offers to try again, anything else offers its one way back. The sidebar
  // and search are still there for anywhere else.
  const retry = !children && (isLoadFailure(detail) || /try again/i.test(detail));
  const way = retry ? null : actions.find((action) => action.primary) ?? actions[0] ?? null;
  return <main className="workspace-gate" data-embedded={embedded || undefined}>
    <section className="workspace-gate-panel">
      <p className="workspace-gate-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="workspace-gate-detail">{detail}</p>
      {children ? <div className="workspace-gate-body">{children}</div> : null}
      {way || retry ? <div className="workspace-gate-actions">{retry ? <GateRetryButton/> : null}{way ? <Link href={way.href} className="ops-button" data-variant="primary" data-size="md">{way.label}</Link> : null}</div> : null}
    </section>
  </main>;
}
