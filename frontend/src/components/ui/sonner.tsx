"use client";

import { BadgeCheck, CircleX, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * The app's toast surface — one mount for the storefront and the console, which
 * share a palette and a family, so they share this.
 *
 * This arrived as the stock shadcn wrapper: it read the theme from
 * `next-themes`, which has no provider here, and painted itself from
 * `--popover` / `--border` / `--radius`, none of which this project declares.
 *
 * Everything visual now lives in `styles/components/toast.css`, next to the
 * comment explaining why its selectors are so deep. What is left here is the
 * behaviour sonner will only take as props — and the two custom properties it
 * writes inline on the list, which a stylesheet cannot outrank.
 *
 * The site is dark-only (`viewport.colorScheme`), so there is no theme to read;
 * `theme` is pinned instead, which keeps sonner's own light defaults — the
 * near-black close glyph among them — off a near-black surface.
 */
const Toaster = (props: ToasterProps) => (
  <Sonner
    className="io-toaster"
    closeButton
    /* Every toast on the site carries a description, and several name an order
       or an SKU worth reading before it goes. */
    duration={5000}
    gap={12}
    /* Lucide, like every other glyph on the site — sonner ships its own set,
       and two icon languages in one corner of the screen is visible. These are
       the outline drawings; the sheet fills the outer shape and knocks the mark
       back out of it, which is where the solid badge comes from. The stroke is
       weighted for that: it is the width of the knocked-out mark, not of an
       outline. */
    icons={{
      success: <BadgeCheck size={18} strokeWidth={2.4} />,
      info: <Info size={18} strokeWidth={2.4} />,
      warning: <TriangleAlert size={18} strokeWidth={2.4} />,
      error: <CircleX size={18} strokeWidth={2.4} />,
      loading: <LoaderCircle className="io-toast__spin" size={18} strokeWidth={2} />,
      close: <X size={14} strokeWidth={1.8} />,
    }}
    /* The corner, on both axes. `offset` is every side at once in sonner 2 — as
       a bare `90` it inset the stack 90px from the right as well, which left it
       hanging in the middle of the page rather than in the corner. The console
       has nothing pinned bottom-right for it to cover. */
    offset={{ right: 24, bottom: 24 }}
    mobileOffset={{ left: 16, right: 16, bottom: 16 }}
    position="bottom-right"
    /* Sonner writes `--width` and the offsets onto the list itself, so these
       two cannot be set from the sheet. 380px carries a title and a line of
       detail without hyphenating an id. */
    style={{ "--width": "380px" } as React.CSSProperties}
    theme="dark"
    toastOptions={{ classNames: { toast: "io-toast" } }}
    visibleToasts={4}
    {...props}
  />
);

export { Toaster };
