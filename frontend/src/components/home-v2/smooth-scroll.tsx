"use client";

import type { ReactNode } from "react";

import { useAdaptiveSmoothScroll } from "@/lib/use-adaptive-smooth-scroll";

/**
 * Lenis is useful on the large, scroll-scrubbed home surfaces, but it should not
 * be part of hydration or keep a frame loop alive on constrained devices.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useAdaptiveSmoothScroll({ duration: 1.1, touchMultiplier: 1.45, wheelMultiplier: 1 });

  return <>{children}</>;
}
