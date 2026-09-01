/**
 * Page-local content for /new-drop (men) and /women.
 *
 * The storefront fixtures (`features/02-products`) carry four hero SKUs and a
 * sprite sheet — enough for a PDP, not enough to fill three editorial grids.
 * This module is the listing's own copy deck and shot list; it deliberately
 * does NOT touch `product-fixtures.ts`, so /new-drop and the detail pages keep
 * quoting the same catalogue they always have.
 *
 * IMAGERY. Only five photographs ship in /public/images, so every tile is a
 * *crop* of one of them rather than a fifth reuse of the same framing. A crop
 * is `{ src, op, z }`: `op` is the object-position the tile centres on and `z`
 * the scale applied around it, with `transform-origin` pinned to the same
 * point. `drop-001-products` is a 2×2 contact sheet, so op `25%/75%` at z 2
 * isolates one garment exactly.
 */

export type Crop = {
  src: string;
  /** object-position AND transform-origin — the two must agree or the crop drifts */
  op: string;
  /** scale around `op`; 1 keeps the whole frame */
  z?: number;
};

const DROP = "/images/drop-001-products.webp";
const STILL = "/images/product-still-life-v2.webp";
const CAMPAIGN = "/images/campaign-after-hours-v2.webp";
const HERO = "/images/iced-out-hero.webp";
const WIDE = "/images/iced-out-og.jpg";

/** The crop library — every tile on the page points at one of these. */
export const CROPS = {
  /* the 2×2 contact sheet, one garment per quadrant */
  hoodie: { src: DROP, op: "25% 25%", z: 2 },
  overshirt: { src: DROP, op: "75% 25%", z: 2 },
  cargo: { src: DROP, op: "25% 75%", z: 2 },
  tee: { src: DROP, op: "75% 75%", z: 2 },
  hoodieWide: { src: DROP, op: "25% 25%", z: 1.6 },
  overshirtWide: { src: DROP, op: "75% 25%", z: 1.6 },
  cargoWide: { src: DROP, op: "25% 75%", z: 1.6 },
  teeWide: { src: DROP, op: "75% 75%", z: 1.6 },

  /* the still life, read as five separate product shots */
  stillHoodie: { src: STILL, op: "43% 46%", z: 2.4 },
  stillJacket: { src: STILL, op: "72% 38%", z: 2.4 },
  stillCargo: { src: STILL, op: "70% 78%", z: 2.4 },
  stillPouch: { src: STILL, op: "21% 85%", z: 2.9 },
  stillHardware: { src: STILL, op: "14% 60%", z: 3.4 },
  stillCollar: { src: STILL, op: "66% 20%", z: 3.2 },
  stillFlat: { src: STILL, op: "52% 52%", z: 1.25 },

  /* the after-hours campaign */
  campWoman: { src: CAMPAIGN, op: "57% 54%", z: 2.05 },
  campMan: { src: CAMPAIGN, op: "74% 52%", z: 2.05 },
  campPair: { src: CAMPAIGN, op: "66% 55%", z: 1.5 },
  campBoots: { src: CAMPAIGN, op: "72% 90%", z: 3.1 },
  campWide: { src: CAMPAIGN, op: "62% 50%", z: 1 },

  /* the gold-wall hero frame */
  heroWoman: { src: HERO, op: "60% 54%", z: 2.05 },
  heroMan: { src: HERO, op: "74% 50%", z: 2.05 },
  heroPair: { src: HERO, op: "67% 54%", z: 1.55 },
  heroWide: { src: HERO, op: "64% 50%", z: 1 },

  /* the wide plate, for the full-bleed bands */
  wide: { src: WIDE, op: "58% 50%", z: 1 },
  wideWoman: { src: WIDE, op: "58% 48%", z: 1.9 },
  wideMan: { src: WIDE, op: "75% 48%", z: 1.9 },
} as const satisfies Record<string, Crop>;

export type CropKey = keyof typeof CROPS;

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A release count in words, for copy that says it in a sentence.
 *
 * The intro headline reads "Twenty pieces cut for weight and movement" — a
 * sentence, so the number belongs in it as a word. It stops at twenty because
 * past that a spelled-out number sets badly in a display face and the numeral
 * carries it better.
 *
 * Stats print the figure instead; both come from the same live count, they just
 * disagree about how a number should look.
 */
const COUNT_WORDS = [
  "No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen", "Twenty",
];

