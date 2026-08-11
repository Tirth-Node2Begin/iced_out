"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Fragment, useRef } from "react";

import { useBrandMorph } from "./brand-morph";
import { HERO_PANELS, HERO_TITLE } from "./data";
import { DUR, EASE } from "./motion";

/**
 * Hero.
 *
 * Load choreography, read off the first 1.5s of the capture and then tightened:
 *
 *   0.08s  the title rides up from behind its own baseline, glyph by glyph from
 *          the left, so the headline writes itself on instead of landing as a
 *          slab. On the site root the glyphs are drawn — and timed — by
 *          <BrandMorph>; see ENTRANCE there.
 *   0.16s  the strip panels start opening from the bottom edge, left to right
 *
 * On scroll the headline drifts up and thins while the strip climbs more
 * slowly, so the pictures eat the whitespace under the title.
 *
 * Panels reach their final height immediately and reveal via `clip-path`
 * rather than animating `height`: animating height re-runs layout on the whole
 * flex row every frame for six images at once, which is exactly the stutter the
 * load sequence cannot afford. A clip is composited.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  /* On the site root the headline is not drawn here — <BrandMorph> draws it
     and flies it up into the bar. What stays behind is the same words at the
     same size, in flow and invisible: the strip still sits under a title-shaped
     hole, and the flight measures its start point off the real type rather
     than a number copied out of the stylesheet. */
  const { active: morphed, registerHero } = useBrandMorph();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const titleY = useTransform(scrollYProgress, [0, 1], ["0%", "-42%"]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const stripY = useTransform(scrollYProgress, [0, 1], ["0%", "-18%"]);

  return (
    <section className="hv2-hero" id="top" ref={ref}>
      <div className="hv2-hero__head hv2-shell">
        <motion.h1
          className="hv2-hero__title"
          data-morphed={morphed || undefined}
          ref={registerHero}
          style={reduce || morphed ? undefined : { y: titleY, opacity: titleOpacity }}
        >
          {HERO_TITLE.map((word, i) => (
            <Fragment key={word}>
              <span className="hv2-hero__mask">
                <motion.span
                  animate={morphed ? undefined : { y: "0%", opacity: 1 }}
                  className="inline-block"
                  initial={
                    morphed ? false : reduce ? { y: "0%", opacity: 0 } : { y: "108%", opacity: 1 }
                  }
                  transition={{
                    duration: reduce ? 0.3 : DUR.strip,
                    delay: reduce ? 0 : 0.08 + i * 0.09,
                    ease: EASE,
                  }}
                >
                  {/* Split to the glyph because that is the unit the brand
                      morph flies and staggers: every letter needs its own
                      measured start. This copy only animates where the morph is
                      not mounted, and then only as a reduced-motion fade, so
                      the entrance rides on the word. */}
                  {Array.from(word, (letter, j) => (
                    <span className="hv2-hero__letter" data-morph-letter={i} key={`${word}-${j}`}>
                      {letter}
                    </span>
                  ))}
                </motion.span>
              </span>
              {/* Outside the mask — a mask is an inline-block and CSS drops
                  whitespace at the end of one, so a space nested inside would
                  render the headline as "IcedOut". */}
              {i < HERO_TITLE.length - 1 ? " " : null}
            </Fragment>
          ))}
        </motion.h1>
      </div>

      <motion.div className="hv2-hero__strip" style={reduce ? undefined : { y: stripY }}>
        {HERO_PANELS.map((panel, i) => (
          <motion.div
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            className="hv2-hero__panel"
            initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
            key={panel.src}
            style={{ flex: `${panel.flex} 1 0`, height: `${panel.height * 100}%` }}
            transition={{
              duration: reduce ? 0.3 : DUR.strip,
              delay: reduce ? 0 : 0.16 + i * 0.075,
              ease: EASE,
            }}
          >
            {/* The picture settles back from an over-scale as its panel opens,
                so the two halves of the reveal move against each other. */}
            <motion.img
              alt={panel.alt}
              animate={{ scale: 1 }}
              decoding="async"
              fetchPriority={i < 3 ? "high" : "auto"}
              initial={{ scale: reduce ? 1 : 1.24 }}
              src={panel.src}
              transition={{
                duration: reduce ? 0 : DUR.strip * 1.3,
                delay: reduce ? 0 : 0.16 + i * 0.075,
                ease: EASE,
              }}
            />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
