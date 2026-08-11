/* ============================================================================
   in-page-scroll
   ----------------------------------------------------------------------------
   The one thing `<a href="#id">` did that a control now has to do by hand.

   Nothing in this app navigates through a raw anchor: a raw `<a>` to a route is
   a full document load, which is the cost the whole build is trying not to pay,
   so routes go through `next/link`. A same-page hash was never navigation in
   the first place — nothing routes, the viewport just moves — so it becomes a
   button, and this is what that button calls.

   The behaviour mirrors the sheet rather than picking its own: globals.css sets
   `html { scroll-behavior: smooth }` and accessibility.css turns that off under
   a reduced-motion preference. `scrollIntoView` carries its own behaviour and
   would otherwise keep animating for a visitor who asked it not to.
   ========================================================================= */

/** Moves the viewport to the element a hash names, with or without the `#`. */
export function scrollToHash(hash: string) {
  const target = document.getElementById(hash.replace(/^#/, ""));
  if (!target) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
