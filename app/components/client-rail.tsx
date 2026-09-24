"use client";

import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import Image from "next/image";
import { siteTranslator, type SiteLocale } from "../site-i18n";

const organisations = [
  { name: "Pinggao Group Co Ltd", logo: "pinggao.png" },
  { name: "TBEA CO LTD", logo: "tbea.jpg" },
  { name: "ZTE", logo: "zte.svg" },
  { name: "NCELL", logo: "ncell.svg" },
  { name: "CG GROUP", logo: "cg-group.svg" },
  { name: "Nepal Electricity Authority", logo: "nea.png" },
  { name: "EVEREST FASHION", logo: "everest-fashion.png" },
  { name: "SKIPPER INDIA", logo: "skipper.png" },
  { name: "ZNCC", logo: "zncc.png" },
  { name: "FELT & YARN", logo: "felt-yarn.png" },
  { name: "SIEMENS INDIA", logo: "siemens.svg" },
  { name: "C.G POWER", logo: "cg-power.svg" },
  { name: "DERAVEX" },
  { name: "VIJAY TRANSMISSION INDIA", logo: "vijay.png" },
  { name: "GE T&E", logo: "ge.svg" },
  { name: "KEC INTERNATIONAL INDIA", logo: "kec.png" },
  { name: "STERLITE POWER INDIA", logo: "sterlite.svg" },
] as const;

export function ClientRail({ locale }: { locale: SiteLocale }) {
  const t = siteTranslator(locale);
  const sectionRef = useRef<HTMLElement>(null);
  const isVisible = useRef(false);
  const isHovering = useRef(false);
  const [autoScroll] = useState(() => AutoScroll({ speed: 0.8, startDelay: 400, playOnInit: false, stopOnInteraction: true, stopOnFocusIn: true }));
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start", slidesToScroll: 1, breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } } }, [autoScroll]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!emblaApi || !section) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      if (motionPreference.matches || document.hidden || !isVisible.current || isHovering.current) autoScroll.stop();
      else autoScroll.play();
    };
    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      isHovering.current = true;
      autoScroll.stop();
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      isHovering.current = false;
      syncPlayback();
    };
    const observer = new IntersectionObserver(([entry]) => {
      isVisible.current = entry.isIntersecting;
      syncPlayback();
    }, { threshold: 0.35 });
    observer.observe(section);
    section.addEventListener("pointerenter", onPointerEnter);
    section.addEventListener("pointerleave", onPointerLeave);
    motionPreference.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);

    return () => {
      observer.disconnect();
      section.removeEventListener("pointerenter", onPointerEnter);
      section.removeEventListener("pointerleave", onPointerLeave);
      motionPreference.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
      autoScroll.stop();
    };
  }, [emblaApi, autoScroll]);

  return (
    <section ref={sectionRef} className="client-rail" aria-labelledby="client-rail-title">
      <div className="client-rail-head">
        <h2 id="client-rail-title">{t("home.clients_title")}</h2>
      </div>
      <div className="client-rail-viewport" ref={emblaRef} role="region" aria-roledescription="carousel" aria-label={t("home.clients_title")}>
        <ul className="client-rail-track">
          {organisations.map((organisation, index) => (
            <li key={organisation.name} className="client-rail-item" role="group" aria-roledescription="slide" aria-label={`${index + 1} / ${organisations.length}: ${organisation.name}`}>
              {"logo" in organisation ? (
                /* sizes mirrors the CSS box (.client-rail-logo: max 160px wide
                 * on desktop, 132px under 620px), so the browser picks from
                 * width-based candidates instead of assuming the full 220px
                 * intrinsic width at 1x/2x — the rail stops fetching 640px
                 * files for logos that render at ~112px. */
                <Image className="client-rail-logo" src={`/images/clients/${organisation.logo}`} alt={organisation.name} width={220} height={90} sizes="(max-width: 620px) 132px, 160px" />
              ) : (
                <span className={`client-rail-name${organisation.name.length > 22 ? " client-rail-name-long" : ""}`}>{organisation.name}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
