"use client";

import { useCallback, useEffect, useState } from "react";
import type { Wallboard, WallboardBlocker, WallboardTodayRow } from "../wallboard-data";

const POLL_MS = 60_000;
const SLIDE_MS = 20_000;

type WallboardResponse = { ok: boolean; wallboard?: Wallboard; generated_at?: string; error?: string };

/**
 * TV client for the ops wallboard. Keeps the last good slide data on failures
 * (a flaky network must never blank the floor's display), polls every 60s while
 * visible, auto-cycles four slides with a progress rule, and stays quiet: no
 * decoration, no motion beyond restrained fades.
 */
export function WallboardView({ initial, initialGeneratedAt }: { initial: Wallboard; initialGeneratedAt: string }) {
  const [board, setBoard] = useState(initial);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [freshness, setFreshness] = useState({ label: "Updated just now", stale: false });
  const [slide, setSlide] = useState(0);

  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const response = await fetch("/api/admin/wallboard", { cache: "no-store" });
      const result = await response.json() as WallboardResponse;
      if (!response.ok || !result.ok || !result.wallboard) return;
      setBoard(result.wallboard);
      if (result.generated_at) setGeneratedAt(result.generated_at);
      setFreshness({ label: "Updated just now", stale: false });
    } catch {
      /* keep last good data */
    }
  }, []);

  // 60s poll: visibility-aware, never blanks the board on failure.
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  // "Updated Xs ago" — computed inside the tick so render stays pure.
  useEffect(() => {
    const compute = () => {
      const seconds = Math.max(0, Math.round((Date.now() - Date.parse(generatedAt)) / 1000));
      setFreshness({
        label: seconds < 5 ? "Updated just now" : seconds < 60 ? `Updated ${seconds}s ago` : `Updated ${Math.floor(seconds / 60)}m ago`,
        stale: seconds > 180,
      });
    };
    compute();
    const timer = window.setInterval(compute, 10_000);
    return () => window.clearInterval(timer);
  }, [generatedAt]);

  // Slide rotation; the progress rule restarts via key={slide}.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setSlide((current) => (current + 1) % 4);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="wb-root">
      <header className="wb-header">
        <div className="wb-brand">
          <span className="wb-brand-mark" aria-hidden="true">K</span>
          <h1 className="wb-brand-text"><strong>KCPL</strong><span>Operations wallboard</span></h1>
        </div>
        <div className="wb-header-meta">
          <span className="wb-freshness" data-stale={freshness.stale || undefined}>{freshness.label}</span>
          <WallboardClock />
        </div>
        <div className="wb-dots" role="tablist" aria-label="Wallboard slides">
          {SLIDE_LABELS.map((label, index) => (
            <button key={label} type="button" role="tab" aria-selected={index === slide} aria-label={label} className="wb-dot" data-active={index === slide || undefined} onClick={() => setSlide(index)} />
          ))}
        </div>
      </header>

      <main className="wb-stage">
        {slide === 0 ? <PulseSlide board={board} /> : null}
        {slide === 1 ? <TodaySlide board={board} /> : null}
        {slide === 2 ? <BlockersSlide board={board} /> : null}
        {slide === 3 ? <TransitionsSlide board={board} /> : null}
      </main>

      <footer className="wb-footer">
        <span className="wb-progress-track" aria-hidden="true">
          <span key={slide} className="wb-progress" style={{ animationDuration: `${SLIDE_MS}ms` }} />
        </span>
        <span className="wb-snapshot" title={generatedAt}>Snapshot {generatedAt}</span>
      </footer>
    </div>
  );
}

const SLIDE_LABELS = ["Live pulse", "Today", "Blockers", "Transitions"];

/** Kathmandu wall clock and date, ticking gently (wallboards run for days). */
function WallboardClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <span className="wb-clock">
      <span aria-label="Kathmandu time">{nptClock(now)}</span>
      <span className="wb-date">{nptDate(now)}</span>
    </span>
  );
}

function nptClock(now: Date): string {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" }).format(now);
}

function nptDate(now: Date): string {
  return new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kathmandu" }).format(now);
}

