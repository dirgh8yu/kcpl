/**
 * Instant loading state for every /admin route.
 *
 * `OperationsShell` is rendered inside each page rather than in the layout, so
 * a naive fallback would blank the sidebar and topbar on every navigation. This
 * skeleton reuses the shell's own `.app-sidebar` / `.app-topbar` /
 * `.kcpl-admin-content` classes so the chrome keeps its exact geometry and only
 * the workspace body visibly swaps when the real page streams in.
 *
 * A single `loading.tsx` at this segment covers all nested admin routes.
 */
export default function AdminWorkspaceLoading() {
  return (
    <div className="kcpl-admin-shell">
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
          {/* Context-first default: active group expanded, the rest collapsed. */}
          {[[4], [], [], [], []].map((items, group) => (
            <div key={group} className="ops-boot-nav-group">
              <span className="ops-boot-block ops-boot-line-xs" />
              {items.map((_, item) => (
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
      </div>
    </div>
  );
}
