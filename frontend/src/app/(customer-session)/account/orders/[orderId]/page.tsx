import type { Metadata } from "next";
import { Suspense } from "react";

import { CustomerOrderDetail } from "@/features/07-orders/components/customer-order-detail";
import { orderFixtures } from "@/features/07-orders/data/order-fixtures";
import { reservedOrderSlots } from "@/features/07-orders/data/order-slots";

/* No order number in the tab: it is a customer record, and tabs end up in
   screenshots and shared screens. */
export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  /* The record itself is resolved in the browser: an order placed on this
     device only exists in its storage, so the server has nothing to look up.
     The boundary is required because the screen reads `?placed=1` to decide
     whether it is a thank-you or an archive entry, and a statically exported
     page cannot know the query at build time. */
  return (
    <Suspense fallback={<div className="co-load">Opening your order…</div>}>
      <CustomerOrderDetail orderId={orderId} />
    </Suspense>
  );
}

export function generateStaticParams() {
  return [...orderFixtures.map((order) => order.id), ...reservedOrderSlots].map((orderId) => ({
    orderId,
  }));
}
