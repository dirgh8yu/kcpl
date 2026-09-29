"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, ChevronDown, ChevronRight, LogOut, Menu, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { KcplBranch } from "./crm/crm-data";
import { OperationsCommandPalette } from "./operations-command-palette";
import { OperationsAccountMenu, type AccountTab } from "./operations-account-menu";
import { OperationsNotificationCentre } from "./operations-notification-centre";
import {
  activeHub,
  activeWorkspace,
  visibleHubs,
  visibleWorkspaces,
  type NavigationCapabilities,
} from "./workflow-navigation";
import { WorkspaceIcon } from "./workflow-icon";
import { announceWorkspaceRefresh } from "./use-workspace-refresh";
import { rememberShell } from "./remembered-shell";

function initialsFor(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KC";
}

function decodeSegment(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function OperationsShell({
  children, userName, canManageStaff = false, canManageFinance = false,
  isManagement = false, canViewCommercial = false, canManageJobFile = false,
  branches, selectedBranch, canAccessAllBranches = false,
  signOutPath = "/api/admin/session?logout=1",
  placeholder = false,
}: {
  children: React.ReactNode;
  userName: string;
  canManageStaff?: boolean;
  canManageFinance?: boolean;
  isManagement?: boolean;
  canViewCommercial?: boolean;
  canManageJobFile?: boolean;
  branches?: KcplBranch[];
  selectedBranch?: "all" | KcplBranch;
  canAccessAllBranches?: boolean;
  signOutPath?: string;
  /** The loading state's copy of the shell: it reuses the remembered
   * capabilities and must not refetch them or overwrite what it read. */
  placeholder?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<AccountTab>("identity");
  const [refreshing, startRefresh] = useTransition();
  const [resolvedCapabilities, setResolvedCapabilities] = useState<NavigationCapabilities | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const hubTabsRef = useRef<HTMLElement>(null);
  const capabilities = useMemo(() => resolvedCapabilities ?? ({ canViewCommercial, canManageJobFile, canManageFinance, canManageStaff, isManagement }), [resolvedCapabilities, canViewCommercial, canManageJobFile, canManageFinance, canManageStaff, isManagement]);

  // Remember who is signed in and what they can open, so the next page's
  // loading state draws this same sidebar instead of grey placeholders.
  useEffect(() => {
    if (!placeholder) rememberShell({ userName, ...capabilities });
  }, [placeholder, userName, capabilities]);

  useEffect(() => {
    if (placeholder) return;
    const controller = new AbortController();
    fetch("/api/admin/navigation", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ capabilities?: NavigationCapabilities }> : null)
      .then((data) => { if (!controller.signal.aborted && data?.capabilities) setResolvedCapabilities(data.capabilities); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [placeholder]);

  const workspaces = useMemo(() => visibleWorkspaces(capabilities), [capabilities]);
  const hubs = useMemo(() => visibleHubs(capabilities), [capabilities]);
  const activeItem = useMemo(() => activeWorkspace(pathname, capabilities), [pathname, capabilities]);
  const currentHub = useMemo(() => activeHub(pathname, capabilities), [pathname, capabilities]);
  const detail = pathname === activeItem?.href ? "" : decodeSegment(pathname.split("/").filter(Boolean).at(-1) || "");
  // A hub's pages are tabs across the top of its list pages; a record's own
  // page (a Job File, an invoice) keeps the full width for the record.
  const hubTabs = currentHub && currentHub.items.length > 1 && !detail ? currentHub.items : [];
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

  // On a phone the tab strip scrolls sideways; bring the open tab into view
  // instead of leaving "Delivery & POD" past the edge.
  useEffect(() => {
    const strip = hubTabsRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (strip && active) strip.scrollLeft = Math.max(0, active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2);
  }, [pathname]);

  function closeAccount() { setAccountOpen(false); }

  // The bell's settings icon deep-links into the account panel's Notifications
  // tab — one settings editor, both entry points landing on the same state.
  // The account menu itself also listens for this event while open; routing
  // through the shell is what makes the bell → panel flow work from closed.
  useEffect(() => {
    function openNotificationsSettings() {
      setAccountTab("notifications");
      setAccountOpen(true);
    }
    window.addEventListener("kcpl:open-account-notifications", openNotificationsSettings);
    return () => window.removeEventListener("kcpl:open-account-notifications", openNotificationsSettings);
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
  function changeBranch(value: string) {
    const query = new URLSearchParams(searchParams?.toString() ?? "");
    query.set("branch", value);
    router.push(`${pathname}?${query.toString()}`);
  }

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
          {(["work", "admin"] as const).map((section) => {
            const items = hubs.filter((entry) => entry.hub.section === section);
            if (!items.length) return null;
            return <div key={section} className="app-nav-group" data-section={section}>
              <div className="app-nav-group-list"><div>{items.map(({ hub, href }) => <Link key={hub.id} href={href} prefetch={false} aria-current={hub.id === currentHub?.hub.id ? "page" : undefined} title={hub.hint} onClick={() => setMobileOpen(false)}><span className="app-nav-item-main"><WorkspaceIcon name={hub.icon}/><span>{hub.label}</span></span></Link>)}</div></div>
            </div>;
          })}
        </nav>
        <div className="app-sidebar-footer">
          <button type="button" className="app-nav-search" onClick={openSearch}><Search size={15} strokeWidth={1.75} aria-hidden="true"/><span>Find anything</span><kbd>⌘ K</kbd></button>
          <div className="app-account">
            <button ref={accountTrigger} type="button" className="app-account-trigger" onClick={() => setAccountOpen((current) => !current)} aria-haspopup="dialog" aria-expanded={accountOpen} title="Account and settings">
              <span className="app-avatar" aria-hidden="true">{initials}</span>
              <span className="app-account-name">{userName}<small>{capabilities.isManagement ? "Management" : "KCPL staff"}</small></span>
              <ChevronDown size={13} strokeWidth={1.75} className="app-account-chevron" aria-hidden="true"/>
            </button>
            <a href={signOutPath} aria-label="Sign out"><LogOut size={16} strokeWidth={1.75} aria-hidden="true"/></a>
          </div>
        </div>
      </aside>
      <header className="app-topbar">
        <button ref={menuButton} type="button" className="app-icon-button app-menu-toggle" onClick={() => setMobileOpen((current) => !current)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>{mobileOpen ? <X size={18} strokeWidth={1.75}/> : <Menu size={18} strokeWidth={1.75}/>}</button>
        <nav className="app-breadcrumb" aria-label="Breadcrumb">{currentHub?.hub.label === activeItem?.label ? null : <><span>{currentHub?.hub.label || "KCPL"}</span><ChevronRight size={13} strokeWidth={1.75} aria-hidden="true"/></>}<Link href={activeItem?.href || "/admin/command-centre"} aria-current={!detail ? "page" : undefined}>{activeItem?.label || "Workspace"}</Link>{detail ? <><ChevronRight size={13} strokeWidth={1.75} aria-hidden="true"/><span aria-current="page" className="ops-mono">{detail}</span></> : null}</nav>
        {branches && branches.length ? (
          <label className="app-branch">
            <span className="app-branch-mark" aria-hidden="true">▥</span>
            <span className="sr-only">Operational branch</span>
            <select value={selectedBranch} onChange={(event) => changeBranch(event.target.value)} aria-label="Operational branch">
              {canAccessAllBranches ? <option value="all">All branches</option> : null}
              {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
            </select>
            <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true"/>
          </label>
        ) : null}
        <button type="button" className="app-icon-button" disabled={refreshing} onClick={() => { announceWorkspaceRefresh(); startRefresh(() => router.refresh()); }} aria-label={refreshing ? "Refreshing workspace" : "Refresh workspace"} title="Refresh workspace"><RefreshCw size={16} strokeWidth={1.75} className={refreshing ? "app-refreshing" : undefined}/></button>
        {placeholder ? <span className="app-icon-button" aria-hidden="true"><Bell size={16} strokeWidth={1.75}/></span> : <OperationsNotificationCentre/>}
      </header>
      <div id="workspace-content" tabIndex={-1} className="kcpl-admin-content">
        {hubTabs.length ? <nav ref={hubTabsRef} className="app-hub-tabs" aria-label={`${currentHub?.hub.label} sections`}>
          {hubTabs.map((workspace) => <Link key={workspace.id} href={workspace.href} prefetch={false} aria-current={workspace.id === activeItem?.id ? "page" : undefined} title={workspace.hint}>{workspace.tab}</Link>)}
        </nav> : null}
        {children}
      </div>
      <div className="app-account-anchor">
        <OperationsAccountMenu userName={userName} isManagement={capabilities.isManagement} signOutPath={signOutPath} open={accountOpen} tab={accountTab} onTabChange={setAccountTab} onClose={closeAccount} triggerRef={accountTrigger}/>
      </div>
      <OperationsCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} workspaces={workspaces}/>
    </div>
  );
}
