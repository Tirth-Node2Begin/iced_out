"use client";

import { useMemo } from "react";

import type { Category, CropKey, Piece } from "@/components/gender/data";
import { useCatalog, type Product } from "@/features/02-products";

/**
 * The gender pages' tiles, from the database.
 *
 * `MEN.pieces` and `WOMEN.pieces` were forty hardcoded objects — twenty per page.
 * Four of them stood for real products; the other thirty-six were invented, and
 * every one of them linked to one of those four slugs, so a tile advertising
 * "Nightshift Overcoat · ₹18,600" opened the Bone Utility Overshirt at ₹11,400.
 * Two of the four disagreed with the database about their own price. None of the
 * thirty-six could be edited, repriced, photographed or retired, because there was
 * nothing behind them to edit.
 *
 * Every tile is now a product. The whole shop is one catalogue: publish something
 * in `/admin/catalog` and it appears on the page its audience says it belongs to;
 * change its price there and the tile says the new one.
 *
 * `Piece` is kept as the tile's shape rather than passing `Product` straight
 * through, because the tiles carry things a product does not — a crop key, a short
 * corner tag — and every component under `components/gender` reads that shape.
 */

/**
 * The four quadrants of the sprite contact sheet, by the position a product
 * names. This is the FALLBACK imagery: a product with an uploaded photo renders
 * that instead, and `piece.image` carries it.
 */
const CROP_FOR_POSITION: Record<string, CropKey> = {
  "top-left": "hoodie",
  "top-right": "overshirt",
  "bottom-left": "cargo",
  "bottom-right": "tee",
};

/** The five categories the filter rail offers, from the console's taxonomy. */
const CATEGORY_FOR_TAXONOMY: Record<string, Category> = {
  outerwear: "outerwear",
  knitwear: "knitwear",
  trousers: "trousers",
  tops: "tops",
  accessories: "accessories",
};

function categoryOf(product: Product): Category {
  const key = product.taxonomy.trim().toLowerCase();
  /* Anything filed under a category the rail does not have falls under
     accessories rather than vanishing — a product with no category at all is
     still a product somebody published. */
  return CATEGORY_FOR_TAXONOMY[key] ?? "accessories";
}

function pieceOf(product: Product): Piece {
  const soldOut =
    product.variants.length > 0 &&
    product.variants.every((variant) => variant.stock === "SOLD_OUT");

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: categoryOf(product),
    /* The badge if the operator set one, otherwise the descriptor line — the
       corner chip should say something, and "Heavyweight fleece" is better than
       an empty pill. */
    tag: product.badge || product.category || "Drop 001",
    price: product.price,
    compareAt: product.compareAtPrice,
    crop: CROP_FOR_POSITION[product.imagePosition] ?? "hoodie",
    image: product.image || undefined,
    rating: product.rating,
    reviewCount: product.reviewCount,
    isNew: product.isNew,
    soldOut,
  };
}

/**
 * The published catalogue for one audience, as tiles.
 *
 * `men` and `women` both include `unisex`, which is the rule the whole storefront
 * uses (see `matchesDestination`) — a piece cut for everybody belongs on both
 * pages, and duplicating it in the data to achieve that is what the old fixture
 * did.
 */
export function useGenderPieces(audience: "men" | "women"): {
  pieces: Piece[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
} {
  const { data, loading, error, loaded } = useCatalog();

  const pieces = useMemo(
    () =>
      data
        .filter((product) => product.audience === audience || product.audience === "unisex")
        .map(pieceOf),
    [audience, data],
  );

  return { pieces, loading, error, loaded };
}
