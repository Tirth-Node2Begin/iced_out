import { productFixtures } from "@/features/02-products/api/product-fixtures";
import type { Product, ProductDestination } from "@/features/02-products/types/product";

export type ProductListInput = {
  destination?: ProductDestination;
  query?: string;
};

function matchesDestination(product: Product, destination: ProductDestination) {
  if (destination === "all") return true;
  if (destination === "new-drop") return product.isNew;
  if (destination === "men") return product.audience !== "women";
  if (destination === "women") return product.audience !== "men";
  if (destination === "sale") return Boolean(product.compareAtPrice);
  return product.collection.toLowerCase().replaceAll(" ", "-") === destination.slice(11);
}

export function listProducts({
  destination = "all",
  query = "",
}: ProductListInput = {}): Product[] {
  const normalizedQuery = query.trim().toLowerCase();
  return productFixtures.filter((product) => {
    const searchable = [product.name, product.category, product.color, product.collection]
      .join(" ")
      .toLowerCase();
    return matchesDestination(product, destination) && searchable.includes(normalizedQuery);
  });
}

export function getProduct(slug: string): Product | null {
  return productFixtures.find((product) => product.slug === slug) ?? null;
}
