"use client";

import { useState } from "react";
import Image from "next/image";
import { Pause, Play } from "@phosphor-icons/react/dist/ssr";

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

/* A CSS marquee over two copies of the list. The second copy is hidden from
 * assistive tech, and the button satisfies WCAG's pause requirement. */
function Logos({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="rail-track" aria-hidden={hidden || undefined}>
      {organisations.map((organisation) => (
        <li key={organisation.name}>
          {"logo" in organisation
            ? <Image src={`/images/clients/${organisation.logo}`} alt={hidden ? "" : organisation.name} width={220} height={90} sizes="150px"/>
            : <span className="rail-word">{organisation.name}</span>}
        </li>
      ))}
    </ul>
  );
}

export function ClientRail({ labels }: { labels: { title: string; pause: string; play: string } }) {
  const [paused, setPaused] = useState(false);
  return (
    <section className={`rail${paused ? " is-paused" : ""}`} aria-labelledby="client-rail-title">
      <h2 id="client-rail-title" className="rail-title">{labels.title}</h2>
      <div className="rail-window"><Logos/><Logos hidden/></div>
      <button type="button" className="rail-button" aria-label={paused ? labels.play : labels.pause} onClick={() => setPaused((value) => !value)}>
        {paused ? <Play size={14} weight="bold" aria-hidden="true"/> : <Pause size={14} weight="bold" aria-hidden="true"/>}
      </button>
    </section>
  );
}
