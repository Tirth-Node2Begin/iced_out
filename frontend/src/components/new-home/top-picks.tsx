"use client";

import { motion } from "motion/react";

import {
  EASE_OUT,
  Reveal,
  SplitHeading,
} from "@/components/new-home/motion-primitives";
import { TOP_PICKS } from "@/components/new-home/data";

/**
 * 03 — two oversized picks. The overlay headline on each card reads in on a
 * per-line ramp, so the last line is still ghosted while the first is solid;
 * that lag is the effect the source leans on hardest here.
 */
function PickTitle({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <motion.h3
      className="nh-pick__title"
      initial="hidden"
      transition={{ staggerChildren: 0.075 }}
      viewport={{ once: true, amount: 0.45 }}
      whileInView="show"
    >
      {words.map((word, i) => (
        <motion.span
          className="inline-block"
          key={`${word}-${i}`}
          variants={{
            hidden: { opacity: 0.06, y: 12 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.7, ease: EASE_OUT },
            },
          }}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </motion.h3>
  );
}

export function TopPicks() {
  return (
    <section className="nh-section" id="picks">
      <div className="nh-wrap">
        <div className="nh-picks__head">
          <div>
            <Reveal>
              <p className="nh-eyebrow">Our top picks</p>
            </Reveal>
            <SplitHeading
              className="nh-picks__title"
              segments={[
                { text: "Top workout gear for\n" },
                { text: "Peak ", light: true },
                { text: "Performance!" },
              ]}
            />
          </div>

          <Reveal delay={0.15}>
            <p className="nh-body">
              Discover the best of our collection, designed to power your
              workouts all year round
            </p>
          </Reveal>
        </div>

        <div className="nh-picks__grid">
          {TOP_PICKS.map((pick, i) => (
            <Reveal
              className={`nh-pick ${i === 1 ? "nh-pick--b" : ""}`}
              delay={i * 0.12}
              key={pick.id}
              y={40}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={pick.title} src={pick.image} />
              <p className="nh-pick__meta">
                {pick.meta.split("\n").map((line) => (
                  <span className="block" key={line}>
                    {line}
                  </span>
                ))}
              </p>
              <PickTitle text={pick.title} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
