"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  filterProducts,
  type ProductListInput,
} from "@/features/02-products/api/product-repository";
import {
  catalogStore,
  collectionsStore,
  productRecord,
  trendingStore,
  type StoreCollection,
} from "@/features/02-products/catalog-store";
import type { Product } from "@/features/02-products/types/product";

export const productKeys = {
  all: ["products"] as const,
  list: (input: ProductListInput) => ["products", "list", input] as const,
  detail: (slug: string) => ["products", "detail", slug] as const,
};

/** What every catalogue-reading screen gets: the rows and how the read went. */
export type CatalogQuery<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  /** False until the API has answered — tells "no matches" apart from "not yet". */
  loaded: boolean;
};

/** The whole published catalogue, loading on first read. */
export function useCatalog(): CatalogQuery<Product[]> {
  const state = useSyncExternalStore(
    catalogStore.subscribe,
    catalogStore.getSnapshot,
    catalogStore.getServerSnapshot,
  );

  return state;
}

/**
 * A memo dependency that changes when the catalogue does — and, by being read,
 * makes sure the catalogue is being loaded at all.
 *
 * For the display layers that resolve a slug against the catalogue through a
 * plain function rather than a hook (`productFor`, `sizesFor`, `exchangeOptions`,
 * `resolveSavedItems`). Those read the store synchronously, so without this they
 * would compute once against an empty catalogue — before the request landed —
 * and never recompute. Passing this into their `useMemo` deps is what makes them
 * settle on the real answer.
 *
 * The value itself is only ever a dependency; nothing should read it.
 */
export function useCatalogVersion(): unknown {
  return useCatalog().data;
}

/**
 * The catalogue, narrowed to a destination and a query.
 *
 * Returns the rows directly, as it always has, so the listing pages and the
 * search dock did not have to change shape when this stopped being a fixture
 * read. Use `useCatalogQuery` where the screen needs to say "loading" or "that
 * did not load" rather than just showing nothing.
 */
export function useProducts(input: ProductListInput = {}): Product[] {
  return useCatalogQuery(input).data;
}

/** `useProducts` plus the read's state, for a screen with an empty case to draw. */
export function useCatalogQuery(input: ProductListInput = {}): CatalogQuery<Product[]> {
  const { destination, query } = input;
  const { data, loading, error, loaded } = useCatalog();

  /* Depends on the two primitives rather than on `input`, which is a fresh
     object on every render of every caller. */
  const filtered = useMemo(
    () => filterProducts(data, { destination, query }),
    [data, destination, query],
  );

  return { data: filtered, loading, error, loaded };
}

/**
 * One product, by slug.
 *
 * Asked of the API directly rather than found in the list: a product page is
 * reachable by link, so the visitor who lands on it may have no catalogue loaded
 * — and waiting for the whole list to arrive to render one product would be a
 * slower first paint for no benefit.
 */
export function useProduct(slug: string): CatalogQuery<Product | null> {
  /* A store per slug rather than an effect that setStates: this repo lints the
     latter as an error, and it is the right call — the store owns the load, joins
     concurrent readers onto one request, and holds the answer across a navigation
     away and back. */
  const record = productRecord(slug);

  return useSyncExternalStore(record.subscribe, record.getSnapshot, record.getServerSnapshot);
}

/**
 * The trending ranking, in the server's order.
 *
 * Kept out of `useCatalog` on purpose: this is a different endpoint answering a
 * different question, and the two must not share a store — the catalogue is
 * "everything for sale, in the operator's order" and this is "what is selling,
 * best first". Sorting the first into the second in the browser is not possible
 * anyway; the ranking is derived from the order book.
 *
 * Returns the state as well as the rows, so a rail can stay quiet while the read
 * is in flight rather than flashing an empty section.
 */
export function useTrending(): CatalogQuery<Product[]> {
  return useSyncExternalStore(
    trendingStore.subscribe,
    trendingStore.getSnapshot,
    trendingStore.getServerSnapshot,
  );
}

/**
 * The shop's live chapters, in the operator's order.
 *
 * First row is the CURRENT one — `collections.position` is what the console
 * reorders, so "this season" is a fact somebody maintains rather than a date
 * this code guesses. Used by the home page's seasonal row to decide which
 * chapter to stand on the front door when nothing is badged new.
 */
export function useCollections(): CatalogQuery<StoreCollection[]> {
  return useSyncExternalStore(
    collectionsStore.subscribe,
    collectionsStore.getSnapshot,
    collectionsStore.getServerSnapshot,
  );
}
