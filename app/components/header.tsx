"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Container } from "./container";
import { Logo } from "./logo";

const links = [
  ["About", "/about"], ["Services", "/services"], ["Network", "/network"], ["Tracking", "/tracking"], ["Contact", "/contact"],
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 28);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    document.body.classList.toggle("mobile-menu-open", menuOpen);
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("mobile-menu-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <header className={`site-header fixed inset-x-0 top-0 z-30 text-white ${scrolled ? "is-scrolled" : ""} ${menuOpen ? "menu-is-open" : ""}`}>
      <Container className="site-header-inner">
        <Logo inverse variant="header" />

        <nav aria-label="Primary navigation" className="header-desktop-nav">
          {links.map(([label, href]) => {
            const active = pathname === href || (href === "/services" && pathname.startsWith("/services/"));
            return (
              <Link key={href} href={href} className={`nav-link ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="header-actions">
          <span className="header-location">Kathmandu <i /> Nepal</span>
          <Link href="/quote" className="header-quote-link" data-analytics-event="header_quote_click">
            <span>Request a quote</span>
            <ArrowUpRight size={15} strokeWidth={1.7} />
          </Link>
          <button
            type="button"
            className="header-menu-button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} strokeWidth={1.6} /> : <Menu size={21} strokeWidth={1.6} />}
          </button>
        </div>
      </Container>

      <div id="mobile-primary-navigation" className={`mobile-nav-panel ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
        <Container className="mobile-nav-inner">
          <p className="mobile-nav-eyebrow">Navigation · KCPL</p>
          <nav aria-label="Mobile navigation" className="mobile-nav-links">
            {links.map(([label, href], index) => (
              <Link key={href} href={href} className={pathname === href ? "is-active" : ""} onClick={() => setMenuOpen(false)}>
                <span>0{index + 1}</span>
                <strong>{label}</strong>
                <ArrowUpRight size={18} strokeWidth={1.4} />
              </Link>
            ))}
          </nav>
          <div className="mobile-nav-footer">
            <p>Import into Nepal <span>↔</span> Export to the world</p>
            <Link href="/quote" onClick={() => setMenuOpen(false)} data-analytics-event="mobile_menu_quote_click">Start a freight enquiry <ArrowUpRight size={17} /></Link>
          </div>
        </Container>
      </div>
    </header>
  );
}
