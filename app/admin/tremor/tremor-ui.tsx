import Link from "next/link";
import React from "react";

// KCPL-adapted Tremor Raw primitives.
// Component anatomy follows Tremor Raw v1.0.0 (Apache-2.0), while KCPL owns
// colour, typography and product semantics through the canonical admin tokens.
// Tremor Raw itself is built for Tailwind CSS v4; utilities stay behind this
// component boundary rather than acting as the workspace design API.

type ClassValue = string | false | null | undefined;
type Tone = "default" | "neutral" | "accent" | "success" | "warning" | "danger" | "info";
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

function cx(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

const toneBorder: Record<Tone, string> = {
  default: "border-[var(--admin-line)]",
  neutral: "border-[var(--admin-line)]",
  accent: "border-[var(--admin-line-strong)]",
  success: "border-[var(--admin-success)]",
  warning: "border-[var(--admin-warning)]",
  danger: "border-[var(--admin-danger)]",
  info: "border-[var(--admin-info)]",
};

const badgeTone: Record<Tone, string> = {
  default: "bg-[var(--admin-info-bg)] text-[var(--admin-info)] ring-[var(--admin-line)]",
  neutral: "bg-[var(--admin-surface-soft)] text-[var(--admin-muted)] ring-[var(--admin-line)]",
  accent: "bg-[var(--admin-danger-bg)] text-[var(--admin-crimson-deep)] ring-[var(--admin-line)]",
  success: "bg-[var(--admin-success-bg)] text-[var(--admin-success)] ring-[var(--admin-line)]",
  warning: "bg-[var(--admin-warning-bg)] text-[var(--admin-warning)] ring-[var(--admin-line)]",
  danger: "bg-[var(--admin-danger-bg)] text-[var(--admin-danger)] ring-[var(--admin-line)]",
  info: "bg-[var(--admin-info-bg)] text-[var(--admin-info)] ring-[var(--admin-line)]",
};

const buttonVariant: Record<ButtonVariant, string> = {
  primary: "border-[var(--admin-crimson)] bg-[var(--admin-crimson)] text-white hover:border-[var(--admin-crimson-dark)] hover:bg-[var(--admin-crimson-dark)]",
  secondary: "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-ink)] hover:border-[var(--admin-line-strong)] hover:bg-[var(--admin-surface-soft)]",
  ghost: "border-transparent bg-transparent text-[var(--admin-muted)] hover:bg-[var(--admin-surface-soft)] hover:text-[var(--admin-ink)]",
  danger: "border-[var(--admin-danger)] bg-[var(--admin-danger)] text-white hover:bg-[var(--admin-crimson-deep)]",
};

const buttonSize: Record<ButtonSize, string> = {
  sm: "min-h-8 px-2.5 text-xs",
  md: "min-h-10 px-3.5 text-sm",
};

export function Workspace({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={cx("ops-page", className)} data-ui-stack="tremor-raw" tremor-id="tremor-raw">
      {children}
    </main>
  );
}

export function WorkspaceHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="border-b border-[var(--admin-line)] bg-[var(--admin-surface)] px-[var(--app-page-gap)] py-5" tremor-id="tremor-raw">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-4xl">
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h1>
          {description ? <div className="mt-1 text-sm leading-5 text-[var(--admin-muted)]">{description}</div> : null}
          {meta ? <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--admin-faint)]">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function WorkspaceBody({ children }: { children: React.ReactNode }) {
  return <div className="px-[var(--app-page-gap)] pb-10 pt-5">{children}</div>;
}

interface CardProps extends React.ComponentPropsWithoutRef<"div"> {
  padding?: "none" | "sm" | "md";
  tone?: Tone;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, padding = "md", tone = "default", ...props },
  forwardedRef,
) {
  const paddingClass = padding === "none" ? "p-0" : padding === "sm" ? "p-4" : "p-5";
  return (
    <div
      ref={forwardedRef}
      className={cx(
        "relative w-full overflow-hidden rounded-lg border bg-[var(--admin-surface)] text-left shadow-xs",
        toneBorder[tone],
        paddingClass,
        className,
      )}
      tremor-id="tremor-raw"
      {...props}
    />
  );
});

