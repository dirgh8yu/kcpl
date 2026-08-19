import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";
import { Container } from "./container";
import { Logo } from "./logo";

const links = [
  ["About", "/about"], ["Services", "/services"], ["Network", "/network"], ["Tracking", "/tracking"], ["Contact", "/contact"],
];

export function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 border-b border-white/15 text-white">
      <Container className="flex h-[78px] items-center justify-between">
        <Logo inverse />
        <nav aria-label="Primary navigation" className="hidden items-center gap-8 lg:flex">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="nav-link flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/78 transition-colors hover:text-white">
              {label}{label === "Services" && <ChevronDown size={13} />}
            </Link>
          ))}
        </nav>
        <Link href="/quote" className="hidden min-h-10 items-center border border-gold px-4 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold hover:text-navy sm:flex">
          Request a quote
        </Link>
        <details className="relative lg:hidden">
          <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center border border-white/25" aria-label="Open menu"><Menu size={20} /></summary>
          <div className="absolute right-0 top-14 w-64 border-t-2 border-gold bg-navy p-6 shadow-2xl">
            <nav className="flex flex-col gap-4">
              {links.map(([label, href]) => <Link key={href} href={href} className="text-sm font-semibold text-white/80">{label}</Link>)}
              <Link href="/quote" className="mt-2 bg-gold px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-navy">Request a quote</Link>
            </nav>
          </div>
        </details>
      </Container>
    </header>
  );
}
