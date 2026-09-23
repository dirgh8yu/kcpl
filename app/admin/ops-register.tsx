"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, GripVertical, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useAdminPortalContainer } from "./use-admin-portal-container";

/*
 * Register primitives shared by the operational workspaces (Shipments set the
 * benchmark; Pickup Scheduling and Freight Documents consume these). They are
 * presentation only: every value, count and filter change comes from the
 * calling workspace, so adopting them never changes filtering semantics.
 * Styles live in operations-system.css under "Register primitives".
 */

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

/** One flat metric rail with hairline separators, in place of floating KPI cards. */
export function OpsKpiRail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={cx("ops-kpi-rail", className)} role="group" aria-label={label}>{children}</div>;
}

/**
 * A rail segment. With `onClick` it becomes a scope control (aria-pressed) that
 * reuses the workspace's own filter; without it, it is a plain statistic.
 * Tone colours the value only, and zeros recede.
 */
export function OpsRailMetric({
  label,
  value,
  detail,
  tone = "neutral",
  active = false,
  onClick,
  title,
}: {
  label: string;
  /** Counts render large; a word or short phrase ("Not set", "Released") renders at text size. */
  value: number | string;
  detail?: ReactNode;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const body = (
    <>
      <span className="ops-rail-label">{label}</span>
      <span className="ops-rail-value-row">
        <strong className="ops-rail-value">{value}</strong>
        {detail ? <span className="ops-rail-detail">{detail}</span> : null}
      </span>
    </>
  );
  const shared = { "data-tone": tone, "data-zero": value === 0 || undefined, "data-text": typeof value === "string" || undefined, title };
  if (onClick) {
    return <button type="button" className="ops-rail-metric" {...shared} data-active={active || undefined} aria-pressed={active} onClick={onClick}>{body}</button>;
  }
  return <div className="ops-rail-metric" {...shared}>{body}</div>;
}

export type OpsScopeItem<T extends string> = { value: T; label: string; count?: number };

/** Text-led status scopes: a quiet surface marks the active scope, the count stays secondary. */
export function OpsScopeTabs<T extends string>({ label, items, value, onChange }: { label: string; items: Array<OpsScopeItem<T>>; value: T; onChange: (value: T) => void }) {
  return (
    <div className="ops-scope-tabs" role="group" aria-label={label}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button key={item.value} type="button" className="ops-scope-tab" data-active={active || undefined} aria-pressed={active} onClick={() => onChange(item.value)}>
            {item.label}
            {typeof item.count === "number" ? <span className="ops-scope-count">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Search left, controls right, scopes on their own row: one flat operating row, not a control card. */
export function OpsRegisterToolbar({ search, actions, tabs, className }: { search: ReactNode; actions?: ReactNode; tabs?: ReactNode; className?: string }) {
  return (
    <div className={cx("ops-register-toolbar", className)}>
      <div className="ops-register-toolbar-search">{search}</div>
      {actions ? <div className="ops-register-toolbar-actions">{actions}</div> : null}
      {tabs ? <div className="ops-register-toolbar-tabs">{tabs}</div> : null}
    </div>
  );
}

export type OpsFilterOption = { value: string; label: string };

/** Arrow keys move between the options of a popover list; Home/End jump. */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-option]"));
  if (!items.length) return;
  event.preventDefault();
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === "Home" ? 0
    : event.key === "End" ? items.length - 1
      : event.key === "ArrowDown" ? (index + 1) % items.length
        : (index - 1 + items.length) % items.length;
  items[next]?.focus();
}

/**
 * A compact single-select filter: a quiet trigger that opens an option list.
 * Selecting applies immediately (the same as the native select it replaces)
 * and closes the list. `showValue` renders the chosen label in the trigger,
 * for controls such as rows-per-page that have no "all" state.
 */
export function OpsFilterSelect({
  label,
  value,
  options,
  onChange,
  allValue = "all",
  allLabel,
  showValue = false,
  align = "start",
  icon,
}: {
  label: string;
  value: string;
  options: OpsFilterOption[];
  onChange: (value: string) => void;
  allValue?: string | null;
  allLabel?: string;
  showValue?: boolean;
  align?: "start" | "end";
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const container = useAdminPortalContainer();
  const listRef = useRef<HTMLDivElement>(null);
  const choices = allValue === null ? options : [{ value: allValue, label: allLabel ?? "All" }, ...options];
  const current = choices.find((option) => option.value === value);
  const active = allValue !== null && value !== allValue;
  const triggerText = showValue ? current?.label ?? label : label;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="ops-filter-trigger"
          data-active={active || undefined}
          aria-label={active || showValue ? `${label}: ${current?.label ?? value}` : `Filter by ${label.toLowerCase()}`}
        >
          {icon}
          <span className="ops-filter-trigger-label">{triggerText}</span>
          {active && !showValue ? <span className="ops-filter-trigger-dot" aria-hidden="true"/> : null}
          <ChevronDown size={14} strokeWidth={1.75} className="ops-filter-trigger-chevron" aria-hidden="true"/>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container ?? undefined}>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className="ops-filter-options"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const target = listRef.current?.querySelector<HTMLButtonElement>("[data-option][aria-checked='true']") ?? listRef.current?.querySelector<HTMLButtonElement>("[data-option]");
            target?.focus();
          }}
        >
          <div ref={listRef} role="menu" aria-label={label} tabIndex={-1} onKeyDown={moveFocus}>
            {choices.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  data-option
                  className="ops-filter-option"
                  onClick={() => { onChange(option.value); setOpen(false); }}
                >
                  <Check size={14} strokeWidth={1.75} className="ops-filter-option-check" aria-hidden="true"/>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * The "Filters" command surface for less-used criteria. Changes inside apply
 * immediately; Clear drops only what the menu edits and Done just closes it,
 * matching the Shipments register.
 */
export function OpsFilterMenu({ count, onClear, children, label = "Filters" }: { count: number; onClear: () => void; children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const container = useAdminPortalContainer();
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" className="ops-filter-trigger" data-active={count > 0 || undefined} aria-label={count ? `${label}, ${count} active` : label}>
          <SlidersHorizontal size={14} strokeWidth={1.75} aria-hidden="true"/>
          <span className="ops-filter-trigger-label">{label}</span>
          {count ? <span className="ops-filter-count">{count}</span> : null}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container ?? undefined}>
        <PopoverPrimitive.Content align="end" sideOffset={6} collisionPadding={12} className="ops-filter-menu">
          <div className="ops-filter-menu-head">
            <strong>{label}</strong>
            {count ? <button type="button" className="ops-filter-menu-clear" onClick={onClear}>Clear</button> : null}
          </div>
          {children}
          <div className="ops-filter-menu-foot">
            <button type="button" className="ops-filter-menu-done" onClick={() => setOpen(false)}>Done</button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** A labelled group of mutually exclusive choices inside an OpsFilterMenu. */
export function OpsFilterChoices({ label, value, options, onChange }: { label: string; value: string; options: OpsFilterOption[]; onChange: (value: string) => void }) {
  return (
    <div className="ops-filter-menu-field" role="group" aria-label={label}>
      <span className="ops-filter-menu-label">{label}</span>
      <div className="ops-filter-choices">
        {options.map((option) => {
          const selected = option.value === value;
          return <button key={option.value} type="button" className="ops-filter-choice" data-active={selected || undefined} aria-pressed={selected} onClick={() => onChange(option.value)}>{option.label}</button>;
        })}
      </div>
    </div>
  );
}

export type OpsJumpOption = { value: string; label: string; detail?: string };

/**
 * A quiet "open record" control for the page header: the trigger opens a
 * filterable list and hands the chosen record back (Partner 360 and similar).
 * It replaces the full-width native-select bands above the older workspaces.
 * Typing filters, arrow keys move into the list, Enter opens the first match.
 */
export function OpsJumpMenu({ label, placeholder, options, onSelect, icon, emptyLabel = "No matching records" }: { label: string; placeholder: string; options: OpsJumpOption[]; onSelect: (value: string) => void; icon?: ReactNode; emptyLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const container = useAdminPortalContainer();
  const listRef = useRef<HTMLDivElement>(null);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = terms.length ? options.filter((option) => {
    const haystack = `${option.label} ${option.detail ?? ""} ${option.value}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  }) : options;
  function choose(value: string) { setOpen(false); setQuery(""); onSelect(value); }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" className="ops-filter-trigger ops-jump-trigger" aria-haspopup="dialog">
          {icon}
          <span className="ops-filter-trigger-label">{label}</span>
          <ChevronDown size={14} strokeWidth={1.75} className="ops-filter-trigger-chevron" aria-hidden="true"/>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container ?? undefined}>
        <PopoverPrimitive.Content align="end" sideOffset={6} collisionPadding={12} className="ops-filter-options ops-jump-menu" aria-label={label}>
          <label className="ops-jump-search">
            <Search size={14} strokeWidth={1.75} aria-hidden="true"/>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") { event.preventDefault(); listRef.current?.querySelector<HTMLButtonElement>("[data-option]")?.focus(); }
                if (event.key === "Enter" && matches[0]) { event.preventDefault(); choose(matches[0].value); }
              }}
            />
          </label>
          <div ref={listRef} className="ops-jump-list" role="menu" aria-label={label} tabIndex={-1} onKeyDown={moveFocus}>
            {matches.length ? matches.map((option) => (
              <button key={option.value} type="button" role="menuitem" data-option className="ops-filter-option" onClick={() => choose(option.value)}>
                <span className="ops-jump-option-label">{option.label}</span>
                {option.detail ? <span className="ops-jump-option-detail ops-mono">{option.detail}</span> : null}
              </button>
            )) : <p className="ops-jump-empty">{emptyLabel}</p>}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export type OpsActiveFilter = { key: string; label: string; title?: string; onRemove: () => void };

/** Removable chips for every active filter, with one reset for the whole view. */
export function OpsActiveFilters({ chips, onReset, resetLabel = "Reset all" }: { chips: OpsActiveFilter[]; onReset?: () => void; resetLabel?: string }) {
  if (!chips.length) return null;
  return (
    <div className="ops-active-filters" role="group" aria-label="Active filters">
      {chips.map((chip) => (
        <button key={chip.key} type="button" className="ops-active-chip" onClick={chip.onRemove} title={`Remove filter: ${chip.title ?? chip.label}`} aria-label={`Remove filter: ${chip.title ?? chip.label}`}>
          {chip.label}
          <X size={12} strokeWidth={1.75} aria-hidden="true"/>
        </button>
      ))}
      {onReset ? <button type="button" className="ops-active-reset" onClick={onReset}>{resetLabel}</button> : null}
    </div>
  );
}

/** A compact one-line summary that supports the queue instead of dominating it. */
export function OpsInlineAlert({ tone = "warning", icon, children, actions }: { tone?: Tone; icon?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ops-inline-alert" data-tone={tone} role="status">
      {icon ? <span className="ops-inline-alert-icon">{icon}</span> : null}
      <span className="ops-inline-alert-copy">{children}</span>
      {actions ? <span className="ops-inline-alert-actions">{actions}</span> : null}
    </div>
  );
}

/** Record-inspector header: mono kicker, title, one supporting line, then badge and close. */
export function OpsInspectorHeader({ kicker, title, subtitle, actions }: { kicker?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="ops-inspector-header">
      <div className="ops-inspector-heading">
        {kicker ? <p className="ops-inspector-kicker">{kicker}</p> : null}
        <h2>{title}</h2>
        {subtitle ? <p className="ops-inspector-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ops-inspector-header-actions">{actions}</div> : null}
    </header>
  );
}

/** A hairline-separated inspector section with a quiet uppercase label. */
export function OpsInspectorSection({ title, action, children, className, tinted = false }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string; tinted?: boolean }) {
  return (
    <section className={cx("ops-inspector-section", className)} data-tinted={tinted || undefined}>
      <div className="ops-inspector-section-head">
        <h3>{title}</h3>
        {action ? <div className="ops-inspector-section-action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Definition-list fact rows: quiet label column, strong value. */
export function OpsFacts({ children, columns = 1 }: { children: ReactNode; columns?: 1 | 2 }) {
  return <dl className="ops-facts" data-columns={columns}>{children}</dl>;
}

export function OpsFact({ label, children, warning = false }: { label: ReactNode; children: ReactNode; warning?: boolean }) {
  return <div className="ops-fact"><dt>{label}</dt><dd data-warning={warning || undefined}>{children}</dd></div>;
}

/** A left-ruled note for exceptions or attention inside an inspector. */
export function OpsInspectorNote({ tone = "danger", icon, title, children }: { tone?: Tone; icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="ops-inspector-note" data-tone={tone}>
      {icon}
      <div><strong>{title}</strong>{children ? <span>{children}</span> : null}</div>
    </div>
  );
}

/* ── Workspace layout customise row ────────────────────────────────────── */

export type CustomiseRowPreset = {
  id: string;
  label: string;
  description: string;
  layout: { order: string[]; hidden: string[] };
};

/**
 * Shared "Customise" toolbar row for arrangeable workspaces: toggles arrange
 * mode, offers per-workspace layout presets, show/hide checkboxes, and reset.
 * Status strings come from useStaffArrangement.
 */
export function CustomiseRow({
  arranging,
  onToggle,
  arrangeMenu,
  onToggleMenu,
  arrangement,
  presets,
  activePreset,
  applyPreset,
  onReset,
  status,
  saved = [],
  onSaveCurrent,
  onDeleteSaved,
  savedMatchId,
  onApplySaved,
}: {
  arranging: boolean;
  onToggle: () => void;
  arrangeMenu: boolean;
  onToggleMenu: () => void;
  arrangement: { order: string[]; hidden: string[] };
  presets: readonly CustomiseRowPreset[];
  activePreset: string | null;
  applyPreset: (preset: CustomiseRowPreset) => void;
  onReset: () => void;
  status: "idle" | "saving" | "saved" | "error";
  // Used by the sibling CustomiseMenu; the row itself does not render labels.
  sectionLabels?: Record<string, string>;
  saved?: readonly { id: string; name: string; order: string[]; hidden: string[] }[];
  onSaveCurrent?: (name: string) => void;
  onDeleteSaved?: (id: string) => void;
  savedMatchId?: string | null;
  /** Applies a saved layout; defaults to applying it as a plain layout. */
  onApplySaved?: (layout: { id: string; name: string; order: string[]; hidden: string[] }) => void;
}) {
  // The save field only appears when the current arrangement is not already a
  // saved layout — there is nothing new to capture in that case.
  const currentLayoutSaved = savedMatchId != null;

  // Saving a layout is an occasional, explicit user action — the "Saved" cue
  // is Feedback (the interface confirming the write), not decoration. It
  // announces politely for screen readers, then fades out after a beat.
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 2400);
    return () => clearTimeout(timer);
  }, [justSaved]);

  return (
    <div className="ops-customise-row">
      <button
        type="button"
        className="ops-button"
        data-variant="secondary"
        data-size="sm"
        aria-pressed={arranging}
        onClick={onToggle}
      >
        <GripVertical size={14} strokeWidth={1.75} aria-hidden="true"/>
        {arranging ? "Done" : "Customise"}
      </button>
      {arranging ? (
        <>
          <span className="ops-customise-hint">Drag a section by its handle, or press Alt + ↑/↓ on a focused handle.</span>
          <div className="ops-preset-group" role="group" aria-label="Layout presets">
            {presets.map((preset) => {
              const isCurrent = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className="ops-preset-button"
                  aria-pressed={isCurrent}
                  title={preset.description}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                  {isCurrent ? <span className="ops-preset-dot" aria-hidden="true"/> : null}
                </button>
              );
            })}
            {saved.map((layout) => {
              const isCurrent = savedMatchId === layout.id;
              return (
                <button
                  key={layout.id}
                  type="button"
                  className="ops-preset-button"
                  aria-pressed={isCurrent}
                  title={`Your saved layout: ${layout.name}`}
                  onClick={() => onApplySaved?.(layout)}
                >
                  {layout.name}
                  {isCurrent ? <span className="ops-preset-dot" aria-hidden="true"/> : null}
                  {onDeleteSaved ? (
                    <span
                      role="button"
                      tabIndex={-1}
                      className="ops-preset-remove"
                      aria-label={`Delete saved layout ${layout.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteSaved(layout.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          onDeleteSaved(layout.id);
                        }
                      }}
                    >
                      <X size={10} strokeWidth={2} aria-hidden="true"/>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {onSaveCurrent && !currentLayoutSaved ? (
            <form
              className="ops-preset-save"
              data-saved-flash={justSaved ? "true" : undefined}
              onSubmit={(event) => {
                event.preventDefault();
                const input = event.currentTarget.elements.namedItem("layout-name");
                if (input instanceof HTMLInputElement && input.value.trim()) {
                  onSaveCurrent(input.value);
                  input.value = "";
                  setJustSaved(true);
                }
              }}
            >
              <input name="layout-name" maxLength={24} required placeholder="Save current as…" aria-label="Name for this layout"/>
              <button type="submit" className="ops-button" data-variant="secondary" data-size="sm">Save</button>
              {justSaved ? <span className="ops-preset-saved-cue" role="status"><Check size={12} strokeWidth={2} aria-hidden="true"/> Saved</span> : null}
            </form>
          ) : null}
          <button
            type="button"
            className="ops-button"
            data-variant="secondary"
            data-size="sm"
            aria-expanded={arrangeMenu}
            onClick={onToggleMenu}
          >
            Show / hide
          </button>
          {arrangement.hidden.length > 0 || activePreset == null ? (
            <button
              type="button"
              className="ops-button"
              data-variant="secondary"
              data-size="sm"
              onClick={onReset}
            >
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true"/> Reset
            </button>
          ) : null}
          {status === "saving" ? <span className="ops-customise-status">Saving…</span> : null}
          {status === "saved" ? <span className="ops-customise-status">Saved</span> : null}
          {status === "error" ? <span className="ops-customise-status" data-error>Couldn’t save — your layout stays on this device</span> : null}
        </>
      ) : null}
    </div>
  );
}

/** Show/hide checkbox strip (rendered under the customise row while arranging). */
export function CustomiseMenu({
  open,
  arrangement,
  onToggle,
  sectionLabels,
}: {
  open: boolean;
  arrangement: { order: string[]; hidden: string[] };
  onToggle: (id: string) => void;
  sectionLabels: Record<string, string>;
}) {
  if (!open) return null;
  return (
    <div className="ops-customise-menu" role="group" aria-label="Show or hide sections">
      {arrangement.order.map((id) => {
        const hidden = arrangement.hidden.includes(id);
        return (
          <label key={id} className="ops-customise-item">
            <input type="checkbox" checked={!hidden} onChange={() => onToggle(id)}/>
            <span>{sectionLabels[id] ?? id}</span>
          </label>
        );
      })}
    </div>
  );
}
