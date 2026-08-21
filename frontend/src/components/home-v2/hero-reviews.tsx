"use client";

import { Lock, Plus, Star, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
} from "react";
import { toast } from "sonner";

import { catalogStore } from "@/features/02-products";
import { reviewByline, type Review } from "@/features/11-reviews/reviews";
import { useReviews } from "@/features/11-reviews/reviews-context";
import { useAuth } from "@/features/20-auth-security/auth-context";

import { EASE } from "./motion";

/**
 * The hero's review corner — bottom left, opposite the parked garment.
 *
 * What somebody standing in a shop doorway wants to know before anything else
 * is whether other people were pleased, and the home page only answered that
 * two screens down, in the testimonial band. This puts the answer in the first
 * viewport as the smallest thing that can carry it: one face per review, the
 * score beside them, and one more chip to add your own.
 *
 * It reads the SAME register every other review surface does — the product
 * page's panel, the account's feedback tab, the moderation desk — so a review
 * written here is on its product page at once and can be taken down from the
 * desk like any other. Nothing in this corner is a second copy.
 *
 * A review is filed against a PIECE, which is why the form asks which one. The
 * tempting alternative is a product-less "rate the shop", and it is a trap:
 * `uq_reviews_customer_product` is keyed on `(user_id, product_id)` and NULLs
 * are distinct in a unique index, so a review with no product is a review the
 * database cannot hold to one per customer. Asking the question keeps the
 * constraint doing its job.
 */

/** How many faces the stack carries before it starts counting the rest. */
const SHOWN = 4;

/**
 * Muted tints, picked to sit on the hero's graphite rather than on white.
 * Assigned by a hash of the review id, so a face keeps its colour between
 * renders and between visits without anything being stored against it.
 */
const TONES = ["#f2ece0", "#cdd8dd", "#e3d4bd", "#b9c4c9"] as const;

const FIT_ANSWERS = ["Runs small", "True to size", "Runs large"] as const;

/** The letter on a chip. */
function monogram(name: string) {
  const letter = name.trim().match(/[a-z0-9]/i);
  return letter ? letter[0].toUpperCase() : "?";
}

function toneFor(id: string) {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) sum = (sum * 31 + id.charCodeAt(index)) >>> 0;
  return TONES[sum % TONES.length];
}

/**
 * Five stars with a fractional fill, drawn from two stacked rows and a clip.
 *
 * Local rather than the product page's `<Stars>`: that one is styled by
 * `new-man-product.css`, which this route does not load, so importing it here
 * would render five unstyled outlines.
 */
function HeroStars({ size = 13, value }: { size?: number; value: number }) {
  const row = Array.from({ length: 5 });
  const pct = (Math.max(0, Math.min(5, value)) / 5) * 100;

  return (
    <span
      aria-label={`${value.toFixed(1)} out of 5`}
      className="hv2-heroRev__stars"
      role="img"
      style={{ "--pct": `${pct}%` } as CSSProperties}
    >
      <span aria-hidden className="hv2-heroRev__starRow">
        {row.map((_, index) => (
          <Star key={index} size={size} strokeWidth={1.5} />
        ))}
      </span>
      <span aria-hidden className="hv2-heroRev__starRow hv2-heroRev__starRow--on">
        {row.map((_, index) => (
          <Star fill="currentColor" key={index} size={size} strokeWidth={1.5} />
        ))}
      </span>
    </span>
  );
}

type Panel = { kind: "read"; id: string } | { kind: "write" } | null;

