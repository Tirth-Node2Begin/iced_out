"use client";

import { useMemo } from "react";

import { useReviews } from "@/features/11-reviews/reviews-context";

/** How many chips the stack carries before it starts counting the rest. */
const SHOWN = 4;

/**
 * Muted tints, picked to sit on the hero's graphite rather than on white.
 * Assigned by a hash of the review id, so a chip keeps its colour between
 * renders and between visits without anything being stored against it. The
 * same four the home page's review corner uses, for the same reason.
 */
const TONES = ["#f2ece0", "#cdd8dd", "#e3d4bd", "#b9c4c9"] as const;

/** The letter on a chip. */
function monogram(name: string) {
  const letter = name.trim().match(/[a-z0-9]/i);
  return letter ? letter[0].toUpperCase() : "?";
}

function toneFor(id: string) {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) {
    sum = (sum * 31 + id.charCodeAt(index)) >>> 0;
  }
  return TONES[sum % TONES.length];
}

/**
 * The hero's social proof, read from the register rather than from the bundle.
 *
 * This corner used to be three stock portraits held in `HERO_FACES`: a claim
 * about how many people had bought from this shop, made by the build rather
 * than by anybody who had. It now reads the same published list every other
 * review surface does — the product panel, the account's feedback tab, the
 * moderation desk — so a review taken down at the desk leaves here too, and
 * nothing in this corner is a second copy.
 *
 * Two silences are deliberate:
 *
 *   - Nothing is drawn until the list has actually ARRIVED. Drawing a zero
 *     while the request is still in flight would state "no one has reviewed
 *     this shop" on every cold load, which is a claim about the shop and the
 *     wrong one — the same rule `men-hero` follows for its ledger figures.
 *   - Nothing is drawn when it arrives EMPTY. A shop with no reviews yet should
 *     say nothing here rather than show faces belonging to nobody, which is the
 *     whole reason the stock portraits had to go.
 *
 * The hero's own copy carries the corner in both those cases, so the layout
 * does not collapse around a hole.
 */
export function HeroReviews() {
  const { published, ready } = useReviews();

  const summary = useMemo(() => {
    if (published.length === 0) return null;

    /* `rating` travels as a string — a review is a flat map of strings all the
       way from the register — so it is coerced here rather than trusted. A row
       whose rating will not parse counts toward neither the total nor the
       divisor, so one bad row cannot drag the average toward zero. */
    let total = 0;
    let rated = 0;

    for (const review of published) {
      const value = Number(review.rating);
      if (Number.isFinite(value) && value > 0) {
        total += value;
        rated += 1;
      }
    }

    return {
      count: published.length,
      average: rated > 0 ? total / rated : null,
      faces: published.slice(0, SHOWN),
    };
  }, [published]);

  if (!ready || !summary) return null;

  const more = summary.count - summary.faces.length;

  return (
    <div className="nh-proof">
      <div className="nh-avatars">
        {summary.faces.map((review, index) => (
          <span
            className="nh-avatars__chip"
            key={review.id}
            style={{
              background: toneFor(review.id),
              zIndex: summary.faces.length - index,
            }}
            title={review.customer}
          >
            {monogram(review.customer)}
          </span>
        ))}

        {more > 0 && (
          <span
            className="nh-avatars__chip nh-avatars__chip--more"
            style={{ zIndex: 0 }}
          >
            +{more}
          </span>
        )}
      </div>

      <p className="nh-proof__line">
        {summary.average !== null && (
          <span className="nh-proof__score">{summary.average.toFixed(1)}</span>
        )}
        {summary.count === 1 ? "1 review" : `${summary.count} reviews`}
      </p>
    </div>
  );
}
