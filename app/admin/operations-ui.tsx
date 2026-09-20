import { cloneElement, isValidElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type CSSProperties, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { ChevronRight, Search } from "lucide-react";

export { OpsNotice } from "./ops-notice";
export { useAdminPortalContainer } from "./use-admin-portal-container";
export const OpsDialog = DialogPrimitive;
export const OpsPopover = PopoverPrimitive;
export const OpsTabs = TabsPrimitive;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function OpsPage({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx("ops-page", className)}>{children}</main>;
}

export function OpsPageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="ops-page-header">
      <div className="ops-page-header-main">
        <div className="ops-page-heading">
          {eyebrow ? <p className="ops-eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {description ? <div className="ops-page-description">{description}</div> : null}
          {meta ? <div className="ops-page-meta">{meta}</div> : null}
        </div>
        {actions ? <div className="ops-page-actions">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function OpsSurface({
  id,
  title,
  eyebrow,
  description,
  action,
  children,
  className,
  bodyClassName,
  flush = false,
  priority = "normal",
}: {
  id?: string;
  title?: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
  priority?: "normal" | "info" | "success" | "warning" | "danger";
}) {
  return (
    <section id={id} className={cx("ops-surface", flush && "ops-surface-flush", className)} data-priority={priority}>
      {title || eyebrow || description || action ? (
        <div className="ops-surface-header">
          <div className="min-w-0">
            {eyebrow ? <p className="ops-eyebrow">{eyebrow}</p> : null}
            {title ? <h2>{title}</h2> : null}
            {description ? <div className="ops-surface-description">{description}</div> : null}
          </div>
          {action ? <div className="ops-surface-action">{action}</div> : null}
        </div>
      ) : null}
      <div className={cx("ops-surface-body", flush && "ops-surface-body-flush", bodyClassName)}>{children}</div>
    </section>
  );
}

export function OpsToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("ops-toolbar", className)}>{children}</div>;
}

export function OpsFilterChip({
  children,
  active = false,
  onClick,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return <button type="button" className={cx("ops-filter-chip", className)} data-active={active || undefined} aria-pressed={active} onClick={onClick}>{children}</button>;
}

export function OpsTableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("ops-table-wrap", className)}>{children}</div>;
}

export function OpsKpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("ops-kpi-strip", className)}>{children}</div>;
}

/**
 * One glyph size for every KPI card in the product. Call sites passed 16, 18
 * and 20 depending on when they were written, which is what made the same card
 * look subtly different from page to page; the stylesheet already normalises
 * stroke width the same way, for the same reason.
 */
function kpiIcon(icon: ReactNode) {
  if (!isValidElement(icon)) return icon;
  return cloneElement(icon as ReactElement<{ size?: number | string }>, { size: 16 });
}

export function OpsKpiCard({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
  active = false,
  variant = "metric",
  onClick,
  href,
  ariaLabel,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  active?: boolean;
  /**
   * "metric" is the default and styles `value` as a large number. Use "text"
   * when the value is a word or phrase -- at 26px/700 a word like
   * "Receivables" overflows the card and is clipped, because the strip's
   * columns are sized for digits.
   */
  variant?: "metric" | "text";
  onClick?: () => void;
  /** Renders the card as a link. A card either navigates or filters, never both. */
  href?: string;
  ariaLabel?: string;
}) {
  const zero = typeof value === "number" && value === 0;
  const interactive = Boolean(onClick) || Boolean(href);
  const body = (
    <>
      {icon ? <span className="ops-kpi-icon">{kpiIcon(icon)}</span> : null}
      <span className="ops-kpi-copy">
        <strong>{value}</strong>
        <span>{label}</span>
        {detail ? <em>{detail}</em> : null}
      </span>
      {interactive ? <ChevronRight size={16} strokeWidth={1.75} className="ops-kpi-chevron" aria-hidden="true" /> : null}
    </>
  );
  if (href) {
    return <Link href={href} className="ops-kpi" aria-label={ariaLabel} data-tone={tone} data-variant={variant} data-active={active || undefined} data-zero={zero || undefined}>{body}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className="ops-kpi" aria-label={ariaLabel} aria-pressed={active} data-tone={tone} data-variant={variant} data-active={active || undefined} data-zero={zero || undefined}>{body}</button>;
  }
  return <div className="ops-kpi" data-tone={tone} data-variant={variant} data-zero={zero || undefined}>{body}</div>;
}

export function OpsBadge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "violet";
  dot?: boolean;
  className?: string;
}) {
  return <span className={cx("ops-badge", className)} data-tone={tone}>{dot ? <i aria-hidden="true"/> : null}{children}</span>;
}

export function OpsSearch({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx("ops-search", className)}>
      <Search size={15} aria-hidden="true"/>
      <input type="search" {...props} aria-label={props["aria-label"] ?? props.placeholder ?? "Search records"}/>
    </label>
  );
}

