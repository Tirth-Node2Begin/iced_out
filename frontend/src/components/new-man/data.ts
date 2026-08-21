/**
 * Content deck for the /new-man catalogue.
 *
 * The twenty menswear pieces, the crop library they are shot from, and the
 * category/sort vocabularies already exist in `@/components/gender/data` — the
 * listing at /new-drop is built on exactly the same catalogue. This module
 * re-exports them rather than cloning twenty rows, so a price or a sold-out
 * flag stays true on both surfaces, and adds only what is specific to this
 * page: its own copy deck.
 *
 * Nothing here touches the hero or the editorial above it; those still read
 * from `DEPARTMENTS.men` in `@/components/new-home/data`.
 */

import { CROPS, MEN, type CropKey, type Piece } from "@/components/gender/data";
import type { Product } from "@/features/02-products/types/product";

export {
  CATEGORIES,
  CROPS,
  SORTS,
  formatPrice,
  type Category,
  type Crop,
  type CropKey,
  type Piece,
  type SortValue,
} from "@/components/gender/data";

/** The men's release, in authored order — this is what `featured` sorts to. */
export const MEN_PIECES = MEN.pieces;

/** How many tiles one page of the grid holds. */
export const PAGE_SIZE = 8;

/* -------------------------------------------------------------------------- */
/* Pricing                                                                    */
/* -------------------------------------------------------------------------- */

export type Pricing = {
  price: number;
  /**
   * The struck-through reference price, or `null` where the catalogue has none.
   *
   * Null is the common case and every caller has to render it: a piece is sold
   * at one price unless somebody has recorded what it was reduced from.
   */
  mrp: number | null;
  /** Whole percent off, for the badge — null whenever `mrp` is. */
  off: number | null;
};

/**
 * A stable, SSR-safe hash of an id.
 *
 * Exported because every page-local deck that needs "pick one of N, the same
 * one on the server and the client" has to agree on the arithmetic — the
 * product page's colourways and gallery pick from it too.
 */
export function hash(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0;
  }
  return total;
}

/**
 * The price block a tile shows: what the piece costs, and — only where the
 * catalogue records one — what it was reduced from.
 *
 * This used to INVENT the reference price. Where `compare_at_price` was unset,
 * it picked a discount out of `[30, 40, 45, 50, 55, 60]` by hashing the piece's
 * id and worked an MRP backwards from the selling price, so that the card's
 * price treatment would not be a layout that only appeared twice in a grid of
 * twenty. The comment above it said, correctly, that it was demo pricing and
 * not a claim about anything — but it was rendered as `MRP ₹8,330  40% off`
 * beside a real product at a real price, which is precisely a claim, and on 25
 * of the shop's 28 products it was one nobody had made. Two pieces at the same
 * ₹5,000 showed different MRPs and different discounts because their slugs
 * hashed differently.
 *
 * A struck-through MRP is a regulated declaration here, not decoration. So it
 * is now shown when there is one to show and omitted when there is not, and the
 * callers each say what an omitted one looks like.
 *
 * A compare-at at or below the selling price is treated as absent: it is either
 * a typo or a price that has gone up, and "-0% off" is not the way to report
 * either.
 */
export function pricingFor(piece: Piece): Pricing {
  if (!piece.compareAt || piece.compareAt <= piece.price) {
    return { price: piece.price, mrp: null, off: null };
  }

  return {
    price: piece.price,
    mrp: piece.compareAt,
    off: Math.round((1 - piece.price / piece.compareAt) * 100),
  };
}

/**
 * The catalogue product a tile stands for.
 *
 * The tiles are a display layer over the real catalogue — that is already true of
 * the link each one carries and of the size run it shows, and it is what lets the
 * quick-add put a genuine line in the shared cart rather than a mock of one.
 *
 * The catalogue is PASSED IN rather than read from the store here. It arrives over
 * the network now (`GET /catalog/products`), so a caller has to be subscribed to
 * it for this to be able to answer at all — taking it as an argument is what makes
 * that visible at every call site instead of hiding a hook dependency inside a
 * plain function.
 */
