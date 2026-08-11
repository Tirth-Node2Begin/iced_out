import type { Metadata } from "next";

import { CartPageContent } from "@/components/commerce/cart-page-content";

export const metadata: Metadata = { title: "Bag", robots: { index: false, follow: false } };

/* No <Container>: the bag is built on <PageFrame>, which owns its own gutter
   and max-width so the head and the lines share one measure.

   No <CustomerGate> either. The bag is readable signed out — see the note on
   the route rules — and the session is asked for at checkout, one press later,
   where it is actually needed. */
export default function CartPage() {
  return <CartPageContent />;
}
