export type ProductImagePosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type StockState = "IN_STOCK" | "LOW_STOCK" | "SOLD_OUT";

export type ProductVariant = {
  id: string;
  size: "XS" | "S" | "M" | "L" | "XL";
  color: string;
  colorHex: string;
  material: string;
  stock: StockState;
  available: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  /** The descriptor line under the name — "Heavyweight fleece". */
  category: string;
  /**
   * What the console files this under — "Outerwear". Maintained by an operator
   * in `/admin/catalog/categories`, which is what makes the storefront's own
   * filter pills follow the catalogue instead of a hardcoded list. Empty string
   * for a product with no category set.
   */
  taxonomy: string;
  description: string;
  story: string;
  fabric: string;
  care: string;
  price: number;
  compareAtPrice?: number;
  color: string;
  badge?: string;
  /**
   * The uploaded photo's URL, or an empty string.
   *
   * `imagePosition` below is the FALLBACK, not an alternative: it names a quadrant
   * of the sprite sheet that ships with the app, which is what a product looks like
   * until somebody photographs it. `<ProductImage>` prefers this and falls back to
   * the sprite, so a catalogue nobody has shot yet still looks like a catalogue.
   */
  image: string;
  /**
   * Every photograph of this piece, primary first.
   *
   * `image` above is the SINGLE frame — what a card, the bag and a search hit
   * show, because those have room for one picture and asking each of them to
   * choose from a list is how two views of the same product end up showing
   * different things. This is the run the product page pages through.
   *
   * The photographs hang off the STOCK ITEM behind the listing, so re-shooting a
   * piece updates every product listed from it at once. Empty for a piece nobody
   * has photographed, and the product page falls back to its sprite deck.
   */
  images: string[];
  imagePosition: ProductImagePosition;
  audience: "men" | "women" | "unisex";
  collection: string;
  isNew: boolean;
  /**
   * What shoppers said, from the approved reviews of this product.
   *
   * `reviewCount` is the honest half: it is 0 for a piece nobody has written
   * about, which is most of a new catalogue, and every surface that shows the
   * stars checks it first. Both are maintained by the moderation desk —
   * approving a review is what moves them.
   *
   * These replace a rating picked by hashing the product's slug against
   * `[3.5, 4, 4.5, 5]`, which put a different invented score on every tile and
   * the same one on every reload.
   */
  rating: number;
  reviewCount: number;
  variants: ProductVariant[];
};

export type ProductDestination =
  | "all"
  | "new-drop"
  | "men"
  | "women"
  | "sale"
  | `collection:${string}`;
