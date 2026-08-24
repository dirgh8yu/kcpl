"use client";

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

const V4_RED = "#dc143c";

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
    return pathname.includes("/profitability") ? `Operations / Shipments / ${reference} / Profitability` : `Operations / Shipments / ${reference}`;
  }
  if (pathname.startsWith("/admin/command-centre")) return "Operations / Overview";
  if (pathname.startsWith("/admin/shipments")) return "Operations / Shipments";
  if (pathname.startsWith("/admin/pickups")) return "Operations / Pickups";
  if (pathname.startsWith("/admin/visibility")) return "Operations / Tracking";
  if (pathname.startsWith("/admin/customs")) return "Operations / Customs";
  if (pathname.startsWith("/admin/documents") || pathname.startsWith("/admin/freight-documents")) return "Operations / Documents";
  if (pathname.startsWith("/admin/delivery")) return "Operations / Delivery & POD";
  if (pathname.startsWith("/admin/alerts")) return "Operations / Tasks & Alerts";

  if (pathname === "/admin") return "Commercial / Enquiries";
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
  if (pathname.startsWith("/admin/notifications")) return "Organisation / Notifications";

  return activeLabel ? `KCPL / ${activeLabel}` : "KCPL / Operations";
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
    { label: "Home", href: "/admin/command-centre", active: (path) => path.startsWith("/admin/command-centre") },
    { label: "Operations", href: "/admin/shipments", visible: capabilities.canManageJobFile, active: (path) => ["/admin/shipments", "/admin/jobs/", "/admin/pickups", "/admin/freight-documents", "/admin/visibility", "/admin/customs", "/admin/documents", "/admin/delivery", "/admin/alerts"].some((prefix) => path.startsWith(prefix)) },
    { label: "Commercial", href: "/admin/rating", visible: capabilities.canViewCommercial, active: (path) => path === "/admin" || ["/admin/rating", "/admin/pricing", "/admin/consolidation", "/admin/tenders", "/admin/market-estimate", "/admin/crm"].some((prefix) => path.startsWith(prefix)) },
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
    <div className="min-h-screen bg-[#f6f6f3] text-[#141414] [font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[232px] flex-col bg-black px-[18px] pb-4 pt-5 lg:flex">
        <Link href="/admin/command-centre" className="flex h-7 items-center text-[15px] font-semibold leading-[22px] text-white" aria-label="KCPL Operations home">
          <span>KCPL</span><span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: V4_RED }}/>
        </Link>

        <div className="flex h-[62px] flex-col justify-center gap-[2px]">
          <p className="text-[13px] font-medium leading-[19px] text-white">{isManagement ? "All branches" : "Assigned branches"} <span className="text-[#737373]">⌄</span></p>
          <p className="text-[11px] font-medium leading-[15px] text-[#737373]">{isManagement ? "Management · Global scope" : "Staff · Role scope"}</p>
        </div>

        <p className="flex h-7 items-center text-[11px] font-medium leading-[15px] text-[#737373]">WORKSPACES</p>
        <nav className="space-y-0.5" aria-label="KCPL workspaces">
          {macroNav.filter((item) => item.visible !== false).map((item) => {
            const active = item.active(pathname);
            return <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex h-[34px] items-center rounded-[6px] px-[10px] text-[13px] font-medium leading-[19px] transition ${active ? "bg-[#242424] text-white" : "text-[#737373] hover:bg-[#171717] hover:text-white"}`}>
              {active ? <span className="mr-2 h-4 w-0.5 rounded-[2px]" style={{ backgroundColor: V4_RED }}/> : null}
              {item.label}
            </Link>;
          })}
        </nav>

        <div className="mt-auto">
          <button type="button" onClick={() => setPaletteOpen(true)} className="flex h-[34px] w-full items-center text-[13px] font-normal leading-[19px] text-[#737373] transition hover:text-white" aria-label="Search KCPL">
            <Search size={12} className="mr-2"/><span>Search</span><span className="ml-auto text-[11px] font-medium">⌘ K</span>
          </button>
          <Link href={systemHref} aria-current={systemActive ? "page" : undefined} className={`relative flex h-[34px] items-center rounded-[6px] px-[10px] text-[13px] font-medium transition ${systemActive ? "bg-[#242424] text-white" : "text-[#737373] hover:bg-[#171717] hover:text-white"}`}>{systemActive ? <span className="mr-2 h-4 w-0.5 rounded-[2px]" style={{ backgroundColor: V4_RED }}/> : null}System</Link>
          <div className="flex min-h-[54px] items-end border-t border-[#171717] pt-3">
            <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium leading-[19px] text-white">{userName}</p><p className="text-[11px] font-medium leading-[15px] text-[#737373]">{isManagement ? "Management" : "KCPL staff"}</p></div>
            <a href={signOutPath} className="grid h-8 w-8 place-items-center rounded-[6px] text-[#737373] hover:bg-[#242424] hover:text-white" aria-label="Sign out"><LogOut size={13}/></a>
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 h-[54px] border-b border-[#e2e2e2] bg-[#f6f6f3] lg:left-[232px]">
        <div className="flex h-full items-center px-4 lg:px-7">
          <button type="button" onClick={() => setMobileOpen((current) => !current)} className="mr-3 grid h-8 w-8 place-items-center rounded-[6px] border border-[#e2e2e2] bg-white text-[#141414] lg:hidden" aria-label="Toggle navigation">{mobileOpen ? <X size={15}/> : <Menu size={15}/>}</button>
          <p className="min-w-0 flex-1 truncate text-[12px] font-medium leading-[17px]" style={{ color: V4_RED }}>{breadcrumb}</p>
          <button type="button" onClick={() => setPaletteOpen(true)} className="hidden h-[30px] w-[250px] items-center rounded-[6px] bg-[#242424] px-[10px] text-[12px] font-medium leading-[17px] text-white md:flex" aria-label="Open command palette">
            <Search size={12} className="mr-2"/><span>Search KCPL…</span><span className="ml-auto text-[11px] leading-[15px]">⌘K</span>
          </button>
          <Link href="/admin/notifications" className="relative ml-[14px] grid h-7 w-7 place-items-center text-[#5b5b5b] hover:text-[#141414]" aria-label="Open notifications"><Bell size={14}/><span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full border border-[#f6f6f3]" style={{ backgroundColor: V4_RED }}/></Link>
          <span className="ml-1 text-[12px] font-semibold leading-[17px]">{initials}</span>
        </div>
      </header>

      {mobileOpen ? <div className="fixed inset-x-0 bottom-0 top-[54px] z-50 overflow-y-auto bg-black px-4 py-5 lg:hidden">
        <div className="mx-auto max-w-xl">
          <div className="mb-5 flex items-center text-[15px] font-semibold text-white"><span>KCPL</span><span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: V4_RED }}/></div>
          <button type="button" onClick={() => { setMobileOpen(false); setPaletteOpen(true); }} className="mb-4 flex h-10 w-full items-center rounded-[7px] bg-[#242424] px-3 text-[12px] font-medium text-white"><Search size={13} className="mr-2"/>Search KCPL…<span className="ml-auto text-[#999]">⌘K</span></button>
          <nav className="space-y-1">{macroNav.filter((item) => item.visible !== false).map((item) => { const active = item.active(pathname); return <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} className={`flex min-h-11 items-center rounded-[7px] px-3 text-[13px] font-medium ${active ? "bg-[#242424] text-white" : "text-[#8a8a8a]"}`}>{active ? <span className="mr-2 h-4 w-0.5 rounded" style={{ backgroundColor: V4_RED }}/> : null}{item.label}</Link>; })}<Link href={systemHref} onClick={() => setMobileOpen(false)} className={`flex min-h-11 items-center rounded-[7px] px-3 text-[13px] font-medium ${systemActive ? "bg-[#242424] text-white" : "text-[#8a8a8a]"}`}>{systemActive ? <span className="mr-2 h-4 w-0.5 rounded" style={{ backgroundColor: V4_RED }}/> : null}System</Link></nav>
          <div className="mt-6 border-t border-[#242424] pt-4"><p className="text-[13px] font-medium text-white">{userName}</p><p className="mt-1 text-[11px] text-[#737373]">{isManagement ? "Management" : "KCPL staff"}</p><a href={signOutPath} className="mt-4 inline-flex items-center gap-2 text-[12px] font-medium text-[#b5b5b5]"><LogOut size={13}/>Sign out</a></div>
        </div>
      </div> : null}

      <div className="min-w-0 pt-[54px] lg:pl-[232px]">{children}</div>
      <OperationsCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} workspaces={workspaces}/>
    </div>
  );
}
