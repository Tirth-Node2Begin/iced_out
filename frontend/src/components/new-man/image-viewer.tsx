"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { EASE_OUT } from "@/components/new-home/motion-primitives";
import { ProductFrame } from "@/components/new-man/product-bits";
import type { Frame } from "@/components/new-man/data";

/** px of drag, or px/s of throw, that counts as "next" rather than a wobble */
const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 420;

/**
 * The gallery at full size.
 *
 * Every photograph on this page is a CROP — either a point on a photograph
 * zoomed into a card-shaped frame, or one cell of a 2×2 contact sheet — because
 * five files have to serve twenty pieces. A frame is therefore never the whole
 * of what it is cut from, and "show it properly" means something different for
 * each of the two modes:
 *
 *   crop — the source IS a single photograph, so the frame's zoom and centring
 *          are dropped and the whole picture is fitted to the screen. This is
 *          the one place a shopper sees all of it.
 *   quad — the source is four unrelated garments on one sheet. Fitting the file
 *          would show three photographs nobody asked for, so the cell keeps its
 *          framing and is fitted as a square, which is its true shape.
 *
 * Sized against `vmin`/`vh` rather than a fixed box, so a phone in landscape and
 * a desktop both get the largest picture their shortest axis allows.
 */
export function ImageViewer({
  frames,
  index,
  name,
  onClose,
  onIndexChange,
}: {
  frames: Frame[];
  index: number;
  name: string;
  onClose: () => void;
  /** kept in step so closing leaves the hero on the photograph last looked at */
  onIndexChange: (next: number) => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <ViewerPanel
      frames={frames}
      index={index}
      name={name}
      onClose={onClose}
      onIndexChange={onIndexChange}
    />,
    document.body,
  );
}

function ViewerPanel({
  frames,
  index,
  name,
  onClose,
  onIndexChange,
}: {
  frames: Frame[];
  index: number;
  name: string;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  /** which way the next photograph arrives from, so back and forward read apart */
  const [direction, setDirection] = useState(1);

  const total = frames.length;
  const frame = frames[index];

  const step = useCallback(
    (by: number) => {
      setDirection(by);
      onIndexChange(((index + by) % total + total) % total);
    },
    [index, onIndexChange, total],
  );

  /* --- escape, arrows, focus, and the page underneath --------------------- */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        step(event.key === "ArrowLeft" ? -1 : 1);
        return;
      }

      if (event.key !== "Tab" || !dialog.current) return;

      const focusable = dialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialog.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    /* Lenis drives the window scroll on this route, so locking the document is
       what stops the page travelling behind the overlay. The scrollbar's width
       is handed back as padding or the layout jumps left as it disappears. */
    const root = document.documentElement;
    const gap = window.innerWidth - root.clientWidth;
    const previousOverflow = root.style.overflow;
    const previousPadding = root.style.paddingRight;
    root.style.overflow = "hidden";
    if (gap > 0) root.style.paddingRight = `${gap}px`;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      root.style.overflow = previousOverflow;
      root.style.paddingRight = previousPadding;
      opener?.focus?.();
    };
  }, [onClose, step]);

  const onDragEnd = useCallback(
    (_event: unknown, info: PanInfo) => {
      const { offset, velocity } = info;
      const thrown =
        Math.abs(offset.x) > SWIPE_DISTANCE || Math.abs(velocity.x) > SWIPE_VELOCITY;
      // drag left → the next photograph comes in from the right
      if (thrown) step(offset.x < 0 ? 1 : -1);
    },
    [step],
  );

  return (
    <div className="nmv" role="presentation">
      <motion.div
        animate={{ opacity: 1 }}
        className="nmv__scrim"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onClose}
        transition={{ duration: 0.26, ease: EASE_OUT }}
      />

      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        aria-label={`${name} — photograph ${index + 1} of ${total}`}
        aria-modal="true"
        className="nmv__panel"
        exit={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
        initial={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
        ref={dialog}
        role="dialog"
        tabIndex={-1}
        transition={{ duration: reduce ? 0 : 0.32, ease: EASE_OUT }}
      >
        <button
          aria-label="Close"
          className="nmv__close"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden size={17} />
        </button>

        {/* The drag lives on a wrapper AROUND the cross-fade, never on the
            layers inside it: motion's drag owns `x` on whatever carries it, and
            the entering and leaving photographs animate their own `x`. */}
        <motion.div
          className="nmv__stage"
          drag={total > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.14}
          dragMomentum={false}
          onDragEnd={onDragEnd}
        >
          <AnimatePresence custom={direction} initial={false} mode="popLayout">
            <motion.figure
              animate={{ opacity: 1, x: 0 }}
              className="nmv__figure"
              exit={{ opacity: 0, x: reduce ? 0 : direction * -30 }}
              initial={{ opacity: 0, x: reduce ? 0 : direction * 30 }}
              key={index}
              transition={{ duration: reduce ? 0 : 0.34, ease: EASE_OUT }}
            >
              <ProductFrame
                alt={`${name} — photograph ${index + 1} of ${total}`}
                className="nmv__shot"
                frame={frame}
              />
            </motion.figure>
          </AnimatePresence>
        </motion.div>

        {total > 1 && (
          <>
            {/* Siblings of the drag wrapper, never children: inside it every
                press would first be read as the start of a drag. */}
            <button
              aria-label="Previous photograph"
              className="nmv__nav nmv__nav--prev"
              onClick={() => step(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden size={20} />
            </button>
            <button
              aria-label="Next photograph"
              className="nmv__nav nmv__nav--next"
              onClick={() => step(1)}
              type="button"
            >
              <ChevronRight aria-hidden size={20} />
            </button>

            <p className="nmv__count">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <i aria-hidden>/</i>
              <span>{String(total).padStart(2, "0")}</span>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
