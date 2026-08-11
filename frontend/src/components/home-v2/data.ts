/**
 * Every string and image slot on /home-v2, transcribed from the reference
 * capture (video-frames-2/, 03365516…mp4 — 26.52s @ 60fps, 3200x2400).
 *
 * Imagery is sourced entirely from the repo's own photography: the crops in
 * /images/home-v2 are carved out of iced-out-hero, campaign-after-hours,
 * product-still-life and the drop-001 contact grid. Nothing was generated.
 */

/* The headline, one entry per word — the load stagger and the brand morph both
   sequence off the split, and the morph draws the same words the hero reserves
   space for, so the two cannot drift apart. */
export const HERO_TITLE = ["Iced", "Out"] as const;

/* ---------------------------------------------------------------------------
   Hero strip — six bottom-aligned panels. `flex` is the column's share of the
   row and `height` its share of the strip box; both are measured off the
   settled frame (t=1.20s), where the outer two panels run narrower because
   the strip overhangs the viewport on both sides.
   ------------------------------------------------------------------------ */
export const HERO_PANELS = [
  { src: "/images/home-v2/hero-01.jpg", alt: "Outerwear set, gold-lit concrete", flex: 0.78, height: 1 },
  { src: "/images/home-v2/hero-02.jpg", alt: "Layered flatlay on steel", flex: 1.04, height: 0.6 },
  { src: "/images/home-v2/hero-03.jpg", alt: "Wet-floor underpass campaign frame", flex: 1.02, height: 0.81 },
  { src: "/images/home-v2/hero-04.jpg", alt: "Campaign pair against a lit panel", flex: 1.02, height: 0.6 },
  { src: "/images/home-v2/hero-05.jpg", alt: "Cotton overshirt, studio still", flex: 1.04, height: 0.84 },
  { src: "/images/home-v2/hero-06.jpg", alt: "Concrete corridor, full-length", flex: 0.74, height: 0.59 },
] as const;

export const MANIFESTO = {
  from: "2016",
  to: "2025",
  statement:
    "We create timeless architectural and interior spaces focused on clarity, functionality, and modern living",
} as const;

export const PHILOSOPHY = {
  eyebrow: "Philosophy",
  body: "Every project is shaped through proportion, light, texture, and spatial balance. We believe great design should feel natural over time, creating environments that are both functional and emotionally connected to everyday life",
  main: { src: "/images/home-v2/philosophy-main.jpg", alt: "Two figures in a concrete underpass" },
  inset: { src: "/images/home-v2/philosophy-inset.jpg", alt: "Folded garments in raking light" },
} as const;

export const FOUNDERS = [
  {
    index: "01",
    first: "Elena",
    last: "Carter",
    role: "Founder & Creative Director",
    bio: "Leads the studio's creative vision with a focus on timeless interiors, spatial harmony, and material storytelling.",
    src: "/images/home-v2/person-01.jpg",
  },
  {
    index: "02",
    first: "Marcus",
    last: "Lindberg",
    role: "Lead Architect",
    bio: "Specializes in contemporary residential architecture shaped by simplicity, proportion, and natural light.",
    src: "/images/home-v2/person-02.jpg",
  },
  {
    index: "03",
    first: "Sofia",
    last: "Bennett",
    role: "Senior Interior Designer",
    bio: "Creates refined interior concepts balancing warmth, functionality, and modern aesthetics.",
    src: "/images/home-v2/person-03.jpg",
  },
  {
    index: "04",
    first: "Daniel",
    last: "Foster",
    role: "Project Lead",
    bio: "Oversees project coordination and execution, ensuring clarity and consistency throughout every stage.",
    src: "/images/home-v2/person-04.jpg",
  },
] as const;

export const HIGHLIGHTS = {
  eyebrow: "Studio Highlights",
  heading: ["Designed for creativity", "and collaboration"],
  cards: [
    {
      index: "01",
      first: "Material",
      last: "Library",
      body: "Our studio reflects the same principles we bring into every project — calm atmosphere, refined materials, natural light, and intentional design decisions that support both creativity and focus.",
      src: "/images/home-v2/highlight-01.jpg",
    },
    {
      index: "02",
      first: "Collaborative",
      last: "Workspace",
      body: "A space built for shared thinking — open conversations, exchanged references, honest feedback, and a flexible setting that turns individual ideas into a common direction.",
      src: "/images/home-v2/highlight-02.jpg",
    },
    {
      index: "03",
      first: "Design",
      last: "Archive",
      body: "A living record of our practice — early sketches, material samples, completed projects, and the quiet decisions in between that continue to shape everything we design.",
      src: "/images/home-v2/highlight-03.jpg",
    },
  ],
} as const;

export const AWARDS = {
  heading: "Recognized for modern, thoughtful design",
  columns: [
    {
      label: "Awards",
      rows: [
        { name: "Interior Design Excellence Award", value: 2024 },
        { name: "Contemporary Architecture", value: 2023 },
        { name: "Spatial Design", value: 2022 },
      ],
    },
    {
      label: "Featured in",
      rows: [
        { name: "ArchDaily", value: 1, pad: 2 },
        { name: "Design", value: 2, pad: 2 },
        { name: "Dezeen", value: 3, pad: 2 },
        { name: "Minimalissimo", value: 4, pad: 2 },
        { name: "Interior Design Magazine", value: 5, pad: 2 },
      ],
    },
  ],
} as const;

export const CLIENTS = {
  eyebrow: "Selected clients",
  body: "We collaborate with homeowners, hospitality brands, and property developers to create spaces that combine timeless aesthetics with long-term functionality.",
  image: { src: "/images/home-v2/clients.jpg", alt: "Campaign pair against a lit gold panel" },
  names: [
    "North Vale Developments",
    "Atelier Properties",
    "Monarca Hospitality",
    "Forma Living",
    "Studio Forma Lighting",
    "Nordic Surface Co.",
    "Altura Estates",
  ],
} as const;

export const TESTIMONIALS = {
  heading: ["What our", "clients say"],
  items: [
    {
      index: "01",
      quote:
        "The team created a home that feels calm, timeless, and deeply personal. Every detail was thoughtfully considered from start to finish.",
      name: "Emma Larson",
      role: "Private residence client",
      src: "/images/home-v2/person-01.jpg",
    },
    {
      index: "02",
      quote:
        "They understood the brief before we could articulate it. The result is a space that still feels considered three years on.",
      name: "Marco Devlin",
      role: "Hospitality group",
      src: "/images/home-v2/person-04.jpg",
    },
    {
      index: "03",
      quote:
        "Precise, unhurried, and completely transparent. The material choices alone changed how we use the building every day.",
      name: "Sara Whitfield",
      role: "Property developer",
      src: "/images/home-v2/person-03.jpg",
    },
  ],
} as const;

export const FOOTER = {
  links: [
    { label: "Projects", href: "#projects" },
    { label: "Services", href: "#services" },
    { label: "About", href: "#about" },
    { label: "Blog", href: "#blog" },
    { label: "Careers", href: "#careers" },
  ],
  contact: { label: "Contact", href: "#contact" },
  copyright: "© 2026 Iced_out",
  policy: { label: "Privacy Policy", href: "/pages/privacy" },
  wordmark: "Iced Out",
} as const;
