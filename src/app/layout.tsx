import type { Metadata } from "next";
import { Instrument_Serif, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

/* Two families only. Schibsted Grotesk carries everything;
   Instrument Serif is reserved for italic display accents. */
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-schibsted",
});

const instrument = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: "CreatorOS — Run your entire creator business from one link",
  description:
    "CreatorOS replaces Linktree, Calendly, Topmate and manual UPI collection. Bookings, payments, digital products and WhatsApp automation — one link, 0% commission.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${schibsted.variable} ${instrument.variable}`}>
      <body className="font-body bg-cream text-ink antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
