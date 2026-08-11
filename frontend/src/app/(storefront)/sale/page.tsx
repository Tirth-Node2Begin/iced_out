import "@/styles/components/pages.css";

import { ProductListingPage } from "@/components/commerce/product-listing-page";

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
