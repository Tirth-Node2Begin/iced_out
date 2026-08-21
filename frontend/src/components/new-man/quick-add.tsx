"use client";

import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  ShoppingBag,
  X,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  formatPrice,
  pricingFor,
  productFor,
  sizesFor,
  type Piece,
} from "@/components/new-man/data";
import { productSlug, shippingNote, shotsFor } from "@/components/new-man/product-deck";
import { SizeGuide } from "@/components/new-man/size-guide";
import { EASE_OUT } from "@/components/new-home/motion-primitives";
import { useCatalog } from "@/features/02-products";
import { ProductFrame } from "@/components/new-man/product-bits";
import { useCart } from "@/features/04-cart/cart-context";
import { useStorefrontConfig } from "@/features/04-cart/storefront-config";
import { useWishlist } from "@/features/05-wishlist/wishlist-context";
import { lockScroll } from "@/lib/scroll-lock";

/**
 * Quick add — the panel a tile opens.
 *
 * The listing tiles carry no size control of their own, so this is where a
 * size is chosen and the piece goes into the bag. It adds to the SHARED cart
 * (`features/04-cart`), not a local mock: the line it creates is the same line
 * /cart and checkout read. The cart drawer is mounted by the storefront and
 * gender headers, neither of which this page uses, so the confirmation is
 * shown here instead — otherwise a successful add would look like nothing
 * happened.
 *
 * It renders through a portal rather than inside `.nh-root`, which carries
 * `overflow-x: clip` and stacking contexts a fixed overlay should not have to
 * negotiate with.
 */
/** How long a photograph holds before the gallery moves on. */
const SHOT_MS = 2600;

export function QuickAdd({ piece, onClose }: { piece: Piece; onClose: () => void }) {
  // No mounted-flag dance: the panel only ever exists because someone clicked a
  // tile, so it is never part of a server render and has nothing to reconcile.
  if (typeof document === "undefined") return null;
  return createPortal(<QuickAddPanel onClose={onClose} piece={piece} />, document.body);
}

