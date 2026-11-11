import type { ReactNode } from "react";
import Image from "next/image";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { RouteReveal } from "./route-reveal";

/* The site's one recurring idea: a crimson line with stations on it. The line
 * fills as the page scrolls, in CSS, so these stay server components. */

/** `tracks` is for a rebuilt page, whose sections each draw their own piece of the line
 * (see `line` on Stop). Without it the page gets one straight spine. */
export function Lined({ children, reveal = false, tracks = false }: { children: ReactNode; reveal?: boolean; tracks?: boolean }) {
  return (
    <div className="lined" data-reveal={reveal || undefined}>
      {tracks ? null : <div className="spine" aria-hidden="true"><i/></div>}
      {reveal ? <RouteReveal/> : null}
      {children}
    </div>
  );
}

/** Questions first, answers on a tap. Native <details>, so answers stay in the page
 * for search engines and work without JavaScript. */
export function QaList({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="qa">
      {items.map((item) => (
        <details key={item.question}>
          <summary>{item.question}<CaretDown size={16} weight="bold" aria-hidden="true"/></summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

/** An illustrative photograph on the line. Alt stays empty because the picture adds
 * no information; docs/public-photo-sources.md records where each one came from. */
export function Plate({ src, wide = false, position }: { src: string; wide?: boolean; position?: string }) {
  return (
    <figure className={wide ? "plate plate-wide" : "plate"}>
      <Image src={src} alt="" width={wide ? 2000 : 1200} height={wide ? 860 : 840} sizes={wide ? "(max-width: 900px) 100vw, 80vw" : "(max-width: 900px) 100vw, 34vw"} style={position ? { objectPosition: position } : undefined}/>
    </figure>
  );
}

/** `line` draws this section's piece of the page line: "a" runs straight down the left
 * track, "a-b" steps across to the second track just above the heading. */
export function Stop({ title, intro, id, children, className = "", line }: { title: string; intro?: ReactNode; id?: string; children?: ReactNode; className?: string; line?: "a" | "a-b" }) {
  return (
    <section id={id} className={`stop ${className}`.trim()} data-line={line}>
      {line ? <span className="ln" aria-hidden="true"><i/></span> : null}
      <h2 className="stop-title">{title}</h2>
      {intro ? <p className="stop-intro">{intro}</p> : null}
      {children}
    </section>
  );
}

export function PageHead({ title, intro, breadcrumb, children }: { title: string; intro?: ReactNode; breadcrumb?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      {breadcrumb}
      <h1 className="page-title">{title}</h1>
      {intro ? <p className="page-intro">{intro}</p> : null}
      {children}
    </header>
  );
}

/** A movement's own route: stations spaced evenly, and the line lifted over the
 * stations it was rerouted through. Stops come from the dictionary as "a|b|c". */
export function MiniRoute({ stops, bend }: { stops: string; bend?: readonly [number, number] }) {
  const names = stops.split("|");
  const x = (index: number) => ((index + 0.5) / names.length) * 1000;
  const path = bend
    ? `M${x(0)},28 H${x(bend[0]) - 70} L${x(bend[0]) - 46},6 H${x(bend[1]) + 46} L${x(bend[1]) + 70},28 H${x(names.length - 1)}`
    : `M${x(0)},28 H${x(names.length - 1)}`;
  return (
    <div className={`mini${names.length > 4 ? " mini-long" : ""}`} style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
      <svg viewBox="0 0 1000 34" preserveAspectRatio="none" aria-hidden="true"><path d={path}/></svg>
      <ol style={{ display: "contents" }}>
        {names.map((name, index) => <li key={name} className={bend && index >= bend[0] && index <= bend[1] ? "is-raised" : undefined}><i aria-hidden="true"/><span>{name}</span></li>)}
      </ol>
    </div>
  );
}
