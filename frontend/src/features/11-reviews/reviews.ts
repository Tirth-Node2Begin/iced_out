/**
 * One review, and the only place it is written down.
 *
 * A review is read from three directions — the shopper writes it in the account,
 * an operator decides on it in the console, and the home page quotes it once it
 * has been approved — so there is exactly one record behind all three. The
 * alternative is three lists that agree until the first approval, which is the
 * bug this store exists to make impossible.
 *
 * Every field is a `string` because the console's register renders flat string
 * maps; keeping the shape the register already understands is what lets the
 * moderation screen be a plain `RecordManager` with no adapter around it.
 */

/**
 * The two states a review can be in.
 *
 * There is no `Pending`. A review is live the moment it is written, and the
 * desk's job is taking one DOWN rather than letting it up — see migration
 * 0022. `Hidden` is that: reversible, recorded, and invisible to shoppers.
 */
export const REVIEW_STATES = ["Published", "Hidden"] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];

export type Review = {
  /**
   * Minted by the register, never typed. The form does not ask for it and no
   * screen shows it — it is how a row is identified for an edit or a delete,
   * and nothing else.
   */
  id: string;
  product: string;
  /**
   * The slug the review is filed against.
   *
   * A product page matches on THIS, never on the name: two pieces can be called
   * the same thing, and quoting one garment's reviews on another is the mistake
   * that makes a review section worthless. Empty where the product has since
   * been deleted, in which case no page claims it.
   */
  productSlug: string;
  /** "5" — a string, so a review stays the flat map the register renders. */
  rating: string;
  customer: string;
  headline: string;
  body: string;
  /** "True to size" and the like, where the shopper answered it. */
  fit: string;
  /** "04 Aug 2026" — the same stamp the account and the vouchers tab use. */
  submitted: string;
  status: ReviewState;
  /**
   * Who wrote it. Not shown anywhere: it is what lets the account list the
   * shopper's OWN feedback back to them without listing the whole register.
   */
  origin: "Customer" | "Console";
};

/** "04 Aug 2026" — written the way every other date in the app reads. */
export function reviewStamp(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** What a shopper may see. A hidden review has been taken down. */
export function publishedReviews(reviews: Review[]) {
  return reviews.filter((review) => review.status === "Published");
}

export function averageRating(reviews: Review[]) {
  const scored = reviews
    .map((review) => Number(review.rating))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (scored.length === 0) return 0;
  return scored.reduce((sum, value) => sum + value, 0) / scored.length;
}

export function countByState(reviews: Review[], state: ReviewState) {
  return reviews.filter((review) => review.status === state).length;
}

/**
 * A loose row — one the register just wrote, or one read back out of storage —
 * as a review.
 *
 * Everything is defaulted rather than trusted, so a record written before a
 * field existed, or edited by hand, is still usable instead of poisoning a
 * render with `undefined`.
 */
export function asReview(row: Record<string, string | undefined>): Review {
  /* Anything the server sends that this build does not know is read as
     published, because that is what a review IS unless somebody hid it — and
     defaulting an unrecognised state to invisible would silently take real
     reviews off the page during a deploy. */
  const status = REVIEW_STATES.find((state) => state === row.status) ?? "Published";
  const rating = String(row.rating ?? "5").trim();

  return {
    id: row.id ?? "",
    product: row.product ?? "",
    productSlug: row.productSlug ?? "",
    rating: /^[1-5]$/.test(rating) ? rating : "5",
    customer: row.customer?.trim() || "Anonymous",
    headline: row.headline ?? "",
    body: row.body ?? "",
    fit: row.fit ?? "",
    submitted: row.submitted ?? "",
    status,
    origin: row.origin === "Customer" ? "Customer" : "Console",
  };
}

/**
 * How a review signs itself in public.
 *
 * The account calls the shopper's own reviews "You", which is right on their
 * own feedback tab and wrong everywhere a stranger reads it. The storefront
 * gets the byline a stranger would expect instead.
 */
export function reviewByline(review: Review) {
  return review.origin === "Customer" ? "Verified buyer" : review.customer;
}
