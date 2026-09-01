/**
 * Content transcribed from the reference video (video-frames/).
 * Imagery is limited to what already ships in /public/images, so the five
 * available shots are cycled the way the source cycles its own set.
 */

export const SHOTS = {
  hero: "/images/iced-out-hero.webp",
  campaign: "/images/campaign-after-hours-v2.webp",
  still: "/images/product-still-life-v2.webp",
  drop: "/images/drop-001-products.webp",
  og: "/images/iced-out-og.jpg",
} as const;

/**
 * The hero subject is a background-removed PNG, as in the reference, where the
 * light rays pass visibly behind the model. Anything with a baked-in
 * background reads as a pasted rectangle against the gradient.
 */
export const HERO_MODEL = "/images/hero-model.png";

/** The three faces stacked above the hero paragraph. */
export const HERO_FACES = [
  "/images/avatar-1.jpg",
  "/images/avatar-2.jpg",
  "/images/avatar-3.jpg",
];

/**
 * Spec labels pinned to the corners of the hero subject — the same register
 * the pinned showcase card uses for its product meta.
 */
export type HeroMetaLabel = {
  id: string;
  corner: "tl" | "tr" | "bl" | "br";
  lines: string[];
  /** the bottom-right label carries a bullet, as on the showcase card */
  dot?: boolean;
};

export const HERO_META: HeroMetaLabel[] = [
  { id: "bl", corner: "bl", lines: ["01 / Drop", "_2025"] },
  { id: "br", corner: "br", lines: ["Shocks:", "Shoe"], dot: true },
];

/**
 * Per-department copy for /new-man and /new-woman.
 *
 * Those two surfaces render the same components as the home page, so
 * everything that has to read as menswear or womenswear — the hero headline,
 * the spec labels, the giant editorial word, the two editorial notes — is
 * collected here rather than being spread across the components. Omit the
 * prop and each component falls back to its neutral home-page copy.
 */
export type DepartmentContent = {
  /** the hero headline, in SplitHeading segments — `light` is the wide cut */
  headline: { text: string; light?: boolean }[];
  /** the paragraph under the faces, bottom-left of the hero */
  intro: string;
  /** spec labels pinned to the hero subject */
  meta: HeroMetaLabel[];
  /**
   * The two hero pills. The home page scrolls to its own sections; these
   * surfaces no longer carry those sections, so they leave for the catalogue
   * instead — an in-page anchor here would land on nothing.
   */
  ctas: { label: string; href: string }[];
  /** the oversized word the editorial frames slide across */
  word: string;
  /** the editorial's two notes — top-right, then bottom-left */
  notes: [string, string];
};

export const DEPARTMENTS: Record<"men" | "women", DepartmentContent> = {
  men: {
    headline: [
      { text: "Menswear built to move\n" },
      { text: "Every " },
      { text: "Season!", light: true },
    ],
    intro:
      "Cut for how men actually train. Shells that break the wind, mid-layers that still breathe under them, and joggers with room to drive through the last set.",
    meta: [
      { id: "bl", corner: "bl", lines: ["01 / Men", "_2025"] },
      { id: "br", corner: "br", lines: ["Fit:", "Regular"], dot: true },
    ],
    ctas: [
      { label: "Shop menswear", href: "/new-man" },
      { label: "View new drop", href: "/new-drop" },
    ],
    word: "Men's wear",
    notes: [
      "Men's outerwear for the cold months — taped seams, brushed linings, and a shoulder cut that never fights the sleeve.",
      "Performance-driven menswear: tees, joggers, thermals, and shells, sized S through XXL.",
    ],
  },
  women: {
    headline: [
      { text: "Womenswear built to move\n" },
      { text: "Every " },
      { text: "Season!", light: true },
    ],
    intro:
      "Cut for how women actually train. High-rise tights that stay put, seamless base layers, and shells that layer clean without the bulk.",
    meta: [
      { id: "bl", corner: "bl", lines: ["01 / Women", "_2025"] },
      { id: "br", corner: "br", lines: ["Fit:", "Sculpt"], dot: true },
    ],
    ctas: [
      { label: "Shop womenswear", href: "/new-woman" },
      { label: "View new drop", href: "/new-drop" },
    ],
    word: "Women's wear",
    notes: [
      "Women's layers for the cold months — brushed thermals, cropped shells, and tights that hold their shape session after session.",
      "Performance-driven womenswear: bras, tights, crops, and shells, sized XS through XL.",
    ],
  },
};

const POOL = [SHOTS.campaign, SHOTS.still, SHOTS.drop, SHOTS.hero, SHOTS.og];

