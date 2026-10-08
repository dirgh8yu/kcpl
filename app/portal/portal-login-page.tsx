import Link from "next/link";
import { SignInLayout } from "../admin/sign-in-layout";
import { PortalLogin } from "./portal-login";

export function PortalLoginPage({ notice }: { notice?: string }) {
  return (
    <SignInLayout
      title="Sign in to the customer portal"
      lead="Your shipments, documents and invoices with KCPL."
      help={<>No login yet? Your KCPL account manager can set one up. To follow a single shipment, <Link href="/track">track it without signing in</Link>.</>}
    >
      {notice ? <p className="sign-in-notice">{notice}</p> : null}
      <PortalLogin/>
    </SignInLayout>
  );
}