function PulseSlide({ board }: { board: Wallboard }) {
  return (
    <section className="wb-slide" aria-label="Live pulse">
      <h2 className="wb-slide-title">Live pulse</h2>
      <div className="wb-pulse-grid">
        {board.pulse.map((metric) => (
          <div key={metric.key} className="wb-pulse-cell" data-tone={metric.tone} data-zero={metric.value === 0 || undefined}>
            <span className="wb-pulse-label">{metric.label}</span>
            <span className="wb-pulse-value">{metric.value}</span>
          </div>
        ))}
      </div>
      {board.branches.length ? (
        <div className="wb-branches" aria-label="Branch load">
          {board.branches.map((entry) => (
            <div key={entry.branch} className="wb-branch" data-urgent={entry.urgent > 0 || undefined}>
              <span className="wb-branch-name">{entry.branch}{entry.urgent > 0 ? <span className="wb-branch-urgent"> {entry.urgent} urgent</span> : null}</span>
              <span className="wb-branch-facts">
                {entry.active} active{entry.overdue ? ` · ${entry.overdue} overdue` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TodaySlide({ board }: { board: Wallboard }) {
  return (
    <section className="wb-slide" aria-label="Today">
      <h2 className="wb-slide-title">Today</h2>
      <div className="wb-today-grid">
        <div className="wb-today-col">
          <h3 className="wb-col-title">Arriving today</h3>
          {board.arrivals.length
            ? board.arrivals.map((row) => <WallboardRow key={row.reference} row={row} />)
            : <p className="wb-quiet">No arrivals scheduled for today.</p>}
        </div>
        <div className="wb-today-col">
          <h3 className="wb-col-title">Delivered today</h3>
          {board.deliveries.length
            ? board.deliveries.map((row) => <WallboardRow key={row.reference} row={row} />)
            : <p className="wb-quiet">No completions recorded yet today.</p>}
        </div>
        <div className="wb-today-col">
          <h3 className="wb-col-title">Operational due</h3>
          {board.dueToday.length
            ? board.dueToday.map((row) => <WallboardRow key={row.reference} row={row} />)
            : <p className="wb-quiet">No overdue work or open customs steps.</p>}
        </div>
      </div>
    </section>
  );
}

function BlockersSlide({ board }: { board: Wallboard }) {
  return (
    <section className="wb-slide" aria-label="Blockers">
      <h2 className="wb-slide-title">Blockers</h2>
      {board.blockers.length ? (
        <div className="wb-blockers-list">
          {board.blockers.map((blocker) => <BlockerRow key={blocker.reference} blocker={blocker} />)}
        </div>
      ) : (
        <p className="wb-quiet wb-quiet-large">All caught up — no shipments currently require action.</p>
      )}
      <div className="wb-totals-row">
        <span><strong>{board.totals.active}</strong> active shipments</span>
        <span><strong>{board.totals.urgent}</strong> urgent</span>
        <span><strong>{board.totals.overdueTasks}</strong> overdue tasks</span>
        <span><strong>{board.totals.customs}</strong> customs steps open</span>
      </div>
    </section>
  );
}

function BlockerRow({ blocker }: { blocker: WallboardBlocker }) {
  return (
    <div className="wb-blocker" data-tone={blocker.tone}>
      <span className="wb-blocker-dot" aria-hidden="true" />
      <span className="wb-blocker-ref ops-mono">{blocker.reference}</span>
      <span className="wb-blocker-customer">{blocker.customer}</span>
      <span className="wb-blocker-route">{blocker.route}</span>
      <span className="wb-blocker-label" data-tone={blocker.tone}>{blocker.label}</span>
      {blocker.owner ? <span className="wb-blocker-owner">{blocker.owner}</span> : <span className="wb-blocker-owner wb-owner-none">Unassigned</span>}
    </div>
  );
}

function TransitionsSlide({ board }: { board: Wallboard }) {
  const max = Math.max(...board.transitions7d, 1);
  return (
    <section className="wb-slide" aria-label="Transitions">
      <h2 className="wb-slide-title">Register transitions · last 7 days</h2>
      <div className="wb-sparkline" role="img" aria-label={`Transitions per day: ${board.transitions7d.join(", ")}`}>
        {board.transitions7d.map((count, index) => (
          <div key={index} className="wb-spark-col" data-today={index === 6 || undefined}>
            <div className="wb-spark-track">
              <div className="wb-spark-bar" style={{ height: count ? `${Math.max(12, Math.round((count / max) * 100))}%` : undefined }} />
            </div>
            <span className="wb-spark-day" aria-hidden="true">{dayLabels()[index]}</span>
          </div>
        ))}
      </div>
      <div className="wb-transitions-list">
        {board.transitionsToday.length
          ? board.transitionsToday.map((row) => (
            <div key={row.id} className="wb-transition" data-severity={row.severity}>
              <span className="wb-transition-dot" aria-hidden="true" />
              <span className="wb-transition-title">{row.title}</span>
              <span className="wb-transition-when">{row.whenLabel}</span>
            </div>
          ))
          : <p className="wb-quiet">No register transitions recorded today.</p>}
      </div>
    </section>
  );
}

function WallboardRow({ row }: { row: WallboardTodayRow }) {
  return (
    <div className="wb-row" data-tone={row.tone}>
      <span className="wb-row-dot" aria-hidden="true" />
      <span className="wb-row-ref ops-mono">{row.reference}</span>
      <span className="wb-row-customer">{row.customer}</span>
      <span className="wb-row-route">{row.route}</span>
      <span className="wb-row-label">{row.label}</span>
    </div>
  );
}

/** Weekday labels for the sparkline: NPT day boundaries, oldest → newest. */
function dayLabels(): string[] {
  const npt = new Date(Date.now() + 5.75 * 3_600_000);
  const todayStart = Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(todayStart - (6 - index) * 86_400_000);
    return new Intl.DateTimeFormat("en-AU", { weekday: "short" }).format(date);
  });
}
