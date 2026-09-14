import Link from "next/link";
import type { ReactNode } from "react";

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
    { href: "/admin/command-centre", label: "Operations Overview", primary: true },
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
  return <main className="workspace-gate" data-embedded={embedded || undefined}>
    <section className="workspace-gate-panel">
      <p className="workspace-gate-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="workspace-gate-detail">{detail}</p>
      {children ? <div className="workspace-gate-body">{children}</div> : null}
      {actions.length ? <div className="workspace-gate-actions">{actions.map((action) => <Link key={`${action.href}:${action.label}`} href={action.href} className="ops-button" data-variant={action.primary ? "primary" : "secondary"} data-size="md">{action.label}</Link>)}</div> : null}
    </section>
  </main>;
}
