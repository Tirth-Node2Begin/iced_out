import { Suspense } from "react";

import { AdminRouteLoading } from "@/components/shell/admin-route-loading";
import { ProductEditorRoute } from "@/features/02-products/components/product-editor-route";

/**
 * The editor for one product, addressed by query rather than by path segment.
 *
 * `[productId]` cannot serve this. The console is a static export, which means
 * every dynamic segment has to be named in `generateStaticParams` at build
 * time — so a product created in the register a minute ago has no page, and
 * opening it is a 500 rather than an editor. One static route reading `?id=`
 * works for every product there will ever be.
 *
 * The Suspense boundary is required: `useSearchParams` suspends on the
 * prerender pass, and without it the whole route opts out of prerendering.
 */
export default function ProductEditorPage() {
  return (
    <Suspense fallback={<AdminRouteLoading />}>
      <ProductEditorRoute />
    </Suspense>
  );
}