export function productFor(piece: Piece, catalogue: Product[]) {
  return catalogue.find((product) => product.slug === piece.slug);
}

/* -------------------------------------------------------------------------- */
/* Framing                                                                    */
/* -------------------------------------------------------------------------- */

export type Frame =
  | { mode: "crop"; src: string; op: string; zoom: number }
  /** one cell of a 2×2 contact sheet, addressed by column and row */
  | { mode: "quad"; src: string; qx: 0 | 1; qy: 0 | 1; zoom: number }
  /**
   * No photograph. Drawn as an empty frame, never as a stand-in picture.
   *
   * The alternative — which is what this used to do — was to fall back to a
   * quadrant of the house contact sheet, so a piece nobody had shot was
   * advertised with a photograph of a different garment. It looked like a
   * finished shop and it was telling shoppers something untrue.
   */
  | { mode: "none" };

/** The one frame that means "there is no photograph". */
export const BLANK_FRAME: Frame = { mode: "none" };

/**
 * `drop-001-products.webp` is a 2×2 contact sheet, and the shared crop library
 * isolates a cell with `object-position: 25% 25%` plus `scale(2)` about the
 * same point. Those two do not compose the way they look like they do.
 *
 * With a square source in a portrait frame, `cover` leaves no vertical
 * overflow, so the whole sheet's height maps onto the frame's height and the
 * cell occupies the top (or bottom) half of it. Scaling ×2 about a point at
 * 25% then puts the cell at [-25%, 75%] of the frame — which leaves the last
 * quarter of the frame showing the cell BELOW it, seam and all. The corner the
 * origin wants is 0% or 100%, not 25% or 75%.
 *
 * Rather than re-derive origins that only hold at one frame ratio, these eight
 * crops switch to an addressing mode: the image is laid out at 200% and offset
 * by whole cells, so the cell fills the frame exactly whatever shape the frame
 * is. The small zoom is margin against subpixel rounding at the seam.
 *
 * This is deliberately local. The same crops are used by /new-drop and
 * /women through `@/components/gender/data`, and correcting them there would
 * re-frame every tile on two pages this change was not asked to touch.
 */
const SHEET_CELLS: Partial<Record<CropKey, { qx: 0 | 1; qy: 0 | 1 }>> = {
  hoodie: { qx: 0, qy: 0 },
  hoodieWide: { qx: 0, qy: 0 },
  overshirt: { qx: 1, qy: 0 },
  overshirtWide: { qx: 1, qy: 0 },
  cargo: { qx: 0, qy: 1 },
  cargoWide: { qx: 0, qy: 1 },
  tee: { qx: 1, qy: 1 },
  teeWide: { qx: 1, qy: 1 },
};

/**
 * The framing for one entry in the crop library.
 *
 * Keyed on the crop rather than on a piece because the product page's gallery
 * shows four framings of a piece that only carries one — it picks the other
 * three straight out of `CROPS`, and they have to be framed by exactly the
 * same rules as the tile that led there.
 */
export function frameForCrop(key: CropKey): Frame {
  const crop = CROPS[key];
  const cell = SHEET_CELLS[key];

  // the stylesheet sizes the sheet at two frame heights, so 1 already fills
  // the frame with one cell; the extra 4% is margin against the seam
  if (cell) return { mode: "quad", src: crop.src, ...cell, zoom: 1.04 };
  return { mode: "crop", src: crop.src, op: crop.op, zoom: crop.z ?? 1 };
}

/**
 * An uploaded photograph, as a frame.
 *
 * A real photo needs no crop arithmetic — it was shot for this and the server
 * has already capped its longest edge — so it is a plain centred `cover`, which
 * is exactly what `mode: "crop"` resolves to at the identity origin and zoom.
 * Reusing that mode rather than adding a third means every stylesheet already
 * knows how to draw one.
 */
