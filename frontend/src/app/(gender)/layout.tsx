import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

/* the bar's own rules ship with the /new-home build; the blinds primitive
   travels with them, and `gender.css` layers this experience on top.
   `drop.css` is /new-drop's own two sections — it comes last because its
   re-skins of the shadcn primitives have to outrank the Tailwind utilities
   those primitives ship with. */
import "@/styles/new-home.css";
import "@/styles/chrome.css";
import "@/styles/gender.css";
import "@/styles/drop.css";

import { GenderHeader } from "@/components/gender/header";
import { SmoothScroll } from "@/components/new-home/smooth-scroll";

/**
 * The listing route group.
 *
 * /new-drop (the men's edit) and /women deliberately sit outside
 * `(storefront)`: they carry their own bar treatment (light over the hero,
 * frosted over the grid) and their own footer, and inheriting the storefront
 * shell would give them a second one.
 *
 * Archivo is loaded with the width axis as well as weight — `font-stretch` is a
 * design dimension on this surface, not decoration (new_style.md §3.1).
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export default function GenderLayout({ children }: { children: ReactNode }) {
  return (
    <div className={archivo.variable}>
      <GenderHeader fontClassName={archivo.variable} />
      {/* Lenis drives the page: the sticky filter bar, the pinned parallax and
          the marquee bands all read smoother against an eased scroll position.
          It disables itself outright when the visitor asks for reduced motion. */}
      <SmoothScroll>{children}</SmoothScroll>
    </div>
  );
}
