export { heroSlidesStore } from "./api/hero-store";
export { useHeroSlides } from "./hooks/use-hero-slides";
export type { HeroSlide } from "./types/hero-slide";

/**
 * The READ side of the home page hero — the only side the storefront has.
 *
 * `HeroWorkspace`, `useHeroBoard` and the `HeroBoard`/`HeroCard`/`CutoutState`
 * types that went with them are the board an operator composes the hero on, and
 * they moved to the CRM with the rest of the console. What is left here is what
 * the shop needs: the slides, already published.
 */
