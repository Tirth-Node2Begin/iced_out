"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Fragment, useRef } from "react";

import { ABOUT_EASE, AboutBlindsImage } from "@/components/about/about-motion";
import { useBrandMorph } from "@/components/home-v2/brand-morph";
import { HERO_TITLE } from "@/components/home-v2/data";
import { DUR, EASE } from "@/components/home-v2/motion";

/**
 * About hero.
 *
 * The left column carries no copy of its own any more: it is the site
 * wordmark, drawn at hero scale exactly as the root serves it, and flown up
 * into the bar's brand slot by <BrandMorph> as the section scrolls away. The
 * markup and the load choreography are the root hero's, unchanged — the word
 * masks, the glyph split, the same stagger off DUR/EASE — because the flight
 * measures both ends off the real type and the split is the unit it flies.
 *
 * The campaign frame keeps the right half, and keeps its own entrance.
 */
export function AboutHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const mediaY = useTransform(scrollYProgress, [0, 1], [0, -72]);
  const fade = useTransform(scrollYProgress, [0, 0.82], [1, 0]);

  /* Inert unless <BrandMorph> is mounted above this route. When it is, the
     headline here stays in flow and uninked — the flight draws it instead. */
  const { active: morphed, registerHero } = useBrandMorph();

  return (
    <section className="nh-about-hero nh-about-hero--morph" ref={sectionRef}>
      <div className="nh-wrap nh-about-hero__inner">
        <div className="nh-about-hero__copy">
          <motion.h1
            className="nh-about-hero__brand"
            data-morphed={morphed || undefined}
            ref={registerHero}
          >
            {HERO_TITLE.map((word, i) => (
              <Fragment key={word}>
                <span className="nh-about-hero__mask">
                  <motion.span
                    animate={morphed ? undefined : { y: "0%", opacity: 1 }}
                    className="inline-block"
                    initial={
                      morphed
                        ? false
                        : reduceMotion
                          ? { y: "0%", opacity: 0 }
                          : { y: "108%", opacity: 1 }
                    }
                    transition={{
                      duration: reduceMotion ? 0.3 : DUR.strip,
                      delay: reduceMotion ? 0 : 0.08 + i * 0.09,
                      ease: EASE,
                    }}
                  >
                    {/* Split to the glyph because that is the unit the brand
                        morph flies: every letter needs its own measured start.
                        The word keeps the entrance — the letters ride up
                        together, so the load still reads as two words. */}
                    {Array.from(word, (letter, j) => (
                      <span
                        className="nh-about-hero__letter"
                        data-morph-letter={i}
                        key={`${word}-${j}`}
                      >
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

        <motion.div
          className="nh-about-hero__mediaParallax"
          style={reduceMotion ? undefined : { opacity: fade, y: mediaY }}
        >
          <motion.div
            animate={{ scale: 1, y: 0 }}
            className="nh-about-hero__media"
            initial={reduceMotion ? false : { scale: 1.08, y: "5%" }}
            transition={{ duration: reduceMotion ? 0 : 0.8, delay: 0.25, ease: ABOUT_EASE }}
          >
            <AboutBlindsImage
              alt="Two models wearing black and bone Iced_out streetwear in a night passage"
              className="nh-about-hero__image"
              delay={0.05}
              priority
              slices={16}
              src="/images/campaign-after-hours-v2.webp"
            />
            <div className="nh-about-hero__mediaShade" />
            <div className="nh-about-hero__mediaLabel">
              <span>Campaign 001</span>
              <span>Bengaluru</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
