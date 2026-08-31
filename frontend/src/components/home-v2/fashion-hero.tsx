"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useHeroSlides } from "@/features/19b-home-hero/hooks/use-hero-slides";

import { HeroReviews } from "./hero-reviews";
import { DUR, EASE } from "./motion";

const TITLE_WORDS = ["ICED", "OUT"] as const;
const RAY_ANGLES = [-64, -48, -33, -19, 19, 33, 48, 64] as const;

/**
 * The garments that fly through this hero, when nobody has chosen any.
 *
 * They used to be the whole answer — three PNGs compiled into the bundle, which
 * made the first thing anybody sees of this shop the one thing an operator
 * could not change. The console owns that decision now (`/admin/home/hero`) and
 * these are what shows until it has been used: a floor, not a placeholder.
 *
 * They stay bundled art rather than seeded rows on purpose. A hero with nothing
 * in it does not degrade — it plays the rays and the headline around a hole in
 * the middle of the screen — so the fallback has to be reachable with no
 * database, no network and no settings, which a build-time import is and a seed
 * is not.
 */
const HERO_FALLBACK = [
  {
    alt: "Black ICED OUT hoodie ghost mannequin cutout",
    src: "/images/generated/ghost-products/ghost-hoodie.png",
    href: "",
  },
  {
    alt: "Cream ICED OUT knit polo sweater ghost mannequin cutout",
    src: "/images/generated/ghost-products/ghost-knit.png",
    href: "",
  },
  {
    alt: "Navy and cream ICED OUT varsity jacket ghost mannequin cutout",
    src: "/images/generated/ghost-products/ghost-varsity.png",
    href: "",
  },
] as const;

/** One garment, however it arrived — from the console or from the bundle. */
type HeroGarment = { src: string; alt: string; href: string };

/**
 * The capture starts the incoming garment a shade after the outgoing one begins
 * to leave, so the two overlap for most of the exit rather than trading places.
 * Named because the swap timer below has to account for it too.
 */
const ENTER_DELAY = 0.08;

/** How long the garment stands still in the centre, once it has landed. */
const HOLD_MS = 3000;

/**
 * The timer runs from the moment a swap starts, not from the moment the new
 * garment lands, so it has to carry the sweep as well as the hold. Setting it
 * to HOLD_MS alone would eat the travel out of the pause and leave the garment
 * still for closer to 2.4s.
 */
const SWAP_INTERVAL_MS = HOLD_MS + (ENTER_DELAY + DUR.swap) * 1000;

/**
 * One garment's picture, drawn the way its source requires.
 *
 * A bundled garment has a path the build knows about, so it goes through
 * `next/image` exactly as this hero always has — `fill`, `sizes`, and the
 * priority hint on the first frame. A garment chosen in the console is a
 * runtime `/api/v1/media/...` URL, which the static export's image optimiser
 * has no build-time way to resolve, so it is a plain `<img>` carrying the same
 * class plus the geometry `fill` would otherwise have supplied.
 *
 * The two are kept in one component rather than branched at each call site
 * because the hero draws a garment twice — the one flying and the one parked in
 * the corner — and those two have to stay pixel-identical for the handoff
 * between them to read as one object leaving the corner.
 */
