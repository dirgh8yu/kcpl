import { Geist } from "next/font/google";
import type { ReactNode } from "react";

const adminFont = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-admin-geist",
});

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${adminFont.className} ${adminFont.variable} kcpl-admin-route`}>
      {children}
    </div>
  );
}
