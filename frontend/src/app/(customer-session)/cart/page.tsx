import type { Metadata } from "next";

import { CartPageContent } from "@/components/commerce/cart-page-content";
import { SmoothScroll } from "@/components/new-home/smooth-scroll";

export const metadata: Metadata = { title: "Bag", robots: { index: false, follow: false } };

/* No <Container>: the bag is built on <PageFrame>, which owns its own gutter
   and max-width so the head and the lines share one measure.

   No <CustomerGate> either. The bag is readable signed out — see the note on
   the route rules — and the session is asked for at checkout, one press later,
   where it is actually needed. */
export default function CartPage() {
  /* Lenis, the same instance About runs. It drives the window rather than any
     element, so mounting it around the content here is the whole of it — no
     layout file needed for one route. Off under prefers-reduced-motion. */
  return (
    <SmoothScroll>
      <CartPageContent />
    </SmoothScroll>
  );
}
