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
 * 320-unit AW25 run is the figure /collections and the hero already commit to.
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
    body: "Nothing here is light. Drop 001 is anchored on 520 GSM brushed fleece and the Nightshift Overcoat is pressed wool at 740. That weight is the entire argument — it is what makes a piece hang correctly the first night out and still hang correctly two winters later, long after a lighter version of the same garment has gone soft at the shoulders",
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

  /* The capture used this run for studio amenities. On a storefront the three
     pinned cards are worth more as the three things a visitor can actually
     buy into, so they are the collections — and the section's two-word card
     titles happen to fit their names exactly. */
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
  testimonials: {
    heading: ["Worn hard,", "reported back"],
    items: [
      {
        index: "01",
        quote:
          "I bought it for the weight and stayed for the way it wears in. A year on the fleece has softened exactly where it should and nowhere it shouldn't.",
        name: "Aditi Rao",
        role: "Drop 001 · Afterdark Hoodie",
        src: "/images/home-v2/person-01.jpg",
      },
      {
        index: "02",
        quote:
          "740 GSM reads like a spec until you put it on in January. It stands up on its own, it does not move in the wind, and it has not pilled once.",
        name: "Ishaan Kapoor",
        role: "After Hours · Nightshift Overcoat",
        src: "/images/home-v2/person-04.jpg",
      },
      {
        index: "03",
        quote:
          "It is a plain tee, which is the whole point. Three in rotation for a year and not one of them has gone out of shape at the neck.",
        name: "Priya Nandakumar",
        role: "Core Uniform · Core Heavy Tee",
        src: "/images/home-v2/person-03.jpg",
      },
    ],
  },
};
