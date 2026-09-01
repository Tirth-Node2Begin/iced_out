import type { Product } from "@/features/02-products/types/product";

/**
 * Where a catalogue record's own page is.
 *
 * There used to be one storefront PDP at `/product?slug=`, and every card on
 * the site pointed at it. It is gone: the detail screen the rest of the shop
 * links to is the gender floors' one, `/new-man/piece` and `/new-woman/piece`,
 * and this is the single place that decides which of the two a record belongs
 * to so no two call sites can disagree.
 *
 * Which floor matters, and getting it wrong is a dead link rather than a
 * cosmetic slip: each route filters the catalogue to its own audience before
 * looking the slug up, and menswear includes unisex. So womenswear goes to the
 * women's floor and everything else — men's and unisex alike — to the men's,
 * which is the same rule `matchesDestination` holds everywhere else.
 *
 * The slug needs no translation. A product's slug and the one `pieceHref`
 * writes are both the piece's name slugified, so the two agree.
 */
export function productPieceHref(product: Pick<Product, "audience" | "slug">) {
  const floor = product.audience === "women" ? "new-woman" : "new-man";
  return `/${floor}/piece?slug=${product.slug}`;
}
