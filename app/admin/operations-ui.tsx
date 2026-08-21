import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Search } from "lucide-react";

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
  title,
  eyebrow,
  description,
  action,
  children,
  className,
  flush = false,
  priority = "normal",
}: {
  title?: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
  priority?: "normal" | "info" | "success" | "warning" | "danger";
}) {
  return (
    <section className={cx("ops-surface", flush && "ops-surface-flush", className)} data-priority={priority}>
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
      <div className={cx("ops-surface-body", flush && "ops-surface-body-flush")}>{children}</div>
    </section>
  );
}

// Compatibility facade for integration panels that were built before the latest
// Operations UI naming pass. Keeping it here prevents API-backed workspaces from
// being disconnected during visual refactors.
export function OpsPanel(props: Parameters<typeof OpsSurface>[0]) {
  return <OpsSurface {...props}/>;
}

export function OpsStatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("ops-stat-strip", className)}>{children}</div>;
}

export function OpsStat({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
  active = false,
  onClick,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  active?: boolean;
  onClick?: () => void;
}) {
  const zero = typeof value === "number" && value === 0;
  const content = (
    <>
      <span className="ops-stat-top"><span className="ops-stat-label">{icon}{label}</span>{active ? <i aria-hidden="true"/> : null}</span>
      <strong className="ops-stat-value">{value}</strong>
      {detail ? <span className="ops-stat-detail">{detail}</span> : null}
    </>
  );
  if (onClick) {
    return <button type="button" onClick={onClick} className="ops-stat" data-tone={tone} data-active={active || undefined} data-zero={zero || undefined}>{content}</button>;
  }
  return <div className="ops-stat" data-tone={tone} data-zero={zero || undefined}>{content}</div>;
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

export function OpsStatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "violet" }) {
  return <OpsBadge tone={tone}>{children}</OpsBadge>;
}

export function OpsSearch({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx("ops-search", className)}>
      <Search size={15} aria-hidden="true"/>
      <input {...props}/>
    </label>
  );
}

export function OpsField({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return <label className={cx("ops-field", className)}><span className="ops-field-label">{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

export function OpsNotice({ children, tone = "neutral", onDismiss }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger"; onDismiss?: () => void }) {
  return <div className="ops-notice" data-tone={tone} role={tone === "danger" ? "alert" : "status"}><span>{children}</span>{onDismiss ? <button type="button" onClick={onDismiss}>Dismiss</button> : null}</div>;
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
  return <div className="m-3 rounded-[12px] border border-[#eadfd4] bg-[#fffaf5] p-4" role={tone === "danger" ? "alert" : "status"}>
    <strong className="block text-[11px] text-[#4b423c]">{title}</strong>
    {detail ? <p className="mt-1 text-[10px] leading-5 text-[#81776f]">{detail}</p> : null}
    {action ? <div className="mt-3">{action}</div> : null}
  </div>;
}

export function OpsButton({
  children,
  variant,
  tone,
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  tone?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const resolvedVariant = variant ?? tone ?? "secondary";
  return <button {...props} className={cx("ops-button", className)} data-variant={resolvedVariant} data-size={size}>{children}</button>;
}

export function OpsMetricStrip({ children, columns = 4 }: { children: ReactNode; columns?: number }) {
  return <div className="grid gap-px bg-[#ece7e2]" style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` }}>{children}</div>;
}

export function OpsMetric({ icon, label, value, detail }: { icon?: ReactNode; label: ReactNode; value: ReactNode; detail?: ReactNode }) {
  return <div className="bg-white p-3.5">
    <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.08em] text-[#8f857d]">{icon}{label}</div>
    <div className="mt-1.5 text-[17px] font-[720] tracking-[-.03em] text-[#3b342f]">{value}</div>
    {detail ? <div className="mt-1 text-[9px] text-[#91877f]">{detail}</div> : null}
  </div>;
}

export function OpsMono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("ops-mono", className)}>{children}</span>;
}

export function OpsProgress({ value, max = 100, tone = "accent", label }: { value: number; max?: number; tone?: "accent" | "success" | "warning" | "danger"; label?: string }) {
  const ratio = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <div className="ops-progress" data-tone={tone} aria-label={label} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{ width: `${ratio}%` }}/></div>;
}
