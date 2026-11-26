import type { CSSProperties } from "react";
import Image from "next/image";

const organisations = [
  { name: "Pinggao Group Co Ltd", logo: "pinggao.png", ratio: 1.32 },
  { name: "TBEA CO LTD", logo: "tbea.jpg", ratio: 11.54 },
  { name: "ZTE", logo: "zte.svg", ratio: 2.07 },
  { name: "NCELL", logo: "ncell.svg", ratio: 3.09 },
  { name: "CG GROUP", logo: "cg-group.svg", ratio: 2.11 },
  { name: "Nepal Electricity Authority", logo: "nea.png", ratio: 1.0 },
  { name: "EVEREST FASHION", logo: "everest-fashion.png", ratio: 2.52 },
  { name: "SKIPPER INDIA", logo: "skipper.png", ratio: 3.23 },
  { name: "ZNCC", logo: "zncc.png", ratio: 1.99 },
  { name: "FELT & YARN", logo: "felt-yarn.png", ratio: 3.77 },
  { name: "SIEMENS INDIA", logo: "siemens.svg", ratio: 6.29 },
  { name: "C.G POWER", logo: "cg-power.svg", ratio: 1.0 },
  { name: "DERAVEX" },
  { name: "VIJAY TRANSMISSION INDIA", logo: "vijay.png", ratio: 5.88 },
  { name: "GE T&E", logo: "ge.svg", ratio: 1.0 },
  { name: "KEC INTERNATIONAL INDIA", logo: "kec.png", ratio: 1.81 },
  { name: "STERLITE POWER INDIA", logo: "sterlite.svg", ratio: 5.89 },
] as const;

/* Logos come in every shape, from square emblems to long wordmarks. Giving them all one height
 * makes emblems dots and wordmarks banners, so each height follows its width-to-height ratio
 * (height ∝ ratio^-0.45): every logo then carries about the same visual weight. */
function logoHeight(ratio: number) {
  return Math.max(20, Math.min(56, Math.round(36 * (3 / ratio) ** 0.45)));
}

/** The organisations KCPL has moved cargo for: a still row, every logo in one colour. */
export function ClientRail({ title }: { title: string }) {
  return (
    <section className="clients" data-line="a" aria-labelledby="clients-title">
      <span className="ln" aria-hidden="true"><i/></span>
      <h2 id="clients-title" className="label">{title}</h2>
      <ul className="clients-list">
        {organisations.map((organisation) => (
          <li key={organisation.name}>
            {"logo" in organisation
              ? <Image src={`/images/clients/${organisation.logo}`} alt={organisation.name} width={Math.round(90 * organisation.ratio)} height={90} sizes="160px" style={{ "--h": `${logoHeight(organisation.ratio)}px` } as CSSProperties}/>
              : <span>{organisation.name}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
