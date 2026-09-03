"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { EASE_OUT } from "@/components/new-home/motion-primitives";
import { useGenderPieces } from "@/components/gender/use-pieces";
import { HERO, HERO_GARMENTS, RAIL } from "@/components/men/data";
/* The shared reduced-motion multiplier. It lives under the women's folder
   because that floor needed it first; it is department-neutral, and importing
   it is what keeps one implementation of a rule both floors depend on. */
import { useMotionScale } from "@/components/new-woman/use-motion-scale";

const COUNT = HERO_GARMENTS.length;

/**
 * Load choreography.
 *
 * Read in the order the stage is meant to be taken: the floor is laid, the
 * light comes up, the rail arrives standing in it, the wordmark rises either
 * side, and the controls and the furniture land last.
 */
const T = {
  floor: 0.08,
  glow: 0.12,
  rail: 0.2,
  word: 0.4,
  controls: 0.92,
  kicker: 1.04,
  foot: 1.12,
} as const;

/**
 * Where a garment stands, given which one is currently centre.
 *
 * Returns -1, 0 or 1 — left flank, centre, right flank. With three pieces every
 * one of them is always in exactly one of those places, so the rail never has a
 * gap and never has two pieces in the same slot.
 */
function slotOf(index: number, active: number) {
  const rel = (index - active + COUNT) % COUNT;
  if (rel === 0) return 0;
  return rel === 1 ? 1 : -1;
}

/**
 * 01 — the men's hero, as a rail.
 *
 * The house stage — dark full-bleed screen, cut-out garments centred on it, the
 * wordmark split either side, furniture pinned to the corners — showing THREE
 * pieces instead of one. They stand on a single lineup: the centre piece large
 * and lit, the two either side smaller, dimmer and set further back on the same
 * floor.
 *
 * It advances on its own and stops the moment a shopper takes hold of it. The
 * glow behind the centre never moves — the rail slides through the stage's
 * light rather than carrying its own.
 *
 * Everything on the stage is decorative and marked so, except the controls: the
 * heading a screen reader gets is a plain sentence naming the page
 * (`HERO.title`), exactly as the root's hero states "Iced Out" behind its
 * flying wordmark.
 */
export function MenHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const scale = useMotionScale();

  const { pieces, loaded } = useGenderPieces("men");

  const [active, setActive] = useState(0);
  /**
   * Whether a shopper has taken hold of the rail.
   *
   * Once they have, it stops advancing on its own. A carousel that keeps moving
   * under someone who is driving it is the most irritating thing a hero can do,
   * and it is worse than one that simply stops.
   */
  const [driven, setDriven] = useState(false);

  const centre = HERO_GARMENTS[active];

  const go = useCallback((next: number) => {
    setDriven(true);
    setActive(((next % COUNT) + COUNT) % COUNT);
  }, []);

  useEffect(() => {
    if (reduce || driven || COUNT < 2) return;

    const hold = window.setTimeout(() => {
      setActive((value) => (value + 1) % COUNT);
    }, RAIL.holdMs);

    return () => window.clearTimeout(hold);
  }, [active, driven, reduce]);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  /* Three rates, so the stage comes apart in depth as it leaves: the wordmark
     travels furthest because it reads as nearest, the rail less, and the floor
     drifts the other way. Every distance is multiplied by the motion scale,
     which is 0 for a visitor who asked for less movement — see
     `useMotionScale` for why that is not a branch on the style prop. */
  const wordY = useTransform(scrollYProgress, [0, 1], [0, -150 * scale]);
  const railY = useTransform(scrollYProgress, [0, 1], [0, -70 * scale]);
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
        {/* The wordmark, behind the rail on purpose — the inner edge of each
            half is meant to be cut off by the centre piece's silhouette. */}
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
        <motion.div className="men-hero__rail" style={{ y: railY }}>
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            initial={{ opacity: 0, scale: 0.94, y: 26 }}
            style={{ height: "100%", position: "relative" }}
            transition={{
              duration: reduce ? 0.35 : 0.95,
              delay: T.rail,
              ease: EASE_OUT,
            }}
          >
            {/* The stage's light. It never moves — the rail slides through it,
                which is what makes an advance read as the lineup travelling
                rather than three pictures shuffling. Re-keyed on the centre
                piece so each move replays the flare. */}
            <motion.span
              animate={
                reduce
                  ? { opacity: 1, scale: 1 }
                  : { opacity: [0.6, 1, 0.85], scale: [0.97, 1.08, 1] }
              }
              aria-hidden
              className="men-hero__glow"
              initial={{ opacity: 0, scale: 0.92 }}
              key={centre.id}
              transition={{
                duration: reduce ? 0.3 : 1.4,
                delay: active === 0 && !driven ? T.glow : 0,
                ease: EASE_OUT,
              }}
            />

            {HERO_GARMENTS.map((garment, index) => {
              const slot = slotOf(index, active);
              const isCentre = slot === 0;

              return (
                <motion.button
                  animate={{
                    x: `${slot * RAIL.offset}%`,
                    scale: isCentre ? 1 : RAIL.flankScale,
                    opacity: isCentre ? 1 : RAIL.flankOpacity,
                    /* A flank sits BEHIND the wordmark, the centre piece in
                       front of it. At the same depth the two flanks painted
                       over the type and chopped "MENSWEAR" into three pieces;
                       this restores the clean split AND states the depth
                       properly — the far garments are behind the type, the
                       near one is in front. */
                    zIndex: isCentre ? 3 : 0,
                  }}
                  aria-current={isCentre ? "true" : undefined}
                  aria-label={isCentre ? garment.name : `Show ${garment.name}`}
                  className="men-hero__slot"
                  data-flank={isCentre ? undefined : ""}
                  disabled={isCentre}
                  key={garment.id}
                  onClick={() => go(index)}
                  transition={{
                    duration: reduce ? 0.2 : RAIL.slideSeconds,
                    ease: EASE_OUT,
                  }}
                  type="button"
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
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>

        {/* The rail's controls, and the centre piece named and measured. This
            is what is left of an earlier technical rig — the register survived,
            it just sits under the lineup now instead of being drawn over a
            garment. */}
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="men-hero__controls"
          initial={{ opacity: 0, y: 14 }}
          transition={{ duration: 0.7, delay: T.controls, ease: EASE_OUT }}
        >
          <div className="men-hero__nav">
            <button
              aria-label="Previous piece"
              className="men-hero__navBtn"
              onClick={() => go(active - 1)}
              type="button"
            >
              <ArrowLeft aria-hidden size={15} strokeWidth={1.6} />
            </button>

            {/* Announced, because the garment on the stage changes without the
                page navigating and a screen reader would otherwise get no word
                of it. */}
            <span aria-live="polite" className="men-hero__count">
              {String(active + 1).padStart(2, "0")} / {String(COUNT).padStart(2, "0")}
            </span>

            <button
              aria-label="Next piece"
              className="men-hero__navBtn"
              onClick={() => go(active + 1)}
              type="button"
            >
              <ArrowRight aria-hidden size={15} strokeWidth={1.6} />
            </button>
          </div>

          {/* The name leads and the measurement follows it quietly. Both were
              set at the same 10.5px caps, which left the composition with a
              208px wordmark, a 13px lede and nothing in between — so the one
              line that says WHAT IS ON THE STAGE read as a footnote. */}
          <p className="men-hero__name">
            {centre.name}
            <span aria-hidden className="men-hero__nameRule" />
            <span className="men-hero__nameSpec">{centre.chest}</span>
          </p>
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
