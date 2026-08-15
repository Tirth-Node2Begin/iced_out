"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { SEEDED, type Catalog, type CatalogKind, type CatalogRecord } from "@/features/02-products/catalog-seed";
import { createLocalStore } from "@/lib/local-store";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * What the catalogue actually contains.
 *
 * The three catalogue registers each held their own `useState`, which made a
 * created product a fact about a mounted table: open it, come back, and it was
 * gone. They read one store now, so creating a product on the Products tab and
 * opening its editor are two views of the same record — and a reload still
 * shows it.
 *
 * The records, the states and the id minting live in `catalog-seed`, which is
 * not a client module: the product route reads the seed on the server.
 */

const STORAGE_KEY = "iced-out-catalog-v1";

/** Only flat string maps survive the trip back — anything else is not a record. */
function reviveList(value: unknown, fallback: CatalogRecord[]): CatalogRecord[] {
  if (!Array.isArray(value)) return fallback;

  const rows: CatalogRecord[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row: CatalogRecord = {};
    for (const [key, cell] of Object.entries(entry as Record<string, unknown>)) {
      if (typeof cell === "string") row[key] = cell;
    }
    if (row.id) rows.push(row);
  }

  return rows;
}

const store = createLocalStore<Catalog>(STORAGE_KEY, SEEDED, (parsed, fallback) => {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const stored = parsed as Partial<Record<CatalogKind, unknown>>;

  /* An emptied register is a legitimate state, so a missing key falls back to
     the seed but a present-and-empty one is honoured. */
  return {
    products: "products" in stored ? reviveList(stored.products, []) : fallback.products,
    categories: "categories" in stored ? reviveList(stored.categories, []) : fallback.categories,
    collections: "collections" in stored ? reviveList(stored.collections, []) : fallback.collections,
    variants: "variants" in stored ? reviveList(stored.variants, []) : fallback.variants,
  };
});

export type CatalogContextValue = Catalog & {
  /** False until the browser's copy is the one on screen. */
  ready: boolean;
  /**
   * Applies a change to one register. It takes an updater rather than a list
   * so an undo that fires minutes later still builds on what is current.
   */
  commit: (kind: CatalogKind, next: (current: CatalogRecord[]) => CatalogRecord[]) => void;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const catalog = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const ready = useHydrated();

  const commit = useCallback(
    (kind: CatalogKind, next: (current: CatalogRecord[]) => CatalogRecord[]) => {
      const current = store.getSnapshot();
      const written = { ...current, [kind]: next(current[kind]) };

      /* Deleting a product takes its variants with it. Left behind they are
         invisible — nothing lists a variant whose product is gone — and the
         next product to be minted under a freed slug would silently inherit
         someone else's sizes and stock. The rule lives here rather than in the
         register that happens to delete, so every path that removes a product
         obeys it. */
      if (kind === "products") {
        const live = new Set(written.products.map((product) => product.id));
        written.variants = written.variants.filter((variant) => live.has(variant.product));
      }

      store.write(written);
    },
    [],
  );

  const value = useMemo(
    () => ({
      products: catalog.products,
      categories: catalog.categories,
      collections: catalog.collections,
      variants: catalog.variants,
      ready,
      commit,
    }),
    [catalog, commit, ready],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog must be used inside CatalogProvider");
  return context;
}
