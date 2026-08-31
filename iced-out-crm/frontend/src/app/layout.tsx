import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

import "@/styles/index.css";

import { AppProviders } from "@/providers/app-providers";

/**
 * The CRM's family, declared on `<body>` so `--font-ui` resolves for the whole
 * document — including the surfaces Radix portals out of the shell, which would
 * otherwise render in the fallback face.
 *
 * INTER, not the storefront's display/body pair and not the Archivo this
 * started on. The shop has a wordmark voice to carry; the console has a table
 * of 13px cells, a rail of 13.5px labels and a row of 9.5px uppercase headers
 * to keep legible eighty times a day, and those are different jobs.
 *
 * Archivo is a grotesque with a narrow aperture and a low x-height for its
 * size. It is handsome at a headline and it closes up below about 12px, which
 * is most of this app. Inter was drawn for exactly this: tall x-height, open
 * counters, and a set of character variants that stop the ambiguities a
 * register cannot afford.
 *
 * The two features are not decoration:
 *   `tnum`  fixed-width digits, so a column of money lines up on the decimal
 *           point instead of shuffling as values change
 *   `cv05`  the lowercase `l` gets a tail, so `l` and `1` and `I` stop looking
 *           alike in an id like `mat-0001` or `IO-2026-1049`
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

/**
 * `absolute`, and `noindex` on every screen.
 *
 * Staff tabs carry the wordmark and nothing else, so a screen share never
 * announces which queue, which customer record, or which deal is open. And the
 * CRM must never be crawled: it is a separate host now, which means it has its
 * own robots surface rather than inheriting the storefront's.
 */
export const metadata: Metadata = {
  title: { absolute: "Iced Out CRM" },
  description: "Operations and relationships for Iced_out.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#101113",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
