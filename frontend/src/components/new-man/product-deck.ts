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

import { type CropKey } from "@/components/gender/data";
import {
  MEN_PIECES,
  frameForCrop,
  hash,
  type Frame,
  type Piece,
} from "@/components/new-man/data";

/* -------------------------------------------------------------------------- */
/* Routing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The piece's own URL segment.
 *
 * `piece.slug` cannot be it: twenty tiles share four fixture slugs, so routing
 * on that collapses the release to four pages and makes "which piece is this"
 * unanswerable. The name is unique across the release, so it is the key — and
 * it keeps the fixture slugs pointing at the storefront PDP they always did.
 */
export function productSlug(piece: Piece) {
  return piece.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function pieceForSlug(slug: string) {
  return MEN_PIECES.find((piece) => productSlug(piece) === slug);
}

/** Every men's piece, as a route. */
export const PRODUCT_ROUTES = MEN_PIECES.map((piece) => productSlug(piece));

/* -------------------------------------------------------------------------- */
/* Gallery                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Only five photographs ship in /public/images, so a four-shot gallery is four
 * framings rather than four files — the same trick the listing tiles use.
 *
 * The piece's own crop leads; the other three are taken off this rotation at an
 * offset derived from the piece id, so two tiles in the same row do not open
 * onto identical galleries. Wide plates first: after the tight product crop the
 * eye wants context, not another detail.
 */
const GALLERY_POOL: CropKey[] = [
  "campWide",
  "heroWide",
  "stillFlat",
  "campPair",
  "heroPair",
  "stillCollar",
  "campMan",
  "heroMan",
  "stillHardware",
  "campBoots",
  "stillHoodie",
  "stillJacket",
];

export const GALLERY_LENGTH = 4;

export function shotsFor(piece: Piece): Frame[] {
  const pool = GALLERY_POOL.filter((key) => key !== piece.crop);
  const start = hash(piece.id) % pool.length;

  const keys: CropKey[] = [piece.crop];
  for (let step = 0; keys.length < GALLERY_LENGTH; step += 1) {
    keys.push(pool[(start + step) % pool.length]);
  }

  return keys.map(frameForCrop);
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

export const PRODUCT_COPY = {
  featuresHref: "#nmp-details",
  /* There is no `sizeGuideHref`. The size guide is a DIALOG on this page, not a
     route — see `SIZE_CHARTS` below and `size-guide.tsx`. A shopper reaches for
     it in the middle of choosing a size, and a link that took them off the page
     to read a table meant losing the picker, the shot and the scroll position to
     get back to exactly where they already were. */
  /** where "back" goes: the men's grid, scrolled to the tile that led here */
  backHref: "/new-man#edit",
  notes: ["Free shipping over ₹4,999", "30-day returns", "Exchanges free once per order"],
  /** the head over the related grid — SplitHeading segments, light cut second */
  relatedHeading: [{ text: "You might also " }, { text: "like", light: true }],
} as const;

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

/**
 * PAGE-LOCAL DEMO REVIEWS. Nothing in the repository stores customer reviews
 * yet — `features/11-reviews` is a moderation workspace over fixtures — so the
 * three below are written copy standing in for the shape the section needs, not
 * quotations from anybody. Swap the whole block for the real feed when there
 * is one; the component reads the counts, never a hardcoded average.
 */
export type Review = {
  id: string;
  name: string;
  avatar: string;
  date: string;
  stars: number;
  body: string;
};

export const REVIEWS: Review[] = [
  {
    id: "r1",
    name: "Alex Mathio",
    avatar: "/images/avatar-1.jpg",
    date: "13 Oct 2025",
    stars: 5,
    body: "Heavier than the photographs suggest, in the best way. The shoulder sits exactly where the size chart said it would and the hardware has not loosened once in six months of daily wear.",
  },
  {
    id: "r2",
    name: "Priya Raghavan",
    avatar: "/images/avatar-2.jpg",
    date: "02 Oct 2025",
    stars: 5,
    body: "Ordered a size down on the studio's advice and it was the right call. The wash is genuinely matte — no sheen under shop lighting, which is rare at this weight.",
  },
  {
    id: "r3",
    name: "Daniel Okafor",
    avatar: "/images/avatar-3.jpg",
    date: "24 Sep 2025",
    stars: 4,
    body: "Cut and finish are excellent. Half a star off only because the dispatch ran a day past the window quoted at checkout — the piece itself I have no notes on.",
  },
];

/** 5★ down to 1★. The average and the total are derived from these. */
export const RATING_COUNTS = [36, 9, 2, 2, 1] as const;

export function ratingSummary() {
  const total = RATING_COUNTS.reduce((sum, count) => sum + count, 0);
  const points = RATING_COUNTS.reduce(
    (sum, count, index) => sum + count * (5 - index),
    0,
  );

  return { total, average: points / total };
}

/**
 * A tile's star rating in the related grid.
 *
 * Also demo content, and deliberately derived from the piece id so it is the
 * same number on the server, on the client, and on every reload — a rating that
 * shuffles between renders reads as broken long before it reads as fake.
 */
const TILE_RATINGS = [3.5, 4, 4.5, 5] as const;

export function ratingFor(piece: Piece) {
  return TILE_RATINGS[hash(`${piece.id}-rating`) % TILE_RATINGS.length];
}

/* -------------------------------------------------------------------------- */
/* Related                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Four more pieces: same category first, then the rest of the release in
 * authored order. Never the piece being viewed.
 */
export function relatedTo(piece: Piece, count = 4): Piece[] {
  const others = MEN_PIECES.filter((item) => item.id !== piece.id);
  const sameCategory = others.filter((item) => item.category === piece.category);
  const rest = others.filter((item) => item.category !== piece.category);

  return [...sameCategory, ...rest].slice(0, count);
}
