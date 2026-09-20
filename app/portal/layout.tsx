import type { Metadata } from "next";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";

const portalFont = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-portal-geist",
});

/*
 * The manifest is declared here rather than in the root layout so only the
 * portal is installable. The public marketing site is a site, and offering to
 * install it would be a prompt with nothing behind it.
 */
export const metadata: Metadata = {
  manifest: "/portal.webmanifest",
  appleWebApp: { capable: true, title: "KCPL Portal", statusBarStyle: "default" },
};

/*
 * The customer portal renders on the same foundation as the staff product:
 * `kcpl-admin-route` carries the operations-system.css token block, and the
 * portal shell nests `kcpl-admin-shell` / `kcpl-admin-content` inside it so
 * every Ops primitive is styled by the one authoritative sheet. The extra
 * `kcpl-portal-route` class is a modifier, not a second design system -- it
 * only replaces the staff chrome offsets (fixed sidebar, fixed toolbar) that a
 * customer surface does not have.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${portalFont.className} ${portalFont.variable} kcpl-admin-route kcpl-portal-route`}>
      {children}
    </div>
  );
}