export function spellCount(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}

/**
 * The run of page numbers a pager draws: always the first and the last, always
 * the current one and its two neighbours, and a single gap marker standing in
 * for whatever falls between.
 *
 * Shared vocabulary rather than a helper on either listing, because both
 * catalogues page the same catalogue — /new-man eight tiles at a time, and
 * /new-woman nine — and two copies of this is two places for the elision rule
 * to drift apart.
 *
 * Nothing is elided at today's release; the window is here because a catalogue
 * is a thing an operator adds to, and a bar that grows one button per page
 * stops fitting.
 */
export function pageRun(current: number, count: number): Array<number | "gap"> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);

  const wanted = [1, count, current - 1, current, current + 1].filter(
    (n) => n >= 1 && n <= count,
  );
  const pages = [...new Set(wanted)].sort((a, b) => a - b);

  const run: Array<number | "gap"> = [];
  pages.forEach((n, i) => {
    const prev = pages[i - 1];
    if (i > 0 && n - prev > 1) {
      /* A gap of exactly one is not worth a marker — "1 … 3" costs the same
         width as "1 2 3" and hides a page instead of offering it. */
      run.push(n - prev === 2 ? prev + 1 : "gap");
    }
    run.push(n);
  });
  return run;
}

export type Category =
  | "outerwear"
  | "knitwear"
  | "trousers"
  | "tops"
  | "accessories";

export type Piece = {
  id: string;
  name: string;
  /**
   * The product's own slug, straight off the record (`use-pieces.ts`).
   *
   * It used to be one of four fixture slugs shared across twenty tiles, which
   * is why the detail route resolves on the NAME instead (`pieceHref`). Now
   * that it is the record's own slug, `pieceForSlug` accepts it too.
   */
  slug: string;
  category: Category;
  /** the chip in the tile's top-right corner */
  tag: string;
  /**
   * The collection the product is filed under, when it has one.
   *
   * Optional because the fixture rows below predate it and a product can be
   * published without one. It exists so a surface can say which collections it
   * is actually showing rather than asserting a drop — see the women's hero
   * ledger, which used to print Drop 001's edition size over a grid that spans
   * all three.
   */
  collection?: string;
  /** paise-free rupees, formatted at render */
  price: number;
  compareAt?: number;
  /** The sprite crop, used when there is no uploaded photo. */
  crop: CropKey;
  /**
   * The product's own photo, if an operator has uploaded one.
   *
   * `crop` is the fallback: the seeded catalogue starts with no photographs, and a
   * page of empty frames is worse than a page of repeated crops. See
   * `use-pieces.ts`, which builds these from the live catalogue.
   */
  image?: string;
  /** The product's approved rating, and how many reviews it is an average of. */
  rating?: number;
  reviewCount?: number;
  isNew?: boolean;
  soldOut?: boolean;
};

export const CATEGORIES: { value: Category | "all"; label: string }[] = [
  { value: "all", label: "All pieces" },
  { value: "outerwear", label: "Outerwear" },
  { value: "knitwear", label: "Knitwear" },
  { value: "trousers", label: "Trousers" },
  { value: "tops", label: "Tops" },
  { value: "accessories", label: "Accessories" },
];

export const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest first" },
  { value: "price-low", label: "Price · low to high" },
  { value: "price-high", label: "Price · high to low" },
] as const;

export type SortValue = (typeof SORTS)[number]["value"];

/* The four fixture slugs — every tile lands on a page that actually exists. */
const SLUGS = [
  "afterdark-hoodie",
  "bone-utility-overshirt",
  "shadow-cargo-02",
  "core-heavy-tee",
] as const;

const slug = (i: number) => SLUGS[i % SLUGS.length];

