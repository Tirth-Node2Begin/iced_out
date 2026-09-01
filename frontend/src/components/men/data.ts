/**
 * Content deck for /men.
 *
 * The hero is the house stage — one dark full-bleed screen, one cut-out garment
 * centred on it, the wordmark split around it, furniture pinned to the corners
 * — which is what the root and /new-woman both do.
 *
 * It holds no catalogue. The grid below the hero is the published catalogue,
 * read through `useGenderPieces` exactly as every other listing reads its own.
 */

/**
 * A garment on the stage, and what the rig says about it.
 *
 * The run cycles. The measured width and the two callouts travel WITH each
 * piece rather than sitting on the stage: a rig that kept saying "Chest — 62 cm"
 * while three different garments passed under it would be furniture pretending
 * to be an instrument.
 *
 * `x` and `y` on a callout are percentages of the garment's own box, and `side`
 * is the direction its leader line runs out in. Every `y` is below 47%, which
 * is where the wordmark crosses the piece — a callout set on the shoulder
 * itself put its label on the type.
 */
export type HeroGarment = {
  id: string;
  src: string;
  alt: string;
  dimension: string;
  callouts: {
    id: string;
    side: "left" | "right";
    x: number;
    y: number;
    key: string;
    value: string;
  }[];
};

const GHOST = "/images/generated/ghost-products";

export const HERO_GARMENTS: HeroGarment[] = [
  {
    id: "varsity",
    src: `${GHOST}/ghost-varsity.png`,
    alt: "Navy and cream varsity jacket, ghost mannequin cutout",
    dimension: "Chest — 62 cm",
    callouts: [
      { id: "shoulder", side: "right", x: 72, y: 52, key: "Shoulder", value: "Dropped 4cm" },
      { id: "cloth", side: "left", x: 28, y: 66, key: "Cloth", value: "520 GSM shell" },
    ],
  },
  {
    id: "hoodie",
    src: `${GHOST}/ghost-hoodie.png`,
    alt: "Black hooded sweatshirt, ghost mannequin cutout",
    dimension: "Chest — 64 cm",
    callouts: [
      { id: "hood", side: "right", x: 73, y: 50, key: "Hood", value: "Double lined" },
      { id: "fleece", side: "left", x: 27, y: 68, key: "Fleece", value: "520 GSM, washed" },
    ],
  },
  {
    id: "knit",
    src: `${GHOST}/ghost-knit.png`,
    alt: "Cream ribbed knit polo, ghost mannequin cutout",
    dimension: "Chest — 58 cm",
    callouts: [
      { id: "collar", side: "right", x: 71, y: 51, key: "Collar", value: "Open placket" },
      { id: "rib", side: "left", x: 29, y: 67, key: "Rib", value: "2x1, dry hand" },
    ],
  },
];

/**
 * The turntable.
 *
 * The root hero holds a garment for three seconds and flies the next one in
 * from the corner. This one holds longer and swaps in place, because the rig
 * has to be read: the callouts and the measured width redraw with every piece,
 * and five seconds is roughly how long that takes to take in.
 *
 * The LIGHT does the switching. The glow behind the garment flares as the
 * outgoing piece leaves and settles as the new one lands, so the swap reads as
 * something the stage is doing rather than two pictures trading places.
 */
export const TURNTABLE = {
  /** how long a garment holds, in ms */
  holdMs: 5600,
  /** how long the swap itself takes, in seconds */
  swapSeconds: 0.72,
} as const;

export const HERO = {
  /**
   * The accessible heading.
   *
   * The two words on screen are the department name used as a wordmark — they
   * are composition, not a sentence — so the page states what it is here and
   * the split pair is marked decorative, exactly as every other hero does
   * behind its own oversized type.
   */
  title: "Menswear",
  kicker: "The men's edit",
  /** the two halves the garment stands between */
  split: ["Mens", "Wear"] as [string, string],
  lede: "Heavyweight shells, dry canvas, and a shoulder cut that never fights the sleeve.",
  ctas: [
    { label: "Shop the edit", href: "#edit" },
    { label: "View collections", href: "/collections" },
  ],
  /**
   * The ledger, bottom-left. Both figures are read from the catalogue at
   * render; neither is typed in.
   */
  ledger: [
    { key: "pieces", source: "pieces", label: "Pieces live" },
    { key: "collections", source: "collections", label: "Collections" },
  ] as { key: string; source: "pieces" | "collections"; label: string }[],
  /** the spec label, bottom-right, in the register every other hero pins */
  spec: ["Fit:", "Regular"],
} as const;