function QuickAddPanel({ piece, onClose }: { piece: Piece; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [size, setSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** the size guide dialog, which opens on top of this panel */
  const [guide, setGuide] = useState(false);

  const { addItem } = useCart();
  const { freeDeliveryOver } = useStorefrontConfig();

  /* The same wishlist the tile's heart writes to, keyed on the same piece — so
     opening this panel over a saved tile shows a filled heart, and unsaving it
     here empties the tile behind the scrim. It used to be a local `useState`
     that agreed with nothing. */
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(piece.id);

  /* The catalogue arrives over the network, so these lookups take it as an
     argument and re-run when it lands. */
  const { data: catalogue } = useCatalog();
  const sizes = useMemo(() => sizesFor(piece, catalogue), [catalogue, piece]);
  const price = useMemo(() => pricingFor(piece), [piece]);
  const product = useMemo(() => productFor(piece, catalogue), [catalogue, piece]);

  /* The same photographs the piece's own product page opens with, so the panel
     and the PDP are showing one garment rather than two shot lists. Shot 0 is
     the piece's primary — the photograph on the tile that was just clicked,
     which is what makes the panel feel like it grew out of the tile. */
  const shots = useMemo(() => shotsFor(piece, product), [piece, product]);

  /* The index travels with the DIRECTION it moved in, as one piece of state.
     Two separate values would let a render land between them and animate a
     backwards step forwards. */
  const [[shotIndex, heading], setShot] = useState<[number, number]>([0, 1]);
  /* Hovering or focusing the photograph holds it: reading the shot a shopper
     stopped on matters more than finishing the rotation. */
  const [held, setHeld] = useState(false);

  /* Clamped, for the same reason the product page clamps: a gallery is as long
     as the operator's own run, so an index held from one piece can point past
     the end of another's. The panel is reused across tiles without remounting. */
  const shot = Math.min(shotIndex, Math.max(0, shots.length - 1));

  /** the photograph on screen */
  const frame = shots[shot];

  const soldOut = sizes.every((option) => option.state === "out");

  const step = useCallback(
    (delta: number) =>
      setShot(([current]) => [
        (current + delta + shots.length) % shots.length,
        delta < 0 ? -1 : 1,
      ]),
    [shots.length],
  );

  const jump = useCallback(
    (next: number) => setShot(([current]) => [next, next < current ? -1 : 1]),
    [],
  );

  /* Autoplay. A timeout keyed on `shot` rather than an interval, so arrowing to
     a photograph gives it a full dwell instead of whatever was left of the
     interval — and so the rotation never fires twice in quick succession.

     It does not run under `prefers-reduced-motion`: a carousel that advances on
     its own is exactly what that preference is asking not to happen. The arrows
     are still there, so no photograph becomes unreachable. */
  useEffect(() => {
    if (reduce || held || shots.length < 2) return;
    const timer = window.setTimeout(() => step(1), SHOT_MS);
    return () => window.clearTimeout(timer);
  }, [held, reduce, shot, shots.length, step]);

  /* The slide, as variants rather than inline objects: an exiting layer keeps
     the props it last rendered with, so an inline `exit` would read the
     direction from BEFORE the change and leave every second photograph sliding
     out the way it came in. Variants resolve against `AnimatePresence`'s
     `custom` at exit time, which is the current direction. */
  const slide = useMemo(() => {
    const distance = reduce ? 0 : 28;
    return {
      enter: (direction: number) => ({ opacity: 0, x: direction * distance }),
      center: { opacity: 1, x: 0 },
      exit: (direction: number) => ({ opacity: 0, x: direction * -distance }),
    };
  }, [reduce]);

  /* --- the page underneath, and where focus goes -------------------------
     Its own effect, with NO dependencies. The key handler below is rebuilt
     whenever `onClose` or `step` change, and a lock rebuilt on the same
     schedule would release the page for a frame each time and re-read its
     "previous" state from itself. See lib/scroll-lock.ts — the count there is
     also what lets the size guide take the lock on top of this one. */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const release = lockScroll();

    return () => {
      release();
      opener?.focus?.();
    };
  }, []);

  /* --- escape, the gallery on the arrows, and the focus trap ------------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      // the gallery on the arrow keys. Nothing else in the panel claims them —
      // the size run is a radiogroup but is navigated by Tab here — so they are
      // free for the one thing on screen that has a previous and a next.
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        step(event.key === "ArrowLeft" ? -1 : 1);
        return;
      }

      if (event.key !== "Tab" || !dialog.current) return;

      // A modal that lets Tab wander onto the page behind it is a modal in
      // appearance only, so focus is cycled inside the panel by hand.
      const focusable = dialog.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, step]);

  const onAdd = useCallback(() => {
    if (!size) {
      setError("Pick a size first.");
      return;
    }
    if (!product) {
      setError("This piece cannot be added right now.");
      return;
    }

    setError(null);
    // `reveal: false` — the panel confirms the add itself, and the bag drawer
    // sliding over an open dialog stacks two answers to one press
    addItem(product, size, { reveal: false });
    setAdded(true);
  }, [addItem, product, size]);

  return (
    <div className="nhq" role="presentation">
      <motion.div
        animate={{ opacity: 1 }}
        className="nhq__scrim"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onClose}
        transition={{ duration: 0.28, ease: EASE_OUT }}
      />

      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        aria-labelledby="nhq-title"
        aria-modal="true"
        className="nhq__panel"
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        ref={dialog}
        role="dialog"
        tabIndex={-1}
        transition={{ duration: 0.36, ease: EASE_OUT }}
      >
        <button aria-label="Close" className="nhq__close" onClick={onClose} type="button">
          <X aria-hidden size={15} />
        </button>

        {/* The gallery. `ProductFrame` from product-bits.tsx draws exactly this
            frame, but its rules are scoped under `.nh-root` and this panel is
            portalled to <body>, so the markup is restated here against the
            panel's own unscoped classes. */}
        <div
          aria-label={`${piece.name} — ${shots.length} photographs`}
          aria-roledescription="carousel"
          className="nhq__media"
          onBlur={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          role="group"
        >
          {/* No `mode="wait"`, which would leave the frame empty between two
              photographs; the outgoing and incoming layers share the one box
              and cross under each other. */}
          <AnimatePresence custom={heading} initial={false}>
            <motion.div
              animate="center"
              className="nhq__shotLayer"
              custom={heading}
              exit="exit"
              initial="enter"
              key={shot}
              transition={{ duration: reduce ? 0 : 0.58, ease: EASE_OUT }}
              variants={slide}
            >
              <ProductFrame
                alt={`${piece.name} — photograph ${shot + 1} of ${shots.length}`}
                className="nhq__shot"
                frame={frame}
              />
            </motion.div>
          </AnimatePresence>

          <button
            aria-label="Previous photograph"
            className="nhq__nav nhq__nav--prev"
            onClick={() => step(-1)}
            type="button"
          >
            <ChevronLeft aria-hidden size={16} />
          </button>

          <button
            aria-label="Next photograph"
            className="nhq__nav nhq__nav--next"
            onClick={() => step(1)}
            type="button"
          >
            <ChevronRight aria-hidden size={16} />
          </button>

          {/* Where you are in the run, and a way to get anywhere in it directly.
              Without these the rotation looks like the photograph glitching
              rather than a gallery of four. */}
          <span className="nhq__dots">
            {shots.map((_, index) => (
              <button
                aria-current={index === shot}
                aria-label={`Show photograph ${index + 1}`}
                className="nhq__dot"
                data-on={index === shot}
                key={index}
                onClick={() => jump(index)}
                type="button"
              />
            ))}
          </span>
        </div>

        <div className="nhq__body">
          <p className="nhq__eyebrow">{piece.tag}</p>
          <h2 className="nhq__title" id="nhq-title">
            {piece.name}
          </h2>

          <div className="nhq__prices">
            <span className="nhq__price">{formatPrice(price.price)}</span>
            {price.mrp !== null && (
              <>
                <span className="nhq__mrp">
                  MRP: <s>{formatPrice(price.mrp)}</s>
                </span>
                <span className="nhq__off">{price.off}% OFF</span>
              </>
            )}
          </div>
          <p className="nhq__tax">Inclusive of all taxes</p>

          <AnimatePresence initial={false} mode="wait">
            {added ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="nhq__done"
                initial={{ opacity: 0, y: 8 }}
                key="done"
                transition={{ duration: 0.3, ease: EASE_OUT }}
              >
                <p className="nhq__doneLine">
                  <span className="nhq__doneMark">
                    <Check aria-hidden size={12} strokeWidth={3} />
                  </span>
                  Added to bag — size {size}
                </p>
                <div className="nhq__actions">
                  <Link className="nhq__btn nhq__btn--solid" href="/cart">
                    View bag
                    <ArrowUpRight aria-hidden size={14} />
                  </Link>
                  <button className="nhq__btn" onClick={onClose} type="button">
                    Keep shopping
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1 }}
                initial={{ opacity: 0 }}
                key="pick"
                transition={{ duration: 0.24, ease: EASE_OUT }}
              >
                <div className="nhq__sizes">
                  <div className="nhq__sizeHead">
                    <span className="nhq__label">Select size</span>
                    {/* The same dialog the product page opens, over the top of
                        this one. It is the one control here that used to leave
                        the page entirely — from a panel opened off a tile, that
                        threw away the grid, the filters and the scroll as well. */}
                    <button
                      aria-haspopup="dialog"
                      className="nhq__guide"
                      onClick={() => setGuide(true)}
                      type="button"
                    >
                      Size guide
                    </button>
                  </div>

                  <div
                    aria-label="Select a size"
                    className="nhq__sizeRow"
                    role="radiogroup"
                  >
                    {sizes.map((option) => (
                      <button
                        aria-checked={size === option.label}
                        className="nhq__size"
                        data-state={option.state}
                        disabled={option.state === "out"}
                        key={option.label}
                        onClick={() => {
                          setSize(option.label);
                          setError(null);
                        }}
                        role="radio"
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {/* the one size in the run that is nearly gone is worth
                      saying out loud, not just marking with a dot */}
                  {size && sizes.find((o) => o.label === size)?.state === "low" && (
                    <p className="nhq__low">Low stock in {size}.</p>
                  )}

                  {error && (
                    <p className="nhq__error" role="alert">
                      {error}
                    </p>
                  )}
                </div>

                <div className="nhq__actions">
                  <button
                    className="nhq__btn nhq__btn--solid"
                    disabled={soldOut}
                    onClick={onAdd}
                    type="button"
                  >
                    <ShoppingBag aria-hidden size={14} />
                    {/* the bag takes a line from anyone; the session is asked
                        for at checkout */}
                    {soldOut ? "Sold out" : "Add to bag"}
                  </button>

                  <button
                    aria-pressed={saved}
                    className="nhq__btn nhq__btn--icon"
                    data-on={saved}
                    onClick={() => toggle(piece.id)}
                    type="button"
                  >
                    <Heart aria-hidden size={15} />
                    <span className="sr-only">
                      {saved ? "Remove from wishlist" : "Save for later"}
                    </span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* this piece's own page, not the shared fixture route — see the note
              on the tile's link in product-grid.tsx */}
          <Link className="nhq__details" href={`/new-man/piece?slug=${productSlug(piece)}`}>
            View full details
            <ArrowUpRight aria-hidden size={13} />
          </Link>

          <ul className="nhq__notes">
            <li>{shippingNote(freeDeliveryOver)}</li>
            <li>30-day returns</li>
          </ul>
        </div>
      </motion.div>

      {/* Portalled to <body> in its own right, so it lands beside this panel
          rather than inside it — a dialog nested in the DOM of another one
          inherits its 760px box and its overflow. */}
      <AnimatePresence>
        {guide && (
          <SizeGuide
            key="guide"
            onClose={() => setGuide(false)}
            onPickSize={(next) => {
              setSize(next);
              setError(null);
            }}
            piece={piece}
            selected={size}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
