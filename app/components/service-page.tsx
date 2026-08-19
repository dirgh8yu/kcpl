import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Container } from "./container";
import { PageShell } from "./page-shell";

export function ServicePage({ eyebrow, title, intro, description, points }: { eyebrow: string; title: string; intro: string; description: string; points: string[] }) {
  return <PageShell eyebrow={eyebrow} title={title} intro={intro}>
    <section className="section bg-white"><Container><div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-24"><div><p className="eyebrow text-gold">Service overview</p><h2 className="mt-4 text-3xl font-extrabold tracking-[-.04em] text-navy sm:text-5xl">Planned around the cargo and the route.</h2></div><div><p className="text-lg leading-8 text-slate">{description}</p><div className="mt-10 border-t border-line">{points.map((point)=><div key={point} className="flex gap-4 border-b border-line py-5 text-sm font-semibold text-navy"><Check className="mt-0.5 shrink-0 text-gold" size={18}/><span>{point}</span></div>)}</div><Link href="/quote" className="text-link mt-10">Request a quote <ArrowRight size={16}/></Link></div></div></Container></section>
  </PageShell>;
}
