"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, LogOut, Menu, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { KcplBranch } from "./crm/crm-data";
import { OperationsCommandPalette } from "./operations-command-palette";
import { clearManualCollapses, readManualCollapses, writeManualCollapses } from "./sidebar-group-state";
import { OperationsAccountMenu, type AccountTab } from "./operations-account-menu";
import { OperationsNotificationCentre } from "./operations-notification-centre";
import {
  activeWorkspace,
  collapsedGroupIds,
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
  branches, selectedBranch, canAccessAllBranches = false,
  signOutPath = "/api/admin/session?logout=1",
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
  const capabilities = useMemo(() => resolvedCapabilities ?? ({ canViewCommercial, canManageJobFile, canManageFinance, canManageStaff, isManagement }), [resolvedCapabilities, canViewCommercial, canManageJobFile, canManageFinance, canManageStaff, isManagement]);
  // Remembered manual toggles are adopted once, when real capabilities resolve;
  // until then the SSR default (context-first) is already correct. The active
  // group is never persisted-closed: the derivation below re-opens it on every
  // group change.
  const [manualGroups, setManualGroups] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!resolvedCapabilities || manualGroups) return;
    const stored = readManualCollapses();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopting persisted storage into state on capability resolve
    if (stored) setManualGroups(new Set(stored));
  }, [resolvedCapabilities, manualGroups]);
  // Context-first navigation: only the active workspace's group starts expanded,
  // so the first paint already shows a short nav instead of every workspace.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => collapsedGroupIds(groupedWorkspaces(capabilities), activeWorkspace(pathname, capabilities)?.group),
  );

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
  const activeGroup = activeItem?.group;
  // Re-derive on group change so navigating between workspaces brings the
  // destination's group with it. Render-time adjustment (the React-endorsed
  // pattern) instead of an effect; manual toggles survive until the next group
  // change.
  const [derivedFromGroup, setDerivedFromGroup] = useState(activeGroup);
  if (derivedFromGroup !== activeGroup) {
    setDerivedFromGroup(activeGroup);
    // A remembered arrangement wins once adopted; the active group is always
    // re-opened, so a peeked group stays open for the next visit.
    const manual = manualGroups;
    const next = manual ? new Set(manual) : collapsedGroupIds(groups, activeGroup);
    if (activeGroup) next.delete(activeGroup);
    setCollapsedGroups(next);
  }
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
  function toggleGroup(group: string) {
    const next = new Set(collapsedGroups);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    setCollapsedGroups(next);
    // Manual toggles are remembered per device so a peeked group survives reloads.
    writeManualCollapses([...next]);
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
          {groups.map(({ group, items }) => {
            const isCollapsed = collapsedGroups.has(group);
            return <details key={group} className={isCollapsed ? "app-nav-group is-collapsed" : "app-nav-group"} open={!isCollapsed}>
              <summary data-collapsed={isCollapsed || undefined} onClick={(event) => { event.preventDefault(); toggleGroup(group); }}>{group}<span className="app-nav-group-meta"><span className="app-nav-group-count" aria-hidden="true">{items.length}</span><ChevronDown size={13} strokeWidth={1.75} aria-hidden="true"/></span></summary>
              <div className="app-nav-group-list"><div>{items.map((workspace) => <Link key={workspace.id} href={workspace.href} prefetch={false} aria-current={workspace.id === activeItem?.id ? "page" : undefined} title={workspace.hint} onClick={() => setMobileOpen(false)}><span className="app-nav-item-main"><WorkspaceIcon name={workspace.icon}/><span>{workspace.label}</span></span>{workspace.id === activeItem?.id ? <ChevronRight size={13} strokeWidth={1.75} aria-hidden="true"/> : null}</Link>)}</div></div>
            </details>;
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
            <a href={signOutPath} aria-label="Sign out" onClick={() => clearManualCollapses()}><LogOut size={16} strokeWidth={1.75} aria-hidden="true"/></a>
          </div>
        </div>
      </aside>
      <header className="app-topbar">
        <button ref={menuButton} type="button" className="app-icon-button app-menu-toggle" onClick={() => setMobileOpen((current) => !current)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>{mobileOpen ? <X size={18} strokeWidth={1.75}/> : <Menu size={18} strokeWidth={1.75}/>}</button>
        <nav className="app-breadcrumb" aria-label="Breadcrumb"><span>{activeItem?.group || "KCPL"}</span><ChevronRight size={13} strokeWidth={1.75} aria-hidden="true"/><Link href={activeItem?.href || "/admin/command-centre"} aria-current={!detail ? "page" : undefined}>{activeItem?.label || "Workspace"}</Link>{detail ? <><ChevronRight size={13} strokeWidth={1.75} aria-hidden="true"/><span aria-current="page" className="ops-mono">{detail}</span></> : null}</nav>
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
        <button type="button" className="app-icon-button" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())} aria-label={refreshing ? "Refreshing workspace" : "Refresh workspace"} title="Refresh workspace"><RefreshCw size={16} strokeWidth={1.75} className={refreshing ? "app-refreshing" : undefined}/></button>
        <OperationsNotificationCentre/>
      </header>
      <div id="workspace-content" tabIndex={-1} className="kcpl-admin-content">{children}</div>
      <div className="app-account-anchor">
        <OperationsAccountMenu userName={userName} isManagement={capabilities.isManagement} signOutPath={signOutPath} open={accountOpen} tab={accountTab} onTabChange={setAccountTab} onClose={closeAccount} triggerRef={accountTrigger}/>
      </div>
      <OperationsCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} workspaces={workspaces}/>
    </div>
  );
}
