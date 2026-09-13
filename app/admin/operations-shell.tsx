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

const BRAND_RED = "#DC143C";

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

  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#101010] [font-family:var(--font-manrope),ui-sans-serif,system-ui,sans-serif]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[232px] flex-col bg-[#101010] px-[18px] pb-4 pt-5 lg:flex">
        <Link href="/admin/command-centre" className="flex h-9 items-center gap-2.5 text-white" aria-label="KCPL Operations overview">
          <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={22} height={22} className="h-[22px] w-[22px]" priority />
          <span className="min-w-0">
            <span className="block text-[12px] font-extrabold uppercase leading-[14px] tracking-[0.08em]">KCPL</span>
            <span className="block text-[9px] font-semibold uppercase leading-[11px] tracking-[0.12em] text-[#8B8B86]">Operations</span>
          </span>
        </Link>

        <div className="flex min-h-[66px] flex-col justify-center gap-[2px] border-b border-white/[0.07]">
          <p className="text-[12px] font-semibold leading-[18px] text-white">{isManagement ? "All branches" : "Assigned branches"}</p>
          <p className="text-[10px] font-semibold uppercase leading-[14px] tracking-[0.08em] text-[#74746F]">{isManagement ? "Management · Global scope" : "Staff · Role scope"}</p>
        </div>

        <p className="flex h-9 items-end pb-2 text-[10px] font-semibold uppercase leading-[14px] tracking-[0.12em] text-[#74746F]">Workspaces</p>
        <nav className="space-y-1" aria-label="KCPL workspaces">
          {macroNav.filter((item) => item.visible !== false).map((item) => {
            const active = item.active(pathname);
            return <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex h-[38px] items-center rounded-[8px] px-[11px] text-[13px] font-semibold leading-[19px] transition ${active ? "bg-white/[0.095] text-white" : "text-[#8B8B86] hover:bg-white/[0.055] hover:text-white"}`}>
              {active ? <span className="mr-2.5 h-4 w-[3px] rounded-full" style={{ backgroundColor: BRAND_RED }}/> : <span className="mr-2.5 h-4 w-[3px]" />}
              {item.label}
            </Link>;
          })}
        </nav>

        <div className="mt-auto">
          <button type="button" onClick={() => setPaletteOpen(true)} className="flex h-[38px] w-full items-center rounded-[8px] px-[11px] text-[12px] font-semibold leading-[18px] text-[#8B8B86] transition hover:bg-white/[0.055] hover:text-white" aria-label="Search KCPL">
            <Search size={13} className="mr-2.5"/><span>Search</span><span className="ml-auto text-[10px] font-semibold text-[#666661]">⌘K</span>
          </button>
          <Link href={systemHref} aria-current={systemActive ? "page" : undefined} className={`relative flex h-[38px] items-center rounded-[8px] px-[11px] text-[12px] font-semibold transition ${systemActive ? "bg-white/[0.095] text-white" : "text-[#8B8B86] hover:bg-white/[0.055] hover:text-white"}`}>{systemActive ? <span className="mr-2.5 h-4 w-[3px] rounded-full" style={{ backgroundColor: BRAND_RED }}/> : <span className="mr-2.5 h-4 w-[3px]" />}System</Link>
          <div className="mt-2 flex min-h-[58px] items-center border-t border-white/[0.07] pt-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[10px] font-bold text-white">{initials}</div>
            <div className="ml-2.5 min-w-0 flex-1"><p className="truncate text-[12px] font-semibold leading-[18px] text-white">{userName}</p><p className="text-[10px] font-medium leading-[14px] text-[#74746F]">{isManagement ? "Management" : "KCPL staff"}</p></div>
            <a href={signOutPath} className="grid h-8 w-8 place-items-center rounded-[7px] text-[#74746F] transition hover:bg-white/[0.08] hover:text-white" aria-label="Sign out"><LogOut size={13}/></a>
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 h-[56px] border-b border-[#E2E2DD] bg-[#F6F6F3]/95 backdrop-blur lg:left-[232px]">
        <div className="flex h-full items-center px-4 lg:px-7">
          <button type="button" onClick={() => setMobileOpen((current) => !current)} className="mr-3 grid h-8 w-8 place-items-center rounded-[8px] border border-[#DCDCD7] bg-white text-[#101010] lg:hidden" aria-label="Toggle navigation">{mobileOpen ? <X size={15}/> : <Menu size={15}/>}</button>
          <p className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-[17px] text-[#DC143C]">{breadcrumb}</p>
          <button type="button" onClick={() => setPaletteOpen(true)} className="hidden h-9 w-[260px] items-center rounded-[9px] border border-[#DCDCD7] bg-white px-3 text-[12px] font-medium leading-[17px] text-[#64645F] transition hover:border-[#C7C7C1] hover:text-[#101010] md:flex" aria-label="Open command palette">
            <Search size={13} className="mr-2"/><span>Search KCPL</span><span className="ml-auto rounded bg-[#F1F1ED] px-1.5 py-0.5 text-[9px] font-semibold text-[#7A7A74]">⌘K</span>
          </button>
          <Link href="/admin/notifications" className="relative ml-3 grid h-9 w-9 place-items-center rounded-[8px] text-[#60605B] transition hover:bg-white hover:text-[#101010]" aria-label="Open notifications"><Bell size={15}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full border border-[#F6F6F3]" style={{ backgroundColor: BRAND_RED }}/></Link>
          <span className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-[#101010] text-[10px] font-bold text-white">{initials}</span>
        </div>
      </header>

      {mobileOpen ? <div className="fixed inset-x-0 bottom-0 top-[56px] z-50 overflow-y-auto bg-[#101010] px-4 py-5 lg:hidden">
        <div className="mx-auto max-w-xl">
          <div className="mb-5 flex items-center gap-2.5 text-white">
            <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={22} height={22} className="h-[22px] w-[22px]" />
            <div><p className="text-[12px] font-extrabold uppercase tracking-[0.08em]">KCPL</p><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8B8B86]">Operations</p></div>
          </div>
          <button type="button" onClick={() => { setMobileOpen(false); setPaletteOpen(true); }} className="mb-5 flex h-11 w-full items-center rounded-[9px] border border-white/[0.08] bg-white/[0.06] px-3 text-[12px] font-semibold text-white"><Search size={13} className="mr-2"/>Search KCPL<span className="ml-auto text-[10px] text-[#777772]">⌘K</span></button>
          <nav className="space-y-1">{macroNav.filter((item) => item.visible !== false).map((item) => { const active = item.active(pathname); return <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className={`flex min-h-11 items-center rounded-[9px] px-3 text-[13px] font-semibold ${active ? "bg-white/[0.10] text-white" : "text-[#8B8B86]"}`}>{active ? <span className="mr-2.5 h-4 w-[3px] rounded-full" style={{ backgroundColor: BRAND_RED }}/> : <span className="mr-2.5 h-4 w-[3px]" />}{item.label}</Link>; })}<Link href={systemHref} onClick={() => setMobileOpen(false)} className={`flex min-h-11 items-center rounded-[9px] px-3 text-[13px] font-semibold ${systemActive ? "bg-white/[0.10] text-white" : "text-[#8B8B86]"}`}>{systemActive ? <span className="mr-2.5 h-4 w-[3px] rounded-full" style={{ backgroundColor: BRAND_RED }}/> : <span className="mr-2.5 h-4 w-[3px]" />}System</Link></nav>
          <div className="mt-6 border-t border-white/[0.08] pt-4"><p className="text-[13px] font-semibold text-white">{userName}</p><p className="mt-1 text-[10px] text-[#74746F]">{isManagement ? "Management" : "KCPL staff"}</p><a href={signOutPath} className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold text-[#B6B6B0]"><LogOut size={13}/>Sign out</a></div>
        </div>
      </div> : null}

      <div className="min-w-0 pt-[56px] lg:pl-[232px]">{children}</div>
      <OperationsCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} workspaces={workspaces}/>
    </div>
  );
}
