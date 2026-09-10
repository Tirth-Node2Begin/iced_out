"use client";

import "aos/dist/aos.css";
import { useEffect, type ReactNode } from "react";

import { applyPerformanceProfile, getPerformanceProfile } from "@/lib/performance-mode";

/**
 * Declarative one-shot reveals for home-v2 surfaces. Motion still handles the
 * scrubbed effects; AOS is kept out of low/reduced modes so content paints
 * immediately and no resize observer churns on small devices.
 */
export function AosProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const profile = applyPerformanceProfile(getPerformanceProfile());

    if (profile.mode === "low" || profile.reducedMotion) return;

    void import("aos").then(({ default: AOS }) => {
      if (cancelled) return;

      AOS.init({
        duration: profile.mode === "medium" ? 520 : 720,
        easing: "ease-out-quart",
        offset: profile.mode === "medium" ? 64 : 90,
        once: true,
        startEvent: "DOMContentLoaded",
      });

      let frame = 0;
      const refresh = () => {
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          AOS.refresh();
        });
      };

      window.addEventListener("load", refresh);
      const observer = new ResizeObserver(refresh);
      observer.observe(document.body);

      cleanup = () => {
        window.removeEventListener("load", refresh);
        observer.disconnect();
        if (frame) window.cancelAnimationFrame(frame);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <>{children}</>;
}
