import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

import "@/styles/new-home.css";

import { SmoothScroll } from "@/components/new-home/smooth-scroll";

/**
 * Archivo carries both axes the reference headlines need: the heavy cut for
 * the opening clause and a light, slightly expanded cut for the closing one.
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
    "Performance-driven training wear built for summer heat and winter cold.",
};

export default function NewHomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`nh-root ${archivo.variable}`}>
      <SmoothScroll>{children}</SmoothScroll>
    </div>
  );
}
