"use client";

import { publicClient } from "@/api/clients";
import type { Product } from "@/features/02-products/types/product";
import { createRecordCache, createRemoteStore } from "@/lib/remote-store";

/**
 * What the shop is selling — read from the database, not from the bundle.
 *
 * This replaces `product-fixtures.ts`, which was an array of five products
 * compiled into the JavaScript. That array is why the two halves of this project
 * were disconnected: an operator could create a product in `/admin`, watch it
 * appear in the register, and it would never show up in the shop, because the
 * shop was not reading the same data — it was not reading data at all.
 *
 * `GET /catalog/products` returns only Published products, so the console's
 * status field is what decides whether a shopper can see something. Publish a
 * Draft and it appears here on the next load; move it back to Draft and it
 * leaves.
 *
 * ONE store for the whole storefront, rather than a fetch per screen. The grid,
 * the search dock, the listing pages, the bag's restore and the wishlist all
 * resolve against the same list, which is what stops two surfaces quoting
 * different prices for the same product.
 */
export const catalogStore = createRemoteStore<Product>(async () => {
  const response = await publicClient.get<{ data: Product[] }>("/catalog/products");
  return response.data.data;
});

/**
 * One product by slug, straight from the API.
 *
 * Asked of the server rather than filtered out of the list, because a product
 * page is reachable directly: somebody following a link has no list loaded, and
 * a 404 from here is the honest answer for a slug that is not published.
 */
export async function fetchProduct(slug: string): Promise<Product | null> {
  try {
    const response = await publicClient.get<{ data: Product }>(
      `/catalog/products/${encodeURIComponent(slug)}`,
    );
    return response.data.data;
  } catch {
    /* Missing and unpublished are the same answer on purpose — see the
       controller. Either way there is nothing to show. */
    return null;
  }
}

/**
 * One product's own store, keyed by slug.
 *
 * Held rather than fetched per mount, so opening a product page, going back and
 * opening it again is one request — and so `useProduct` can subscribe to it
 * instead of running an effect that sets state.
 *
 * A missing or unpublished slug resolves to `null` rather than rejecting, because
 * "there is nothing here" is an answer and the page has a state for it.
 */
export const productRecord = createRecordCache<Product | null>((slug) => fetchProduct(slug));

/**
 * The catalogue, awaited. For a caller that is not a component: the bag turning
 * stored product ids back into products on restore, and the wishlist doing the
 * same for saved ids.
 */
export function loadCatalog(): Promise<Product[]> {
  return catalogStore.load();
}

/** Held rows without triggering a load — for a synchronous lookup that can miss. */
export function heldProducts(): Product[] {
  return catalogStore.peek().data;
}
