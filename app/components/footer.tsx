import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { Container } from "./container";
import { Logo } from "./logo";
import { company, serviceGroups } from "../company-data";

const services = [...serviceGroups.freight, ...serviceGroups.specialist, serviceGroups.logistics[0], serviceGroups.logistics[3]];

export function Footer() {
  return (
    <footer className="bg-ink text-white">
      <Container className="grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.35fr_0.75fr_0.75fr_1fr] lg:py-20">
        <div><Logo inverse /><p className="mt-7 max-w-sm text-sm leading-7 text-white/55">Freight forwarding and practical logistics coordination from Kathmandu to Nepal&apos;s trade gateways and international markets.</p></div>
        <div><h3 className="footer-title">Company</h3><div className="footer-links"><Link href="/about">About</Link><Link href="/services">Services</Link><Link href="/network">Network</Link><Link href="/tracking">Tracking</Link><Link href="/quote">Request Quote</Link><Link href="/contact">Contact</Link></div></div>
        <div><h3 className="footer-title">Services</h3><div className="footer-links">{services.map((s) => <Link key={s.title} href={s.href}>{s.title}</Link>)}</div></div>
        <div><h3 className="footer-title">Head office</h3><div className="space-y-4 text-sm leading-6 text-white/55"><p className="flex gap-3"><MapPin className="mt-1 shrink-0 text-gold" size={15}/><span>Mhepi Road, Sorakhutte<br/>Kathmandu, Nepal</span></p><p className="flex gap-3"><Phone className="mt-1 shrink-0 text-gold" size={15}/><a href="tel:+97714987510">{company.phones[0]}</a></p><p className="flex gap-3"><Mail className="mt-1 shrink-0 text-gold" size={15}/><a className="break-all" href={`mailto:${company.email}`}>{company.email}</a></p></div></div>
      </Container>
      <Container className="flex flex-col gap-4 border-t border-white/10 py-6 text-[0.63rem] uppercase tracking-[0.14em] text-white/35 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Kapileshwor Cargo Pvt. Ltd.</p>
        <Link href="/quote" className="inline-flex items-center gap-2 text-gold">Request a quote <ArrowUpRight size={13}/></Link>
      </Container>
    </footer>
  );
}
