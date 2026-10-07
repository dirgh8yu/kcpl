"use client";

import { OperationsShell } from "./operations-shell";
import { useRememberedShell } from "./remembered-shell";
import { useSidebarRail } from "./sidebar-rail-provider";

/**
 * Instant loading state for every /admin route.
 *
 * `OperationsShell` is rendered inside each page rather than in the layout, so
 * a naive fallback would blank the sidebar and top bar on every navigation.
 * Once a page has rendered, the shell remembers who is signed in for the tab
 * (remembered-shell.ts) and this state draws that same, real sidebar with the
 * next page's tabs; only the page body shows placeholders. The very first load
 * has nothing remembered yet, so it draws placeholder chrome of the same shape.
 *
 * A single `loading.tsx` at this segment covers all nested admin routes.
 */
export default function AdminWorkspaceLoading() {
  const remembered = useRememberedShell();
  const { rail } = useSidebarRail();
  if (remembered) return <OperationsShell placeholder {...remembered}><WorkspaceBodySkeleton/></OperationsShell>;
  return (
    <div className="kcpl-admin-shell" data-sidebar={rail ? "rail" : undefined}>
      <aside className="app-sidebar" aria-hidden="true">
        <div className="app-brand ops-boot-brand">
          <span className="ops-boot-block ops-boot-brand-mark" />
          <span className="ops-boot-stack">
            <span className="ops-boot-block ops-boot-line-sm" />
            <span className="ops-boot-block ops-boot-line-xs" />
          </span>
        </div>
        <div className="app-scope ops-boot-scope">
          <span className="ops-boot-block ops-boot-line-sm" />
        </div>
        <div className="app-workspaces ops-boot-nav">
          {/* The flat hub list: seven work hubs, then Reports and Settings. */}
          {[7, 2].map((count, group) => (
            <div key={group} className="ops-boot-nav-group">
              {Array.from({ length: count }, (_, item) => (
                <span key={item} className="ops-boot-block ops-boot-nav-item" />
              ))}
            </div>
          ))}
        </div>
      </aside>

      <header className="app-topbar" aria-hidden="true">
        <span className="ops-boot-block ops-boot-line-md" />
      </header>

      <div className="kcpl-admin-content">
        <WorkspaceBodySkeleton/>
      </div>
    </div>
  );
}

function WorkspaceBodySkeleton() {
  return (
    <div className="ops-boot" role="status" aria-label="Loading workspace">
      <div className="ops-boot-header">
        <span className="ops-boot-block ops-boot-line-xs" />
        <span className="ops-boot-block ops-boot-title" />
        <span className="ops-boot-block ops-boot-line-lg" />
      </div>

      <div className="ops-boot-kpis">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="ops-boot-kpi">
            <span className="ops-boot-block ops-boot-line-xs" />
            <span className="ops-boot-block ops-boot-kpi-value" />
          </div>
        ))}
      </div>

      <div className="ops-boot-table">
        <div className="ops-boot-table-head">
          <span className="ops-boot-block ops-boot-line-xs" />
        </div>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="ops-boot-row">
            <span className="ops-boot-block ops-boot-cell" />
            <span className="ops-boot-block ops-boot-cell" />
            <span className="ops-boot-block ops-boot-cell" />
            <span className="ops-boot-block ops-boot-cell" />
          </div>
        ))}
      </div>

      <span className="ops-boot-sr">Loading workspace…</span>
    </div>
  );
}
