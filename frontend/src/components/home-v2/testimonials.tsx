"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import { reviewByline } from "@/features/11-reviews/reviews";
import { useReviews } from "@/features/11-reviews/reviews-context";

import { useCopy } from "./copy";
import { EASE, ScrollWords } from "./motion";

/** The letter on the tile — the same rule the hero's review corner uses. */
function monogram(name: string) {
  const letter = name.trim().match(/[a-z0-9]/i);
  return letter ? letter[0].toUpperCase() : "?";
}

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
  const { testimonials } = useCopy();
  const [[index, dir], setState] = useState<[number, number]>([0, 1]);
  const { published, ready } = useReviews();

  /**
   * Only what shoppers actually wrote.
   *
   * This used to start with three written-in testimonials per copy pack —
   * invented names, invented quotes, invented product attributions — and append
   * the real reviews after them. Nine fabricated customers across the three
   * packs the section serves, rendered ahead of the genuine ones and
   * indistinguishable from them. A review is a claim about this shop made by
   * somebody who bought from it, which makes it the one kind of copy nobody
   * here is entitled to write.
   *
   * So the seeds are gone and this is the whole list. A review that has been
   * taken down by the desk is not in it, because `published` is `GET /reviews`
   * and that endpoint only serves what is live.
   */
  const items = useMemo(
    () =>
      published.map((review, position) => ({
        id: review.id,
        index: String(position + 1).padStart(2, "0"),
        /* The body if there is one, else the headline — a shopper may rate and
           title without writing prose, and a blank card is worse than a short
           one. */
        quote: review.body || review.headline,
        name: reviewByline(review),
        role: `${review.rating}★ · ${review.product}`,
      })),
    [published],
  );

  /**
   * Nothing written yet, nothing to show.
   *
   * A band headed "Worn hard, reported back" with no reports under it is a
   * worse answer than no band, and inventing one to fill it is what this change
   * exists to stop. Held until the fetch has actually answered (`ready`) so the
   * section does not flash in on arrival for a store that does have reviews.
   */
  if (!ready || items.length === 0) return null;

  /* A review taken down shortens the list under the reader. Clamping rather
     than resetting keeps the card they were on if it survived. */
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
            text={testimonials.heading.join("\n")}
          />

          {/* Paddles only when there is somewhere to page to. One review and
              two arrows that cycle back to the same card is a control that
              lies about having content behind it. */}
          <div className="hv2-testimonials__nav" hidden={items.length < 2}>
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
              key={item.id}
              transition={{ duration: 0.5, ease: EASE }}
            >
              {/* An initial, not a face.

                  The card was built around a portrait, and while the quotes
                  were invented the portrait could be invented with them. These
                  are real people now and this shop holds no photograph of any
                  of them — so the tile carries the first letter of the byline
                  instead. Borrowing a stock portrait to sit above a real
                  person's words would be the same fabrication in a different
                  medium. The hero's review corner already answers it this way. */}
              <span aria-hidden className="hv2-quote__mono">
                {monogram(item.name)}
              </span>

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