export const pick = (i: number) => POOL[i % POOL.length];

/**
 * The storefront's live destination list, in bar order. This is the single
 * source the header uses on every surface — the new home, About, and the
 * storefront shell all read from here so the bar carries the same links
 * wherever it renders.
 *
 * Home stays out of the rail — the wordmark carries it. Collections and Sale
 * used to be reached from the mega menus instead of the rail; both routes have
 * since been removed, so neither appears in either place.
 */
export type NavLink = { label: string; href: string };

export const NAV_LINKS: NavLink[] = [
  { label: "Men", href: "/new-man" },
  { label: "Women", href: "/new-woman" },
  { label: "New drop", href: "/new-drop" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/**
 * Hover content for the two rail items with real substructure. Keyed by
 * href so a NavItem can look itself up — links with no entry here (New drop,
 * About, Contact) just navigate, no panel.
 */
export type MegaMenuColumn = {
  heading: string;
  links: { label: string; href: string; tag?: string }[];
};

export type MegaMenuConfig = {
  columns: MegaMenuColumn[];
  feature: { label: string; tag: string; href: string; image: string };
};

export const MEGA_MENU: Record<string, MegaMenuConfig> = {
  "/new-man": {
    columns: [
      {
        heading: "Shop",
        links: [
          { label: "All men", href: "/new-man" },
          { label: "New drop", href: "/new-drop" },
          { label: "The grid", href: "/new-man#edit" },
        ],
      },
    ],
    feature: {
      label: "Drop 001",
      tag: "Live now",
      href: "/new-drop",
      image: SHOTS.campaign,
    },
  },
  "/new-woman": {
    columns: [
      {
        heading: "Shop",
        links: [
          { label: "All women", href: "/new-woman" },
          { label: "New drop", href: "/new-drop" },
          { label: "The grid", href: "/new-woman#nw-edit" },
        ],
      },
    ],
    feature: {
      label: "Drop 001",
      tag: "Live now",
      href: "/new-drop",
      image: SHOTS.still,
    },
  },
};

export const TOP_PICKS = [
  {
    id: "winter",
    meta: "01/Winter\n_2025",
    title: "Top workout gear for peak performance!",
    image: SHOTS.campaign,
  },
  {
    id: "summer",
    meta: "02/Summer\n_2025",
    title: "Latest styles and innovations in workout gear.",
    image: SHOTS.still,
  },
] as const;

export type ShowcaseSlide = {
  id: string;
  /** only the first slide carries the section's title card */
  intro?: boolean;
  kicker?: string;
  left: string;
  right: string;
  season: string;
  extra: string;
  image: string;
};

/** Slides for the pinned showcase — one per scroll step. */
export const SHOWCASE: ShowcaseSlide[] = [
  {
    id: "s1",
    kicker: "Level up",
    intro: true,
    left: "Liner short & inner thermal",
    right: "12/08/2024\nDelivery",
    season: "Fall / Winter\n2024",
    extra: "Shocks:\nShoe",
    image: SHOTS.campaign,
  },
  {
    id: "s2",
    left: "Hoodie & inner\nshort thermal",
    right: "12/08/2024\nDelivery",
    season: "Fall / Winter\n2024",
    extra: "Shocks:\nShoe",
    image: SHOTS.still,
  },
  {
    id: "s3",
    left: "Shell jacket &\nthermal legging",
    right: "12/08/2024\nDelivery",
    season: "Fall / Winter\n2024",
    extra: "Shocks:\nShoe",
    image: SHOTS.drop,
  },
  {
    id: "s4",
    left: "Tech fleece &\ncargo jogger",
    right: "12/08/2024\nDelivery",
    season: "Fall / Winter\n2024",
    extra: "Shocks:\nShoe",
    image: SHOTS.hero,
  },
  {
    id: "s5",
    left: "Puffer vest &\nrun tight",
    right: "12/08/2024\nDelivery",
    season: "Fall / Winter\n2024",
    extra: "Shocks:\nShoe",
    image: SHOTS.og,
  },
];

export const PRODUCTS = Array.from({ length: 8 }, (_, i) => ({
  id: `p-${i + 1}`,
  name: "Iced_out Core Lycra",
  price: "USD 116.00",
  tag: "Winter",
  image: pick(i),
}));

export const FOOTER_COLUMNS = [
  { title: "Shop", links: ["Men", "Women", "Accessories", "Seasonal"] },
  { title: "Support", links: ["Shipping", "Returns", "Size guide", "Contact"] },
  { title: "Studio", links: ["About", "Journal", "Stockists", "Careers"] },
] as const;
