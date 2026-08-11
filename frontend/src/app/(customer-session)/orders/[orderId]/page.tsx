/* The order screen's own sheet. Everything in it is scoped under `.op`, so it
   loads on this route and nowhere else — the archive entry at
   `/account/orders/<id>` is a different screen with a different job and keeps
   its own rules in `checkout.css`. */
import "@/styles/order.css";

import type { Metadata } from "next";
import { Suspense } from "react";

import { PageFrame } from "@/components/layout/page-frame";
import { OrderPlacedPage } from "@/features/07-orders/components/order-placed-page";
import { orderFixtures } from "@/features/07-orders/data/order-fixtures";
import { reservedOrderSlots } from "@/features/07-orders/data/order-slots";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

/**
 * `/orders/<id>` — where checkout lands.
 *
 * The record is resolved in the browser: an order placed on this device exists
 * only in its storage, so the server has nothing to look up. The Suspense
 * boundary is required rather than decorative — the screen reads `?placed=1` to
 * tell an arrival from a revisit, and a statically exported page cannot know
 * the query at build time.
 */
export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  return (
    <Suspense
      fallback={
        <PageFrame eyebrow="Order" title={<>Your <em>order</em></>}>
          <div className="co-load" role="status">
            Opening your order…
          </div>
        </PageFrame>
      }
    >
      <OrderPlacedPage orderId={orderId} />
    </Suspense>
  );
}

/* The same pool the archive route exports. An order placed in the browser takes
   a reserved slot precisely so the page it lands on has already been written
   out — see `order-slots.ts`. */
export function generateStaticParams() {
  return [...orderFixtures.map((order) => order.id), ...reservedOrderSlots].map((orderId) => ({
    orderId,
  }));
}
