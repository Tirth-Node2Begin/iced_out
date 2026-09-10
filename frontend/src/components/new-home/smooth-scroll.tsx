"use client";

import type { ReactNode } from "react";

import { useAdaptiveSmoothScroll } from "@/lib/use-adaptive-smooth-scroll";

/**
 * The pinned showcase benefits from smoothed wheel input on capable desktops.
 * Phones, Save-Data sessions and reduced-motion users stay on native scroll.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useAdaptiveSmoothScroll({ duration: 1.15, touchMultiplier: 1.45, wheelMultiplier: 1 });

  return <>{children}</>;
}
