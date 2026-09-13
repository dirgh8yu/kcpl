"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { OperationsCommandPalette } from "./operations-command-palette";
import {
  activeWorkspace,
  visibleWorkspaces,
  type NavigationCapabilities,
} from "./workflow-navigation";

type MacroNavItem = {
  label: string;
  href: string;
  visible?: boolean;
  active: (pathname: string) => boolean;
};

function initialsFor(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KC";
}

function breadcrumbFor(pathname: string, activeLabel?: string) {
  if (pathname.startsWith("/admin/jobs/")) {
    const parts = pathname.split("/").filter(Boolean);
    const reference = decodeURIComponent(parts[2] || "Shipment");
    return pathname.includes("/profitability") ? `Shipments / ${reference} / Profitability` : `Shipments / ${reference}`;
  }
  if (pathname.startsWith("/admin/command-centre")) return "Overview";
  if (pathname.startsWith("/admin/shipments")) return "Shipments";
  if (pathname.startsWith("/admin/pickups")) return "Shipments / Pickup Scheduling";
  if (pathname.startsWith("/admin/visibility")) return "Shipments / Live Visibility";
  if (pathname.startsWith("/admin/customs")) return "Shipments / Customs";
  if (pathname.startsWith("/admin/documents") || pathname.startsWith("/admin/freight-documents")) return "Shipments / Documents";
  if (pathname.startsWith("/admin/delivery")) return "Shipments / Delivery & POD";
  if (pathname.startsWith("/admin/alerts")) return "Tasks & Alerts";

  if (pathname.startsWith("/admin/enquiries")) return "Commercial / Enquiries";
  if (pathname.startsWith("/admin/crm")) return `Commercial / ${activeLabel || "Customers"}`;
  if (pathname.startsWith("/admin/market-estimate")) return "Commercial / Market Estimate";
  if (pathname.startsWith("/admin/rating")) return "Commercial / Orders & Rate Desk";
  if (pathname.startsWith("/admin/tenders")) return "Commercial / Tender & Booking";
  if (pathname.startsWith("/admin/consolidation")) return "Commercial / Load Planner";
  if (pathname.startsWith("/admin/pricing")) return "Commercial / Pricing Desk";

  if (pathname.startsWith("/admin/partners/reconciliation")) return "Finance / Supplier Reconciliation";
  if (pathname.startsWith("/admin/finance") || pathname.startsWith("/admin/payables") || pathname.startsWith("/admin/freight-audit")) return `Finance / ${activeLabel || "Workspace"}`;

  if (pathname.startsWith("/admin/partners")) return `Network / ${activeLabel || "Partners"}`;
  if (pathname.startsWith("/admin/carrier-integrations")) return "Network / Carrier Integrations";
  if (pathname.startsWith("/admin/edi")) return "Network / EDI Gateway";

  if (pathname.startsWith("/admin/management")) return "Organisation / Management";
  if (pathname.startsWith("/admin/migration/archive")) return "Organisation / Migration / Paper Archive";
  if (pathname.startsWith("/admin/migration/recovery") || pathname.startsWith("/admin/migration/batches")) return "Organisation / Migration / Recovery";
  if (pathname.startsWith("/admin/migration")) return "Organisation / Migration Hub";
  if (pathname.startsWith("/admin/staff")) return "Organisation / People & Branches";
  if (pathname.startsWith("/admin/notifications")) return "Notifications";

  return activeLabel || "KCPL Operations";
}

function BrandLockup() {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0" priority />
      <span className="min-w-0 leading-none">
        <span className="block text-[12px] font-medium uppercase tracking-[0.12em] text-[#101010]">Kapileshwor</span>
        <span className="mt-[5px] block text-[8px] font-normal uppercase tracking-[0.22em] text-[#686862]">Cargo Pvt. Ltd.</span>
      </span>
    </span>
  );
}

