/**
 * What a saved id resolves to.
 *
 * The wishlist stores ids and nothing else, and this shop has two catalogues
 * that can produce one:
 *
 * - the four storefront fixtures behind `/product/[slug]`, saved from the
 *   `<ProductCard>` heart (`features/02-products`);
 * - the forty listing tiles behind /new-drop, /women, /new-man and /new-woman,
 *   each of which is a display layer over one of those four fixtures
 *   (`components/gender/data`).
 *
 * Both wishlist screens resolved ids against the fixtures alone, so a heart
 * pressed on a listing tile — every heart outside `<ProductCard>` — saved an id
 * neither screen could find, and the piece was dropped on the way to the saved
 * list. Resolution lives here, once, so /wishlist and /account/wishlist cannot
 * disagree about what a saved id means.
 *
 * The catalogue is passed in. It is the database's now and arrives over the
 * network, so a screen calling this has to be subscribed to it — see
 * `useCatalog()` in the gallery.
 *
 * A tile is saved as ITSELF rather than as the fixture underneath it. Twenty
 * tiles share four fixture slugs, so collapsing them would put "Bone Utility
 * Overshirt" in the list of a shopper who saved the Nightshift Overcoat, and
 * light the heart on five tiles at once. The two id namespaces cannot collide:
 * fixture ids are slugs, piece ids are `m01`–`m20` and `w01`–`w20`.
 */

import { CATEGORIES, MEN, WOMEN, type Piece } from "@/components/gender/data";
import { frameFor, productFor, sizesFor, type Frame } from "@/components/new-man/data";
import { productSlug } from "@/components/new-man/product-deck";
import type { Product, ProductImagePosition } from "@/features/02-products";

/**
 * How the piece is drawn.
 *
 * The fixtures are quadrants of one sprite sheet and the tiles are crops of
 * five photographs, so there is no single element that draws both — see
 * `<SavedImage>`, which is the other half of this type.
 */
export type SavedImage =
  | { kind: "sprite"; position: ProductImagePosition }
  | { kind: "frame"; frame: Frame };

export type SavedSize = { label: string; soldOut: boolean };

export type SavedItem = {
  /** the id as held in the wishlist store */
  id: string;
  name: string;
  /** the second line — category and one more fact */
  meta: string;
  href: string;
  price: number;
  compareAtPrice?: number;
  badge?: string;
  image: SavedImage;
  soldOut: boolean;
  sizes: SavedSize[];
  /**
   * The catalogue record a bag line is cut from. A tile adds the fixture it
   * stands for, which is what its own quick-add panel already does; absent
   * means the piece cannot reach the bag from here.
   */
  product?: Product;
};

const PIECES: Piece[] = [...MEN.pieces, ...WOMEN.pieces];

/** Only the men's release has per-piece routes — see `new-man/[slug]`. */
const MEN_IDS = new Set(MEN.pieces.map((piece) => piece.id));

function categoryLabel(category: Piece["category"]) {
  return CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
}

function fromProduct(product: Product): SavedItem {
  return {
    id: product.id,
    name: product.name,
    meta: `${product.category} · ${product.color}`,
    href: `/product?slug=${product.slug}`,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    badge: product.badge,
    image: { kind: "sprite", position: product.imagePosition },
    soldOut: product.variants.every((variant) => variant.stock === "SOLD_OUT"),
    sizes: product.variants.map((variant) => ({
      label: variant.size,
      soldOut: variant.stock === "SOLD_OUT",
    })),
    product,
  };
}

function fromPiece(piece: Piece, catalogue: Product[]): SavedItem {
  const sizes = sizesFor(piece, catalogue);

  return {
    id: piece.id,
    name: piece.name,
    meta: `${categoryLabel(piece.category)} · ${piece.tag}`,
    /* A men's tile has a page of its own; a women's one does not, so it falls
       back to the storefront PDP for the fixture it stands for — exactly where
       the tile on /women already points. */
    href: MEN_IDS.has(piece.id)
      ? `/new-man/piece?slug=${productSlug(piece)}`
      : `/product?slug=${piece.slug}`,
    /* The tile's own price, NOT `pricingFor` — that is /new-man's page-local
       demo discount and says so in its own doc comment. */
    price: piece.price,
    compareAtPrice: piece.compareAt,
    badge: piece.isNew ? "New" : piece.tag,
    /* `frameFor` rather than the raw crop: the contact-sheet quadrants need the
       cell-addressing mode to sit right in a frame of this ratio. */
    image: { kind: "frame", frame: frameFor(piece) },
    soldOut: Boolean(piece.soldOut) || sizes.every((size) => size.state === "out"),
    sizes: sizes.map((size) => ({ label: size.label, soldOut: size.state === "out" })),
    product: productFor(piece, catalogue),
  };
}

export function resolveSavedItem(id: string, catalogue: Product[]): SavedItem | null {
  const product = catalogue.find((entry) => entry.id === id);
  if (product) return fromProduct(product);

  const piece = PIECES.find((entry) => entry.id === id);
  if (piece) return fromPiece(piece, catalogue);

  return null;
}

/**
 * The saved list, in the order it was saved in.
 *
 * Ids that no longer resolve are dropped rather than rendered as a hole — a
 * piece pulled from the catalogue should leave the list, not a broken tile.
 */
export function resolveSavedItems(ids: string[], catalogue: Product[]): SavedItem[] {
  return ids
    .map((id) => resolveSavedItem(id, catalogue))
    .filter((item): item is SavedItem => item !== null);
}
