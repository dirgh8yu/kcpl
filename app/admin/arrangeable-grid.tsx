"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  moveSection,
  sectionDndId,
  type ArrangementState,
  type WorkspaceKey,
} from "@/app/admin/operations-arrangeable";

export type ArrangeableGridProps<SectionId extends string = string> = {
  workspace: WorkspaceKey;
  state: ArrangementState;
  onChange: (next: ArrangementState) => void;
  children: (id: SectionId, handlers: ArrangeableChildHandlers) => React.ReactNode;
  className?: string;
  arranging: boolean;
};

export type ArrangeableChildHandlers = {
  handleProps: {
    draggable: boolean;
    onDragStart: (event: React.DragEvent<HTMLElement>) => void;
    onDragEnd: (event: React.DragEvent<HTMLElement>) => void;
  };
  hidden: boolean;
};

const HOVER_SHIFT_MS = 140;
const FLIP_DURATION_MS = 200;
const FLIP_EASING_FALLBACK = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Flat arrangeable grid. Drag a section onto another section to move it before
 * that target; hovering a target for a beat shifts the dragged section so the
 * user can climb across the grid in one drag. Every order change (drop,
 * hover-shift, keyboard move, preset apply) reflows with a short FLIP
 * transition driven by WAAPI: positions are measured before each order-changing
 * commit, so an interrupted transition continues from where the eye is.
 * Keyboard parity: focus a handle and press Alt+ArrowUp / Alt+ArrowDown to move
 * the section; H toggles its visibility while arranging. Columns come from CSS:
 * two columns for the Overview grid, one full-width column for registers.
 */
export function ArrangeableGrid<SectionId extends string = string>({ workspace, state, onChange, children, className, arranging }: ArrangeableGridProps<SectionId>) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const lastRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const lastOrderKeyRef = useRef<string>("");
  const [draggingId, setDraggingId] = useState<SectionId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<SectionId | null>(null);
  const [dropBefore, setDropBefore] = useState(false);
  const [hoverShift, setHoverShift] = useState<{ from: SectionId; to: SectionId } | null>(null);

  // Hovering over a target for a beat shifts the dragged section before it, so
  // the user can climb across the grid in one drag. Modelled as state + effect
  // (no refs during render) so the drag state stays render-pure.
  useEffect(() => {
    if (!hoverShift) return;
    const timer = setTimeout(() => {
      onChange({ ...state, order: moveSection(state.order, hoverShift.from, hoverShift.to) });
      setHoverShift(null);
    }, HOVER_SHIFT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [hoverShift, onChange, state]);

  // FLIP: after every commit, measure the settled positions. When the order key
  // changed since the previous commit, animate each item from where it was
  // measured last commit to where it is now. Measuring with in-flight animations
  // still applied means an interrupted reflow starts from the visual position,
  // never snaps. Keyboard moves and preset applies go through the parent's state,
  // so they animate through the same path — no per-handler wiring.
  useLayoutEffect(() => {
    const container = gridRef.current;
    if (!container) return;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>(".ops-arrange-item"));
    const measured = nodes
      .map((node) => ({ node, id: node.dataset.section ?? "", rect: node.getBoundingClientRect() }))
      .filter((entry) => entry.id !== "");
    const freshRects = new Map(measured.map((entry) => [entry.id, entry.rect]));
    const orderKey = state.order.join("|");
    const orderChanged = lastOrderKeyRef.current !== orderKey;
    const previousRects = lastRectsRef.current;
    lastOrderKeyRef.current = orderKey;
    lastRectsRef.current = freshRects;
    if (!orderChanged || !previousRects || previousRects.size === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const easing =
      window.getComputedStyle(container).getPropertyValue("--app-ease-out").trim() || FLIP_EASING_FALLBACK;
    for (const { node, id, rect } of measured) {
      const before = previousRects.get(id);
      if (!before) continue;
      const dx = before.left - rect.left;
      const dy = before.top - rect.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      // Cancel any in-flight FLIP on this node first: the new measurement above
      // already captured the mid-flight position, so the eye never jumps.
      for (const animation of node.getAnimations()) animation.cancel();
      node.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
        { duration: FLIP_DURATION_MS, easing },
      );
    }
  }, [state.order]);

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>, target: SectionId) => {
      if (!draggingId || target === draggingId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = event.currentTarget.getBoundingClientRect();
      setDropBefore(event.clientY < rect.top + rect.height / 2);
      setDropTargetId(target);
      setHoverShift((current) => (current?.to === target && current.from === draggingId ? current : { from: draggingId, to: target }));
    },
    [draggingId],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, target: SectionId) => {
      event.preventDefault();
      setHoverShift(null);
      if (!draggingId || target === draggingId) {
        setDropTargetId(null);
        return;
      }
      onChange({ ...state, order: moveSection(state.order, draggingId, target) });
      setDropTargetId(null);
    },
    [draggingId, onChange, state],
  );

  const visible = state.order.filter((id) => !state.hidden.includes(id));

  return (
    <div
      ref={gridRef}
      className={className ? `ops-arrange-grid ${className}` : "ops-arrange-grid"}
      data-arranging={arranging || undefined}
      data-arrange-workspace={workspace}
    >
      {state.order.map((rawId) => {
        // The layout spec stores plain strings so a layout document never embeds
        // a workspace's type union; the render prop re-types it at this boundary.
        const id = rawId as SectionId;
        const hidden = state.hidden.includes(id);
        return (
          <div
            key={id}
            className="ops-arrange-item"
            data-section={id}
            data-dragging={draggingId === id || undefined}
            data-drop-target={dropTargetId === id || undefined}
            data-drop-before={dropTargetId === id && dropBefore ? "true" : dropTargetId === id ? "false" : undefined}
            data-hidden={hidden || undefined}
            onDragOver={(event) => handleDragOver(event, id)}
            onDrop={(event) => handleDrop(event, id)}
            onDragLeave={() => {
              setDropTargetId((current) => (current === id ? null : current));
            }}
          >
            {children(id, {
              handleProps: {
                draggable: true,
                onDragStart: (event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", sectionDndId(workspace, id));
                  setDraggingId(id);
                },
                onDragEnd: () => {
                  setDraggingId(null);
                  setDropTargetId(null);
                  setHoverShift(null);
                },
              },
              hidden,
            })}
          </div>
        );
      })}
      {visible.length === 0 && arranging ? (
        <p className="ops-arrange-empty">All sections are hidden. Show one to rebuild your workspace.</p>
      ) : null}
    </div>
  );
}
