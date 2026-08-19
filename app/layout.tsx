import type { Metadata } from "next";
import { Instrument_Serif, Manrope, Noto_Serif_Devanagari } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400" });
const notoDevanagari = Noto_Serif_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"], weight: ["400", "600"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og-cinematic.jpg`;
  const title = "Kapileshwor Cargo | Import & Export Logistics in Nepal";
  const description = "Import, export and cross-border freight coordination through Nepal's logistics gateways and international trade connections.";
  return {
    title: { default: title, template: "%s | Kapileshwor Cargo" },
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, images: [{ url: image, width: 1728, height: 910, alt: "KCPL — Moving Nepal. Connecting the World." }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${instrumentSerif.variable} ${notoDevanagari.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
