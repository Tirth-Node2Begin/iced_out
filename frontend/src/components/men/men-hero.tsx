"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

import { EASE_OUT } from "@/components/new-home/motion-primitives";
import { useGenderPieces } from "@/components/gender/use-pieces";
import {
  HERO,
  HERO_GARMENTS,
  TURNTABLE,
  type HeroGarment,
} from "@/components/men/data";
/* The shared reduced-motion multiplier. It lives under the women's folder
   because that floor needed it first; it is department-neutral, and importing
   it is what keeps one implementation of a rule both floors depend on. */
import { useMotionScale } from "@/components/new-woman/use-motion-scale";

/**
 * Load choreography.
 *
 * Read in the order the stage is meant to be taken: the floor is laid, the
 * light comes up, the garment arrives and stands in it, the wordmark rises
 * either side, and only then is the rig drawn over the piece — the measured
 * width, then the callouts, each a beat after the last, the way an instrument
 * settles rather than the way a page loads.
 */
const T = {
  floor: 0.08,
  glow: 0.12,
  garment: 0.2,
  word: 0.38,
  dim: 0.8,
  callouts: 0.94,
  kicker: 1.08,
  foot: 1.16,
} as const;

/**
 * The rig: a measured width and two leader lines.
 *
 * Everything is positioned in percentages of the GARMENT's own box rather than
 * of the screen, so the rig cannot drift off the piece at any width. It is
 * re-keyed on the garment, so a swap redraws it — the figures belong to the
 * piece, not to the stage.
 *
 * A viewfinder of four corner brackets framed the garment in an earlier pass
 * and has been removed: it read as a camera overlay sitting on the photograph
 * rather than as anything to do with the clothes.
 */
function Rig({ garment, reduce }: { garment: HeroGarment; reduce: boolean | null }) {
  return (
    <div aria-hidden className="men-hero__rig">
      {/* The measured width. The rule is drawn out from its middle — a
          dimension line is struck from the centre, not slid in from one end. */}
      <div className="men-hero__dim">
        <motion.span
          animate={{ scaleX: 1, opacity: 1 }}
          className="men-hero__dimRule"
          initial={{ scaleX: 0, opacity: 0 }}
          transition={{
            duration: reduce ? 0.25 : 0.8,
            delay: reduce ? 0 : T.dim,
            ease: EASE_OUT,
          }}
        />
        <motion.span
          animate={{ opacity: 1 }}
          className="men-hero__dimLabel"
          initial={{ opacity: 0 }}
          transition={{
            duration: 0.45,
            delay: reduce ? 0 : T.dim + 0.28,
            ease: EASE_OUT,
          }}
        >
          {garment.dimension}
        </motion.span>
      </div>

      {/* The callouts. The dot lands first, then its line runs out from the dot
          — `transform-origin` is set on the side the line grows FROM, so it
          extends away from the garment rather than towards it. */}
      {garment.callouts.map((callout, index) => {
        const delay = T.callouts + index * 0.12;

        return (
          <motion.span
            animate={{ opacity: 1 }}
            className={`men-hero__callout men-hero__callout--${callout.side}`}
            initial={{ opacity: 0 }}
            key={callout.id}
            style={
              callout.side === "left"
                ? { left: "auto", right: `${100 - callout.x}%`, top: `${callout.y}%` }
                : { left: `${callout.x}%`, top: `${callout.y}%` }
            }
            transition={{ duration: 0.4, delay: reduce ? 0 : delay, ease: EASE_OUT }}
          >
            <span className="men-hero__calloutDot" />
            <motion.span
              animate={{ scaleX: 1 }}
              className="men-hero__calloutLine"
              initial={{ scaleX: 0 }}
              transition={{
                duration: reduce ? 0.2 : 0.5,
                delay: reduce ? 0 : delay + 0.08,
                ease: EASE_OUT,
              }}
            />
            <motion.span
              animate={{ opacity: 1, x: 0 }}
              className="men-hero__calloutLabel"
              initial={{
                opacity: 0,
                x: reduce ? 0 : callout.side === "left" ? 10 : -10,
              }}
              transition={{
                duration: 0.5,
                delay: reduce ? 0 : delay + 0.24,
                ease: EASE_OUT,
              }}
            >
              <span className="men-hero__calloutKey">{callout.key}</span>
              <span className="men-hero__calloutValue">{callout.value}</span>
            </motion.span>
          </motion.span>
        );
      })}
    </div>
  );
}

