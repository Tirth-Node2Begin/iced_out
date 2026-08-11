import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";

import "@/styles/new-home.css";
/* the catalogue's own sheet — additive, and loaded only by this route so the
   grid and filter bar can never reach /new-home or /new-woman */
import "@/styles/new-man.css";

import { BagDrawer } from "@/components/new-man/bag-drawer";
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
  title: "Iced_out — Men's training wear",
  description:
    "Performance-driven menswear: tees, joggers, thermals, and shells built for summer heat and winter cold.",
};

export default function NewManLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`nh-root ${archivo.variable}`}>
      <SmoothScroll>{children}</SmoothScroll>
      {/* The bag's confirmation, for the whole route. It belongs here rather
          than on either page because both fill the bag — the listing through
          quick-add, the detail page through its own CTA — and neither of them
          renders a header that mounts the storefront drawer. It portals to
          <body>, so being inside `.nh-root` costs it nothing. */}
      <BagDrawer />
    </div>
  );
}
