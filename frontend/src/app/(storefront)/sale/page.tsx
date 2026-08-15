import "@/styles/components/pages.css";

import type { Metadata } from "next";

import { ProductListingPage } from "@/components/commerce/product-listing-page";

export const metadata: Metadata = {
  title: "Sale",
  description: "Last sizes from closed runs. No restocks once these editions disappear.",
};

export default function SalePage() {
  return (
    <ProductListingPage
      eyebrow="Final editions"
      title="Sale."
      copy="Last sizes from closed runs. No restocks once these editions disappear."
      destination="sale"
    />
  );
}
