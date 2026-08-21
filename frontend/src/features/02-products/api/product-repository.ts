import { fetchProduct, loadCatalog } from "@/features/02-products/catalog-store";
import type { Product, ProductDestination } from "@/features/02-products/types/product";

export type ProductListInput = {
  destination?: ProductDestination;
  query?: string;
};

/**
 * Which destinations a product belongs to.
 *
 * Kept here, applied to the rows the API returned, rather than expressed as a
 * query per destination: the whole published catalogue is one small request, and
 * filtering it in the browser means switching between Men, Women and New Drop is
 * instant instead of a round trip each. `CatalogRepository::storefrontProducts`
 * mirrors these same rules for the callers that DO want the server to narrow it.
 */
export function matchesDestination(product: Product, destination: ProductDestination) {
  if (destination === "all") return true;
  if (destination === "new-drop") return product.isNew;
  /* Unisex counts as both, which is why these are not equality checks. */
  if (destination === "men") return product.audience !== "women";
  if (destination === "women") return product.audience !== "men";
  if (destination === "sale") return Boolean(product.compareAtPrice);
  return product.collection.toLowerCase().replaceAll(" ", "-") === destination.slice(11);
}

/** The words a product is searchable by. */
export function searchable(product: Product) {
  return [product.name, product.category, product.color, product.collection]
    .join(" ")
    .toLowerCase();
}

/** Narrows a loaded catalogue. Synchronous, so a filter change re-renders at once. */
export function filterProducts(
  products: Product[],
  { destination = "all", query = "" }: ProductListInput = {},
): Product[] {
  const needle = query.trim().toLowerCase();

  return products.filter(
    (product) => matchesDestination(product, destination) && searchable(product).includes(needle),
  );
}

/**
 * The catalogue, awaited and narrowed.
 *
 * Async now — it reads `GET /catalog/products` instead of an array compiled into
 * the bundle, which is what lets a product created in the console show up in the
 * shop. Components should prefer `useProducts`, which subscribes to the same
 * store and re-renders when it lands; this is for the callers that genuinely
 * need a promise.
 */
export async function listProducts(input: ProductListInput = {}): Promise<Product[]> {
  return filterProducts(await loadCatalog(), input);
}

/** One product by slug, or null when there is no published product at it. */
export function getProduct(slug: string): Promise<Product | null> {
  return fetchProduct(slug);
}
