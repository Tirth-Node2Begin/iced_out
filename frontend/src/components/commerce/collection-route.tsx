"use client";

import { useSearchParams } from "next/navigation";

import { ProductListingPage } from "@/components/commerce/product-listing-page";

/**
 * Reads which record this screen is for, in the browser.
 *
 * The whole app is client-rendered against the PHP API, so a record's identity
 * arrives as a query parameter rather than a path segment. See the route file for
 * why that is the only arrangement that works here.
 */
export function CollectionRoute() {
  const slug = useSearchParams().get("slug") ?? "";
  return (
    <ProductListingPage
      copy="One chapter, built to layer together and released in limited numbers."
      destination={`collection:${slug}`}
      eyebrow="Iced_out / Collection"
      /* The collection's NAME comes from the catalogue the listing already loads,
         so it is not repeated here — this used to hold a hardcoded map of three
         slugs to three names, which meant a collection created in the console had
         no title. */
      title={slug ? `${slug.replaceAll("-", " ")}.` : "Collection."}
    />
  );
}
