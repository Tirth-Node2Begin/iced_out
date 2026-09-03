/**
 * Content deck for /men.
 *
 * The hero is a RAIL: three cut-out garments standing on one lineup, the centre
 * piece large and lit, the two either side smaller, dimmer and further back. It
 * advances on its own and a shopper can drive it — arrows, or pressing a piece
 * to bring it forward.
 *
 * That is the one thing it does that no other hero here does. The root flies a
 * single garment through an empty stage and /new-woman stands one on a plinth;
 * both decorate one product. A department page is a doorway into a catalogue,
 * so this one merchandises three.
 *
 * It holds no catalogue of its own. The grid below the hero is the published
 * catalogue, read through `useGenderPieces` exactly as every other listing
 * reads its own.
 */

/**
 * A garment on the rail.
 *
 * `chest` travels WITH the piece rather than sitting on the stage: a readout
 * that kept saying one figure while three garments passed under it would be
 * furniture pretending to be a measurement.
 */
export type HeroGarment = {
  id: string;
  name: string;
  src: string;
  alt: string;
  chest: string;
};

const GHOST = "/images/generated/ghost-products";

export const HERO_GARMENTS: HeroGarment[] = [
  {
    id: "varsity",
    name: "Varsity jacket",
    src: `${GHOST}/ghost-varsity.png`,
    alt: "Navy and cream varsity jacket, ghost mannequin cutout",
    chest: "Chest 62 cm",
  },
  {
    id: "hoodie",
    name: "Heavyweight hood",
    src: `${GHOST}/ghost-hoodie.png`,
    alt: "Black hooded sweatshirt, ghost mannequin cutout",
    chest: "Chest 64 cm",
  },
  {
    id: "knit",
    name: "Ribbed knit polo",
    src: `${GHOST}/ghost-knit.png`,
    alt: "Cream ribbed knit polo, ghost mannequin cutout",
    chest: "Chest 58 cm",
  },
];

export const RAIL = {
  /**
   * How long a piece holds in the centre before the rail moves on, in ms.
   *
   * It stops the moment a shopper touches the arrows or presses a piece. A
   * carousel that keeps advancing under someone who has taken hold of it is
   * the single most irritating thing a hero can do.
   */
  holdMs: 5200,
  /** how long one slide takes, in seconds */
  slideSeconds: 0.78,
  /**
   * How far a flanking piece sits from the centre, as a percentage of its own
   * width — so the spacing scales with the garment instead of being a pixel
   * figure that only holds at one viewport.
   */
  offset: 82,
  /** how much smaller a flanking piece is, and how far it fades back */
  flankScale: 0.6,
  flankOpacity: 0.3,
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
  /** the two halves the rail stands between */
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
