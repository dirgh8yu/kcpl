import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The one sign-in page, for staff and for customers: the mark, a title, the
 * fields and a button on the app's own canvas, then a line on who gives you
 * access. No card and no artwork; it is a door, and what people came for is
 * behind it. The mark goes back to the public website.
 */
export function SignInLayout({ title, lead, help, children }: {
  title: string;
  /** One short line under the title, only where the page needs saying what it is. */
  lead?: ReactNode;
  /** Who to ask for access, and anything else a person stuck here needs. */
  help?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="kcpl-admin-shell sign-in">
      <div className="kcpl-admin-content sign-in-page">
        <div className="sign-in-column">
          <Link href="/" className="sign-in-brand" aria-label="Kapileshwor Cargo website">
            <Image src="/images/brand/kcpl-gateway-k.svg" alt="" width={28} height={28} priority/>
            <span>Kapileshwor Cargo</span>
          </Link>
          <h1>{title}</h1>
          {lead ? <p className="sign-in-lead">{lead}</p> : null}
          {children ? <div className="sign-in-body">{children}</div> : null}
          {help ? <p className="sign-in-help">{help}</p> : null}
        </div>
        <footer className="sign-in-footer">
          <span>Kapileshwor Cargo Pvt. Ltd. · Kathmandu, Nepal</span>
        </footer>
      </div>
    </main>
  );
}