export function Panel({
  title,
  description,
  action,
  children,
  tone = "default",
  flush = false,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  tone?: Tone;
  flush?: boolean;
  className?: string;
}) {
  return (
    <Card padding="none" tone={tone} className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-line)] px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold text-[var(--admin-ink)]">{title}</h2>
          {description ? <p className="mb-0 mt-1 text-xs leading-4 text-[var(--admin-muted)]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={flush ? "p-0" : "p-4"}>{children}</div>
    </Card>
  );
}

interface BadgeProps extends React.ComponentPropsWithoutRef<"span"> {
  tone?: Tone;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone = "default", ...props },
  forwardedRef,
) {
  return (
    <span
      ref={forwardedRef}
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        badgeTone[tone],
        className,
      )}
      tremor-id="tremor-raw"
      {...props}
    />
  );
});

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", type = "button", ...props },
  forwardedRef,
) {
  return (
    <button
      ref={forwardedRef}
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md border font-medium no-underline transition-colors disabled:pointer-events-none disabled:opacity-50",
        buttonVariant[variant],
        buttonSize[size],
        className,
      )}
      tremor-id="tremor-raw"
      {...props}
    />
  );
});

export function LinkButton({
  href,
  children,
  variant = "secondary",
  size = "md",
  className,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md border font-medium no-underline transition-colors",
        buttonVariant[variant],
        buttonSize[size],
        className,
      )}
      tremor-id="tremor-raw"
    >
      {children}
    </Link>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--admin-muted)] no-underline hover:bg-[var(--admin-surface-soft)] hover:text-[var(--admin-ink)]"
      tremor-id="tremor-raw"
    >
      {children}
    </Link>
  );
}

const calloutTone: Record<Tone, string> = {
  default: "border-[var(--admin-line)] bg-[var(--admin-surface)] text-[var(--admin-ink)]",
  neutral: "border-[var(--admin-line)] bg-[var(--admin-surface-soft)] text-[var(--admin-ink)]",
  accent: "border-[var(--admin-line-strong)] bg-[var(--admin-surface-soft)] text-[var(--admin-ink)]",
  success: "border-[var(--admin-success)] bg-[var(--admin-success-bg)] text-[var(--admin-success)]",
  warning: "border-[var(--admin-warning)] bg-[var(--admin-warning-bg)] text-[var(--admin-warning)]",
  danger: "border-[var(--admin-danger)] bg-[var(--admin-danger-bg)] text-[var(--admin-danger)]",
  info: "border-[var(--admin-info)] bg-[var(--admin-info-bg)] text-[var(--admin-info)]",
};

