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
import { productFixtures } from "@/features/02-products/api/product-fixtures";

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

/** How many tiles the grid opens with, and how many each "Load more" adds. */
export const PAGE_SIZE = 12;

/* -------------------------------------------------------------------------- */
/* Pricing                                                                    */
/* -------------------------------------------------------------------------- */

export type Pricing = {
  price: number;
  /** the struck-through reference price */
  mrp: number;
  /** whole percent off, for the badge */
  off: number;
};

/**
 * The price block a tile shows: selling price, MRP, and the percentage
 * between them.
 *
 * Two of the twenty pieces carry a real `compareAt` in the catalogue; for the
 * rest an MRP is derived here so the card's price treatment is not a layout
 * that only appears twice in a grid of twenty. THIS IS PAGE-LOCAL DEMO
 * PRICING, not a claim about anything — it is generated from the piece's id so
 * it is stable across a reload and identical on the server and the client,
 * and it lives here rather than in the catalogue so no other surface can pick
 * it up. Swap `DISCOUNTS` for real reference prices when there are any.
 */
const DISCOUNTS = [30, 40, 45, 50, 55, 60];

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

export function pricingFor(piece: Piece): Pricing {
  if (piece.compareAt) {
    return {
      price: piece.price,
      mrp: piece.compareAt,
      off: Math.round((1 - piece.price / piece.compareAt) * 100),
    };
  }

  const off = DISCOUNTS[hash(piece.id) % DISCOUNTS.length];
  // rounded to the nearest ten so the MRP reads like a price rather than the
  // output of a division
  const mrp = Math.round(piece.price / (1 - off / 100) / 10) * 10;

  return { price: piece.price, mrp, off };
}

/**
 * The catalogue product a tile stands for.
 *
 * The twenty tiles are a display layer over the four real fixtures — that is
 * already true of the link each one carries and of the size run it shows, and
 * it is what lets the quick-add put a genuine line in the shared cart rather
 * than a mock of one.
 */
export function productFor(piece: Piece) {
  return productFixtures.find((product) => product.slug === piece.slug);
}

/* -------------------------------------------------------------------------- */
/* Framing                                                                    */
/* -------------------------------------------------------------------------- */

export type Frame =
  | { mode: "crop"; src: string; op: string; zoom: number }
  /** one cell of a 2×2 contact sheet, addressed by column and row */
  | { mode: "quad"; src: string; qx: 0 | 1; qy: 0 | 1; zoom: number };

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

export function frameFor(piece: Piece): Frame {
  return frameForCrop(piece.crop);
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
export function sizesFor(piece: Piece): SizeOption[] {
  if (piece.category === "accessories") return ONE_SIZE;

  const product = productFixtures.find((item) => item.slug === piece.slug);
  if (!product) return ONE_SIZE;

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
  /** the head runs as SplitHeading segments — the second is the light cut */
  heading: [
    { text: "Twenty pieces cut for " },
    { text: "weight\nand ", light: true },
    { text: "movement" },
  ],
  right: "Drop 001",
  /** the three facts under the grid — the questions a listing gets asked most */
  notes: [
    // the run quoted here has to match what the tiles actually offer, which
    // comes from the product fixtures — see `sizesFor`
    { key: "01", title: "Sized XS — XL", body: "Graded on a real curve, with the fit noted on every product page." },
    { key: "02", title: "Free shipping over ₹4,999", body: "Dispatched from the Bengaluru studio within two working days." },
    { key: "03", title: "30-day returns", body: "Unworn, tags on. Exchanges are free once per order." },
  ],
} as const;
