"use client";

import { Check, ImagePlus, Star } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AccountSection } from "@/components/account/account-section";
import { orderFixtures } from "@/features/07-orders/data/order-fixtures";
import { useReviews } from "@/features/11-reviews/reviews-context";
import type { ReviewState } from "@/features/11-reviews/reviews";

/**
 * Feedback — what the tab used to call "Reviews".
 *
 * Only a delivered line can be written about, so the eligible list is derived
 * from the order archive rather than hard-coded: the same fixtures the orders
 * tab reads. Sending one writes it to the SAME register the moderation desk
 * reads, so what this table calls a state is the decision an operator actually
 * made — not a label this screen invented and then never revisited.
 */
type Entry = {
  id: string;
  piece: string;
  rating: number;
  state: "In moderation" | "Published" | "Needs an edit";
  date: string;
  note: string;
};

/** The desk's decisions, said the way a shopper would say them. */
const STATE_WORDS: Record<ReviewState, Entry["state"]> = {
  Pending: "In moderation",
  Approved: "Published",
  Rejected: "Needs an edit",
};

const STATE_BADGE: Record<Entry["state"], string> = {
  Published: "io-badge--ok",
  "In moderation": "io-badge--live",
  "Needs an edit": "io-badge--danger",
};

export function FeedbackWorkspace() {
  const { mine, submit: sendReview } = useReviews();
  const [writingAbout, setWritingAbout] = useState<string | null>(null);
  const [justSent, setJustSent] = useState<string | null>(null);

  /* Read off the register rather than kept here, so an approval made on the
     moderation desk turns this row from "In moderation" into "Published"
     without this screen having to be told about it. */
  const entries: Entry[] = mine.map((review) => ({
    id: review.id,
    piece: review.product,
    rating: Number(review.rating) || 0,
    state: STATE_WORDS[review.status],
    date: review.submitted,
    note: review.headline || review.body,
  }));

  /* Delivered lines only — an order still in transit has nothing to say yet. */
  const eligible = orderFixtures
    .filter((order) => order.status === "Delivered")
    .flatMap((order) =>
      order.lines.map((line) => ({
        id: line.id,
        name: line.name,
        variant: line.variant,
        order: order.number,
        date: order.date,
      })),
    )
    .filter((line) => !entries.some((entry) => entry.piece === line.name));

  const target = eligible.find((line) => line.id === writingAbout);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;

    const form = new FormData(event.currentTarget);
    /* Straight onto the moderation desk, waiting on a decision. Nothing this
       form can say puts it on the storefront — only an approval does. */
    sendReview({
      product: target.name,
      rating: Number(form.get("rating") ?? 5),
      headline: String(form.get("title") ?? "").trim(),
      body: String(form.get("message") ?? "").trim(),
    });
    setJustSent(target.name);
    setWritingAbout(null);
  }

  return (
    <AccountSection
      copy="Only pieces that reached you can be written about. Feedback is checked before it appears on a product page, and the rating is kept with the size you actually bought."
      eyebrow="Account / Verified voices"
      title="Tell us how it wore."
      actions={
        <span className="io-badge io-badge--plain">
          {entries.filter((entry) => entry.state === "Published").length} published
        </span>
      }
    >
      {justSent && (
        <div className="io-note io-note--ok">
          <Check aria-hidden size={16} strokeWidth={2} />
          <p>
            <strong>Feedback on {justSent} received.</strong>
            It sits in moderation until a person clears it — usually within two working
            days.
          </p>
        </div>
      )}

      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">Ready to write about</h3>
            <p className="io-panel__note">
              {eligible.length === 0
                ? "Nothing waiting — every delivered piece already has your feedback."
                : "Construction, weight, fit and how it held up are the parts other people use."}
            </p>
          </div>
        </header>

        {eligible.length === 0 ? (
          <div className="io-empty">
            <strong>All caught up</strong>
            The next delivered order opens here.
          </div>
        ) : (
          <div className="io-rows">
            {eligible.map((line) => (
              <div className="io-row" key={line.id}>
                <span className="io-row__glyph">
                  <Star aria-hidden size={16} strokeWidth={1.6} />
                </span>
                <span>
                  <span className="io-row__label">{line.name}</span>
                  <span className="io-row__note">
                    {line.variant} · Delivered {line.date} · {line.order}
                  </span>
                </span>
                <button
                  className="io-btn io-btn--ghost io-btn--sm"
                  onClick={() => {
                    setJustSent(null);
                    setWritingAbout(writingAbout === line.id ? null : line.id);
                  }}
                  type="button"
                >
                  {writingAbout === line.id ? "Close" : "Write feedback"}
                </button>
              </div>
            ))}
          </div>
        )}

        {target && (
          <form className="io-form" onSubmit={submit} style={{ marginTop: 14 }}>
            <fieldset className="io-field" style={{ border: 0, margin: 0, padding: 0 }}>
              <legend>
                <span className="io-stat__label">Rating · {target.name}</span>
              </legend>
              <div className="io-stars">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <label key={rating}>
                    <input
                      defaultChecked={rating === 5}
                      name="rating"
                      required
                      type="radio"
                      value={rating}
                    />
                    <Star aria-hidden size={22} strokeWidth={1.5} />
                    <span className="sr-only">{rating} stars</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="io-form__row">
              <label className="io-field">
                <span>Headline</span>
                <input maxLength={80} name="title" placeholder="A clear, useful line" required />
              </label>
              <label className="io-field">
                <span>How did it fit?</span>
                <select defaultValue="True to size" name="fit">
                  <option>Runs small</option>
                  <option>True to size</option>
                  <option>Runs large</option>
                </select>
              </label>
            </div>

            <label className="io-field">
              <span>Your feedback</span>
              <textarea
                minLength={20}
                name="message"
                placeholder="Weight, comfort, how it washed, how it wore…"
                required
                rows={5}
              />
            </label>

            <label className="io-upload">
              <ImagePlus aria-hidden size={20} strokeWidth={1.6} />
              <span>
                <strong>Add images</strong>
                Up to five JPG, PNG or WebP files. No faces, no personal details.
              </span>
              <input accept="image/jpeg,image/png,image/webp" multiple type="file" />
            </label>

            <div className="io-actions io-actions--end">
              <button
                className="io-btn io-btn--ghost"
                onClick={() => setWritingAbout(null)}
                type="button"
              >
                Discard
              </button>
              <button className="io-btn io-btn--solid" type="submit">
                Send feedback
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="io-panel">
        <header className="io-panel__head">
          <div>
            <h3 className="io-panel__title">Your feedback</h3>
            <p className="io-panel__note">
              Moderation checks for personal details and abuse, not for opinion.
            </p>
          </div>
        </header>

        <div className="io-tablewrap">
          <table className="io-table">
            <thead>
              <tr>
                <th scope="col">Piece</th>
                <th data-align="right" scope="col">Rating</th>
                <th scope="col">Sent</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <th scope="row">
                    <span className="io-table__primary">{entry.piece}</span>
                    <span className="io-table__sub">{entry.note}</span>
                  </th>
                  <td className="io-table__num" data-align="right">
                    {entry.rating} / 5
                  </td>
                  <td className="io-table__num">{entry.date}</td>
                  <td>
                    <span className={`io-badge ${STATE_BADGE[entry.state]}`}>{entry.state}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AccountSection>
  );
}
