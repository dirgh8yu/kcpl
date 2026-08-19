import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Boxes, ClipboardCheck, Clock3, Compass, Factory, Globe2, Home, PackageCheck, Plane, ShieldCheck, Ship, ShoppingBag, Truck, Warehouse } from "lucide-react";
import { ButtonLink } from "./components/button-link";
import { Container } from "./components/container";
import { Footer } from "./components/footer";
import { Header } from "./components/header";

export const metadata: Metadata = {
  title: "Kapileshwor Cargo | Moving Nepal. Connecting the World.",
  description: "International cargo, freight forwarding and logistics solutions connecting Nepal with the world.",
};

const services = [
  { icon: Plane, title: "Air Freight", copy: "Time-sensitive air cargo solutions for shipments moving between Nepal and international markets.", href: "/services/air-freight", code: "01" },
  { icon: Ship, title: "Sea Freight", copy: "Flexible ocean freight coordination for full and consolidated cargo through regional gateways.", href: "/services/sea-freight", code: "02" },
  { icon: Truck, title: "Road Freight", copy: "Cross-border and domestic road transport planned around your route and cargo requirements.", href: "/services/road-freight", code: "03" },
  { icon: ClipboardCheck, title: "Customs Clearance", copy: "Documentation and customs coordination designed to keep shipments moving efficiently.", href: "/services/customs-clearance", code: "04" },
  { icon: Warehouse, title: "Warehousing", copy: "Secure storage and cargo handling solutions integrated with your wider supply chain.", href: "/services/warehousing", code: "05" },
  { icon: PackageCheck, title: "Door-to-Door", copy: "Coordinated pickup-to-delivery logistics with one clear point of contact.", href: "/services/door-to-door", code: "06" },
];

const industries = [
  { icon: Factory, name: "Industrial cargo" }, { icon: ShoppingBag, name: "Retail & consumer goods" },
  { icon: Boxes, name: "Commercial shipments" }, { icon: Home, name: "Personal effects" },
];

