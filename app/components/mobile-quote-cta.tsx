"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function MobileQuoteCta() {
  const pathname = usePathname();
  const [footerVisible, setFooterVisible] = useState(false);
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const update = () => setPastHero(window.scrollY > window.innerHeight * 0.9);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [pathname]);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(footer);
    return () => observer.disconnect();
  }, [pathname]);

  if (pathname === "/quote" || pathname === "/privacy" || pathname === "/network") return null;
  return <div className={`mobile-quote-cta ${footerVisible || !pastHero ? "is-hidden" : ""}`}>
    <Link href="/quote" data-analytics-event="mobile_quote_cta_click">Request a quote <ArrowUpRight size={17} /></Link>
  </div>;
}
