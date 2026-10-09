import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import type { PartnerSession } from "./partner-auth";

/** The partner portal's chrome: the mark, who is signed in for which partner, and sign out. One page needs no navigation. */
export function PartnerShell({ session, children }: { session: PartnerSession; children: ReactNode }) {
  return (
    <div className="kcpl-admin-shell portal-shell" lang="en">
      <a className="portal-skip-link" href="#partner-content">Skip to content</a>
      <header className="portal-topbar">
        <Link href="/partner" className="portal-brand" aria-label="KCPL partner portal shipments">
          <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={26} height={26} priority/>
          <span className="portal-brand-text"><strong>KCPL</strong><small>Partner portal</small></span>
        </Link>
        <div className="portal-account">
          <span className="portal-account-meta"><strong>{session.partnerName}</strong><small>{session.email}</small></span>
          <a href="/api/partner/session" className="portal-signout" aria-label="Sign out"><LogOut size={16} strokeWidth={1.75} aria-hidden="true"/></a>
        </div>
      </header>
      <div id="partner-content" tabIndex={-1} className="kcpl-admin-content">{children}</div>
      <footer className="portal-footer"><span>Kapileshwor Cargo Pvt. Ltd. · Kathmandu, Nepal</span></footer>
    </div>
  );
}