export function OperationsShell({
  children,
  userName,
  canManageStaff = false,
  canManageFinance = false,
  isManagement = false,
  canViewCommercial = true,
  canManageJobFile = true,
  signOutPath = "/api/admin/session?logout=1",
}: {
  children: React.ReactNode;
  userName: string;
  canManageStaff?: boolean;
  canManageFinance?: boolean;
  isManagement?: boolean;
  canViewCommercial?: boolean;
  canManageJobFile?: boolean;
  signOutPath?: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<NavigationCapabilities>({ canViewCommercial, canManageJobFile, canManageFinance, canManageStaff, isManagement });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/navigation", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ capabilities?: NavigationCapabilities }> : null)
      .then((data) => { if (!cancelled && data?.capabilities) setCapabilities(data.capabilities); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const workspaces = useMemo(() => visibleWorkspaces(capabilities), [capabilities]);
  const activeItem = useMemo(() => activeWorkspace(pathname, capabilities), [pathname, capabilities]);
  const initials = initialsFor(userName);
  const breadcrumb = breadcrumbFor(pathname, activeItem?.label);
  const systemHref = capabilities.isManagement ? "/admin/management" : "/admin/notifications";
  const systemActive = ["/admin/management", "/admin/migration", "/admin/staff", "/admin/notifications"].some((prefix) => pathname.startsWith(prefix));

  const macroNav = useMemo<MacroNavItem[]>(() => [
    { label: "Overview", href: "/admin/command-centre", active: (path) => path.startsWith("/admin/command-centre") },
    { label: "Shipments", href: "/admin/shipments", visible: capabilities.canManageJobFile, active: (path) => ["/admin/shipments", "/admin/jobs/", "/admin/pickups", "/admin/freight-documents", "/admin/visibility", "/admin/customs", "/admin/documents", "/admin/delivery", "/admin/alerts"].some((prefix) => path.startsWith(prefix)) },
    { label: "Commercial", href: "/admin/enquiries", visible: capabilities.canViewCommercial, active: (path) => ["/admin/enquiries", "/admin/rating", "/admin/pricing", "/admin/consolidation", "/admin/tenders", "/admin/market-estimate", "/admin/crm"].some((prefix) => path.startsWith(prefix)) },
    { label: "Finance", href: "/admin/finance", visible: capabilities.canManageFinance, active: (path) => ["/admin/finance", "/admin/payables", "/admin/freight-audit", "/admin/partners/reconciliation"].some((prefix) => path.startsWith(prefix)) },
    { label: "Network", href: "/admin/partners", active: (path) => (path.startsWith("/admin/partners") && !path.startsWith("/admin/partners/reconciliation")) || ["/admin/carrier-integrations", "/admin/edi"].some((prefix) => path.startsWith(prefix)) },
  ], [capabilities]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileOpen(false);
        setPaletteOpen((current) => !current);
      } else if (event.key === "Escape") {
        setMobileOpen(false);
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visibleMacroNav = macroNav.filter((item) => item.visible !== false);

  return (
    <div className="kcpl-admin-shell min-h-screen bg-[#F6F6F3] text-[#101010] [font-family:var(--font-geist),Arial,sans-serif]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[252px] flex-col border-r border-[#D6D6D0] bg-[#F6F6F3] lg:flex">
        <Link href="/admin/command-centre" className="flex h-[84px] items-center border-b border-[#D6D6D0] px-6" aria-label="KCPL Operations overview">
          <BrandLockup />
        </Link>

        <div className="border-b border-[#D6D6D0] px-6 py-5">
          <p className="text-[10px] font-normal uppercase tracking-[0.11em] text-[#DC143C]">Operations desk</p>
          <p className="mt-2 text-[13px] font-medium leading-5 text-[#101010]">{isManagement ? "All branches" : "Assigned branches"}</p>
          <p className="mt-0.5 text-[11px] font-normal leading-4 text-[#6D6D67]">{isManagement ? "Management · Global scope" : "Staff · Role scope"}</p>
        </div>

        <div className="px-3 py-5">
          <p className="px-3 pb-3 text-[10px] font-normal uppercase tracking-[0.11em] text-[#777771]">Workspaces</p>
          <nav aria-label="KCPL workspaces">
            {visibleMacroNav.map((item) => {
              const active = item.active(pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-[44px] items-center border-l-2 px-[13px] text-[13px] transition-colors ${active ? "border-[#DC143C] bg-[#EEEEE8] font-medium text-[#101010]" : "border-transparent font-normal text-[#5B5B57] hover:bg-[#EEEEE8] hover:text-[#101010]"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-[#D6D6D0]">
          <button type="button" onClick={() => setPaletteOpen(true)} className="flex min-h-[46px] w-full items-center border-b border-[#D6D6D0] px-6 text-[12px] font-normal text-[#5B5B57] transition-colors hover:bg-[#EEEEE8] hover:text-[#101010]" aria-label="Search KCPL">
            <Search size={13} className="mr-3"/><span>Search KCPL</span><span className="ml-auto text-[10px] text-[#878780]">⌘K</span>
          </button>
          <Link href={systemHref} aria-current={systemActive ? "page" : undefined} className={`relative flex min-h-[46px] items-center border-b border-l-2 border-b-[#D6D6D0] px-[22px] text-[12px] transition-colors ${systemActive ? "border-l-[#DC143C] bg-[#EEEEE8] font-medium text-[#101010]" : "border-l-transparent font-normal text-[#5B5B57] hover:bg-[#EEEEE8] hover:text-[#101010]"}`}>System</Link>
          <div className="flex min-h-[76px] items-center px-6 py-4">
            <div className="grid h-8 w-8 shrink-0 place-items-center border border-[#101010] text-[10px] font-medium text-[#101010]">{initials}</div>
            <div className="ml-3 min-w-0 flex-1"><p className="truncate text-[12px] font-medium leading-[18px] text-[#101010]">{userName}</p><p className="text-[10px] font-normal leading-[14px] text-[#777771]">{isManagement ? "Management" : "KCPL staff"}</p></div>
            <a href={signOutPath} className="grid h-8 w-8 place-items-center text-[#777771] transition-colors hover:text-[#DC143C]" aria-label="Sign out"><LogOut size={14}/></a>
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 h-[64px] border-b border-[#D6D6D0] bg-[#F6F6F3] lg:left-[252px]">
        <div className="flex h-full items-center px-4 sm:px-5 lg:px-8">
          <button type="button" onClick={() => setMobileOpen((current) => !current)} className="mr-3 grid h-9 w-9 place-items-center border border-[#AFAFA8] bg-transparent text-[#101010] lg:hidden" aria-label="Toggle navigation">{mobileOpen ? <X size={16}/> : <Menu size={16}/>}</button>
          <p className="min-w-0 flex-1 truncate text-[11px] font-normal uppercase tracking-[0.07em] text-[#5B5B57]">{breadcrumb}</p>
          <button type="button" onClick={() => setPaletteOpen(true)} className="hidden h-10 w-[280px] items-center border border-[#BDBDB6] bg-white px-3 text-[12px] font-normal text-[#5B5B57] transition-colors hover:border-[#101010] hover:text-[#101010] md:flex" aria-label="Open command palette">
            <Search size={13} className="mr-2.5"/><span>Search KCPL</span><span className="ml-auto border-l border-[#D6D6D0] pl-2 text-[10px] text-[#777771]">⌘K</span>
          </button>
          <Link href="/admin/notifications" className="relative ml-3 grid h-10 w-10 place-items-center text-[#5B5B57] transition-colors hover:bg-[#EEEEE8] hover:text-[#101010]" aria-label="Open notifications"><Bell size={15}/><span className="absolute right-[10px] top-[9px] h-1.5 w-1.5 bg-[#DC143C]"/></Link>
          <span className="ml-1 grid h-8 w-8 place-items-center bg-[#101010] text-[10px] font-medium text-[#F6F6F3]">{initials}</span>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-x-0 bottom-0 top-[64px] z-50 overflow-y-auto bg-[#F6F6F3] lg:hidden">
          <div className="mx-auto max-w-xl">
            <div className="flex min-h-[82px] items-center border-b border-[#D6D6D0] px-5"><BrandLockup /></div>
            <div className="border-b border-[#D6D6D0] px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.11em] text-[#DC143C]">Operations desk</p>
              <p className="mt-1 text-[12px] text-[#5B5B57]">{isManagement ? "Management · Global scope" : "Staff · Role scope"}</p>
            </div>
            <button type="button" onClick={() => { setMobileOpen(false); setPaletteOpen(true); }} className="flex min-h-[52px] w-full items-center border-b border-[#D6D6D0] px-5 text-[12px] text-[#5B5B57]"><Search size={14} className="mr-3"/>Search KCPL<span className="ml-auto text-[10px] text-[#878780]">⌘K</span></button>
            <nav aria-label="Mobile KCPL workspaces" className="px-3 py-4">
              {visibleMacroNav.map((item) => {
                const active = item.active(pathname);
                return (
                  <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`flex min-h-[48px] items-center border-l-2 px-4 text-[13px] ${active ? "border-[#DC143C] bg-[#EEEEE8] font-medium text-[#101010]" : "border-transparent text-[#5B5B57]"}`}>{item.label}</Link>
                );
              })}
              <Link href={systemHref} aria-current={systemActive ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`flex min-h-[48px] items-center border-l-2 px-4 text-[13px] ${systemActive ? "border-[#DC143C] bg-[#EEEEE8] font-medium text-[#101010]" : "border-transparent text-[#5B5B57]"}`}>System</Link>
            </nav>
            <div className="border-t border-[#D6D6D0] px-5 py-5"><p className="text-[13px] font-medium text-[#101010]">{userName}</p><p className="mt-1 text-[11px] text-[#777771]">{isManagement ? "Management" : "KCPL staff"}</p><a href={signOutPath} className="mt-5 inline-flex items-center gap-2 border-b border-[#101010] pb-1 text-[12px] text-[#101010]"><LogOut size={13}/>Sign out</a></div>
          </div>
        </div>
      ) : null}

      <div className="kcpl-admin-content min-w-0 pt-[64px] lg:pl-[252px]">{children}</div>
      <OperationsCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} workspaces={workspaces}/>
    </div>
  );
}
