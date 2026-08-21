"use client";

import { useSyncExternalStore } from "react";

import { heroSlidesStore } from "@/features/19b-home-hero/api/hero-store";
import type { HeroSlide } from "@/features/19b-home-hero/types/hero-slide";

/**
 * The hero's garments, with a floor under them.
 *
 * The hero is the first thing anybody sees of this shop, and it animates: a run
 * of zero would not degrade, it would leave the middle of the screen empty
 * while the rays and the headline played around nothing. So the caller passes
 * the built-in run it already ships with, and that is what shows until the
 * database has something better to say.
 *
 * `usingFallback` is returned rather than left to be inferred, because the two
 * cases genuinely render differently: bundled art is a `next/image` with a
 * build-time path, and a slide from the API is a runtime URL the static
 * export's optimiser has never seen.
 *
 * There is deliberately no loading state. The fallback is not a spinner — it is
 * a correct hero — so there is nothing to wait for and nothing to flash.
 */
export function useHeroSlides<T>(fallback: readonly T[]): {
  slides: readonly (HeroSlide | T)[];
  usingFallback: boolean;
} {
  const state = useSyncExternalStore(
    heroSlidesStore.subscribe,
    heroSlidesStore.getSnapshot,
    heroSlidesStore.getServerSnapshot,
  );

  /* `loaded` is what separates "the store has chosen no garments" from "the
     answer has not arrived yet". Only the first of those should ever replace
     the built-in run — and it does not either, because a hero with nothing in
     it is not a hero. */
  const live = state.loaded && state.data.length > 0;

  return {
    slides: live ? state.data : fallback,
    usingFallback: !live,
  };
}
