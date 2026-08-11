"use client";

import "aos/dist/aos.css";
import { useEffect, type ReactNode } from "react";

/**
 * AOS drives the page's *declarative* reveals — the one-shot "fade up as it
 * enters" moves on eyebrows, table rows, footer columns and body copy.
 *
 * The split with Motion is deliberate, and it is by capability rather than
 * taste. AOS toggles a class when an element crosses a threshold, so it can
 * only ever express "play this once on entry". Motion keeps the work here that
 * AOS structurally cannot do:
 *
 *   - scrubbed effects tied to scroll *position* (the word-by-word ink reveals,
 *     every parallax, the founders crossfade)
 *   - layout animation (the highlights row reshuffling around its copy panel)
 *   - presence — enter *and* exit (the founder swap, the testimonial carousel)
 *
 * Never put `data-aos` on an element Motion is animating: both write inline
 * styles to the same node and the last writer wins, which reads as a flicker.
 *
 * Timing is unified in home-v2.css — `[data-aos]` is forced onto the same
 * cubic-bezier(.22, 1, .36, 1) that Motion uses, so the two systems land on
 * one curve instead of two.
 *
 * The stylesheet stays a static import so it is extracted at build time and the
 * reveals have their start state before first paint. Only the library is
 * deferred: it is dead weight during hydration, and this provider sits in a
 * route-group layout, so it was being parsed on the way into every page in the
 * group. Initialising late is safe by design — `AOS.init()` checks
 * `document.readyState` and refreshes immediately when its start event has
 * already fired, which after a client-side navigation it always has.
 */
export function AosProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void import("aos").then(({ default: AOS }) => {
      if (cancelled) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      AOS.init({
        // The house ladder (new_style §6.7): 0.72s reveal, 0.35 viewport trigger.
        duration: 720,
        once: true,
        offset: 90,
        // The curve itself is overridden in CSS; this only picks AOS's transform.
        easing: "ease-out-quart",
        disable: reduce,
        // Lenis re-writes scroll position every frame. Letting AOS also listen to
        // its own throttled scroll handler is enough — but it must recalculate
        // element offsets once images have loaded, or everything above the fold
        // measures against a shorter document and triggers late.
        startEvent: "DOMContentLoaded",
      });

      const refresh = () => AOS.refresh();
      window.addEventListener("load", refresh);
      // Images here are lazy and unsized; each one that lands shifts offsets.
      const observer = new ResizeObserver(refresh);
      observer.observe(document.body);

      cleanup = () => {
        window.removeEventListener("load", refresh);
        observer.disconnect();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <>{children}</>;
}
