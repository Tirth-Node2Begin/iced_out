"use client";

import { createContext, useContext, type ReactNode } from "react";

import { FOUNDERS, HIGHLIGHTS, MANIFESTO, PHILOSOPHY, TESTIMONIALS } from "./data";

/**
 * The words the home-v2 sections are drawn with.
 *
 * The sections themselves are the site's, not one page's: /about runs the same
 * composition, and it has to say different things on it. Rather than fork six
 * components to change their strings, each one reads its copy from here and
 * the page decides which pack is in scope.
 *
 * The default is the reference capture's transcription, which is what
 * /home-v2 exists to serve. Both real pages bring their own: /about mounts
 * ABOUT_COPY, the site root mounts ROOT_COPY.
 */
export type Founder = {
  index: string;
  first: string;
  last: string;
  role: string;
  bio: string;
  src: string;
};

export type HighlightCard = {
  index: string;
  first: string;
  last: string;
  body: string;
  src: string;
};

export type Testimonial = {
  index: string;
  quote: string;
  name: string;
  role: string;
  src: string;
};

/**
 * The hero is deliberately absent. Its words are the wordmark itself, and
 * <BrandMorph> — which flies them from the headline into the bar — sits above
 * any page-level provider and reads them straight from `data`. Two sources for
 * one pair of words is a drift waiting to happen, so the hero keeps the one it
 * shares with the morph.
 */
export type SiteCopy = {
  manifesto: { from: string; to: string; statement: string };
  philosophy: {
    eyebrow: string;
    body: string;
    main: { src: string; alt: string };
    inset: { src: string; alt: string };
  };
  /** any length — the pinned stage sizes its runway off the count */
  founders: readonly Founder[];
  highlights: {
    eyebrow: string;
    heading: readonly string[];
    /* Exactly three. The pinned run splits its scroll into three equal dwells
       and the section's height is a fixed 300svh, so a fourth card would have
       no room to be read and a second would leave a dwell on nothing. The
       tuple is what makes that a compile error rather than a scroll bug. */
    cards: readonly [HighlightCard, HighlightCard, HighlightCard];
  };
  testimonials: { heading: readonly string[]; items: readonly Testimonial[] };
};

/** The capture's pack, assembled from the transcribed reference data. */
export const HOME_COPY: SiteCopy = {
  manifesto: MANIFESTO,
  philosophy: PHILOSOPHY,
  founders: FOUNDERS,
  highlights: HIGHLIGHTS,
  testimonials: TESTIMONIALS,
};

const CopyContext = createContext<SiteCopy>(HOME_COPY);

export function CopyProvider({
  copy,
  children,
}: {
  copy: SiteCopy;
  children: ReactNode;
}) {
  return <CopyContext.Provider value={copy}>{children}</CopyContext.Provider>;
}

export function useCopy() {
  return useContext(CopyContext);
}
