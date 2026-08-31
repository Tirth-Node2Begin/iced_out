"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useRegister, type Register } from "@/api/use-register";
import type { RecordRow } from "@/components/shell/record-manager";
import { availableUnits } from "@/features/03-inventory/data/stock-fixtures";

/**
 * What is actually in the warehouses, read from the database.
 *
 * This was a `localStorage` book seeded from `stock-fixtures.ts`, and the
 * consequence reached further than the inventory screen: a product in the
 * catalogue is a decision to sell one of these items, so the catalogue reads
 * this register to know what there is to sell and which sizes it comes in. With
 * both in one browser's storage the two agreed with each other and with nothing
 * else — the API had its own `stock_items`, and a shopper's order reserved
 * against that one.
 *
 * Both now read `/admin/inventory/items`. Stock arrives here first and the
 * catalogue lists it second, which is only meaningful if "here" is the database.
 */

export type StockContextValue = {
  items: RecordRow[];
  /** False until the endpoint has answered. */
  ready: boolean;
  loading: boolean;
  error: string | null;
  /** The register's write verbs, to spread onto a `RecordManager`. */
  register: Register;
};

const StockContext = createContext<StockContextValue | null>(null);

export function StockProvider({ children }: { children: ReactNode }) {
  const items = useRegister(
    useMemo(
      () => ({
        path: "/admin/inventory/items",
        itemPath: (row: RecordRow) => `/admin/inventory/items/${encodeURIComponent(row.id)}`,
        toCreate: (values: RecordRow) => ({
          itemName: values.itemName,
          category: values.category,
          audience: values.audience ?? "Unisex",
          itemType: values.itemType,
          sizes: values.sizes,
          warehouse: values.warehouse,
          totalUnits: Number(values.totalUnits ?? 0) || 0,
          /* The form collects a formatted price — "₹8,900" — and the API takes
             whole rupees, exactly as the catalogue register does. */
          price: rupees(values.price),
          image: values.image ?? "",
          images: values.images ?? "",
          /**
           * Whether this goes straight into the shop.
           *
           * Sent only on create, and deliberately not on update: publishing is a
           * decision made once, at the moment the stock is taken in. A ticked box
           * carried into every later edit would re-list the item each time
           * somebody corrected its name.
           */
          publish: values.publish === "true" ? "true" : "",
        }),
        /**
         * Reserved units are deliberately not sent.
         *
         * What is reserved is the sum of what orders are holding, which the
         * checkout and the fulfilment screens move. An operator editing an item's
         * name must not be able to overwrite that number with whatever the form
         * happened to be showing when it opened.
         */
        toUpdate: (values: RecordRow) => ({
          itemName: values.itemName,
          category: values.category,
          audience: values.audience ?? "Unisex",
          itemType: values.itemType,
          sizes: values.sizes,
          warehouse: values.warehouse,
          totalUnits: Number(values.totalUnits ?? 0) || 0,
          price: rupees(values.price),
          image: values.image ?? "",
          images: values.images ?? "",
        }),
      }),
      [],
    ),
  );

  const value = useMemo<StockContextValue>(
    () => ({
      items: items.rows,
      ready: items.loaded,
      loading: items.loading,
      error: items.error,
      register: items,
    }),
    [items],
  );

  return <StockContext.Provider value={value}>{children}</StockContext.Provider>;
}

export function useStock() {
  const context = useContext(StockContext);
  if (!context) throw new Error("useStock must be used inside StockProvider");
  return context;
}

/* ------------------------------------------------- reading it elsewhere */

/**
 * An item as a choice, labelled with what is left of it.
 *
 * The number is the point. Listing an item nobody has any of is the mistake
 * this label exists to prevent, so the count travels with the name rather than
 * waiting to be looked up on another screen.
 */
export function stockChoices(items: RecordRow[]) {
  return items.map((item) => ({
    value: item.id,
    label: `${item.itemName} · ${available(item)} available`,
  }));
}

/** The sizes one item is stocked in, as its own vocabulary. */
export function sizesOf(items: RecordRow[], itemId: string) {
  const item = items.find((entry) => entry.id === itemId);
  return (item?.sizes ?? "")
    .split(",")
    .map((size) => size.trim())
    .filter(Boolean);
}

export function findStockItem(items: RecordRow[], itemId: string) {
  return items.find((entry) => entry.id === itemId);
}

/** "₹8,900" or "8900" → 8900. The API takes whole rupees as an integer. */
function rupees(value: string | undefined) {
  return Number((value ?? "").replace(/[^\d]/g, "")) || 0;
}

/** Pieces of an item a shopper can still buy. */
export function available(item: RecordRow) {
  return availableUnits({
    totalUnits: item.totalUnits ?? "0",
    reservedUnits: item.reservedUnits ?? "0",
  });
}
