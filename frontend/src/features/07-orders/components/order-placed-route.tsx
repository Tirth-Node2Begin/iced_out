"use client";

import { useSearchParams } from "next/navigation";

import { OrderPlacedPage } from "@/features/07-orders/components/order-placed-page";

/**
 * Reads which record this screen is for, in the browser.
 *
 * The whole app is client-rendered against the PHP API, so a record's identity
 * arrives as a query parameter rather than a path segment. See the route file for
 * why that is the only arrangement that works here.
 */
export function OrderPlacedRoute() {
  const orderId = useSearchParams().get("id") ?? "";
  return <OrderPlacedPage orderId={orderId} />;
}