const MEN_PIECES: Piece[] = [
  { id: "m01", name: "Afterdark Hoodie", slug: slug(0), category: "knitwear", tag: "Drop 001", price: 8900, compareAt: 10200, crop: "hoodie" },
  { id: "m02", name: "Shadow Cargo 02", slug: slug(2), category: "trousers", tag: "Utility", price: 9800, crop: "cargo", isNew: true },
  { id: "m03", name: "Bone Utility Overshirt", slug: slug(1), category: "outerwear", tag: "New", price: 11400, crop: "overshirt", isNew: true },
  { id: "m04", name: "Core Heavy Tee", slug: slug(3), category: "tops", tag: "Core", price: 4200, crop: "tee" },
  { id: "m05", name: "Nightshift Overcoat", slug: slug(1), category: "outerwear", tag: "Archive", price: 18600, crop: "campMan" },
  { id: "m06", name: "Concrete Zip Hood", slug: slug(0), category: "knitwear", tag: "Heavyweight", price: 10400, crop: "heroMan" },
  { id: "m07", name: "Ballast Cargo Pant", slug: slug(2), category: "trousers", tag: "Wide leg", price: 9200, crop: "stillCargo" },
  { id: "m08", name: "Vault Carry Pouch", slug: slug(3), category: "accessories", tag: "Hardware", price: 3800, crop: "stillPouch", isNew: true },

  { id: "m09", name: "Chain Link Set", slug: slug(3), category: "accessories", tag: "Metal", price: 2600, crop: "stillHardware" },
  { id: "m10", name: "Gravel Wash Hoodie", slug: slug(0), category: "knitwear", tag: "520 GSM", price: 8600, crop: "stillHoodie" },
  { id: "m11", name: "Bone Field Jacket", slug: slug(1), category: "outerwear", tag: "Canvas", price: 13900, crop: "stillJacket", soldOut: true },
  { id: "m12", name: "Signal Boot", slug: slug(2), category: "accessories", tag: "Footwear", price: 15400, crop: "campBoots" },
  { id: "m13", name: "Static Boxy Tee", slug: slug(3), category: "tops", tag: "Boxy", price: 4400, crop: "teeWide" },
  { id: "m14", name: "Underpass Shell", slug: slug(1), category: "outerwear", tag: "Technical", price: 16200, crop: "campPair", isNew: true },

  { id: "m15", name: "Collar Study Overshirt", slug: slug(1), category: "outerwear", tag: "Detail", price: 11800, crop: "stillCollar" },
  { id: "m16", name: "Low Profile Cargo", slug: slug(2), category: "trousers", tag: "Relaxed", price: 8800, compareAt: 9900, crop: "cargoWide" },
  { id: "m17", name: "Monolith Hood", slug: slug(0), category: "knitwear", tag: "Oversized", price: 9600, crop: "hoodieWide" },
  { id: "m18", name: "Uniform Long Sleeve", slug: slug(3), category: "tops", tag: "Core", price: 5200, crop: "wideMan" },
  { id: "m19", name: "Drop 001 Flat Lay", slug: slug(0), category: "accessories", tag: "Set of 3", price: 21500, crop: "stillFlat" },
  { id: "m20", name: "Freight Overshirt", slug: slug(1), category: "outerwear", tag: "Bone", price: 12400, crop: "overshirtWide" },
];

const WOMEN_PIECES: Piece[] = [
  { id: "w01", name: "Bone Utility Overshirt", slug: slug(1), category: "outerwear", tag: "New", price: 11400, crop: "overshirt", isNew: true },
  { id: "w02", name: "Afterdark Hoodie", slug: slug(0), category: "knitwear", tag: "Drop 001", price: 8900, compareAt: 10200, crop: "hoodie" },
  { id: "w03", name: "Volume Cargo 02", slug: slug(2), category: "trousers", tag: "Wide leg", price: 9800, crop: "cargo", isNew: true },
  { id: "w04", name: "Core Heavy Tee", slug: slug(3), category: "tops", tag: "Core", price: 4200, crop: "tee" },
  { id: "w05", name: "Bone Long Coat", slug: slug(1), category: "outerwear", tag: "Archive", price: 19800, crop: "campWoman" },
  { id: "w06", name: "Structured Zip Hood", slug: slug(0), category: "knitwear", tag: "Heavyweight", price: 10400, crop: "heroWoman" },
  { id: "w07", name: "Deadstock Wide Trouser", slug: slug(2), category: "trousers", tag: "Twill", price: 9400, crop: "stillCargo" },
  { id: "w08", name: "Vault Clutch", slug: slug(3), category: "accessories", tag: "Hardware", price: 3800, crop: "stillPouch", isNew: true },

  { id: "w09", name: "Link Chain Belt", slug: slug(3), category: "accessories", tag: "Metal", price: 2600, crop: "stillHardware" },
  { id: "w10", name: "Washed Crop Hoodie", slug: slug(0), category: "knitwear", tag: "520 GSM", price: 8600, crop: "stillHoodie" },
  { id: "w11", name: "Ivory Work Jacket", slug: slug(1), category: "outerwear", tag: "Canvas", price: 13900, crop: "stillJacket" },
  { id: "w12", name: "Signal Boot", slug: slug(2), category: "accessories", tag: "Footwear", price: 15400, crop: "campBoots", soldOut: true },
  { id: "w13", name: "Sculpt Boxy Tee", slug: slug(3), category: "tops", tag: "Boxy", price: 4400, crop: "teeWide" },
  { id: "w14", name: "Underpass Shell", slug: slug(1), category: "outerwear", tag: "Technical", price: 16200, crop: "campPair", isNew: true },

  { id: "w15", name: "Collar Study Shirt", slug: slug(1), category: "outerwear", tag: "Detail", price: 11800, crop: "stillCollar" },
  { id: "w16", name: "Drape Cargo Pant", slug: slug(2), category: "trousers", tag: "Relaxed", price: 8800, compareAt: 9900, crop: "cargoWide" },
  { id: "w17", name: "Monolith Hood", slug: slug(0), category: "knitwear", tag: "Oversized", price: 9600, crop: "hoodieWide" },
  { id: "w18", name: "Uniform Long Sleeve", slug: slug(3), category: "tops", tag: "Core", price: 5200, crop: "wideWoman" },
  { id: "w19", name: "Drop 001 Flat Lay", slug: slug(0), category: "accessories", tag: "Set of 3", price: 21500, crop: "stillFlat" },
  { id: "w20", name: "Freight Overshirt", slug: slug(1), category: "outerwear", tag: "Bone", price: 12400, crop: "overshirtWide" },
];

