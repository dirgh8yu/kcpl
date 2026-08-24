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
  return <main className={`grid place-items-center bg-[#f6f6f3] p-6 text-[#141414] ${embedded ? "min-h-[calc(100vh-54px)]" : "min-h-screen"}`}>
    <section className="w-full max-w-[620px] border-y border-[#e2e2e2] bg-white px-7 py-8 sm:px-8">
      <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#737373]">{eyebrow}</p>
      <h1 className="mt-3 text-[22px] font-semibold leading-[30px] tracking-[-.02em]">{title}</h1>
      <p className="mt-2 text-[13px] leading-6 text-[#5b5b5b]">{detail}</p>
      {children ? <div className="mt-4 border-t border-[#e2e2e2] pt-4 text-[12px] leading-5 text-[#5b5b5b]">{children}</div> : null}
      {actions.length ? <div className="mt-6 flex flex-wrap gap-2">{actions.map((action) => <Link key={`${action.href}:${action.label}`} href={action.href} className={`inline-flex h-8 items-center rounded-[6px] px-3 text-[12px] font-semibold ${action.primary ? "bg-[#dc143c] text-white hover:bg-[#c81035]" : "border border-[#e2e2e2] bg-white text-[#141414] hover:bg-[#fbfbf9]"}`}>{action.label}</Link>)}</div> : null}
    </section>
  </main>;
}
