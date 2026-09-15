"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, LogOut, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KcplBranch } from "../crm/crm-data";
import { OperationsCommandPalette } from "../operations-command-palette";
import { OperationsNotificationCentre } from "../operations-notification-centre";
import { visibleWorkspaces, type NavigationCapabilities } from "../workflow-navigation";
import styles from "./overview-dashboard.module.css";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileRef = useRef<HTMLDivElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const workspaces = useMemo(() => visibleWorkspaces(capabilities), [capabilities]);
  const initials = initialsFor(userName);

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setProfileOpen(false);
        setPaletteOpen((current) => !current);
      } else if (event.key === "Escape") {
        setProfileOpen(false);
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

  function changeBranch(value: string) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("branch", value);
    router.push(`/admin/command-centre?${query.toString()}`);
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#overview-main">Skip to dashboard</a>
      <header className={styles.topbar}>
        <button type="button" className={styles.searchTrigger} onClick={() => setPaletteOpen(true)} aria-label="Search shipments, customers, containers and documents">
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
      <OperationsCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} workspaces={workspaces} />
    </div>
  );
}
