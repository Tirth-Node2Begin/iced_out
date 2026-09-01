/**
 * Content deck for /new-woman.
 *
 * The women's surface is NOT the men's page with different words in it. It
 * renders its own sections — an asymmetric hero, a horizontally-driven "line"
 * strip, an arched-frame edit, a closing band — so everything those sections
 * say lives here rather than in `DEPARTMENTS.women`, which only ever described
 * the three home-page components /new-woman used to borrow.
 *
 * What it deliberately does NOT hold is a catalogue. The tiles are the published
 * products whose audience is `women` or `unisex`, read through `useGenderPieces`
 * exactly as /new-man and /new-drop read theirs, and framed by the same
 * arithmetic (`frameFor`) so a piece is cropped identically wherever it appears.
 */

import type { Segment } from "@/components/new-home/motion-primitives";

/* -------------------------------------------------------------------------- */
/* Imagery                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A framed photograph, as this page addresses one.
 *
 * The same `{ src, op, zoom }` shape the shared crop library uses — object
 * position and transform origin are the SAME point, or a zoom walks the frame
 * off the subject it was measured against.
 *
 * These are their own crops rather than entries in `CROPS` because that library
 * is read by /new-drop, /women and /new-man, and re-framing it to suit this
 * page would re-crop tiles on three surfaces this page has no business
 * touching.
 */
export type Shot = { src: string; alt: string; op: string; zoom: number };

const H2 = (name: string) => `/images/home-v2/${name}`;

/** The eight words that run in the ribbon under the hero. */
export const RIBBON = [
  "Womenswear",
  "Three collections",
  "Numbered units",
  "XS — XL",
  "Cut in Bengaluru",
  "Studio direct",
];

/* -------------------------------------------------------------------------- */
/* 01 — hero                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The garment that stands on the hero's plinth.
 *
 * A background-removed PNG, as on the root — anything with a baked-in
 * background reads as a pasted rectangle against the stage's gradient. The
 * cream knit rather than the black hoodie the root flies: a light subject on a
 * dark stage is the inverse of the home page at a glance, which is what keeps
 * two full-bleed hero stages from reading as the same screen twice. It is also
 * the colour this floor actually sells — bone, ivory, cream.
 */
export const HERO_GARMENT = {
  src: "/images/generated/ghost-products/ghost-knit.png",
  alt: "Cream ribbed knit polo, ghost mannequin cutout",
} as const;

export const HERO = {
  /**
   * The accessible heading.
   *
   * The two words on screen are the WORDMARK, not a sentence about this page —
   * so the page states what it is here and the split pair is marked decorative,
   * exactly as the root's hero does with the same two words.
   */
  title: "Womenswear",
  kicker: "The women's edit",
  /** the two words the garment stands between, split left and right */
  split: ["Iced", "Out"] as [string, string],
  /** the oversized word that runs edge to edge behind it */
  ghost: "Womenswear",
  /* "A single numbered run" went with the Drop 001 label: it is one
     collection's production story, and this page shows three. */
  lede: "Structured volume and monochrome layers, cut and finished in the Bengaluru studio.",
  ctas: [
    { label: "Shop the edit", href: "#nw-edit" },
    { label: "Read the line", href: "#nw-line" },
  ],
  /**
   * The ledger, bottom-left. Both figures are READ FROM THE CATALOGUE at
   * render; neither is typed in.
   *
   * The second one used to be the literal "320 / Numbered units", which is Drop
   * 001's edition size — and this page is not Drop 001. Of the eleven pieces
   * the grid shows, five are Drop 001, three are After Hours and three are Core
   * Uniform, so a hero announcing one drop's run over that grid was stating a
   * number nothing beneath it could back. It counts the collections instead,
   * which is a fact about what is actually on the page.
   */
  ledger: [
    { key: "pieces", source: "pieces", label: "Pieces live" },
    { key: "collections", source: "collections", label: "Collections" },
  ] as { key: string; source: "pieces" | "collections"; label: string }[],
  /** the spec label, bottom-right, in the register both other heroes pin */
  spec: ["Fit:", "Sculpt"],
} as const;

/* -------------------------------------------------------------------------- */
/* 02 — the line                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The four panels of the horizontal strip.
 *
 * It reads as a sentence about how the release is made, one clause per panel,
 * which is why the copy is written to be read in order rather than as four
 * interchangeable cards.
 */
export type LinePanel = {
  key: string;
  index: string;
  title: string;
  body: string;
  shot: Shot;
  spec: { key: string; value: string }[];
};

