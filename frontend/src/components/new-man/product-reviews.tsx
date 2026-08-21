"use client";

import { ChevronLeft, ChevronRight, Lock, PenLine, Quote, Star } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EASE_OUT, Reveal } from "@/components/new-home/motion-primitives";
import { Stars } from "@/components/new-man/product-bits";
import type { Piece } from "@/components/new-man/data";
import { useReviews } from "@/features/11-reviews/reviews-context";
import { reviewByline, type Review } from "@/features/11-reviews/reviews";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * 03 — rating and reviews, from the people who bought the piece.
 *
 * This section used to be written content. Three named reviewers with avatars
 * and quotations, and a `RATING_COUNTS = [36, 9, 2, 2, 1]` from which it derived
 * "4.6 out of 5, 50 reviews" — the same score, the same distribution and the
 * same three opinions under every product in the shop. It was honest about that
 * in a comment nobody reading the page could see.
 *
 * It reads the `reviews` table now, filtered to THIS product and to the ones
 * moderation has approved, and it says so plainly when there are none. An empty
 * review section is not a failure state; it is the truth about a piece that has
 * just gone up, and it is what makes the numbers on an older piece worth
 * anything.
 *
 * The write form is the other half of the same fact: a section that quotes
 * shoppers has to be reachable by them. One review per customer per product —
 * enforced by the database (`uq_reviews_customer_product`), stated here before
 * anybody types four hundred words they cannot submit.
 */

/** What the picker offers, worst to best read top-down in the markup. */
const FIT_ANSWERS = ["Runs small", "True to size", "Runs large"];

