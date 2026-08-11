"use client";

import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";

import { EASE_OUT, Reveal } from "@/components/new-home/motion-primitives";
import { Stars } from "@/components/new-man/product-bits";
import {
  RATING_COUNTS,
  REVIEWS,
  ratingSummary,
} from "@/components/new-man/product-deck";

/**
 * 03 — rating and reviews.
 *
 * The average and the total are DERIVED from `RATING_COUNTS`, never written
 * down twice: a headline score that disagrees with the bars underneath it is
 * the one thing a section like this cannot afford, and it happens the moment
 * the two are separate literals.
 */
export function ProductReviews() {
  const reduce = useReducedMotion();
  const { total, average } = ratingSummary();
  const [index, setIndex] = useState(0);
  /** which way the card leaves, so back and forward read as opposite moves */
  const [direction, setDirection] = useState(1);

  const go = useCallback((step: number) => {
    setDirection(step);
    setIndex((value) => (value + step + REVIEWS.length) % REVIEWS.length);
  }, []);

  const review = REVIEWS[index];
  const peak = Math.max(...RATING_COUNTS);

  return (
    <section className="nh-section nmp-rev">
      <div className="nh-wrap">
        <Reveal>
          <h2 className="nmp-rev__title">Rating &amp; reviews</h2>
        </Reveal>

        <div className="nmp-rev__grid">
          <Reveal className="nmp-rev__score">
            <div className="nmp-score">
              <div className="nmp-score__figure">
                <p className="nmp-score__value">
                  {average.toFixed(1).replace(".", ",")}
                  <span className="nmp-score__out">/5</span>
                </p>
                <p className="nh-eyebrow nmp-score__count">({total} reviews)</p>
              </div>

              <div className="nmp-bars">
                {RATING_COUNTS.map((count, row) => {
                  const stars = 5 - row;
                  return (
                    <div className="nmp-bar" key={stars}>
                      <span className="nmp-bar__star">
                        <Star aria-hidden className="nmp-bar__icon" size={11} />
                        {stars}
                      </span>
                      <span className="nmp-bar__track">
                        <motion.span
                          className="nmp-bar__fill"
                          initial={{ width: 0 }}
                          transition={{
                            duration: reduce ? 0 : 0.9,
                            delay: reduce ? 0 : row * 0.06,
                            ease: EASE_OUT,
                          }}
                          viewport={{ once: true, amount: 0.6 }}
                          // the widest row anchors the scale, so a distribution
                          // this lopsided still shows the 3★ and 2★ rows
                          whileInView={{ width: `${(count / peak) * 100}%` }}
                        />
                      </span>
                      <span className="nmp-bar__count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>

          <Reveal className="nmp-rev__card" delay={0.12}>
            <article className="nmp-review">
              {/* The stage keeps a floor under the card: `mode="wait"` empties
                  the box between the outgoing and incoming quote, and without a
                  reserved height the panel would collapse and drag the rest of
                  the page up for a third of a second on every press. */}
              <div className="nmp-review__stage">
                <AnimatePresence custom={direction} initial={false} mode="wait">
                  <motion.div
                    animate={{ opacity: 1, x: 0 }}
                    className="nmp-review__body"
                    custom={direction}
                    exit={{ opacity: 0, x: reduce ? 0 : direction * -24 }}
                    initial={{ opacity: 0, x: reduce ? 0 : direction * 24 }}
                    key={review.id}
                    transition={{ duration: reduce ? 0 : 0.42, ease: EASE_OUT }}
                  >
                    <Quote aria-hidden className="nmp-review__mark" size={22} />

                    <div className="nmp-review__head">
                      <span className="nmp-review__name">{review.name}</span>
                      <span className="nmp-review__date">{review.date}</span>
                    </div>

                    <Stars className="nmp-review__stars" size={14} value={review.stars} />

                    <p className="nmp-review__quote">&ldquo;{review.body}&rdquo;</p>

                    <div className="nmp-review__by">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" className="nmp-review__avatar" src={review.avatar} />
                      <span className="nh-eyebrow">Verified purchase</span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="nmp-review__foot">
                <span aria-hidden className="nmp-review__bar">
                  <span
                    className="nmp-review__fill"
                    style={{ width: `${((index + 1) / REVIEWS.length) * 100}%` }}
                  />
                </span>

                <div className="nmp-review__nav">
                  <button
                    aria-label="Previous review"
                    className="nmp-round"
                    onClick={() => go(-1)}
                    type="button"
                  >
                    <ChevronLeft aria-hidden size={15} />
                  </button>
                  <button
                    aria-label="Next review"
                    className="nmp-round"
                    onClick={() => go(1)}
                    type="button"
                  >
                    <ChevronRight aria-hidden size={15} />
                  </button>
                </div>
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
