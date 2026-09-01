import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

import { sectionTitle } from "@/lib/tab-title";

/* The base sheet — the palette, the type scale, the gutter and the bar. */
import "@/styles/new-home.css";
/* The men's catalogue sheet. This route renders that section rather than a
   second copy of it, so it needs the rules that draw it — and with them, the
   quick-add panel a tile opens and the bag drawer that confirms an add. */
import "@/styles/new-man.css";
/* This floor's own sheet. Additive over both, and scoped under `.men-root`. */
import "@/styles/men.css";

import { BagDrawer } from "@/components/new-man/bag-drawer";
import { SmoothScroll } from "@/components/new-home/smooth-scroll";

/**
 * Archivo carries both axes the headline needs: the heavy cut for the opening
 * clauses and a light, slightly expanded cut for the closing one.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: sectionTitle("Men"),
  description:
    "The men's edit: heavyweight shells, dry canvas and a shoulder cut that never fights the sleeve — outerwear, knitwear, trousers, tops and accessories, sized XS through XL.",
};

export default function MenLayout({ children }: { children: ReactNode }) {
  return (
    /* Two roots, one element. `.nh-root` declares the palette, the easing and
       the gutter; `.men-root` adds this floor's cold accent set on top of them
       and scopes every rule in men.css. */
    <div className={`nh-root men-root ${archivo.variable}`}>
      <SmoothScroll>{children}</SmoothScroll>
      {/* The bag's confirmation. This route fills the bag through the
          catalogue's quick-add and renders no header that mounts the storefront
          drawer, so without this a successful add would look like nothing
          happened. It portals to <body>, so living inside `.nh-root` costs it
          nothing. */}
      <BagDrawer shopHref="/men" />
    </div>
  );
}
