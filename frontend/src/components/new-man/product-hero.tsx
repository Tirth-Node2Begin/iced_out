"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Ruler,
} from "lucide-react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  EASE_OUT,
  SplitHeading,
} from "@/components/new-home/motion-primitives";
import {
  formatPrice,
  pricingFor,
  productFor,
  sizesFor,
  type Piece,
} from "@/components/new-man/data";
import { ImageViewer } from "@/components/new-man/image-viewer";
import { DispatchStrip, ProductFrame } from "@/components/new-man/product-bits";
import {
  CATEGORY_LABELS,
  PRODUCT_COPY,
  shotsFor,
} from "@/components/new-man/product-deck";
import { SizeGuide } from "@/components/new-man/size-guide";
import { useCart } from "@/features/04-cart/cart-context";
import { scrollToHash } from "@/lib/in-page-scroll";

/** how long a shot holds before the gallery advances on its own */
const AUTOPLAY_MS = 3000;
/** px of drag, or px/s of throw, that counts as "next" rather than a wobble */
const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 420;

/** seconds a thumbnail spends crossing the page into the frame */
const FLIGHT = 0.6;
/**
 * The tail of the flight, over which whatever the copy is landing on comes up
 * to full underneath it.
 *
 * It both STARTS and FINISHES before the copy is taken away, and the finishing
 * early is the point: the two are driven by different clocks — one a delayed
 * tween, the other a completion callback — and if the layer were still reaching
 * full on the frame the copy is removed, any skew between them shows as a blink
 * of an empty card. Ending the fade with time to spare means the copy is lifted
 * off a picture that has been complete underneath it for several frames. It
 * costs nothing to hide: both are the same photograph at the same size in the
 * same place, so the overlap is invisible however long it lasts.
 */
const HANDOFF = 0.16;
const SETTLE = 0.08;
/** `--nh-radius-card` and `--nh-radius-lg`: the corners morph between them */
const THUMB_RADIUS = 14;
const FRAME_RADIUS = 22;

/** a photograph in the air, in PAGE coordinates — see `goTo` for why */
type Flight = {
  /** the page root it is drawn into, resolved at launch */
  host: HTMLElement;
  index: number;
  from: Box;
  to: Box;
  /** `in` is the rail giving a shot to the frame, `out` the frame giving it back */
  mode: "in" | "out";
};

type Box = { left: number; top: number; width: number; height: number };

/* Page coordinates, not viewport ones: the flying copy is drawn on the body,
   which scrolls with the document, so a rectangle read off `getBoundingClientRect`
   has to have the scroll added back before it means anything there. */
function pageRect(element: HTMLElement): Box {
  const box = element.getBoundingClientRect();
  return {
    left: box.left + window.scrollX,
    top: box.top + window.scrollY,
    width: box.width,
    height: box.height,
  };
}

/**
 * 01 — the product hero, laid out as three real grid tracks: the buy column,
 * the shot, and the thumbnail rail.
 *
 * NOTHING here is positioned over anything else that carries text. The
 * reference composition reads as overlapping because its subject is a cut-out
 * hanging past its frame, but reproducing that with stacked layers is what puts
 * a headline under a photograph at the first width nobody tested. Each part
 * owns a track, the row grows to whichever is tallest, and the rail is the only
 * element allowed past the gutter — into its own clipped viewport, so it can
 * never push the page sideways. The only things drawn over the photograph are
 * that photograph's own controls, inside the frame that owns them.
 */
