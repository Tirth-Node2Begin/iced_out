import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

import "@/styles/components/commerce.css";
import "@/styles/components/sections.css";
/* the header is the new-home bar; its rules ship with the rest of that build */
import "@/styles/new-home.css";
/* …and chrome.css layers the responsive bar, the search dock and the shared
   page frame the bag/wishlist/profile screens are built on over the top */
import "@/styles/chrome.css";

import { StorefrontShell } from "@/components/layout/storefront-shell";

/** The same cut and axes the new home and About experiences load for the bar. */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return <StorefrontShell navFontClassName={archivo.variable}>{children}</StorefrontShell>;
}
