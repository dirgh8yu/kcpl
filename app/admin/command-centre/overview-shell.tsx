"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, LogOut, Menu, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KcplBranch } from "../crm/crm-data";
import { OperationsCommandPalette } from "../operations-command-palette";
import { OperationsNotificationCentre } from "../operations-notification-centre";
import {
  activeWorkspace,
  groupedWorkspaces,
  visibleWorkspaces,
  type NavigationCapabilities,
} from "../workflow-navigation";
import { WorkspaceIcon } from "../workflow-icon";
import styles from "./overview-dashboard.module.css";
import navStyles from "./overview-sidebar.module.css";

function initialsFor(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KC";
}

export function OverviewShell({
  children,
  userName,
  roleLabel,
  branches,
  selectedBranch,
  canAccessAllBranches,
  capabilities,
  signOutPath = "/api/admin/session?logout=1",
}: {
  children: React.ReactNode;
  userName: string;
  roleLabel: string;
  branches: KcplBranch[];
  selectedBranch: "all" | KcplBranch;
  canAccessAllBranches: boolean;
  capabilities: NavigationCapabilities;
  signOutPath?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const workspaces = useMemo(() => visibleWorkspaces(capabilities), [capabilities]);
  const groups = useMemo(() => groupedWorkspaces(capabilities), [capabilities]);
  const activeItem = useMemo(() => activeWorkspace(pathname, capabilities), [pathname, capabilities]);
  const initials = initialsFor(userName);

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setProfileOpen(false);
        setNavigationOpen(false);
        setPaletteOpen((current) => !current);
      } else if (event.key === "Escape") {
        setProfileOpen(false);
        setNavigationOpen(false);
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  useEffect(() => {
    if (!navigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    const restoreFocus = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    navigationRef.current?.querySelector<HTMLElement>("a, button, summary")?.focus();

    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const controls = Array.from(navigationRef.current?.querySelectorAll<HTMLElement>("a[href], button, summary") ?? [])
        .filter((node) => node.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    window.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", trap);
      restoreFocus?.focus();
    };
  }, [navigationOpen]);

  function changeBranch(value: string) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("branch", value);
    router.push(`/admin/command-centre?${query.toString()}`);
  }

  function openSearch() {
    setNavigationOpen(false);
    setProfileOpen(false);
    setPaletteOpen(true);
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#overview-main">Skip to dashboard</a>
      <div className={navStyles.layout}>
        {navigationOpen ? (
          <button
            type="button"
            className={navStyles.backdrop}
            onClick={() => setNavigationOpen(false)}
            aria-label="Close navigation"
          />
        ) : null}

        <aside
          ref={navigationRef}
          className={navStyles.sidebar}
          data-open={navigationOpen || undefined}
          aria-label="Application navigation"
        >
          <Link href="/admin/command-centre" className={navStyles.brandButton} onClick={() => setNavigationOpen(false)} aria-label="KCPL Operations overview">
            <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={28} height={28} priority />
            <span><strong>KCPL</strong><small>Operating system</small></span>
          </Link>

          <div className={navStyles.scopePanel}>
            <span className={navStyles.scopeDot} aria-hidden="true" />
            <span><strong>{selectedBranch === "all" ? "All branches" : selectedBranch}</strong><small>{roleLabel}</small></span>
          </div>

          <nav className={navStyles.workspaceNav} aria-label="KCPL workspaces">
            {groups.map(({ group, items }) => (
              <details key={group} className={navStyles.navGroup} open>
                <summary>{group}<ChevronDown size={13} strokeWidth={1.8} aria-hidden="true" /></summary>
                <div className={navStyles.navItems}>
                  {items.map((workspace) => (
                    <Link
                      key={workspace.id}
                      href={workspace.href}
                      prefetch={false}
                      className={navStyles.navButton}
                      data-active={workspace.id === activeItem?.id || undefined}
                      aria-current={workspace.id === activeItem?.id ? "page" : undefined}
                      title={workspace.hint}
                      onClick={() => setNavigationOpen(false)}
                    >
                      <WorkspaceIcon name={workspace.icon} />
                      <span>{workspace.label}</span>
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </nav>

          <div className={navStyles.sidebarFooter}>
            <button type="button" className={navStyles.searchButton} onClick={openSearch}>
              <Search size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>Find anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <a className={navStyles.signOutButton} href={signOutPath}>
              <LogOut size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>Sign out</span>
            </a>
          </div>
        </aside>

        <div className={navStyles.mainColumn}>
          <header className={styles.topbar}>
            <button
              ref={menuButtonRef}
              type="button"
              className={navStyles.menuButton}
              onClick={() => setNavigationOpen((current) => !current)}
              aria-label="Toggle navigation"
              aria-expanded={navigationOpen}
            >
              {navigationOpen ? <X size={18} strokeWidth={1.8} aria-hidden="true" /> : <Menu size={18} strokeWidth={1.8} aria-hidden="true" />}
            </button>

            <button type="button" className={styles.searchTrigger} onClick={openSearch} aria-label="Search shipments, customers, containers and documents">
              <Search size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>Search shipments, customers, containers, documents…</span>
              <kbd>⌘ K</kbd>
            </button>

            <div className={styles.topbarActions}>
              <label className={styles.branchControl}>
                <span className={styles.branchMarker} aria-hidden="true">▥</span>
                <span className={styles.srOnly}>Operational branch</span>
                <select value={selectedBranch} onChange={(event) => changeBranch(event.target.value)} aria-label="Operational branch">
                  {canAccessAllBranches ? <option value="all">All branches</option> : null}
                  {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                </select>
                <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
              </label>

              <OperationsNotificationCentre />

              <div className={styles.profileRoot} ref={profileRef}>
                <button type="button" className={styles.profileTrigger} onClick={() => setProfileOpen((current) => !current)} aria-expanded={profileOpen}>
                  <span className={styles.avatar}>{initials}</span>
                  <span className={styles.profileCopy}><strong>{userName}</strong><small>{roleLabel}</small></span>
                  <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
                </button>
                {profileOpen ? (
                  <div className={styles.profileMenu}>
                    <div className={styles.profileMenuHeader}><strong>{userName}</strong><span>{roleLabel}</span></div>
                    <Link href="/admin/notifications" onClick={() => setProfileOpen(false)}>Notification centre</Link>
                    {capabilities.canManageStaff ? <Link href="/admin/staff" onClick={() => setProfileOpen(false)}>People &amp; branches</Link> : null}
                    <a href={signOutPath}><LogOut size={14} strokeWidth={1.8} aria-hidden="true" /> Sign out</a>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main id="overview-main" tabIndex={-1} className={styles.shellContent}>{children}</main>
        </div>
      </div>
      <OperationsCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} workspaces={workspaces} />
    </div>
  );
}