export function ProductHero({ piece }: { piece: Piece }) {
  const reduce = useReducedMotion();

  const shots = useMemo(() => shotsFor(piece), [piece]);
  const sizes = useMemo(() => sizesFor(piece), [piece]);
  const price = useMemo(() => pricingFor(piece), [piece]);
  const product = useMemo(() => productFor(piece), [piece]);

  const [shot, setShot] = useState(0);
  /** which way the next shot arrives from, so back and forward read apart */
  const [direction, setDirection] = useState(1);
  const [held, setHeld] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** the photograph the full-screen viewer is open on, or null when it is shut */
  const [viewer, setViewer] = useState<number | null>(null);
  /** the size guide dialog, which used to be a route — see PRODUCT_COPY */
  const [guide, setGuide] = useState(false);
  /** where a press on the photograph landed, to tell a tap from a swipe */
  const press = useRef<{ x: number; y: number } | null>(null);
  /** the thumbnail currently in the air between the rail and the frame */
  const [flight, setFlight] = useState<Flight | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  const { addItem } = useCart();

  const soldOut = sizes.every((option) => option.state === "out");
  const lowOnSize =
    size !== null &&
    sizes.find((option) => option.label === size)?.state === "low";

  const total = shots.length;

  /* What the rail shows: everything EXCEPT the photograph in the frame, in the
     order it arrives. A thumbnail of the picture already filling half the page
     is the one crop in the run that tells a shopper nothing, so the queue opens
     on the next shot and wraps back round to the one on screen last. */
  const queue = useMemo(
    () => Array.from({ length: total - 1 }, (_, i) => (shot + 1 + i) % total),
    [shot, total],
  );

  /* Every change of shot goes through here, so every change of shot can throw
     the thumbnail it is about to show across the page and into the frame — the
     arrows, the drag, the autoplay and a press on the rail all read the same.

     The two rectangles are measured HERE, in the same tick that sets the new
     shot, because a beat later the rail has already re-flowed and the thumb
     this is about to launch is gone from it. They are stored in page
     coordinates rather than viewport ones: the flight is a fifth of a second
     long, and a shopper who scrolls during it would otherwise watch it land
     somewhere the frame no longer is. */
  const goTo = useCallback(
    (next: number, step: number) => {
      const target = ((next % total) + total) % total;
      setDirection(step);
      if (target === shot) return;

      const frame = frameRef.current;
      /* Where the flying copy is drawn. It has to be the page root and not the
         body: every rule that frames a photograph on this page is scoped under
         that class, so a picture rendered outside it would arrive with no crop,
         no zoom and no palette. That root clips only the horizontal axis, at
         the page's own edges — nowhere near a flight between two boxes well
         inside them. */
      const host = frame?.closest<HTMLElement>(".nh-root") ?? null;

      /* Forwards, the queue GIVES a photograph up: the thumbnail at its head is
         taken out of the rail and grows into the frame.

         Backwards, the queue TAKES one BACK. Flying the tail thumbnail in would
         be the literal reading — the piece being shown does sit at the narrow
         end of the funnel — but it is the wrong one: it drags the smallest,
         furthest-off thumbnail the whole width of the page to show a picture
         the shopper has just come from, and it says nothing about where the one
         they were looking at went. So the journey simply runs the other way.
         What is in the frame shrinks into the head of the rail, which is
         exactly the slot the gallery has just put it in — it is next again now —
         and the picture being returned to arrives on the plain cross-fade.
         Forward pulls out of the queue; back puts back into it. */
      const pulling = step > 0;

      /* Matched on BOTH the photograph and its place in the queue. A thumb on
         its way out is dropped from the flow but stays in the DOM for the
         fraction of a second it takes to fade, so a shopper going quickly can
         have two copies of one photograph in here at once — the one that just
         left, frozen at the head, and the live one that has since re-entered at
         the tail. The pair only ever matches the live one.

         Going back, the box wanted is the HEAD SLOT rather than any particular
         photograph: whatever stands there now is about to be moved along one,
         and its rectangle is where the frame's picture is going. */
      const anchorShot = pulling ? target : queue[0];
      const anchorPos = pulling ? queue.indexOf(target) : 0;
      const anchor = railRef.current?.querySelector<HTMLElement>(
        `[data-shot="${anchorShot}"][data-pos="${anchorPos}"]`,
      );

      /* No flight under reduced motion, and none without both boxes — below
         1180px the rail is a scroller and the thumbnail at either end of this
         may be off its own edge. The cross-fade still runs, so the gallery
         never depends on this having happened. */
      if (!reduce && anchor && frame && host && !document.hidden) {
        const thumbBox = pageRect(anchor);
        const frameBox = pageRect(frame);
        /* Both ends have to be boxes that actually measure something. A
           background tab lays nothing out, and the autoplay timer keeps firing
           in one — without this, coming back to the tab means finding a
           photograph frozen mid-air on its way to a rectangle of no size. */
        if (thumbBox.width > 0 && frameBox.width > 0) {
          setFlight({
            host,
            /* forwards the picture arriving, backwards the one being sent back */
            index: pulling ? target : shot,
            from: pulling ? thumbBox : frameBox,
            to: pulling ? frameBox : thumbBox,
            mode: pulling ? "in" : "out",
          });
        }
      }

      setShot(target);
    },
    [queue, reduce, shot, total],
  );

  const step = useCallback((by: number) => goTo(shot + by, by), [goTo, shot]);

  /** true while the photograph now in the frame is still on its way there */
  const arriving = flight?.mode === "in" && flight.index === shot;
  /** true while the photograph that WAS in the frame is on its way back out */
  const sending = flight?.mode === "out";

  /* Autoplay. `shot` is in the dependency list on purpose: every manual change
     tears the timer down and starts a fresh one, so a shopper who has just
     pressed next never gets half a beat before it moves again. It does not run
     while the pointer is on the gallery, while a drag is in flight, or at all
     under a reduced-motion preference — an image that changes by itself is
     exactly the kind of movement that setting is asking us to stop. */
  useEffect(() => {
    if (reduce || held || total < 2) return;
    const id = window.setTimeout(() => goTo(shot + 1, 1), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [goTo, held, reduce, shot, total]);

  const onDragEnd = useCallback(
    (_event: unknown, info: PanInfo) => {
      setHeld(false);
      const { offset, velocity } = info;
      const thrown =
        Math.abs(offset.x) > SWIPE_DISTANCE ||
        Math.abs(velocity.x) > SWIPE_VELOCITY;
      // drag left → the next shot comes in from the right, as the finger implies
      if (thrown) step(offset.x < 0 ? 1 : -1);
    },
    [step],
  );

  /* Opening the viewer is a TAP on the photograph, and the photograph is also
     the swipe surface — so the press is measured. Anything that travelled more
     than a few pixels was a drag, and a drag that happens to end where the
     gallery decided not to advance must not also throw a dialog over the page. */
  const onShotPointerDown = useCallback((event: React.PointerEvent) => {
    press.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onShotClick = useCallback(
    (event: React.MouseEvent) => {
      const start = press.current;
      press.current = null;
      if (!start) return;
      const travelled = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      );
      if (travelled > 6) return;
      setViewer(shot);
    },
    [shot],
  );

  const onAdd = useCallback(() => {
    if (soldOut) return;
    if (!size) {
      setError("Pick a size first.");
      return;
    }
    if (!product) {
      setError("This piece cannot be added right now.");
      return;
    }

    setError(null);
    /* The bag drawer opens on top — that IS the answer to this press. The
       column's own `added` state is not a second answer competing with it: it
       is what the page still says once the drawer is dismissed, so the CTA does
       not snap back to reading "Add to bag" over a bag that has the piece. */
    addItem(product, size);
    setAdded(true);
  }, [addItem, product, size, soldOut]);

  return (
    <section className="nmp-hero">
      <div className="nh-wrap">
        {/* ------------------------------------------------------- header */}
        <div className="nmp-hero__top">
          {/* One plain way out. It is a Link to the listing rather than
              `router.back()`: a shopper who arrived from search or a shared URL
              has no history to step through, and a Back button that does
              nothing is worse than none. Where it lands is the trail's job to
              say — the control itself just says Back. */}
          <Link className="nmp-back" href={PRODUCT_COPY.backHref}>
            <ArrowLeft aria-hidden size={14} />
            Back
          </Link>

          <nav aria-label="Breadcrumb" className="nmp-trail">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/new-man">Men</Link>
            <span aria-hidden>/</span>
            <Link href={PRODUCT_COPY.backHref}>
              {CATEGORY_LABELS[piece.category]}
            </Link>
            <span aria-hidden>/</span>
            {/* the leaf truncates rather than wrapping the row onto a second
                line — a long piece name must not set the header's height */}
            <span aria-current="page" className="nmp-trail__leaf">
              {piece.name}
            </span>
          </nav>

          {/* Features is the details panel further down THIS page, not a
              route. As an anchor the browser read it as a document-level jump
              to a hash; as a button it is what it always was — a control that
              moves the viewport to a section already mounted below. */}
          <button
            className="nmp-crumb"
            onClick={() => scrollToHash(PRODUCT_COPY.featuresHref)}
            type="button"
          >
            <Plus aria-hidden size={12} />
            Features
          </button>
        </div>

        <div className="nmp-hero__stage">
          {/* ------------------------------------------------------- buy */}
          <div className="nmp-buy">
            <header className="nmp-buy__header">
              <p className="nh-eyebrow nmp-buy__kicker">
                {piece.tag} · {CATEGORY_LABELS[piece.category]}
              </p>

              {/* The name wraps on its own — no forced break, so a two-word
                  piece and a four-word one both sit on their natural lines
                  against the same left edge as everything under them. */}
              <SplitHeading
                as="h1"
                className="nmp-buy__title"
                segments={titleSegments(piece.name)}
              />

              <DispatchStrip />
            </header>

            <div className="nmp-sizes">
              <div className="nmp-sizes__head">
                <span className="nmp-label">Select size</span>
                {/* A dialog, not a route. It is asked for mid-decision, and a
                    link took the picker, the photograph and the scroll position
                    away to show a table this page had room for all along. */}
                <button
                  aria-haspopup="dialog"
                  className="nmp-guide"
                  onClick={() => setGuide(true)}
                  type="button"
                >
                  <Ruler aria-hidden size={13} />
                  Size guide
                </button>
              </div>

              <div
                aria-label="Select a size"
                className="nmp-sizes__row"
                role="radiogroup"
              >
                {sizes.map((option) => (
                  <button
                    aria-checked={size === option.label}
                    className="nmp-size"
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

              {/* A reserved slot, always in flow: growing it on the first bad
                  press would slide the CTA down under the cursor that just
                  missed. The live region announces it, since the only other
                  signal is a line of small type. */}
              <p
                aria-live="polite"
                className="nmp-buy__status"
                data-tone={error ? "error" : lowOnSize ? "low" : undefined}
                role="status"
              >
                {error ?? (lowOnSize ? `Low stock in ${size}.` : "")}
              </p>
            </div>

            {/* The reference leaves this column empty between the picker and
                the CTA. At the proportions the grid resolves to, that is a
                third of the column doing nothing, so the three facts a shopper
                asks for next stand in it — all read off the piece or the
                studio's own policy, none invented here. */}
            <ul className="nmp-buy__facts">
              <li>{product?.fabric ?? "Heavyweight cotton"}</li>
              <li>Single run · numbered, never restocked</li>
              {PRODUCT_COPY.notes.slice(0, 2).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>

            <div className="nmp-buy__cta">
              <button
                aria-label={soldOut ? "Sold out" : `Add ${piece.name} to bag`}
                className="nmp-add"
                data-done={added || undefined}
                disabled={soldOut}
                onClick={onAdd}
                type="button"
              >
                {/* a ten-sided outline, as in the reference — drawn as a
                    polygon so the stroke stays one hairline at every size */}
                <svg
                  aria-hidden
                  className="nmp-add__poly"
                  viewBox="0 0 100 100"
                >
                  <polygon points={DECAGON} vectorEffect="non-scaling-stroke" />
                </svg>
                <span className="nmp-add__glyph">
                  {added ? (
                    <Check aria-hidden size={17} strokeWidth={2} />
                  ) : (
                    <ArrowUpRight aria-hidden size={18} strokeWidth={1.5} />
                  )}
                </span>
              </button>

              <div className="nmp-buy__lockup">
                {/* No "sign in to add" state: the bag takes a line from anyone
                    and the session is asked for at checkout. */}
                <span className="nmp-buy__label">
                  {soldOut
                    ? "Sold out"
                    : added
                      ? `Added — size ${size}`
                      : "Add to bag"}
                </span>
                <span className="nmp-buy__price">
                  {formatPrice(price.price)}
                </span>
                <span className="nmp-buy__mrp">
                  MRP <s>{formatPrice(price.mrp)}</s>
                  <b>{price.off}% off</b>
                </span>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {added && (
                <motion.div
                  animate={{ opacity: 1, height: "auto" }}
                  className="nmp-buy__done"
                  exit={{ opacity: 0, height: 0 }}
                  initial={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduce ? 0 : 0.36, ease: EASE_OUT }}
                >
                  <Link className="nmp-buy__bag" href="/cart">
                    View bag
                    <ArrowUpRight aria-hidden size={13} />
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ------------------------------------------------------ shot */}
          <div className="nmp-hero__shot">
            {/* The frame's own chrome — the flag and the arrows — hangs on THIS
                box rather than inside the frame, and the difference is the
                flight. A photograph crossing the page is drawn at the page
                root, above everything the hero paints; the frame isolates its
                own stack, so nothing inside it can rise above that copy, and a
                pair of arrows sealed in there blinks out every time one passes
                over. Out here they are ordinary siblings of the frame, free to
                sit above the flight and stay put through it. This wrapper takes
                no `z-index` and no `isolation` of its own — either would build
                the same wall one level further out. */}
            <div
              className="nmp-shot__wrap"
              onMouseEnter={() => setHeld(true)}
              onMouseLeave={() => setHeld(false)}
            >
              <div className="nmp-shot" ref={frameRef}>
                {/* The drag lives on a wrapper AROUND the cross-fade, not on the
                  layers inside it. Motion's drag owns `x` on whatever carries
                  it, and the entering and leaving shots animate their own `x`
                  for the slide — one element cannot be driven by both without
                  the release snapping the wrong picture back into place. */}
                <motion.div
                  className="nmp-shot__drag"
                  drag={total > 1 ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.16}
                  dragMomentum={false}
                  onClick={onShotClick}
                  onDragEnd={onDragEnd}
                  onDragStart={() => setHeld(true)}
                  onPointerDown={onShotPointerDown}
                >
                  <AnimatePresence custom={direction} initial={false}>
                    {/* When a thumbnail is on its way here, this layer does NOT
                      slide in beside it — that would be the same photograph
                      arriving twice by two different routes. It sits at rest
                      and comes up to full only over the last frames of the
                      flight, under a thumbnail that by then is exactly this
                      size in exactly this place, so the hand-off is a
                      cross-fade between two identical pictures. */}
                    <motion.div
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      className="nmp-shot__layer"
                      custom={direction}
                      exit={{
                        opacity: 0,
                        x: reduce ? 0 : direction * -40,
                        scale: reduce ? 1 : 1.02,
                      }}
                      initial={
                        arriving
                          ? { opacity: 0, x: 0, scale: 1 }
                          : {
                              opacity: 0,
                              x: reduce ? 0 : direction * 40,
                              scale: reduce ? 1 : 1.02,
                            }
                      }
                      key={shot}
                      transition={
                        arriving
                          ? {
                              opacity: {
                                delay: FLIGHT - HANDOFF,
                                duration: HANDOFF - SETTLE,
                              },
                            }
                          : {
                              /* Quicker while a copy of the OUTGOING photograph
                                 is on its way back to the rail. The picture
                                 still fading out underneath is that same
                                 photograph — left to fade for three quarters of
                                 a second it is visibly in two places at once.
                                 This layer paints over it, so the fix is to
                                 cover the frame before that reads. */
                              duration: reduce ? 0 : sending ? 0.36 : 0.72,
                              ease: EASE_OUT,
                            }
                      }
                    >
                      <ProductFrame
                        alt={`${piece.name} — view ${shot + 1} of ${total}`}
                        frame={shots[shot]}
                        instant
                      />
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              </div>

              <span className="nmp-shot__flags">
                {piece.soldOut ? (
                  <span className="nmp-flag nmp-flag--sold">Sold out</span>
                ) : (
                  piece.isNew && <span className="nmp-flag">New</span>
                )}
              </span>

              {/* Outside the drag surface, never inside it: in there every
                  press would first be read as the start of a drag. */}
              <div className="nmp-shot__nav">
                <button
                  aria-label="Previous view"
                  className="nmp-round nmp-round--onShot"
                  onClick={() => step(-1)}
                  type="button"
                >
                  <ChevronLeft aria-hidden size={16} />
                </button>
                <button
                  aria-label="Next view"
                  className="nmp-round nmp-round--onShot"
                  onClick={() => step(1)}
                  type="button"
                >
                  <ChevronRight aria-hidden size={16} />
                </button>
              </div>
            </div>

            <p className="nmp-shot__hint">
              Tap to enlarge · drag, or use the arrows
            </p>
          </div>

          {/* ------------------------------------------------------ rail */}
          <div className="nmp-hero__rail">
            {total > 1 && (
              <>
                <p className="nh-eyebrow nmp-rail__lede">Up next</p>

                {/* The queue, as a funnel. It holds what has NOT been seen yet:
                    the photograph currently in the frame is deliberately absent,
                    because a thumbnail of the picture already filling half the
                    page is the one crop in the run that tells a shopper nothing.
                    What is left is ordered by how soon it arrives — the next
                    shot at full size, each one after it a step smaller — so the
                    rail reads as a flow toward the frame rather than as four
                    equal tiles with one of them ringed. */}
                <div className="nmp-rail__viewport">
                  <div className="nmp-rail__track" ref={railRef}>
                    {/* Each thumb is keyed by the PHOTOGRAPH, not by its place
                        in the queue — that is what lets one element travel from
                        the narrow end of the funnel to the wide end over
                        several advances without being torn down and reloaded on
                        the way. The stylesheet gives it a width per position;
                        `layout` animates the change.

                        `layout` rather than a CSS width transition, for two
                        reasons. It animates as a transform, so a queue moving
                        under a photograph the shopper is looking at costs no
                        reflow per frame. And with `popLayout` the shot that has
                        just gone into the frame is dropped from the flow the
                        moment it leaves, so the rest slide up a size against
                        nothing — where a width transition would have to squeeze
                        it to zero on the way out, cropping the photograph
                        tighter and tighter as it went. */}
                    <AnimatePresence initial={false} mode="popLayout">
                      {queue.map((index, position) => {
                        /* True while this thumbnail's photograph is on its way
                           BACK from the frame to this slot. It has to stay
                           invisible until that copy lands on it, or the queue
                           shows the picture arriving before the thing the
                           shopper is watching has finished arriving. */
                        const landing =
                          flight?.mode === "out" && flight.index === index;

                        return (
                          /* Not `role="tab"`: these no longer only switch a
                             panel, they open the full-screen viewer, and a tab
                             that opens a dialog is a lie to anything reading
                             the roles. A plain button is what it is. */
                          <motion.button
                            animate={{ opacity: fade(position) }}
                            aria-haspopup="dialog"
                            aria-label={`View photograph ${index + 1} of ${total} full screen`}
                            className="nmp-thumb"
                            /* how far down the queue it is — the stylesheet sizes
                             it from this, and 0 is the shot arriving next */
                            data-pos={position}
                            /* which photograph this is, for the launch to find */
                            data-shot={index}
                            /* Out fast. This thumb is only ever dropped because
                             its photograph is now on its way to the frame, and
                             the copy in flight launches from this exact box —
                             a slow fade here would leave the original sitting
                             under it, visibly being left behind. */
                            exit={{
                              opacity: 0,
                              transition: { duration: 0.16 },
                            }}
                            initial={{ opacity: 0 }}
                            key={index}
                            layout={!reduce}
                            /* A press here is a request to SEE this photograph,
                             and full screen is the fullest answer to that — so
                             the viewer opens, and the gallery is moved on
                             underneath it so closing it lands on what was being
                             looked at. No flight: it would spend its whole
                             half-second behind the dialog that just opened. */
                            onClick={() => {
                              setViewer(index);
                              setDirection(index >= shot ? 1 : -1);
                              setShot(index);
                            }}
                            transition={{
                              duration: reduce ? 0 : 0.62,
                              ease: EASE_OUT,
                              /* held back until the copy in the air lands here,
                               then brought up under it on the same hand-off the
                               frame uses in the other direction */
                              ...(landing
                                ? {
                                    opacity: {
                                      delay: FLIGHT - HANDOFF,
                                      duration: HANDOFF - SETTLE,
                                    },
                                  }
                                : null),
                            }}
                            type="button"
                            /* The queue dims with distance; pointing at one
                               brings it back to full, wherever it sits. Not
                               while a copy is still landing on it, though —
                               hover would overrule the hold and show the
                               thumbnail before the thing flying to it arrives,
                               which is the one moment two of the same
                               photograph would be on screen at once. */
                            whileHover={landing ? undefined : { opacity: 1 }}
                          >
                            <ProductFrame alt="" frame={shots[index]} instant />
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </>
            )}

            <div className="nmp-rail__count">
              <span>{pad(shot + 1)}</span>
              <span aria-hidden className="nmp-rail__bar">
                <span
                  className="nmp-rail__fill"
                  style={{ width: `${((shot + 1) / total) * 100}%` }}
                />
              </span>
              <span>{pad(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ flight */}
      {/* The photograph in the air, drawn at the page root rather than anywhere
          in the hero. Every box it would otherwise travel inside clips its
          overflow — the rail's viewport so the queue can bleed past the gutter,
          the frame so a dragged photograph cannot spill out of it — and a
          picture crossing the page between the two would spend the whole
          journey cut off inside one or the other. Out there nothing clips it.

          It is `aria-hidden` and takes no pointer: both ends of the flight are
          real controls that already answer for it. */}
      {flight &&
        createPortal(
          <motion.div
            animate={{
              x: flight.to.left,
              y: flight.to.top,
              width: flight.to.width,
              height: flight.to.height,
              /* the corners belong to whichever box it is becoming */
              borderRadius: flight.mode === "in" ? FRAME_RADIUS : THUMB_RADIUS,
            }}
            aria-hidden
            /* `nmp` as well as `nmp-fly`: the portal lands outside this page's
               own root, and that class is where the page declares the glass
               values its frames are drawn with */
            className="nmp nmp-fly"
            initial={{
              x: flight.from.left,
              y: flight.from.top,
              width: flight.from.width,
              height: flight.from.height,
              borderRadius: flight.mode === "in" ? THUMB_RADIUS : FRAME_RADIUS,
            }}
            /* keyed by the journey, not the picture: a flight the other way is
               a different element, never the same one re-aimed mid-air */
            key={`${flight.mode}-${flight.index}`}
            /* the far end owns the picture from here; this copy is done */
            onAnimationComplete={() => setFlight(null)}
            transition={{ duration: FLIGHT, ease: EASE_OUT }}
          >
            <ProductFrame alt="" frame={shots[flight.index]} instant />
          </motion.div>,
          flight.host,
        )}

      {/* The viewer drives `shot` while it is open, so closing it leaves the
          hero on the photograph that was last being looked at rather than
          snapping back to whichever one opened it. */}
      <AnimatePresence>
        {viewer !== null && (
          <ImageViewer
            frames={shots}
            index={viewer}
            key="viewer"
            name={piece.name}
            onClose={() => setViewer(null)}
            onIndexChange={(next) => {
              setViewer(next);
              goTo(next, next >= shot ? 1 : -1);
            }}
          />
        )}
      </AnimatePresence>

      {/* The guide knows what has been chosen, so it can mark that row, and can
          hand a size back — a shopper who works out they are an L in a table is
          being asked to find it again in the picker for no reason. */}
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
    </section>
  );
}

/* How far each step down the queue recedes. The width ratio is the stylesheet's
   (`.nmp-thumb[data-pos]`); this is its pair for opacity, kept here because the
   thumbs' opacity is animated rather than transitioned — see the rail. Rounded,
   because this figure is server-rendered into every thumb's style attribute and
   the third power of 0.7 is otherwise seventeen decimal places of float. */
const FADE = 0.7;
const fade = (position: number) => Number((FADE ** position).toFixed(3));

/** ten points on a circle, phase-shifted so a flat edge sits at the top */
const DECAGON = Array.from({ length: 10 }, (_, i) => {
  const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2 + Math.PI / 10;
  return `${(50 + 48 * Math.cos(angle)).toFixed(2)},${(50 + 48 * Math.sin(angle)).toFixed(2)}`;
}).join(" ");

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The headline's two cuts.
 *
 * Every display headline in this theme is one sentence split across a heavy cut
 * and a light extended one (§3.2 of the design system), so a product name
 * changes cut after its first word. There is no line break in it — the name
 * wraps where the column runs out, which keeps a two-word piece and a four-word
 * one on the same left edge instead of breaking both after word one.
 */
function titleSegments(name: string) {
  const [first, ...rest] = name.split(" ");
  if (rest.length === 0) return [{ text: name }];
  return [{ text: `${first} ` }, { text: rest.join(" "), light: true }];
}
