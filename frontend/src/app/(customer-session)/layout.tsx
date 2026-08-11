import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

import "@/styles/components/commerce.css";
import "@/styles/components/pages.css";
import "@/styles/components/sections.css";
/* The bar's own rules ship with the /new-home build. This group renders the
   same header as the storefront, so it has to load them too — without this the
   bag, checkout and account routes were mounting an unstyled nav. */
import "@/styles/new-home.css";
import "@/styles/chrome.css";
/* Last, so the checkout, payment and order rules layer over the shared
   `.io-scope` component set rather than under it. */
import "@/styles/checkout.css";

import { StorefrontShell } from "@/components/layout/storefront-shell";

/** The same cut and axes every other surface loads for the bar (new_style §3.1). */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function CustomerSessionLayout({ children }: { children: ReactNode }) {
  return <StorefrontShell navFontClassName={archivo.variable}>{children}</StorefrontShell>;
}
