"use client";

import { useEffect } from "react";

/*
 * Long pages arrive in reading order, as the line reaches them: a section waits
 * until its station meets the spine's crimson front, then its heading, intro and
 * items follow one another. Once only, so going back to re-read never waits.
 *
 * Nothing is hidden until this runs, and only below the fold, so a reader without
 * JavaScript, a crawler and anything already on screen simply see the content.
 */

// Where the spine's front sits on screen. site.css uses the same 72% in its animation-range.
const LINE_AT = 0.72;
const UNITS = ".stop, .feature-band, .end-band, .rail, .network-map-section, .stages li";
// Containers whose children arrive one at a time, rather than as a block.
const GROUPS = ".svc-list, .check-list, .qa, .link-list, .stories, .story, .certs, .two-photos, .facts, .marks, .credentials, .stop-split > div, .sector > div, .work-detail, .feature-copy, .feature-copy > div, .mini, .mini > ol";
// Images and drawn lines wipe in along the route instead of fading.
const WIPES = ".certs figure, .two-photos figure, .plate, .mini svg";
const SETTLE_MS = 1700;

function partsOf(element: Element): HTMLElement[] {
  return [...element.children].flatMap((child) => {
    if (child.matches(".stages")) return []; // Each stage is its own unit.
    return child.matches(GROUPS) ? partsOf(child) : [child as HTMLElement];
  });
}

function settle(unit: Element, parts: HTMLElement[]) {
  unit.classList.remove("reveal-wait");
  for (const part of parts) {
    part.classList.remove("reveal-part", "reveal-wipe");
    part.style.transitionDelay = "";
  }
}

export function RouteReveal() {
  useEffect(() => {
    const root = document.querySelector("[data-reveal]");
    if (!root || !window.IntersectionObserver) return;
    const step = window.matchMedia("(max-width: 900px)").matches ? 35 : 60;
    const waiting = new Map<Element, HTMLElement[]>();
    const owners = new Map<Element, Element>();
    const timers = new Set<number>();

    const reveal = (unit: Element) => {
      const parts = waiting.get(unit);
      if (!parts) return;
      waiting.delete(unit);
      unit.classList.remove("reveal-wait");
      const timer = window.setTimeout(() => { timers.delete(timer); settle(unit, parts); }, SETTLE_MS);
      timers.add(timer);
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting && entry.boundingClientRect.top >= 0) continue;
        const unit = owners.get(entry.target);
        if (unit) reveal(unit);
        observer.unobserve(entry.target);
      }
    }, { rootMargin: `0px 0px -${Math.round((1 - LINE_AT) * 100)}% 0px` });

    for (const unit of root.querySelectorAll(UNITS)) {
      // Already on screen: leave it alone, so nothing disappears after the page has loaded.
      if (unit.getBoundingClientRect().top < window.innerHeight) continue;
      const parts = unit.matches(".stages li") ? [...unit.children] as HTMLElement[] : partsOf(unit);
      parts.forEach((part, index) => {
        part.classList.add(part.matches(WIPES) ? "reveal-wipe" : "reveal-part");
        part.style.transitionDelay = `${Math.min(index, 9) * step}ms`;
      });
      unit.classList.add("reveal-wait");
      waiting.set(unit, parts);
      const target = unit.querySelector(":scope > .stop-title") ?? unit;
      owners.set(target, unit);
      observer.observe(target);
    }

    // The last sections of a short page may never reach the line, so the footer calls them in.
    const footer = document.querySelector(".site-footer");
    const atEnd = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) for (const unit of [...waiting.keys()]) reveal(unit);
    });
    if (footer) atEnd.observe(footer);

    // A keyboard user must never land on something invisible.
    const onFocus = (event: FocusEvent) => {
      for (const unit of [...waiting.keys()]) if (unit.contains(event.target as Node)) reveal(unit);
    };
    document.addEventListener("focusin", onFocus);

    return () => {
      observer.disconnect();
      atEnd.disconnect();
      document.removeEventListener("focusin", onFocus);
      for (const timer of timers) window.clearTimeout(timer);
      for (const [unit, parts] of waiting) settle(unit, parts);
    };
  }, []);

  return null;
}