/* -------------------------------------------------------------------------- */
/* Lookbook                                                                   */
/* -------------------------------------------------------------------------- */

export type LookPin = {
  id: string;
  /** percentage coordinates on the stage image */
  x: number;
  y: number;
  /**
   * The garment this pin is on, by name.
   *
   * It is the key as well as the caption: the link resolves it against the live
   * catalogue (`pieceForPin`). A `slug` used to sit beside it, and it held one
   * of four storefront fixtures rather than this piece — so a pin captioned
   * "Underpass Shell · ₹16,200" opened the Bone Utility Overshirt at ₹11,400.
   * A route the copy deck asserts is a route nothing can keep true.
   */
  name: string;
  meta: string;
  price: number;
  crop: CropKey;
};

export type Look = {
  id: string;
  label: string;
  title: string;
  copy: string;
  crop: CropKey;
  pins: LookPin[];
};

/* -------------------------------------------------------------------------- */
/* Copy decks                                                                 */
/* -------------------------------------------------------------------------- */

export type HeroTile = { crop: CropKey; ratio: string };

export type AudienceContent = {
  audience: "men" | "women";
  label: string;

  hero: {
    /** the kicker above the headline — release, then audience */
    eyebrow: string;
    /** the headline, split into the heavy cut and its dimmed tail */
    heavy: string;
    light: string;
    sub: string;
    primary: { label: string; href: string };
    secondary: { label: string; href: string };
    /** three columns, cycled into an infinite marquee across the wall */
    columns: HeroTile[][];
  };

  intro: {
    eyebrow: string;
    heavy: string;
    light: string;
    ghost: string;
    body: string;
    note: string;
    specs: { value: string; label: string }[];
  };

  shelves: {
    eyebrow: string;
    heavy: string;
    light: string;
    right: string;
    foot: string;
  }[];

  band: {
    eyebrow: string;
    heavy: string;
    light: string;
    body: string;
    cta: string;
    marquee: string;
    crop: CropKey;
  };

  look: {
    eyebrow: string;
    heavy: string;
    light: string;
    body: string;
    looks: Look[];
  };

  story: {
    word: string;
    eyebrow: string;
    heavy: string;
    light: string;
    body: string[];
    principles: { key: string; text: string }[];
    crop: CropKey;
    stamp: string;
  };

  pieces: Piece[];
};

const HERO_COLUMNS_MEN: HeroTile[][] = [
  [
    { crop: "campMan", ratio: "3 / 3.4" },
    { crop: "hoodie", ratio: "1 / 1" },
    { crop: "stillCargo", ratio: "3 / 3.8" },
    { crop: "heroMan", ratio: "1 / 1" },
  ],
  [
    { crop: "overshirt", ratio: "3 / 3.9" },
    { crop: "campBoots", ratio: "1 / 1" },
    { crop: "stillHoodie", ratio: "3 / 3.3" },
    { crop: "tee", ratio: "1 / 1" },
  ],
  [
    { crop: "stillFlat", ratio: "1 / 1" },
    { crop: "heroPair", ratio: "3 / 3.6" },
    { crop: "stillHardware", ratio: "1 / 1" },
    { crop: "cargo", ratio: "3 / 3.7" },
  ],
];

