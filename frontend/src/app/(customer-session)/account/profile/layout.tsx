import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SmoothScroll } from "@/components/new-home/smooth-scroll";

/* Title carrier only — the panel itself is a client component, which cannot
   export `metadata`. */
export const metadata: Metadata = { title: "Profile" };

export default function ProfileLayout({ children }: { children: ReactNode }) {
  /* Lenis, as on About and the bag: the address book plus the quick-action grid
     run past the fold on most windows, and the eased position is what makes the
     column travel the way the rest of the site does. Scoped to this tab rather
     than the account shell, so the panels that fit in a window are untouched.
     Disabled under prefers-reduced-motion. */
  return <SmoothScroll>{children}</SmoothScroll>;
}
