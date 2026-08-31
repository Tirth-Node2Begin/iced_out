"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const clientSnapshot = () => window.matchMedia(QUERY).matches;

/**
 * The server cannot know the preference, and neither can the first client
 * render: it has to draw exactly what the server drew or hydration fails. So
 * both answer "no", and the real answer arrives on the pass after.
 */
const serverSnapshot = () => false;

/**
 * A multiplier for every scroll-linked distance on this page: 1 normally, 0 for
 * a visitor who has asked for reduced motion.
 *
 * WHY IT IS NOT JUST `useReducedMotion()`.
 * A parallax has no transition to collapse — the movement IS the style — so the
 * obvious gate is `style={reduce ? undefined : { y }}`. That does not survive
 * hydration. `useReducedMotion` reports false on the server, so the server
 * renders the element WITH the motion value (`transform: none`) and a client
 * that prefers reduced motion renders it without one (no `transform` at all).
 * React sees two different style attributes and throws the mismatch — the same
 * trap `product-grid.tsx` documents for `initial`.
 *
 * Scaling the distance instead keeps the motion value on the element in both
 * renders, and the value it holds at rest is identical either way. Reading the
 * query through `useSyncExternalStore` is what makes the two agree: React draws
 * the server snapshot during hydration and only then re-reads the real one — so
 * the preference can never change what the first client render puts in the DOM.
 * Subscribing rather than sampling once also means a visitor who turns the
 * preference on mid-session gets it applied without a reload.
 */
export function useMotionScale(): 0 | 1 {
  const reduce = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return reduce ? 0 : 1;
}
