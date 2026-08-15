"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { RecordRow } from "@/components/admin/record-manager";
import { availableUnits, stockItemFixtures } from "@/features/03-inventory/data/stock-fixtures";
import { createLocalStore } from "@/lib/local-store";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * What is actually in the warehouses.
 *
 * The stock register kept this in `useState`, which was enough while it was the
 * only screen that cared. It is not any more: a product in the catalogue is a
 * decision to sell one of these items, so the catalogue reads this register to
 * know what there is to sell and which sizes it comes in. Stock arrives here
 * first, and the catalogue lists it second — which is only true if both screens
 * are looking at the same list.
 */
/* Bumped when the shape of an item changes. A v1 record predates the
   top/bottom split, so it carries no category and sizes drawn from a
   vocabulary that no longer exists — reviving one would put a row on screen
   the form cannot edit back into a valid state. */
const STORAGE_KEY = "iced-out-stock-v2";

type StockBook = { items: RecordRow[] };

/** Only flat string maps survive the trip back — anything else is not a record. */
function reviveItems(value: unknown, fallback: RecordRow[]): RecordRow[] {
  if (!Array.isArray(value)) return fallback;

  const rows: RecordRow[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row: RecordRow = {};
    for (const [key, cell] of Object.entries(entry as Record<string, unknown>)) {
      if (typeof cell === "string") row[key] = cell;
    }
    if (row.id) rows.push(row);
  }

  return rows;
}

const store = createLocalStore<StockBook>(
  STORAGE_KEY,
  { items: stockItemFixtures },
  (parsed, fallback) => {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const stored = parsed as { items?: unknown };
    /* An emptied warehouse is a legitimate state, so a missing key falls back
       to the fixtures but a present-and-empty one is honoured. */
    return { items: "items" in stored ? reviveItems(stored.items, []) : fallback.items };
  },
);

export type StockContextValue = {
  items: RecordRow[];
  /** False until the browser's copy is the one on screen. */
  ready: boolean;
  commit: (next: (current: RecordRow[]) => RecordRow[]) => void;
};

const StockContext = createContext<StockContextValue | null>(null);

export function StockProvider({ children }: { children: ReactNode }) {
  const book = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const ready = useHydrated();

  const commit = useCallback((next: (current: RecordRow[]) => RecordRow[]) => {
    const current = store.getSnapshot();
    store.write({ items: next(current.items) });
  }, []);

  const value = useMemo(() => ({ items: book.items, ready, commit }), [book, commit, ready]);

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

/** Pieces of an item a shopper can still buy. */
export function available(item: RecordRow) {
  return availableUnits({
    totalUnits: item.totalUnits ?? "0",
    reservedUnits: item.reservedUnits ?? "0",
  });
}
