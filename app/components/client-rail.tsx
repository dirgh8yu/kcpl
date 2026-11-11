import Image from "next/image";

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
              ? <Image src={`/images/clients/${organisation.logo}`} alt={organisation.name} width={220} height={90} sizes="150px"/>
              : <span>{organisation.name}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
