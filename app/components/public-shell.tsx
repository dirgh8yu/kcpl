import type { ReactNode } from "react";
import { company } from "../company-data";
import { Container } from "./container";

// The marketing site is gone; the quote enquiry and the error boundaries are all that
// still render publicly, so they share this minimal chrome instead of the old header,
// footer and hero shell.
export function PublicShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return <>
    <header className="border-b border-black/10 py-5">
      <Container><span className="text-base font-semibold tracking-tight">{company.name}</span></Container>
    </header>
    <main className="py-12">
      <Container>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {intro ? <p className="mt-4 max-w-2xl text-base leading-7 text-black/65">{intro}</p> : null}
        <div className="mt-10">{children}</div>
      </Container>
    </main>
    <footer className="border-t border-black/10 py-6">
      <Container><p className="text-sm text-black/55">{company.name} · {company.email} · {company.phones[0]}</p></Container>
    </footer>
  </>;
}
