"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useMemo, useRef } from "react";

import { CROPS, type AudienceContent, type HeroTile } from "@/components/gender/data";
import { EASE_OUT, SplitHeading } from "@/components/gender/motion";

/**
 * The full-screen editorial hero.
 *
 * THE COMPOSITION IS ONE PLANE, NOT TWO COLUMNS. The previous build split the
 * viewport into a copy column and an image column, and the copy — a headline,
 * a line of support and two buttons — could never fill the half it was given.
 * Everything between the end of the longest line and the first image was dead
 * space, dead centre, at every width.
 *
 * So the imagery is the GROUND now: a wall of scrolling columns running the
 * full width and the full height, with a left-heavy scrim laid over it and the
 * copy set on the dark end of that scrim. Nothing has to be padded away from
 * anything else, because there is no seam to pad — and the wall finally reads
 * as what it always meant to be, a release too big for the frame.
 *
 * Nothing sits under the copy. A production-mark rail lived there for a while
 * and it was the same mistake as the review cluster before it: a second thing
 * to read in a frame that only ever wanted one. Every fact it carried is
 * already said better in the release header directly below the fold.
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
  rail: 0.1,
  eyebrow: 0.26,
  title: 0.38,
  sub: 0.86,
  cta: 0.98,
};

/** How wide the wall is at the widest step. The responsive steps hide from the
 *  right, so this is also the authored left-to-right order. */
const WALL_COLUMNS = 4;

/** Per-column marquee tuning: duration, direction, and a negative start offset
 *  so no two columns ever sit in phase with each other. */
const COLUMN_MOTION = [
  { dur: "46s", dir: "up", delay: "-6s" },
  { dur: "54s", dir: "down", delay: "-19s" },
  { dur: "40s", dir: "up", delay: "-31s" },
  { dur: "58s", dir: "down", delay: "-11s" },
] as const;

/**
 * The decks author three columns; the wall wants four. Rather than ask every
 * deck for a fourth, the extra reuses an authored column ROTATED by two tiles —
 * same crops, different phase, so a repeat never lands beside its own twin.
 */
function buildWall(columns: HeroTile[][]): HeroTile[][] {
  const source = columns.length > 0 ? columns : [[]];

  return Array.from({ length: WALL_COLUMNS }, (_, index) => {
    const column = source[index % source.length];
    const shift = (Math.floor(index / source.length) * 2) % Math.max(column.length, 1);
    return shift === 0 ? column : [...column.slice(shift), ...column.slice(0, shift)];
  });
}

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
  const wall = useMemo(() => buildWall(hero.columns), [hero.columns]);

  return (
    <section aria-label={`${content.label} — collection hero`} className="gx-hero" ref={ref}>
      {/* ------------------------------------------------- ground: the wall */}
      <div aria-hidden className="gx-hero__wall">
        <motion.div
          className="gx-hero__drift gx-hero__rail"
          style={reduce ? undefined : { y: mediaY }}
        >
          {wall.map((column, columnIndex) => {
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
                    : { duration: 1.05, delay: T.rail + columnIndex * 0.1, ease: EASE_OUT }
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

      {/* the scrim is what makes the wall a background rather than a picture */}
      <div aria-hidden className="gx-hero__scrim" />

      {/* -------------------------------------------------------- the copy */}
      <div className="gx-hero__stage">
        <motion.div
          className="gx-hero__copy"
          style={reduce ? undefined : { y: copyY, opacity: fade }}
        >
          <motion.p
            animate={{ opacity: 1, x: 0 }}
            className="gx-hero__eyebrow"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
            transition={
              reduce ? { duration: 0.2 } : { duration: 0.6, delay: T.eyebrow, ease: EASE_OUT }
            }
          >
            {hero.eyebrow}
          </motion.p>

          <SplitHeading
            as="h1"
            className="gx-hero__title"
            delay={T.title}
            segments={[{ text: hero.heavy }, { text: hero.light, light: true }]}
            stagger={0.02}
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
        </motion.div>
      </div>

    </section>
  );
}
