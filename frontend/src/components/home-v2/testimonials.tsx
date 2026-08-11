"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { TESTIMONIALS } from "./data";
import { EASE, RevealImage, ScrollWords } from "./motion";

const ITEMS = TESTIMONIALS.items;

function Arrow({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      {dir === "prev" ? (
        <path d="M19 12H5m0 0 6-6m-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/**
 * Testimonials — heading and paddle controls on the left, a white quote card
 * on the right. The card swaps horizontally in the direction of travel; the
 * paddles are the only interactive control on the page.
 */
export function Testimonials() {
  const [[index, dir], setState] = useState<[number, number]>([0, 1]);
  const item = ITEMS[index];

  const go = (step: number) =>
    setState(([i]) => [(i + step + ITEMS.length) % ITEMS.length, step]);

  return (
    <section className="hv2-testimonials hv2-shell" id="testimonials">
      <div className="hv2-testimonials__grid">
        <div>
          <ScrollWords
            as="h2"
            className="hv2-h2"
            offset={["start 0.88", "start 0.5"]}
            spread={2}
            text={TESTIMONIALS.heading.join("\n")}
          />

          <div className="hv2-testimonials__nav">
            <button
              aria-label="Previous testimonial"
              className="hv2-arrow"
              onClick={() => go(-1)}
              type="button"
            >
              <Arrow dir="prev" />
            </button>
            <button
              aria-label="Next testimonial"
              className="hv2-arrow"
              onClick={() => go(1)}
              type="button"
            >
              <Arrow dir="next" />
            </button>
          </div>
        </div>

        <div className="hv2-quote">
          <AnimatePresence custom={dir} initial={false} mode="wait">
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="hv2-quote__inner"
              custom={dir}
              exit={{ opacity: 0, x: dir * -40 }}
              initial={{ opacity: 0, x: dir * 40 }}
              key={item.index}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <RevealImage
                alt={item.name}
                amount={0.15}
                className="hv2-quote__photo"
                src={item.src}
              />

              <div className="hv2-quote__body">
                <span className="hv2-quote__index">{item.index}</span>
                <p className="hv2-quote__text">&ldquo;{item.quote}&rdquo;</p>
                <div className="hv2-quote__who">
                  <div className="hv2-quote__name">{item.name}</div>
                  <div className="hv2-quote__role">{item.role}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
