"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useRef } from "react";

import { EASE_OUT } from "@/components/new-home/motion-primitives";
import { useGenderPieces } from "@/components/gender/use-pieces";
import { HERO, HERO_GARMENT } from "@/components/new-woman/data";
import { Ribbon } from "@/components/new-woman/ribbon";
import { useMotionScale } from "@/components/new-woman/use-motion-scale";

/**
 * The fan, narrowed to its steepest arm.
 *
 * The root hero throws eight pairs across a half circle and reads as a
 * starburst. Three pairs at these angles read as one source directly overhead,
 * which is the light this stage is built around.
 */
const RAY_ANGLES = [-58, -34, -13] as const;

/**
 * Load choreography.
 *
 * Ordered the way the stage is meant to be read: the garment arrives first and
 * alone, the two words rise out of their masks around it, the wide word settles
 * in behind, the plinth is struck underneath, and only then does the furniture
 * appear. The root hero orders it the same way — subject, then wordmark, then
 * everything else — because on both pages the product is the headline.
 */
const T = {
  garment: 0.1,
  words: 0.3,
  ghost: 0.52,
  rays: 0.56,
  plinth: 0.66,
  kicker: 0.8,
  foot: 0.88,
} as const;

/**
 * 01 — the women's hero.
 *
 * The house stage: one dark full-bleed screen, a single cut-out garment lit
 * from behind, oversized type around it, the furniture pinned to the corners.
 * What this one does differently is layer the type FRONT TO BACK rather than
 * side to side — "Iced" and "Out" split at the garment's shoulders,
 * "Womenswear" runs edge to edge behind it, and the silhouette cuts into all
 * three. It stands on a lit plinth and casts a reflection, which nothing else
 * on the site does.
 *
 * Everything on the stage is decorative, and marked so: the heading a screen
 * reader gets is a plain sentence naming the page (`HERO.title`), exactly as
 * the root's hero states "Iced Out" behind its flying wordmark.
 */