export function HeroReviews() {
  const reduce = useReducedMotion();
  const { published, mine, ready, submit, refresh, refreshMine } = useReviews();
  const { isAuthenticated, sessionReady } = useAuth();

  const [panel, setPanel] = useState<Panel>(null);
  const [rating, setRating] = useState(5);
  const [piece, setPiece] = useState("");
  const [sending, setSending] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  /**
   * The catalogue, but only once the form is open.
   *
   * `useCatalog()` would do this in one line and would also make every visit to
   * the home page fetch twenty-eight products in order to draw a plus sign —
   * reading `getSnapshot` is what starts the request. `peek` is the same
   * snapshot without that side effect, so the corner costs nothing until a
   * signed-in shopper asks to write — the same trade `ReviewsProvider` makes
   * for a signed-out visitor's own reviews. Signed out is excluded because the
   * panel shows them the sign-in gate, which needs no catalogue.
   */
  const catalogState = useSyncExternalStore(
    catalogStore.subscribe,
    panel?.kind === "write" && isAuthenticated ? catalogStore.getSnapshot : catalogStore.peek,
    catalogStore.getServerSnapshot,
  );
  const catalogue = catalogState.data;
  const catalogueReady = catalogState.loaded;

  /* Newest first, which is the order the endpoint already returns them in. */
  const shown = published.slice(0, SHOWN);
  const rest = Math.max(0, published.length - shown.length);

  const score = useMemo(() => {
    const scored = published
      .map((review) => Number(review.rating))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
    if (scored.length === 0) return 0;
    return scored.reduce((sum, value) => sum + value, 0) / scored.length;
  }, [published]);

  /** Which of the faces is this shopper's own, so theirs is marked as theirs. */
  const ownIds = useMemo(() => new Set(mine.map((review) => review.id)), [mine]);

  /* One review per customer per piece, so a piece they have already written
     about is not offered again — the server would refuse it, and finding that
     out after four hundred words is the wrong moment to be told. */
  const written = useMemo(
    () => new Set(mine.map((review) => review.productSlug).filter(Boolean)),
    [mine],
  );
  const choices = useMemo(
    () => catalogue.filter((product) => !written.has(product.slug)),
    [catalogue, written],
  );

  /* Derived rather than kept in sync by an effect: the catalogue lands after
     the first render, and a `piece` held in state would still be "" when it
     did — which is a submit the server refuses for a product nobody named. */
  const target = choices.some((product) => product.slug === piece)
    ? piece
    : (choices[0]?.slug ?? "");

  const reading =
    panel?.kind === "read" ? published.find((review) => review.id === panel.id) : undefined;

  /* Escape and a click outside — the two ways every other popover here closes. */
  useEffect(() => {
    if (!panel) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setPanel(null);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [panel]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;

    const form = new FormData(event.currentTarget);
    setSending(true);

    try {
      await submit({
        /* The slug, so the server files it against the product rather than
           matching on a name two pieces could share. */
        product: target,
        rating,
        headline: String(form.get("headline") ?? "").trim(),
        body: String(form.get("body") ?? "").trim(),
        fit: String(form.get("fit") ?? "").trim() || undefined,
      });

      /* The public list is re-read rather than written to here: what the
         storefront quotes should come from the endpoint that decides it, not
         from the browser that just posted. That re-read is what puts their own
         face into the stack. */
      await refresh().catch(() => {});

      toast.success("Thank you — your review is up", {
        description: "It is on the piece's own page now, and in this row.",
      });
      setPanel(null);
      setRating(5);
    } catch (caught) {
      /* Reported rather than swallowed. The client's normaliser has already
         turned the refusal into a sentence written to be read, including the
         duplicate check's, which names the piece. */
      toast.error("That review could not be sent", {
        description:
          caught instanceof Error ? caught.message : "The server refused it. Please try again.",
      });
      /* The server knows something this browser does not — almost always "you
         have already reviewed this piece". Re-read rather than argue. */
      await refreshMine().catch(() => {});
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="hv2-heroRev" ref={root}>
      <AnimatePresence>
        {panel && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="hv2-heroRev__panel"
            data-kind={panel.kind}
            exit={{ opacity: 0, y: reduce ? 0 : 8 }}
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            key={panel.kind === "read" ? panel.id : "write"}
            transition={{ duration: reduce ? 0.15 : 0.34, ease: EASE }}
          >
            <button
              aria-label="Close"
              className="hv2-heroRev__close"
              onClick={() => setPanel(null)}
              type="button"
            >
              <X aria-hidden size={13} strokeWidth={1.8} />
            </button>

            {panel.kind === "read" && reading && <ReadCard review={reading} />}

            {panel.kind === "write" &&
              /* Held until the session is known. Offering "sign in to review" to
                 somebody who is already signed in, for the beat it takes to find
                 out, is worse than showing nothing for that beat. */
              (!sessionReady ? (
                <p className="hv2-heroRev__note">One moment…</p>
              ) : !isAuthenticated ? (
                <div className="hv2-heroRev__gate">
                  <Lock aria-hidden size={14} strokeWidth={1.6} />
                  <p>
                    <strong>Worn one of ours?</strong> Sign in to leave a review — one per
                    piece, published as you wrote it.
                  </p>
                  <Link
                    className="hv2-heroRev__signin"
                    href={`/auth/login?returnTo=${encodeURIComponent("/")}`}
                  >
                    Sign in
                  </Link>
                </div>
              ) : catalogueReady && choices.length === 0 ? (
                <p className="hv2-heroRev__note">
                  {catalogue.length === 0
                    ? "Nothing is on sale yet, so there is nothing to write about."
                    : "You have written about every piece in the shop. Thank you."}
                </p>
              ) : (
                <form className="hv2-heroRev__form" onSubmit={(event) => void send(event)}>
                  <p className="hv2-heroRev__eyebrow">Your review</p>

                  {/* A radio group, not five buttons: the arrow keys move between
                      the options and the whole thing answers to one name, which
                      is what a rating is. */}
                  <div aria-label="Rating" className="hv2-heroRev__pick" role="radiogroup">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        aria-checked={rating === value}
                        aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                        className="hv2-heroRev__pickStar"
                        data-on={value <= rating || undefined}
                        key={value}
                        onClick={() => setRating(value)}
                        role="radio"
                        type="button"
                      >
                        <Star aria-hidden size={17} strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>

                  <label className="hv2-heroRev__field">
                    <span>Which piece</span>
                    <select
                      disabled={!catalogueReady}
                      name="piece"
                      onChange={(event) => setPiece(event.target.value)}
                      value={target}
                    >
                      {!catalogueReady && <option value="">Loading the shop…</option>}
                      {choices.map((product) => (
                        <option key={product.slug} value={product.slug}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="hv2-heroRev__field">
                    <span>Headline</span>
                    <input
                      maxLength={160}
                      minLength={3}
                      name="headline"
                      placeholder="A clear, useful line"
                      required
                    />
                  </label>

                  <label className="hv2-heroRev__field">
                    <span>How does it fit?</span>
                    <select defaultValue="" name="fit">
                      <option value="">Not sure</option>
                      {FIT_ANSWERS.map((answer) => (
                        <option key={answer} value={answer}>
                          {answer}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="hv2-heroRev__field">
                    <span>What you thought</span>
                    <textarea
                      maxLength={4000}
                      name="body"
                      placeholder="The weight, the fit, how it has worn."
                      rows={3}
                    />
                  </label>

                  <div className="hv2-heroRev__acts">
                    <button
                      className="hv2-heroRev__cancel"
                      disabled={sending}
                      onClick={() => setPanel(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="hv2-heroRev__send"
                      disabled={sending || !target}
                      type="submit"
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                </form>
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hv2-heroRev__stack">
        {shown.map((review) => (
          <button
            aria-label={`Review by ${review.customer}, ${review.rating} out of 5`}
            className="hv2-heroRev__chip"
            data-open={panel?.kind === "read" && panel.id === review.id ? "true" : undefined}
            data-own={ownIds.has(review.id) ? "true" : undefined}
            key={review.id}
            onClick={() =>
              setPanel((open) =>
                open?.kind === "read" && open.id === review.id
                  ? null
                  : { kind: "read", id: review.id },
              )
            }
            style={{ "--tone": toneFor(review.id) } as CSSProperties}
            type="button"
          >
            {monogram(review.customer)}
          </button>
        ))}

        {rest > 0 && (
          <span aria-hidden className="hv2-heroRev__chip hv2-heroRev__chip--rest">
            +{rest}
          </span>
        )}

        <button
          aria-expanded={panel?.kind === "write"}
          aria-label="Write a review"
          className="hv2-heroRev__chip hv2-heroRev__chip--add"
          data-open={panel?.kind === "write" ? "true" : undefined}
          onClick={() => setPanel((open) => (open?.kind === "write" ? null : { kind: "write" }))}
          type="button"
        >
          <Plus aria-hidden size={17} strokeWidth={2} />
        </button>
      </div>

      <div className="hv2-heroRev__meta">
        {published.length > 0 ? (
          <>
            {/* Larger than the card's row: this one is read across the hero at
                a glance, the card's is read from a foot away. */}
            <HeroStars size={16} value={score} />
            <strong>{score.toFixed(1)}</strong>
            <span>
              {published.length} {published.length === 1 ? "review" : "reviews"}
            </span>
          </>
        ) : (
          /* Not "0.0 out of 5" — nobody has given that verdict. And not an empty
             corner either, because the chip beside this line is the invitation. */
          <span>{ready ? "Be the first to review" : "Reviews"}</span>
        )}
      </div>
    </div>
  );
}

/** One review, opened from its own face. */
function ReadCard({ review }: { review: Review }) {
  const byline = reviewByline(review);

  return (
    <div className="hv2-heroRev__card">
      <div className="hv2-heroRev__cardHead">
        <span
          aria-hidden
          className="hv2-heroRev__chip hv2-heroRev__chip--flat"
          style={{ "--tone": toneFor(review.id) } as CSSProperties}
        >
          {monogram(review.customer)}
        </span>
        <span className="hv2-heroRev__cardWho">
          <strong>{review.customer}</strong>
          {/* The byline is only drawn where it says something the name has not:
              "Verified buyer" for one a shopper wrote through their account. A
              console-origin review bylines itself with the customer's name,
              which is already the line above. */}
          <span>{byline !== review.customer ? byline : review.submitted}</span>
        </span>
      </div>

      <HeroStars value={Number(review.rating) || 0} />

      {review.headline && <p className="hv2-heroRev__cardTitle">{review.headline}</p>}
      {review.body && <p className="hv2-heroRev__cardBody">&ldquo;{review.body}&rdquo;</p>}

      <p className="hv2-heroRev__cardFoot">
        {review.product}
        {review.fit ? ` · ${review.fit}` : ""}
      </p>
    </div>
  );
}
