import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "./container";
import { Footer } from "./footer";
import { Header } from "./header";

export function PageShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children?: ReactNode }) {
  return <><Header/><main><section className="relative overflow-hidden bg-navy pt-36 text-white"><div className="route-grid absolute inset-0 opacity-25"/><Container className="relative pb-20 pt-10 lg:pb-28"><p className="eyebrow text-gold">{eyebrow}</p><h1 className="mt-5 max-w-4xl text-4xl font-extrabold tracking-[-0.04em] sm:text-6xl">{title}</h1><p className="mt-7 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">{intro}</p></Container></section>{children ?? <PlaceholderContent title={title}/>}</main><Footer/></>;
}

function PlaceholderContent({ title }: { title: string }) {
  return <section className="section"><Container><div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]"><div><p className="eyebrow">Page foundation</p><h2 className="section-title mt-4">Built for verified company information.</h2></div><div className="border-l border-line pl-7 sm:pl-10"><p className="text-lg leading-8 text-slate">The {title.toLowerCase()} page structure is ready. Detailed copy, operational facts, service terms and company-specific information will be added after KCPL confirms the source material.</p><Link href="/quote" className="mt-8 inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.15em] text-navy">Request a quote <ArrowRight size={15}/></Link></div></div></Container></section>;
}