export function OpsField({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return <label className={cx("ops-field", className)}><span className="ops-field-label">{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

export function OpsEmptyState({
  icon,
  title,
  description,
  action,
  kind = "neutral",
  compact = false,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  kind?: "neutral" | "healthy" | "setup" | "search" | "unavailable";
  compact?: boolean;
}) {
  return <div className="ops-empty" data-kind={kind} data-compact={compact || undefined}>{icon ? <div className="ops-empty-icon">{icon}</div> : null}<h3>{title}</h3>{description ? <p>{description}</p> : null}{action ? <div className="ops-empty-action">{action}</div> : null}</div>;
}

export function OpsErrorState({ title, detail, action, tone = "warning" }: { title: ReactNode; detail?: ReactNode; action?: ReactNode; tone?: "warning" | "danger" | "neutral" }) {
  return <div className="ops-error-state" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
    <strong>{title}</strong>
    {detail ? <p>{detail}</p> : null}
    {action ? <div className="ops-error-state-action">{action}</div> : null}
  </div>;
}

export function OpsButton({
  children,
  variant,
  tone,
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  tone?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const resolvedVariant = variant ?? tone ?? "secondary";
  return <button {...props} type={type} className={cx("ops-button", className)} data-variant={resolvedVariant} data-size={size}>{children}</button>;
}

export function OpsMetricStrip({ children, columns = 4 }: { children: ReactNode; columns?: number }) {
  return <div className="ops-metric-strip" style={{ "--ops-metric-columns": Math.max(1, Math.min(8, columns)) } as CSSProperties}>{children}</div>;
}

export function OpsMetric({ icon, label, value, detail }: { icon?: ReactNode; label: ReactNode; value: ReactNode; detail?: ReactNode }) {
  return <div className="ops-metric">
    <div className="ops-metric-label">{icon}{label}</div>
    <div className="ops-metric-value">{value}</div>
    {detail ? <div className="ops-metric-detail">{detail}</div> : null}
  </div>;
}

export function OpsMono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("ops-mono", className)}>{children}</span>;
}

export function OpsProgress({ value, max = 100, tone = "accent", label }: { value: number; max?: number; tone?: "accent" | "success" | "warning" | "danger"; label?: string }) {
  const ratio = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <div className="ops-progress" data-tone={tone} aria-label={label} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{ width: `${ratio}%` }}/></div>;
}

export type OpsTimelineEntry = {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  icon?: ReactNode;
};

export function OpsTimeline({ entries, empty }: { entries: OpsTimelineEntry[]; empty?: ReactNode }) {
  if (entries.length === 0) {
    return empty ? <>{empty}</> : null;
  }
  return (
    <ol className="ops-timeline">
      {entries.map((entry) => (
        <li key={entry.id} className="ops-timeline-item" data-tone={entry.tone ?? "neutral"}>
          <span className="ops-timeline-marker" aria-hidden="true">{entry.icon}</span>
          <div className="ops-timeline-content">
            <div className="ops-timeline-head">
              <span className="ops-timeline-title">{entry.title}</span>
              {entry.meta ? <span className="ops-timeline-meta">{entry.meta}</span> : null}
            </div>
            {entry.body ? <div className="ops-timeline-body">{entry.body}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function OpsDetailSection({
  title,
  description,
  action,
  children,
  columns = 2,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  columns?: number;
}) {
  return (
    <div className="ops-detail-section">
      <div className="ops-detail-section-head">
        <div className="min-w-0">
          <h3>{title}</h3>
          {description ? <p className="ops-detail-section-description">{description}</p> : null}
        </div>
        {action ? <div className="ops-detail-section-action">{action}</div> : null}
      </div>
      <OpsDetailGrid columns={columns}>{children}</OpsDetailGrid>
    </div>
  );
}

export function OpsDetailGrid({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  return <dl className="ops-detail-grid" style={{ "--ops-detail-columns": Math.max(1, Math.min(4, columns)) } as CSSProperties}>{children}</dl>;
}

export function OpsDetailItem({ label, children, wide = false }: { label: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="ops-detail-item" data-wide={wide || undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function OpsActionMenu({
  label = "Actions",
  align = "end",
  children,
}: {
  label?: ReactNode;
  align?: "start" | "end";
  children: ReactNode;
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" className="ops-button" data-variant="secondary" data-size="sm" aria-haspopup="menu">{label}</button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align={align} sideOffset={6} className="ops-action-menu" role="menu">
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function OpsActionMenuItem({ children, onSelect, tone = "neutral" }: { children: ReactNode; onSelect?: () => void; tone?: "neutral" | "danger" }) {
  return <button type="button" role="menuitem" className="ops-action-menu-item" data-tone={tone} onClick={onSelect}>{children}</button>;
}

export function OpsSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx("ops-skeleton", className)} aria-hidden="true">
      {Array.from({ length: Math.max(1, lines) }).map((_, index) => (
        <span key={index} className="ops-skeleton-line"/>
      ))}
    </div>
  );
}
