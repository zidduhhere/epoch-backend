import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// latin-ext carries the rupee sign.
const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EPOCH 2026 Fund Collection",
  description: "Track student fund collection, cash handovers, and event expenses for EPOCH 2026.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={plex.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
