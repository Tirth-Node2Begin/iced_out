"use client";

import { useSyncExternalStore } from "react";

import { adminClient } from "@/api/clients";
import {
  CATEGORIES as FALLBACK_CATEGORIES,
  SIZES_BY_CATEGORY as FALLBACK_SIZES,
  TYPES_BY_CATEGORY as FALLBACK_TYPES,
} from "@/features/03-inventory/data/stock-fixtures";
import { createRemoteRecord } from "@/lib/remote-store";

/**
 * What a stock item can be, read from the store's own settings.
 *
 * These three lists — the categories, the sizes each one is stocked in, and the
 * garment types each one covers — were written out in the frontend as constants.
 * They are `store_settings.inventory` on the server, which is where they belong:
 * the API validates against whatever that table says today, so a list hardcoded
 * here could only ever be a copy that goes stale.
 *
 * It did go stale. `Accessory` was added to the settings vocabulary so that a
 * pouch, a chain or a boot could be taken into stock at all — and the item form
 * went on offering `Top` and `Bottom`, so the six accessories in the catalogue
 * could not be edited without changing what they are.
 *
 * The constants are kept as the FALLBACK, for the moment before the settings
 * request lands: a form that opens with an empty category dropdown is worse than
 * one that opens with the common two and gains the third a beat later.
 */

type Inventory = {
  categories?: string[];
  sizes_by_category?: Record<string, string[]>;
  types_by_category?: Record<string, string[]>;
};

const record = createRemoteRecord<Inventory>(async () => {
  const response = await adminClient.get<{ data: { inventory?: Inventory } }>(
    "/admin/settings/store",
  );
  return response.data.data.inventory ?? {};
});

export type InventoryVocabularies = {
  categories: string[];
  sizesByCategory: Record<string, string[]>;
  typesByCategory: Record<string, string[]>;
};

export function useInventoryVocabularies(): InventoryVocabularies {
  const state = useSyncExternalStore(
    record.subscribe,
    record.getSnapshot,
    record.getServerSnapshot,
  );

  const inventory = state.data;

  return {
    categories: inventory?.categories?.length ? inventory.categories : FALLBACK_CATEGORIES,
    sizesByCategory: inventory?.sizes_by_category ?? FALLBACK_SIZES,
    typesByCategory: inventory?.types_by_category ?? FALLBACK_TYPES,
  };
}

/** Drops the held settings — after a change on the settings screen. */
export function resetInventoryVocabularies() {
  record.reset();
}
