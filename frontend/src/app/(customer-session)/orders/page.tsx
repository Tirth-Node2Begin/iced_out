/* The order screen's own sheet. Everything in it is scoped under `.op`, so it
   loads on this route and nowhere else. */
import "@/styles/order.css";

import type { Metadata } from "next";
import { Suspense } from "react";

import { SmoothScroll } from "@/components/new-home/smooth-scroll";
import { OrderPlacedRoute } from "@/features/07-orders/components/order-placed-route";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

/**
 * Where checkout lands.
 *
 * Addressed by `?id=` rather than by a path segment, and rendered entirely in
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
export default function OrderPage() {
  /* Lenis, as on the bag and About. Outside the boundary rather than inside it:
     the receipt is the longest screen in the group — lines, totals, timeline,
     address — and mounting the scroll inside would mean it only starts once the
     order has resolved, so the first flick after landing would still be a
     stepped one. Off under prefers-reduced-motion. */
  return (
    <SmoothScroll>
      <Suspense fallback={<div className="co-load" role="status">Opening your order…</div>}>
        <OrderPlacedRoute />
      </Suspense>
    </SmoothScroll>
  );
}