const HERO_COLUMNS_WOMEN: HeroTile[][] = [
  [
    { crop: "campWoman", ratio: "3 / 3.4" },
    { crop: "overshirt", ratio: "1 / 1" },
    { crop: "stillJacket", ratio: "3 / 3.8" },
    { crop: "heroWoman", ratio: "1 / 1" },
  ],
  [
    { crop: "hoodie", ratio: "3 / 3.9" },
    { crop: "stillPouch", ratio: "1 / 1" },
    { crop: "stillCargo", ratio: "3 / 3.3" },
    { crop: "tee", ratio: "1 / 1" },
  ],
  [
    { crop: "stillFlat", ratio: "1 / 1" },
    { crop: "campPair", ratio: "3 / 3.6" },
    { crop: "stillHardware", ratio: "1 / 1" },
    { crop: "cargo", ratio: "3 / 3.7" },
  ],
];

export const MEN: AudienceContent = {
  audience: "men",
  label: "Men",
  pieces: MEN_PIECES,

  hero: {
    eyebrow: "Drop 001 · Menswear",
    heavy: "Nothing Here ",
    light: "Comes Back.",
    sub: "520 GSM fleece, four-pocket canvas, articulated cargo. Built with the heft left in.",
    primary: { label: "Shop the Edit", href: "#gx-edit" },
    secondary: { label: "Explore Lookbook", href: "#gx-lookbook" },
    columns: HERO_COLUMNS_MEN,
  },

  intro: {
    eyebrow: "Iced_out / Men / Drop 001",
    heavy: "{count} pieces cut for ",
    light: "weight and movement",
    ghost: "Menswear",
    body: "The men's edit is built around three anchors — a 520 GSM fleece, a four-pocket canvas overshirt, and a wide-leg cargo balanced by articulated knees. Everything else is designed to sit under, over, or beside them.",
    note: "Produced in a single run at our Bengaluru studio. When a size closes, it closes.",
    specs: [
      { value: "{count}", label: "Pieces live" },
      { value: "320", label: "Numbered units" },
      { value: "01", label: "Production run" },
    ],
  },

  shelves: [
    {
      eyebrow: "The edit",
      heavy: "Core of the ",
      light: "men's release",
      right: "01 / 03",
      foot: "Load the full edit",
    },
    {
      eyebrow: "Utility",
      heavy: "Layers that ",
      light: "carry weight",
      right: "02 / 03",
      foot: "Keep going",
    },
    {
      eyebrow: "Closing",
      heavy: "Last of the ",
      light: "first run",
      right: "03 / 03",
      foot: "View every piece",
    },
  ],

  band: {
    eyebrow: "Campaign / After hours",
    heavy: "Designed for the ",
    light: "walk home",
    body: "Shot at 3am under the flyover. No styling, no retouching — the clothes as they behave when nobody is watching.",
    cta: "See the campaign",
    marquee: "After hours · After hours · After hours ·",
    crop: "campWide",
  },

  look: {
    eyebrow: "Lookbook",
    heavy: "Shop the ",
    light: "look",
    body: "Three complete fits from the men's release. Tap a pin to read the piece, or take the whole look in one move.",
    looks: [
      {
        id: "look-01",
        label: "Look 01",
        title: "Underpass",
        copy: "Shell over heavyweight fleece, wide-leg cargo, chain hardware. The default after-dark uniform.",
        crop: "campWide",
        pins: [
          { id: "p1", x: 74, y: 30, name: "Underpass Shell", meta: "Outerwear", price: 16200, crop: "campMan" },
          { id: "p2", x: 71, y: 62, name: "Shadow Cargo 02", meta: "Trousers", price: 9800, crop: "cargo" },
          { id: "p3", x: 76, y: 88, name: "Signal Boot", meta: "Footwear", price: 15400, crop: "campBoots" },
        ],
      },
      {
        id: "look-02",
        label: "Look 02",
        title: "Gold Wall",
        copy: "Zip hood over a boxy tee, drop-shoulder through the body, cargo cut long over the boot.",
        crop: "heroWide",
        pins: [
          { id: "p1", x: 74, y: 32, name: "Concrete Zip Hood", meta: "Knitwear", price: 10400, crop: "heroMan" },
          { id: "p2", x: 72, y: 55, name: "Core Heavy Tee", meta: "Tops", price: 4200, crop: "tee" },
          { id: "p3", x: 75, y: 76, name: "Ballast Cargo Pant", meta: "Trousers", price: 9200, crop: "stillCargo" },
        ],
      },
      {
        id: "look-03",
        label: "Look 03",
        title: "Flat Lay",
        copy: "The pieces off the body — fleece, canvas overshirt, cargo and the full hardware set laid out as shipped.",
        crop: "stillFlat",
        pins: [
          { id: "p1", x: 40, y: 46, name: "Gravel Wash Hoodie", meta: "Knitwear", price: 8600, crop: "stillHoodie" },
          { id: "p2", x: 71, y: 34, name: "Bone Field Jacket", meta: "Outerwear", price: 13900, crop: "stillJacket" },
          { id: "p3", x: 68, y: 76, name: "Ballast Cargo Pant", meta: "Trousers", price: 9200, crop: "stillCargo" },
          { id: "p4", x: 20, y: 84, name: "Vault Carry Pouch", meta: "Accessories", price: 3800, crop: "stillPouch" },
        ],
      },
    ],
  },

  story: {
    word: "ICED_OUT",
    eyebrow: "The studio",
    heavy: "Cold by nature. ",
    light: "Limited by design.",
    body: [
      "We produce once. A drop is patterned, graded, cut and finished in a single run, and the run is the edition — there is no second batch waiting behind it.",
      "That constraint decides everything else: heavier cloth than the price suggests, hardware that ages instead of failing, and a size curve set by what people actually ask for rather than what is cheapest to make.",
    ],
    principles: [
      { key: "01", text: "Single-run production. Numbered, dated, never restocked." },
      { key: "02", text: "520 GSM fleece and 410 GSM canvas as the floor, not the ceiling." },
      { key: "03", text: "Cut and finished in Bengaluru. Shipped worldwide from one studio." },
    ],
    crop: "campWoman",
    stamp: "Est. 2024 / Bengaluru",
  },
};

