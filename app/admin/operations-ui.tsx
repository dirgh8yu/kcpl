import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  PackageOpen,
} from "lucide-react";

type BreadcrumbItem = { label: string; href?: string };

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "border-[#e2e5e9] bg-[#f6f7f8] text-[#5f6872]",
  info: "border-[#d8e3f4] bg-[#f3f7fd] text-[#3b5f91]",
  success: "border-[#d8e9df] bg-[#f2f8f4] text-[#397052]",
  warning: "border-[#eadfca] bg-[#fbf7ef] text-[#8a6734]",
  danger: "border-[#ecd8da] bg-[#fbf3f4] text-[#9a4d55]",
  accent: "border-[#dce0fa] bg-[#f4f5fd] text-[#4a58a8]",
};

export function OpsPageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs = [],
  actions,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="ops-page-header">
      <div className="ops-page-shell">
        {breadcrumbs.length ? (
          <nav aria-label="Breadcrumb" className="ops-breadcrumb">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
                {index > 0 ? <span aria-hidden="true" className="text-[#b0b5bc]">/</span> : null}
                {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? <p className="ops-eyebrow">{eyebrow}</p> : null}
            <h1 className="ops-title">{title}</h1>
            {description ? <p className="ops-copy mt-1.5 max-w-3xl">{description}</p> : null}
            {meta ? <div className="mt-2 text-[11px] text-[#7c848d]">{meta}</div> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}

export function OpsButton({
  children,
  href,
  tone = "secondary",
  className = "",
  ...buttonProps
}: {
  children: ReactNode;
  href?: string;
  tone?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = `ops-button ops-button-${tone} ${className}`.trim();
  if (href) return <Link href={href} className={classes}>{children}</Link>;
  return <button className={classes} {...buttonProps}>{children}</button>;
}

export function OpsStatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold leading-none ${toneClasses[tone]}`}>{children}</span>;
}

export function OpsMetricStrip({ children, columns = 6 }: { children: ReactNode; columns?: number }) {
  return <section className="ops-metric-strip" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{children}</section>;
}

export function OpsMetric({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  active = false,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
}) {
  const inner = <>
    <div className="flex items-center gap-2 text-[10px] font-semibold text-[#717983]">{icon}<span>{label}</span></div>
    <div className="mt-2 flex items-end justify-between gap-2">
      <strong className={`text-[22px] font-semibold tracking-[-.04em] ${tone === "danger" ? "text-[#9a4d55]" : tone === "warning" ? "text-[#8a6734]" : tone === "success" ? "text-[#397052]" : "text-[#1b1f24]"}`}>{value}</strong>
      {hint ? <span className="text-[10px] text-[#9aa0a7]">{hint}</span> : null}
    </div>
  </>;
  if (onClick) return <button type="button" onClick={onClick} className={`ops-metric text-left ${active ? "is-active" : ""}`}>{inner}</button>;
  return <div className={`ops-metric ${active ? "is-active" : ""}`}>{inner}</div>;
}

export function OpsPanel({
  title,
  eyebrow,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return <section className={`ops-panel ${className}`.trim()}>
    {title || eyebrow || action || description ? <div className="ops-panel-header">
      <div className="min-w-0">
        {eyebrow ? <p className="ops-eyebrow">{eyebrow}</p> : null}
        {title ? <h2 className="text-sm font-semibold tracking-[-.015em] text-[#23272d]">{title}</h2> : null}
        {description ? <p className="mt-1 text-[11px] leading-5 text-[#7c848d]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div> : null}
    {children}
  </section>;
}

export function OpsTableFrame({ children, toolbar, footer }: { children: ReactNode; toolbar?: ReactNode; footer?: ReactNode }) {
  return <section className="ops-table-frame">
    {toolbar ? <div className="ops-table-toolbar">{toolbar}</div> : null}
    <div className="overflow-x-auto">{children}</div>
    {footer ? <div className="ops-table-footer">{footer}</div> : null}
  </section>;
}

export function OpsFilterBar({ children, count, reset }: { children: ReactNode; count?: ReactNode; reset?: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    {count !== undefined || reset ? <div className="ml-auto flex items-center gap-2 text-[11px] text-[#7c848d]">{count}{reset}</div> : null}
  </div>;
}

export function OpsEmptyState({
  title,
  detail,
  action,
  compact = false,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return <div className={`flex flex-col items-center justify-center text-center ${compact ? "px-5 py-7" : "px-6 py-12"}`}>
    <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#e3e6e9] bg-[#f7f8f8] text-[#8d949c]"><PackageOpen size={16}/></span>
    <p className="mt-3 text-xs font-semibold text-[#424950]">{title}</p>
    {detail ? <p className="mt-1 max-w-md text-[11px] leading-5 text-[#858c94]">{detail}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>;
}

export function OpsErrorState({
  title = "Unable to load this information",
  detail,
  action,
  tone = "danger",
}: {
  title?: string;
  detail?: string;
  action?: ReactNode;
  tone?: "danger" | "warning";
}) {
  const Icon = tone === "danger" ? CircleAlert : AlertTriangle;
  return <div className={`m-4 flex items-start gap-3 rounded-lg border px-3.5 py-3 ${tone === "danger" ? "border-[#ecd8da] bg-[#fbf3f4]" : "border-[#eadfca] bg-[#fbf7ef]"}`}>
    <Icon size={15} className={`mt-0.5 shrink-0 ${tone === "danger" ? "text-[#a6535c]" : "text-[#98703a]"}`}/>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-[#34393f]">{title}</p>
      {detail ? <p className="mt-1 text-[11px] leading-5 text-[#747c84]">{detail}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>;
}

export function OpsSuccessState({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 px-4 py-4 text-[11px] text-[#4b6e5a]"><CheckCircle2 size={14}/>{children}</div>;
}

export function OpsInfoLine({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-2 text-[11px] leading-5 text-[#747c84]"><Info size={13} className="mt-1 shrink-0 text-[#778bbd]"/>{children}</div>;
}

export function OpsSkeletonRows({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return <div className="divide-y divide-[#eceef0]">{Array.from({ length: rows }).map((_, row) => <div key={row} className="grid gap-4 px-4 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{Array.from({ length: columns }).map((__, column) => <span key={column} className="h-3 animate-pulse rounded bg-[#eceef0]"/>)}</div>)}</div>;
}
