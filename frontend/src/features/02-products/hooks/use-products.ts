"use client";

import { useMemo } from "react";

import {
  getProduct,
  listProducts,
  type ProductListInput,
} from "@/features/02-products/api/product-repository";

export const productKeys = {
  all: ["products"] as const,
  list: (input: ProductListInput) => ["products", "list", input] as const,
  detail: (slug: string) => ["products", "detail", slug] as const,
};

export function useProducts(input: ProductListInput = {}) {
  const { destination, query } = input;
  return useMemo(() => listProducts({ destination, query }), [destination, query]);
}

export function useProduct(slug: string) {
  return useMemo(() => getProduct(slug), [slug]);
}
