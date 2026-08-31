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
    collection: product.collection || undefined,
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
 * The catalogue piece a lookbook pin is captioning, matched on the name it shows.
 *
 * A pin used to carry its own `slug`, and that slug was one of four storefront
 * fixtures written into the copy deck: the pin reading "Underpass Shell ·
 * ₹16,200" linked to `bone-utility-overshirt`, so tapping it opened a different
 * garment at a different price. The name a pin puts on screen is the only thing
 * about it a shopper can check, so it is the thing that resolves the link.
 *
 * Returns `undefined` while the catalogue is still in flight, and for a pin
 * naming a piece that has since been renamed or retired — callers send those to
 * the listing rather than to a product page that is not there.
 */
export function pieceForPin(pieces: Piece[], pin: { name: string }) {
  const wanted = pin.name.trim().toLowerCase();
  return pieces.find((piece) => piece.name.trim().toLowerCase() === wanted);
}

/**
 * The published catalogue for one audience, as tiles.
 *
 * `unisex` decides whether pieces cut for everybody count as part of that
 * audience. It defaults to true, which is the rule the rest of the storefront
 * applies (see `matchesDestination`) — a piece cut for everybody belongs on
 * both pages, and duplicating it in the data to achieve that is what the old
 * fixture did.
 *
 * /new-woman opts out. That floor is a womenswear edit rather than "everything
 * a woman could buy": with `unisex` on, seven of its eighteen tiles were the
 * same garments, under the same names, that the men's grid was showing — so the
 * two departments read as one catalogue shown twice. Every category has a
 * genuine women's cut behind it (a Bone Long Coat against the men's Bone Field
 * Jacket, a Washed Crop Hoodie against the Gravel Wash Hoodie), which is what
 * makes narrowing it possible without leaving a filter that matches nothing.
 */
export function useGenderPieces(
  audience: "men" | "women",
  /** whether pieces cut for everybody count as part of this audience */
  { unisex = true }: { unisex?: boolean } = {},
): {
  pieces: Piece[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
} {
  const { data, loading, error, loaded } = useCatalog();

  const pieces = useMemo(
    () =>
      data
        .filter(
          (product) =>
            product.audience === audience ||
            (unisex && product.audience === "unisex"),
        )
        .map(pieceOf),
    [audience, data, unisex],
  );

  return { pieces, loading, error, loaded };
}
