/**
 * Content deck for /new-man/[slug] — the men's product detail page.
 *
 * Everything factual about a piece already exists: the twenty tiles live in
 * `@/components/gender/data` (re-exported through `./data`), and each one is a
 * display layer over one of the four real product fixtures, which carry the
 * description, fabric, care and the graded size run. This module adds only what
 * a detail page needs on top of that — a per-piece URL, a four-shot gallery,
 * the colourways, and the review/shipping copy — and it adds it HERE so no
 * other surface can pick it up.
 *
 * Anything invented is marked. The rest is read from the catalogue.
 */

import {
  BLANK_FRAME,
  frameForPhoto,
  type Frame,
  type Piece,
} from "@/components/new-man/data";
import type { Product } from "@/features/02-products/types/product";

/* -------------------------------------------------------------------------- */
/* Routing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A piece's URL segment, derived from its name.
 *
 * This was the key the detail route resolved on, back when the release was
 * twenty hardcoded tiles sharing four fixture slugs — routing on `piece.slug`
 * then collapsed the release to four pages.
 *
 * It stays the key `pieceHref` writes: the backend slugifies a product's name
 * the same way this does (`SkuMinter::slugify`), so the two agree for every
 * product whose name is unique, and every link already in the wild still names
 * the piece it always did.
 */
