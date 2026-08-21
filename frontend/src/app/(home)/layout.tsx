import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

/* The site bar ships with the new-home build; its rules live under
   `.nh-nav-scope`, which is self-contained and does not reach page content. */
import "@/styles/new-home.css";
import "@/styles/chrome.css";
import "@/styles/home-v2.css";
/* The craft chapter below the founders is the About page's, and its rules live
   in that route's sheet. Every selector in it is namespaced under `.nh-about*`,
   so loading it here adds the chapter without reaching anything else. */
import "@/styles/about.css";

import { Header } from "@/components/layout/header";
import { AosProvider } from "@/components/home-v2/aos-provider";
import { SmoothScroll } from "@/components/home-v2/smooth-scroll";

/**
 * Archivo is the site's family (new_style §3.1), loaded with the `wdth` axis
 * because the design system uses width as a design dimension — the oversized
 * footer wordmark is set at 118%.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Home",
  description:
    "Heavyweight streetwear engineered for after dark. Limited by design.",
};

export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`hv2 hv2-home ${archivo.variable}`}>
      <Header fontClassName={archivo.variable} />
      <SmoothScroll>
        <AosProvider>{children}</AosProvider>
      </SmoothScroll>
    </div>
  );
}
