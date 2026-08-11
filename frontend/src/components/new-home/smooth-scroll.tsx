"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Lenis drives the whole page. The pinned showcase depends on a smoothed
 * scroll position — with native scrolling the card swaps read as hard cuts
 * instead of the slow dissolve in the source.
 *
 * Disabled outright when the visitor asks for reduced motion.
 *
 * Loaded from inside the effect, not at module scope — see the note on the
 * home-v2 copy of this component for why. In short: this sits in a route-group
 * layout, and a static import made Lenis part of what every page in the group
 * had to parse before it could hydrate.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;

      const lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
        touchMultiplier: 1.6,
        wheelMultiplier: 1,
      });

      let frame = 0;
      const raf = (time: number) => {
        lenis.raf(time);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);

      cleanup = () => {
        cancelAnimationFrame(frame);
        lenis.destroy();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <>{children}</>;
}
