"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import { reviewByline } from "@/features/11-reviews/reviews";
import { useReviews } from "@/features/11-reviews/reviews-context";

import { TESTIMONIALS } from "./data";
import { EASE, RevealImage, ScrollWords } from "./motion";

const ITEMS = TESTIMONIALS.items;

/** The card always has a portrait, so an approved review borrows one in turn. */
const PORTRAITS = ITEMS.map((item) => item.src);

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
  const { approved } = useReviews();

  /**
   * The studio's own quotes, then whatever moderation has approved.
   *
   * Approved reviews are APPENDED rather than substituted, so the section is
   * never empty and the first card a visitor lands on is the same one it has
   * always been. A review that is still pending — or that was rejected, or
   * whose approval was taken back — simply is not in this list.
   *
   * The register's server snapshot is its seed, so the exported markup already
   * carries the reviews a browser that has never been here would see, and the
   * first client render agrees with it.
   */
  const items = useMemo(
    () => [
      ...ITEMS,
      ...approved.map((review, position) => ({
        index: String(ITEMS.length + position + 1).padStart(2, "0"),
        quote: review.body || review.headline,
        name: reviewByline(review),
        role: `${review.rating}★ · ${review.product}`,
        src: PORTRAITS[(ITEMS.length + position) % PORTRAITS.length],
      })),
    ],
    [approved],
  );

  /* An approval taken back shortens the list under the reader. Clamping here
     rather than resetting keeps the card they were on if it survived. */
  const item = items[Math.min(index, items.length - 1)];

  const go = (step: number) =>
    setState(([i]) => [(i + step + items.length) % items.length, step]);

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
