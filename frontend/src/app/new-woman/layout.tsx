import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

import { sectionTitle } from "@/lib/tab-title";

/* The base sheet — the palette, the type scale, the gutter and the bar. */
import "@/styles/new-home.css";
/* The men's catalogue sheet, for the two things this route BORROWS from it
   rather than rebuilding: the quick-add panel a tile opens and the bag drawer
   that confirms an add, plus the shared crop arithmetic every framed
   photograph in the shop resolves through (`.nmp-frame img`). Loading it does
   not restyle anything here — its own rules hang off `.nh-cat`, `.nh-mcard`
   and `.nh-filter`, none of which this page draws. */
import "@/styles/new-man.css";
/* This floor's own sheet. Additive over both, and scoped under `.nw-root`. */
import "@/styles/new-woman.css";

import { BagDrawer } from "@/components/new-man/bag-drawer";
import { SmoothScroll } from "@/components/new-home/smooth-scroll";

/**
 * Archivo carries both axes this page's headlines need: the heavy cut for the
 * opening clause and a light, slightly expanded cut for the closing one.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  /* A section, not a leaf: `/piece` titles itself under this. */
  title: sectionTitle("Women"),
  description:
    "The women's edit: structured volume and monochrome layers in numbered runs — outerwear, knitwear, trousers, tops and accessories, sized XS through XL.",
};

export default function NewWomanLayout({ children }: { children: ReactNode }) {
  return (
    /* Two roots, one element. `.nh-root` declares the palette, the easing and
       the gutter; `.nw-root` adds this floor's warm accent set on top of them
       and scopes every rule in new-woman.css. */
    <div className={`nh-root nw-root ${archivo.variable}`}>
      <SmoothScroll>{children}</SmoothScroll>
      {/* The bag's confirmation, for the whole route. It belongs here rather
          than on either page because both fill the bag — the listing through
          quick-add, the detail page through its own CTA — and neither renders
          a header that mounts the storefront drawer. It portals to <body>, so
          living inside `.nh-root` costs it nothing. */}
      <BagDrawer shopHref="/new-woman" />
    </div>
  );
}
