"use client";

import { ArrowDown, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { CROPS, FACES, type AudienceContent } from "@/components/gender/data";
import { EASE_OUT, SplitHeading } from "@/components/gender/motion";

/**
 * The full-screen editorial hero.
 *
 * A light bone plate carrying the headline on the left and three vertical
 * image columns on the right, the third running off the edge of the viewport.
 * That bleed is the composition — it is what tells you the wall of imagery
 * keeps going past the frame.
 *
 * THREE TRANSFORMS, THREE ELEMENTS (new_style.md §6.3 / porting checklist #6):
 *   .gx-hero__col    — the load-in wipe        (Motion, clip-path)
 *   .gx-hero__drift  — the scroll parallax     (Motion, y)
 *   .gx-hero__track  — the endless marquee     (CSS keyframe, translate3d)
 * Collapsing any two onto one element makes the later transform silently
 * overwrite the earlier one.
 */

/** The load choreography. The headline is the moment; everything else defers. */
const T = {
  rail: 0.12,
  title: 0.34,
  sub: 0.86,
  cta: 0.98,
  proof: 1.12,
  cue: 1.3,
};

/** Per-column marquee tuning: duration, direction, and a negative start offset
 *  so the three columns never sit in phase with each other. */
const COLUMN_MOTION = [
  { dur: "46s", dir: "up", delay: "-6s" },
  { dur: "54s", dir: "down", delay: "-19s" },
  { dur: "40s", dir: "up", delay: "-31s" },
] as const;

export function GenderHero({ content }: { content: AudienceContent }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const copyY = useTransform(scrollYProgress, [0, 1], [0, 110]);
  const mediaY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const fade = useTransform(scrollYProgress, [0, 0.82], [1, 0]);

  const { hero } = content;

  return (
    <section aria-label={`${content.label} — collection hero`} className="gx-hero" ref={ref}>
      <div className="gx-hero__grid">
        {/* ---------------------------------------------------------- copy */}
        <motion.div
          className="gx-hero__copy"
          style={reduce ? undefined : { y: copyY, opacity: fade }}
        >
          <SplitHeading
            as="h1"
            className="gx-hero__title"
            delay={T.title}
            segments={[{ text: hero.heavy }, { text: hero.light, light: true }]}
            stagger={0.018}
          />

          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="gx-hero__sub"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            transition={reduce ? { duration: 0.2 } : { duration: 0.7, delay: T.sub, ease: EASE_OUT }}
          >
            {hero.sub}
          </motion.p>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="gx-hero__cta"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            transition={reduce ? { duration: 0.2 } : { duration: 0.6, delay: T.cta, ease: EASE_OUT }}
          >
            <Link className="gx-hero__btn gx-hero__btn--solid" href={hero.primary.href}>
              {hero.primary.label}
            </Link>
            <Link className="gx-hero__btn gx-hero__btn--outline" href={hero.secondary.href}>
              {hero.secondary.label}
              <ArrowUpRight aria-hidden size={17} />
            </Link>
          </motion.div>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="gx-hero__proof"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={reduce ? { duration: 0.2 } : { duration: 0.7, delay: T.proof, ease: EASE_OUT }}
          >
            <div aria-hidden className="gx-hero__faces">
              {FACES.map((face) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img alt="" className="gx-hero__face" key={face} src={face} />
              ))}
              {/* a fourth chip closes the cluster, as in the reference */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="gx-hero__face" src={FACES[0]} />
            </div>
            <p className="gx-hero__proofText">
              Join with <b>{hero.proofCount}</b> {hero.proofTail}
            </p>
          </motion.div>
        </motion.div>

        {/* --------------------------------------------------------- media */}
        <div className="gx-hero__media">
          <motion.div
            className="gx-hero__drift gx-hero__rail"
            style={reduce ? undefined : { y: mediaY }}
          >
            {hero.columns.map((column, columnIndex) => {
              const tuning = COLUMN_MOTION[columnIndex] ?? COLUMN_MOTION[0];
              /* the list is rendered twice; the CSS loop shifts by exactly one set */
              const doubled = [...column, ...column];

              return (
                <motion.div
                  animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                  className="gx-hero__col"
                  data-col={columnIndex}
                  initial={
                    reduce
                      ? { clipPath: "inset(0% 0% 0% 0%)", opacity: 0 }
                      : { clipPath: "inset(0% 0% 100% 0%)" }
                  }
                  key={columnIndex}
                  transition={
                    reduce
                      ? { duration: 0.2 }
                      : { duration: 1.05, delay: T.rail + columnIndex * 0.12, ease: EASE_OUT }
                  }
                >
                  <div
                    className="gx-hero__track"
                    data-dir={tuning.dir}
                    style={
                      {
                        "--gx-dur": tuning.dur,
                        "--gx-delay": tuning.delay,
                      } as React.CSSProperties
                    }
                  >
                    {doubled.map((tile, tileIndex) => {
                      const crop = CROPS[tile.crop];
                      return (
                        <div
                          className="gx-hero__tile"
                          key={`${tile.crop}-${tileIndex}`}
                          style={{ aspectRatio: tile.ratio }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt=""
                            decoding="async"
                            loading={tileIndex < 2 ? "eager" : "lazy"}
                            src={crop.src}
                            style={
                              {
                                "--op": crop.op,
                                "--z": crop.z ?? 1,
                              } as React.CSSProperties
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* the entrance and the scroll fade are separate elements: a `style`
          opacity would otherwise clobber the `animate` opacity outright */}
      <motion.span
        aria-hidden
        className="gx-hero__cue"
        style={reduce ? undefined : { opacity: fade }}
      >
        <motion.span
          animate={{ opacity: 1 }}
          className="gx-hero__cueInner"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.6, delay: T.cue, ease: EASE_OUT }}
        >
          <ArrowDown size={14} />
          Scroll to the edit
        </motion.span>
      </motion.span>
    </section>
  );
}