export const LINE: LinePanel[] = [
  {
    key: "proportion",
    index: "01",
    title: "Proportion",
    body: "Volume only where it earns its place. A dropped shoulder that still finds the arm, and a trouser cut to break once on the boot — never twice.",
    shot: {
      src: H2("hero-01.jpg"),
      alt: "Oversized zip hood and cargo trouser, gold wall",
      op: "26% 44%",
      zoom: 1.5,
    },
    spec: [
      { key: "Shoulder", value: "Dropped 4cm" },
      { key: "Break", value: "Single, on the boot" },
    ],
  },
  {
    key: "cloth",
    index: "02",
    title: "Cloth",
    body: "520 GSM garment-washed fleece and 410 GSM canvas as the floor, not the ceiling. Nothing here is lined to look heavier than it is.",
    /* the house still life, read close — the one shot on the page with no
       figure in it, which is the point of a panel about cloth */
    shot: {
      src: "/images/product-still-life-v2.webp",
      alt: "Washed fleece and canvas, studio still",
      op: "43% 46%",
      zoom: 2.2,
    },
    spec: [
      { key: "Fleece", value: "520 GSM, washed" },
      { key: "Canvas", value: "410 GSM, dry" },
    ],
  },
  {
    key: "line",
    index: "03",
    title: "Line",
    body: "Every seam is drawn before it is sewn. The silhouette holds after the third wash or the piece does not leave the studio.",
    shot: {
      src: H2("highlight-03.jpg"),
      alt: "Full-length silhouette, concrete studio",
      op: "26% 46%",
      zoom: 1.45,
    },
    spec: [
      { key: "Tested to", value: "Three washes" },
      { key: "Finish", value: "Bar-tacked" },
    ],
  },
  {
    key: "edition",
    index: "04",
    title: "Edition",
    body: "Patterned, graded and finished in one run. When a size closes it closes — there is no second batch waiting behind it.",
    shot: {
      src: H2("highlight-02.jpg"),
      alt: "Ivory shell and cargo trouser, underpass",
      op: "28% 46%",
      zoom: 1.5,
    },
    spec: [
      { key: "Runs", value: "Numbered" },
      { key: "Reorders", value: "None" },
    ],
  },
];

export const LINE_COPY = {
  eyebrow: "How it is made",
  heading: [{ text: "Four decisions, " }, { text: "in order", light: true }] as Segment[],
  hint: "Scroll",
} as const;

/* -------------------------------------------------------------------------- */
/* 03 — the edit                                                              */
/* -------------------------------------------------------------------------- */

/**
 * How many tiles one page of the grid holds.
 *
 * Nine, not the men's eight: this grid is three tracks wide rather than four,
 * so nine fills three complete rows and eight leaves a hole in the last one.
 */
export const PAGE_SIZE = 9;

export const EDIT_COPY = {
  eyebrow: "The women's edit",
  /** `{count}` is the live release, spelled out where it sets as a word */
  heading: [
    { text: "{count} pieces cut for " },
    { text: "volume\nand ", light: true },
    { text: "line" },
  ] as Segment[],
  right: "All collections",
  emptyTitle: "Nothing in this filter.",
  emptyBody: "Clear the filters to see the rest of the women's release.",
  notes: [
    {
      key: "01",
      title: "Sized XS — XL",
      body: "Graded on a real curve, with the fit noted on every product page.",
    },
    /* Title left empty on purpose: it advertises the store's own free-delivery
       threshold, which is a setting rather than copy. `shippingNote` writes it. */
    {
      key: "02",
      title: "",
      body: "Dispatched from the Bengaluru studio within two working days.",
    },
    {
      key: "03",
      title: "30-day returns",
      body: "Unworn, tags on. Exchanges are free once per order.",
    },
  ],
} as const;

/* -------------------------------------------------------------------------- */
/* 04 — closing                                                               */
/* -------------------------------------------------------------------------- */

export const CLOSING = {
  quote: {
    lines: ["We cut once.", "The run is the edition.", "Nothing is made twice."],
    credit: "Iced_out studio / Bengaluru",
  },
  faqEyebrow: "Fit & care",
  faq: [
    {
      q: "How does the women's fit run?",
      a: "True to size with intended volume. The hoods and shells are cut oversized on purpose — size down one for a close fit through the shoulder, and check the measurements on each product page before you do.",
    },
    {
      q: "What happens when a size sells out?",
      a: "It stays sold out. Every piece is patterned, graded and finished in a single run, so there is no second batch behind the first and nothing is restocked.",
    },
    {
      q: "How should the fleece be washed?",
      a: "Cold, inside out, with like colours, and dried flat. The 520 GSM fleece is garment-washed before it ships, so it will not shrink further — but heat will flatten the hand.",
    },
    {
      q: "Can I exchange for another size?",
      a: "Once per order, free, within 30 days, provided the piece is unworn with the tags on. Exchanges are held against live stock, so the earlier you ask the more likely the size is still open.",
    },
  ],
  band: {
    ghost: "WOMEN",
    heading: [{ text: "The first run is " }, { text: "open", light: true }] as Segment[],
    body: "Every piece cut and finished in the Bengaluru studio, in numbered runs. When a size closes, it closes.",
    ctas: [
      { label: "Shop the edit", href: "#nw-edit" },
      { label: "View the new drop", href: "/new-drop" },
    ],
    shot: {
      src: H2("hero-04.jpg"),
      alt: "Campaign portrait against a lit panel",
      op: "72% 38%",
      zoom: 1.06,
    } as Shot,
  },
} as const;