export function Callout({
  icon,
  title,
  children,
  tone = "neutral",
  action,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  tone?: Tone;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cx("flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3", calloutTone[tone])}
      tremor-id="tremor-raw"
      role={tone === "danger" ? "alert" : "status"}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <strong className="block text-sm font-semibold text-current">{title}</strong>
        {children ? <div className="mt-0.5 text-xs leading-4 text-[var(--admin-muted)]">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function MetricStrip({ children }: { children: React.ReactNode }) {
  return (
    <Card padding="none" className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      {children}
    </Card>
  );
}

export function MetricLink({
  href,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  href: string;
  label: string;
  value: number;
  detail: string;
  tone?: Exclude<Tone, "default" | "accent" | "success">;
}) {
  const valueClass = value === 0
    ? "text-[var(--admin-faint)]"
    : tone === "danger"
      ? "text-[var(--admin-danger)]"
      : tone === "warning"
        ? "text-[var(--admin-warning)]"
        : tone === "info"
          ? "text-[var(--admin-info)]"
          : "text-[var(--admin-ink)]";

  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}. ${detail}`}
      className="flex min-h-14 min-w-0 items-center justify-between gap-3 border-b border-[var(--admin-line)] px-3 py-2.5 no-underline transition-colors last:border-b-0 hover:bg-[var(--admin-surface-soft)] sm:border-r sm:last:border-r-0 xl:border-b-0"
      tremor-id="tremor-raw"
    >
      <span className={value === 0 ? "truncate text-xs font-medium text-[var(--admin-faint)]" : "truncate text-xs font-medium text-[var(--admin-muted)]"}>{label}</span>
      <strong className={cx("shrink-0 text-base font-semibold tabular-nums", valueClass)}>{value}</strong>
    </Link>
  );
}

export const TableRoot = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function TableRoot(
  { className, children, ...props },
  forwardedRef,
) {
  return (
    <div ref={forwardedRef} className={cx("w-full overflow-auto whitespace-nowrap", className)} {...props}>
      {children}
    </div>
  );
});

export const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(function Table(
  { className, ...props },
  forwardedRef,
) {
  return (
    <table
      ref={forwardedRef}
      className={cx("w-full caption-bottom border-b border-[var(--admin-line)]", className)}
      tremor-id="tremor-raw"
      {...props}
    />
  );
});

export const TableHead = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(function TableHead(
  props,
  forwardedRef,
) {
  return <thead ref={forwardedRef} {...props} />;
});

export const TableHeaderCell = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(function TableHeaderCell(
  { className, ...props },
  forwardedRef,
) {
  return (
    <th
      ref={forwardedRef}
      className={cx("border-b border-[var(--admin-line)] px-4 py-3 text-left text-xs font-medium text-[var(--admin-muted)]", className)}
      {...props}
    />
  );
});

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(function TableBody(
  { className, ...props },
  forwardedRef,
) {
  return <tbody ref={forwardedRef} className={cx("divide-y divide-[var(--admin-line)]", className)} {...props} />;
});

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(function TableRow(
  { className, ...props },
  forwardedRef,
) {
  return <tr ref={forwardedRef} className={cx("hover:bg-[var(--admin-surface-soft)]", className)} {...props} />;
});

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(function TableCell(
  { className, ...props },
  forwardedRef,
) {
  return <td ref={forwardedRef} className={cx("px-4 py-3 text-sm text-[var(--admin-ink)]", className)} {...props} />;
});

type BarListItem<T = unknown> = T & {
  key?: string;
  href?: string;
  value: number;
  name: string;
};

export interface BarListProps<T = unknown> extends React.HTMLAttributes<HTMLDivElement> {
  data: BarListItem<T>[];
  valueFormatter?: (value: number, item: BarListItem<T>) => string;
  sortOrder?: "ascending" | "descending" | "none";
}

function BarListInner<T>(
  {
    data = [],
    valueFormatter = (value) => value.toString(),
    sortOrder = "descending",
    className,
    ...props
  }: BarListProps<T>,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const sortedData = React.useMemo(() => {
    if (sortOrder === "none") return data;
    return [...data].sort((a, b) => sortOrder === "ascending" ? a.value - b.value : b.value - a.value);
  }, [data, sortOrder]);

  const maxValue = Math.max(...sortedData.map((item) => item.value), 0);

  return (
    <div ref={forwardedRef} className={cx("space-y-2", className)} aria-sort={sortOrder} tremor-id="tremor-raw" {...props}>
      {sortedData.map((item) => {
        const width = item.value === 0 || maxValue === 0 ? 0 : Math.max((item.value / maxValue) * 100, 3);
        const row = (
          <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="relative h-9 overflow-hidden rounded-md bg-[var(--admin-surface-soft)]">
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-[var(--admin-danger-bg)] transition-[width] duration-300"
                style={{ width: `${width}%` }}
                aria-hidden="true"
              />
              <span className="relative z-10 flex h-full items-center truncate px-3 text-sm font-medium text-[var(--admin-ink)]">{item.name}</span>
            </div>
            <span className="min-w-20 text-right text-sm font-semibold tabular-nums text-[var(--admin-ink)]">{valueFormatter(item.value, item)}</span>
          </div>
        );

        return item.href ? (
          <Link key={item.key ?? item.name} href={item.href} className="block rounded-md no-underline hover:opacity-80">
            {row}
          </Link>
        ) : (
          <div key={item.key ?? item.name}>{row}</div>
        );
      })}
    </div>
  );
}

BarListInner.displayName = "BarList";

export const BarList = React.forwardRef(BarListInner) as <T>(
  props: BarListProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof BarListInner>;