/**
 * 01 — the men's hero.
 *
 * The house stage, as the root and /new-woman both build it: one dark
 * full-bleed screen, a single cut-out garment centred and lit from behind, the
 * wordmark split either side of it, the furniture pinned to the corners. A
 * department arriving in some other layout would read as a different site, so
 * the composition is deliberately the shared one.
 *
 * What is this floor's own: the piece stands on a perspective floor grid rather
 * than in a beam or a burst, a rig is drawn over it giving its measured width
 * and two points of construction, and the run CYCLES — with the glow behind the
 * garment flaring on the change, so the light is what does the switching.
 *
 * Everything on the stage is decorative and marked so: the heading a screen
 * reader gets is a plain sentence naming the page (`HERO.title`), exactly as
 * the root's hero states "Iced Out" behind its flying wordmark.
 */
export function MenHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const scale = useMotionScale();

  const { pieces, loaded } = useGenderPieces("men");

  /* The run. A visitor who asked for less movement keeps whichever piece the
     stage opened on. */
  const [index, setIndex] = useState(0);
  const garment = HERO_GARMENTS[index % HERO_GARMENTS.length];

  useEffect(() => {
    if (reduce || HERO_GARMENTS.length < 2) return;

    const hold = window.setTimeout(() => {
      setIndex((value) => (value + 1) % HERO_GARMENTS.length);
    }, TURNTABLE.holdMs);

    return () => window.clearTimeout(hold);
  }, [index, reduce]);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  /* Three rates, so the stage comes apart in depth as it leaves: the wordmark
     travels furthest because it reads as nearest, the garment less, and the
     floor drifts the other way. Every distance is multiplied by the motion
     scale, which is 0 for a visitor who asked for less movement — see
     `useMotionScale` for why that is not a branch on the style prop. */
  const wordY = useTransform(scrollYProgress, [0, 1], [0, -150 * scale]);
  const garmentY = useTransform(scrollYProgress, [0, 1], [0, -70 * scale]);
  const floorY = useTransform(scrollYProgress, [0, 1], [0, 50 * scale]);
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  /* Read off the same set the grid below will draw. Until the catalogue
     answers both show a dash rather than a zero: "0 pieces live" is a claim
     about the shop, and it is the wrong one. */
  const figures = {
    pieces: loaded ? String(pieces.length).padStart(2, "0") : "—",
    collections: loaded
      ? String(
          new Set(pieces.map((piece) => piece.collection).filter(Boolean)).size,
        ).padStart(2, "0")
      : "—",
  };

  return (
    <section className="men-hero" ref={ref}>
      <div aria-hidden className="men-hero__field" />

      <motion.div aria-hidden className="men-hero__floor" style={{ y: floorY }}>
        <motion.div
          animate={{ opacity: 1 }}
          className="men-hero__floorPlane"
          initial={{ opacity: 0 }}
          transition={{
            duration: reduce ? 0.3 : 1.4,
            delay: T.floor,
            ease: EASE_OUT,
          }}
        />
      </motion.div>

      {/* The page's actual heading. The stage below it is a picture. */}
      <h1 className="sr-only">{HERO.title}</h1>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="men-hero__kicker"
        initial={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.6, delay: T.kicker, ease: EASE_OUT }}
      >
        <p className="men-kicker">{HERO.kicker}</p>
      </motion.div>

      <div className="men-hero__stage">
        {/* The wordmark, behind the garment on purpose — the inner edge of each
            half is meant to be cut off by the silhouette. */}
        <motion.div
          aria-hidden
          className="men-hero__word"
          style={{ y: wordY, opacity: fade }}
        >
          {HERO.split.map((half, halfIndex) => (
            <span className="men-hero__half" key={half}>
              <motion.span
                animate={{ y: "0%", opacity: 1 }}
                className="men-hero__halfInner"
                initial={{ y: "108%", opacity: 0.001 }}
                transition={{
                  duration: reduce ? 0.3 : 0.9,
                  delay: reduce ? 0 : T.word + halfIndex * 0.1,
                  ease: EASE_OUT,
                }}
              >
                {half}
              </motion.span>
            </span>
          ))}
        </motion.div>

        {/* Two nested elements, one transform each: the outer takes the scroll
            drift and the inner the entrance. Sharing them on one element means
            the last one written wins and the other silently stops. */}
        <motion.div className="men-hero__garment" style={{ y: garmentY }}>
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            initial={{ opacity: 0, scale: 0.94, y: 26 }}
            transition={{
              duration: reduce ? 0.35 : 0.95,
              delay: T.garment,
              ease: EASE_OUT,
            }}
          >
            {/* The light, and the thing that performs the swap. Re-keyed on the
                garment so every change replays the flare: it brightens and
                widens as the outgoing piece leaves, then settles as the new one
                lands. Keeping it OUTSIDE the swap layers is what lets it span
                the handover rather than leaving with either piece. */}
            <motion.span
              animate={
                reduce
                  ? { opacity: 1, scale: 1 }
                  : { opacity: [0.55, 1, 0.82], scale: [0.96, 1.1, 1] }
              }
              aria-hidden
              className="men-hero__glow"
              initial={{ opacity: 0, scale: 0.9 }}
              key={garment.id}
              transition={{
                duration: reduce ? 0.3 : 1.5,
                delay: index === 0 ? T.glow : 0,
                ease: EASE_OUT,
              }}
            />

            {/* The bob. A third transform on a third element — the outer takes
                the scroll drift, the middle the entrance, this the endless
                float. The rig rides inside it so the instrument travels with
                the piece instead of the piece drifting out from under it. */}
            <motion.div
              animate={reduce ? undefined : { y: [0, -10, 0] }}
              className="men-hero__float"
              transition={{ duration: 6.2, ease: "easeInOut", repeat: Infinity }}
            >
              {/* The swap. The outgoing piece lifts and dims while the incoming
                  one rises into place under the same flare of light, so the two
                  are never simply cross-faded on the spot. */}
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="men-hero__layer"
                  exit={{ opacity: 0, y: -22, scale: 0.97 }}
                  initial={{ opacity: 0, y: 26, scale: 1.03 }}
                  key={garment.id}
                  transition={{
                    duration: reduce ? 0.25 : TURNTABLE.swapSeconds,
                    ease: EASE_OUT,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={garment.alt}
                    className="men-hero__garmentImg"
                    decoding="async"
                    draggable={false}
                    src={garment.src}
                  />
                  <span aria-hidden className="men-hero__contact" />
                  <Rig garment={garment} reduce={reduce} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="men-hero__foot"
        initial={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.75, delay: T.foot, ease: EASE_OUT }}
      >
        <div className="men-hero__aside">
          <p className="men-hero__lede">{HERO.lede}</p>

          <ul className="men-hero__ledger">
            {HERO.ledger.map((entry) => (
              <li className="men-hero__stat" key={entry.key}>
                <span className="men-hero__statValue">{figures[entry.source]}</span>
                <span className="men-hero__statLabel">{entry.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="men-hero__ctas">
          {HERO.ctas.map((cta, ctaIndex) => (
            <Link
              className={`men-btn ${ctaIndex === 0 ? "men-btn--solid" : "men-btn--ghost"}`}
              href={cta.href}
              key={cta.href}
            >
              {cta.label}
              <span aria-hidden className="men-btn__arrow">
                <ArrowUpRight size={15} strokeWidth={1.6} />
              </span>
            </Link>
          ))}
        </div>

        <div className="men-hero__aside men-hero__aside--right">
          <p className="men-hero__spec">
            <span aria-hidden className="men-hero__specTick" />
            <span>
              {HERO.spec.map((line) => (
                <span className="men-hero__specLine" key={line}>
                  {line}
                </span>
              ))}
            </span>
          </p>
        </div>
      </motion.div>
    </section>
  );
}
