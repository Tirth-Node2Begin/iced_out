"use client";

import { publicClient } from "@/api/clients";
import type { HeroSlide } from "@/features/19b-home-hero/types/hero-slide";
import { createRemoteStore } from "@/lib/remote-store";

/**
 * The garments the home page hero flies across the screen — read from the
 * database rather than compiled into the bundle.
 *
 * `GET /home/hero` serves only slides that are switched on AND whose background
 * has actually come off, so a slide being worked on in the console is invisible
 * here for the whole time it is being worked on. An empty answer is a normal
 * answer — a store that has not chosen its hero yet — and the hero falls back
 * to its built-in run rather than rendering a hole. See `useHeroSlides`.
 *
 * One store rather than a fetch per mount, for the same reason the catalogue
 * has one: `/` and `/home-v2` draw the same hero, and two of them mounting
 * should be one request.
 */
export const heroSlidesStore = createRemoteStore<HeroSlide>(async () => {
  const response = await publicClient.get<{ data: HeroSlide[] }>("/home/hero");
  return response.data.data;
});
