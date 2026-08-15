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

export const REVIEW_STATES = ["Pending", "Approved", "Rejected"] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];

export type Review = {
  /**
   * Minted by the register, never typed. The form does not ask for it and no
   * screen shows it — it is how a row is identified for an edit or a delete,
   * and nothing else.
   */
  id: string;
  product: string;
  /** "5" — a string, so a review stays the flat map the register renders. */
  rating: string;
  customer: string;
  headline: string;
  body: string;
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

/** Only an approved review leaves the desk. Everything else stays internal. */
export function approvedReviews(reviews: Review[]) {
  return reviews.filter((review) => review.status === "Approved");
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
  const status = REVIEW_STATES.find((state) => state === row.status) ?? "Pending";
  const rating = String(row.rating ?? "5").trim();

  return {
    id: row.id ?? "",
    product: row.product ?? "",
    rating: /^[1-5]$/.test(rating) ? rating : "5",
    customer: row.customer?.trim() || "Anonymous",
    headline: row.headline ?? "",
    body: row.body ?? "",
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

/**
 * What this browser starts with: three waiting on a decision, one already
 * published, one already refused — plus the two the account's own feedback tab
 * has always claimed the shopper wrote, so the two screens tell one story
 * instead of two.
 */
export const seededReviews: Review[] = [
  {
    id: "REV-2041",
    product: "Afterdark Hoodie",
    rating: "5",
    customer: "A•••• K••••",
    headline: "Built like an outer layer should be.",
    body: "The canvas has real structure without fighting movement. The shoulders sit exactly where the size guide suggested.",
    submitted: "04 Aug 2026",
    status: "Pending",
    origin: "Console",
  },
  {
    id: "REV-2040",
    product: "Bone Utility Overshirt",
    rating: "3",
    customer: "M•••• P••••",
    headline: "Good weight, awkward sleeve.",
    body: "The fabric is genuinely heavy and the colour is accurate. The sleeve runs a little long on a 40 chest.",
    submitted: "04 Aug 2026",
    status: "Pending",
    origin: "Console",
  },
  {
    id: "REV-2039",
    product: "Core Heavy Tee",
    rating: "2",
    customer: "R•••• S••••",
    headline: "Shrank more than I expected.",
    body: "Washed cold and it still came back a size shorter. The cotton itself is nice.",
    submitted: "03 Aug 2026",
    status: "Pending",
    origin: "Console",
  },
  {
    id: "REV-2036",
    product: "Shadow Cargo 02",
    rating: "5",
    customer: "D•• W••••",
    headline: "The only pair I reach for.",
    body: "Pockets that actually hold something and a hem that sits right over a boot. Three months in and the knees have not gone.",
    submitted: "03 Aug 2026",
    status: "Approved",
    origin: "Console",
  },
  {
    id: "REV-2031",
    product: "Nocturne Cap",
    rating: "1",
    customer: "S••• R••••",
    headline: "Closed with a policy reason.",
    body: "Contained another shopper's contact details, so it was refused rather than published.",
    submitted: "02 Aug 2026",
    status: "Rejected",
    origin: "Console",
  },
  {
    id: "REV-2028",
    product: "Afterdark Hoodie",
    rating: "5",
    customer: "You",
    headline: "Dense fabric and a clean oversized fit.",
    body: "Dense fabric and a clean oversized fit. It has kept its shape through a month of daily wear.",
    submitted: "22 Jul 2026",
    status: "Approved",
    origin: "Customer",
  },
  {
    id: "REV-2024",
    product: "Core Heavy Tee",
    rating: "4",
    customer: "You",
    headline: "The uploaded image showed personal contact details.",
    body: "The uploaded image showed personal contact details, so this one needs an edit before it can be published.",
    submitted: "19 Jul 2026",
    status: "Rejected",
    origin: "Customer",
  },
];
