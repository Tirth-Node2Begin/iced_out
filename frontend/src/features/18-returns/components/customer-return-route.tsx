"use client";

import { useSearchParams } from "next/navigation";

import { CustomerReturnDetail } from "@/features/18-returns/components/customer-return-detail";

/**
 * Reads which record this screen is for, in the browser.
 *
 * The whole app is client-rendered against the PHP API, so a record's identity
 * arrives as a query parameter rather than a path segment. See the route file for
 * why that is the only arrangement that works here.
 */
export function CustomerReturnRoute() {
  const returnId = useSearchParams().get("id") ?? "";
  return <CustomerReturnDetail returnId={returnId} />;
}
