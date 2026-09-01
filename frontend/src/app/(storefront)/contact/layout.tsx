import type { Metadata } from "next";
import type { ReactNode } from "react";

/* The page's own sheet. Everything in it is scoped under `.ct-root`, including
   the block that re-points the shadcn tokens at the nh palette — so it has to
   load on this route and nowhere else. */
import "@/styles/contact.css";

import { SmoothScroll } from "@/components/new-home/smooth-scroll";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach a human at Iced_out. Sizing, shipping, returns and order questions — answered within two business days.",
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  /* Lenis, the same instance About runs: this page is three tall plates read in
     one pass, and the eased position is what stops the channel row and the FAQ
     arriving in wheel-sized steps. It mounts here rather than in the
     `(storefront)` layout so only this route pays for it, and it disables
     itself outright under prefers-reduced-motion. */
  return <SmoothScroll>{children}</SmoothScroll>;
}
