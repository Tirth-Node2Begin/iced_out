import type { SiteCopy } from "@/components/home-v2/copy";

/**
 * /about runs the site root's composition, so it needs the site root's shapes
 * filled with its own words.
 *
 * The root's pack is still the reference capture's transcription — an interior
 * design studio talking about spatial harmony and private residence clients.
 * That was never rewritten for this brand. This one is Iced_out speaking as
 * itself, and it keeps the facts the old About chapters had already committed
 * to: 520 GSM, Drop 001 at 320 units, the Bengaluru studio, after dark.
 *
 * Imagery is the root's set unchanged — those crops are carved out of this
 * brand's own photography, and they are cut to the aspect ratios these
 * sections frame.
 */
export const ABOUT_COPY: SiteCopy = {
  /* The rails are the years either side of the sentence. Kept from the root:
     they are the studio's run, not a page's copy. */
  manifesto: {
    from: "2016",
    to: "2025",
    statement:
      "We build heavyweight uniforms for life after dark — made slowly, in small numbers, to be worn hard and kept far longer",
  },

  philosophy: {
    eyebrow: "The standard",
    /* The question alone. It was the first clause of a three-sentence field,
       which buried the one line here worth reading twice. */
    heading: "Will this still earn its place after the moment has\u00A0passed?",
    body: "Every release starts with that question, and if the answer is uncertain it does not make the cut. That standard buys us room to slow down, refine the construction, and keep the runs small enough to stay accountable for every one of\u00A0them.",
    main: {
      src: "/images/home-v2/philosophy-main.jpg",
      alt: "Two figures in a concrete underpass after dark",
    },
    inset: {
      src: "/images/home-v2/philosophy-inset.jpg",
      alt: "Folded heavyweight garments in raking light",
    },
  },

  /* The same four portraits the root uses, with the roles and the work
     rewritten to the people who actually make a garment. */
  founders: [
    {
      index: "01",
      first: "Elena",
      last: "Carter",
      role: "Founder & Creative Director",
      bio: "Sets the direction for every drop and holds the line on what gets cut — the last word on whether a piece has earned its place.",
      src: "/images/home-v2/person-01.jpg",
    },
    {
      index: "02",
      first: "Marcus",
      last: "Lindberg",
      role: "Head of Product",
      bio: "Runs the material programme: density, recovery, drape, and abrasion, tested on the cloth long before a silhouette exists.",
      src: "/images/home-v2/person-02.jpg",
    },
    {
      index: "03",
      first: "Sofia",
      last: "Bennett",
      role: "Lead Patternmaker",
      bio: "Tunes proportion in motion — reach, stride, sit, layer, repeat — so a fit holds its shape through a night rather than a fitting.",
      src: "/images/home-v2/person-03.jpg",
    },
    {
      index: "04",
      first: "Daniel",
      last: "Foster",
      role: "Studio & Production",
      bio: "Oversees the Bengaluru floor and the numbered runs, keeping every unit traceable from the third prototype pass to the box.",
      src: "/images/home-v2/person-04.jpg",
    },
  ],

  highlights: {
    eyebrow: "Inside the studio",
    heading: ["Where the work", "actually happens"],
    cards: [
      {
        index: "01",
        first: "Material",
        last: "Library",
        body: "Shelves of cloth logged by weight and behaviour, from 320 GSM jersey to the 520 GSM loopback the hoods are cut from. Nothing enters a pattern until it has been worn, washed, and worn again.",
        src: "/images/home-v2/highlight-01.jpg",
      },
      {
        index: "02",
        first: "Cutting",
        last: "Floor",
        body: "Three construction passes per piece, each one removing friction, excess, or a decorative decision that did not work. What survives all three is what gets graded.",
        src: "/images/home-v2/highlight-02.jpg",
      },
      {
        index: "03",
        first: "Drop",
        last: "Archive",
        body: "A living record of the practice — early toiles, rejected samples, field-test notes, and every numbered run since the first. Drop 001 closed at 320 units and stays closed.",
        src: "/images/home-v2/highlight-03.jpg",
      },
    ],
  },

  /* Heading only — the quotes under it are real reviews, fetched. */
  testimonials: {
    heading: ["What the", "wearers say"],
  },
};
