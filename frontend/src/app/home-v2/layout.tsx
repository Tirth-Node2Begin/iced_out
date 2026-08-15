import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

/* The site bar ships with the new-home build; its rules live under
   `.nh-nav-scope`, which is self-contained and does not reach page content. */
import "@/styles/new-home.css";
import "@/styles/home-v2.css";

import { Header } from "@/components/layout/header";
import { AosProvider } from "@/components/home-v2/aos-provider";
import { BrandMorph } from "@/components/home-v2/brand-morph";
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

export default function HomeV2Layout({ children }: { children: ReactNode }) {
  return (
    /* BrandMorph wraps both the bar and the page: the wordmark slot and the
       hero title have to register with the same provider. */
    <div className={`hv2 ${archivo.variable}`}>
      <BrandMorph>
        <Header fontClassName={archivo.variable} />
        <SmoothScroll>
          <AosProvider>{children}</AosProvider>
        </SmoothScroll>
      </BrandMorph>
    </div>
  );
}
