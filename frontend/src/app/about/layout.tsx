import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

import "@/styles/new-home.css";
import "@/styles/about.css";

import { BrandMorph } from "@/components/home-v2/brand-morph";
import { SmoothScroll } from "@/components/new-home/smooth-scroll";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "About — Built with intent",
  description:
    "Inside Iced_out: limited-run streetwear shaped by weight, movement, and life after dark.",
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return (
    /* BrandMorph wraps the bar and the page together, exactly as the site root
       does: the hero headline and the bar's wordmark slot both have to register
       with the same provider for the flight to have two ends. */
    <div className={`nh-root nh-about-root ${archivo.variable}`}>
      <BrandMorph>
        <SmoothScroll>{children}</SmoothScroll>
      </BrandMorph>
    </div>
  );
}
