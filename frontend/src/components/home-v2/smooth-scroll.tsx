"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Lenis drives the whole page.
 *
 * Three sections here are scroll-scrubbed rather than triggered — the word-by-
 * word ink reveals, the highlights row that reshuffles around its copy panel,
 * and the hero parallax. With native wheel stepping those read as jumps; the
 * smoothed position is what makes them continuous, as in the capture.
 *
 * Disabled outright when the visitor asks for reduced motion.
 *
 * The library is loaded from inside the effect rather than imported at module
 * scope. This component sits in a route-group layout, so a static import put
 * Lenis in the layout's chunk — downloaded, parsed and evaluated before the
 * page could hydrate, on a surface where it contributes nothing until the
 * visitor actually scrolls. Deferring it hands that time back to hydration,
 * and the dynamic import is only a real fetch once: every later mount resolves
 * from the module cache in the same tick.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* Unmounting before the import settles is normal — a shopper can leave the
       route inside the same frame they arrived on it. `cancelled` makes that
       path a no-op instead of leaving an orphaned rAF loop running against a
       Lenis instance nothing will ever destroy. */
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;

      const lenis = new Lenis({
        duration: 1.1,
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
