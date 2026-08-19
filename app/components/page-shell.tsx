import type { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";
import { Container } from "./container";
import { Footer } from "./footer";
import { Header } from "./header";

export function PageShell({ eyebrow, title, intro, breadcrumbs, children }: { eyebrow: string; title: string; intro: string; breadcrumbs?: BreadcrumbItem[]; children?: ReactNode }) {
  return <><Header/><main><section className="relative overflow-hidden bg-navy pt-36 text-white"><div className="route-grid absolute inset-0 opacity-25"/><Container className="relative pb-20 pt-10 lg:pb-28">{breadcrumbs && <Breadcrumbs items={breadcrumbs}/>}<p className={`eyebrow text-gold ${breadcrumbs ? "mt-8" : ""}`}>{eyebrow}</p><h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[1.02] tracking-[-0.05em] sm:text-6xl lg:text-7xl">{title}</h1><p className="mt-7 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">{intro}</p></Container></section>{children}</main><Footer/></>;
}