function GarmentImage({
  bundled,
  garment,
  priority,
  sizes,
}: {
  bundled: boolean;
  garment: HeroGarment;
  priority?: boolean;
  sizes: string;
}) {
  if (bundled) {
    return (
      <Image
        alt={garment.alt}
        className="hv2-fashion-hero__productImage"
        fill
        priority={priority}
        sizes={sizes}
        src={garment.src}
      />
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      alt={garment.alt}
      className="hv2-fashion-hero__productImage hv2-fashion-hero__productImage--raw"
      src={garment.src}
    />
  );
}

export function FashionHero() {
  const reduce = useReducedMotion();
  const [productIndex, setProductIndex] = useState(0);
  /**
   * What the console chose, or the bundled run until it has chosen anything.
   *
   * `usingFallback` decides how each picture is DRAWN, not whether there is
   * one: a bundled garment has a build-time path the export's image optimiser
   * can resolve, and a console garment is a runtime URL it has never seen. Same
   * box, two different elements — see `GarmentImage` above.
   */
  const { slides, usingFallback } = useHeroSlides(HERO_FALLBACK);
  const run: HeroGarment[] = slides.map((slide) => ({
    src: "src" in slide ? slide.src : slide.image,
    alt: slide.alt,
    href: slide.href,
  }));

  /* The run can shrink underneath the timer — an operator hiding a garment
     while somebody is looking at the home page — so the index is folded rather
     than trusted, and everything below reads the folded one. */
  const at = run.length === 0 ? 0 : productIndex % run.length;
  const currentProduct = run[at] ?? HERO_FALLBACK[0];
  const nextProduct = run[(at + 1) % run.length] ?? HERO_FALLBACK[0];

  useEffect(() => {
    /* Nothing to swap to. A run of one would otherwise remount the same garment
       every four seconds, replaying the sweep against itself. */
    if (run.length < 2) return;

    const timer = window.setTimeout(() => {
      setProductIndex((value) => (value + 1) % run.length);
    }, SWAP_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [productIndex, run.length]);

  const lift = reduce ? 0 : 24;
  const entry: Variants = {
    hidden: { opacity: 0, y: lift },
    show: (delay = 0) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: reduce ? 0.3 : DUR.reveal,
        delay: reduce ? 0 : delay,
        ease: EASE,
      },
    }),
  };
  /**
   * The swap sweep. The way IN is traced frame by frame from ref.mp4 at 30fps;
   * the way OUT is not, and deliberately so — see `exit` below.
   *
   * One garment lifts out of the bottom-right corner at roughly a third size,
   * runs up and to the left into the centre, and holds. In the capture it then
   * carries on up-left and leaves past the top edge, upright the whole way.
   * This build leaves differently: it turns to its left where it stands and
   * flies off sideways.
   *
   * The `times` arrays carry the easing instead of a bezier. The capture's
   * position curve was sampled at seven points on the way in, so interpolating
   * those samples linearly replays the reference deceleration rather than
   * approximating it. The horizontal leg leads on the way in, which is what
   * bends the straight line into the arc.
   *
   * Offsets are percentages of the product box, converted from the capture's
   * viewport-relative measurements: the garment centre sits at (46.5%, 48.5%)
   * of the frame at rest, starts from (93%, 86.5%) at 0.36 scale, and leaves
   * through (29%, 6%) at 0.64. The horizontal reach is pulled in from the
   * measured 111% to 90% because this hero is far taller than the capture's
   * 1.83 frame, and the raw figure would start the garment off-screen.
   *
   * The starting scale is the one figure since taken off the capture: 0.3 rather
   * than the measured 0.36, so the parked thumbnail sits quieter in its corner.
   * It is only the FIRST sample of the way in, so the sweep still lands at 1 —
   * the garment simply has a little further to grow. `.hv2-fashion-hero__next`
   * carries the same number and the two must be changed together, or the
   * handoff stops reading as one object leaving the corner.
   */
  const productOrbit: Variants = reduce
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1, transition: { duration: 0.2, ease: EASE } },
        exit: { opacity: 0, transition: { duration: 0.18, ease: EASE } },
      }
    : {
        /* Opens already opaque and already sharp, because something is
           standing in this exact pose the instant before: the corner thumbnail
           in `.hv2-fashion-hero__next`, which unmounts as this mounts. Fading
           or unblurring in from here would read as the parked garment blinking
           out and back rather than lifting off, so the handoff has to be
           pixel-for-pixel. Nothing about opacity or blur belongs on the way in
           — only on the way out, where there is nothing to hand off to. */
        enter: {
          opacity: 1,
          x: "90%",
          y: "40%",
          scale: 0.3,
        },
        center: {
          x: ["90%", "63%", "43%", "29%", "11%", "1.5%", "0%"],
          y: ["40%", "29%", "21%", "16%", "7%", "2%", "0%"],
          scale: [0.3, 0.55, 0.7, 0.8, 0.93, 0.99, 1],
          transition: {
            duration: DUR.swap,
            delay: ENTER_DELAY,
            times: [0, 0.134, 0.266, 0.4, 0.6, 0.866, 1],
            ease: "linear",
          },
        },
        /**
         * Turn, THEN go. Two beats, and the first one does not travel at all.
         *
         * BEAT ONE — `times` 0 → 0.34, about 170ms. The garment pivots
         * anti-clockwise on the spot: `x` and `y` are pinned at "0%" across
         * both keyframes, opacity stays 1 and blur stays 0. Nothing but the
         * rotation changes, so what the eye gets is unambiguously a turn.
         *
         * An earlier pass let `x` creep to -3% during this beat, reasoning that
         * 3% is nothing. It is not nothing — the product box is far wider than
         * the garment, so 3% measured ~68px on a 1280 viewport and the turn read
         * as a drift with a tilt on it rather than as a pivot. Hence the pin.
         *
         * The pivot is about the garment's own optical centre, not the box's:
         * `.hv2-fashion-hero__productSwap` sets `transform-origin: 50% 55%`,
         * and that 55% is what keeps a hanging garment turning on its middle
         * instead of swinging by its collar.
         *
         * BEAT TWO — from that turned position it sweeps out to the left,
         * carrying the rotation a little further as it shrinks and blurs. `x`
         * runs to -130% so the piece is fully clear of its box before opacity
         * reaches zero; finishing the fade early would let it blink out
         * mid-flight.
         *
         * `y` drifts down only 12%, and only in beat two. The reference sends
         * the garment up and out through the top edge; leaving near level is
         * what makes this read as sideways rather than as being lifted away.
         *
         * 0.5s against the 0.24s this replaces, because a turn that nobody can
         * see is not a turn. Still inside the incoming garment's landing at
         * ENTER_DELAY + DUR.swap (0.58s), so the two overlap exactly as they
         * always have — that margin is the ceiling on how slow this may get.
         */
        exit: {
          opacity: [1, 1, 0.97, 0.76, 0.36, 0],
          rotate: [0, -22, -26, -30, -33, -35],
          x: ["0%", "0%", "-12%", "-50%", "-92%", "-130%"],
          y: ["0%", "0%", "2%", "5%", "9%", "12%"],
          scale: [1, 1, 0.97, 0.89, 0.79, 0.7],
          filter: [
            "blur(0px)",
            "blur(0px)",
            "blur(1.5px)",
            "blur(4px)",
            "blur(8px)",
            "blur(12px)",
          ],
          transition: {
            duration: 0.5,
            times: [0, 0.34, 0.48, 0.7, 0.87, 1],
            ease: "linear",
          },
        },
      };

  return (
    <section className="hv2-fashion-hero" id="top" aria-labelledby="home-hero-heading">
      <div className="hv2-fashion-hero__field" aria-hidden />
      <div aria-hidden className="hv2-fashion-hero__rayClip">
        <div className="hv2-fashion-hero__rays">
          {RAY_ANGLES.flatMap((angle, index) =>
            [angle, 180 - angle].map((deg) => (
              <motion.span
                animate={{ opacity: 1, scaleX: 1 }}
                className="hv2-fashion-hero__ray"
                initial={{ opacity: 0, scaleX: reduce ? 1 : 0.2 }}
                key={deg}
                style={{ rotate: `${deg}deg` }}
                transition={{
                  duration: reduce ? 0.3 : 1.4,
                  delay: reduce ? 0 : 0.65 + index * 0.05,
                  ease: EASE,
                }}
              />
            )),
          )}
        </div>
      </div>
      <h1 className="sr-only" id="home-hero-heading">
        Iced Out
      </h1>

      <motion.div
        animate="show"
        aria-hidden
        className="hv2-fashion-hero__title"
        initial="hidden"
      >
        {TITLE_WORDS.map((word, index) => (
          <span className="hv2-fashion-hero__titleMask" key={word}>
            <motion.span
              animate={{ opacity: 1, y: "0%" }}
              initial={{ opacity: 0.001, y: reduce ? "0%" : "108%" }}
              transition={{
                duration: reduce ? 0.3 : DUR.strip,
                delay: reduce ? 0 : 0.06 + index * 0.1,
                ease: EASE,
              }}
            >
              {word}
            </motion.span>
          </span>
        ))}
      </motion.div>

      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="hv2-fashion-hero__product"
        initial={{ opacity: 0, scale: reduce ? 1 : 0.92, y: reduce ? 0 : 30 }}
        transition={{ duration: reduce ? 0.35 : 0.9, delay: reduce ? 0 : 0.28, ease: EASE }}
      >
        <span className="hv2-fashion-hero__productAura" aria-hidden />
        <motion.div
          animate={reduce ? undefined : { y: [0, -10, 0] }}
          className="hv2-fashion-hero__productFloat"
          transition={{ duration: 5.4, ease: "easeInOut", repeat: Infinity }}
        >
          <AnimatePresence initial={false}>
            <motion.div
              animate="center"
              className="hv2-fashion-hero__productSwap"
              exit="exit"
              initial="enter"
              key={currentProduct.src}
              variants={productOrbit}
            >
              <GarmentImage
                bundled={usingFallback}
                garment={currentProduct}
                priority={at === 0}
                sizes="(max-width: 720px) 76vw, 38vw"
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
        {/* The capture parks the next garment in the bottom-right corner at
            thumbnail size, and that thumbnail is the thing that lifts off and
            flies in on the next swap. It is pinned to the sweep's own starting
            pose in CSS rather than placed by eye, so the two read as one object
            leaving the corner instead of a second one appearing beside it.
            Re-keying on the source remounts it, which replays the fade.

            Drawn only when there IS a next garment: a run of one has nothing to
            queue, and parking it anyway puts the same piece on screen twice —
            once in the middle and once in the corner — which reads as a
            duplicate rather than as what is coming. */}
        {run.length > 1 && (
          <motion.div
            animate={{ opacity: 1 }}
            aria-hidden
            className="hv2-fashion-hero__next"
            initial={{ opacity: 0 }}
            key={nextProduct.src}
            transition={{
              /* The corner stands empty for a beat after a garment leaves it, as
                 in the capture, rather than restocking the instant it goes. */
              delay: reduce ? 0 : 0.3,
              duration: reduce ? 0.2 : 0.45,
              ease: EASE,
            }}
          >
            <GarmentImage
              bundled={usingFallback}
              garment={{ ...nextProduct, alt: "" }}
              sizes="(max-width: 1040px) 14vw, 13vw"
            />
          </motion.div>
        )}
        {/* No link is drawn over the garment, and that is deliberate.
            `.hv2-fashion-hero__product` is a 48rem-tall absolutely positioned
            box set to `pointer-events: none`, precisely so it does not swallow
            clicks meant for what is behind it — and the garment inside it is
            `object-fit: contain`, so no element's box matches the painted
            silhouette. A full-box anchor would take back every click this hero
            gives away on purpose. The slide still carries its product (`href`
            on the payload) for a surface that can hit-test it honestly. */}
        <span className="hv2-fashion-hero__productShadow" aria-hidden />
      </motion.div>

      <motion.div
        animate="show"
        className="hv2-fashion-hero__buyWrap"
        custom={0.92}
        initial="hidden"
        variants={entry}
      >
        <Link className="hv2-fashion-hero__buy" href="/new-drop">
          Buy Now
        </Link>
      </motion.div>

      {/* Bottom left, opposite the parked garment. Last in the markup so a
          keyboard reaches the headline, the product and Buy Now before it —
          and so its popover, which opens upward, stacks over them. */}
      <motion.div
        animate="show"
        className="hv2-fashion-hero__reviews"
        custom={1.08}
        initial="hidden"
        variants={entry}
      >
        <HeroReviews />
      </motion.div>
    </section>
  );
}
