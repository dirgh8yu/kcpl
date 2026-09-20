import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { OpsKpiCard, OpsKpiStrip } from "./operations-ui";

/*
 * The one KPI strip for the whole product -- staff workspaces and the customer
 * portal both render through it.
 *
 * Before this, every page hand-assembled its own cards: the operations
 * workspaces used <OpsKpiCard> directly with whatever icon size was current
 * when the page was written, live visibility carried a private card component
 * with its own stylesheet, and the command centre drew a third set from a CSS
 * module. Same idea, three shapes. A page now describes its KPIs as data and
 * this component owns how they look.
 */

export type AppKpiTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export type AppKpi = {
  /** Stable identity for the card within its strip. */
  key: string;
  icon: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  /** One short line under the label: what the number means, or what to do about it. */
  detail?: ReactNode;
  tone?: AppKpiTone;
  /**
   * Defaults to "metric" for numbers and "text" for anything else. A money
   * string or a phrase rendered at the metric size overflows the card, because
   * the strip's columns are sized for digits.
   */
  variant?: "metric" | "text";
  /** Filters the page in place. A card either filters or navigates, never both. */
  onSelect?: () => void;
  /** Navigates to the workspace that owns this number. */
  href?: string;
  /** True when this card's filter is the one currently applied. */
  active?: boolean;
  /** Spoken label, when the visible label needs context out of its row. */
  ariaLabel?: string;
};

/** Entries may be conditional, so a page can drop a card without rebuilding the array. */
export type AppKpiItem = AppKpi | null | false | undefined;

export function AppKpiStrip({
  items,
  className,
  tight = false,
}: {
  items: AppKpiItem[];
  className?: string;
  /** Tightens the track so a six-card row stays on one line inside the gutter. */
  tight?: boolean;
}) {
  const cards = items.filter((item): item is AppKpi => Boolean(item));
  if (!cards.length) return null;

  return (
    <OpsKpiStrip className={[tight ? "ops-kpi-strip-tight" : null, className].filter(Boolean).join(" ") || undefined}>
      {cards.map(({ key, icon: Icon, label, value, detail, tone = "neutral", variant, onSelect, href, active, ariaLabel }) => (
        <OpsKpiCard
          key={key}
          label={label}
          value={value}
          detail={detail}
          tone={tone}
          variant={variant ?? (typeof value === "number" ? "metric" : "text")}
          icon={<Icon size={16} aria-hidden="true"/>}
          onClick={onSelect}
          href={href}
          active={active}
          ariaLabel={ariaLabel}
        />
      ))}
    </OpsKpiStrip>
  );
}
