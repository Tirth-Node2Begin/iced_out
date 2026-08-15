"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { createLocalStore } from "@/lib/local-store";
import { useHydrated } from "@/lib/use-hydrated";
import {
  approvedReviews,
  asReview,
  reviewStamp,
  seededReviews,
  type Review,
} from "@/features/11-reviews/reviews";

/**
 * The reviews this browser holds, from both directions.
 *
 * The account writes one and it arrives on the moderation desk waiting for a
 * decision; the console decides; the home page quotes whatever was approved.
 * All three read this store, so an approval in the console is the quote the
 * shopper sees — there is no second list anywhere to drift from it.
 *
 * It sits high in the provider tree for the same reason the vouchers store
 * does: the console and the storefront are two routes in one app, and both ends
 * have to be looking at the same record.
 *
 * Backed by `createLocalStore` rather than a `useState` filled from an effect,
 * which is what makes a decision survive a reload and show up in the other tab
 * without either screen having to be told about it.
 */

const STORAGE_KEY = "iced-out-reviews-v1";

type Register = { reviews: Review[] };

const store = createLocalStore<Register>(STORAGE_KEY, { reviews: seededReviews }, (parsed, fallback) => {
  if (!parsed || typeof parsed !== "object") return null;
  const held: unknown = (parsed as { reviews?: unknown }).reviews;
  if (!Array.isArray(held)) return fallback;

  /* Normalised on the way in, so a record written before a field existed — or
     edited by hand — is still usable instead of poisoning a render. Anything
     without an id is not a review and is dropped rather than repaired. */
  return {
    reviews: (held as unknown[]).flatMap((entry): Review[] => {
      if (!entry || typeof entry !== "object") return [];
      const review = asReview(entry as Record<string, string | undefined>);
      return review.id === "" ? [] : [review];
    }),
  };
});

type SubmitInput = {
  product: string;
  /** 1–5. Anything else is treated as a five. */
  rating: number;
  headline: string;
  body: string;
};

type ReviewsContextValue = {
  reviews: Review[];
  /** The only ones the storefront is allowed to show. */
  approved: Review[];
  /** What the shopper wrote, for their own feedback tab. */
  mine: Review[];
  /** False while React is rendering the exported markup. */
  ready: boolean;
  /**
   * Applies one change to the register. It takes an updater rather than a list
   * because an undo can fire long after the render that offered it, and it
   * still has to build on what is current.
   */
  setAll: (next: (current: Review[]) => Review[]) => void;
  /** A shopper's own feedback, which always lands waiting on a decision. */
  submit: (input: SubmitInput) => Review;
};

const ReviewsContext = createContext<ReviewsContextValue | null>(null);

export function ReviewsProvider({ children }: { children: ReactNode }) {
  const register = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const ready = useHydrated();

  const setAll = useCallback((next: (current: Review[]) => Review[]) => {
    store.write({ reviews: next(store.getSnapshot().reviews).map(asReview) });
  }, []);

  const submit = useCallback((input: SubmitInput) => {
    const current = store.getSnapshot().reviews;
    const rating = Math.round(input.rating);

    const review = asReview({
      id: mintId(current),
      product: input.product,
      rating: String(rating >= 1 && rating <= 5 ? rating : 5),
      customer: "You",
      headline: input.headline,
      body: input.body,
      submitted: reviewStamp(new Date()),
      /* Never anything else on the way in. A review is published by a decision
         on the desk, not by having been written. */
      status: "Pending",
      origin: "Customer",
    });

    store.write({ reviews: [review, ...current] });
    return review;
  }, []);

  const value = useMemo<ReviewsContextValue>(
    () => ({
      reviews: register.reviews,
      approved: approvedReviews(register.reviews),
      mine: register.reviews.filter((review) => review.origin === "Customer"),
      ready,
      setAll,
      submit,
    }),
    [ready, register, setAll, submit],
  );

  return <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>;
}

/**
 * The next free id, stepped over what is already taken.
 *
 * Minted from the list rather than from a clock or a random source, so the
 * sequence is stable and an id can never collide with one storage already
 * holds. Nothing on screen shows it — it identifies a row and nothing else.
 */
function mintId(current: Review[]) {
  const taken = new Set(current.map((review) => review.id));
  let n = current.length + 1;
  while (taken.has(`REV-${String(n).padStart(4, "0")}`)) n += 1;
  return `REV-${String(n).padStart(4, "0")}`;
}

export function useReviews() {
  const context = useContext(ReviewsContext);
  if (!context) throw new Error("useReviews must be used inside ReviewsProvider");
  return context;
}
