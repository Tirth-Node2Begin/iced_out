"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef } from "react";

import {
  BlindsImage,
  EASE_OUT,
  SplitHeading,
  type Segment,
} from "@/components/new-home/motion-primitives";
import {
  HERO_FACES,
  HERO_META,
  HERO_MODEL,
  SHOTS,
  type HeroMetaLabel,
} from "@/components/new-home/data";

const RAY_ANGLES = [-64, -48, -33, -19, 19, 33, 48, 64];

/**
 * Load choreography, read off the reference at 10fps (video-frames/detail/
 * load-seq.jpg). The order is the whole point: the subject arrives alone and
 * oversized, holds, drops into place, and only then does the rest of the
 * furniture appear.
 *
 *   0.05s  slices start opening, subject oversized and high
 *   0.50s  subject fully assembled, holds
 *   1.00s  subject scales down and settles to its resting position
 *   1.50s  review block (left) and film card (right) fade up
 *   1.65s  CTA pills
 *   1.75s  headline reveals character by character
 */
const T = {
  blinds: 0.05,
  settle: 1.0,
  settleDur: 0.5,
  review: 1.5,
  film: 1.6,
  cta: 1.68,
  headline: 1.78,
  meta: 2.05,
} as const;

/**
 * 01 — the hero. The choreography is fixed; the copy is not. /new-man and
 * /new-woman pass their own headline, intro, and spec labels so the same
 * staging reads as menswear or womenswear (see `DEPARTMENTS` in data.ts).
 */
export function Hero({
  headline = [
    { text: "Gear up every season\n" },
    { text: "Every " },
    { text: "Workout!", light: true },
  ],
  intro = "Stay cozy without compromising your range of motion. Our women's winter range is perfect for those chilly outdoor workouts.",
  meta = HERO_META,
  ctas = [
    { label: "Shop now", href: "#fits" },
    { label: "Explore all", href: "#picks" },
  ],
}: {
  headline?: Segment[];
  intro?: string;
  meta?: HeroMetaLabel[];
  /** exactly two — the dark pill, then the light one */
  ctas?: { label: string; href: string }[];
} = {}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // the model drifts up and dims as the page leaves the hero
  const modelY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section className="nh-hero" ref={ref}>
      {/* The fan is far larger than the hero, so it carries its own clip. The
          section itself can no longer do that job — it has to let the subject
          hang past its bottom edge — and without this the rays would spill
          several hundred pixels into the section below. */}
      <div aria-hidden className="nh-hero__rayClip">
        <div className="nh-hero__rays">
          {/* Each ray is drawn rightward from the origin, so an angle alone only
              ever fills the right half. `180 - angle` is the same ray mirrored
              across the vertical axis; the pair shares one delay so the two
              sides open together. */}
          {RAY_ANGLES.flatMap((angle, i) =>
            [angle, 180 - angle].map((deg) => (
              <motion.div
                animate={{ opacity: 1, scaleX: 1 }}
                className="nh-hero__ray"
                initial={{ opacity: 0, scaleX: 0.2 }}
                key={deg}
                style={{ rotate: `${deg}deg` }}
                transition={{ duration: 1.4, delay: T.settle + i * 0.05, ease: EASE_OUT }}
              />
            )),
          )}
        </div>
      </div>

      <motion.div className="nh-hero__copy" style={{ y: copyY, opacity: fade }}>
        <SplitHeading
          as="h1"
          className="nh-hero__title"
          delay={T.headline}
          segments={headline}
          stagger={0.022}
        />

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="nh-hero__cta"
          initial={{ opacity: 0, y: 14 }}
          transition={{ duration: 0.6, delay: T.cta, ease: EASE_OUT }}
        >
          {ctas.map((cta, i) => (
            <Link
              className={`nh-pill ${i === 0 ? "nh-pill--dark" : "nh-pill--light"}`}
              href={cta.href}
              key={cta.href}
            >
              {cta.label}
            </Link>
          ))}
        </motion.div>
      </motion.div>

      <div className="nh-hero__stage">
        {/* The subject assembles out of horizontal slices while oversized and
            sitting high, holds there, then scales down and drops into place.
            Centring lives on the wrapper; the settle rides on an inner element
            so it never fights the scroll parallax on the outer one. */}
        <div className="nh-hero__modelWrap">
          <motion.div className="nh-hero__modelParallax" style={{ y: modelY }}>
            <motion.div
              animate={{ scale: 1, y: "0%" }}
              className="nh-hero__model"
              initial={{ scale: 1.24, y: "-7%" }}
              transition={{
                duration: T.settleDur,
                delay: T.settle,
                ease: EASE_OUT,
              }}
            >
              <BlindsImage
                alt="Iced_out winter training kit"
                className="h-full"
                delay={T.blinds}
                direction="center"
                priority
                slices={16}
                src={HERO_MODEL}
              />
            </motion.div>
          </motion.div>
        </div>

        {/* spec labels pinned around the subject, in the same register the
            showcase card uses for its product meta */}
        <motion.div className="nh-hero__meta" style={{ opacity: fade }}>
          {meta.map((label, i) => (
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className={`nh-hero__metaItem nh-hero__metaItem--${label.corner}`}
              initial={{ opacity: 0, y: 12 }}
              key={label.id}
              transition={{
                duration: 0.7,
                delay: T.meta + i * 0.09,
                ease: EASE_OUT,
              }}
            >
              {label.dot ? <span className="nh-hero__metaDot" /> : null}
              <span>
                {label.lines.map((line) => (
                  <span className="block" key={line}>
                    {line}
                  </span>
                ))}
              </span>
            </motion.p>
          ))}
        </motion.div>

      </div>

      {/* The asides live on the section, not the stage: the stage runs past the
          fold so the torso can, and anything anchored to its bottom edge goes
          with it. As section children they can be measured off the fold itself
          (see `.nh-hero__aside` — `100% - 100svh` is the overflow). */}

      {/* the scroll fade and the entrance both want `opacity`, and a style
          MotionValue silently wins over `animate` — so they are split across
          two elements: wrapper fades on scroll, inner plays the entrance */}
      <motion.div
        className="nh-hero__aside nh-hero__aside--left"
        style={{ opacity: fade }}
      >
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 22 }}
          transition={{ duration: 0.7, delay: T.review, ease: EASE_OUT }}
        >
          <div className="nh-avatars">
            {HERO_FACES.map((src, i) => (
              <span key={src} style={{ zIndex: HERO_FACES.length - i }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" src={src} />
              </span>
            ))}
          </div>
          <p className="nh-body">{intro}</p>
        </motion.div>
      </motion.div>

      <motion.div
        className="nh-hero__aside nh-hero__aside--right"
        style={{ opacity: fade }}
      >
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 22 }}
          transition={{ duration: 0.75, delay: T.review, ease: EASE_OUT }}
        >
          <button
            aria-label="Play the campaign film"
            className="nh-videocard"
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" src={SHOTS.drop} />
            <span className="nh-videocard__play">
              <svg
                aria-hidden
                fill="currentColor"
                height="26"
                viewBox="0 0 24 24"
                width="26"
              >
                <path d="M9 6.5v11l9-5.5-9-5.5Z" />
              </svg>
            </span>
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
}
