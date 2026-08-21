"use client";

import { useSearchParams } from "next/navigation";

import { ProductDetail } from "@/features/02-products/components/product-detail";

/**
 * Reads which record this screen is for, in the browser.
 *
 * The whole app is client-rendered against the PHP API, so a record's identity
 * arrives as a query parameter rather than a path segment. See the route file for
 * why that is the only arrangement that works here.
 */
export function ProductRoute() {
  const slug = useSearchParams().get("slug") ?? "";
  return <ProductDetail slug={slug} />;
}
