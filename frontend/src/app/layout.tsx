import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

import "@fontsource-variable/manrope";
import "@fontsource-variable/syne";
import "@fontsource/roboto-mono/latin-400.css";
import "@/styles/index.css";

import { AppProviders } from "@/providers/app-providers";
import { SITE_NAME, TAB_TEMPLATE } from "@/lib/tab-title";

/**
 * The site's family (new_style §3.1), declared on `<body>` so `--font-archivo`
 * resolves for the whole document.
 *
 * Each route group also loads its own instance — that is fine, they dedupe to
 * the same files — but a group's variable only reaches the elements inside it.
 * The header's search dock and menu sheet portal to `document.body` to escape
 * the sticky bar's stacking context, which puts them outside every one of those
 * scopes; without this they rendered in the fallback face.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://iced-out.example"),
  /** `Iced Out • <page>` — see `@/lib/tab-title` for the rule and its exception. */
  title: {
    default: SITE_NAME,
    template: TAB_TEMPLATE,
  },
  description:
    "Limited-run heavyweight streetwear engineered for after dark. Discover Drop 001 by Iced_out.",
  applicationName: "Iced_out",
  keywords: ["streetwear", "clothing", "limited drop", "Indian fashion", "Iced_out"],
  openGraph: {
    title: "Iced_out — Cold by nature",
    description: "Heavyweight streetwear. Limited by design.",
    type: "website",
    images: [
      {
        url: "/images/iced-out-og.jpg",
        width: 1200,
        height: 630,
        alt: "Iced_out Drop 001 campaign",
      },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#121212",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={archivo.variable}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