export function ProductReviews({ piece }: { piece: Piece }) {
  const reduce = useReducedMotion();
  const { published, mine, submit, refreshMine } = useReviews();
  const { isAuthenticated, sessionReady } = useAuth();

  const [index, setIndex] = useState(0);
  /** which way the card leaves, so back and forward read as opposite moves */
  const [direction, setDirection] = useState(1);
  const [writing, setWriting] = useState(false);
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(5);

  /* Matched on the SLUG, never the name: two pieces can be called the same
     thing, and quoting one garment's reviews under another is the one mistake
     that makes a review section worth less than no review section. */
  const reviews = useMemo(
    () => published.filter((review) => review.productSlug === piece.slug),
    [published, piece.slug],
  );

  /** This shopper's own review of this piece, in whatever state it is in. */
  const own = useMemo(
    () => mine.find((review) => review.productSlug === piece.slug),
    [mine, piece.slug],
  );

  const summary = useMemo(() => distributionOf(reviews), [reviews]);

  /* Clamped rather than reset: the list can grow under the carousel when the
     public store re-reads, and an index into the old length is a read past the
     end of the new one. */
  const cursor = Math.min(index, Math.max(0, reviews.length - 1));
  const review = reviews[cursor];

  const go = useCallback(
    (step: number) => {
      if (reviews.length === 0) return;
      setDirection(step);
      setIndex((value) => (value + step + reviews.length) % reviews.length);
    },
    [reviews.length],
  );

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setSending(true);

    try {
      await submit({
        /* The slug, so the server files it against the product rather than
           matching on a name two pieces could share. */
        product: piece.slug,
        rating,
        headline: String(form.get("headline") ?? "").trim(),
        body: String(form.get("body") ?? "").trim(),
        fit: String(form.get("fit") ?? "").trim() || undefined,
      });

      toast.success("Thank you — your review is up", {
        description: "It is on this page now, under your name.",
      });
      setWriting(false);
    } catch (error) {
      /* The API client's normaliser has already turned this into a sentence
         written to be read — including the one the duplicate check returns,
         which names the piece and says what state the earlier review is in. */
      toast.error("That review could not be sent", {
        description:
          error instanceof Error ? error.message : "The server refused it. Please try again.",
      });

      /* The server has just told us something this browser did not know. The
         commonest refusal here is "you have already reviewed this", which can
         only happen when the held list of the shopper's own reviews is stale or
         was never read — so it is re-read, and the panel below takes the form's
         place with the review they actually wrote. Leaving the form standing
         after that answer invites them to type it all again. */
      await refreshMine().catch(() => {});
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="nh-section nmp-rev">
      <div className="nh-wrap">
        <Reveal>
          <h2 className="nmp-rev__title">Rating &amp; reviews</h2>
        </Reveal>

        <div className="nmp-rev__grid">
          {/* ------------------------------------------------------- score */}
          <Reveal className="nmp-rev__score">
            <div className="nmp-score">
              {summary.total === 0 ? (
                /* No score at all, rather than a zero. "0.0 out of 5" is a
                   verdict, and nobody has given one. */
                <div className="nmp-score__none">
                  <Star aria-hidden size={20} strokeWidth={1.4} />
                  {/* A shopper whose own review is waiting must not be told
                      nobody has written one. Theirs is not published yet — that
                      is a different sentence, and saying the first reads as if
                      what they sent was thrown away. */}
                  <p className="nmp-score__noneTitle">No reviews yet</p>
                  <p className="nmp-score__noneCopy">
                    This piece has not been written about. Once somebody who bought it does,
                    their rating is what this panel shows.
                  </p>
                </div>
              ) : (
                <>
                  <div className="nmp-score__figure">
                    <p className="nmp-score__value">
                      {summary.average.toFixed(1)}
                      <span className="nmp-score__out">/5</span>
                    </p>
                    <p className="nh-eyebrow nmp-score__count">
                      ({summary.total} {summary.total === 1 ? "review" : "reviews"})
                    </p>
                  </div>

                  <div className="nmp-bars">
                    {summary.counts.map((count, row) => {
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
                              /* The widest row anchors the scale, so a lopsided
                                 distribution still shows its smaller rows. */
                              whileInView={{ width: `${(count / summary.peak) * 100}%` }}
                            />
                          </span>
                          <span className="nmp-bar__count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </Reveal>

          {/* -------------------------------------------------------- card */}
          <Reveal className="nmp-rev__card" delay={0.12}>
            <article className="nmp-review">
              {/* The stage reserves the carousel's height so a change of quote
                  cannot drag the page up — but only when there IS a carousel.
                  Holding 200px open under two lines of "nobody has written yet"
                  makes an honest empty state look like a broken one. */}
              <div className="nmp-review__stage" data-empty={review ? undefined : "true"}>
                {review ? (
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
                        <span className="nmp-review__name">{review.customer}</span>
                        <span className="nmp-review__date">{review.submitted}</span>
                      </div>

                      <Stars
                        className="nmp-review__stars"
                        size={14}
                        value={Number(review.rating)}
                      />

                      {review.headline && (
                        <p className="nmp-review__headline">{review.headline}</p>
                      )}

                      {review.body && (
                        <p className="nmp-review__quote">&ldquo;{review.body}&rdquo;</p>
                      )}

                      <div className="nmp-review__by">
                        {/* No avatar. The three that used to sit here were stock
                            photographs standing in for people who did not exist;
                            a real shopper has no picture on file, and inventing
                            one is the same lie in a smaller frame.

                            The byline is only drawn where it SAYS something the
                            name above has not: "Verified buyer" for a review a
                            shopper wrote through their account. A console-origin
                            one bylines itself with the customer's name, which is
                            already the line at the top of the card. */}
                        {reviewByline(review) !== review.customer && (
                          <span className="nh-eyebrow">{reviewByline(review)}</span>
                        )}
                        {review.fit && <span className="nmp-review__fit">{review.fit}</span>}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="nmp-review__empty">
                    <p className="nmp-review__emptyTitle">Nobody has written about this piece.</p>
                    <p className="nmp-review__emptyCopy">
                      Every review here is written by somebody who bought the piece, and it
                      goes up as they wrote it.
                    </p>
                  </div>
                )}
              </div>

              {reviews.length > 1 && (
                <div className="nmp-review__foot">
                  <span aria-hidden className="nmp-review__bar">
                    <span
                      className="nmp-review__fill"
                      style={{ width: `${((cursor + 1) / reviews.length) * 100}%` }}
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
              )}
            </article>
          </Reveal>
        </div>

        {/* --------------------------------------------------------- write */}
        {/* Held until the session is known. Offering "sign in to review" to
            somebody who is already signed in, for the beat it takes to find
            out, is worse than showing nothing for that beat. */}
        {sessionReady && (
          <Reveal className="nmp-write" delay={0.18}>
            {/* `own` wins over `writing`: if the shopper turns out to have a
                review already — on load, or because a refused submit made us
                re-read — the panel replaces the form rather than sitting under
                it. */}
            {own ? (
              <OwnReview review={own} />
            ) : !isAuthenticated ? (
              <div className="nmp-write__gate">
                <Lock aria-hidden size={15} strokeWidth={1.6} />
                <p>
                  <strong>Bought this piece?</strong> Sign in to leave a review — one per
                  customer, per piece.
                </p>
                <Link
                  className="nmp-write__signin"
                  href={`/auth/login?returnTo=${encodeURIComponent(`/new-man/piece?slug=${piece.slug}`)}`}
                >
                  Sign in
                </Link>
              </div>
            ) : writing ? (
              <form className="nmp-write__form" onSubmit={(event) => void send(event)}>
                <p className="nh-eyebrow nmp-write__lede">Your review of {piece.name}</p>

                <div className="nmp-write__rating">
                  <span className="nmp-write__label" id="nmp-rating-label">
                    Rating
                  </span>
                  {/* A radio group, not five buttons: the arrow keys move
                      between the options and the whole thing answers to one
                      name, which is what a rating is. */}
                  <div
                    aria-labelledby="nmp-rating-label"
                    className="nmp-write__stars"
                    role="radiogroup"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        aria-checked={rating === value}
                        aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                        className="nmp-write__star"
                        data-on={value <= rating || undefined}
                        key={value}
                        onClick={() => setRating(value)}
                        role="radio"
                        type="button"
                      >
                        <Star aria-hidden size={22} strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>
                </div>

                <label className="nmp-write__field">
                  <span className="nmp-write__label">Headline</span>
                  <input
                    maxLength={160}
                    minLength={3}
                    name="headline"
                    placeholder="A clear, useful line"
                    required
                  />
                </label>

                <label className="nmp-write__field">
                  <span className="nmp-write__label">How does it fit?</span>
                  <select defaultValue="" name="fit">
                    <option value="">Not sure</option>
                    {FIT_ANSWERS.map((answer) => (
                      <option key={answer} value={answer}>
                        {answer}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="nmp-write__field nmp-write__field--wide">
                  <span className="nmp-write__label">What you thought</span>
                  <textarea
                    maxLength={4000}
                    name="body"
                    placeholder="The weight, the fit, how it has worn — whatever you wanted to know before you bought it."
                    rows={5}
                  />
                </label>

                <div className="nmp-write__acts">
                  <p className="nmp-write__note">
                    Published straight away. You can leave one review per piece.
                  </p>
                  <div className="nmp-write__buttons">
                    <button
                      className="nmp-write__cancel"
                      disabled={sending}
                      onClick={() => setWriting(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button className="nmp-write__send" disabled={sending} type="submit">
                      {sending ? "Sending…" : "Send review"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <button className="nmp-write__open" onClick={() => setWriting(true)} type="button">
                <PenLine aria-hidden size={15} strokeWidth={1.6} />
                Write a review
              </button>
            )}
          </Reveal>
        )}
      </div>
    </section>
  );
}

/**
 * What a shopper who has already written one sees.
 *
 * Their own review, and what is happening to it. A page that simply hid the
 * form would be answering "where did mine go" with silence — and a pending
 * review is invisible to everyone else, so this is the only place they can be
 * told it arrived.
 */
function OwnReview({ review }: { review: Review }) {
  const state =
    review.status === "Published"
      ? "Live on this page."
      : "Taken down by our team. Each customer may leave one review per piece.";

  return (
    <div className="nmp-write__own" data-state={review.status.toLowerCase()}>
      <div className="nmp-write__ownHead">
        <span className="nh-eyebrow">Your review</span>
        <span className="nmp-write__state">{review.status}</span>
      </div>

      <Stars size={14} value={Number(review.rating)} />
      {review.headline && <p className="nmp-write__ownTitle">{review.headline}</p>}
      {review.body && <p className="nmp-write__ownBody">{review.body}</p>}
      <p className="nmp-write__ownState">{state}</p>
    </div>
  );
}

/**
 * The five-star distribution, counted off the reviews themselves.
 *
 * The average is DERIVED from the same counts rather than stored beside them: a
 * headline score that disagrees with the bars underneath it is the one thing a
 * panel like this cannot afford, and it happens the moment the two are
 * separate numbers.
 */
function distributionOf(reviews: Review[]) {
  /* Index 0 is five stars, matching the order the bars are drawn in. */
  const counts = [0, 0, 0, 0, 0];
  let points = 0;

  for (const review of reviews) {
    const stars = Number(review.rating);
    if (!Number.isFinite(stars) || stars < 1 || stars > 5) continue;
    counts[5 - stars] += 1;
    points += stars;
  }

  const total = counts.reduce((sum, count) => sum + count, 0);

  return {
    counts,
    total,
    average: total === 0 ? 0 : points / total,
    /* Never zero — it is a divisor. */
    peak: Math.max(1, ...counts),
  };
}
