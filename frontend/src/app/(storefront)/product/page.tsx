import "@/styles/components/pages.css";

import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductRoute } from "@/features/02-products/components/product-route";

/* The piece's own name cannot be in the tab any more: the title is set at
   build time and the product is only known in the browser. The detail screen
   sets `document.title` once it has the record. */
export const metadata: Metadata = { title: "Product" };

/**
 * One product, as a shopper sees it.
 *
 * Addressed by `?slug=` rather than by a path segment, and rendered entirely in
 * the BROWSER.
 *
 * This site is a static export served in front of a PHP API, which means a
 * dynamic segment can only exist for the values `generateStaticParams` knew at
 * BUILD time. The records this screen is for do not exist then — a product listed
 * this morning, an order placed a minute ago — so the route had to enumerate them
 * in advance. It did that by fetching at build time and, for records created in
 * the browser, by handing them ids out of a pre-exported "reserved slot" pool.
 *
 * One static route addressed by a query serves every record there will ever be,
 * with no build-time data read and no slot pool. That is the trade: the id moves
 * out of the path.
 *
 * The Suspense boundary is required, not decorative — `useSearchParams` suspends
 * on the prerender pass, and without it the whole route opts out of prerendering.
 */
export default function ProductPage() {
  return (
    <Suspense fallback={<div className="co-load">Loading this piece…</div>}>
      <ProductRoute />
    </Suspense>
  );
}
