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

/**
 * How many ranked rows the trending rail asks for.
 *
 * More than the four the home page draws, on purpose: the rail alternates men
 * and women down its four slots, so it needs enough of BOTH in the ranking to
 * fill them. Four rows would leave a slot empty the moment the top four all
 * happened to be menswear.
 */
export const TRENDING_LIMIT = 16;

/**
 * What is actually selling — `GET /catalog/trending`, ranked by the server.
 *
 * A store of its own rather than a sort applied to `catalogStore`, because the
 * ORDER is the payload here: the ranking is computed from the order book (units
 * shipped over a rolling window, returns taken back out) and the browser has no
 * way to derive it from a product list. Reordering the catalogue client-side
 * could only ever fake it.
 *
 * Rows are the same `Product` shape the catalogue returns, so everything that
 * already renders a product — the card, the bag, the wishlist — works on these
 * unchanged. The rank lives in the array's order and nowhere else.
 */
export const trendingStore = createRemoteStore<Product>(async () => {
  const response = await publicClient.get<{ data: Product[] }>("/catalog/trending", {
    params: { limit: TRENDING_LIMIT },
  });
  return response.data.data;
});

/**
 * A live collection — the shop's chapters, in the operator's own order.
 *
 * `GET /catalog/collections` serves only the ones marked `Live`, so a chapter
 * the console has scheduled but not announced is not in this list. `pieces` is
 * how many products the collection holds, counted server-side.
 */
export type StoreCollection = {
  slug: string;
  name: string;
  pieces: number;
};

/**
 * The chapters the shop is currently running.
 *
 * A store of its own rather than something derived from the catalogue: the rows
 * carry the operator's ORDERING (`collections.position`), which is what makes
 * "the current chapter" a fact the console owns rather than a guess the browser
 * makes from product data. Deriving the list by collecting distinct
 * `product.collection` strings would lose that order, lose the empty chapters,
 * and include ones that are not Live.
 */
export const collectionsStore = createRemoteStore<StoreCollection>(async () => {
  const response = await publicClient.get<{ data: StoreCollection[] }>("/catalog/collections");
  return response.data.data;
});