export function productSlug(piece: Piece) {
  return piece.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The piece a URL segment names, looked up in the catalogue handed in.
 *
 * The list is a parameter rather than the module's own `MEN_PIECES`, because the
 * catalogue is the database's now and arrives over the network — see
 * `components/gender/use-pieces.ts`. A module-level constant could only ever be
 * the twenty pieces that were written into the source.
 *
 * The record's own slug is tried first and the name-slug second. They are the
 * same string for almost every product — both are the name, slugified — but not
 * for the two that collide: the catalogue mints `jet-overshirt-2` for the second
 * "Jet Overshirt" while the name still slugifies to `jet-overshirt`. Reading the
 * real slug first is what makes a link built from the record land on it.
 */
export function pieceForSlug(pieces: Piece[], slug: string) {
  return (
    pieces.find((piece) => piece.slug === slug) ??
    pieces.find((piece) => productSlug(piece) === slug)
  );
}

/* -------------------------------------------------------------------------- */
/* Gallery                                                                    */
/* -------------------------------------------------------------------------- */


/**
 * The photographs a product page pages through — and ONLY those.
 *
 * The operator's own run: the primary they chose, then every secondary shot in
 * the order they arranged it, straight off the stock item behind the listing.
 * That run is the whole point of the gallery field in the console — a shopper
 * looking at a coat should be looking at THAT coat.
 *
 * This used to synthesise four shots for every piece, taking the other three
 * off a rotation of the house contact sheet. It made a page that had never been
 * shot look finished, and the price of that was three photographs of somebody
 * else's garment presented as this one's: open a pair of jeans and views two,
 * three and four were a hoodie, an overshirt and a tee. A gallery of one real
 * photograph is a smaller page and a true one, so the deck is gone. Where there
 * is nothing at all, the gallery is a single empty frame.
 *
 * `product` is optional because the catalogue arrives over the network, and the
 * page renders before it lands.
 */
export function shotsFor(piece: Piece, product?: Product): Frame[] {
  const uploaded = product?.images ?? [];

  if (uploaded.length > 0) return uploaded.map(frameForPhoto);

  /* Before the catalogue has landed the tile's own primary is all there is, and
     it is already the right picture — the listing handed it over. */
  return [piece.image ? frameForPhoto(piece.image) : BLANK_FRAME];
}

/* -------------------------------------------------------------------------- */
/* Colourways                                                                 */
/* -------------------------------------------------------------------------- */

/* There is deliberately no colourway picker. Every piece in the release is cut
   in exactly one tone — the catalogue has no second colourway to offer — so a
   selector there would have been a control with nothing behind it. The colour
   the piece IS still reads out as a fact in the description panel. */

/* -------------------------------------------------------------------------- */
/* Copy                                                                       */
/* -------------------------------------------------------------------------- */

/** The category chip and the crumb both read off this. */
export const CATEGORY_LABELS: Record<Piece["category"], string> = {
  outerwear: "Outerwear",
  knitwear: "Knitwear",
  trousers: "Trousers",
  tops: "Tops",
  accessories: "Accessories",
};

/**
 * How long the shopper has left to make the next dispatch, in seconds.
 *
 * A literal rather than a clock reading: this route is statically exported, so
 * a value derived from `Date.now()` would be baked at build time on the server
 * and re-derived at hydration on the client, and the two would not match. The
 * countdown starts from this number in both places and only then begins to run.
 */
export const DISPATCH_WINDOW_SECONDS = 2 * 3600 + 30 * 60 + 25;

/**
 * The shipping panel's four cells. `discount` is filled in from the piece's own
 * pricing at render; the rest is studio policy and does not vary by piece.
 *
 * `arrival` is a fixed window rather than a computed date, for the same
 * static-export reason as the countdown above. It is the one line here that
 * should come from a real shipping quote once there is an API behind it.
 */
export const SHIPPING = {
  packageLabel: "Studio box",
  delivery: "3 — 4 working days",
  arrival: "12 — 14 Aug 2026",
} as const;

/* -------------------------------------------------------------------------- */
/* Departments                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The floor a product page is being read on.
 *
 * The detail stack below `/new-man/piece` and `/new-woman/piece` is ONE set of
 * components: the hero, the panels, the reviews and the related grid are the
 * same page with a different audience behind it. What actually differs is four
 * strings — which audience to read the catalogue for, where "back" goes, what
 * the breadcrumb calls the department, and where a related tile points — so
 * they travel together as one object rather than as four props.
 *
 * Every component that takes one defaults to `DEPTS.men`, which is what /new-man
 * was doing before this existed. Nothing on that route had to change.
 */
export type Dept = {
  audience: "men" | "women";
  /** the department's listing route */
  base: string;
  /** what the breadcrumb calls it */
  label: string;
  /** the id of the grid on that listing — the two floors name theirs differently */
  editHash: string;
  /**
   * Whether pieces cut for everybody belong to this floor.
   *
   * It travels with the department rather than being decided at each call site
   * because the detail page has to agree with the listing that led to it: a
   * grid that does not show unisex pieces must not recommend them underneath
   * one, and `?slug=` must resolve against the same set the grid was drawing.
   * See `useGenderPieces` for why /new-woman is the floor that opts out.
   */
  unisex: boolean;
};

export const DEPTS: Record<"men" | "women", Dept> = {
  men: {
    audience: "men",
    base: "/new-man",
    label: "Men",
    editHash: "#edit",
    unisex: true,
  },
  women: {
    audience: "women",
    base: "/new-woman",
    label: "Women",
    editHash: "#nw-edit",
    unisex: false,
  },
};

/** Where "back" goes: that floor's grid, scrolled to the tile that led here. */
export function backHref(dept: Dept) {
  return `${dept.base}${dept.editHash}`;
}

/**
 * A piece's own detail page on the floor it is being read from.
 *
 * Addressed by NAME rather than by the fixture slug the tile links to — see
 * `productSlug` — and always under the department the reader is already in, so
 * a shopper browsing womenswear is never handed a page that breadcrumbs as Men.
 */
export function pieceHref(dept: Dept, piece: Piece) {
  return `${dept.base}/piece?slug=${productSlug(piece)}`;
}

export const PRODUCT_COPY = {
  featuresHref: "#nmp-details",
  /* There is no `sizeGuideHref`. The size guide is a DIALOG on this page, not a
     route — see `SIZE_CHARTS` below and `size-guide.tsx`. A shopper reaches for
     it in the middle of choosing a size, and a link that took them off the page
     to read a table meant losing the picker, the shot and the scroll position to
     get back to exactly where they already were. */
  /**
   * The two policy lines that do NOT depend on a setting.
   *
   * The free-shipping line used to sit at the head of this list as the literal
   * string "Free shipping over ₹4,999", which is a number `store_settings`
   * owns — see `storefront-config.ts`. It is written at render now, from the
   * threshold the store actually applies, so an operator who moves it moves it
   * everywhere. `shippingNote` builds that line.
   */
  notes: ["30-day returns", "Exchanges free once per order"],
  /** the head over the related grid — SplitHeading segments, light cut second */
  relatedHeading: [{ text: "You might also " }, { text: "like", light: true }],
} as const;

/**
 * "Free shipping over ₹4,999" — with the figure the shop is actually applying.
 *
 * Every surface that advertises the threshold builds its line through here, so
 * there is one sentence and one number behind it rather than four copies of a
 * string that were correct on the day they were typed.
 */
export function shippingNote(freeDeliveryOver: number) {
  return `Free shipping over ₹${freeDeliveryOver.toLocaleString("en-IN")}`;
}

/* -------------------------------------------------------------------------- */
/* Size guide                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * PAGE-LOCAL DEMO MEASUREMENTS. The four product fixtures carry a graded XS–XL
 * run with per-size stock but no dimensions of any kind, so the figures below
 * are written to a plausible grade rather than read off a spec sheet — they are
 * the shape the guide needs, not a claim about a garment. Everything else in the
 * dialog (which sizes exist, which are gone, what the piece is cut from) still
 * comes from the catalogue. Swap this block for the real grading when there is
 * one; the component reads the columns off the chart and never hardcodes them.
 *
 * ONE UNIT ONLY, and it is centimetres. Inches are derived at render from these
 * — a second authored column is a second thing to keep true, and the first time
 * the two disagree the whole table stops being believable.
 */
export type SizeChartId = "tops" | "outerwear" | "trousers";

export type SizeMeasure = {
  key: string;
  label: string;
  /**
   * True when the figure describes the BODY the size is cut to fit rather than
   * the garment itself. The two are not comparable — a 100cm chest wears a 60cm
   * flat chest with the ease this release is drafted with — so the table marks
   * which is which instead of running them together as one row of numbers.
   */
  body?: boolean;
};

export type SizeChart = {
  id: SizeChartId;
  label: string;
  /** the one line under the tabs saying what the figures are */
  caption: string;
  /** the columns, left to right, after the size itself */
  measures: SizeMeasure[];
  /** size label → one figure per measure, in centimetres, in column order */
  rows: { size: string; values: number[] }[];
  /** which silhouette the how-to-measure block draws */
  diagram: "top" | "trouser";
  /** the numbered steps beside that silhouette */
  steps: { title: string; body: string }[];
};

export const SIZE_CHARTS: Record<SizeChartId, SizeChart> = {
  tops: {
    id: "tops",
    label: "Tops & knitwear",
    caption:
      "Tees, long sleeves and hoods. Garment laid flat, seam to seam — a boxy body and a dropped shoulder, so the chest reads wider than a set-in sleeve of the same size.",
    measures: [
      { key: "fitChest", label: "To fit chest", body: true },
      { key: "chest", label: "Chest, flat" },
      { key: "length", label: "Body length" },
      { key: "shoulder", label: "Shoulder" },
      { key: "sleeve", label: "Sleeve" },
    ],
    rows: [
      { size: "XS", values: [88, 54, 68, 48, 60] },
      { size: "S", values: [94, 57, 70, 50, 61] },
      { size: "M", values: [100, 60, 72, 52, 62] },
      { size: "L", values: [106, 63, 74, 54, 63] },
      { size: "XL", values: [112, 66, 76, 56, 64] },
    ],
    diagram: "top",
    steps: [
      {
        title: "Chest",
        body: "Across the body one inch below the armhole, seam to seam. Double it to compare with your own chest measured round.",
      },
      {
        title: "Body length",
        body: "From the highest point of the shoulder straight down to the hem, not along the curve of the back.",
      },
      {
        title: "Shoulder",
        body: "Seam to seam across the back. On a dropped shoulder this sits below the shoulder bone by design.",
      },
      {
        title: "Sleeve",
        body: "From the neck seam over the shoulder to the cuff — a raglan and a set-in sleeve are measured the same way here.",
      },
    ],
  },

  outerwear: {
    id: "outerwear",
    label: "Outerwear",
    caption:
      "Overshirts, jackets and shells. Cut over a mid-layer, so every garment figure runs fuller than the tops chart at the same size — the body it fits is unchanged.",
    measures: [
      { key: "fitChest", label: "To fit chest", body: true },
      { key: "chest", label: "Chest, flat" },
      { key: "length", label: "Body length" },
      { key: "shoulder", label: "Shoulder" },
      { key: "sleeve", label: "Sleeve" },
    ],
    rows: [
      { size: "XS", values: [88, 58, 70, 51, 61] },
      { size: "S", values: [94, 61, 72, 53, 62] },
      { size: "M", values: [100, 64, 74, 55, 63] },
      { size: "L", values: [106, 67, 76, 57, 64] },
      { size: "XL", values: [112, 70, 78, 59, 65] },
    ],
    diagram: "top",
    steps: [
      {
        title: "Chest",
        body: "Buttoned or zipped shut, across the body one inch below the armhole. Measure your own chest over the layer you intend to wear under it.",
      },
      {
        title: "Body length",
        body: "Highest point of the shoulder to the hem. The shells run two centimetres longer at the back than the front.",
      },
      {
        title: "Shoulder",
        body: "Seam to seam across the back. Outerwear is drafted a full size wider here than the tops it goes over.",
      },
      {
        title: "Sleeve",
        body: "Neck seam over the shoulder to the cuff, with the cuff unfastened.",
      },
    ],
  },

  trousers: {
    id: "trousers",
    label: "Trousers",
    caption:
      "Cargos and relaxed legs. Garment laid flat with the waistband unstretched — the waist figure is half the circumference, as it is measured on the table.",
    measures: [
      { key: "fitWaist", label: "To fit waist", body: true },
      { key: "waist", label: "Waist, flat" },
      { key: "hip", label: "Hip, flat" },
      { key: "inseam", label: "Inseam" },
      { key: "rise", label: "Front rise" },
      { key: "opening", label: "Leg opening" },
    ],
    rows: [
      { size: "XS", values: [71, 37, 55, 74, 30, 24] },
      { size: "S", values: [76, 39.5, 57.5, 75, 30.5, 25] },
      { size: "M", values: [81, 42, 60, 76, 31, 26] },
      { size: "L", values: [86, 44.5, 62.5, 77, 31.5, 27] },
      { size: "XL", values: [91, 47, 65, 78, 32, 28] },
    ],
    diagram: "trouser",
    steps: [
      {
        title: "Waist",
        body: "Straight across the top of the waistband, relaxed. Double it to compare with your own waist measured round.",
      },
      {
        title: "Hip",
        body: "Across the widest point below the rise, usually about 20cm down from the waistband.",
      },
      {
        title: "Inseam",
        body: "Crotch seam to hem down the inside of the leg. This is the figure to check against a pair you already wear.",
      },
      {
        title: "Front rise",
        body: "Crotch seam up to the top of the waistband at the front. A high rise reads as a shorter inseam on the same leg.",
      },
    ],
  },
};

export const SIZE_CHART_ORDER: SizeChartId[] = ["tops", "outerwear", "trousers"];

/**
 * Which chart a piece belongs to, or `null` when it is not graded.
 *
 * Accessories are the null case and it is a real one, not a gap: the release
 * grades nothing in that category, so the dialog says so rather than showing a
 * table the piece has no row in. The brand's charts stay browsable underneath —
 * a shopper who opened the guide from a boot is usually sizing the rest of an
 * order, not the boot.
 */
export function chartIdFor(piece: Piece): SizeChartId | null {
  switch (piece.category) {
    case "trousers":
      return "trousers";
    case "outerwear":
      return "outerwear";
    case "tops":
    case "knitwear":
      return "tops";
    case "accessories":
      return null;
  }
}

export const SIZE_GUIDE_COPY = {
  /** the null case: a piece the release does not grade */
  ungraded:
    "This piece is not graded — accessories in Drop 001 are made in a single size. The charts below cover the graded pieces in the release.",
  /** the three answers the guide gets asked for most, under the table */
  notes: [
    {
      title: "Between two sizes",
      body: "Size down for a closer body and a shoulder that sits where the seam suggests. Size up for the drape the release is drawn with — the photographs are shot on the larger of the two.",
    },
    {
      title: "How it should sit",
      body: "The shoulder seam is meant to fall below the shoulder bone and the sleeve to reach the base of the thumb. A tops size that measures right will still look bigger on than a set-in-sleeve garment of the same chest.",
    },
    {
      title: "After a wash",
      body: "Cold wash and dried flat, everything here holds within a centimetre. Heat is what moves it: a hot dry takes about 2% off the body length and does not come back.",
    },
  ],
  /** the one line in the foot — studio policy, same wording as the panels */
  footer: "30-day returns, unworn with tags on. Exchanges are free once per order, so an order placed between two sizes is not a decision you are locked into.",
} as const;

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

/* There is nothing here any more, and that is the point.

   This block held three written reviews — "Alex Mathio", "Priya Raghavan",
   "Daniel Okafor", with avatars, dates and quotations — plus
   `RATING_COUNTS = [36, 9, 2, 2, 1]`, from which the page derived "4.6 from
   50 reviews", and `TILE_RATINGS`, which gave every related tile a star
   score by hashing the piece id. Its own comment said it was demo content
   standing in for a feed that did not exist.

   The feed exists. `reviews` is a real table with a moderation desk behind
   it and `GET /reviews` in front, so the product page reads what shoppers
   actually wrote and shows nothing when they have not written yet — see
   `product-reviews.tsx`. Ratings on a tile come off the product itself
   (`Product.rating` / `reviewCount`), which the console maintains.

   Nothing replaces this section here because nothing belongs here: a deck
   is authored copy, and a review is not ours to author. */

/* -------------------------------------------------------------------------- */
/* Related                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Four more pieces: same category first, then the rest of the release in
 * authored order. Never the piece being viewed.
 */
export function relatedTo(pieces: Piece[], piece: Piece, count = 4): Piece[] {
  const others = pieces.filter((item) => item.id !== piece.id);
  const sameCategory = others.filter((item) => item.category === piece.category);
  const rest = others.filter((item) => item.category !== piece.category);

  return [...sameCategory, ...rest].slice(0, count);
}
