"use client";

import { useEffect } from "react";

import {
  getPerformanceProfile,
  runWhenIdle,
  shouldUseSmoothScroll,
} from "@/lib/performance-mode";

type SmoothScrollOptions = {
  duration: number;
  touchMultiplier?: number;
  wheelMultiplier?: number;
};

type LenisInstance = {
  destroy: () => void;
  raf: (time: number) => void;
};

export function useAdaptiveSmoothScroll(options: SmoothScrollOptions) {
  useEffect(() => {
    const profile = getPerformanceProfile();
    if (!shouldUseSmoothScroll(profile)) return;

    let cancelled = false;
    let frame = 0;
    let started = false;
    let lenis: LenisInstance | null = null;
    let removeVisibility: (() => void) | undefined;

    const stopLoop = () => {
      if (!frame) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const tick = (time: number) => {
      if (!lenis || document.hidden) {
        frame = 0;
        return;
      }

      lenis.raf(time);
      frame = window.requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (!lenis || frame || document.hidden) return;
      frame = window.requestAnimationFrame(tick);
    };

    const removeIntentListeners = () => {
      window.removeEventListener("wheel", start);
      window.removeEventListener("touchstart", start);
      window.removeEventListener("keydown", start);
    };

    function start() {
      if (started || cancelled) return;
      started = true;
      removeIntentListeners();

      void import("lenis").then(({ default: Lenis }) => {
        if (cancelled) return;

        lenis = new Lenis({
          duration: options.duration,
          easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
          touchMultiplier: options.touchMultiplier ?? 1.35,
          wheelMultiplier: options.wheelMultiplier ?? 1,
        });

        const onVisibility = () => {
          if (document.hidden) stopLoop();
          else startLoop();
        };

        document.addEventListener("visibilitychange", onVisibility);
        removeVisibility = () =>
          document.removeEventListener("visibilitychange", onVisibility);
        startLoop();
      });
    }

    window.addEventListener("wheel", start, { once: true, passive: true });
    window.addEventListener("touchstart", start, { once: true, passive: true });
    window.addEventListener("keydown", start, { once: true });

    const cancelIdle = runWhenIdle(start, profile.mode === "high" ? 1800 : 2600);

    return () => {
      cancelled = true;
      cancelIdle();
      removeIntentListeners();
      removeVisibility?.();
      stopLoop();
      lenis?.destroy();
      lenis = null;
    };
  }, [options.duration, options.touchMultiplier, options.wheelMultiplier]);
}
