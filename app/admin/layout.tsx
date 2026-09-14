import { Inter } from "next/font/google";
import type { ReactNode } from "react";

const adminInter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-admin-inter",
});

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${adminInter.className} ${adminInter.variable} kcpl-admin-route`}>
      {children}
    </div>
  );
}
