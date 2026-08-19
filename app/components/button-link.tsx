import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function ButtonLink({ href, children, variant = "primary", analyticsEvent }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" | "light"; analyticsEvent?: string }) {
  const styles = {
    primary: "bg-gold text-navy hover:bg-gold-light",
    secondary: "border border-white/35 text-white hover:border-white hover:bg-white/5",
    light: "border border-navy/20 text-navy hover:border-navy hover:bg-navy hover:text-white",
  };
  return (
    <Link href={href} data-analytics-event={analyticsEvent} className={`group inline-flex min-h-12 items-center justify-center gap-3 px-5 text-[0.72rem] font-bold uppercase tracking-[0.16em] transition-colors ${styles[variant]}`}>
      {children}<ArrowUpRight size={15} strokeWidth={1.8} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}
