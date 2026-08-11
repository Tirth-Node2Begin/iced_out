"use client";

import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * The app's toast surface.
 *
 * This arrived as the stock shadcn wrapper and was never mounted, so it was
 * still dressed for a project this is not: it read the theme from
 * `next-themes`, which has no provider here, and painted itself from
 * `--popover` / `--border` / `--radius`, none of which this stylesheet
 * declares. Both resolved to nothing, which is a transparent toast.
 *
 * The palette is therefore written out rather than referenced. It is the same
 * one `.io-scope` declares — but a toast is portalled to `document.body`, which
 * is OUTSIDE that class, so a `var(--nh-…)` in here has nothing to resolve
 * against. If those hexes move in `chrome.css`, they move here too.
 *
 * The site is dark-only (`viewport.colorScheme`), so there is no theme to read.
 */
const Toaster = (props: ToasterProps) => (
  <Sonner
    className="toaster group"
    closeButton
    /* Lucide, like every other glyph on the site — sonner ships its own set,
       and two icon languages in one corner of the screen is visible. */
    icons={{
      success: <CircleCheck size={16} strokeWidth={1.9} />,
      info: <Info size={16} strokeWidth={1.9} />,
      warning: <TriangleAlert size={16} strokeWidth={1.9} />,
      error: <CircleX size={16} strokeWidth={1.9} />,
      loading: <LoaderCircle className="io-toast__spin" size={16} strokeWidth={1.9} />,
    }}
    // Under the sticky header rather than over it: the bar is the one thing on
    // screen that must never be covered, and a toast is an aside.
    offset={90}
    position="bottom-right"
    style={
      {
        "--normal-bg": "#1a1c1e",
        "--normal-text": "#f1f3f3",
        "--normal-border": "rgba(255, 255, 255, 0.13)",
        /* Success keeps the house's surface and says so with the icon and a
           green hairline — a fully green slab next to this palette reads as an
           alert, and a saved profile is not one. */
        "--success-bg": "#1a1c1e",
        "--success-text": "#f1f3f3",
        "--success-border": "rgba(74, 222, 128, 0.34)",
        "--error-bg": "#1a1c1e",
        "--error-text": "#f1f3f3",
        "--error-border": "rgba(248, 113, 113, 0.34)",
        "--border-radius": "14px",
        fontFamily: "inherit",
      } as React.CSSProperties
    }
    toastOptions={{ classNames: { toast: "io-toast" } }}
    {...props}
  />
);

export { Toaster };
