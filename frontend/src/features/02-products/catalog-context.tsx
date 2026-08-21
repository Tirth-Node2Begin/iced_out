"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useRegister, type Register } from "@/api/use-register";
import type { RecordRow } from "@/components/admin/record-manager";
import { catalogStore } from "@/features/02-products/catalog-store";

/**
 * The console's four catalogue registers, read from and written to the database.
 *
 * This used to be a `localStorage` record seeded from `catalog-seed.ts`. That is
 * what made the console a demo: a product created here was a fact about one
 * browser tab. It did not reach the shop, another operator could not see it, and
 * clearing site data undid a day's work. Every register here is now one endpoint
 * under `/admin/catalog`, and the rows on screen are the rows in `products`,
 * `product_variants`, `categories` and `collections`.
 *
 * The registers stay grouped in one context — rather than each screen calling
 * `useRegister` for itself — because they are genuinely entangled: the product
 * form's category dropdown is the categories register, deleting a product
 * changes its category's count, and creating a variant changes its product's
 * stock. Whatever writes to one has to be able to re-read the others.
 */

export type CatalogKind = "products" | "categories" | "collections" | "variants";

export type CatalogContextValue = {
  products: RecordRow[];
  categories: RecordRow[];
  collections: RecordRow[];
  variants: RecordRow[];
  /** False until every register has answered once. */
  ready: boolean;
  loading: boolean;
  /** The first register that failed to read, as a sentence to show. */
  error: string | null;
  /** One register's write verbs, to spread onto its `RecordManager`. */
  register: (kind: CatalogKind) => Register;
  /** Re-reads everything. For a write made through a different register. */
  refreshAll: () => Promise<void>;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  /**
   * A product is addressed by its slug and a variant by its SKU — both of which
   * the SERVER mints, from the stock item's name and the product's code. Nothing
   * here sends an id on create: `SkuMinter` owns that, and a browser minting its
   * own slugs is how two operators end up creating `afterdark-hoodie` twice.
   */
  const products = useRegister(
    useMemo(
      () => ({
        path: "/admin/catalog/products",
        itemPath: (row: RecordRow) => `/admin/catalog/products/${encodeURIComponent(row.id)}`,
        toCreate: (values: RecordRow) => ({
          name: values.name,
          item: values.item,
          size: values.size,
          /* The form collects a formatted price — "₹8,900" — and the API takes
             whole rupees. Stripping to digits here rather than asking the
             operator to type a bare number keeps the field the same one it has
             always been. */
          price: rupees(values.price),
          category: values.category ?? "",
          collection: values.collection ?? "",
          status: values.status ?? "Draft",
          description: values.description ?? "",
          tax: values.tax ?? "",
        }),
        /**
         * Only what changed. The product PATCH re-prices on any `price` it is
         * given — which writes a row to `product_price_history` — so sending the
         * whole record on every save would log a price change each time somebody
         * corrected a typo in the description.
         */
        toUpdate: (values: RecordRow, previous: RecordRow) => {
          const body: Record<string, unknown> = {};

          if (values.name !== previous.name) body.name = values.name;
          if (values.item !== previous.item) body.item = values.item;
          if (values.size !== previous.size) body.size = values.size;
          if (values.status !== previous.status) body.status = values.status;
          if (values.category !== previous.category) body.category = values.category;
          if (values.collection !== previous.collection) body.collection = values.collection;
          if ((values.description ?? "") !== (previous.description ?? "")) {
            body.description = values.description ?? "";
          }
          if ((values.tax ?? "") !== (previous.tax ?? "")) body.tax = values.tax ?? "";
          if (rupees(values.price) !== rupees(previous.price)) body.price = rupees(values.price);

          return body;
        },
      }),
      [],
    ),
  );

  const variants = useRegister(
    useMemo(
      () => ({
        path: "/admin/catalog/variants",
        itemPath: (row: RecordRow) => `/admin/catalog/variants/${encodeURIComponent(row.id)}`,
        toCreate: (values: RecordRow) => ({
          product: values.product,
          size: values.size,
          colour: values.colour,
          stock: Number(values.stock ?? 0) || 0,
        }),
        /* The variant PATCH takes a status and nothing else — size, colour and
           stock are what the SKU was minted from, so changing one means a new
           variant rather than an edit of this one. */
        toUpdate: (values: RecordRow) => ({ status: values.status }),
      }),
      [],
    ),
  );

  const categories = useRegister(
    useMemo(
      () => ({
        path: "/admin/catalog/categories",
        itemPath: (row: RecordRow) => `/admin/catalog/categories/${encodeURIComponent(row.id)}`,
        toCreate: (values: RecordRow) => ({ name: values.name }),
      }),
      [],
    ),
  );

  const collections = useRegister(
    useMemo(
      () => ({
        path: "/admin/catalog/collections",
        itemPath: (row: RecordRow) => `/admin/catalog/collections/${encodeURIComponent(row.id)}`,
        toCreate: (values: RecordRow) => ({
          name: values.name,
          status: values.status ?? "Draft",
        }),
      }),
      [],
    ),
  );

  const value = useMemo<CatalogContextValue>(() => {
    const byKind: Record<CatalogKind, Register> = {
      products,
      categories,
      collections,
      variants,
    };

    /**
     * Every catalogue write is also a change to the SHOP.
     *
     * Publishing a product puts it on the storefront; deleting one takes it off.
     * The storefront reads its own endpoint through `catalogStore`, so that store
     * is dropped after a write here — the next storefront render re-reads it
     * instead of showing what the catalogue looked like before the change. This
     * is the whole point of the exercise: one edit, both halves.
     */
    function wrap(register: Register): Register {
      const after = async <T,>(work: Promise<T>): Promise<T> => {
        const result = await work;
        catalogStore.reset();
        return result;
      };

      return {
        ...register,
        onCreate: (values) => after(register.onCreate(values)),
        onUpdate: (values, previous) => after(register.onUpdate(values, previous)),
        onDelete: (row) => after(register.onDelete(row)),
      };
    }

    return {
      products: products.rows,
      categories: categories.rows,
      collections: collections.rows,
      variants: variants.rows,
      ready: products.loaded && categories.loaded && collections.loaded && variants.loaded,
      loading: products.loading || categories.loading || collections.loading || variants.loading,
      error: products.error ?? variants.error ?? categories.error ?? collections.error,
      register: (kind) => wrap(byKind[kind]),
      refreshAll: async () => {
        await Promise.all([
          products.refresh(),
          categories.refresh(),
          collections.refresh(),
          variants.refresh(),
        ]);
        catalogStore.reset();
      },
    };
  }, [categories, collections, products, variants]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

/**
 * The console's catalogue registers.
 *
 * Named apart from `useCatalog` in `hooks/use-products`, which is the SHOPPER's
 * view of the same tables — typed products with prices as numbers and only the
 * published ones. Two audiences, two shapes, one database.
 */
export function useCatalogRegisters() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalogRegisters must be used inside CatalogProvider");
  return context;
}

/** "₹8,900" or "8900" → 8900. The API takes whole rupees as an integer. */
function rupees(value: string | undefined) {
  return Number((value ?? "").replace(/[^\d]/g, "")) || 0;
}