export default function HomePage() {
  return <><Header/><main>
    <section className="relative min-h-[780px] overflow-hidden bg-navy text-white">
      <div className="route-grid absolute inset-0 opacity-40" />
      <div className="absolute -right-20 top-32 h-[620px] w-[620px] rounded-full border border-white/10" />
      <div className="absolute right-12 top-52 h-[450px] w-[450px] rounded-full border border-gold/30" />
      <Container className="relative grid min-h-[780px] items-center gap-12 pb-16 pt-36 lg:grid-cols-[1.08fr_0.92fr] lg:pt-28">
        <div className="max-w-3xl">
          <p className="eyebrow text-gold">Freight forwarding · Logistics · Nepal</p>
          <h1 className="mt-6 text-[clamp(3.2rem,7vw,7rem)] font-extrabold leading-[0.94] tracking-[-0.065em]">Moving Nepal.<br/><span className="text-white/55">Connecting</span><br/>the World.</h1>
          <p className="mt-8 max-w-xl text-base leading-8 text-white/65 sm:text-lg">Integrated cargo and freight forwarding solutions built around Nepal&apos;s connection to global trade.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><ButtonLink href="/quote">Request a quote</ButtonLink><ButtonLink href="/tracking" variant="secondary">Track shipment</ButtonLink></div>
        </div>
        <div className="relative hidden min-h-[540px] lg:block">
          <div className="absolute left-8 top-16 h-3 w-3 rounded-full bg-gold shadow-[0_0_0_8px_rgba(217,164,65,.14)]" />
          <div className="absolute bottom-24 right-24 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_0_7px_rgba(255,255,255,.10)]" />
          <div className="absolute left-10 top-[82px] h-px w-[70%] origin-left rotate-[31deg] bg-gradient-to-r from-gold to-white/20" />
          <div className="absolute right-6 top-1/2 border-l border-gold/50 pl-6"><p className="eyebrow text-gold">Nepal to global markets</p><p className="mt-3 max-w-xs text-sm leading-6 text-white/55">Air · Sea · Road<br/>Integrated logistics coordination</p></div>
          <div className="absolute bottom-10 left-0 w-64 border-t border-white/20 pt-4"><Globe2 className="mb-4 text-gold" size={30} strokeWidth={1.25}/><p className="text-xs font-bold uppercase tracking-[0.18em]">International reach.<br/>Local understanding.</p></div>
        </div>
      </Container>
      <div className="absolute bottom-0 left-0 h-1 w-1/3 bg-gold" />
    </section>

    <section className="section bg-white"><Container>
      <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow text-gold">What we move</p><h2 className="section-title mt-4">Logistics built around the way Nepal trades.</h2></div><Link href="/services" className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.15em] text-navy">Explore all services <ArrowRight size={16}/></Link></div>
      <div className="mt-14 grid border-l border-t border-line md:grid-cols-2 lg:grid-cols-3">{services.map(({icon:Icon,title,copy,href,code})=><Link href={href} key={title} className="group relative min-h-72 border-b border-r border-line p-7 transition-colors hover:bg-offwhite sm:p-9"><span className="absolute right-7 top-7 text-[0.6rem] font-bold tracking-[.2em] text-slate/50">{code}</span><Icon size={30} strokeWidth={1.35} className="text-gold"/><h3 className="mt-12 text-xl font-extrabold tracking-[-.025em]">{title}</h3><p className="mt-4 text-sm leading-7 text-slate">{copy}</p><ArrowRight size={16} className="absolute bottom-8 left-9 transition-transform group-hover:translate-x-2"/></Link>)}</div>
    </Container></section>

    <section className="bg-offwhite"><Container className="grid lg:grid-cols-[0.9fr_1.1fr]">
      <div className="border-b border-line py-20 lg:border-b-0 lg:border-r lg:py-28 lg:pr-16"><p className="eyebrow text-gold">Company profile</p><h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-.04em] sm:text-5xl">Nepal-based.<br/>Internationally focused.</h2><p className="mt-7 max-w-lg text-base leading-8 text-slate">KCPL coordinates cargo and logistics solutions for businesses and individuals moving goods to, from and within Nepal.</p><ButtonLink href="/about" variant="light">About KCPL</ButtonLink></div>
      <div className="grid grid-cols-2 lg:pl-16">{[["[XX]+","Years in logistics"],["[XX]+","Markets served"],["[XX]+","Shipments handled"],["[XX]","Network locations"]].map(([value,label],i)=><div key={label} className={`flex min-h-48 flex-col justify-end border-line p-6 sm:p-8 ${i%2===0?"border-r":""} ${i<2?"border-b":""}`}><span className="text-3xl font-extrabold tracking-[-.04em] text-navy sm:text-5xl">{value}</span><span className="mt-3 text-[.64rem] font-bold uppercase tracking-[.16em] text-slate">{label}</span><span className="mt-2 text-[.6rem] text-slate/55">To be confirmed by KCPL</span></div>)}</div>
    </Container></section>

    <section className="section bg-white"><Container className="grid gap-14 lg:grid-cols-[.85fr_1.15fr] lg:gap-24">
      <div><p className="eyebrow text-gold">Why KCPL</p><h2 className="section-title mt-4">Clarity at every stage of the journey.</h2><p className="mt-7 max-w-md text-base leading-8 text-slate">From route planning to final delivery, our service model is designed around responsive coordination and practical logistics support.</p></div>
      <div className="border-t border-line">{[[Compass,"Route-led planning","Freight options shaped around the cargo, timeline and destination."],[ShieldCheck,"Careful coordination","Clear documentation and handling processes throughout the journey."],[Clock3,"Responsive communication","A direct point of contact and visibility across key shipment stages."],[Globe2,"Local and global perspective","Understanding Nepal’s logistics environment while coordinating internationally."]].map(([Icon,title,copy])=>{const I=Icon as typeof Compass; return <div key={title as string} className="grid grid-cols-[45px_1fr] gap-5 border-b border-line py-7 sm:grid-cols-[55px_1fr]"><I className="text-gold" size={26} strokeWidth={1.3}/><div><h3 className="font-extrabold tracking-[-.02em]">{title as string}</h3><p className="mt-2 text-sm leading-6 text-slate">{copy as string}</p></div></div>})}</div>
    </Container></section>

    <section className="relative overflow-hidden bg-navy text-white"><div className="route-grid absolute inset-0 opacity-20"/><Container className="relative grid gap-16 py-24 lg:grid-cols-2 lg:py-32">
      <div><p className="eyebrow text-gold">International network</p><h2 className="section-title mt-4">From the Himalayas to global trade lanes.</h2><p className="mt-7 max-w-lg text-base leading-8 text-white/60">KCPL connects Nepal with international destinations through coordinated freight routes and logistics relationships. Confirmed destinations and network information will be published following company verification.</p><div className="mt-9"><ButtonLink href="/network">Explore our network</ButtonLink></div></div>
      <div className="relative min-h-[360px] border border-white/15"><div className="absolute inset-8 rounded-[50%] border border-white/15"/><div className="absolute inset-x-8 top-1/2 h-px bg-white/15"/><div className="absolute inset-y-8 left-1/2 w-px bg-white/15"/><span className="absolute left-[27%] top-[42%] h-3 w-3 rounded-full bg-gold shadow-[0_0_0_9px_rgba(217,164,65,.13)]"/><span className="absolute right-[19%] top-[29%] h-2 w-2 rounded-full bg-white"/><span className="absolute bottom-[23%] right-[34%] h-2 w-2 rounded-full bg-white/70"/><p className="absolute bottom-6 left-6 text-[.62rem] font-bold uppercase tracking-[.18em] text-white/45">Network destinations<br/>to be confirmed</p></div>
    </Container></section>

    <section className="section bg-offwhite"><Container><p className="eyebrow text-gold">Cargo handled</p><div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><h2 className="section-title">Flexible support for varied cargo needs.</h2><p className="max-w-md text-sm leading-7 text-slate">Cargo acceptance is subject to route, carrier and regulatory requirements.</p></div><div className="mt-14 grid border-y border-line sm:grid-cols-2 lg:grid-cols-4">{industries.map(({icon:Icon,name},i)=><div key={name} className={`min-h-48 p-7 sm:p-9 ${i<3?"lg:border-r":""} ${i%2===0?"max-sm:border-b sm:border-r lg:border-r":"max-sm:border-b"}`}><Icon className="text-gold" size={28} strokeWidth={1.3}/><h3 className="mt-14 text-base font-extrabold">{name}</h3></div>)}</div></Container></section>

    <section className="section bg-white"><Container><div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]"><div><p className="eyebrow text-gold">How it works</p><h2 className="section-title mt-4">A clear path from enquiry to delivery.</h2></div><div className="grid sm:grid-cols-2">{[["01","Tell us what is moving","Share your cargo, origin, destination and preferred timeline."],["02","Receive a tailored plan","We outline the suitable route, service scope and quote."],["03","Prepare and dispatch","Documentation, pickup and freight movements are coordinated."],["04","Track to destination","Stay informed through key milestones until final delivery."]].map(([n,title,copy])=><div key={n} className="border-l border-t border-line p-7 sm:min-h-60 sm:p-9"><span className="text-xs font-bold text-gold">{n}</span><h3 className="mt-8 text-lg font-extrabold tracking-[-.02em]">{title}</h3><p className="mt-4 text-sm leading-7 text-slate">{copy}</p></div>)}</div></div></Container></section>

    <section className="bg-gold"><Container className="grid gap-10 py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:py-20"><div><p className="eyebrow text-navy/60">Start a shipment</p><h2 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight tracking-[-.04em] text-navy sm:text-5xl">Let&apos;s plan the right route for your cargo.</h2></div><Link href="/quote" className="inline-flex min-h-14 items-center justify-center gap-4 bg-navy px-7 text-xs font-bold uppercase tracking-[.16em] text-white">Request a quote <ArrowRight size={16}/></Link></Container></section>
  </main><Footer/></>;
}
