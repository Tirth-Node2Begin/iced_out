"use client";

import { useSearchParams } from "next/navigation";

import { AdminProductEditor } from "@/features/02-products/components/admin-product-editor";

/** Reads which product the editor is for. See the route's own note for why. */
export function ProductEditorRoute() {
  const productId = useSearchParams().get("id") ?? "";
  return <AdminProductEditor productId={productId} />;
}