export const WOMEN: AudienceContent = {
  audience: "women",
  label: "Women",
  pieces: WOMEN_PIECES,

  hero: {
    eyebrow: "Drop 001 · Womenswear",
    heavy: "Nothing Here ",
    light: "Comes Back.",
    sub: "Drape-cut trousers, clean-collar canvas, dropped-shoulder fleece. Volume that stays where it is put.",
    primary: { label: "Shop the Edit", href: "#gx-edit" },
    secondary: { label: "Explore Lookbook", href: "#gx-lookbook" },
    columns: HERO_COLUMNS_WOMEN,
  },

  intro: {
    eyebrow: "Iced_out / Women / Drop 001",
    heavy: "{count} pieces cut for ",
    light: "volume and line",
    ghost: "Womenswear",
    body: "The women's edit runs on three anchors — a bone canvas overshirt with a clean collar, a drape-cut wide trouser, and a garment-washed fleece with a dropped shoulder. The rest is built to layer against them.",
    note: "Produced in a single run at our Bengaluru studio. When a size closes, it closes.",
    specs: [
      { value: "{count}", label: "Pieces live" },
      { value: "320", label: "Numbered units" },
      { value: "01", label: "Production run" },
    ],
  },

  shelves: [
    {
      eyebrow: "The edit",
      heavy: "Core of the ",
      light: "women's release",
      right: "01 / 03",
      foot: "Load the full edit",
    },
    {
      eyebrow: "Structure",
      heavy: "Layers that ",
      light: "hold their line",
      right: "02 / 03",
      foot: "Keep going",
    },
    {
      eyebrow: "Closing",
      heavy: "Last of the ",
      light: "first run",
      right: "03 / 03",
      foot: "View every piece",
    },
  ],

  band: {
    eyebrow: "Campaign / After hours",
    heavy: "Cut to move ",
    light: "at your pace",
    body: "Shot at 3am under the flyover. No styling, no retouching — the clothes as they behave when nobody is watching.",
    cta: "See the campaign",
    marquee: "After hours · After hours · After hours ·",
    crop: "campWide",
  },

  look: {
    eyebrow: "Lookbook",
    heavy: "Shop the ",
    light: "look",
    body: "Three complete fits from the women's release. Tap a pin to read the piece, or take the whole look in one move.",
    looks: [
      {
        id: "look-01",
        label: "Look 01",
        title: "Underpass",
        copy: "Bone long coat over a washed fleece, volume trouser cut to break on the boot.",
        crop: "campWide",
        pins: [
          { id: "p1", x: 57, y: 34, name: "Bone Long Coat", meta: "Outerwear", price: 19800, crop: "campWoman" },
          { id: "p2", x: 55, y: 62, name: "Volume Cargo 02", meta: "Trousers", price: 9800, crop: "cargo" },
          { id: "p3", x: 58, y: 87, name: "Signal Boot", meta: "Footwear", price: 15400, crop: "campBoots" },
        ],
      },
      {
        id: "look-02",
        label: "Look 02",
        title: "Gold Wall",
        copy: "Structured zip hood over a boxy tee, drape trouser, chain at the waist.",
        crop: "heroWide",
        pins: [
          { id: "p1", x: 60, y: 32, name: "Structured Zip Hood", meta: "Knitwear", price: 10400, crop: "heroWoman" },
          { id: "p2", x: 58, y: 54, name: "Sculpt Boxy Tee", meta: "Tops", price: 4400, crop: "teeWide" },
          { id: "p3", x: 60, y: 76, name: "Drape Cargo Pant", meta: "Trousers", price: 8800, crop: "cargoWide" },
        ],
      },
      {
        id: "look-03",
        label: "Look 03",
        title: "Flat Lay",
        copy: "The pieces off the body — fleece, ivory work jacket, wide trouser and the full hardware set as shipped.",
        crop: "stillFlat",
        pins: [
          { id: "p1", x: 40, y: 46, name: "Washed Crop Hoodie", meta: "Knitwear", price: 8600, crop: "stillHoodie" },
          { id: "p2", x: 71, y: 34, name: "Ivory Work Jacket", meta: "Outerwear", price: 13900, crop: "stillJacket" },
          { id: "p3", x: 68, y: 76, name: "Deadstock Wide Trouser", meta: "Trousers", price: 9400, crop: "stillCargo" },
          { id: "p4", x: 20, y: 84, name: "Vault Clutch", meta: "Accessories", price: 3800, crop: "stillPouch" },
        ],
      },
    ],
  },

  story: {
    word: "ICED_OUT",
    eyebrow: "The studio",
    heavy: "Cold by nature. ",
    light: "Limited by design.",
    body: [
      "We produce once. A drop is patterned, graded, cut and finished in a single run, and the run is the edition — there is no second batch waiting behind it.",
      "That constraint decides everything else: heavier cloth than the price suggests, hardware that ages instead of failing, and a size curve set by what people actually ask for rather than what is cheapest to make.",
    ],
    principles: [
      { key: "01", text: "Single-run production. Numbered, dated, never restocked." },
      { key: "02", text: "520 GSM fleece and 410 GSM canvas as the floor, not the ceiling." },
      { key: "03", text: "Cut and finished in Bengaluru. Shipped worldwide from one studio." },
    ],
    crop: "campMan",
    stamp: "Est. 2024 / Bengaluru",
  },
};

export const FOOT_COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "Men", href: "/new-man" },
      { label: "Women", href: "/new-woman" },
      { label: "New drop", href: "/new-drop" },
      /* "Sale" sat here and pointed at /sale, which no longer exists. The
         Shop column is the three destinations that do. */
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Shipping", href: "/pages/shipping-policy" },
      { label: "Returns", href: "/pages/return-policy" },
      { label: "Track order", href: "/track" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Studio",
    links: [
      { label: "About", href: "/about" },
      /* "Collections" sat here and pointed at /collections, which no longer
         exists. It is not replaced with /new-drop: the Shop column above
         already carries that, and a footer naming one destination twice is
         worse than a column of three. */
      { label: "Wishlist", href: "/wishlist" },
      /* "Search" pointed at /search, which is gone — searching is the header's
         dock now (`nav/search-dock`), reachable from every page, so there is
         nothing for a footer link to open. */
      { label: "Track order", href: "/track" },
    ],
  },
];

/** ₹ with a thousands separator — the storefront's own format. */
export function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}
