import Image from "next/image";
import Link from "next/link";

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" aria-label="Kapileshwor Cargo home" className="inline-flex items-center gap-3">
      <span className="relative h-11 w-11 shrink-0 overflow-hidden border border-gold bg-offwhite">
        <Image src="/images/brand/kcpl-logo-mark.png" alt="" fill sizes="44px" className="object-cover"/>
      </span>
      <span className="leading-none">
        <span className={`block text-[0.78rem] font-extrabold uppercase tracking-[0.13em] ${inverse ? "text-white" : "text-navy"}`}>Kapileshwor Cargo</span>
        <span className={`mt-1.5 block text-[0.55rem] font-medium uppercase tracking-[0.24em] ${inverse ? "text-white/55" : "text-slate"}`}>Pvt. Ltd. · Nepal</span>
      </span>
    </Link>
  );
}
