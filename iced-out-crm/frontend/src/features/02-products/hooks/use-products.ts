"use client";

import { useSyncExternalStore } from "react";

import { catalogStore } from "@/features/02-products/catalog-store";
import type { Product } from "@/features/02-products/types/product";

/**
 * Reading the catalogue for a PRICE.
 *
 * The storefront's copy of this file also exports `useProducts`,
 * `useCatalogQuery`, `useProduct` and `productKeys` — the hooks its grid, search
 * dock, listing pages and product page read through. None of those screens
 * exists here, so none of those hooks does either: the CRM's catalogue screens
 * go through `catalog-context`, which is the editable register, not this.
 *
 * What is left is the one thing this app genuinely needs a catalogue for — the
 * exchange balance on the returns screens, which has to know what a replacement
 * piece is worth.
 */

/** What every catalogue-reading screen gets: the rows and how the read went. */
export type CatalogQuery<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  /** False until the API has answered — tells "no matches" apart from "not yet". */
  loaded: boolean;
};

/** The catalogue, loading on first read. */
export function useCatalog(): CatalogQuery<Product[]> {
  return useSyncExternalStore(
    catalogStore.subscribe,
    catalogStore.getSnapshot,
    catalogStore.getServerSnapshot,
  );
}

/**
 * A memo dependency that changes when the catalogue does — and, by being read,
 * makes sure the catalogue is being loaded at all.
 *
 * For the display layers that resolve a name against the catalogue through a
 * plain function rather than a hook (`replacementPrice`, `balanceOf`). Those
 * read the store synchronously, so without this they would compute once against
 * an empty catalogue — before the request landed — and never recompute.
 *
 * The value itself is only ever a dependency; nothing should read it.
 */
export function useCatalogVersion(): unknown {
  return useCatalog().data;
}
