"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  Boxes,
  Building2,
  ChartNoAxesCombined,
  HandCoins,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  ReceiptText,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: (path: string) => boolean;
};

const coreNav: NavItem[] = [
  { href: "/admin/command-centre", label: "Operations Home", icon: LayoutDashboard, match: (path) => path.startsWith("/admin/command-centre") },
  { href: "/admin", label: "Enquiries", icon: PackageSearch, match: (path) => path === "/admin" },
  { href: "/admin/shipments", label: "Shipments", icon: Boxes, match: (path) => path.startsWith("/admin/shipments") || path.startsWith("/admin/jobs/") },
  { href: "/admin/crm", label: "Customers", icon: Building2, match: (path) => path.startsWith("/admin/crm") },
  { href: "/admin/partners", label: "Partners", icon: Handshake, match: (path) => path.startsWith("/admin/partners") },
  { href: "/admin/alerts", label: "Alerts", icon: BellRing, match: (path) => path.startsWith("/admin/alerts") },
];

export function OperationsShell({
  children,
  userName,
  canManageStaff = false,
  canManageFinance = false,
  isManagement = false,
  signOutPath = "/api/admin/session?logout=1",
}: {
  children: React.ReactNode;
  userName: string;
  canManageStaff?: boolean;
  canManageFinance?: boolean;
  isManagement?: boolean;
  signOutPath?: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav: NavItem[] = [
    ...coreNav,
    ...(canManageFinance ? [
      { href: "/admin/finance", label: "Finance & AR", icon: ReceiptText, match: (path: string) => path.startsWith("/admin/finance") },
      { href: "/admin/payables", label: "Payables", icon: HandCoins, match: (path: string) => path.startsWith("/admin/payables") },
    ] : []),
    ...(isManagement ? [
      { href: "/admin/management", label: "Management Analytics", icon: ChartNoAxesCombined, match: (path: string) => path.startsWith("/admin/management") },
    ] : []),
    ...(canManageStaff ? [
      { href: "/admin/staff", label: "Staff & branches", icon: UsersRound, match: (path: string) => path.startsWith("/admin/staff") },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-[#f5f6f7] text-[#10263f]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[216px] flex-col border-r border-white/10 bg-[#0a1828] text-white lg:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <Link href="/admin/command-centre" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#d4ad62] text-sm font-black text-[#10263f]">K</span>
            <span className="min-w-0">
              <strong className="block truncate text-sm tracking-[-.01em]">KCPL Operations</strong>
              <span className="mt-0.5 block text-[10px] uppercase tracking-[.12em] text-white/35">Control system</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-xs font-semibold transition ${active ? "bg-white text-[#10263f] shadow-sm" : "text-white/58 hover:bg-white/7 hover:text-white"}`}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8}/>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="rounded-lg bg-white/[.045] p-3">
            <p className="truncate text-xs font-semibold text-white/85">{userName}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[.1em] text-white/30">Authorised staff</p>
            <a href={signOutPath} className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-white/50 transition hover:text-white">
              <LogOut size={12}/> Sign out
            </a>
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-black/10 bg-[#0a1828] px-4 text-white lg:hidden">
        <Link href="/admin/command-centre" className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d4ad62] text-xs font-black text-[#10263f]">K</span><strong className="text-sm">KCPL Operations</strong></Link>
        <button type="button" onClick={() => setMobileOpen((current) => !current)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/12 text-white/80" aria-label="Toggle operations navigation">
          {mobileOpen ? <X size={17}/> : <Menu size={17}/>} 
        </button>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-x-0 top-14 z-40 max-h-[calc(100vh-56px)] overflow-y-auto border-b border-black/10 bg-white p-3 shadow-xl lg:hidden">
          <nav className="grid gap-1">
            {nav.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${active ? "bg-[#10263f] text-white" : "text-[#435263] hover:bg-[#f4f6f7]"}`}><Icon size={16}/>{item.label}</Link>;
            })}
            <a href={signOutPath} className="mt-1 flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"><LogOut size={16}/>Sign out</a>
          </nav>
        </div>
      ) : null}

      <div className="min-w-0 pt-14 lg:pl-[216px] lg:pt-0">{children}</div>
    </div>
  );
}
