import type { Metadata } from "next";

import { CheckoutPage } from "@/features/04-cart/components/checkout-page";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function Checkout() {
  return <CheckoutPage />;
}
