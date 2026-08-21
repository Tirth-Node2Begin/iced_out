"use client";

import { useSearchParams } from "next/navigation";

import { AdminOrderDetail } from "@/features/07-orders/components/admin-order-detail";

/**
 * Reads which record this screen is for.
 *
 * A client component of its own rather than a `render` prop handed down from the
 * route: a function cannot cross the server/client boundary, and the route file
 * is a server component. This is the same shape `ProductEditorRoute` has always
 * had — see the route's note for why the id is in the query at all.
 */
export function OrderDetailRoute() {
  const id = useSearchParams().get("id") ?? "";
  return <AdminOrderDetail orderId={id} />;
}
