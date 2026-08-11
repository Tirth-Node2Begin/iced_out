/* ============================================================================
   scroll-lock
   ----------------------------------------------------------------------------
   Holding the document still while a dialog is open, for any number of dialogs
   at once.

   Every overlay used to do this itself: read `documentElement.style.overflow`,
   stash it, write "hidden", and put the stashed value back on the way out. That
   is correct for exactly one overlay. The moment a second opens on top of the
   first — the size guide over the quick-add panel — the two are saving and
   restoring the same global, and whichever unmounts second writes back a value
   it read while the other was already holding the lock. The page comes back
   either stuck (nothing scrolls, and no dialog is open to explain why) or
   released early (the page travels behind an overlay that is still up).

   It is also why those effects must not depend on anything unstable. An `onClose`
   arrow recreated each render tears the effect down and rebuilds it on every
   parent render, and each rebuild re-reads the "previous" value — by then its
   own "hidden". Callers keep the lock in an effect of its own with no deps; the
   counter here is what makes that safe to nest.

   Lenis drives the window scroll on the /new-man routes, so locking the document
   is what actually stops the page moving. The scrollbar's width is handed back
   as padding, or the layout jumps left the frame it disappears.
   ========================================================================= */

/** How many overlays are currently holding it. */
let held = 0;
/** What the document looked like before the FIRST of them arrived. */
let previousOverflow = "";
let previousPadding = "";

/**
 * Takes the lock and returns the release for it.
 *
 * The release is idempotent: React runs an effect's cleanup twice in
 * development, and a second decrement would drop the count below what is
 * actually on screen and free the page under a dialog still holding it.
 */
export function lockScroll() {
  const root = document.documentElement;

  if (held === 0) {
    previousOverflow = root.style.overflow;
    previousPadding = root.style.paddingRight;

    const gap = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (gap > 0) root.style.paddingRight = `${gap}px`;
  }

  held += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;

    held -= 1;
    if (held > 0) return;

    root.style.overflow = previousOverflow;
    root.style.paddingRight = previousPadding;
  };
}
