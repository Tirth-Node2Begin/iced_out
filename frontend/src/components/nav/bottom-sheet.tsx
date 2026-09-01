"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { EASE_OUT } from "@/components/new-home/motion-primitives";

/* The surface's own rules, imported here rather than left to whichever
   stylesheet a route group happened to pull in. Both overlays used to be
   styled by chrome.css, which /about, /home-v2 and the /new-* pages never
   load — so on those routes the sheet fell out of `position: fixed` and
   landed in the page flow under the footer as unstyled text. Owning the
   import means the rules travel with the markup. */
import "@/styles/components/overlay-sheet.css";

/** Nothing to subscribe to — the value only changes once, at hydration. */
const subscribeNever = () => () => {};

/**
 * The bar's one overlay surface.
 *
 * Both things the header can open — the search field and the small-screen
 * menu — dock to the bottom edge and run the same gesture, so the shopper
 * learns one motion rather than a drawer for one and a sheet for the other.
 * Docking down also puts the surface where the thumb already is on a phone,
 * and leaves the page visible above it instead of replacing it.
 *
 * Portalled to the body: the header is `position: sticky` and creates its own
 * stacking context, so a sheet rendered inside it could never sit above the
 * page it covers.
 */
export function BottomSheet({
  open,
  onClose,
  label,
  dock = "bottom",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the dialog for assistive tech — the sheets have no visible title. */
  label: string;
  /**
   * Which edge the panel is anchored to.
   *
   * The menu keeps the bottom, where the thumb is and where a list of
   * destinations reads naturally. Search takes the top: the field is the thing
   * being used, and docking it down put it under the on-screen keyboard on a
   * phone and at the far edge of the screen from the glyph that opened it on a
   * desktop. Anchoring up also lets the results run DOWN the page in reading
   * order rather than growing backwards out of the field.
   *
   * Only the anchor changes — the surface, the scrim, the motion curve and the
   * focus trap are one implementation for both.
   */
  dock?: "top" | "bottom";
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  /* There is no `document.body` to portal into on the server. `useSyncExternal-
     Store` is the honest way to ask "am I on the client yet": it returns the
     server snapshot for the hydrating pass and the client one after, so the
     first render matches the markup instead of correcting it. */
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      // A sheet that covers the page has to keep the tab ring inside it, or
      // the next Tab lands on a control the shopper cannot see.
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Freeze the page behind the sheet, and pay back the scrollbar's width so
    // locking it does not shift the whole layout sideways.
    const { body } = document;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const previous = { overflow: body.style.overflow, padding: body.style.paddingRight };
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.padding;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const offscreen = dock === "top" ? "-100%" : "100%";

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          aria-label={label}
          aria-modal="true"
          className={`io-dock io-dock--${dock}`}
          role="dialog"
        >
          <motion.div
            animate={{ opacity: 1 }}
            className="io-dock__scrim"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
            transition={{ duration: 0.32, ease: EASE_OUT }}
          />
          {/* The panel slides in from the edge it is docked to, so the motion and
              the anchor always agree — a top sheet that rose from the bottom would
              read as the wrong surface arriving. */}
          <motion.div
            animate={{ y: 0 }}
            className="io-dock__panel"
            exit={{ y: offscreen, transition: { duration: 0.3, ease: EASE_OUT } }}
            initial={{ y: offscreen }}
            ref={panelRef}
            transition={{ duration: 0.52, ease: EASE_OUT }}
          >
            <span aria-hidden className="io-dock__grip" />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
