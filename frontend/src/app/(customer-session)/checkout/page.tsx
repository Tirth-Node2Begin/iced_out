import type { Metadata } from "next";

import { CheckoutRoute } from "@/features/04-cart/components/checkout-route";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

/**
 * `/checkout` is no longer a screen — it is a door.
 *
 * The checkout itself is a modal that opens over whatever the shopper is
 * looking at, so this route has nothing left to render. It is kept because
 * things still point at it and should keep working: the customer wall in
 * `route-rules.ts` is written against this path, the login screen returns to
 * it, `/checkout/payment` redirects to it, and a bookmark from before any of
 * this is still a bookmark. All of them now land on the bag with checkout
 * open on top of it.
 */
export default function Checkout() {
  return <CheckoutRoute />;
}
