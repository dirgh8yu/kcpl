"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { OpsDialog } from "./operations-ui";
import { useAdminPortalContainer } from "./use-admin-portal-container";
import { shortcutAction, type ShortcutHub } from "./staff-shortcuts-policy";

/*
 * Keyboard shortcuts for people who live in KCPL all day. They never fire
 * while someone is typing or inside a dialog, never take a key that has a
 * modifier (the browser's own shortcuts stay theirs), and never animate:
 * a keyboard action lands immediately.
 */

const ROW_SELECTOR = "#workspace-content :is(table tbody tr, .alerts-row, .enq-row, .notifications-row)";
const SEARCH_SELECTOR = "#workspace-content :is(input[type=\"search\"], .ops-search input, input[aria-label^=\"Search\"])";
const NEW_BUTTON_TEXT = /^\s*(New|Schedule)\b/i;

function visible(element: Element) {
  return element.getClientRects().length > 0;
}

function typingOrInDialog(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (element?.isContentEditable) return true;
  if (element?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='listbox'], [role='menu']")) return true;
  return Boolean(document.querySelector("[role='dialog'][aria-modal='true']"));
}

function rows() {
  return Array.from(document.querySelectorAll<HTMLElement>(ROW_SELECTOR)).filter((row) => visible(row) && !row.querySelector("td[colspan]"));
}

/** j and k walk the list the page is showing; Enter opens the row they land on. */
function moveRow(step: 1 | -1) {
  const list = rows();
  if (!list.length) return;
  const active = document.activeElement;
  const current = list.findIndex((row) => row === active || row.contains(active));
  const index = current === -1 ? (step === 1 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, current + step));
  const next = list[index];
  if (!next.hasAttribute("tabindex") && next.tagName !== "BUTTON") {
    next.setAttribute("tabindex", "-1");
    next.dataset.kbdRow = "true";
  }
  next.focus();
  next.scrollIntoView({ block: "nearest" });
}

function focusPageSearch() {
  const search = Array.from(document.querySelectorAll<HTMLInputElement>(SEARCH_SELECTOR)).find(visible);
  if (!search) return false;
  search.focus();
  search.select();
  return true;
}

/** n presses the page's own "New …" or "Schedule …" button, never anything else. */
function pressNewButton() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("#workspace-content [data-page-actions] :is(a, button)"));
  const button = candidates.find((element) => visible(element) && !element.hasAttribute("disabled") && NEW_BUTTON_TEXT.test(element.textContent ?? ""));
  button?.click();
  return Boolean(button);
}

export function StaffShortcuts({ hubs, paletteOpen, onOpenPalette }: { hubs: ShortcutHub[]; paletteOpen: boolean; onOpenPalette: () => void }) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingGo = useRef(0);
  const container = useAdminPortalContainer();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (paletteOpen || helpOpen) return;
      // Enter on a row that j/k reached opens it through its own link.
      if (event.key === "Enter") {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.dataset.kbdRow === "true") {
          const link = active.querySelector<HTMLAnchorElement>("a[href]");
          if (link) {
            event.preventDefault();
            link.click();
          }
        }
        return;
      }
      if (typingOrInDialog(event.target)) return;
      const action = shortcutAction(event.key, pendingGo.current, Date.now(), hubs);
      pendingGo.current = action.pendingGo;
      if (action.kind === "none") return;
      event.preventDefault();
      if (action.kind === "go") router.push(action.href);
      else if (action.kind === "search") { if (!focusPageSearch()) onOpenPalette(); }
      else if (action.kind === "help") setHelpOpen(true);
      else if (action.kind === "next") moveRow(1);
      else if (action.kind === "previous") moveRow(-1);
      else if (action.kind === "new") pressNewButton();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [helpOpen, hubs, onOpenPalette, paletteOpen, router]);

  const goRows = hubs.filter((hub) => hub.key);
  return (
    <OpsDialog.Root open={helpOpen} onOpenChange={setHelpOpen}>
      <OpsDialog.Portal container={container ?? undefined}>
        <OpsDialog.Overlay className="ops-shortcuts-overlay"/>
        <OpsDialog.Content className="ops-shortcuts" aria-describedby={undefined}>
          <header className="ops-shortcuts-head">
            <OpsDialog.Title>Keyboard shortcuts</OpsDialog.Title>
            <OpsDialog.Close className="ops-shortcuts-close" aria-label="Close"><X size={15} strokeWidth={1.75} aria-hidden="true"/></OpsDialog.Close>
          </header>
          <dl className="ops-shortcuts-list">
            <div><dt><kbd>⌘</kbd><kbd>K</kbd></dt><dd>Find anything: a shipment, customer, invoice or page</dd></div>
            <div><dt><kbd>/</kbd></dt><dd>Search this page</dd></div>
            <div><dt><kbd>j</kbd><kbd>k</kbd></dt><dd>Next or previous row</dd></div>
            <div><dt><kbd>Enter</kbd></dt><dd>Open that row</dd></div>
            <div><dt><kbd>n</kbd></dt><dd>This page’s New button</dd></div>
            {goRows.map((hub) => <div key={hub.id}><dt><kbd>g</kbd><kbd>{hub.key}</kbd></dt><dd>Go to {hub.label}</dd></div>)}
            <div><dt><kbd>?</kbd></dt><dd>Show this list</dd></div>
          </dl>
          <p className="ops-shortcuts-foot">Shortcuts wait while you’re typing in a box.</p>
        </OpsDialog.Content>
      </OpsDialog.Portal>
    </OpsDialog.Root>
  );
}
