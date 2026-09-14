"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, LogOut, Menu, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { OperationsCommandPalette } from "./operations-command-palette";
import { OperationsNotificationCentre } from "./operations-notification-centre";
import {
  activeWorkspace,
  groupedWorkspaces,
  visibleWorkspaces,
  type NavigationCapabilities,
} from "./workflow-navigation";
import { WorkspaceIcon } from "./workflow-icon";

function initialsFor(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KC";
}

function decodeSegment(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function OperationsShell({
  children, userName, canManageStaff = false, canManageFinance = false,
  isManagement = false, canViewCommercial = false, canManageJobFile = false,
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
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [resolvedCapabilities, setResolvedCapabilities] = useState<NavigationCapabilities | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const capabilities = useMemo(() => resolvedCapabilities ?? ({ canViewCommercial, canManageJobFile, canManageFinance, canManageStaff, isManagement }), [resolvedCapabilities, canViewCommercial, canManageJobFile, canManageFinance, canManageStaff, isManagement]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/navigation", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ capabilities?: NavigationCapabilities }> : null)
      .then((data) => { if (!controller.signal.aborted && data?.capabilities) setResolvedCapabilities(data.capabilities); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const workspaces = useMemo(() => visibleWorkspaces(capabilities), [capabilities]);
  const groups = useMemo(() => groupedWorkspaces(capabilities), [capabilities]);
  const activeItem = useMemo(() => activeWorkspace(pathname, capabilities), [pathname, capabilities]);
  const detail = pathname === activeItem?.href ? "" : decodeSegment(pathname.split("/").filter(Boolean).at(-1) || "");
  const initials = initialsFor(userName);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileOpen(false);
        setPaletteOpen((current) => !current);
      } else if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const restoreFocus = menuButton.current;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLElement>("a, button, summary")?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const controls = Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href], button, summary') ?? []).filter((node) => node.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    window.addEventListener("keydown", trap);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", trap); restoreFocus?.focus(); };
  }, [mobileOpen]);

  function openSearch() { setMobileOpen(false); setPaletteOpen(true); }

  return (
    <div className="kcpl-admin-shell" data-operations-context={activeItem?.group === "Operate" || undefined} data-commercial-context={activeItem?.group === "Plan & Sell" || undefined} data-workspace-group={activeItem?.group} data-workspace-id={activeItem?.id || "unscoped"}>
      <a className="app-skip-link" href="#workspace-content">Skip to workspace</a>
      {mobileOpen ? <button type="button" className="app-nav-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/> : null}
      <aside ref={sidebar} className="app-sidebar" data-open={mobileOpen || undefined} aria-label="Application navigation">
        <Link href="/admin/command-centre" className="app-brand" aria-label="KCPL Operations overview" onClick={() => setMobileOpen(false)}>
          <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={28} height={28} priority/>
          <span><strong>KCPL</strong><small>Operating system</small></span>
        </Link>
        <div className="app-scope"><span className="app-scope-mark" style={{ background: "var(--admin-success)" }}/>{capabilities.isManagement ? "All branches" : "Assigned branches"}<span>{capabilities.isManagement ? "Management" : "Staff"}</span></div>
        <nav className="app-workspaces" aria-label="KCPL workspaces">
          {groups.map(({ group, items }) => <details key={group} className="app-nav-group" defaultOpen>
            <summary>{group}<ChevronDown size={13} strokeWidth={1.75} aria-hidden="true"/></summary>
            {items.map((workspace) => <Link key={workspace.id} href={workspace.href} prefetch={false} aria-current={workspace.id === activeItem?.id ? "page" : undefined} title={workspace.hint} onClick={() => setMobileOpen(false)}><span className="app-nav-item-main"><WorkspaceIcon name={workspace.icon}/><span>{workspace.label}</span></span>{workspace.id === activeItem?.id ? <ChevronRight size={13} strokeWidth={1.75} aria-hidden="true"/> : null}</Link>)}
          </details>)}
        </nav>
        <div className="app-sidebar-footer">
          <button type="button" className="app-nav-search" onClick={openSearch}><Search size={15} strokeWidth={1.75} aria-hidden="true"/><span>Find anything</span><kbd>⌘ K</kbd></button>
          <div className="app-account"><span className="app-avatar">{initials}</span><span className="app-account-name">{userName}<small>{capabilities.isManagement ? "Management" : "KCPL staff"}</small></span><a href={signOutPath} aria-label="Sign out"><LogOut size={16} strokeWidth={1.75} aria-hidden="true"/></a></div>
        </div>
      </aside>
      <header className="app-topbar">
        <button ref={menuButton} type="button" className="app-icon-button app-menu-toggle" onClick={() => setMobileOpen((current) => !current)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>{mobileOpen ? <X size={18} strokeWidth={1.75}/> : <Menu size={18} strokeWidth={1.75}/>}</button>
        <nav className="app-breadcrumb" aria-label="Breadcrumb"><span>{activeItem?.group || "KCPL"}</span><ChevronRight size={13} strokeWidth={1.75} aria-hidden="true"/><Link href={activeItem?.href || "/admin/command-centre"} aria-current={!detail ? "page" : undefined}>{activeItem?.label || "Workspace"}</Link>{detail ? <><ChevronRight size={13} strokeWidth={1.75} aria-hidden="true"/><span aria-current="page" className="ops-mono">{detail}</span></> : null}</nav>
        <button type="button" className="app-icon-button" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())} aria-label={refreshing ? "Refreshing workspace" : "Refresh workspace"} title="Refresh workspace"><RefreshCw size={16} strokeWidth={1.75} className={refreshing ? "app-refreshing" : undefined}/></button>
        <OperationsNotificationCentre/>
      </header>
      <div id="workspace-content" tabIndex={-1} className="kcpl-admin-content">{children}</div>
      <OperationsCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} workspaces={workspaces}/>
    </div>
  );
}
