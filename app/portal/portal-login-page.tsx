import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PortalLogin } from "./portal-login";

export function PortalLoginPage({ notice }: { notice?: string }) {
  return (
    <main className="kcpl-admin-shell portal-login">
      <div className="kcpl-admin-content portal-login-content">
        <section className="portal-login-card">
          <div className="portal-login-head">
            <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={34} height={34} priority/>
            <div>
              <p className="portal-login-eyebrow">Kapileshwor Cargo</p>
              <h1>Customer portal</h1>
            </div>
          </div>
          <p className="portal-login-intro">
            Track your shipments, download released documents and review your account with KCPL.
          </p>
          {notice ? <p className="portal-login-notice">{notice}</p> : null}
          <PortalLogin/>
          <div className="portal-login-footnote">
            <span><ShieldCheck size={14} aria-hidden="true"/> Access is provisioned by your KCPL account manager.</span>
            <Link href="/track">Track without signing in</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