export function frameForPhoto(src: string): Frame {
  return { mode: "crop", src, op: "50% 50%", zoom: 1 };
}

/**
 * The one frame that stands for a piece.
 *
 * The operator's photograph, or nothing. `piece.image` has carried the uploaded
 * primary since the tiles started reading the live catalogue (`use-pieces.ts`),
 * but this went on framing the sprite regardless — so a piece somebody HAD
 * photographed still showed the house contact sheet on every card in the shop,
 * and a piece nobody had photographed showed somebody else's garment. The first
 * was a bug; the second was the design, and it was worse.
 */
export function frameFor(piece: Piece): Frame {
  return piece.image ? frameForPhoto(piece.image) : BLANK_FRAME;
}

/* -------------------------------------------------------------------------- */
/* Size runs                                                                  */
/* -------------------------------------------------------------------------- */

export type SizeOption = {
  label: string;
  state: "in" | "low" | "out";
};

const ONE_SIZE: SizeOption[] = [{ label: "One size", state: "in" }];

/**
 * The size run shown on a tile's hover panel.
 *
 * Read from the real catalogue rather than invented: every tile already links
 * to one of the four product fixtures, and those fixtures carry a graded XS–XL
 * run with per-size stock. Sourcing the panel from the same record means the
 * sizes a shopper sees on the card are the sizes they find on the product page
 * — a card that promises an M the PDP has sold out is worse than no panel.
 *
 * Accessories are not graded, so they collapse to one size.
 */
export function sizesFor(piece: Piece, catalogue: Product[]): SizeOption[] {
  const product = catalogue.find((item) => item.slug === piece.slug);

  /* The variants ARE the size run, so a product that has them shows them —
     whatever it is filed under.

     This used to return "One size" for anything in the accessories category,
     which is true of a chain or a pouch but is a guess, not a fact. It reached
     past the accessories: a product with no console category at all is mapped to
     accessories by `use-pieces`, so a pair of jeans published straight from the
     stock screen — stocked in 30, 32, 34 and 36, with a variant for each —
     opened a page offering a single size nobody could buy the others in. The
     honest rule is the narrower one: one size is what a piece with no sized
     variants has. */
  if (!product || product.variants.length === 0) return ONE_SIZE;

  return product.variants.map((variant) => ({
    label: variant.size,
    // the whole piece being sold out overrides the per-size record — those
    // tiles are closed regardless of what the linked fixture still holds
    state: piece.soldOut
      ? "out"
      : variant.stock === "SOLD_OUT"
        ? "out"
        : variant.stock === "LOW_STOCK"
          ? "low"
          : "in",
  }));
}

export const CATALOGUE_COPY = {
  eyebrow: "The men's edit",
  /** `{count}` is filled in by the catalogue — the release is whatever is
   * published, not the twenty tiles this file used to hold.
   * The head runs as SplitHeading segments — the second is the light cut */
  heading: [
    { text: "{count} pieces cut for " },
    { text: "weight\nand ", light: true },
    { text: "movement" },
  ],
  right: "Drop 001",
  /** the three facts under the grid — the questions a listing gets asked most */
  notes: [
    // the run quoted here has to match what the tiles actually offer, which
    // comes from the product fixtures — see `sizesFor`
    { key: "01", title: "Sized XS — XL", body: "Graded on a real curve, with the fit noted on every product page." },
    /* The title is written at render from the store's own threshold — see
       `shippingNote` and `catalogue.tsx`. It was the literal "Free shipping
       over ₹4,999", which is a figure `store_settings` owns. */
    { key: "02", title: "", body: "Dispatched from the Bengaluru studio within two working days." },
    { key: "03", title: "30-day returns", body: "Unworn, tags on. Exchanges are free once per order." },
  ],
} as const;