export function WomanHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const scale = useMotionScale();

  /* The same set the grid further down will draw — womenswear only. */
  const { pieces, loaded } = useGenderPieces("women", { unisex: false });

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  /* Three rates, so the stage comes apart in depth as it leaves: the words
     travel furthest because they read as nearest, the garment less, and the
     wide word behind it drifts the other way. Every distance is multiplied by
     the motion scale, which is 0 for a visitor who asked for less movement —
     see `useMotionScale` for why that is not a branch on the style prop. */
  const wordsY = useTransform(scrollYProgress, [0, 1], [0, -150 * scale]);
  const garmentY = useTransform(scrollYProgress, [0, 1], [0, -80 * scale]);
  const ghostY = useTransform(scrollYProgress, [0, 1], [0, 60 * scale]);
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  /* Both ledger figures, read off the same set the grid will draw. Until the
     catalogue answers they show a dash rather than a zero: "0 pieces live" is a
     claim about the shop, and it is the wrong one. */
  const figures = {
    pieces: loaded ? String(pieces.length).padStart(2, "0") : "—",
    collections: loaded
      ? String(
          new Set(pieces.map((piece) => piece.collection).filter(Boolean)).size,
        ).padStart(2, "0")
      : "—",
  };

  return (
    <>
      <section className="nw-hero" ref={ref}>
        <div aria-hidden className="nw-hero__field" />

        <div aria-hidden className="nw-hero__rayClip">
          <div className="nw-hero__rays">
            {/* Each ray is drawn rightward from the origin, so an angle alone
              only ever fills the right half. `180 - angle` is the same ray
              mirrored across the vertical axis; the pair shares one delay so
              both sides open together. */}
            {RAY_ANGLES.flatMap((angle, index) =>
              [angle, 180 - angle].map((deg) => (
                <motion.span
                  animate={{ opacity: 1, scaleX: 1 }}
                  className="nw-hero__ray"
                  initial={{ opacity: 0, scaleX: 0.2 }}
                  key={deg}
                  style={{ rotate: `${deg}deg` }}
                  transition={{
                    duration: reduce ? 0.3 : 1.5,
                    delay: reduce ? 0 : T.rays + index * 0.08,
                    ease: EASE_OUT,
                  }}
                />
              )),
            )}
          </div>
        </div>

        {/* The page's actual heading. The stage above it is a picture. */}
        <h1 className="sr-only">{HERO.title}</h1>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="nw-hero__kicker"
          initial={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.6, delay: T.kicker, ease: EASE_OUT }}
        >
          <p className="nw-kicker">{HERO.kicker}</p>
        </motion.div>

        <div className="nw-hero__stage">
          {/* Behind everything, drifting against the scroll. */}
          <motion.p
            animate={{ opacity: 1, scaleX: 1 }}
            aria-hidden
            className="nw-hero__ghost"
            initial={{ opacity: 0, scaleX: 1.06 }}
            style={{ y: ghostY }}
            transition={{
              duration: reduce ? 0.3 : 1.15,
              delay: T.ghost,
              ease: EASE_OUT,
            }}
          >
            {HERO.ghost}
          </motion.p>

          {/* The split pair. Behind the garment on purpose — the inner edge of
            each word is meant to be cut off by the silhouette. */}
          <motion.div
            aria-hidden
            className="nw-hero__title"
            style={{ y: wordsY, opacity: fade }}
          >
            {HERO.split.map((word, index) => (
              <span className="nw-hero__word" key={word}>
                <motion.span
                  animate={{ y: "0%", opacity: 1 }}
                  className="nw-hero__wordInner"
                  initial={{ y: "108%", opacity: 0.001 }}
                  transition={{
                    duration: reduce ? 0.3 : 0.9,
                    delay: reduce ? 0 : T.words + index * 0.1,
                    ease: EASE_OUT,
                  }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </motion.div>

          {/* Three nested elements, one transform each: the outer takes the
            scroll drift, the middle the entrance, the inner the endless float.
            Sharing any two of those on one element means the last one written
            wins and the other silently stops. */}
          <motion.div className="nw-hero__garment" style={{ y: garmentY }}>
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              initial={{ opacity: 0, scale: 0.94, y: 28 }}
              transition={{
                duration: reduce ? 0.35 : 0.95,
                delay: T.garment,
                ease: EASE_OUT,
              }}
            >
              <span aria-hidden className="nw-hero__aura" />

              <motion.div
                animate={reduce ? undefined : { y: [0, -9, 0] }}
                className="nw-hero__garmentFloat"
                transition={{
                  duration: 5.6,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={HERO_GARMENT.alt}
                  className="nw-hero__garmentImg"
                  decoding="async"
                  draggable={false}
                  src={HERO_GARMENT.src}
                />
                {/* The same picture, full size and upside down, clipped to a
                  shallow band — see `.nw-hero__reflectionClip` for why the copy
                  is not simply cropped short. Decorative: a screen reader has
                  already been told what the garment is. */}
                <span aria-hidden className="nw-hero__reflectionClip">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    className="nw-hero__reflection"
                    decoding="async"
                    draggable={false}
                    src={HERO_GARMENT.src}
                  />
                </span>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Drawn out from its middle, which is what makes it read as a rule
            being struck rather than a bar sliding in. */}
          <motion.span
            animate={{ scaleX: 1, opacity: 1 }}
            aria-hidden
            className="nw-hero__plinth"
            initial={{ scaleX: 0, opacity: 0 }}
            transition={{
              duration: reduce ? 0.3 : 1.1,
              delay: T.plinth,
              ease: EASE_OUT,
            }}
          />
        </div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="nw-hero__foot"
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.75, delay: T.foot, ease: EASE_OUT }}
        >
          <div className="nw-hero__aside">
            <p className="nw-hero__lede">{HERO.lede}</p>

            <ul className="nw-hero__ledger">
              {HERO.ledger.map((entry) => (
                <li className="nw-hero__stat" key={entry.key}>
                  <span className="nw-hero__statValue">
                    {figures[entry.source]}
                  </span>
                  <span className="nw-hero__statLabel">{entry.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="nw-hero__ctas">
            {HERO.ctas.map((cta, index) => (
              <Link
                className={`nw-btn ${index === 0 ? "nw-btn--solid" : "nw-btn--ghost"}`}
                href={cta.href}
                key={cta.href}
              >
                {cta.label}
                <span aria-hidden className="nw-btn__arrow">
                  <ArrowUpRight size={15} strokeWidth={1.6} />
                </span>
              </Link>
            ))}
          </div>

          <div className="nw-hero__aside nw-hero__aside--right">
            <p className="nw-hero__spec">
              <span aria-hidden className="nw-hero__specDot" />
              <span>
                {HERO.spec.map((line) => (
                  <span className="nw-hero__specLine" key={line}>
                    {line}
                  </span>
                ))}
              </span>
            </p>
          </div>
        </motion.div>
      </section>

      {/* Outside the stage, not inside it. The hero is exactly one screen tall,
        and a strip mounted within it pushed the ledger and the buttons past the
        fold — which is precisely where they must not be. Below the fold it also
        does the job a marquee at a section seam should: it says there is more. */}
      <Ribbon />
    </>
  );
}
