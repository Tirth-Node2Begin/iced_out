import type { SiteCopy } from "@/components/home-v2/copy";

/**
 * The site root's words.
 *
 * The pack `copy.tsx` defaults to is still the reference capture's
 * transcription — an interior design studio talking about spatial harmony,
 * private residence clients and a material library. /home-v2 is the route that
 * exists to serve that capture, so the default stays where it is and the root
 * brings its own, exactly the way /about does.
 *
 * This one is the STOREFRONT's voice, not the studio's. /about already speaks
 * as the practice — how a piece is made, who makes it, what gets cut. The root
 * is the front door, so it says what is on sale: the three chapters, the cloth
 * they are cut from, and what the weight actually buys the wearer.
 *
 * Every number here is the catalogue's, not invented: the GSMs and the
 * collection assignments come from `backend/seeds/data/catalogue.php`, and the
 * 320-unit AW25 run is the figure the hero already commits to.
 *
 * Imagery is the root's existing set — those crops are carved out of this
 * brand's own photography and cut to the ratios these sections frame.
 */
export const ROOT_COPY: SiteCopy = {
  /* NOT DRAWN on the root — the panel was cut and its claim is now the hero
     headline ("Three chapters, one wardrobe"). Kept because the shape is
     shared with /about, and because this is the long form of that headline:
     if the hero ever needs its sentence back, it is this one. */
  manifesto: {
    from: "2016",
    to: "2025",
    statement:
      "Three chapters, built as one wardrobe — heavyweight cloth cut for the city after dark, in runs small enough that we can still answer for every piece",
  },

  philosophy: {
    eyebrow: "The weight",
    /**
     * The claim on its own, because it IS the claim — everything under it is
     * evidence for this one line.
     *
     * It used to be the opening sentence of a single 62-word field, and that
     * field rendered every word of itself at the same 45px/500. The section
     * had no entry point and no hierarchy: a wall of bold with the argument
     * buried in the middle of it.
     */
    heading: "Nothing here is light.",
    /* The `\u00A0` before the last word is a non-breaking space, and it is
       load-bearing: it ties "the shoulders." to one line so the paragraph can
       never end on a lone word. */
    body: "Drop 001 is anchored on 520 GSM brushed fleece and the Nightshift Overcoat is pressed wool at 740. That weight is the entire argument — it is what makes a piece hang correctly the first night out and still hang correctly two winters later, long after a lighter version of the same garment has gone soft at the\u00A0shoulders.",
    main: {
      src: "/images/home-v2/philosophy-main.jpg",
      alt: "Two figures in a concrete underpass after dark",
    },
    inset: {
      src: "/images/home-v2/philosophy-inset.jpg",
      alt: "Folded heavyweight garments in raking light",
    },
  },

  /* Not drawn on the root — the page runs the craft chapter in this slot
     instead. Kept filled because the shape is shared with /about and an empty
     roster would break the pinned stage the moment somebody mounted it. */
  founders: [
    {
      index: "01",
      first: "Elena",
      last: "Carter",
      role: "Founder & Creative Director",
      bio: "Sets the direction for every drop and holds the line on what gets cut.",
      src: "/images/home-v2/person-01.jpg",
    },
    {
      index: "02",
      first: "Marcus",
      last: "Lindberg",
      role: "Head of Product",
      bio: "Runs the material programme — density, recovery, drape and abrasion.",
      src: "/images/home-v2/person-02.jpg",
    },
    {
      index: "03",
      first: "Sofia",
      last: "Bennett",
      role: "Lead Patternmaker",
      bio: "Tunes proportion in motion so a fit holds its shape through a night.",
      src: "/images/home-v2/person-03.jpg",
    },
    {
      index: "04",
      first: "Daniel",
      last: "Foster",
      role: "Studio & Production",
      bio: "Oversees the Bengaluru floor and keeps every numbered run traceable.",
      src: "/images/home-v2/person-04.jpg",
    },
  ],

  /* NOT DRAWN on the root any more — <Seasonal> holds that slot and fills the
     same three cards from `GET /catalog/products`, so the pinned row shows
     pieces a visitor can open rather than chapters they cannot.

     This pack was the reason the row had to change: the names, the paragraphs
     and the photographs were all authored here, which meant the front door's
     one product-shaped section was the only part of the storefront that could
     not answer the catalogue. Kept because /home-v2 and /about still mount
     <Highlights> and the shape is shared with them. */
  highlights: {
    eyebrow: "The collections",
    heading: ["Three chapters,", "one wardrobe"],
    cards: [
      {
        index: "01",
        first: "Drop",
        last: "001",
        body: "The current chapter and the one that set the weight — 520 GSM brushed fleece, waxed and structured canvas outerwear, and the utility cut that runs underneath both. 320 numbered units for AW25, live now, closed when they are gone.",
        src: "/images/home-v2/highlight-01.jpg",
      },
      {
        index: "02",
        first: "After",
        last: "Hours",
        body: "Charcoal, ink and washed black, for the hours the chapter takes its name from. Pressed wool at 740 GSM, a three-layer shell on a PFC-free membrane, rigid indigo, and the brushed steel that finishes them.",
        src: "/images/home-v2/highlight-02.jpg",
      },
      {
        index: "03",
        first: "Core",
        last: "Uniform",
        body: "The permanent line, and the only one never retired. Compact jersey, stone-washed fleece and washed twill — the plain pieces every chapter above is designed to sit on top of.",
        src: "/images/home-v2/highlight-03.jpg",
      },
    ],
  },

  /* Wearers rather than clients, and each one pinned to a piece that is
     actually in the catalogue — a quote about a garment the visitor cannot
     find is worse than no quote. */
  /* Heading only — the quotes under it are real reviews, fetched. */
  testimonials: {
    heading: ["Worn hard,", "reported back"],
  },
};
